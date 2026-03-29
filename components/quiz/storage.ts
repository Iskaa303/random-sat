import { QUESTION_PROGRESS_STORAGE_KEY, QUIZ_STORAGE_KEY } from "@/components/quiz/constants"
import type { PersistedQuestionProgress, PersistedQuizPreferences } from "@/components/quiz/types"

export function loadQuizPreferences(): PersistedQuizPreferences | null {
  try {
    const raw = window.localStorage.getItem(QUIZ_STORAGE_KEY)
    if (!raw) {
      return null
    }
    return JSON.parse(raw) as PersistedQuizPreferences
  } catch {
    return null
  }
}

export function saveQuizPreferences(state: PersistedQuizPreferences) {
  try {
    window.localStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignore storage failures (private mode, quota, etc.)
  }
}

function loadAllQuestionProgress(): Record<string, PersistedQuestionProgress> {
  try {
    const raw = window.localStorage.getItem(QUESTION_PROGRESS_STORAGE_KEY)
    if (!raw) {
      return {}
    }

    return JSON.parse(raw) as Record<string, PersistedQuestionProgress>
  } catch {
    return {}
  }
}

export function loadQuestionProgress(questionId: string): PersistedQuestionProgress | null {
  const allProgress = loadAllQuestionProgress()
  return allProgress[questionId] ?? null
}

export function saveQuestionProgress(questionId: string, progress: PersistedQuestionProgress) {
  try {
    const allProgress = loadAllQuestionProgress()
    allProgress[questionId] = progress
    window.localStorage.setItem(QUESTION_PROGRESS_STORAGE_KEY, JSON.stringify(allProgress))
  } catch {
    // Ignore storage failures (private mode, quota, etc.)
  }
}
