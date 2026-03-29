import { SECTION_OPTIONS } from "@/components/quiz/constants"

export type CheckState = "idle" | "correct" | "incorrect"

export type QuizSection = (typeof SECTION_OPTIONS)[number]["value"]

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

export type QuizFilters = {
  section: QuizSection
  domain: string
  skill: string
  difficulty: string
}

export type PersistedQuizPreferences = QuizFilters & {
  isDark: boolean
}
