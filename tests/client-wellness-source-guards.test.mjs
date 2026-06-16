import assert from "node:assert/strict"
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { removeForbiddenPreferenceFields } from "../lib/account-preferences.js"

const repoRoot = new URL("..", import.meta.url).pathname
const forbiddenWellnessPreferenceKeys = [
  "wellnessEntries",
  "clientWellnessEntries",
  "bodySensationEntries",
  "emotionEntries",
  "sleepEntries",
  "activityEntries",
  "wellnessJournal",
  "wellnessSummary",
]

describe("Client wellness source guards", () => {
  it("removes likely wellness payload keys from account preference sync", () => {
    const payload = Object.fromEntries(forbiddenWellnessPreferenceKeys.map((key) => [key, [{ private: "entry" }]]))
    const sanitized = removeForbiddenPreferenceFields({
      safeDefault: "keep",
      nested: payload,
      ...payload,
    })

    assert.deepEqual(sanitized, { safeDefault: "keep", nested: {} })
  })

  it("keeps wellness actions out of calendar, notification, and Sentry payload paths", () => {
    const actionsSource = readFileSync(new URL("../app/wellness/actions.ts", import.meta.url), "utf8")

    assert.doesNotMatch(actionsSource, /CalendarEvent|CalendarNotificationIntent|notification|sendEmail|Sentry|captureException|captureMessage/)
    assert.doesNotMatch(actionsSource, /prisma\.calendar|calendarAuditLog|notificationIntent|auditLog/)
    assert.match(actionsSource, /sanitizeClientWellnessLogMetadata/)
  })

  it("keeps custom wellness vocabulary suggestions private until reviewed in a future workflow", () => {
    const actionsSource = readFileSync(new URL("../app/wellness/actions.ts", import.meta.url), "utf8")

    assert.match(actionsSource, /clientWellnessVocabularySuggestion\.findMany\(\{[\s\S]*?status:\s*"PRIVATE"/)
    assert.match(actionsSource, /clientWellnessVocabularySuggestion\.createMany\(\{[\s\S]*?status:\s*"PRIVATE"/)
    assert.doesNotMatch(actionsSource, /clientWellnessVocabularySuggestion\.(findMany|createMany)\(\{[\s\S]*?status:\s*"APPROVED"/)
    assert.doesNotMatch(actionsSource, /globalVocabulary|publicVocabulary|sharedVocabulary/)
  })

  it("keeps wellness UI separate from the therapist professional-record vault", () => {
    const wellnessSources = [
      ...readFiles("app/wellness"),
      ...readFiles("components/wellness"),
    ].join("\n")

    assert.doesNotMatch(wellnessSources, /massagelab-professional-record-vault-v1/)
    assert.doesNotMatch(wellnessSources, /ProfessionalRecordVault|useProfessionalRecordVault|ClinicalArtifactManifest/)
    assert.doesNotMatch(wellnessSources, /therapistId|practiceId|TherapistClientRelationship|PracticeClient/)
  })

  it("does not add wellness payload fields to calendar implementation files", () => {
    const calendarSources = [
      ...readFiles("app/calendar"),
      ...readFileEntries("lib")
        .filter(({ relativePath }) => isCalendarImplementationPath(relativePath))
        .map(({ source }) => source),
    ].join("\n")

    assert.doesNotMatch(calendarSources, /clientWellnessEntries|wellnessEntries|bodySensationEntries|emotionEntries|wellnessJournal/)
  })
})

function readFiles(relativePath) {
  return readFileEntries(relativePath).map(({ source }) => source)
}

function readFileEntries(relativePath) {
  const absolutePath = join(repoRoot, relativePath)

  if (!existsSync(absolutePath)) {
    return []
  }

  const stat = statSync(absolutePath)

  if (stat.isFile()) {
    return [{ relativePath, source: readFileSync(absolutePath, "utf8") }]
  }

  return readdirSync(absolutePath)
    .flatMap((name) => readFileEntries(join(relativePath, name)))
}

function isCalendarImplementationPath(relativePath) {
  const normalizedPath = relativePath.replaceAll("\\", "/").toLowerCase()
  return /(^|\/)(calendar|sidebar-calendar|public-booking|booking-policy|service-catalog)[^/]*\.(js|mjs|cjs|ts|tsx|jsx)$/.test(normalizedPath)
}
