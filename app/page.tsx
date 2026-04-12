import { QuizShell } from "@/components/quiz-shell"

export default function Home() {
  return (
    <main className="min-h-svh bg-background px-4 py-6 sm:min-h-screen sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-6xl">
        <QuizShell />
      </div>
    </main>
  )
}
