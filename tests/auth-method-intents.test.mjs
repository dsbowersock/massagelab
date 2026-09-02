import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"
import { consumeFreshGoogleReauth, isFreshConsumedGoogleReauth } from "../lib/auth-method-intent-proof.ts"
import {
  noStoreJsonHeaders,
  parseBoundedAccountSecurityJson,
  validateTrustedAccountSecurityJson,
} from "../lib/account-security-request.ts"
import { runCommerceTransaction } from "../lib/commerce/transactions.ts"
import { buildRegistrationLegalProviderRedirectPath } from "../lib/legal-acceptance-gate.js"
import { isGoogleIdentityUniqueConstraint } from "../lib/prisma-identity-unique-constraint.ts"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const EXPECTED_SESSION_BOUND_PURPOSES = [
  "LINK_GOOGLE",
  "ADD_PASSWORD",
  "REMOVE_PASSWORD",
  "ENROLL_TWO_FACTOR",
  "DISABLE_TWO_FACTOR",
  "REGENERATE_TWO_FACTOR_BACKUP_CODES",
]

async function loadService({
  provisionCredits = async () => ({ balance: 2, granted: true }),
  registrationOpen = true,
} = {}) {
  const source = await readFile(new URL("../lib/auth-method-intents.ts", import.meta.url), "utf8")
  return loadCompiledModule(source, "auth-method-intents.test.ts", {
    "@/lib/auth-env": { getAuthSecret: () => "intent-test-secret" },
    "@/lib/auth-security": { normalizeEmail: (value) => typeof value === "string" ? value.trim().toLowerCase() : "" },
    "@/lib/auth-users": { ensureUserRole: async () => "USER" },
    "@/lib/commerce/credit-service": { ensureVerifiedUserBackgroundCredits: provisionCredits },
    "@/lib/commerce/transactions": { runCommerceTransaction },
    "@/lib/legal-acceptance-gate": { buildRegistrationLegalProviderRedirectPath },
    "@/lib/normalized-user-email": {
      resolveNormalizedUserId: async ({ prismaClient, email }) => prismaClient.resolveNormalizedUserId(email),
    },
    "@/lib/prisma-identity-unique-constraint": { isGoogleIdentityUniqueConstraint },
    "@/lib/public-launch-controls": {
      getPublicLaunchControls: () => ({ registrationOpen, supporterCheckoutOpen: true }),
    },
    "@/lib/prisma": { prisma: {} },
  })
}

const { SESSION_BOUND_PURPOSES } = await loadService()

async function loadAccountSecurityMethods() {
  const source = await readFile(new URL("../lib/account-security-methods.ts", import.meta.url), "utf8")
  return loadCompiledModule(source, "account-security-methods.integration.test.ts", {
    "./auth-env.ts": { getAuthSecret: () => "intent-test-secret" },
    "./auth-method-intent-proof.ts": { consumeFreshGoogleReauth, isFreshConsumedGoogleReauth },
    "./auth-security.js": {
      hashPassword: async () => "hash",
      normalizeEmail: (value) => typeof value === "string" ? value.trim().toLowerCase() : "",
    },
    "./commerce/transactions.ts": { runCommerceTransaction },
    "./prisma.ts": { prisma: {} },
    "./account-security-email-intents.ts": {
      queueAccountSecurityEmail: (tx, input) => tx.accountSecurityEmailIntent.upsert({
        where: { idempotencyKey: input.idempotencyKey },
        create: { ...input, subject: "fixed subject", message: "fixed message" },
        update: {},
        select: { id: true },
      }),
    },
  })
}

describe("private Google auth-method intents", () => {
  it("publishes the exact frozen ordered session-bound purpose list", () => {
    assert.equal(Object.isFrozen(SESSION_BOUND_PURPOSES), true)
    assert.deepEqual(SESSION_BOUND_PURPOSES, EXPECTED_SESSION_BOUND_PURPOSES)
  })

  it("rejects hostile prototype property names as Google intent purposes", async () => {
    const service = await loadService()

    for (const purpose of ["constructor", "__proto__"]) {
      assert.equal(service.isSessionBoundGoogleIntentPurpose(purpose), false, purpose)
      assert.equal(service.isGoogleIntentPurpose(purpose), false, purpose)
    }
  })

  it("creates browser-bound single-use intent material without persisting its token", async () => {
    const service = await loadService()
    const db = createIntentDatabase()
    const started = await service.startAuthMethodIntent({
      prismaClient: db,
      purpose: "SIGN_IN_OR_LINK",
      secret: "intent-test-secret",
      now: new Date("2026-08-28T12:00:00.000Z"),
      randomBytesFn: () => Buffer.alloc(32, 7),
    })
    assert.equal(started.browserBindingToken, Buffer.alloc(32, 7).toString("base64url"))
    assert.equal(started.expiresAt.toISOString(), "2026-08-28T12:10:00.000Z")
    assert.equal(db.state.intents.length, 1)
    assert.notEqual(db.state.intents[0].browserBindingHash, started.browserBindingToken)
    assert.equal(JSON.stringify(db.state.intents).includes(started.browserBindingToken), false)
  })

  it("returns a committed intent when best-effort stale pruning fails", async () => {
    const service = await loadService()
    const db = createIntentDatabase({ pruneError: new Error("prune unavailable") })

    const started = await service.startAuthMethodIntent({
      prismaClient: db,
      purpose: "SIGN_IN_OR_LINK",
      secret: "intent-test-secret",
      now: new Date("2026-08-28T12:00:00.000Z"),
      randomBytesFn: () => Buffer.alloc(32, 9),
    })

    assert.equal(started.intentId, "intent-1")
    assert.equal(db.state.intents.length, 1)
  })

  it("persists only a rebuilt, bounded registration callback path", async () => {
    const service = await loadService()

    for (const [label, callbackPath] of [
      ["absolute URL", "https://attacker.example/steal"],
      ["oversized path", `/${"a".repeat(3_000)}`],
    ]) {
      const db = createIntentDatabase()
      const started = await service.startAuthMethodIntent({
        prismaClient: db,
        purpose: "SIGN_IN_OR_LINK",
        callbackPath,
        secret: "intent-test-secret",
        now: new Date("2026-08-28T12:00:00.000Z"),
      })
      assert.equal(
        db.intent(started.intentId).callbackPath,
        "/legal/accept?callbackUrl=%2Fonboarding",
        label,
      )
      assert.ok(db.intent(started.intentId).callbackPath.length <= 2048, label)
    }
  })

  it("prunes expired intents without deleting fresh consumed security reauthentication", async () => {
    const service = await loadService()
    const now = new Date("2026-08-28T12:00:00.000Z")
    const db = createIntentDatabase({
      intents: [
        {
          id: "expired-intent",
          purpose: "SIGN_IN_OR_LINK",
          provider: "google",
          status: "PENDING",
          consumedAt: null,
          expiresAt: new Date("2026-08-28T11:59:59.000Z"),
          updatedAt: new Date("2026-08-28T11:50:00.000Z"),
        },
        {
          id: "fresh-consumed-reauth",
          purpose: "ADD_PASSWORD",
          targetUserId: "user-1",
          provider: "google",
          providerAccountId: "sub-a",
          providerProvenAt: new Date("2026-08-28T11:59:30.000Z"),
          status: "CONSUMED",
          consumedAt: new Date("2026-08-28T11:59:30.000Z"),
          expiresAt: new Date("2026-08-28T12:09:30.000Z"),
          updatedAt: new Date("2026-08-28T11:59:30.000Z"),
        },
      ],
    })

    await service.startAuthMethodIntent({
      prismaClient: db,
      purpose: "SIGN_IN_OR_LINK",
      secret: "intent-test-secret",
      now,
      randomBytesFn: () => Buffer.alloc(32, 11),
    })

    assert.equal(db.intent("expired-intent"), undefined)
    assert.equal(db.intent("fresh-consumed-reauth")?.providerProvenAt.toISOString(), "2026-08-28T11:59:30.000Z")
  })

  it("resolves only the exact browser-bound intent and returns no provider proof fields", async () => {
    const service = await loadService()
    const db = createIntentDatabase()
    const started = await start(service, db)
    Object.assign(db.intent(started.intentId), {
      targetUserId: "user-1",
      status: "PROVIDER_PROVEN",
      providerAccountId: "private-provider-id",
      providerEmailHash: "a".repeat(64),
    })
    const exact = await service.resolveBoundAuthMethodIntent({
      prismaClient: db,
      cookieValue: service.serializeAuthMethodIntentBinding(started.intentId, started.browserBindingToken),
      purpose: "SIGN_IN_OR_LINK",
      status: "PROVIDER_PROVEN",
      secret: "intent-test-secret",
      now: new Date("2026-08-28T12:00:00.000Z"),
    })
    assert.deepEqual(exact, { id: started.intentId, targetUserId: "user-1" })
    assert.equal(JSON.stringify(exact).includes("private-provider-id"), false)

    db.intent(started.intentId).consumedAt = new Date("2026-08-28T11:59:00.000Z")
    const alreadyConsumed = await service.resolveBoundAuthMethodIntent({
      prismaClient: db,
      cookieValue: service.serializeAuthMethodIntentBinding(started.intentId, started.browserBindingToken),
      purpose: "SIGN_IN_OR_LINK",
      status: "PROVIDER_PROVEN",
      secret: "intent-test-secret",
      now: new Date("2026-08-28T12:00:00.000Z"),
    })
    assert.equal(alreadyConsumed, null)
    db.intent(started.intentId).consumedAt = null

    const wrongBrowser = await service.resolveBoundAuthMethodIntent({
      prismaClient: db,
      cookieValue: service.serializeAuthMethodIntentBinding(started.intentId, "b".repeat(43)),
      purpose: "SIGN_IN_OR_LINK",
      status: "PROVIDER_PROVEN",
      secret: "intent-test-secret",
      now: new Date("2026-08-28T12:00:00.000Z"),
    })
    assert.equal(wrongBrowser, null)
  })

  it("requires target users for account-security purposes", async () => {
    const service = await loadService()
    for (const purpose of SESSION_BOUND_PURPOSES) {
      await assert.rejects(
        service.startAuthMethodIntent({ prismaClient: createIntentDatabase(), purpose, secret: "intent-test-secret" }),
        /target user/i,
      )
    }
  })

  it("rejects missing, wrong-browser, expired, consumed, and unverified proofs with fixed paths", async () => {
    const service = await loadService()
    const db = createIntentDatabase()
    const missing = await service.prepareGoogleAuthentication(googleInput(db, "person@example.com", "sub-a", {
      intentId: "missing",
      browserBindingToken: "missing",
    }))
    assert.deepEqual(missing, { kind: "REJECTED", recoveryPath: "/login?auth=google-retry" })

    const started = await start(service, db)
    assert.deepEqual(
      await service.prepareGoogleAuthentication(googleInput(db, "person@example.com", "sub-a", {
        ...started,
        browserBindingToken: "other-browser",
      })),
      { kind: "REJECTED", recoveryPath: "/login?auth=google-retry" },
    )
    db.intent(started.intentId).expiresAt = new Date("2026-08-28T11:59:59.000Z")
    assert.equal((await service.prepareGoogleAuthentication(googleInput(db, "person@example.com", "sub-a", started))).kind, "REJECTED")

    const unverified = await start(service, db)
    assert.deepEqual(
      await service.prepareGoogleAuthentication({
        ...googleInput(db, "person@example.com", "sub-a", unverified),
        profile: { email: "person@example.com", email_verified: false },
      }),
      { kind: "REJECTED", recoveryPath: "/login?auth=google-unavailable" },
    )
  })

  it("defaults registration open and creates the first normalized Google user, minimal account, profile, and consumes once", async () => {
    const service = await loadService()
    const db = createIntentDatabase()
    const started = await start(service, db)
    const input = googleInput(db, " Family@Example.com ", "google-sub-a", started)
    input.account.access_token = "must-not-store"
    input.account.refresh_token = "must-not-store"
    input.account.id_token = "must-not-store"
    const result = await service.prepareGoogleAuthentication(input)
    assert.equal(result.kind, "CONTINUE")
    assert.equal(result.created, true)
    assert.equal(db.state.users[0].email, "family@example.com")
    assert.equal(db.state.users[0].profile.create.displayName, "Family Person")
    assert.deepEqual(db.state.accounts[0], {
      id: "account-1", userId: result.userId, type: "oauth", provider: "google", providerAccountId: "google-sub-a",
    })
    assert.equal(db.intent(started.intentId).status, "CONSUMED")
    assert.equal((await service.prepareGoogleAuthentication(input)).kind, "REJECTED")
    assert.equal(db.intentConsumeWins(started.intentId), 1)
  })

  it("keeps existing Google-provider sign-in available while public registration is paused", async () => {
    const provisionedUserIds = []
    const service = await loadService({
      registrationOpen: false,
      provisionCredits: async (_database, userId) => {
        provisionedUserIds.push(userId)
        return { balance: 2, granted: true }
      },
    })
    const db = createIntentDatabase({
      users: [{ id: "existing-google-user", email: "existing@example.com", emailVerified: new Date() }],
      accounts: [{
        id: "existing-google-account",
        userId: "existing-google-user",
        type: "oauth",
        provider: "google",
        providerAccountId: "existing-google-sub",
      }],
    })
    const intent = await start(service, db, "SIGN_IN_OR_LINK", undefined, "/clock?panel=background")

    const result = await service.prepareGoogleAuthentication(
      googleInput(db, "existing@example.com", "existing-google-sub", intent),
    )

    assert.deepEqual(result, { kind: "CONTINUE", userId: "existing-google-user" })
    assert.equal(db.intent(intent.intentId).status, "CONSUMED")
    assert.deepEqual(provisionedUserIds, [])
  })

  it("keeps matching-email Google proof available for same-account linking while registration is paused", async () => {
    const service = await loadService({ registrationOpen: false })
    const db = createIntentDatabase({
      users: [{ id: "password-user", email: " Family@Example.com ", emailVerified: new Date() }],
    })
    const intent = await start(service, db, "SIGN_IN_OR_LINK", undefined, "/clock?panel=background")

    const result = await service.prepareGoogleAuthentication(
      googleInput(db, "family@example.com", "new-google-sub", intent),
    )

    assert.deepEqual(result, { kind: "LINK_REQUIRED", userId: "password-user" })
    assert.equal(db.state.users.length, 1)
    assert.equal(db.state.accounts.length, 0)
    assert.equal(db.intent(intent.intentId).status, "PROVIDER_PROVEN")
  })

  it("rejects only a brand-new Google identity while registration is paused before creation or provisioning", async () => {
    let roleCalls = 0
    const provisionedUserIds = []
    const service = await loadService({
      registrationOpen: false,
      provisionCredits: async (_database, userId) => {
        provisionedUserIds.push(userId)
        return { balance: 2, granted: true }
      },
    })
    const db = createIntentDatabase()
    const intent = await start(service, db, "SIGN_IN_OR_LINK", undefined, "/clock?panel=background")

    const result = await service.prepareGoogleAuthentication({
      ...googleInput(db, "brand-new@example.com", "brand-new-google-sub", intent),
      ensureRole: async () => {
        roleCalls += 1
        return "USER"
      },
    })

    assert.deepEqual(result, {
      kind: "REGISTRATION_PAUSED",
      callbackPath: "/legal/accept?callbackUrl=%2Fclock%3Fpanel%3Dbackground",
    })
    assert.equal((await service.prepareGoogleAuthentication(
      googleInput(db, "brand-new@example.com", "brand-new-google-sub", intent),
    )).kind, "REJECTED")
    assert.equal(db.state.users.length, 0)
    assert.equal(db.state.accounts.length, 0)
    assert.equal(db.intent(intent.intentId).status, "CONSUMED")
    assert.equal(db.intentConsumeWins(intent.intentId), 1)
    assert.equal(roleCalls, 0)
    assert.deepEqual(provisionedUserIds, [])
  })

  it("returns the normal rejection when paused registration intent consumption loses its CAS", async () => {
    const service = await loadService({ registrationOpen: false })
    const db = createIntentDatabase({ consumeLoss: true })
    const intent = await start(service, db)

    assert.deepEqual(
      await service.prepareGoogleAuthentication(
        googleInput(db, "brand-new@example.com", "brand-new-google-sub", intent),
      ),
      { kind: "REJECTED", recoveryPath: "/login?auth=google-retry" },
    )
    assert.equal(db.intent(intent.intentId).status, "PENDING")
    assert.equal(db.intentConsumeWins(intent.intentId), 0)
    assert.equal(db.state.users.length, 0)
    assert.equal(db.state.accounts.length, 0)
  })

  it("provisions initial credits once only for a durably-created Google user", async () => {
    const provisionedUserIds = []
    const service = await loadService({
      provisionCredits: async (_database, userId) => {
        provisionedUserIds.push(userId)
        return { balance: 2, granted: true }
      },
    })
    const newUserDb = createIntentDatabase()
    const newUserIntent = await start(service, newUserDb)
    const created = await service.prepareGoogleAuthentication(
      googleInput(newUserDb, "new-google-user@example.com", "google-new", newUserIntent),
    )

    const linkedDb = createIntentDatabase({
      users: [{ id: "linked-user", email: "linked@example.com", emailVerified: new Date() }],
      accounts: [{ id: "linked-account", userId: "linked-user", type: "oauth", provider: "google", providerAccountId: "google-linked" }],
    })
    const linkedIntent = await start(service, linkedDb)
    const repeated = await service.prepareGoogleAuthentication(
      googleInput(linkedDb, "linked@example.com", "google-linked", linkedIntent),
    )

    assert.equal(created.created, true)
    assert.deepEqual(provisionedUserIds, [created.userId])
    assert.deepEqual(repeated, { kind: "CONTINUE", userId: "linked-user" })
  })

  it("keeps a newly created Google identity valid when initial credit provisioning is deferred", async () => {
    const service = await loadService({
      provisionCredits: async () => {
        throw new Error("private provider and account details")
      },
    })
    const db = createIntentDatabase()
    const intent = await start(service, db)
    const logs = []
    const originalConsoleError = console.error
    console.error = (...fields) => logs.push(fields.join(" "))

    try {
      const result = await service.prepareGoogleAuthentication(
        googleInput(db, "durable@example.com", "google-durable", intent),
      )

      assert.equal(result.created, true)
      assert.equal(db.state.users.some(({ id }) => id === result.userId), true)
      assert.equal(db.intent(intent.intentId).status, "CONSUMED")
      assert.deepEqual(logs, ["Background credit provisioning deferred after Google account creation."])
    } finally {
      console.error = originalConsoleError
    }
  })

  it("returns LINK_REQUIRED for a padded mixed-case stored password account without duplicate creation or retry", async () => {
    const service = await loadService()
    const db = createIntentDatabase({ users: [{ id: "password-user", email: " Family@Example.com ", emailVerified: new Date() }] })
    const started = await start(service, db)
    const result = await service.prepareGoogleAuthentication(googleInput(db, " Family@Example.com ", "google-sub-a", started))
    assert.deepEqual(result, { kind: "LINK_REQUIRED", userId: "password-user" })
    assert.equal(db.state.accounts.length, 0)
    assert.equal(db.intent(started.intentId).status, "PROVIDER_PROVEN")
    assert.equal(db.intent(started.intentId).targetUserId, "password-user")
    assert.match(db.intent(started.intentId).providerEmailHash, /^[a-f0-9]{64}$/)
    assert.equal(JSON.stringify(db.state.intents).includes("family@example.com"), false)
    assert.deepEqual(db.normalizedLookups, ["family@example.com"])
    assert.equal(db.rawEmailLookups, 0)
    assert.equal(db.identityUniqueConflicts, 0)
  })

  it("feeds a real Task 3 provider-proven intent into matching-account confirmation", async () => {
    const intentService = await loadService()
    const methodService = await loadAccountSecurityMethods()
    const db = createIntentDatabase({
      users: [{
        id: "password-user",
        email: "family@example.com",
        emailVerified: new Date("2026-08-28T11:00:00.000Z"),
        authSessionVersion: 0,
        passwordCredential: { id: "password-1", userId: "password-user", passwordHash: "opaque-hash" },
      }],
    })
    const started = await start(intentService, db)
    const produced = await intentService.prepareGoogleAuthentication(
      googleInput(db, " Family@Example.com ", "google-sub-a", started),
    )
    assert.deepEqual(produced, { kind: "LINK_REQUIRED", userId: "password-user" })

    const confirmed = await methodService.confirmGoogleLink({
      prismaClient: db,
      intentId: started.intentId,
      sessionUserId: "password-user",
      lastPasswordAuthenticatedAt: new Date("2026-08-28T12:00:00.000Z").getTime(),
      confirmed: true,
      secret: "intent-test-secret",
      now: new Date("2026-08-28T12:00:00.000Z"),
    })

    assert.equal(confirmed.status, "UPDATED")
    assert.equal(db.intent(started.intentId).status, "CONSUMED")
    assert.equal(db.accountsByProviderId("google", "google-sub-a").length, 1)
    assert.equal(db.state.securityEmails.length, 1)
  })

  it("continues an already linked normalized identity and rejects a provider attached elsewhere", async () => {
    const service = await loadService()
    const linkedDb = createIntentDatabase({
      users: [{ id: "user-1", email: "family@example.com", emailVerified: new Date() }],
      accounts: [{ id: "account-1", userId: "user-1", type: "oauth", provider: "google", providerAccountId: "sub-a" }],
    })
    const linkedIntent = await start(service, linkedDb)
    assert.equal((await service.prepareGoogleAuthentication(googleInput(linkedDb, "family@example.com", "sub-a", linkedIntent))).kind, "CONTINUE")

    const conflictDb = createIntentDatabase({
      users: [
        { id: "user-1", email: "family@example.com", emailVerified: new Date() },
        { id: "user-2", email: "other@example.com", emailVerified: new Date() },
      ],
      accounts: [{ id: "account-1", userId: "user-2", type: "oauth", provider: "google", providerAccountId: "sub-a" }],
    })
    const conflictIntent = await start(service, conflictDb)
    assert.equal((await service.prepareGoogleAuthentication(googleInput(conflictDb, "family@example.com", "sub-a", conflictIntent))).kind, "REJECTED")
    assert.equal(conflictDb.intent(conflictIntent.intentId).status, "PENDING")
  })

  it("requires an exact current session, email, and linked provider for security reauth", async () => {
    const service = await loadService()
    const db = createIntentDatabase({
      users: [{ id: "user-1", email: "family@example.com", emailVerified: new Date() }],
      accounts: [{ id: "account-1", userId: "user-1", type: "oauth", provider: "google", providerAccountId: "sub-a" }],
    })
    const started = await start(service, db, "LINK_GOOGLE", "user-1")
    const result = await service.prepareGoogleAuthentication({
      ...googleInput(db, "family@example.com", "sub-a", started),
      currentSessionUser: { id: "user-1", email: "family@example.com" },
    })
    assert.deepEqual(result, { kind: "REAUTH_COMPLETE", purpose: "LINK_GOOGLE", userId: "user-1" })

    const rejected = await start(service, db, "REMOVE_PASSWORD", "user-1")
    assert.deepEqual(
      await service.prepareGoogleAuthentication({ ...googleInput(db, "family@example.com", "sub-a", rejected), currentSessionUser: null }),
      { kind: "REJECTED", recoveryPath: "/account?tab=security&auth=google-retry" },
    )
  })

  it("rejects signed-in account A choosing Google B before any identity or intent write", async () => {
    const service = await loadService()
    for (const scenario of [
      {
        label: "would continue another user's linked provider",
        users: [
          { id: "user-a", email: "account-a@example.com", emailVerified: new Date() },
          { id: "user-b", email: "account-b@example.com", emailVerified: new Date() },
        ],
        accounts: [{ id: "account-b", userId: "user-b", type: "oauth", provider: "google", providerAccountId: "google-b" }],
        googleEmail: "account-b@example.com",
        providerAccountId: "google-b",
      },
      {
        label: "would request linking to another password account",
        users: [
          { id: "user-a", email: "account-a@example.com", emailVerified: new Date() },
          { id: "user-b", email: "account-b@example.com", emailVerified: new Date() },
        ],
        accounts: [],
        googleEmail: "account-b@example.com",
        providerAccountId: "google-b",
      },
      {
        label: "would create a new Google user and account",
        users: [{ id: "user-a", email: "account-a@example.com", emailVerified: new Date() }],
        accounts: [],
        googleEmail: "new-google@example.com",
        providerAccountId: "google-new",
      },
    ]) {
      const db = createIntentDatabase({ users: scenario.users, accounts: scenario.accounts })
      const intent = await start(service, db)
      const before = structuredClone(db.state)
      const result = await service.prepareGoogleAuthentication({
        ...googleInput(db, scenario.googleEmail, scenario.providerAccountId, intent),
        currentSessionUser: { id: "user-a", email: "account-a@example.com" },
      })
      assert.deepEqual(
        result,
        { kind: "REJECTED", recoveryPath: "/account?tab=security&auth=google-retry" },
        scenario.label,
      )
      assert.deepEqual(db.state, before, scenario.label)
      assert.equal(db.intent(intent.intentId).status, "PENDING", scenario.label)
    }
  })

  it("accepts two distinct first-use intents as one user/account and enforces same-intent single use", async () => {
    const service = await loadService()
    const db = createIntentDatabase()
    const first = await start(service, db)
    const second = await start(service, db)
    const results = await Promise.all([
      service.prepareGoogleAuthentication(googleInput(db, " Family@Example.com ", "google-sub-a", first)),
      service.prepareGoogleAuthentication(googleInput(db, "family@example.com", "google-sub-a", second)),
    ])
    assert.equal(db.usersByNormalizedEmail("family@example.com").length, 1)
    assert.equal(db.accountsByProviderId("google", "google-sub-a").length, 1)
    assert.deepEqual(results.map((result) => result.kind).sort(), ["CONTINUE", "CONTINUE"])
    assert.ok(db.serializationConflicts >= 1)
    assert.equal(db.transactionOptions.every((options) => options?.isolationLevel === "Serializable"), true)

    const same = await start(service, db)
    const sameInput = googleInput(db, "other@example.com", "google-sub-b", same)
    const sameResults = await Promise.all([
      service.prepareGoogleAuthentication(sameInput),
      service.prepareGoogleAuthentication(sameInput),
    ])
    assert.deepEqual(sameResults.map((result) => result.kind).sort(), ["CONTINUE", "REJECTED"])
    assert.equal(db.intentConsumeWins(same.intentId), 1)
    assert.ok(db.serializationConflicts >= 2)
  })

  it("re-resolves to LINK_REQUIRED when a password user wins between read and create", async () => {
    const service = await loadService()
    let inserted = false
    const db = createIntentDatabase({
      beforeUserCreate(state) {
        if (inserted) return
        inserted = true
        state.users.push({ id: "password-winner", email: "family@example.com", emailVerified: new Date() })
      },
    })
    const intent = await start(service, db)
    const result = await service.prepareGoogleAuthentication(googleInput(db, "family@example.com", "sub-race", intent))
    assert.deepEqual(result, { kind: "LINK_REQUIRED", userId: "password-winner" })
    assert.equal(db.state.users.length, 1)
    assert.equal(db.state.accounts.length, 0)
    assert.equal(db.intent(intent.intentId).status, "PROVIDER_PROVEN")
    assert.equal(db.identityUniqueConflicts, 1)
    assert.equal(db.rolledBackTransactions >= 1, true)
  })

  for (const scenario of [
    {
      name: "installed-adapter User email constraint",
      constraint: { fields: ["email"] },
      expectedKind: "LINK_REQUIRED",
      beforeUserCreate(state) {
        state.users.push({ id: "password-winner", email: "family@example.com", emailVerified: new Date() })
      },
    },
    {
      name: "installed-adapter functional User email constraint",
      constraint: { fields: ["lower(btrim(email"] },
      expectedKind: "LINK_REQUIRED",
      beforeUserCreate(state) {
        state.users.push({ id: "password-winner", email: "family@example.com", emailVerified: new Date() })
      },
    },
    {
      name: "real Account provider constraint name",
      constraint: { index: "Account_provider_providerAccountId_key" },
      expectedKind: "CONTINUE",
      beforeUserCreate(state) {
        state.users.push({ id: "google-winner", email: "family@example.com", emailVerified: new Date() })
        state.accounts.push({ id: "account-winner", userId: "google-winner", type: "oauth", provider: "google", providerAccountId: "sub-race" })
      },
    },
    {
      name: "installed-adapter Account provider fields",
      constraint: { fields: ["provider", "providerAccountId"] },
      expectedKind: "CONTINUE",
      beforeUserCreate(state) {
        state.users.push({ id: "google-winner", email: "family@example.com", emailVerified: new Date() })
        state.accounts.push({ id: "account-winner", userId: "google-winner", type: "oauth", provider: "google", providerAccountId: "sub-race" })
      },
    },
  ]) {
    it(`retries a production-shaped ${scenario.name} race`, async () => {
      const service = await loadService()
      let inserted = false
      const db = createIntentDatabase({
        identityUniqueError: driverAdapterUniqueError(scenario.constraint),
        beforeUserCreate(state) {
          if (inserted) return
          inserted = true
          scenario.beforeUserCreate(state)
        },
      })
      const intent = await start(service, db)
      const result = await service.prepareGoogleAuthentication(googleInput(db, "family@example.com", "sub-race", intent))

      assert.equal(result.kind, scenario.expectedKind)
      assert.equal(db.identityUniqueConflicts, 1)
    })
  }

  it("returns exact private cookie options in development and production", async () => {
    const routeSource = await readFile(new URL("../app/api/auth/google/intent/route.ts", import.meta.url), "utf8")
    assert.match(routeSource, /"Retry-After"/)
    assert.doesNotMatch(routeSource, /access_token|refresh_token|id_token/)

    const { POST } = await loadIntentRoute()
    const previousNodeEnvironment = process.env.NODE_ENV
    try {
      for (const [nodeEnvironment, secure] of [["development", false], ["production", true]]) {
        process.env.NODE_ENV = nodeEnvironment
        const response = await POST(intentRequest({
          purpose: "SIGN_IN_OR_LINK",
          callbackUrl: "/wellness",
        }))
        assert.deepEqual(response.cookieSet, {
          name: "ml-auth-method-binding",
          value: `default-intent.${"a".repeat(43)}`,
          options: {
            httpOnly: true,
            sameSite: "lax",
            maxAge: 600,
            secure,
            path: "/",
          },
        }, nodeEnvironment)
      }
    } finally {
      if (previousNodeEnvironment === undefined) delete process.env.NODE_ENV
      else process.env.NODE_ENV = previousNodeEnvironment
    }
  })

  it("accepts network start thirty, blocks thirty-one before creation, and returns exact Retry-After", async () => {
    const { createGoogleIntentHandler } = await loadIntentRoute()
    let consumed = 0
    let created = 0
    const handler = createGoogleIntentHandler({
      prismaClient: {},
      secret: "intent-test-secret",
      getSession: async () => null,
      consumeLimit: async () => (++consumed <= 30 ? { allowed: true } : { allowed: false, retryAfterSeconds: 419 }),
      startIntent: async (input) => {
        created += 1
        assert.equal(Object.hasOwn(input, "networkIdentifier"), false)
        return { intentId: `intent-${created}`, browserBindingToken: "a".repeat(43), expiresAt: new Date() }
      },
    })

    let response
    for (let index = 0; index < 31; index += 1) {
      response = await handler(intentRequest({ purpose: "SIGN_IN_OR_LINK", callbackUrl: "/wellness" }))
    }
    assert.equal(created, 30)
    assert.equal(response.status, 429)
    assert.equal(response.headers.get("Retry-After"), "419")
    assert.deepEqual(await response.json(), { ok: false })
  })

  it("blocks LINK_GOOGLE start thirty-one before session or any intent work", async () => {
    const { createGoogleIntentHandler } = await loadIntentRoute()
    const rows = []
    let consumed = 0
    let sessionCalls = 0
    let intentWorkCalls = 0
    const handler = createGoogleIntentHandler({
      prismaClient: {},
      secret: "intent-test-secret",
      getSession: async () => { sessionCalls += 1; return { user: { id: "user-1" } } },
      consumeLimit: async () => (++consumed <= 30 ? { allowed: true } : { allowed: false, retryAfterSeconds: 271 }),
      startIntent: async () => {
        intentWorkCalls += 1
        rows.push({ id: `intent-${rows.length + 1}` })
        return { intentId: rows.at(-1).id, browserBindingToken: "a".repeat(43), expiresAt: new Date() }
      },
    })
    for (let index = 0; index < 30; index += 1) {
      const accepted = await handler(intentRequest({ purpose: "LINK_GOOGLE" }))
      assert.equal(accepted.status, 200)
    }
    const before = { sessionCalls, intentWorkCalls, rows: structuredClone(rows) }
    const blocked = await handler(intentRequest({ purpose: "LINK_GOOGLE" }))
    assert.equal(blocked.status, 429)
    assert.equal(blocked.headers.get("Retry-After"), "271")
    assert.equal(sessionCalls, before.sessionCalls)
    assert.equal(intentWorkCalls, before.intentWorkCalls)
    assert.deepEqual(rows, before.rows)
  })

  it("rebuilds registration gates and ignores caller callbacks for security intents", async () => {
    const { createGoogleIntentHandler } = await loadIntentRoute()
    const started = []
    const handler = createGoogleIntentHandler({
      prismaClient: {},
      secret: "intent-test-secret",
      getSession: async () => ({ user: { id: "user-1" } }),
      consumeLimit: async () => ({ allowed: true }),
      startIntent: async (input) => {
        started.push(input)
        return { intentId: `intent-${started.length}`, browserBindingToken: "a".repeat(43), expiresAt: new Date() }
      },
    })
    const registration = await handler(intentRequest({
      purpose: "SIGN_IN_OR_LINK",
      callbackUrl: "/legal/accept?callbackUrl=%2Fclock%3Fpanel%3Dbackground&callbackUrl=https%3A%2F%2Fevil.example",
    }))
    assert.deepEqual(await registration.json(), {
      ok: true,
      callbackUrl: "/legal/accept?callbackUrl=%2Fclock%3Fpanel%3Dbackground",
    })
    assert.equal(started[0].callbackPath, "/legal/accept?callbackUrl=%2Fclock%3Fpanel%3Dbackground")

    for (const purpose of SESSION_BOUND_PURPOSES) {
      const response = await handler(intentRequest({ purpose }))
      assert.deepEqual(await response.json(), { ok: true, callbackUrl: "/account?tab=security" })
      assert.equal(started.at(-1).targetUserId, "user-1")
      assert.equal(started.at(-1).callbackPath, null)
    }
  })

  it("marks every session-bound success, authentication failure, and rate limit private no-store", async () => {
    const { createGoogleIntentHandler } = await loadIntentRoute()

    for (const purpose of SESSION_BOUND_PURPOSES) {
      const success = await createGoogleIntentHandler({
        prismaClient: {},
        secret: "intent-test-secret",
        getSession: async () => ({ user: { id: "user-1" } }),
        consumeLimit: async () => ({ allowed: true }),
        startIntent: async () => ({ intentId: "intent-1", browserBindingToken: "a".repeat(43), expiresAt: new Date() }),
      })(intentRequest({ purpose }))
      const unauthenticated = await createGoogleIntentHandler({
        prismaClient: {},
        secret: "intent-test-secret",
        getSession: async () => null,
        consumeLimit: async () => ({ allowed: true }),
      })(intentRequest({ purpose }))
      const limited = await createGoogleIntentHandler({
        prismaClient: {},
        secret: "intent-test-secret",
        getSession: async () => ({ user: { id: "user-1" } }),
        consumeLimit: async () => ({ allowed: false, retryAfterSeconds: 73 }),
      })(intentRequest({ purpose }))

      assert.equal(success.status, 200, purpose)
      assert.equal(unauthenticated.status, 401, purpose)
      assert.equal(limited.status, 429, purpose)
      for (const response of [success, unauthenticated, limited]) {
        assert.equal(response.headers.get("Cache-Control"), "private, no-store", purpose)
        assert.equal(response.headers.get("Pragma"), "no-cache", purpose)
      }
    }
  })

  it("rejects untrusted, non-JSON, and unknown-key session-bound starts before limiter, session, or intent work", async () => {
    const { createGoogleIntentHandler } = await loadIntentRoute()
    const calls = { limit: 0, session: 0, intent: 0 }
    const handler = createGoogleIntentHandler({
      prismaClient: {},
      secret: "intent-test-secret",
      expectedSiteUrl: "https://massagelab.test",
      getSession: async () => { calls.session += 1; return { user: { id: "user-1" } } },
      consumeLimit: async () => { calls.limit += 1; return { allowed: true } },
      startIntent: async () => {
        calls.intent += 1
        return { intentId: "intent-1", browserBindingToken: "a".repeat(43), expiresAt: new Date() }
      },
    })

    for (const purpose of SESSION_BOUND_PURPOSES) {
      const rejected = [
        {
          label: "missing origin",
          request: intentRequest({ purpose }, { origin: null }),
          expectedStatus: 403,
        },
        {
          label: "attacker origin",
          request: intentRequest({ purpose }, { origin: "https://attacker.example" }),
          expectedStatus: 403,
        },
        {
          label: "cross-site Fetch Metadata",
          request: intentRequest({ purpose }, { fetchSite: "cross-site" }),
          expectedStatus: 403,
        },
        {
          label: "non-JSON media",
          request: intentRequest({ purpose }, { contentType: "text/plain" }),
          expectedStatus: 400,
        },
        {
          label: "unknown callback key",
          request: intentRequest({ purpose, callbackUrl: "/account" }),
          expectedStatus: 400,
        },
      ]
      for (const { label, request, expectedStatus } of rejected) {
        const response = await handler(request)
        assert.equal(response.status, expectedStatus, `${purpose}: ${label}`)
        assert.deepEqual(await response.json(), { ok: false }, `${purpose}: ${label}`)
        assert.equal(response.headers.get("Cache-Control"), "private, no-store", `${purpose}: ${label}`)
        assert.equal(response.headers.get("Pragma"), "no-cache", `${purpose}: ${label}`)
      }
    }
    assert.deepEqual(calls, { limit: 0, session: 0, intent: 0 })
  })

  it("rejects oversized streaming session-bound bodies before limiter, session, or intent work", { timeout: 2_000 }, async () => {
    const { createGoogleIntentHandler } = await loadIntentRoute()
    const calls = { limit: 0, session: 0, intent: 0 }
    const handler = createGoogleIntentHandler({
      prismaClient: {},
      secret: "intent-test-secret",
      expectedSiteUrl: "https://massagelab.test",
      getSession: async () => { calls.session += 1; return { user: { id: "user-1" } } },
      consumeLimit: async () => { calls.limit += 1; return { allowed: true } },
      startIntent: async () => {
        calls.intent += 1
        return { intentId: "intent-1", browserBindingToken: "a".repeat(43), expiresAt: new Date() }
      },
    })

    await Promise.all(SESSION_BOUND_PURPOSES.map(async (purpose) => {
      const response = await settlesWithin(
        handler(oversizedStreamingIntentRequest(purpose)),
        500,
        `oversized ${purpose} request did not settle`,
      )

      assert.equal(response.status, 400, purpose)
      assert.equal(response.headers.get("Cache-Control"), "private, no-store", purpose)
      assert.equal(response.headers.get("Pragma"), "no-cache", purpose)
      assert.deepEqual(await response.json(), { ok: false }, purpose)
    }))
    assert.deepEqual(calls, { limit: 0, session: 0, intent: 0 })
  })

  it("keeps only public SIGN_IN_OR_LINK provenance-optional", async () => {
    const { createGoogleIntentHandler } = await loadIntentRoute()
    const started = []
    const handler = createGoogleIntentHandler({
      prismaClient: {},
      secret: "intent-test-secret",
      expectedSiteUrl: "https://massagelab.test",
      getSession: async () => ({ user: { id: "user-1" } }),
      consumeLimit: async () => ({ allowed: true }),
      startIntent: async (input) => {
        started.push(input)
        return { intentId: `intent-${started.length}`, browserBindingToken: "a".repeat(43), expiresAt: new Date() }
      },
    })

    const response = await handler(intentRequest(
      { purpose: "SIGN_IN_OR_LINK", callbackUrl: "/wellness" },
      { origin: null, fetchSite: null },
    ))
    assert.equal(response.status, 200)
    assert.deepEqual(started.map(({ purpose }) => purpose), ["SIGN_IN_OR_LINK"])
  })
})

async function loadIntentRoute() {
  const source = await readFile(new URL("../app/api/auth/google/intent/route.ts", import.meta.url), "utf8")
  return loadCompiledModule(source, "google-intent-route.test.ts", {
    "next/server": { NextResponse: testNextResponse() },
    "@/auth": { getCurrentSession: async () => null },
    "@/lib/auth-env": {
      getAuthSecret: () => "intent-test-secret",
      getSiteUrl: () => "https://massagelab.test",
    },
    "@/lib/account-security-request": {
      noStoreJsonHeaders,
      parseBoundedAccountSecurityJson,
      validateTrustedAccountSecurityJson,
    },
    "@/lib/auth-rate-limit": { consumeGoogleIntentStartRateLimit: async () => ({ allowed: true }) },
    "@/lib/auth-request": { authRequestNetworkIdentifier: () => "203.0.113.8" },
    "@/lib/auth-method-intents": {
      AUTH_METHOD_INTENT_COOKIE: "ml-auth-method-binding",
      isSessionBoundGoogleIntentPurpose: (value) => SESSION_BOUND_PURPOSES.includes(value),
      serializeAuthMethodIntentBinding: (id, token) => `${id}.${token}`,
      startAuthMethodIntent: async () => ({ intentId: "default-intent", browserBindingToken: "a".repeat(43), expiresAt: new Date() }),
    },
    "@/lib/legal-acceptance-gate": { buildRegistrationLegalProviderRedirectPath },
    "@/lib/prisma": { prisma: {} },
  })
}

function testNextResponse() {
  return {
    json(body, init = {}) {
      const response = new Response(JSON.stringify(body), {
        ...init,
        headers: { "content-type": "application/json", ...init.headers },
      })
      response.cookies = {
        set: (...args) => {
          response.cookieSet = normalizeCookieSetArguments(args)
        },
      }
      return response
    },
  }
}

/** Normalizes both supported NextResponse cookie-set forms for stable assertions. */
function normalizeCookieSetArguments(args) {
  if (args.length === 1 && args[0] && typeof args[0] === "object") {
    const { name, value, ...options } = args[0]
    return { name, value, options }
  }
  const [name, value, options = {}] = args
  return { name, value, options }
}

function intentRequest(body, {
  origin = "https://massagelab.test",
  fetchSite = "same-origin",
  contentType = "application/json",
} = {}) {
  const headers = new Headers({ "x-forwarded-for": "203.0.113.8" })
  if (contentType !== null) headers.set("content-type", contentType)
  if (origin !== null) headers.set("origin", origin)
  if (fetchSite !== null) headers.set("sec-fetch-site", fetchSite)
  return new Request("https://massagelab.test/api/auth/google/intent", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
}

function oversizedStreamingIntentRequest(purpose = "LINK_GOOGLE") {
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(JSON.stringify({
        purpose,
        padding: "x".repeat(5_000),
      })))
      // Intentionally omit close: the bounded parser must reject by size before EOF.
    },
  })
  return new Request("https://massagelab.test/api/auth/google/intent", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://massagelab.test",
      "sec-fetch-site": "same-origin",
    },
    body,
    duplex: "half",
  })
}

async function settlesWithin(promise, timeoutMs, message) {
  let timeoutId
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs)
      }),
    ])
  } finally {
    clearTimeout(timeoutId)
  }
}

async function start(service, db, purpose = "SIGN_IN_OR_LINK", targetUserId, callbackPath) {
  return service.startAuthMethodIntent({
    prismaClient: db,
    purpose,
    targetUserId,
    callbackPath,
    secret: "intent-test-secret",
    now: new Date("2026-08-28T12:00:00.000Z"),
  })
}

function googleInput(db, email, providerAccountId, intent) {
  return {
    prismaClient: db,
    secret: "intent-test-secret",
    now: new Date("2026-08-28T12:00:00.000Z"),
    intentId: intent.intentId,
    browserBindingToken: intent.browserBindingToken,
    profile: { email, email_verified: true, name: "Family Person", picture: "https://images.example/family.png" },
    account: { type: "oauth", provider: "google", providerAccountId },
    ensureRole: async () => "USER",
  }
}

function createIntentDatabase(seed = {}) {
  const root = {
    version: 0,
    serializationConflicts: 0,
    identityUniqueConflicts: 0,
    normalizedLookups: [],
    rawEmailLookups: 0,
    rolledBackTransactions: 0,
    transactionOptions: [],
    state: {
      intents: (seed.intents ?? []).map((row) => ({ ...row })),
      users: (seed.users ?? []).map((row) => ({ ...row })),
      accounts: (seed.accounts ?? []).map((row) => ({ ...row })),
      securityEmails: [],
      consumeWins: new Map(),
      nextIntent: (seed.intents?.length ?? 0) + 1,
      nextUser: (seed.users?.length ?? 0) + 1,
      nextAccount: (seed.accounts?.length ?? 0) + 1,
      nextSecurityEmail: 1,
    },
  }

  const client = {
    get state() { return root.state },
    get serializationConflicts() { return root.serializationConflicts },
    get identityUniqueConflicts() { return root.identityUniqueConflicts },
    get rolledBackTransactions() { return root.rolledBackTransactions },
    get transactionOptions() { return root.transactionOptions },
    intent: (id) => root.state.intents.find((row) => row.id === id),
    intentConsumeWins: (id) => root.state.consumeWins.get(id) ?? 0,
    get normalizedLookups() { return root.normalizedLookups },
    get rawEmailLookups() { return root.rawEmailLookups },
    usersByNormalizedEmail: (email) => root.state.users.filter((row) => normalizeEmail(row.email) === normalizeEmail(email)),
    accountsByProviderId: (provider, providerAccountId) => root.state.accounts.filter((row) => row.provider === provider && row.providerAccountId === providerAccountId),
    authMethodIntent: {
      async findUnique({ where }) {
        return root.state.intents.find((row) => row.id === where.id) ?? null
      },
      async findMany({ where, take }) {
        if (seed.pruneError) throw seed.pruneError
        return staleIntents(root.state.intents, where, take)
      },
      async deleteMany({ where }) {
        const ids = where.id.in
        const before = root.state.intents.length
        root.state.intents = root.state.intents.filter((row) => !ids.includes(row.id))
        return { count: before - root.state.intents.length }
      },
    },
    async $transaction(callback, options) {
      root.transactionOptions.push(options)
      const baseVersion = root.version
      const snapshot = structuredClone(root.state)
      const tx = transactionClient(snapshot, root, seed)
      try {
        const result = await callback(tx)
        // Allow concurrent callbacks to finish against their own snapshots
        // before optimistic Serializable commit validation.
        await Promise.resolve()
        if (root.version !== baseVersion) {
          root.serializationConflicts += 1
          throw serializationError()
        }
        root.state = snapshot
        root.version += 1
        return result
      } catch (error) {
        root.rolledBackTransactions += 1
        throw error
      }
    },
  }
  return client
}

/** Builds one isolated transaction view; no mutation reaches root before commit. */
function transactionClient(state, root, seed) {
  return {
    resolveNormalizedUserId(email) {
      root.normalizedLookups.push(email)
      return state.users.find((row) => normalizeEmail(row.email) === normalizeEmail(email))?.id ?? null
    },
    authMethodIntent: {
      async findMany({ where, take }) {
        if (seed.pruneError) throw seed.pruneError
        return staleIntents(state.intents, where, take)
      },
      async deleteMany({ where }) {
        const ids = where.id.in
        const before = state.intents.length
        state.intents = state.intents.filter((row) => !ids.includes(row.id))
        return { count: before - state.intents.length }
      },
      async create({ data }) {
        const row = { id: `intent-${state.nextIntent++}`, status: "PENDING", consumedAt: null, ...data }
        state.intents.push(row)
        return row
      },
      async findUnique({ where }) { return state.intents.find((row) => row.id === where.id) ?? null },
      async updateMany({ where, data }) {
        if (data.status === "CONSUMED" && seed.consumeLoss) return { count: 0 }
        const row = state.intents.find((candidate) => (
          candidate.id === where.id
          && candidate.status === where.status
          && (!Object.hasOwn(where, "consumedAt") || candidate.consumedAt === where.consumedAt)
          && (!Object.hasOwn(where, "targetUserId") || candidate.targetUserId === where.targetUserId)
          && (!Object.hasOwn(where, "purpose") || candidate.purpose === where.purpose)
          && (!Object.hasOwn(where, "provider") || candidate.provider === where.provider)
          && (!Object.hasOwn(where, "providerAccountId") || candidate.providerAccountId === where.providerAccountId)
          && (!where.expiresAt?.gt || candidate.expiresAt > where.expiresAt.gt)
        ))
        if (!row) return { count: 0 }
        Object.assign(row, data)
        if (data.status === "CONSUMED") state.consumeWins.set(row.id, (state.consumeWins.get(row.id) ?? 0) + 1)
        return { count: 1 }
      },
    },
    user: {
      async findUnique({ where, include }) {
        if (where.email) root.rawEmailLookups += 1
        const user = where.email
          ? state.users.find((row) => row.email === where.email) ?? null
          : state.users.find((row) => row.id === where.id) ?? null
        if (!user || !include) return user
        return {
          ...user,
          accounts: state.accounts.filter((row) => row.userId === user.id),
          passwordCredential: user.passwordCredential ?? null,
          twoFactorSecret: user.twoFactorSecret ?? null,
        }
      },
      async create({ data }) {
        await Promise.resolve()
        if (seed.beforeUserCreate) {
          const beforeCount = root.state.users.length
          seed.beforeUserCreate(root.state)
          if (root.state.users.length !== beforeCount) root.version += 1
        }
        if (root.state.users.some((row) => row.email === data.email)) {
          root.identityUniqueConflicts += 1
            throw seed.identityUniqueError ?? uniqueError("User", ["email"])
        }
          if (state.users.some((row) => row.email === data.email)) throw seed.identityUniqueError ?? uniqueError("User", ["email"])
        const accounts = data.accounts?.create ? [data.accounts.create] : []
        for (const account of accounts) {
          if (root.state.accounts.some((row) => row.provider === account.provider && row.providerAccountId === account.providerAccountId)) {
            root.identityUniqueConflicts += 1
            throw seed.identityUniqueError ?? uniqueError("Account", ["provider", "providerAccountId"])
          }
          if (state.accounts.some((row) => row.provider === account.provider && row.providerAccountId === account.providerAccountId)) {
            throw uniqueError("Account", ["provider", "providerAccountId"])
          }
        }
        const user = { id: `user-${state.nextUser++}`, ...data }
        state.users.push(user)
        for (const account of accounts) state.accounts.push({ id: `account-${state.nextAccount++}`, userId: user.id, ...account })
        return user
      },
    },
    account: {
      async findUnique({ where }) {
        const key = where.provider_providerAccountId
        return state.accounts.find((row) => row.provider === key.provider && row.providerAccountId === key.providerAccountId) ?? null
      },
      async create({ data }) {
        if (state.accounts.some((row) => row.provider === data.provider && row.providerAccountId === data.providerAccountId)) {
          throw uniqueError("Account", ["provider", "providerAccountId"])
        }
        const account = { id: `account-${state.nextAccount++}`, ...data }
        state.accounts.push(account)
        return account
      },
    },
    accountSecurityEmailIntent: {
      async upsert({ where, create }) {
        const existing = state.securityEmails.find((row) => row.idempotencyKey === where.idempotencyKey)
        if (existing) return { id: existing.id }
        const intent = { id: `security-email-${state.nextSecurityEmail++}`, ...create, status: "PENDING", attemptCount: 0 }
        state.securityEmails.push(intent)
        return { id: intent.id }
      },
    },
  }
}

/**
 * Emulates both the current direct `expiresAt.lt` predicate and the legacy `OR`
 * shape. Consumed rows are stale only when that legacy query includes them.
 */
function staleIntents(intents, where, take) {
  const expiresBefore = where.expiresAt?.lt ?? where.OR?.find((condition) => condition.expiresAt)?.expiresAt.lt
  const includesConsumed = Boolean(where.OR?.some((condition) => Object.hasOwn(condition.consumedAt ?? {}, "not")))
  return intents
    .filter((row) => row.expiresAt < expiresBefore || (includesConsumed && row.consumedAt))
    .slice(0, take)
    .map(({ id }) => ({ id }))
}

function normalizeEmail(value) {
  return String(value ?? "").trim().toLowerCase()
}

function uniqueError(modelName, target) {
  return Object.assign(new Error("unique constraint"), { code: "P2002", meta: { modelName, target } })
}

function driverAdapterUniqueError(constraint) {
  return Object.assign(new Error("production unique constraint"), {
    code: "P2002",
    meta: {
      driverAdapterError: {
        name: "DriverAdapterError",
        cause: {
          kind: "UniqueConstraintViolation",
          originalCode: "23505",
          originalMessage: "duplicate key value violates unique constraint",
          constraint,
        },
      },
    },
  })
}

function serializationError() {
  return Object.assign(new Error("serializable conflict"), { code: "P2034" })
}
