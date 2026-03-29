"use client"

import { startTransition, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"

import { DIFFICULTY_OPTIONS, DOMAIN_OPTIONS, SECTION_OPTIONS, SKILL_OPTIONS } from "@/components/quiz/constants"
import { loadQuestionProgress, loadQuizPreferences, saveQuestionProgress, saveQuizPreferences } from "@/components/quiz/storage"
import type { CheckState, CollegeBoardQuestion, QuizFilters, QuizSection } from "@/components/quiz/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { getQuestionPath } from "@/lib/quiz"

async function requestQuestion(filters: { section: string; domain: string; skill: string; difficulty: string } | { id: string }) {
  const params = new URLSearchParams()

  if ("id" in filters) {
    params.set("id", filters.id)
  } else {
    params.set("section", filters.section)

    if (filters.domain !== "any") {
      params.set("domain", filters.domain)
    }

    if (filters.skill !== "any") {
      params.set("skill", filters.skill)
    }

    if (filters.difficulty !== "any") {
      params.set("difficulty", filters.difficulty)
    }
  }

  const response = await fetch(`/api/question?${params.toString()}`, { cache: "no-store" })
  const data = (await response.json()) as {
    question?: CollegeBoardQuestion
    error?: string
  }

  if (!response.ok || !data.question) {
    throw new Error(data.error ?? "Could not load question")
  }

  if (!data.question.externalid || !data.question.stem) {
    throw new Error("Question data is incomplete")
  }

  return data.question
}

function normalizeResponse(value: string) {
  return value.trim().toLowerCase().replaceAll(/\s+/g, "")
}

function parseComparableNumber(value: string) {
  const sanitized = value.trim().replaceAll(",", "")
  if (!sanitized) {
    return null
  }

  if (/^[+-]?\d+\/[+-]?\d+$/.test(sanitized)) {
    const [numerator, denominator] = sanitized.split("/").map(Number)
    if (denominator === 0) {
      return null
    }
    return numerator / denominator
  }

  const parsed = Number(sanitized)
  return Number.isFinite(parsed) ? parsed : null
}

function responsesMatch(input: string, expected: string) {
  if (normalizeResponse(input) === normalizeResponse(expected)) {
    return true
  }

  const left = parseComparableNumber(input)
  const right = parseComparableNumber(expected)
  return left !== null && right !== null && Math.abs(left - right) < 1e-9
}

function filtersAreEqual(left: QuizFilters, right: QuizFilters) {
  return (
    left.section === right.section &&
    left.domain === right.domain &&
    left.skill === right.skill &&
    left.difficulty === right.difficulty
  )
}

type QuizAppProps = {
  initialQuestion: CollegeBoardQuestion
  initialFilters: QuizFilters
}

export function QuizApp({ initialQuestion, initialFilters }: QuizAppProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [question, setQuestion] = useState<CollegeBoardQuestion | null>(initialQuestion)
  const [section, setSection] = useState<QuizSection>(initialFilters.section)
  const [domain, setDomain] = useState<string>(initialFilters.domain)
  const [skill, setSkill] = useState<string>(initialFilters.skill)
  const [difficulty, setDifficulty] = useState<string>(initialFilters.difficulty)
  const [selectedChoice, setSelectedChoice] = useState<string>("")
  const [checkState, setCheckState] = useState<CheckState>("idle")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDark, setIsDark] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [questionProgressReady, setQuestionProgressReady] = useState(false)
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle")
  const saveTimeoutRef = useRef<number | null>(null)
  const restoredQuestionIdRef = useRef<string | null>(null)

  const availableDomains = useMemo(() => DOMAIN_OPTIONS[section], [section])
  const availableSkills = useMemo(() => {
    if (domain === "any") return [{ value: "any", label: "Any Skill" }]
    return SKILL_OPTIONS[section][domain] || [{ value: "any", label: "Any Skill" }]
  }, [section, domain])

  const applyTheme = (darkMode: boolean) => {
    const root = document.documentElement
    root.classList.toggle("dark", darkMode)
    window.localStorage.setItem("theme", darkMode ? "dark" : "light")
    document.cookie = `theme=${darkMode ? "dark" : "light"}; path=/; max-age=31536000; samesite=lax`
    setIsDark(darkMode)
  }

  const fetchRandomQuestion = async (filters?: { section: string; domain: string; skill: string; difficulty: string }) => {
    const active = filters ?? { section, domain, skill, difficulty }
    setLoading(true)
    setError(null)

    try {
      const nextQuestion = await requestQuestion(active)
      setQuestionProgressReady(false)
      setQuestion(nextQuestion)
      setSelectedChoice("")
      setCheckState("idle")
      const nextPath = getQuestionPath(nextQuestion.externalid)
      if (pathname !== nextPath) {
        router.push(nextPath, { scroll: false })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setQuestionProgressReady(false)
    setQuestion(initialQuestion)
    setSection(initialFilters.section)
    setDomain(initialFilters.domain)
    setSkill(initialFilters.skill)
    setDifficulty(initialFilters.difficulty)
    setSelectedChoice("")
    setCheckState("idle")
    setError(null)
  }, [initialFilters, initialQuestion])

  useEffect(() => {
    if (!hydrated || !question) {
      return
    }

    const savedProgress = loadQuestionProgress(question.externalid)
    restoredQuestionIdRef.current = question.externalid

    if (!savedProgress) {
      setSelectedChoice("")
      setCheckState("idle")
      setQuestionProgressReady(true)
      return
    }

    setSelectedChoice(savedProgress.selectedChoice)
    setCheckState(savedProgress.checkState)
    setQuestionProgressReady(true)
  }, [hydrated, question])

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("theme")
    const initialDark =
      storedTheme === "dark" ||
      (storedTheme !== "light" &&
        (document.documentElement.classList.contains("dark") ||
          window.matchMedia("(prefers-color-scheme: dark)").matches))
    applyTheme(initialDark)

    const persisted = loadQuizPreferences()
    if (!persisted) {
      setHydrated(true)
      return
    }

    applyTheme(persisted.isDark)

    const nextFilters: QuizFilters = {
      section: persisted.section,
      domain: persisted.domain || "any",
      skill: persisted.skill || "any",
      difficulty: persisted.difficulty || "any",
    }

    startTransition(() => {
      setSection(nextFilters.section)
      setDomain(nextFilters.domain)
      setSkill(nextFilters.skill)
      setDifficulty(nextFilters.difficulty)
    })

    if (pathname !== "/" || filtersAreEqual(nextFilters, initialFilters)) {
      setHydrated(true)
      return
    }

    setLoading(true)
    requestQuestion(nextFilters)
      .then((nextQuestion) => {
        setQuestionProgressReady(false)
        setQuestion(nextQuestion)
        setSelectedChoice("")
        setCheckState("idle")
        setError(null)
        router.replace(getQuestionPath(nextQuestion.externalid), { scroll: false })
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Unexpected error")
      })
      .finally(() => {
        setLoading(false)
        setHydrated(true)
      })
  }, [initialFilters, pathname, router])

  useEffect(() => {
    setCopyStatus("idle")
  }, [question])

  useEffect(() => {
    if (!hydrated || pathname !== "/" || !question) {
      return
    }

    router.replace(getQuestionPath(question.externalid), { scroll: false })
  }, [hydrated, pathname, question, router])

  useEffect(() => {
    if (!hydrated) {
      return
    }

    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = window.setTimeout(() => {
      saveQuizPreferences({
        section,
        domain,
        skill,
        difficulty,
        isDark,
      })
    }, 120)

    return () => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current)
        saveTimeoutRef.current = null
      }
    }
  }, [section, domain, skill, difficulty, isDark, hydrated])

  useEffect(() => {
    if (!hydrated || !question || !questionProgressReady) {
      return
    }

    if (restoredQuestionIdRef.current !== question.externalid) {
      return
    }

    saveQuestionProgress(question.externalid, {
      selectedChoice,
      checkState,
    })
  }, [hydrated, question, questionProgressReady, selectedChoice, checkState])

  const choices = useMemo(() => {
    if (!question || !question.answerOptions) return []
    return question.answerOptions.map((option, index) => ({
      letter: String.fromCharCode(65 + index), // A, B, C, D
      text: option.content,
      id: option.id
    }))
  }, [question])
  const isMultipleChoice = choices.length > 0

  const filterState: QuizFilters = {
    section,
    domain,
    skill,
    difficulty,
  }

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

  const checkAnswer = () => {
    if (!question || !selectedChoice) {
      return
    }

    const isCorrect = isMultipleChoice
      ? question.keys.includes(selectedChoice)
      : [...question.correct_answer, ...question.keys].some((answer) => responsesMatch(selectedChoice, answer))

    setCheckState(isCorrect ? "correct" : "incorrect")
  }

  const copyQuestionUrl = async () => {
    if (!question) {
      return
    }

    try {
      await navigator.clipboard.writeText(new URL(getQuestionPath(question.externalid), window.location.origin).toString())
      setCopyStatus("copied")
    } catch {
      setCopyStatus("error")
    }
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
          <div className="space-y-1">
            <CardTitle>Practice one SAT question at a time</CardTitle>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              Questions come from the Bluebook question bank.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {question && (
              <Button variant="outline" size="sm" onClick={copyQuestionUrl}>
                {copyStatus === "copied" ? "Copied Link" : copyStatus === "error" ? "Copy Failed" : "Copy Question URL"}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => applyTheme(!isDark)}>
              Switch to {isDark ? "light" : "dark"} theme
            </Button>
          </div>
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

            {isMultipleChoice ? (
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
            ) : (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="student-answer">
                  Enter your answer
                </label>
                <input
                  id="student-answer"
                  type="text"
                  value={selectedChoice}
                  onChange={(event) => setSelectedChoice(event.target.value)}
                  disabled={checkState !== "idle"}
                  inputMode="decimal"
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-3 focus:ring-sky-500/20 disabled:cursor-not-allowed disabled:opacity-85 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  placeholder="Type your answer"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Use the exact value the question expects unless it says to round.
                </p>
              </div>
            )}

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
        <div className="flex flex-wrap gap-2 [content-visibility:auto] [contain-intrinsic-size:42px]">
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

        <div className="flex flex-wrap gap-2 [content-visibility:auto] [contain-intrinsic-size:42px]">
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

        <div className="flex flex-wrap gap-2 [content-visibility:auto] [contain-intrinsic-size:42px]">
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

        <div className="flex flex-wrap gap-2 [content-visibility:auto] [contain-intrinsic-size:42px]">
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
          <Button variant="outline" onClick={() => fetchRandomQuestion(filterState)} disabled={loading}>
            Get Random Question
          </Button>
          {checkState === "idle" ? (
            <Button
              onClick={checkAnswer}
              disabled={!hydrated || !questionProgressReady || !selectedChoice || loading || !!error}
              suppressHydrationWarning
            >
              Check My Answer
            </Button>
          ) : (
            <Button
              onClick={() => fetchRandomQuestion(filterState)}
              disabled={!hydrated || !questionProgressReady || loading}
              suppressHydrationWarning
            >
              Next Question
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  )
}
