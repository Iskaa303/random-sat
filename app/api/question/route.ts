import { getCollegeBoardQuestionById, getCollegeBoardQuestionIds, getRandomCollegeBoardQuestion } from "@/lib/collegeboard"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get("mode")
    const id = searchParams.get("id")
    const section = searchParams.get("section") ?? "any"
    const domain = searchParams.get("domain") ?? "any"
    const skill = searchParams.get("skill") ?? "any"
    const difficulty = searchParams.get("difficulty") ?? "any"

    if (mode === "browse") {
      const metadata = await getCollegeBoardQuestionIds({
        section,
        domain,
        skill,
        difficulty,
      })

      const seenIds = new Set<string>()
      const questions = metadata
        .map((item) => ({
          id: typeof item.external_id === "string" ? item.external_id.trim() : "",
          difficulty: typeof item.difficulty === "string" ? item.difficulty : "",
        }))
        .filter((item) => {
          if (!item.id || seenIds.has(item.id)) {
            return false
          }

          seenIds.add(item.id)
          return true
        })

      return Response.json(
        { questions },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        }
      )
    }

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
