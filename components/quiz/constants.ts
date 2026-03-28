export const QUIZ_STORAGE_KEY = "opensat-quiz-state-v1"

export const SECTION_OPTIONS = [
  { value: "english", label: "English" },
  { value: "math", label: "Math" },
] as const

export const DOMAIN_OPTIONS: Record<string, Array<{ value: string; label: string }>> = {
  english: [
    { value: "any", label: "Any" },
    { value: "information and ideas", label: "Information" },
    { value: "craft and structure", label: "Craft" },
    { value: "expression of ideas", label: "Expression" },
    { value: "standard english conventions", label: "Conventions" },
  ],
  math: [
    { value: "any", label: "Any" },
    { value: "algebra", label: "Algebra" },
    { value: "advanced math", label: "Advanced" },
    { value: "problem-solving and data analysis", label: "Data Analysis" },
    { value: "geometry and trigonometry", label: "Geometry/Trig" },
  ],
}
