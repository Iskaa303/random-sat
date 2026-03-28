"use client"

import Latex from "react-latex-next"

type LatexTextProps = {
  text: string
  className?: string
  preferMath?: "auto" | "aggressive"
}

function looksLikeBareMath(value: string) {
  const mathCharsOnly = /^[A-Za-z0-9\s=()+\-*/^.,%]+$/.test(value)
  const hasMathSignal = value.includes("=") || value.includes("^") || /\b[A-Za-z]\w*\([^)]*\)/.test(value)
  return mathCharsOnly && hasMathSignal
}

function looksLikeMathFragment(value: string) {
  return (
    value.includes("=") ||
    value.includes("^") ||
    /\b[A-Za-z]\([^)]*\)/.test(value) ||
    /[0-9][0-9,]*(\.[0-9]+)?/.test(value)
  )
}

function normalizeOpenSatText(input: string, preferMath: "auto" | "aggressive") {
  let normalized = input.replace(/\r\n/g, "\n")
  normalized = normalized.replace(/−/g, "-")

  const preservedMath: string[] = []
  normalized = normalized.replace(/\$[^$]+\$/g, (match) => {
    preservedMath.push(match)
    return `@@MATH_${preservedMath.length - 1}@@`
  })

  // OpenSAT sometimes uses markdown emphasis instead of math delimiters.
  normalized = normalized.replace(/\*\*([^*\n]+)\*\*/g, (_match, expr: string) => {
    const trimmed = expr.trim()
    return looksLikeMathFragment(trimmed) ? `$${trimmed}$` : trimmed
  })
  normalized = normalized.replace(/\*([^*\n]+)\*/g, (_match, expr: string) => {
    const trimmed = expr.trim()
    return looksLikeMathFragment(trimmed) ? `$${trimmed}$` : trimmed
  })

  // Fix duplicated equations/functions in some explanations, e.g. f(x)=...f(x)=... or f(x)f(x).
  normalized = normalized.replace(
    /([A-Za-z]\([^)]*\)\s*=\s*[^;:\n]+)\s*\1/g,
    (_match, equation: string) => equation
  )
  normalized = normalized.replace(/([A-Za-z]\([^)]*\))\s*\1/g, (_match, fn: string) => fn)

  // Fix doubled variable tokens like "aa", "rr", "xx" in prose.
  normalized = normalized.replace(/\b([A-Za-z])\1\b/g, (_match, variable: string) => variable)

  // Wrap inline equation fragments in prose when delimiters are missing.
  // Stops before prose transitions like ", where ..."/". It ...", while preserving decimals and thousands separators.
  normalized = normalized.replace(
    /(?<!\$)\b[A-Za-z]\([^)]*\)\s*=\s*(?:(?!,\s(?:where|which|and|or|if|that|it)\b)(?!\.\s)[^;\n])+/g,
    (equation) => {
      const trimmed = equation.trim().replace(/[,\s]+$/g, "")
      return `$${trimmed}$`
    }
  )

  // Normalize malformed double-$ starts that can appear in upstream content.
  normalized = normalized.replace(/\$\$(?=[^$])/g, "$")

  // Remove accidental "$." artifacts like "0$.02" if they slip through.
  normalized = normalized.replace(/\$\.([0-9])/g, ".$1")

  const trimmed = normalized.trim()
  if (
    !normalized.includes("$") &&
    (preferMath === "aggressive" ? looksLikeMathFragment(trimmed) : looksLikeBareMath(trimmed))
  ) {
    normalized = `$${trimmed}$`
  }

  normalized = normalized.replace(/@@MATH_(\d+)@@/g, (_match, index: string) => {
    return preservedMath[Number(index)] ?? ""
  })

  return normalized
}

export function LatexText({ text, className, preferMath = "auto" }: LatexTextProps) {
  const normalizedText = normalizeOpenSatText(text, preferMath)

  return (
    <span className={className}>
      <Latex>{normalizedText}</Latex>
    </span>
  )
}
