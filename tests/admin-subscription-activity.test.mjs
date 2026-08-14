import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const helperSource = await readFile(
  new URL("../lib/admin/subscription-activity.ts", import.meta.url),
  "utf8",
).catch(() => "")
const helper = loadCompiledModule(helperSource, "lib/admin/subscription-activity.test.ts")

describe("active membership subscription query", () => {
  it("shares the active or trialing and unexpired predicate without a membership-level restriction", () => {
    assert.equal(typeof helper.activeMembershipSubscriptionWhere, "function")
    if (typeof helper.activeMembershipSubscriptionWhere !== "function") return

    const now = new Date("2026-08-09T12:00:00.000Z")
    assert.deepEqual(helper.activeMembershipSubscriptionWhere(now), {
      status: { in: ["active", "trialing"] },
      OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: now } }],
    })
  })
})
