import { QuizApp } from "@/components/quiz-app"
import { getCollegeBoardQuestionById, getCollegeBoardQuestionMetadataById, getRandomCollegeBoardQuestion } from "@/lib/collegeboard"
import { DEFAULT_FILTERS, getFiltersFromMetadata } from "@/lib/quiz"

type QuizShellProps = {
  initialQuestionId?: string
}

export async function QuizShell({ initialQuestionId }: QuizShellProps = {}) {
  const initialQuestion = initialQuestionId
    ? await getCollegeBoardQuestionById(initialQuestionId)
    : await getRandomCollegeBoardQuestion(DEFAULT_FILTERS)
  const metadata = initialQuestionId ? await getCollegeBoardQuestionMetadataById(initialQuestionId) : null

  return (
    <QuizApp
      initialQuestion={initialQuestion}
      initialFilters={metadata ? getFiltersFromMetadata(metadata) : DEFAULT_FILTERS}
    />
  )
}
