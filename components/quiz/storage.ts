import { QUIZ_STORAGE_KEY } from "@/components/quiz/constants"
import type { PersistedQuizPreferences } from "@/components/quiz/types"

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
