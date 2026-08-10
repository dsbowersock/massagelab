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
    const mobile = createBrowserAdminFixtureIdentity("mobile-chromium")

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

  it("removes only a project's provisioning rows in FK-safe order before its exact users", async () => {
    const calls = []
    await removeBrowserAdminFixtureRecords({
      prismaClient: cleanupPrisma(calls),
      projectName: "desktop-chromium",
      environment: { DATABASE_URL: "postgresql://example.test/not-a-real-database", MASSAGELAB_BROWSER_QA_DATABASE: "1" },
    })

    const ids = ["browser-admin-operator-desktop-chromium", "browser-admin-target-desktop-chromium"]
    assert.deepEqual(calls, [
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
      ["ensureVerifiedUserBackgroundCredits", identity.operator.id],
    ])
  })
})

function cleanupPrisma(calls) {
  return Object.fromEntries([
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
  }
  return {
    $transaction: async (callback, options) => {
      calls.push(["prisma.$transaction", options])
      return callback(transaction)
    },
  }
}
