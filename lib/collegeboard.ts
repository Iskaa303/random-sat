export type CollegeBoardQuestion = {
  type: string
  stem: string
  stimulus?: string
  keys: string[]
  answerOptions: Array<{
    id: string
    content: string
  }>
  rationale: string
  externalid: string
  correct_answer: string[]
}

export type QuestionMetadata = {
  updateDate: number
  pPcc: string
  questionId: string
  skill_cd: string
  score_band_range_cd: number
  skill_desc: string
  createDate: number
  program: string
  primary_class_cd_desc: string
  ibn: null
  external_id: string
  primary_class_cd: string
  uId: string
  difficulty: string
}

export type CollegeBoardQuery = {
  section?: string
  domain?: string
  skill?: string
  difficulty?: string
}

const API_GET_IDS = "https://qbank-api.collegeboard.org/msreportingquestionbank-prod/questionbank/digital/get-questions"
const API_GET_SINGLE = "https://qbank-api.collegeboard.org/msreportingquestionbank-prod/questionbank/digital/get-question"

const cachedIds: Map<string, QuestionMetadata[]> = new Map()
const cachedQuestions: Map<string, CollegeBoardQuestion> = new Map()
const ONE_DAY_IN_SECONDS = 60 * 60 * 24
const QUESTION_FETCH_RETRY_LIMIT = 3

function normalizeQuestion(rawQuestion: unknown, requestedId: string): CollegeBoardQuestion {
  const candidate = rawQuestion && typeof rawQuestion === "object" ? (rawQuestion as Record<string, unknown>) : {}
  const answerOptions = Array.isArray(candidate.answerOptions)
    ? candidate.answerOptions
        .filter(
          (option): option is { id: string; content: string } =>
            !!option &&
            typeof option === "object" &&
            typeof (option as { id?: unknown }).id === "string" &&
            typeof (option as { content?: unknown }).content === "string"
        )
        .map((option) => ({
          id: option.id,
          content: option.content,
        }))
    : []

  return {
    type:
      typeof candidate.type === "string"
        ? candidate.type
        : answerOptions.length > 0
          ? "mcq"
          : "spr",
    stem: typeof candidate.stem === "string" ? candidate.stem : "",
    stimulus: typeof candidate.stimulus === "string" ? candidate.stimulus : undefined,
    keys: Array.isArray(candidate.keys) ? candidate.keys.filter((value): value is string => typeof value === "string") : [],
    answerOptions,
    rationale: typeof candidate.rationale === "string" ? candidate.rationale : "",
    externalid:
      typeof candidate.externalid === "string"
        ? candidate.externalid
        : typeof candidate.external_id === "string"
          ? candidate.external_id
          : requestedId,
    correct_answer: Array.isArray(candidate.correct_answer)
      ? candidate.correct_answer.filter((value): value is string => typeof value === "string")
      : [],
  }
}

function isQuestionUsable(question: CollegeBoardQuestion) {
  return Boolean(question.externalid && question.stem && (question.answerOptions.length > 0 || question.correct_answer.length > 0 || question.keys.length > 0))
}

async function fetchQuestionIds(section: string): Promise<QuestionMetadata[]> {
  if (cachedIds.has(section)) return cachedIds.get(section)!

  const test = section === "math" ? 2 : 1
  const domain = section === "math" ? "H,P,Q,S" : "INI,CAS,EOI,SEC"

  const payload = {
    asmtEventId: 99,
    test,
    domain
  }

  try {
    const response = await fetch(API_GET_IDS, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      next: {
        revalidate: ONE_DAY_IN_SECONDS,
        tags: [`collegeboard:ids:${section}`],
      },
    })
    const data = await response.json()
    cachedIds.set(section, data)
    return data
  } catch (error) {
    throw new Error(`Failed to fetch question IDs for ${section}: ${error}`)
  }
}

async function fetchQuestion(externalId: string): Promise<CollegeBoardQuestion> {
  if (cachedQuestions.has(externalId)) {
    return cachedQuestions.get(externalId)!
  }

  let lastError: unknown

  for (let attempt = 0; attempt < QUESTION_FETCH_RETRY_LIMIT; attempt += 1) {
    try {
      const response = await fetch(API_GET_SINGLE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ external_id: externalId }),
        next: {
          revalidate: ONE_DAY_IN_SECONDS,
          tags: [`collegeboard:question:${externalId}`],
        },
      })

      const question = normalizeQuestion(await response.json(), externalId)
      if (!isQuestionUsable(question)) {
        throw new Error(`Incomplete question payload for ${externalId}`)
      }

      cachedQuestions.set(externalId, question)
      return question
    } catch (error) {
      lastError = error
    }
  }

  throw new Error(`Failed to fetch question ${externalId}: ${lastError}`)
}

export async function getCollegeBoardQuestionIds(query: CollegeBoardQuery = {}): Promise<QuestionMetadata[]> {
  const section = query.section || "english"
  const allIds =
    section === "any"
      ? [...(await fetchQuestionIds("english")), ...(await fetchQuestionIds("math"))]
      : await fetchQuestionIds(section)

  return allIds.filter(id => {
    // Filter by section (already done in fetch, but ok)
    if (query.section && (query.section === "english" || query.section === "math")) {
      const sectionMap: Record<string, string[]> = {
        english: ["INI", "CAS", "EOI", "SEC"],
        math: ["H", "P", "Q", "S"]
      }
      const allowedDomains = sectionMap[query.section]
      if (!allowedDomains?.includes(id.primary_class_cd)) {
        return false
      }
    }

    // Filter by domain
    if (query.domain && query.domain !== "any" && id.primary_class_cd !== query.domain) {
      return false
    }

    // Filter by skill
    if (query.skill && query.skill !== "any" && id.skill_cd !== query.skill) {
      return false
    }

    // Filter by difficulty
    if (query.difficulty && query.difficulty !== "any" && id.difficulty !== query.difficulty) {
      return false
    }

    return true
  })
}

export async function getRandomCollegeBoardQuestion(query: CollegeBoardQuery = {}): Promise<CollegeBoardQuestion> {
  const filteredIds = await getCollegeBoardQuestionIds(query)

  if (filteredIds.length === 0) {
    throw new Error("No questions match the specified criteria")
  }

  const shuffledIds = [...filteredIds]
  for (let index = shuffledIds.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffledIds[index], shuffledIds[randomIndex]] = [shuffledIds[randomIndex], shuffledIds[index]]
  }

  let lastError: unknown
  for (const selectedId of shuffledIds.slice(0, Math.min(shuffledIds.length, 12))) {
    try {
      return await fetchQuestion(selectedId.external_id)
    } catch (error) {
      lastError = error
    }
  }

  throw new Error(`Unable to load a complete question for the selected filters: ${lastError}`)
}

export async function getCollegeBoardQuestions(query: CollegeBoardQuery = {}): Promise<CollegeBoardQuestion[]> {
  const filteredIds = await getCollegeBoardQuestionIds(query)

  // Load questions in parallel
  const questions = await Promise.all(filteredIds.map(async (id) => {
    try {
      return await fetchQuestion(id.external_id)
    } catch {
      return null
    }
  }))

  return questions.filter((question): question is CollegeBoardQuestion => question !== null)
}

export async function getCollegeBoardQuestionById(externalId: string): Promise<CollegeBoardQuestion> {
  return fetchQuestion(externalId)
}

export async function getCollegeBoardQuestionMetadataById(externalId: string): Promise<QuestionMetadata | null> {
  const [englishIds, mathIds] = await Promise.all([
    getCollegeBoardQuestionIds({ section: "english" }),
    getCollegeBoardQuestionIds({ section: "math" }),
  ])

  return [...englishIds, ...mathIds].find((id) => id.external_id === externalId) ?? null
}

export async function getAllCollegeBoardQuestionIds(): Promise<QuestionMetadata[]> {
  const [englishIds, mathIds] = await Promise.all([
    getCollegeBoardQuestionIds({ section: "english" }),
    getCollegeBoardQuestionIds({ section: "math" }),
  ])

  return [...englishIds, ...mathIds]
}
