"use client"

import dynamic from "next/dynamic"

const QuizApp = dynamic(() => import("@/components/quiz-app").then((module) => module.QuizApp), {
  ssr: false,
  loading: () => (
    <div className="h-140 w-full rounded-xl border border-slate-200 bg-white/70 dark:border-slate-700 dark:bg-slate-900/70" />
  ),
})

export function QuizShell() {
  return <QuizApp />
}
