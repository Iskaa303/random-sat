"use client"

import { useEffect, useMemo, useState } from "react"

import { DIFFICULTY_OPTIONS, DOMAIN_OPTIONS, SECTION_OPTIONS, SKILL_OPTIONS } from "@/components/quiz/constants"
import { loadQuizState, saveQuizState } from "@/components/quiz/storage"
import type { CheckState, CollegeBoardQuestion, QuizSection } from "@/components/quiz/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"

async function requestQuestion(filters: { section: string; domain: string; skill: string; difficulty: string }) {
  const params = new URLSearchParams({
    section: filters.section,
  })

  if (filters.domain !== "any") {
    params.set("domain", filters.domain)
  }

  if (filters.skill !== "any") {
    params.set("skill", filters.skill)
  }

  if (filters.difficulty !== "any") {
    params.set("difficulty", filters.difficulty)
  }

  const response = await fetch(`/api/question?${params.toString()}`, { cache: "no-store" })
  const data = (await response.json()) as {
    question?: CollegeBoardQuestion
    error?: string
  }

  if (!response.ok || !data.question) {
    throw new Error(data.error ?? "Could not load question")
  }

  return data.question
}

export function QuizApp() {
  const [question, setQuestion] = useState<CollegeBoardQuestion | null>(null)
  const [section, setSection] = useState<QuizSection>("english")
  const [domain, setDomain] = useState<string>("any")
  const [skill, setSkill] = useState<string>("any")
  const [difficulty, setDifficulty] = useState<string>("any")
  const [selectedChoice, setSelectedChoice] = useState<string>("")
  const [checkState, setCheckState] = useState<CheckState>("idle")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDark, setIsDark] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  const availableDomains = useMemo(() => DOMAIN_OPTIONS[section], [section])
  const availableSkills = useMemo(() => {
    if (domain === "any") return [{ value: "any", label: "Any Skill" }]
    return SKILL_OPTIONS[section][domain] || [{ value: "any", label: "Any Skill" }]
  }, [section, domain])

  const applyTheme = (darkMode: boolean) => {
    const root = document.documentElement
    root.classList.toggle("dark", darkMode)
    window.localStorage.setItem("theme", darkMode ? "dark" : "light")
    setIsDark(darkMode)
  }

  const fetchRandomQuestion = async (filters?: { section: string; domain: string; skill: string; difficulty: string }) => {
    const active = filters ?? { section, domain, skill, difficulty }
    setLoading(true)
    setError(null)

    try {
      const nextQuestion = await requestQuestion(active)
      setQuestion(nextQuestion)
      setSelectedChoice("")
      setCheckState("idle")
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
      setSkill(persisted.skill || "any")
      setDifficulty(persisted.difficulty || "any")
      setQuestion(persisted.question)
      setSelectedChoice(persisted.selectedChoice)
      setCheckState(persisted.checkState)
      setIsDark(persisted.isDark)
      applyTheme(persisted.isDark)
      setLoading(false)
      setHydrated(true)
      return
    }

    setHydrated(true)
    setLoading(true)
    requestQuestion({ section: "english", domain: "any", skill: "any", difficulty: "any" })
      .then((nextQuestion) => {
        setQuestion(nextQuestion)
        setSelectedChoice("")
        setCheckState("idle")
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
      skill,
      difficulty,
      question,
      selectedChoice,
      checkState,
      isDark,
    })
  }, [section, domain, skill, difficulty, question, selectedChoice, checkState, isDark, hydrated])

  useEffect(() => {
    if (!availableDomains.some((item) => item.value === domain)) {
      setDomain("any")
    }
  }, [availableDomains, domain])

  useEffect(() => {
    if (!availableSkills.some((item) => item.value === skill)) {
      setSkill("any")
    }
  }, [availableSkills, skill])

  const choices = useMemo(() => {
    if (!question || !question.answerOptions) return []
    return question.answerOptions.map((option, index) => ({
      letter: String.fromCharCode(65 + index), // A, B, C, D
      text: option.content,
      id: option.id
    }))
  }, [question])

  const checkAnswer = () => {
    if (!question || !selectedChoice) {
      return
    }

    const isCorrect = question.keys.includes(selectedChoice)
    setCheckState(isCorrect ? "correct" : "incorrect")
  }

  const shuffleFiltersAndQuestion = async () => {
    const randomSection = SECTION_OPTIONS[Math.floor(Math.random() * SECTION_OPTIONS.length)].value
    const domains = DOMAIN_OPTIONS[randomSection]
    const randomDomain = domains[Math.floor(Math.random() * domains.length)].value

    let randomSkill = "any"
    if (randomDomain !== "any") {
      const skills = SKILL_OPTIONS[randomSection][randomDomain]
      if (skills && skills.length > 1) {
        randomSkill = skills[Math.floor(Math.random() * skills.length)].value
      }
    }

    const randomDifficulty = DIFFICULTY_OPTIONS[Math.floor(Math.random() * DIFFICULTY_OPTIONS.length)].value

    setSection(randomSection)
    setDomain(randomDomain)
    setSkill(randomSkill)
    setDifficulty(randomDifficulty)
    await fetchRandomQuestion({ section: randomSection, domain: randomDomain, skill: randomSkill, difficulty: randomDifficulty })
  }

  return (
    <Card className="w-full border-slate-200/70 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
      <CardHeader className="space-y-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Questions are official SAT questions from the Bluebook question bank.
          </p>
          <Button variant="outline" size="sm" onClick={() => applyTheme(!isDark)}>
            Switch to {isDark ? "light" : "dark"} theme
          </Button>
        </div>
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
              {question.stimulus && (
                <div
                  className="block text-sm leading-relaxed text-slate-700 dark:text-slate-300 mb-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg [&_p]:mb-2 [&_p]:last:mb-0"
                  dangerouslySetInnerHTML={{ __html: question.stimulus }}
                />
              )}
              <div
                className="block text-base leading-relaxed font-medium text-slate-900 dark:text-slate-100 [&_p]:mb-3 [&_p]:last:mb-0"
                dangerouslySetInnerHTML={{ __html: question.stem }}
              />
            </div>

            <div className="space-y-2">
              {choices.map((choice) => {
                const selected = selectedChoice === choice.id
                return (
                  <button
                    key={choice.id}
                    type="button"
                    onClick={() => setSelectedChoice(choice.id)}
                    disabled={checkState !== "idle"}
                    className={`w-full cursor-pointer rounded-lg border px-3 py-2 text-left transition ${
                      selected
                        ? "border-sky-500 bg-sky-50 dark:border-sky-400 dark:bg-sky-900/40"
                        : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                    } ${checkState !== "idle" ? "opacity-85" : ""}`}
                  >
                    <span className="mr-2 font-semibold">{choice.letter}.</span>
                    <span className="text-slate-900 dark:text-slate-100" dangerouslySetInnerHTML={{ __html: choice.text }} />
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
                <div
                  className="block leading-relaxed text-slate-900 dark:text-slate-100 [&_p]:mb-3 [&_p]:last:mb-0 [&_strong]:font-semibold"
                  dangerouslySetInnerHTML={{ __html: question.rationale }}
                />
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
                setSkill("any")
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
              variant={domain === option.value ? "default" : "outline"}
              onClick={() => {
                setDomain(option.value)
                setSkill("any")
              }}
            >
              {option.label}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {availableSkills.map((option) => (
            <Button
              key={option.value}
              size="sm"
              variant={skill === option.value ? "default" : "outline"}
              onClick={() => setSkill(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {DIFFICULTY_OPTIONS.map((option) => (
            <Button
              key={option.value}
              size="sm"
              variant={difficulty === option.value ? "default" : "outline"}
              onClick={() => setDifficulty(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={shuffleFiltersAndQuestion} disabled={loading}>
            Shuffle Filters
          </Button>
          <Button variant="outline" onClick={() => fetchRandomQuestion()} disabled={loading}>
            Get Random Question
          </Button>
          {checkState === "idle" ? (
            <Button onClick={checkAnswer} disabled={!selectedChoice || loading || !!error}>
              Check My Answer
            </Button>
          ) : (
            <Button onClick={() => fetchRandomQuestion()} disabled={loading}>
              Next Question
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  )
}
