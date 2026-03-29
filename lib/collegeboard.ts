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
    const question = await response.json()
    cachedQuestions.set(externalId, question)
    return question
  } catch (error) {
    throw new Error(`Failed to fetch question ${externalId}: ${error}`)
  }
}

export async function getCollegeBoardQuestionIds(query: CollegeBoardQuery = {}): Promise<QuestionMetadata[]> {
  const section = query.section || "english"
  const allIds = await fetchQuestionIds(section)

  return allIds.filter(id => {
    // Filter by section (already done in fetch, but ok)
    if (query.section) {
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

  const randomIndex = Math.floor(Math.random() * filteredIds.length)
  const selectedId = filteredIds[randomIndex]

  return fetchQuestion(selectedId.external_id)
}

export async function getCollegeBoardQuestions(query: CollegeBoardQuery = {}): Promise<CollegeBoardQuestion[]> {
  const filteredIds = await getCollegeBoardQuestionIds(query)

  // Load questions in parallel
  const questions = await Promise.all(
    filteredIds.map(id => fetchQuestion(id.external_id))
  )

  return questions
}
