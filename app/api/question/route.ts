import { getCollegeBoardQuestionById, getRandomCollegeBoardQuestion } from "@/lib/collegeboard"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    const section = searchParams.get("section") ?? "english"
    const domain = searchParams.get("domain") ?? "any"
    const skill = searchParams.get("skill") ?? "any"
    const difficulty = searchParams.get("difficulty") ?? "any"

    const question = id
      ? await getCollegeBoardQuestionById(id)
      : await getRandomCollegeBoardQuestion({
          section,
          domain,
          skill,
          difficulty,
        })

    return Response.json(
      { question },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    )
  } catch (error) {
    console.error("Failed to load College Board question:", error)
    return Response.json(
      { error: "Unable to load a quiz question right now." },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    )
  }
}
