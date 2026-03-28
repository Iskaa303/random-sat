import { QUIZ_STORAGE_KEY } from "@/components/quiz/constants"
import type { PersistedQuizState } from "@/components/quiz/types"

export function loadQuizState(): PersistedQuizState | null {
  try {
    const raw = window.localStorage.getItem(QUIZ_STORAGE_KEY)
    if (!raw) {
      return null
    }
    return JSON.parse(raw) as PersistedQuizState
  } catch {
    return null
  }
}

export function saveQuizState(state: PersistedQuizState) {
  try {
    window.localStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignore storage failures (private mode, quota, etc.)
  }
}
