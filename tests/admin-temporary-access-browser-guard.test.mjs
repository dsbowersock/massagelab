import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

const browserSource = await readFile(
  new URL("./browser/admin-user-operations.spec.ts", import.meta.url),
  "utf8",
)
const actionSource = await readFile(
  new URL("../app/admin/users/[userId]/temporary-access-actions.ts", import.meta.url),
  "utf8",
)
const temporaryAccessTestStart = browserSource.indexOf(
  'test("Admin grants and append-only revokes one bounded temporary feature with Account expiration evidence"',
)
const nextTestStart = browserSource.indexOf("\n  test(", temporaryAccessTestStart + 1)
// A selected final test extends through the end of the browser source.
const temporaryAccessTestEnd = nextTestStart === -1 ? browserSource.length : nextTestStart
assert.ok(temporaryAccessTestStart >= 0, "temporary-access browser test must remain present")
assert.ok(temporaryAccessTestEnd > temporaryAccessTestStart, "temporary-access browser test must retain a closing boundary")
// Keep source-contract assertions scoped to this one selected browser test.
const temporaryAccessBrowserContract = browserSource.slice(temporaryAccessTestStart, temporaryAccessTestEnd)
const retiredDiagnosticTokens = [
  "MASSAGELAB_BROWSER_QA_PHASE_" + "TIMINGS",
  "ATMOSHAPER_BROWSER_QA_PHASE_" + "TIMING",
  "ATMOSHAPER_BROWSER_QA_TEMP_" + "ACCESS",
  "startTemporaryAccess" + "Diagnostic",
  "__ATMOSHAPER_BROWSER_QA_CONTROLLER_" + "CHANGE_STATE",
]

describe("Admin temporary-access browser request guard", () => {
  it("counts only exact-path POSTs and proves one request per settled mutation", () => {
    assert.ok(temporaryAccessTestStart >= 0, "temporary-access browser test must remain present")
    assert.match(temporaryAccessBrowserContract, /const temporaryAccessPostObserver = \(request: Request\) =>/)
    assert.match(temporaryAccessBrowserContract, /request\.method\(\) === "POST"/)
    assert.match(temporaryAccessBrowserContract, /new URL\(request\.url\(\)\)\.pathname === targetAdminUserPathname/)
    assert.match(temporaryAccessBrowserContract, /page\.on\("request", temporaryAccessPostObserver\)/)
    assert.match(temporaryAccessBrowserContract, /temporaryAccessPostCount \+= 1/)
    assert.match(temporaryAccessBrowserContract, /expect\(temporaryAccessPostCount\)\.toBe\(1\)/)
    const finalTargetAccountEvidence = temporaryAccessBrowserContract.indexOf(
      'await expect(targetPage.getByRole("heading", { name: "Temporary feature access" })).toHaveCount(0)',
    )
    const listenerClosures = [...temporaryAccessBrowserContract.matchAll(
      /page\.off\("request", temporaryAccessPostObserver\)/g,
    )].map((match) => match.index)
    const finalRequestCount = temporaryAccessBrowserContract.indexOf(
      "expect(temporaryAccessPostCount).toBe(2)",
      finalTargetAccountEvidence,
    )
    assert.ok(finalTargetAccountEvidence >= 0)
    assert.equal(listenerClosures.length, 2)
    assert.ok(listenerClosures[0] > finalTargetAccountEvidence)
    assert.ok(finalRequestCount > listenerClosures[0])
    assert.ok(listenerClosures[1] > finalRequestCount)
  })

  it("contains no retired temporary timing diagnostics in tracked owners", () => {
    const trackedOwners = `${actionSource}\n${browserSource}`
    for (const retiredToken of retiredDiagnosticTokens) {
      assert.equal(trackedOwners.includes(retiredToken), false)
    }
  })
})
