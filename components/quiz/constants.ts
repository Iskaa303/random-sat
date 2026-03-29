export const QUIZ_STORAGE_KEY = "bluebook-quiz-state-v1"
export const QUESTION_PROGRESS_STORAGE_KEY = "bluebook-question-progress-v1"

export const SECTION_OPTIONS = [
  { value: "english", label: "English" },
  { value: "math", label: "Math" },
] as const

export const DIFFICULTY_OPTIONS = [
  { value: "any", label: "Any Difficulty" },
  { value: "E", label: "Easy" },
  { value: "M", label: "Medium" },
  { value: "H", label: "Hard" },
] as const

export const DOMAIN_OPTIONS: Record<string, Array<{ value: string; label: string }>> = {
  english: [
    { value: "any", label: "Any Domain" },
    { value: "INI", label: "Information and Ideas" },
    { value: "CAS", label: "Craft and Structure" },
    { value: "EOI", label: "Expression of Ideas" },
    { value: "SEC", label: "Standard English Conventions" },
  ],
  math: [
    { value: "any", label: "Any Domain" },
    { value: "H", label: "Algebra" },
    { value: "P", label: "Advanced Math" },
    { value: "Q", label: "Problem-Solving and Data Analysis" },
    { value: "S", label: "Geometry and Trigonometry" },
  ],
}

export const SKILL_OPTIONS: Record<string, Record<string, Array<{ value: string; label: string }>>> = {
  english: {
    INI: [
      { value: "any", label: "Any Skill" },
      { value: "INF", label: "Inferences" },
      { value: "CID", label: "Central Ideas and Details" },
      { value: "COE", label: "Command of Evidence" },
    ],
    CAS: [
      { value: "any", label: "Any Skill" },
      { value: "WIC", label: "Words in Context" },
      { value: "TSP", label: "Text Structure and Purpose" },
      { value: "CTC", label: "Cross-Text Connections" },
    ],
    EOI: [
      { value: "any", label: "Any Skill" },
      { value: "TRA", label: "Transitions" },
      { value: "SYN", label: "Rhetorical Synthesis" },
    ],
    SEC: [
      { value: "any", label: "Any Skill" },
      { value: "BOU", label: "Boundaries" },
      { value: "FSS", label: "Form, Structure, and Sense" },
    ],
  },
  math: {
    H: [
      { value: "any", label: "Any Skill" },
      { value: "H.A.", label: "Linear equations in one variable" },
      { value: "H.D.", label: "Systems of two linear equations in two variables" },
      { value: "H.B.", label: "Linear functions" },
      { value: "H.C.", label: "Linear equations in two variables" },
      { value: "H.E.", label: "Linear inequalities in one or two variables" },
    ],
    P: [
      { value: "any", label: "Any Skill" },
      { value: "P.C.", label: "Nonlinear functions" },
      { value: "P.B.", label: "Nonlinear equations in one variable and systems of equations in two variables" },
      { value: "P.A.", label: "Equivalent expressions" },
    ],
    Q: [
      { value: "any", label: "Any Skill" },
      { value: "Q.F.", label: "Inference from sample statistics and margin of error" },
      { value: "Q.A.", label: "Ratios, rates, proportional relationships, and units" },
      { value: "Q.E.", label: "Probability and conditional probability" },
      { value: "Q.B.", label: "Percentages" },
      { value: "Q.C.", label: "One-variable data: Distributions and measures of center and spread" },
      { value: "Q.D.", label: "Two-variable data: Models and scatterplots" },
      { value: "Q.G.", label: "Evaluating statistical claims: Observational studies and experiments" },
    ],
    S: [
      { value: "any", label: "Any Skill" },
      { value: "S.B.", label: "Lines, angles, and triangles" },
      { value: "S.A.", label: "Area and volume" },
      { value: "S.C.", label: "Right triangles and trigonometry" },
      { value: "S.D.", label: "Circles" },
    ],
  },
}
