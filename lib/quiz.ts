import type { QuizFilters } from "@/components/quiz/types"
import type { QuestionMetadata } from "@/lib/collegeboard"

export const DEFAULT_FILTERS: QuizFilters = {
  section: "english",
  domain: "any",
  skill: "any",
  difficulty: "any",
}

export function getQuestionPath(questionId: string) {
  return `/${questionId}`
}

export function getQuestionUrl(siteUrl: string, questionId: string) {
  return new URL(getQuestionPath(questionId), siteUrl).toString()
}

export function getFiltersFromMetadata(metadata: QuestionMetadata | null): QuizFilters {
  if (!metadata) {
    return DEFAULT_FILTERS
  }

  return {
    section: metadata.primary_class_cd.length === 1 ? "math" : "english",
    domain: metadata.primary_class_cd,
    skill: metadata.skill_cd || "any",
    difficulty: metadata.difficulty || "any",
  }
}
