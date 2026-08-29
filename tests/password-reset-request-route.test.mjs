import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"
import { requestPasswordReset } from "../lib/password-reset-request.ts"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const limiterSource = await readFile(new URL("../lib/auth-rate-limit.ts", import.meta.url), "utf8")
const limiter = loadCompiledModule(limiterSource, "auth-rate-limit.route-test.ts", {
  "@/lib/prisma": { prisma: {} },
  "@/lib/auth-env": { getAuthSecret: () => "secret" },
  "@/lib/auth-security": { normalizeEmail: (value) => String(value ?? "").trim().toLowerCase() },
  "@/lib/commerce/transactions": { runCommerceTransaction: (client, callback) => client.$transaction(callback, { isolationLevel: "Serializable" }) },
})

const routeSource = await readFile(new URL("../app/api/account/password-reset/request/route.ts", import.meta.url), "utf8")
const afterCallbacks = []
const route = loadCompiledModule(routeSource, "password-reset-request-route.test.ts", {
  "next/server": {
    after: (callback) => afterCallbacks.push(callback),
    NextResponse: { json: (body, init) => Response.json(body, init) },
  },
  "@/lib/auth-security": { generateRandomToken: () => "token", hashToken: () => "hash", normalizeEmail: (value) => String(value ?? "").trim().toLowerCase(), tokenExpiresIn: () => new Date() },
  "@/lib/auth-mail": { sendPasswordResetEmail: async () => ({ delivered: true }) },
  "@/lib/auth-rate-limit": limiter,
  "@/lib/auth-registration-service": {
    PUBLIC_ACCOUNT_ENTRY_MESSAGE: "Check that email address for the appropriate sign-in, verification, or recovery next step.",
  },
  "@/lib/password-reset-request": { requestPasswordReset },
  "@/lib/auth-env": { getAuthSecret: () => "secret" },
  "@/lib/prisma": { prisma: {} },
})

const NOW = new Date("2026-08-28T12:00:00.000Z")

describe("password reset limiter cutover", () => {
  it("persists both hashed buckets before reset work", async () => {
    afterCallbacks.length = 0
    const database = createDatabase()
    let snapshot
    database.onUserLookup = () => { snapshot = structuredClone(database.rows) }
    const handler = route.createPasswordResetRequestHandler({
      prismaClient: database,
      secret: "secret",
      clock: () => NOW,
      shouldPrune: () => false,
    })
    const response = await handler(request("Person@Example.com", "203.0.113.5"))
    assert.equal(afterCallbacks.length, 1)
    await afterCallbacks.shift()()

    assert.equal(response.status, 202)
    assert.equal(snapshot.length, 2)
    assert.deepEqual(snapshot.map(({ purpose, scope }) => ({ purpose, scope })).sort((a, b) => a.scope.localeCompare(b.scope)), [
      { purpose: "PASSWORD_RESET", scope: "ACCOUNT" },
      { purpose: "PASSWORD_RESET", scope: "NETWORK" },
    ])
    assert.equal(snapshot.every((row) => row.keyHash.length === 64), true)
    assert.equal(JSON.stringify(snapshot).includes("person@example.com"), false)
    assert.equal(JSON.stringify(snapshot).includes("203.0.113.5"), false)
  })

  it("returns neutral 202 before an unresolved provider task scheduled through Next after", async () => {
    afterCallbacks.length = 0
    let providerStarted = false
    let releaseProvider
    const provider = new Promise((resolve) => { releaseProvider = resolve })
    const handler = route.createPasswordResetRequestHandler({
      prismaClient: createDatabase(),
      secret: "secret",
      clock: () => NOW,
      shouldPrune: () => false,
      resetWork: async (input) => {
        input.scheduleAccountWork(() => {
          providerStarted = true
          return provider
        })
        return { status: "ACCEPTED" }
      },
    })

    const response = await handler(request("person@example.com", "203.0.113.5"))

    assert.equal(response.status, 202)
    assert.equal(providerStarted, false)
    assert.equal(afterCallbacks.length, 1)
    const delivery = afterCallbacks[0]()
    assert.equal(providerStarted, true)
    releaseProvider({ delivered: false })
    await delivery
  })

  it("maps a blocked decision to exact 429 metadata without invoking reset work", async () => {
    afterCallbacks.length = 0
    const database = createDatabase()
    const handler = route.createPasswordResetRequestHandler({ prismaClient: database, secret: "secret", clock: () => NOW, shouldPrune: () => false })
    for (let index = 0; index < 5; index += 1) {
      await handler(request("person@example.com", "203.0.113.5"))
      assert.equal(afterCallbacks.length, 1)
      await afterCallbacks.shift()()
    }
    const response = await handler(request("person@example.com", "203.0.113.5"))

    assert.equal(response.status, 429)
    assert.equal(response.headers.get("retry-after"), "900")
    assert.deepEqual(await response.json(), { message: "Too many requests. Please try again later." })
    assert.equal(database.normalizedLookupCount, 5)
  })
})

function request(email, ip) {
  return new Request("https://massagelab.app/api/account/password-reset/request", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ email }),
  })
}

function createDatabase() {
  const rows = []
  let userLookupCount = 0
  let normalizedLookupCount = 0
  const delegate = {
    async findUnique({ where }) {
      const key = where.purpose_scope_keyHash
      return rows.find((row) => row.purpose === key.purpose && row.scope === key.scope && row.keyHash === key.keyHash) ?? null
    },
    async upsert({ where, create, update }) {
      const key = where.purpose_scope_keyHash
      const existing = rows.find((row) => row.purpose === key.purpose && row.scope === key.scope && row.keyHash === key.keyHash)
      if (existing) Object.assign(existing, update)
      else rows.push({ id: `bucket-${rows.length + 1}`, ...create, updatedAt: NOW })
    },
    async findMany() { return [] },
    async deleteMany() { return { count: 0 } },
  }
  const database = {
    rows,
    onUserLookup: null,
    get userLookupCount() { return userLookupCount },
    get normalizedLookupCount() { return normalizedLookupCount },
    authRateLimitBucket: delegate,
    user: { async findUnique() { userLookupCount += 1; database.onUserLookup?.(); return null } },
    async $queryRaw() { normalizedLookupCount += 1; database.onUserLookup?.(); return [] },
    passwordResetToken: { async create() {} },
    async $transaction(callback) { return callback({ authRateLimitBucket: delegate }) },
  }
  return database
}
