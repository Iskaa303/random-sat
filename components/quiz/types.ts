import type { OpenSatQuestion } from "@/lib/opensat"

import { SECTION_OPTIONS } from "@/components/quiz/constants"

export type CheckState = "idle" | "correct" | "incorrect"

export type QuizSection = (typeof SECTION_OPTIONS)[number]["value"]

export type PersistedQuizState = {
  section: QuizSection
  domain: string
  question: OpenSatQuestion | null
  selectedChoice: string
  checkState: CheckState
  showExplanation: boolean
  isDark: boolean
}
