import { QuizApp } from "@/components/quiz-app"
import { getRandomCollegeBoardQuestion } from "@/lib/collegeboard"

export async function QuizShell() {
  const initialQuestion = await getRandomCollegeBoardQuestion({
    section: "english",
    domain: "any",
    skill: "any",
    difficulty: "any",
  })

  return (
    <QuizApp
      initialQuestion={initialQuestion}
      initialFilters={{
        section: "english",
        domain: "any",
        skill: "any",
        difficulty: "any",
      }}
    />
  )
}
