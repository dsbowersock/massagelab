import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

function readProjectFile(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
}

describe("Business income planner source guards", () => {
  it("reads only appSettings when seeding the signed-in worksheet", () => {
    const source = readProjectFile("app/tools/business-planner/income/page.tsx")

    assert.match(source, /prisma\.userPreference\.findUnique\(\{[\s\S]*where: \{ userId \},[\s\S]*select: \{ appSettings: true \}/)
    assert.match(source, /try \{[\s\S]*prisma\.userPreference\.findUnique/)
  })

  it("keeps anonymous users away from account preference sync", () => {
    const source = readProjectFile("app/tools/business-planner/income/income-planner-client.tsx")
    const guardIndex = source.indexOf("if (!isSignedIn) return")
    const fetchIndex = source.indexOf('fetch("/api/account/preferences"')

    assert.notEqual(guardIndex, -1)
    assert.notEqual(fetchIndex, -1)
    assert.ok(guardIndex < fetchIndex, "signed-in guard must appear before account preference fetch")
    assert.match(source, /lastSyncedPlannerRef/)
    assert.match(source, /requestTimeoutId/)
  })

  it("does not add a dedicated Prisma model for planner worksheets", () => {
    const schema = readProjectFile("prisma/schema.prisma")

    assert.doesNotMatch(schema, /model\s+BusinessIncome(?:Planner|Scenario|Worksheet)?\b/)
    assert.match(schema, /model\s+UserPreference[\s\S]*appSettings\s+Json/)
  })
})
