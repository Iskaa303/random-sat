const FALLBACK_SITE_URL = "https://random-sat.vercel.app"

function normalizeSiteUrl(value: string | undefined) {
  if (!value) {
    return FALLBACK_SITE_URL
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value
  }

  return `https://${value}`
}

export const siteConfig = {
  name: "Suckless SAT Practice",
  shortName: "Random SAT",
  description:
    "Practice with official SAT Bluebook question bank items, filtered by section, domain, skill, and difficulty.",
  keywords: [
    "SAT practice",
    "Bluebook SAT questions",
    "digital SAT",
    "SAT reading practice",
    "SAT math practice",
    "College Board question bank",
  ],
}

export function getSiteUrl() {
  return normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL)
}
