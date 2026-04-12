import { notFound } from "next/navigation"

import { QuizShell } from "@/components/quiz-shell"

export default async function QuestionPage(props: PageProps<"/[id]">) {
  const { id } = await props.params

  try {
    const shell = await QuizShell({ initialQuestionId: id })

    return (
      <main className="min-h-svh bg-background px-4 py-6 sm:min-h-screen sm:px-6 sm:py-12">
        <div className="mx-auto w-full max-w-6xl">
          {shell}
        </div>
      </main>
    )
  } catch {
    notFound()
  }
}
