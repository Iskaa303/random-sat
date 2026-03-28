import { getRandomOpenSatQuestion } from "@/lib/opensat"
import { Hono } from "hono"
import { handle } from "hono/vercel"

const app = new Hono()

app.get("*", async (c) => {
  try {
    const section = c.req.query("section") ?? "english"
    const domain = c.req.query("domain") ?? "any"
    const limitQuery = c.req.query("limit")
    const parsedLimit = limitQuery ? Number(limitQuery) : undefined
    const limit = parsedLimit !== undefined && Number.isFinite(parsedLimit) ? parsedLimit : undefined

    const question = await getRandomOpenSatQuestion({
      section,
      domain,
      limit,
    })

    c.header("Cache-Control", "no-store")
    return c.json({ question })
  } catch (error) {
    console.error("Failed to load OpenSAT question:", error)
    c.header("Cache-Control", "no-store")
    return c.json({ error: "Unable to load a quiz question right now." }, 500)
  }
})

export const GET = handle(app)
