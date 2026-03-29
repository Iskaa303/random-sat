import type { MetadataRoute } from "next"

import { getAllCollegeBoardQuestionIds } from "@/lib/collegeboard"
import { getSiteUrl } from "@/lib/site"
import { getQuestionUrl } from "@/lib/quiz"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl()
  const questions = await getAllCollegeBoardQuestionIds()

  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    ...questions.map((question) => ({
      url: getQuestionUrl(siteUrl, question.external_id),
      lastModified: new Date(question.updateDate || question.createDate || Date.now()),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ]
}
