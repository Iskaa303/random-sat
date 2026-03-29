import { QuizShell } from "@/components/quiz-shell"

export default function Home() {
  return (
    <main className="relative flex min-h-svh items-start justify-center px-4 py-6 sm:min-h-screen sm:items-center sm:px-6 sm:py-12">
      <div className="pointer-events-none absolute inset-0 bg-slate-50 dark:bg-slate-950" />
      <div className="relative z-10 w-full max-w-2xl">
        <QuizShell />
      </div>
    </main>
  )
}
