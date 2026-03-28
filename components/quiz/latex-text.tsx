"use client"

import Latex from "react-latex-next"

type LatexTextProps = {
  text: string
  className?: string
  preferMath?: "auto" | "aggressive"
  enableUnderscoreItalics?: boolean
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
  normalized = normalized.replace(/\\\\\"/g, "\"")
  normalized = normalized.replace(/\\"/g, "\"")

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

  // Render standalone LaTeX environments in passages/explanations.
  // For align, strip the environment and render as regular latex text.
  normalized = normalized.replace(
    /\\begin\{align\*?\}([\s\S]*?)\\end\{align\*?\}/g,
    (_match: string, body: string) => {
      const inlineBody = body
        .split("\\\\")
        .map((part) => part.trim())
        .filter(Boolean)
        .join(" \\quad ")

      return `$${inlineBody}$`
    }
  )

  normalized = normalized.replace(
    /\\begin\{([a-zA-Z*]+)\}[\s\S]*?\\end\{\1\}/g,
    (envBlock: string) => {
      // If a math environment is still present without delimiters, wrap it for KaTeX.
      if (envBlock.includes("$$")) {
        return envBlock
      }
      return `$$${envBlock}$$`
    }
  )

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

export function LatexText({
  text,
  className,
  preferMath = "auto",
  enableUnderscoreItalics = false,
}: LatexTextProps) {
  const normalizedText = normalizeOpenSatText(text, preferMath)

  if (enableUnderscoreItalics && normalizedText.includes("_")) {
    const parts = normalizedText.split(/(_[^_]+_)/g).filter(Boolean)

    return (
      <span className={className}>
        {parts.map((part, index) => {
          if (part.startsWith("_") && part.endsWith("_")) {
            const italicText = part.slice(2, -2)
            return (
              <em key={`italic-${index}`}>
                <Latex>{italicText}</Latex>
              </em>
            )
          }

          return <Latex key={`text-${index}`}>{part}</Latex>
        })}
      </span>
    )
  }

  return (
    <span className={className}>
      <Latex>{normalizedText}</Latex>
    </span>
  )
}
