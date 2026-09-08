import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8")

describe("Task 4A browser harness contracts", () => {
  it("scopes identity and interaction messages without first-or-last ambiguity", async () => {
    const [identity, interaction] = await Promise.all([
      read("tests/browser/identity-method-safety.spec.ts"),
      read("tests/browser/interaction-feedback.spec.ts"),
    ])
    assert.equal(identity.includes("hasText: /^Your sign-in methods changed\\. Sign in again to continue\\.$/"), true)
    assert.equal(identity.includes("hasText: /^Password sign-in is now enabled\\.$/"), true)
    assert.equal(identity.includes("hasText: /^This confirmation expired or belongs to another session\\. Start again with Google sign-in\\.$/"), true)
    assert.doesNotMatch(identity, /getByRole\("status"\)\.toContainText\(\/(?:sign-in methods changed|enabled\|saved)/)

    const matchingLinkStart = identity.indexOf('test("matching Google email becomes the same MassageLab account only after real Credentials sign-in"')
    const matchingLinkEnd = identity.indexOf('\n  test("method controls keep a last sign-in method', matchingLinkStart)
    assert.ok(matchingLinkStart >= 0 && matchingLinkEnd > matchingLinkStart)
    const matchingLinkJourney = identity.slice(matchingLinkStart, matchingLinkEnd)
    assert.doesNotMatch(matchingLinkJourney, /Linked\\\. Redirecting to account security/)
    const actionLockIndex = matchingLinkJourney.indexOf("await confirm.dblclick()")
    const destinationIndex = matchingLinkJourney.indexOf('await expect(page).toHaveURL("/account?tab=security")')
    const headingIndex = matchingLinkJourney.indexOf('page.getByRole("heading", { name: "Sign-in methods" })')
    const googleMethodIndex = matchingLinkJourney.indexOf('page.getByText("Google", { exact: true }).locator("..")')
    const linkedStateIndex = matchingLinkJourney.indexOf('googleMethod.getByText("Linked", { exact: true })')
    assert.ok(actionLockIndex >= 0 && destinationIndex > actionLockIndex)
    assert.ok(headingIndex > destinationIndex && googleMethodIndex > headingIndex && linkedStateIndex > googleMethodIndex)

    assert.match(interaction, /interactionFixtureProject\(testInfo\.project\.name\)/)
    assert.match(interaction, /getByText\("Profile saved", \{ exact: true \}\)/)
    assert.match(interaction, /getByText\("Your account profile was saved\.", \{ exact: true \}\)/)
    assert.ok(interaction.split("hasText: /^Something went wrong\\. Please try again\\.$/").length - 1 >= 3)
    assert.doesNotMatch(interaction, /getByRole\("alert"\)\.toContainText\("Something went wrong/)
  })

  it("owns the delayed membership portal form through the return-status region", async () => {
    const membership = await read("tests/browser/membership-return-status.spec.ts")
    assert.match(membership, /const returnStatus = page\.locator\('\[data-membership-return-status="portal"\]'\)/)
    assert.match(membership, /await expect\(returnStatus\)\.toContainText\(\/needs billing attention\/i\)/)
    assert.match(membership, /const form = returnStatus\.locator\('form\[action="\/api\/billing\/portal"\]'\)/)
    assert.doesNotMatch(membership, /const form = page\.locator\('form\[action="\/api\/billing\/portal"\]'\)/)
  })

  it("scopes the self-remediation notice to the one visible Security region", async () => {
    const adminOperations = await read("tests/browser/admin-user-operations.spec.ts")
    const journeyStart = adminOperations.indexOf('test("Admin Security is self-read-only and 2FA reset requires the target confirmation email"')
    assert.ok(journeyStart >= 0)
    const journey = adminOperations.slice(journeyStart)
    const regionIndex = journey.indexOf('const securityRegion = page.getByRole("region", { name: "Security" }).filter({ visible: true })')
    const regionCountIndex = journey.indexOf("await expect(securityRegion).toHaveCount(1)")
    const noticeIndex = journey.indexOf('const selfRemediationNotice = securityRegion.getByText("You cannot perform security remediation on your own account from this console.", { exact: true }).filter({ visible: true })')
    const noticeCountIndex = journey.indexOf("await expect(selfRemediationNotice).toHaveCount(1)")
    const noticeVisibleIndex = journey.indexOf("await expect(selfRemediationNotice).toBeVisible()")
    const zeroButtonIndex = journey.indexOf('await expect(page.getByRole("button", { name: "Send password reset" })).toHaveCount(0)')
    assert.ok(regionIndex >= 0 && regionCountIndex > regionIndex)
    assert.ok(noticeIndex > regionCountIndex && noticeCountIndex > noticeIndex)
    assert.ok(noticeVisibleIndex > noticeCountIndex && zeroButtonIndex > noticeVisibleIndex)
    assert.doesNotMatch(journey, /page\.getByText\(\/cannot perform security remediation/)
  })

  it("routes every ordinary signed-in direct-cookie family through the bounded User fixture", async () => {
    const [publicRoutes, commerce, visualizer, carousel, cookieFixture] = await Promise.all([
      read("tests/browser/public-routes.spec.ts"),
      read("tests/browser/background-commerce.spec.ts"),
      read("tests/browser/music-visualizer.spec.ts"),
      read("tests/browser/background-carousel-preview.spec.ts"),
      read("tests/browser/signed-in-user-fixture.ts"),
    ])
    for (const source of [publicRoutes, commerce, visualizer, carousel]) {
      assert.match(source, /installSignedInUserFixture/)
      assert.match(source, /removeSignedInUserFixture/)
      assert.doesNotMatch(source, /installSignedInSessionCookie/)
    }
    assert.match(cookieFixture, /isBrowserQaDatabaseTargetAuthorized\(process\.env\)/)
    assert.match(cookieFixture, /createBrowserUserFixtureRecord/)
    assert.match(cookieFixture, /removeBrowserUserFixtureRecord/)
    assert.match(cookieFixture, /database-free runs retain the existing JWT/)
  })
})
