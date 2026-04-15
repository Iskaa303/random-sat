"use client"

import { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import { usePathname } from "next/navigation"

import { DIFFICULTY_OPTIONS, DOMAIN_OPTIONS, SECTION_OPTIONS, SKILL_OPTIONS } from "@/components/quiz/constants"
import {
  clearQuestionProgress,
  loadQuestionProgress,
  loadQuestionProgressMap,
  loadQuizPreferences,
  saveQuestionProgress,
  saveQuizPreferences,
} from "@/components/quiz/storage"
import type { CheckState, CollegeBoardQuestion, QuizFilters, QuizSection } from "@/components/quiz/types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
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

function transformSvgColorsForDarkTheme(html: string): string {
  let result = html
    .replaceAll(/#(?:[fF]{3}|[fF]{6})\b/g, "#192029")
    .replaceAll(/#231f20\b/g, "#eef2f9")
    .replaceAll(/#202020\b/g, "#eef2f9")
    .replaceAll(/#(?:0{3}|0{6})\b/g, "#eef2f9")
  
  const shapeElements = ['path', 'circle', 'ellipse', 'rect', 'polygon', 'polyline', 'line']
  
  for (const element of shapeElements) {
    const regex = new RegExp(`<${element}\\s+([^>]*?)(?=>)`, 'g')
    result = result.replace(regex, (match, attrs) => {
      if (!attrs.includes('fill=') && !attrs.includes('stroke=')) {
        return `<${element} ${attrs}fill="#eef2f9"`
      }
      return match
    })
  }
  
  return result
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

type QuestionBrowserEntry = {
  id: string
  difficulty: string
}

type QuestionBrowserListProps = {
  questions: QuestionBrowserEntry[]
  currentQuestionId?: string
  outcomes: Record<string, "correct" | "incorrect">
  maxHeightClass: string
  onSelectQuestion: (questionId: string) => void
}

const difficultyStyles: Record<string, string> = {
  E: "border-emerald-300/80 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300",
  M: "border-amber-300/80 bg-amber-500/10 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300",
  H: "border-rose-300/80 bg-rose-500/10 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-300",
}

const difficultyLabels: Record<string, string> = {
  E: "Easy",
  M: "Medium",
  H: "Hard",
}

const QUESTION_BROWSER_ITEM_HEIGHT = 34
const QUESTION_BROWSER_OVERSCAN = 10

function QuestionBrowserList({
  questions,
  currentQuestionId,
  outcomes,
  maxHeightClass,
  onSelectQuestion,
}: QuestionBrowserListProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(280)

  useEffect(() => {
    const element = scrollerRef.current
    if (!element || typeof ResizeObserver === "undefined") {
      return
    }

    const observer = new ResizeObserver((entries) => {
      const nextHeight = entries[0]?.contentRect.height
      if (typeof nextHeight === "number" && nextHeight > 0) {
        setContainerHeight(nextHeight)
      }
    })

    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!scrollerRef.current || !currentQuestionId) {
      return
    }

    const currentIndex = questions.findIndex((q) => q.id === currentQuestionId)
    if (currentIndex === -1) {
      return
    }

    const itemTop = currentIndex * QUESTION_BROWSER_ITEM_HEIGHT
    const itemBottom = itemTop + QUESTION_BROWSER_ITEM_HEIGHT

    const scrollerTop = scrollerRef.current.scrollTop
    const scrollerBottom = scrollerTop + containerHeight

    if (itemTop >= scrollerTop && itemBottom <= scrollerBottom) {
      return
    }

    let nextScrollTop = itemTop
    if (itemBottom > scrollerBottom) {
      nextScrollTop = Math.max(0, itemBottom - containerHeight + QUESTION_BROWSER_ITEM_HEIGHT)
    }

    scrollerRef.current.scrollTo({
      top: nextScrollTop,
      behavior: "smooth",
    })
  }, [currentQuestionId, questions, containerHeight])

  const totalCount = questions.length
  const visibleCount = Math.max(1, Math.ceil(containerHeight / QUESTION_BROWSER_ITEM_HEIGHT) + QUESTION_BROWSER_OVERSCAN * 2)
  const startIndex = Math.max(0, Math.floor(scrollTop / QUESTION_BROWSER_ITEM_HEIGHT) - QUESTION_BROWSER_OVERSCAN)
  const endIndex = Math.min(totalCount, startIndex + visibleCount)
  const offsetY = startIndex * QUESTION_BROWSER_ITEM_HEIGHT
  const totalHeight = totalCount * QUESTION_BROWSER_ITEM_HEIGHT
  const visibleQuestions = questions.slice(startIndex, endIndex)

  return (
    <div
      ref={scrollerRef}
      className={`${maxHeightClass} overflow-y-auto pr-1`}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleQuestions.map((item) => {
            const isActive = item.id === currentQuestionId
            const outcome = outcomes[item.id]
            const isCompleted = outcome === "correct" || outcome === "incorrect"
            const isCorrect = outcome === "correct"

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectQuestion(item.id)}
                className={`mb-1 flex h-8 w-full cursor-pointer items-center justify-between rounded-md border px-2 py-1 text-left text-xs transition-colors ${
                  isActive
                    ? "border-primary/60 bg-primary/10"
                    : isCompleted
                      ? isCorrect
                        ? "border-emerald-500/40 bg-emerald-500/12 hover:bg-emerald-500/20"
                        : "border-rose-500/40 bg-rose-500/12 hover:bg-rose-500/20"
                      : "border-border bg-background hover:bg-muted"
                } ${isCompleted ? isCorrect ? "ring-1 ring-emerald-300/60" : "ring-1 ring-rose-300/60" : ""}`}
              >
                <span className="min-w-0 truncate font-medium text-foreground">{item.id}</span>
                <div className="ml-2 flex shrink-0 items-center gap-1.5">
                  <Badge
                    variant="outline"
                    className={difficultyStyles[item.difficulty] ?? "border-border bg-muted text-muted-foreground"}
                  >
                    {difficultyLabels[item.difficulty] ?? item.difficulty}
                  </Badge>
                  {isCompleted && (
                    <Badge
                      variant="secondary"
                      className={
                        isCorrect
                          ? "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                          : "bg-rose-500/15 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300"
                      }
                    >
                      Done
                    </Badge>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function QuizApp({ initialQuestion, initialFilters }: QuizAppProps) {
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
  const [hydrated, setHydrated] = useState(false)
  const [questionProgressReady, setQuestionProgressReady] = useState(false)
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle")
  const [browserQuestions, setBrowserQuestions] = useState<QuestionBrowserEntry[]>([])
  const [browserLoading, setBrowserLoading] = useState(false)
  const [browserError, setBrowserError] = useState<string | null>(null)
  const [questionOutcomeById, setQuestionOutcomeById] = useState<Record<string, "correct" | "incorrect">>({})
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isDark, setIsDark] = useState(false)
  const saveTimeoutRef = useRef<number | null>(null)
  const restoredQuestionIdRef = useRef<string | null>(null)
  const isDarkRef = useRef(false)

  const deferredSection = useDeferredValue(section)
  const deferredDomain = useDeferredValue(domain)
  const deferredSkill = useDeferredValue(skill)
  const deferredDifficulty = useDeferredValue(difficulty)

  const availableDomains = useMemo(() => DOMAIN_OPTIONS[section], [section])
  const availableSkills = useMemo(() => {
    if (domain === "any") return [{ value: "any", label: "Any Skill" }]
    return SKILL_OPTIONS[section][domain] || [{ value: "any", label: "Any Skill" }]
  }, [section, domain])

  const updateQuestionPath = useCallback((questionId: string) => {
    if (typeof window === "undefined") {
      return
    }

    const nextPath = getQuestionPath(questionId)
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, "", nextPath)
    }
  }, [])

  const applyTheme = useCallback((darkMode: boolean) => {
    const root = document.documentElement
    root.classList.toggle("dark", darkMode)
    window.localStorage.setItem("theme", darkMode ? "dark" : "light")
    isDarkRef.current = darkMode
    setIsDark(darkMode)
  }, [])

  const toggleTheme = useCallback(() => {
    const nextDarkMode = !isDarkRef.current
    applyTheme(nextDarkMode)
    saveQuizPreferences({
      section,
      domain,
      skill,
      difficulty,
      isDark: nextDarkMode,
    })
  }, [applyTheme, section, domain, skill, difficulty])

  const fetchRandomQuestion = useCallback(async (filters?: { section: string; domain: string; skill: string; difficulty: string }) => {
    const active = filters ?? { section, domain, skill, difficulty }
    setLoading(true)
    setError(null)

    try {
      const nextQuestion = await requestQuestion(active)
      setQuestionProgressReady(false)
      setQuestion(nextQuestion)
      setSelectedChoice("")
      setCheckState("idle")
      updateQuestionPath(nextQuestion.externalid)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error")
    } finally {
      setLoading(false)
    }
  }, [section, domain, skill, difficulty, updateQuestionPath])

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
          updateQuestionPath(nextQuestion.externalid)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Unexpected error")
      })
      .finally(() => {
        setLoading(false)
        setHydrated(true)
      })
  }, [initialFilters, pathname, applyTheme, updateQuestionPath])

  useEffect(() => {
    setCopyStatus("idle")
  }, [question])

  useEffect(() => {
    if (!hydrated || pathname !== "/" || !question) {
      return
    }

    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", getQuestionPath(question.externalid))
    }
  }, [hydrated, pathname, question])

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
        isDark: isDarkRef.current,
      })
    }, 120)

    return () => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current)
        saveTimeoutRef.current = null
      }
    }
  }, [section, domain, skill, difficulty, hydrated])

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

  useEffect(() => {
    const controller = new AbortController()

    setBrowserLoading(true)
    setBrowserError(null)

    const params = new URLSearchParams({
      mode: "browse",
      section: deferredSection,
    })

    if (deferredDomain !== "any") {
      params.set("domain", deferredDomain)
    }

    if (deferredSkill !== "any") {
      params.set("skill", deferredSkill)
    }

    if (deferredDifficulty !== "any") {
      params.set("difficulty", deferredDifficulty)
    }

    fetch(`/api/question?${params.toString()}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = (await response.json()) as {
          questions?: QuestionBrowserEntry[]
          error?: string
        }

        if (!response.ok || !data.questions) {
          throw new Error(data.error ?? "Could not load question browser")
        }

        const seenIds = new Set<string>()
        const sanitizedQuestions = data.questions
          .map((item) => ({
            id: typeof item.id === "string" ? item.id.trim() : "",
            difficulty: typeof item.difficulty === "string" ? item.difficulty : "",
          }))
          .filter((item) => {
            if (!item.id || seenIds.has(item.id)) {
              return false
            }

            seenIds.add(item.id)
            return true
          })

        setBrowserQuestions(sanitizedQuestions)
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") {
          return
        }
        setBrowserQuestions([])
        setBrowserError(err instanceof Error ? err.message : "Unexpected error")
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setBrowserLoading(false)
        }
      })

    return () => controller.abort()
  }, [deferredSection, deferredDomain, deferredSkill, deferredDifficulty])

  useEffect(() => {
    if (!hydrated) {
      return
    }

    const nextOutcomes: Record<string, "correct" | "incorrect"> = {}
    const savedProgressById = loadQuestionProgressMap()

    for (const item of browserQuestions) {
      const progress = savedProgressById[item.id]
      if (progress?.checkState === "correct" || progress?.checkState === "incorrect") {
        nextOutcomes[item.id] = progress.checkState
      }
    }

    if (question && (checkState === "correct" || checkState === "incorrect")) {
      nextOutcomes[question.externalid] = checkState
    }

    setQuestionOutcomeById(nextOutcomes)
  }, [hydrated, browserQuestions, question, checkState])

  const goToQuestion = async (questionId: string) => {
    if (question?.externalid === questionId || loading) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const nextQuestion = await requestQuestion({ id: questionId })
      setQuestionProgressReady(false)
      setQuestion(nextQuestion)
      setSelectedChoice("")
      setCheckState("idle")
        updateQuestionPath(nextQuestion.externalid)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!mobileMenuOpen) {
      return
    }

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [mobileMenuOpen])

  const redoCurrentQuestion = () => {
    if (!question) {
      return
    }

    setSelectedChoice("")
    setCheckState("idle")
    clearQuestionProgress(question.externalid)
  }

  const renderFilterControls = () => (
    <>
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
    </>
  )

  const renderDesktopActionButtons = () => (
    <div className="flex flex-wrap justify-end gap-2">
      <Button variant="outline" onClick={shuffleFiltersAndQuestion} disabled={loading}>
        Shuffle Filters
      </Button>
      <Button variant="outline" onClick={() => fetchRandomQuestion(filterState)} disabled={loading}>
        Get Random Question
      </Button>
      <Button variant="outline" onClick={redoCurrentQuestion} disabled={!question || loading}>
        Redo Question
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
  )

  const renderMenuUtilityActions = () => (
    <div className="flex flex-wrap justify-end gap-2">
      <Button variant="outline" onClick={shuffleFiltersAndQuestion} disabled={loading}>
        Shuffle Filters
      </Button>
      <Button variant="outline" onClick={() => fetchRandomQuestion(filterState)} disabled={loading}>
        Get Random Question
      </Button>
    </div>
  )

  const renderQuestionBrowser = (maxHeightClass: string) => (
    <Card className="border-border bg-card shadow-sm">
      <CardHeader className="space-y-1 pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">Question Browser</CardTitle>
          <Badge variant="secondary">{browserQuestions.length}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">Filtered questions</p>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {browserLoading && (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-4/5" />
          </div>
        )}

        {!browserLoading && browserError && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">{browserError}</p>
        )}

        {!browserLoading && !browserError && browserQuestions.length === 0 && (
          <p className="text-sm text-muted-foreground">No questions match this filter combination.</p>
        )}

        {!browserLoading && !browserError && browserQuestions.length > 0 && (
          <QuestionBrowserList
            questions={browserQuestions}
            currentQuestionId={question?.externalid}
            outcomes={questionOutcomeById}
            maxHeightClass={maxHeightClass}
            onSelectQuestion={(questionId) => {
              goToQuestion(questionId)
              setMobileMenuOpen(false)
            }}
          />
        )}
      </CardContent>
    </Card>
  )

  return (
    <div className="flex flex-col gap-4 pb-24 pt-16 lg:flex-row lg:items-start lg:pb-0 lg:pt-0">
      <Card className="mb-6 w-full border-border bg-card lg:order-2 lg:mb-0">
        <CardHeader className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">SAT Practice</Badge>
              {question && <Badge variant="outline">{question.externalid}</Badge>}
            </div>
            <CardTitle>Practice one SAT question at a time</CardTitle>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Questions come from the Bluebook question bank.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="hidden items-center gap-2 lg:flex">
              {question && (
                <Button variant="outline" size="sm" onClick={copyQuestionUrl}>
                  {copyStatus === "copied" ? "Copied Link" : copyStatus === "error" ? "Copy Failed" : "Copy Question URL"}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={toggleTheme}>
                Toggle theme
              </Button>
            </div>
          </div>
        </div>
        </CardHeader>

        <Separator className="opacity-70" />

        <CardContent className="space-y-5 pt-5 pb-6 lg:pb-5">
        {loading && (
          <div className="space-y-3">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-5/6" />
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
                  className="mb-4 block rounded-lg border border-border bg-muted p-4 text-sm leading-relaxed text-muted-foreground [&_p]:mb-2 [&_p]:last:mb-0"
                  dangerouslySetInnerHTML={{ __html: isDark ? transformSvgColorsForDarkTheme(question.stimulus) : question.stimulus }}
                />
              )}
              <div
                className="block text-base leading-relaxed font-medium text-foreground [&_p]:mb-3 [&_p]:last:mb-0"
                dangerouslySetInnerHTML={{ __html: isDark ? transformSvgColorsForDarkTheme(question.stem) : question.stem }}
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
                      className={`w-full cursor-pointer rounded-lg border px-3 py-2 text-left transition-colors duration-150 ${
                        selected
                          ? "border-primary bg-primary/10"
                          : "border-border bg-background hover:bg-muted"
                      } ${checkState !== "idle" ? "opacity-85" : ""}`}
                    >
                      <span className="mr-2 font-semibold">{choice.letter}.</span>
                      <span className="text-foreground" dangerouslySetInnerHTML={{ __html: isDark ? transformSvgColorsForDarkTheme(choice.text) : choice.text }} />
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground" htmlFor="student-answer">
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
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none transition focus:border-primary/70 focus:ring-3 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-85"
                  placeholder="Type your answer"
                />
                <p className="text-xs text-muted-foreground">
                  Use the exact value the question expects unless it says to round.
                </p>
              </div>
            )}

            {checkState === "correct" && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700">
                Correct. Nice work.
              </div>
            )}

            {checkState === "incorrect" && (
              <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800">
                <p>Not quite. Review the explanation and then continue.</p>
                <div
                  className="block leading-relaxed text-foreground [&_p]:mb-3 [&_p]:last:mb-0 [&_strong]:font-semibold"
                  dangerouslySetInnerHTML={{ __html: isDark ? transformSvgColorsForDarkTheme(question.rationale) : question.rationale }}
                />
              </div>
            )}
          </>
        )}
        </CardContent>

        <CardFooter className="hidden flex-col items-stretch gap-4 lg:flex">
          {renderFilterControls()}
          {renderDesktopActionButtons()}
        </CardFooter>
      </Card>

      <aside className="hidden w-full lg:order-1 lg:sticky lg:top-6 lg:block lg:w-72 lg:shrink-0">
        {renderQuestionBrowser("max-h-[70svh]")}
      </aside>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 px-3 py-4 lg:hidden" onClick={() => setMobileMenuOpen(false)}>
          <div
            className="mx-auto flex h-full w-full max-w-2xl flex-col gap-3 overflow-hidden rounded-xl border border-border bg-background p-3 shadow-sm"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Menu</p>
              <Button variant="outline" size="sm" onClick={() => setMobileMenuOpen(false)}>
                Close
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {question && (
                <Button variant="outline" size="sm" onClick={copyQuestionUrl}>
                  {copyStatus === "copied" ? "Copied Link" : copyStatus === "error" ? "Copy Failed" : "Copy Question URL"}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={toggleTheme}>
                Toggle theme
              </Button>
            </div>

            <div className="space-y-3 overflow-y-auto pr-1">
              {renderQuestionBrowser("max-h-64")}
              <Card className="border-border bg-card shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Filters and Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  {renderFilterControls()}
                  {renderMenuUtilityActions()}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      <Button
        variant="outline"
        size="icon"
        onClick={() => setMobileMenuOpen(true)}
        className="fixed left-3 top-3 z-40 size-11 rounded-xl shadow-md lg:hidden"
      >
        <span className="sr-only">Open menu</span>
        <span aria-hidden="true" className="flex flex-col gap-1">
          <span className="h-0.5 w-5 rounded bg-current" />
          <span className="h-0.5 w-5 rounded bg-current" />
          <span className="h-0.5 w-5 rounded bg-current" />
        </span>
      </Button>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background px-3 py-3 lg:hidden">
        <div className="mx-auto flex w-full max-w-2xl gap-2">
          <Button className="flex-1" variant="outline" onClick={redoCurrentQuestion} disabled={!question || loading}>
            Redo Question
          </Button>
          {checkState === "idle" ? (
            <Button
              className="flex-1"
              onClick={checkAnswer}
              disabled={!hydrated || !questionProgressReady || !selectedChoice || loading || !!error}
              suppressHydrationWarning
            >
              Check Question
            </Button>
          ) : (
            <Button
              className="flex-1"
              onClick={() => fetchRandomQuestion(filterState)}
              disabled={!hydrated || !questionProgressReady || loading}
              suppressHydrationWarning
            >
              Next Question
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
