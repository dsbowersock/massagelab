import { HeartPulse } from "lucide-react"
import { getCurrentSession } from "@/auth"
import { WellnessHubClient, type WellnessTimelineEntry } from "@/components/wellness/wellness-hub-client"
import { AppPageShell, AppSurface, appCalloutClassName } from "@/components/ui/app-surface"
import { prisma } from "@/lib/prisma"

export default async function WellnessPage() {
  const session = await getCurrentSession()
  const userId = session?.user?.id
  const entries = userId
    ? await prisma.clientWellnessEntry.findMany({
        where: { userId, deletedAt: null },
        orderBy: { occurredAt: "desc" },
        take: 25,
      })
    : []

  return (
    <AppPageShell width="wide" contentClassName="gap-5">
      <AppSurface
        title="Wellness"
        description="Client-owned self-tracking for quick check-ins, context notes, and range-of-motion measurements."
        icon={<HeartPulse className="h-5 w-5" aria-hidden="true" />}
        badge={userId ? "Signed in" : "Practice mode"}
        className={appCalloutClassName}
      >
        <WellnessHubClient
          isSignedIn={Boolean(userId)}
          displayName={session?.user?.name ?? session?.user?.email ?? null}
          initialEntries={entries.map(serializeWellnessEntry)}
        />
      </AppSurface>
    </AppPageShell>
  )
}

function serializeWellnessEntry(entry: {
  id: string
  category: string
  occurredAt: Date
  timezone: string
  summary: string | null
  intensity: number | null
  regions: unknown
  sensations: unknown
  contexts: unknown
  source: string
  metadata: unknown
  createdAt: Date
  updatedAt: Date
}): WellnessTimelineEntry {
  return {
    id: entry.id,
    category: entry.category,
    occurredAt: entry.occurredAt.toISOString(),
    timezone: entry.timezone,
    summary: entry.summary,
    intensity: entry.intensity,
    regions: Array.isArray(entry.regions) ? entry.regions.filter(isString) : [],
    sensations: Array.isArray(entry.sensations) ? entry.sensations.filter(isString) : [],
    contexts: Array.isArray(entry.contexts) ? entry.contexts.filter(isString) : [],
    source: entry.source,
    metadata: entry.metadata && typeof entry.metadata === "object" && !Array.isArray(entry.metadata)
      ? (entry.metadata as Record<string, unknown>)
      : {},
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
    persisted: true,
  }
}

function isString(value: unknown): value is string {
  return typeof value === "string"
}
