"use client"

import { useEffect, useMemo, useState } from "react"

import { DOMAIN_OPTIONS, SECTION_OPTIONS } from "@/components/quiz/constants"
import { LatexText } from "@/components/quiz/latex-text"
import { loadQuizState, saveQuizState } from "@/components/quiz/storage"
import type { CheckState, QuizSection } from "@/components/quiz/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import type { OpenSatQuestion } from "@/lib/opensat"

async function requestQuestion(filters: { section: string; domain: string }) {
  const params = new URLSearchParams({
    section: filters.section,
    limit: "1",
  })

  if (filters.domain !== "any") {
    params.set("domain", filters.domain)
  }

  const response = await fetch(`/api/question?${params.toString()}`, { cache: "no-store" })
  const data = (await response.json()) as {
    question?: OpenSatQuestion
    error?: string
  }

  if (!response.ok || !data.question) {
    throw new Error(data.error ?? "Could not load question")
  }

  return data.question
}

export function QuizApp() {
  const [question, setQuestion] = useState<OpenSatQuestion | null>(null)
  const [section, setSection] = useState<QuizSection>("english")
  const [domain, setDomain] = useState<string>("any")
  const [selectedChoice, setSelectedChoice] = useState<string>("")
  const [checkState, setCheckState] = useState<CheckState>("idle")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showExplanation, setShowExplanation] = useState(false)
  const [isDark, setIsDark] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  const availableDomains = useMemo(() => DOMAIN_OPTIONS[section], [section])

  const applyTheme = (darkMode: boolean) => {
    const root = document.documentElement
    root.classList.toggle("dark", darkMode)
    window.localStorage.setItem("theme", darkMode ? "dark" : "light")
    setIsDark(darkMode)
  }

  const fetchRandomQuestion = async (filters?: { section: string; domain: string }) => {
    const active = filters ?? { section, domain }
    setLoading(true)
    setError(null)

    try {
      const nextQuestion = await requestQuestion(active)
      setQuestion(nextQuestion)
      setSelectedChoice("")
      setCheckState("idle")
      setShowExplanation(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("theme")
    const initialDark =
      storedTheme === "dark" ||
      (storedTheme !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches)
    applyTheme(initialDark)

    const persisted = loadQuizState()
    if (persisted) {
      setSection(persisted.section)
      setDomain(persisted.domain)
      setQuestion(persisted.question)
      setSelectedChoice(persisted.selectedChoice)
      setCheckState(persisted.checkState)
      setShowExplanation(persisted.showExplanation)
      setIsDark(persisted.isDark)
      applyTheme(persisted.isDark)
      setLoading(false)
      setHydrated(true)
      return
    }

    setHydrated(true)
    setLoading(true)
    requestQuestion({ section: "english", domain: "any" })
      .then((nextQuestion) => {
        setQuestion(nextQuestion)
        setSelectedChoice("")
        setCheckState("idle")
        setShowExplanation(false)
        setError(null)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Unexpected error")
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    if (!hydrated) {
      return
    }

    saveQuizState({
      section,
      domain,
      question,
      selectedChoice,
      checkState,
      showExplanation,
      isDark,
    })
  }, [section, domain, question, selectedChoice, checkState, showExplanation, isDark, hydrated])

  useEffect(() => {
    if (!availableDomains.some((item) => item.value === domain)) {
      setDomain("any")
    }
  }, [availableDomains, domain])

  const choices = useMemo(
    () => Object.entries(question?.question.choices ?? {}).sort(([a], [b]) => a.localeCompare(b)),
    [question]
  )

  const checkAnswer = () => {
    if (!question || !selectedChoice) {
      return
    }

    const isCorrect = selectedChoice === question.question.correct_answer
    setCheckState(isCorrect ? "correct" : "incorrect")
  }

  const paragraphText =
    question?.question.paragraph && question.question.paragraph !== "null"
      ? question.question.paragraph
      : null

  const shuffleFiltersAndQuestion = async () => {
    const randomSection = SECTION_OPTIONS[Math.floor(Math.random() * SECTION_OPTIONS.length)].value
    const domains = DOMAIN_OPTIONS[randomSection]
    const randomDomain = domains[Math.floor(Math.random() * domains.length)].value

    setSection(randomSection)
    setDomain(randomDomain)
    await fetchRandomQuestion({ section: randomSection, domain: randomDomain })
  }

  return (
    <Card className="w-full border-slate-200/70 bg-white/90 shadow-2xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/90">
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs tracking-[0.22em] text-slate-500 uppercase dark:text-slate-300">OpenSAT Quiz</p>
          <Button variant="outline" size="sm" onClick={() => applyTheme(!isDark)}>
            {isDark ? "Light" : "Dark"}
          </Button>
        </div>
        <CardTitle className="text-xl text-slate-900 sm:text-2xl dark:text-slate-100">
          Practice one question at a time
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5">
        {loading && (
          <div className="space-y-3 animate-pulse">
            <div className="h-4 w-2/3 rounded-md bg-muted" />
            <div className="h-4 w-full rounded-md bg-muted" />
            <div className="h-4 w-5/6 rounded-md bg-muted" />
          </div>
        )}

        {!loading && error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!loading && !error && question && (
          <>
            <div className="space-y-2">
              <p className="text-xs text-slate-500 uppercase dark:text-slate-300">
                {section} • {question.domain}
              </p>
              {paragraphText ? (
                <LatexText text={paragraphText} className="block leading-relaxed text-slate-700 dark:text-slate-200" />
              ) : null}
              <LatexText
                text={question.question.question}
                className="block text-base leading-relaxed font-medium text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-2">
              {choices.map(([letter, text]) => {
                const selected = selectedChoice === letter
                return (
                  <button
                    key={letter}
                    type="button"
                    onClick={() => setSelectedChoice(letter)}
                    disabled={checkState !== "idle"}
                    className={`w-full cursor-pointer rounded-lg border px-3 py-2 text-left transition ${
                      selected
                        ? "border-sky-500 bg-sky-50 dark:border-sky-400 dark:bg-sky-900/40"
                        : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                    } ${checkState !== "idle" ? "opacity-85" : ""}`}
                  >
                    <span className="mr-2 font-semibold">{letter}.</span>
                    <LatexText text={text} preferMath="aggressive" className="inline text-slate-900 dark:text-slate-100" />
                  </button>
                )
              })}
            </div>

            {checkState === "correct" && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
                Correct. Nice work.
              </div>
            )}

            {checkState === "incorrect" && (
              <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
                <p>Not quite. Review the explanation and then continue.</p>
                {!showExplanation ? (
                  <Button variant="secondary" onClick={() => setShowExplanation(true)}>
                    Show explanation
                  </Button>
                ) : (
                  <LatexText
                    text={question.question.explanation}
                    className="block leading-relaxed text-slate-900 dark:text-slate-100"
                  />
                )}
              </div>
            )}
          </>
        )}
      </CardContent>

      <CardFooter className="flex-col items-stretch gap-4">
        <div className="flex flex-wrap gap-2">
          {SECTION_OPTIONS.map((option) => (
            <Button
              key={option.value}
              size="sm"
              variant={section === option.value ? "default" : "outline"}
              onClick={() => {
                setSection(option.value)
                setDomain("any")
              }}
            >
              {option.label}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {availableDomains.map((option) => (
            <Button
              key={option.value}
              size="sm"
              variant={domain === option.value ? "secondary" : "outline"}
              onClick={() => setDomain(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={shuffleFiltersAndQuestion} disabled={loading}>
            Shuffle filters
          </Button>
          <Button variant="outline" onClick={() => fetchRandomQuestion()} disabled={loading}>
            Random question
          </Button>
          {checkState === "idle" ? (
            <Button onClick={checkAnswer} disabled={!selectedChoice || loading || !!error}>
              Check answer
            </Button>
          ) : (
            <Button onClick={() => fetchRandomQuestion()} disabled={loading}>
              Next question
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  )
}
