export type OpenSatQuestion = {
  id: string
  domain: string
  difficulty?: string
  visuals?: {
    type?: string | null
    svg_content?: string | null
  }
  question: {
    paragraph: string | null
    question: string
    choices: Record<string, string>
    correct_answer: string
    explanation: string
  }
}

const OPENSAT_URL = "https://pinesat.com/api/questions"

export type OpenSatQuery = {
  section?: string
  domain?: string
  limit?: number
}

export async function getOpenSatQuestions(query: OpenSatQuery = {}): Promise<OpenSatQuestion[]> {
  const section = (query.section ?? "english").trim().toLowerCase()
  const domain = (query.domain ?? "any").trim().toLowerCase()
  const limit = Math.max(1, Math.min(query.limit ?? 1, 20))

  const params = new URLSearchParams({
    section,
    limit: String(limit),
  })

  if (domain && domain !== "any") {
    params.set("domain", domain)
  }

  const url = `${OPENSAT_URL}?${params.toString()}`

  const response = await fetch(url, {
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(`OpenSAT request failed with status ${response.status}`)
  }

  const data: unknown = await response.json()

  if (!Array.isArray(data)) {
    throw new Error("OpenSAT response was not an array")
  }

  return data as OpenSatQuestion[]
}

export async function getRandomOpenSatQuestion(query: OpenSatQuery = {}): Promise<OpenSatQuestion> {
  const questions = await getOpenSatQuestions(query)

  if (questions.length === 0) {
    throw new Error("OpenSAT returned zero questions")
  }

  const randomIndex = Math.floor(Math.random() * questions.length)
  return questions[randomIndex]
}
