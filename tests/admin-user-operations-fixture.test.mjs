import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import { requireBrowserAdminFixtureQaAuthorization } from "../lib/admin/browser-qa-authorization.ts"
import { createBrowserAdminFixtureIdentity } from "../lib/admin/browser-fixture-identity.ts"
import { removeBrowserAdminFixtureRecords } from "../lib/admin/browser-fixture-cleanup.ts"
import {
  BROWSER_ADMIN_FIXTURE_ADVISORY_LOCK,
  createBrowserAdminFixtureRecords,
} from "../lib/admin/browser-fixture-provisioning.ts"

const browserSpecSource = await readFile(new URL("browser/admin-user-operations.spec.ts", import.meta.url), "utf8")

describe("admin user operations browser fixture", () => {
  it("fails closed unless the dedicated QA mutation opt-in is explicitly set", () => {
    assert.throws(
      () => requireBrowserAdminFixtureQaAuthorization({ DATABASE_URL: "postgresql://example.test/not-a-real-database" }),
      /MASSAGELAB_BROWSER_QA_DATABASE=1/,
    )
  })

  it("accepts only the dedicated QA mutation opt-in", () => {
    assert.doesNotThrow(() => requireBrowserAdminFixtureQaAuthorization({
      DATABASE_URL: "postgresql://example.test/not-a-real-database",
      MASSAGELAB_BROWSER_QA_DATABASE: "1",
    }))
  })

  it("derives isolated deterministic browser-admin identities for each Playwright project", () => {
    const desktop = createBrowserAdminFixtureIdentity("desktop-chromium")
    const desktopWithoutSeparator = createBrowserAdminFixtureIdentity("desktopchromium")
    const mobile = createBrowserAdminFixtureIdentity("mobile-chromium")

    assert.equal(desktop.projectSlug, "6465736b746f702d6368726f6d69756d")
    assert.notEqual(desktop.projectSlug, desktopWithoutSeparator.projectSlug)
    assert.equal(desktop.operator.id, "browser-admin-operator-desktop-chromium")
    assert.equal(desktop.target.id, "browser-admin-target-desktop-chromium")
    assert.equal(desktop.target.name.length, 120)
    assert.equal(desktop.target.email.length, 254)
    assert.match(desktop.target.name, /^Browser Admin Target desktop-chromium/)
    assert.match(desktop.target.email, /^browser-admin-target-desktop-chromium/)
    assert.notEqual(desktop.operator.id, mobile.operator.id)
    assert.notEqual(desktop.target.id, mobile.target.id)
    assert.throws(() => createBrowserAdminFixtureIdentity("desktop chromium"), /safe Playwright project name/)
  })

  it("checks directory overflow before navigating and detail overflow afterward", () => {
    assert.match(browserSpecSource, /const directoryOverflow = await page\.locator\("html"\)\.evaluate/)
    assert.match(browserSpecSource, /expect\(directoryOverflow\)\.toBe\(false\)/)
    assert.match(browserSpecSource, /const detailOverflow = await page\.locator\("html"\)\.evaluate/)
    assert.match(browserSpecSource, /expect\(detailOverflow\)\.toBe\(false\)/)
  })

  it("covers the disposable Admin temporary-access journey at every configured desktop and mobile project", () => {
    assert.match(browserSpecSource, /Temporary feature access/)
    assert.match(browserSpecSource, /Premium backgrounds/)
    assert.match(browserSpecSource, /for \(const days of \[7, 30, 90\]\)/)
    assert.match(browserSpecSource, /name: `\$\{days\} days`/)
    assert.match(browserSpecSource, /Custom duration/)
    assert.match(browserSpecSource, /Starts/)
    assert.match(browserSpecSource, /Expires/)
    assert.match(browserSpecSource, /chimer_custom_colors/)
    assert.match(browserSpecSource, /practice_management/)
    assert.match(browserSpecSource, /calendar_team_scheduling/)
    assert.match(browserSpecSource, /cloud_storage/)
    assert.match(browserSpecSource, /phi_storage_tools/)
    assert.match(browserSpecSource, /Temporary feature access granted/)
    assert.match(browserSpecSource, /Temporary feature access revoked/)
    assert.match(browserSpecSource, /\/account\?tab=membership/)
    assert.match(browserSpecSource, /installSignedInSessionCookie/)
    assert.match(browserSpecSource, /time\[data-temporary-evidence="starts"\]/)
    assert.match(browserSpecSource, /time\[data-temporary-evidence="expires"\]/)
    assert.doesNotMatch(browserSpecSource, /persistedTimestamps\.nth\([01]\)/)
    assert.match(browserSpecSource, /new Date\(persistedExpiresAt\)\.getTime\(\) - new Date\(persistedStartsAt\)\.getTime\(\)/)
    assert.match(browserSpecSource, /accountTemporaryAccess\)\.toContainText\(persistedExpiresAt\.slice\(0, 10\)\)/)
    assert.match(browserSpecSource, /\[data-account-temporary-access="active"\]/)
    assert.doesNotMatch(browserSpecSource, /getByRole\("heading", \{ name: "Temporary feature access" \}\)\.locator\("\.\."\)/)
    assert.doesNotMatch(browserSpecSource, /time\[datetime=.*\$\{expiresAt\}/)
  })

  it("removes only a project's provisioning rows in FK-safe order before its exact users", async () => {
    const calls = []
    await removeBrowserAdminFixtureRecords({
      prismaClient: cleanupPrisma(calls),
      projectName: "desktop-chromium",
      environment: { DATABASE_URL: "postgresql://example.test/not-a-real-database", MASSAGELAB_BROWSER_QA_DATABASE: "1" },
    })

    const ids = ["browser-admin-operator-desktop-chromium", "browser-admin-target-desktop-chromium"]
    assert.deepEqual(calls, [
      ["temporaryFeatureGrantRevocation.deleteMany", { where: { OR: [
        { revokedById: { in: ids } },
        { grant: { is: { OR: [{ userId: { in: ids } }, { grantedById: { in: ids } }] } } },
      ] } }],
      ["temporaryFeatureGrant.deleteMany", { where: { OR: [
        { userId: { in: ids } },
        { grantedById: { in: ids } },
      ] } }],
      ["adminEmailIntent.deleteMany", { where: { userId: { in: ids } } }],
      ["userAccountActivity.deleteMany", { where: { userId: { in: ids } } }],
      ["adminAction.deleteMany", { where: { OR: [{ actorUserId: { in: ids } }, { targetUserId: { in: ids } }] } }],
      ["passwordResetToken.deleteMany", { where: { userId: { in: ids } } }],
      ["backupCode.deleteMany", { where: { userId: { in: ids } } }],
      ["twoFactorSecret.deleteMany", { where: { userId: { in: ids } } }],
      ["passwordCredential.deleteMany", { where: { userId: { in: ids } } }],
      ["session.deleteMany", { where: { userId: { in: ids } } }],
      ["userRole.deleteMany", { where: { userId: { in: ids } } }],
      ["commerceEvent.deleteMany", { where: { userId: { in: ids } } }],
      ["backgroundCreditEntry.deleteMany", { where: { userId: { in: ids } } }],
      ["backgroundCreditWallet.deleteMany", { where: { userId: { in: ids } } }],
      ["user.deleteMany", { where: { id: { in: ids } } }],
    ])
  })

  it("serializes QA fixture creation before provisioning the verified operator", async () => {
    const calls = []
    const identity = createBrowserAdminFixtureIdentity("desktop-chromium")
    await createBrowserAdminFixtureRecords({
      prismaClient: provisioningPrisma(calls),
      identity,
      environment: { DATABASE_URL: "postgresql://example.test/not-a-real-database", MASSAGELAB_BROWSER_QA_DATABASE: "1" },
      provisionCredits: async (_prismaClient, userId) => { calls.push(["ensureVerifiedUserBackgroundCredits", userId]) },
    })

    assert.deepEqual(calls, [
      ["prisma.$transaction", undefined],
      ["tx.$executeRaw", "SELECT pg_advisory_xact_lock(?, ?)", [...BROWSER_ADMIN_FIXTURE_ADVISORY_LOCK]],
      ["user.create", identity.operator.id],
      ["user.create", identity.target.id],
      ["stripeCustomer.create", {
        userId: identity.target.id,
        stripeCustomerId: `cus_browser${identity.projectSlug}`,
      }],
      ["membershipSubscription.create", {
        userId: identity.target.id,
        stripeSubscriptionId: `sub_browser${identity.projectSlug}`,
        stripeCustomerId: `cus_browser${identity.projectSlug}`,
        status: "active",
        membershipLevel: "SUPPORTER",
      }],
      ["ensureVerifiedUserBackgroundCredits", identity.operator.id],
    ])
  })
})

function cleanupPrisma(calls) {
  return Object.fromEntries([
    "temporaryFeatureGrantRevocation", "temporaryFeatureGrant",
    "adminEmailIntent", "userAccountActivity", "adminAction", "session", "userRole",
    "passwordResetToken", "backupCode", "twoFactorSecret", "passwordCredential",
    "commerceEvent", "backgroundCreditEntry", "backgroundCreditWallet", "user",
  ].map((model) => [model, {
    deleteMany: async (args) => { calls.push([`${model}.deleteMany`, args]); return { count: 0 } },
  }]))
}

function provisioningPrisma(calls) {
  const transaction = {
    $executeRaw: async (strings, ...values) => { calls.push(["tx.$executeRaw", strings.join("?"), values]) },
    user: { create: async ({ data }) => {
      if (data.id.includes("-target-")) {
        assert.equal(data.passwordCredential?.create?.passwordHash, "browser-fixture-password-hash-not-for-authentication")
        assert.equal(data.twoFactorSecret?.create?.encryptedSecret, "browser-fixture-encrypted-secret-not-for-authentication")
        assert.ok(data.twoFactorSecret.create.enabledAt instanceof Date)
        assert.deepEqual(data.backupCodes?.create, [{ codeHash: "browser-fixture-backup-hash-not-for-authentication" }])
        assert.equal(data.sessions?.create?.length, 1)
        assert.equal(data.sessions.create[0].sessionToken, `browser-fixture-adapter-session-${data.id}`)
        assert.equal(data.sessions.create[0].expires.toISOString(), "2099-01-01T00:00:00.000Z")
      }
      calls.push(["user.create", data.id])
    } },
    stripeCustomer: { create: async ({ data }) => { calls.push(["stripeCustomer.create", data]) } },
    membershipSubscription: { create: async ({ data }) => { calls.push(["membershipSubscription.create", data]) } },
  }
  return {
    $transaction: async (callback, options) => {
      calls.push(["prisma.$transaction", options])
      return callback(transaction)
    },
  }
}
