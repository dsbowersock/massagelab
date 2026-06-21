import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

describe("Neon transfer hardening", () => {
  it("keeps DB-backed flashcard media loading cached and projected", async () => {
    const source = await readFile(new URL("../lib/anatomy-study-media.ts", import.meta.url), "utf8")

    assert.match(source, /STUDY_MEDIA_CACHE_TTL_MS/)
    assert.match(source, /studyMediaOptionsCache/)
    assert.match(source, /pendingStudyMediaOptions/)
    assert.match(source, /select: studyMediaAssetSelect/)
    assert.match(source, /source: \{ slug: \{ in: PUBLIC_FLASHCARD_IMAGE_SOURCE_SLUGS \} \}/)
    assert.match(source, /usageScope: "OPEN_REUSE"/)
    assert.match(source, /reviewStatus: "REVIEWED"/)
    assert.match(source, /mediaAssets: value\.mediaAssets\.map/)
    assert.match(source, /mediaEntityLinks: value\.mediaEntityLinks\.map/)
    assert.doesNotMatch(source, /entityLinks:\s*\{[\s\S]*where:\s*\{\s*reviewStatus: "APPROVED"/)
    assert.doesNotMatch(source, /include:\s*\{\s*source: true,\s*entityLinks: true,\s*\}/)
  })

  it("preserves DB media-link review overrides before the public approval filter", async () => {
    const mediaSource = await readFile(new URL("../lib/anatomy-study-media.ts", import.meta.url), "utf8")
    const studySource = await readFile(new URL("../lib/anatomy-study.ts", import.meta.url), "utf8")

    assert.doesNotMatch(mediaSource, /entityLinks:\s*\{[\s\S]*where:\s*\{\s*reviewStatus: "APPROVED"/)
    assert.match(studySource, /\.filter\(\(link\) => \(link\.reviewStatus \?\? "approved"\) === "approved"\)/)
  })

  it("keeps admin media review rows on explicit asset snippets", async () => {
    const source = await readFile(new URL("../app/admin/anatomy/media-review/page.tsx", import.meta.url), "utf8")

    assert.match(source, /const mediaReviewAssetSelect = \{/)
    assert.match(source, /source:\s*\{\s*select:\s*\{[\s\S]*slug: true,[\s\S]*label: true/)
    assert.match(source, /asset:\s*\{\s*select: mediaReviewAssetSelect/)
    assert.doesNotMatch(source, /asset:\s*\{\s*include:\s*\{\s*source: true/)
  })

  it("keeps anatomy admin browser media candidates on snippets", async () => {
    const source = await readFile(new URL("../app/admin/anatomy/browser-data.ts", import.meta.url), "utf8")

    assert.match(source, /const anatomyMediaAssetSnippetSelect = \{/)
    assert.match(source, /entityLinks:\s*\{\s*select: anatomyMediaEntitySnippetSelect/)
    assert.match(source, /select: anatomyMediaAssetSnippetSelect/)
    assert.doesNotMatch(source, /include:\s*\{\s*source: true,\s*entityLinks: true,\s*\}/)
  })

  it("keeps maintenance scripts from fetching full media or request records", async () => {
    const coverageSource = await readFile(new URL("../scripts/anatomy-media-view-coverage.ts", import.meta.url), "utf8")
    const requestsSource = await readFile(new URL("../scripts/anatomy-media-view-requests.ts", import.meta.url), "utf8")

    assert.match(coverageSource, /entityLinks:\s*\{\s*select:\s*\{[\s\S]*entityType: true,[\s\S]*entitySlug: true/)
    assert.doesNotMatch(coverageSource, /include:\s*\{\s*entityLinks: true\s*\}/)
    assert.match(requestsSource, /select:\s*\{[\s\S]*entityType: true,[\s\S]*entitySlug: true,[\s\S]*requestedView: true/)
  })

  it("requires pooled Neon hosts for production Prisma runtime connections", async () => {
    const source = await readFile(new URL("../lib/prisma.ts", import.meta.url), "utf8")

    assert.match(source, /export function validatePrismaDatabaseUrl/)
    assert.match(source, /const NEON_HOST_SUFFIX = "\.neon\.tech"/)
    assert.match(source, /const NEON_POOLED_HOST_MARKER = "-pooler\."/)
    assert.match(source, /nodeEnv === "production"[\s\S]*url\.hostname\.endsWith\(NEON_HOST_SUFFIX\)[\s\S]*!url\.hostname\.includes\(NEON_POOLED_HOST_MARKER\)/)
    assert.match(source, /Use DIRECT_URL or DATABASE_URL_UNPOOLED for migrations and maintenance scripts/)
    assert.doesNotMatch(source, /throw new Error\(`[\s\S]*\$\{/)
  })

  it("keeps signed-in homepage preferences on the needed settings column", async () => {
    const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8")

    assert.match(source, /prisma\.userPreference\.findUnique\(\{[\s\S]*where: \{ userId \},[\s\S]*select: \{ appSettings: true \}/)
    assert.doesNotMatch(source, /prisma\.userPreference\.findUnique\(\{\s*where: \{ userId: userId \ }\s*\}\)/)
  })

  it("keeps public booking option generation on explicit projections", async () => {
    const source = await readFile(new URL("../lib/public-booking-sequences.js", import.meta.url), "utf8")

    assert.match(source, /db\.practice\.findUnique\(\{[\s\S]*select: \{[\s\S]*publicBookingSlug: true,[\s\S]*providerBookingPolicies: \{[\s\S]*select: \{/)
    assert.match(source, /db\.serviceVariant\.findMany\(\{[\s\S]*select: \{[\s\S]*serviceTypeId: true,[\s\S]*resourceRequirements: \{[\s\S]*resource: \{ select: \{ active: true \} \}/)
    assert.match(source, /db\.calendarAvailabilitySchedule\.findMany\(\{[\s\S]*select: \{[\s\S]*intervals: \{[\s\S]*select: \{ dayOfWeek: true, startMinute: true, endMinute: true, active: true \}/)
    assert.match(source, /db\.providerBookingCapacityRule\.findMany\(\{[\s\S]*select: \{[\s\S]*providerUserId: true,[\s\S]*maxMinutes: true,[\s\S]*active: true/)
    assert.doesNotMatch(source, /include:\s*\{\s*bookingPolicy: true/)
    assert.doesNotMatch(source, /include:\s*\{\s*serviceType: true/)
    assert.doesNotMatch(source, /include:\s*\{\s*intervals: true/)
    assert.doesNotMatch(source, /email: true/)
  })

  it("keeps the public booking page on explicit public projections", async () => {
    const source = await readFile(new URL("../app/book/public-booking-page.tsx", import.meta.url), "utf8")

    assert.match(source, /prisma\.practice\.findFirst\(\{[\s\S]*select: \{[\s\S]*bookingPolicy: \{[\s\S]*select: \{/)
    assert.match(source, /providerBookingPolicies: \{[\s\S]*select: \{[\s\S]*providerUserId: true,[\s\S]*displayLabel: true/)
    assert.match(source, /serviceTypes: \{[\s\S]*select: \{[\s\S]*variants: \{[\s\S]*select: \{[\s\S]*durationMinutes: true,[\s\S]*priceCents: true/)
    assert.match(source, /memberships: \{[\s\S]*select: \{ userId: true, user: \{ select: \{ name: true \} \} \}/)
    assert.doesNotMatch(source, /include:\s*\{[\s\S]*bookingPolicy: true/)
    assert.doesNotMatch(source, /include:\s*\{\s*user: \{ select: \{ name: true, email: true \} \}/)
    assert.doesNotMatch(source, /email: true/)
  })
})
