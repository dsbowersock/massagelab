import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

const calendarFallbackFiles = [
  "app/calendar/page.tsx",
  "app/calendar/availability/page.tsx",
  "app/book/[practiceSlug]/page.tsx",
]

describe("calendar unavailable fallback copy", () => {
  it("does not expose setup or migration details to users", async () => {
    const contents = await Promise.all(calendarFallbackFiles.map((file) => readFile(file, "utf8")))
    const combined = contents.join("\n")

    assert.equal(combined.includes("Calendar setup needed"), false)
    assert.equal(combined.includes("generated Prisma"), false)
    assert.equal(combined.includes("database migration"), false)
    assert.equal(combined.includes("npm run prisma"), false)
    assert.equal(combined.includes("temporarily unavailable"), true)
  })
})
