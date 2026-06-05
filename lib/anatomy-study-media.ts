import { prisma } from "./prisma"

export type AnatomyStudyMediaUrlOptions = {
  mediaUrlBySlug: Map<string, string>
}

export async function loadAnatomyStudyMediaUrlOptions(): Promise<AnatomyStudyMediaUrlOptions> {
  try {
    const rows = await prisma.anatomyMediaAsset.findMany({
      select: {
        slug: true,
        remoteUrl: true,
      },
    })

    return {
      mediaUrlBySlug: new Map(
        rows
          .filter((row) => Boolean(row.remoteUrl))
          .map((row) => [row.slug, row.remoteUrl as string]),
      ),
    }
  } catch {
    return { mediaUrlBySlug: new Map() }
  }
}
