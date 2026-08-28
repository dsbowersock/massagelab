import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"
import { runCommerceTransaction } from "../lib/commerce/transactions.ts"
import { buildRegistrationLegalProviderRedirectPath } from "../lib/legal-acceptance-gate.js"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)

async function loadService() {
  const source = await readFile(new URL("../lib/auth-method-intents.ts", import.meta.url), "utf8")
  return loadCompiledModule(source, "auth-method-intents.test.ts", {
    "@/lib/auth-env": { getAuthSecret: () => "intent-test-secret" },
    "@/lib/auth-security": { normalizeEmail: (value) => typeof value === "string" ? value.trim().toLowerCase() : "" },
    "@/lib/auth-users": { ensureUserRole: async () => "USER" },
    "@/lib/commerce/transactions": { runCommerceTransaction },
    "@/lib/prisma": { prisma: {} },
  })
}

describe("private Google auth-method intents", () => {
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

  it("requires target users for account-security purposes", async () => {
    const service = await loadService()
    for (const purpose of ["LINK_GOOGLE", "ADD_PASSWORD", "REMOVE_PASSWORD"]) {
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

  it("creates the first normalized Google user, minimal account, profile, and consumes once", async () => {
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

  it("returns LINK_REQUIRED for a normalized password account without creating Account", async () => {
    const service = await loadService()
    const db = createIntentDatabase({ users: [{ id: "password-user", email: "family@example.com", emailVerified: new Date() }] })
    const started = await start(service, db)
    const result = await service.prepareGoogleAuthentication(googleInput(db, " Family@Example.com ", "google-sub-a", started))
    assert.deepEqual(result, { kind: "LINK_REQUIRED", userId: "password-user" })
    assert.equal(db.state.accounts.length, 0)
    assert.equal(db.intent(started.intentId).status, "PROVIDER_PROVEN")
    assert.match(db.intent(started.intentId).providerEmailHash, /^[a-f0-9]{64}$/)
    assert.equal(JSON.stringify(db.state.intents).includes("family@example.com"), false)
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

    const same = await start(service, db)
    const sameInput = googleInput(db, "other@example.com", "google-sub-b", same)
    const sameResults = await Promise.all([
      service.prepareGoogleAuthentication(sameInput),
      service.prepareGoogleAuthentication(sameInput),
    ])
    assert.deepEqual(sameResults.map((result) => result.kind).sort(), ["CONTINUE", "REJECTED"])
    assert.equal(db.intentConsumeWins(same.intentId), 1)
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
  })

  it("rate limits before intent access and returns a private cookie plus callback only", async () => {
    const routeSource = await readFile(new URL("../app/api/auth/google/intent/route.ts", import.meta.url), "utf8")
    assert.ok(routeSource.indexOf("consumeGoogleIntentStartRateLimit") < routeSource.indexOf("startAuthMethodIntent"))
    assert.match(routeSource, /"Retry-After"/)
    assert.match(routeSource, /httpOnly:\s*true/)
    assert.match(routeSource, /sameSite:\s*"lax"/)
    assert.match(routeSource, /maxAge:\s*600/)
    assert.match(routeSource, /secure:\s*process\.env\.NODE_ENV === "production"/)
    assert.doesNotMatch(routeSource, /access_token|refresh_token|id_token/)
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

    for (const purpose of ["LINK_GOOGLE", "ADD_PASSWORD", "REMOVE_PASSWORD"]) {
      const response = await handler(intentRequest({ purpose, callbackUrl: "https://evil.example/steal" }))
      assert.deepEqual(await response.json(), { ok: true, callbackUrl: "/account?tab=security" })
      assert.equal(started.at(-1).targetUserId, "user-1")
    }
  })
})

async function loadIntentRoute() {
  const source = await readFile(new URL("../app/api/auth/google/intent/route.ts", import.meta.url), "utf8")
  return loadCompiledModule(source, "google-intent-route.test.ts", {
    "next/server": { NextResponse: testNextResponse() },
    "@/auth": { getCurrentSession: async () => null },
    "@/lib/auth-env": { getAuthSecret: () => "intent-test-secret" },
    "@/lib/auth-rate-limit": { consumeGoogleIntentStartRateLimit: async () => ({ allowed: true }) },
    "@/lib/auth-method-intents": {
      AUTH_METHOD_INTENT_COOKIE: "ml-auth-method-binding",
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
      response.cookies = { set: (...args) => { response.cookieSet = args } }
      return response
    },
  }
}

function intentRequest(body) {
  return new Request("https://massagelab.test/api/auth/google/intent", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.8" },
    body: JSON.stringify(body),
  })
}

async function start(service, db, purpose = "SIGN_IN_OR_LINK", targetUserId) {
  return service.startAuthMethodIntent({
    prismaClient: db,
    purpose,
    targetUserId,
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
  const state = {
    intents: (seed.intents ?? []).map((row) => ({ ...row })),
    users: (seed.users ?? []).map((row) => ({ ...row })),
    accounts: (seed.accounts ?? []).map((row) => ({ ...row })),
    consumeWins: new Map(),
  }
  let nextIntent = state.intents.length + 1
  let nextUser = state.users.length + 1
  let nextAccount = state.accounts.length + 1

  const client = {
    state,
    intent: (id) => state.intents.find((row) => row.id === id),
    intentConsumeWins: (id) => state.consumeWins.get(id) ?? 0,
    usersByNormalizedEmail: (email) => state.users.filter((row) => row.email === email),
    accountsByProviderId: (provider, providerAccountId) => state.accounts.filter((row) => row.provider === provider && row.providerAccountId === providerAccountId),
    async $transaction(callback) { return callback(client) },
    authMethodIntent: {
      async findMany({ where, take }) {
        return state.intents.filter((row) => row.consumedAt || row.expiresAt < where.OR[0].expiresAt.lt).slice(0, take).map(({ id }) => ({ id }))
      },
      async deleteMany({ where }) {
        const ids = where.id.in
        const before = state.intents.length
        state.intents = state.intents.filter((row) => !ids.includes(row.id))
        return { count: before - state.intents.length }
      },
      async create({ data }) {
        const row = { id: `intent-${nextIntent++}`, status: "PENDING", consumedAt: null, ...data }
        state.intents.push(row)
        return row
      },
      async findUnique({ where }) { return state.intents.find((row) => row.id === where.id) ?? null },
      async updateMany({ where, data }) {
        const row = state.intents.find((candidate) => candidate.id === where.id && candidate.status === where.status)
        if (!row) return { count: 0 }
        Object.assign(row, data)
        if (data.status === "CONSUMED") state.consumeWins.set(row.id, (state.consumeWins.get(row.id) ?? 0) + 1)
        return { count: 1 }
      },
    },
    user: {
      async findUnique({ where }) {
        if (where.email) return state.users.find((row) => row.email === where.email) ?? null
        if (where.id) return state.users.find((row) => row.id === where.id) ?? null
        return null
      },
      async create({ data }) {
        await Promise.resolve()
        seed.beforeUserCreate?.(state)
        if (state.users.some((row) => row.email === data.email)) throw uniqueError("User", ["email"])
        const accounts = data.accounts?.create ? [data.accounts.create] : []
        for (const account of accounts) {
          if (state.accounts.some((row) => row.provider === account.provider && row.providerAccountId === account.providerAccountId)) {
            throw uniqueError("Account", ["provider", "providerAccountId"])
          }
        }
        const user = { id: `user-${nextUser++}`, ...data }
        state.users.push(user)
        for (const account of accounts) state.accounts.push({ id: `account-${nextAccount++}`, userId: user.id, ...account })
        return user
      },
    },
    account: {
      async findUnique({ where }) {
        const key = where.provider_providerAccountId
        return state.accounts.find((row) => row.provider === key.provider && row.providerAccountId === key.providerAccountId) ?? null
      },
    },
  }
  return client
}

function uniqueError(modelName, target) {
  return Object.assign(new Error("unique constraint"), { code: "P2002", meta: { modelName, target } })
}
