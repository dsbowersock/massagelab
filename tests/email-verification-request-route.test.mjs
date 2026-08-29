import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

import { requestEmailVerification } from "../lib/email-verification-request.ts"
import { runCommerceTransaction } from "../lib/commerce/transactions.ts"
import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const afterCallbacks = []
const NOW = new Date("2026-08-29T12:00:00.000Z")
const PUBLIC_MESSAGE = "If that email still needs verification, check its inbox for the next step."

const limiterSource = await readFile(new URL("../lib/auth-rate-limit.ts", import.meta.url), "utf8")
const limiter = loadCompiledModule(limiterSource, "auth-rate-limit.verification-route-test.ts", {
  "@/lib/prisma": { prisma: {} },
  "@/lib/auth-env": { getAuthSecret: () => "secret" },
  "@/lib/auth-security": { normalizeEmail: (value) => String(value ?? "").trim().toLowerCase() },
  "@/lib/commerce/transactions": { runCommerceTransaction },
})

const routeSource = await readFile(new URL("../app/api/account/email-verification/request/route.ts", import.meta.url), "utf8")
const route = loadCompiledModule(routeSource, "email-verification-request-route.test.ts", {
  "next/server": {
    after: (callback) => afterCallbacks.push(callback),
    NextResponse: { json: (body, init) => Response.json(body, init) },
  },
  "@/lib/auth-env": { getAuthSecret: () => "secret" },
  "@/lib/auth-mail": { sendVerificationEmail: async () => ({ delivered: true }) },
  "@/lib/auth-rate-limit": limiter,
  "@/lib/auth-registration": { sendRegistrationVerification: (sender, ...args) => sender(...args) },
  "@/lib/auth-registration-service": { PUBLIC_ACCOUNT_ENTRY_MESSAGE: PUBLIC_MESSAGE },
  "@/lib/auth-security": {
    generateRandomToken: () => "raw-token",
    hashToken: () => "hashed-token",
    normalizeEmail: (value) => String(value ?? "").trim().toLowerCase(),
    tokenExpiresIn: () => new Date(NOW.getTime() + 24 * 60 * 60_000),
  },
  "@/lib/email-verification-request": { requestEmailVerification },
  "@/lib/legal-acceptance-gate": {
    safePostLegalAcceptanceCallback: (value) => typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/onboarding",
  },
  "@/lib/prisma": { prisma: {} },
})

describe("email verification request route", () => {
  it("returns neutral 202 before exactly one post-response task and sanitizes the callback", async () => {
    afterCallbacks.length = 0
    let captured
    let taskStarted = false
    const handler = safeCreateHandler({
      prismaClient: createRouteDatabase(),
      secret: "secret",
      clock: () => NOW,
      shouldPrune: () => false,
      verificationWork: async (input) => {
        captured = input
        input.scheduleAccountWork(async () => { taskStarted = true })
        return { status: "ACCEPTED" }
      },
    })
    assert.equal(typeof handler, "function")

    const response = await handler(request(" Person@Example.com ", "https://attacker.test/after"))

    assert.equal(response.status, 202)
    assert.deepEqual(await response.json(), { message: PUBLIC_MESSAGE })
    assert.equal(taskStarted, false)
    assert.equal(afterCallbacks.length, 1)
    assert.equal(captured.email, "person@example.com")
    assert.equal(captured.callbackUrl, "/onboarding")
    await afterCallbacks[0]()
    assert.equal(taskStarted, true)
  })

  it("shares registration's exact hashed ACCOUNT and NETWORK quota and maps exact 429 metadata", async () => {
    afterCallbacks.length = 0
    const database = createRouteDatabase()
    const handler = safeCreateHandler({
      prismaClient: database,
      secret: "secret",
      clock: () => NOW,
      shouldPrune: () => false,
    })
    assert.equal(typeof handler, "function")

    for (let index = 0; index < 5; index += 1) {
      const response = await handler(request("person@example.com", "/clock"))
      assert.equal(response.status, 202)
      assert.equal(afterCallbacks.length, 1)
      await afterCallbacks.shift()()
    }
    const blocked = await handler(request("person@example.com", "/clock"))

    assert.equal(blocked.status, 429)
    assert.equal(blocked.headers.get("retry-after"), "900")
    assert.deepEqual(await blocked.json(), { message: "Too many requests. Please try again later." })
    assert.equal(afterCallbacks.length, 0)
    assert.deepEqual(database.rows.map(({ purpose, scope, count }) => ({ purpose, scope, count })).sort((a, b) => a.scope.localeCompare(b.scope)), [
      { purpose: "REGISTER", scope: "ACCOUNT", count: 5 },
      { purpose: "REGISTER", scope: "NETWORK", count: 5 },
    ])
    assert.equal(database.rows.every((row) => row.keyHash.length === 64), true)
    assert.equal(JSON.stringify(database.rows).includes("person@example.com"), false)
    assert.equal(JSON.stringify(database.rows).includes("203.0.113.29"), false)
  })

  it("keeps invalid public input generic without scheduling account work", async () => {
    afterCallbacks.length = 0
    const handler = safeCreateHandler({ prismaClient: createRouteDatabase(), secret: "secret" })
    assert.equal(typeof handler, "function")

    const response = await handler(request("not-an-email", "/clock"))

    assert.equal(response.status, 202)
    assert.deepEqual(await response.json(), { message: PUBLIC_MESSAGE })
    assert.equal(afterCallbacks.length, 0)
  })
})

describe("verification resend form contract", () => {
  it("keeps the email in a JSON body and exposes bounded pending and live-region feedback", async () => {
    const source = await readFile(new URL("../app/verify-email/resend-verification-form.tsx", import.meta.url), "utf8")

    assert.match(source, /fetch\("\/api\/account\/email-verification\/request"/)
    assert.match(source, /method: "POST"/)
    assert.match(source, /JSON\.stringify\(\{ email, callbackUrl \}\)/)
    assert.match(source, /<AsyncActionButton/)
    assert.match(source, /pendingLabel="Sending verification email…"/)
    assert.match(source, /role=\{statusIsError \? "alert" : "status"\}/)
    assert.match(source, /aria-live=\{statusIsError \? "assertive" : "polite"\}/)
    assert.doesNotMatch(source, /URLSearchParams|router\.push|window\.location/)
  })
})

function safeCreateHandler(dependencies) {
  try {
    return route.createEmailVerificationRequestHandler(dependencies)
  } catch {
    return null
  }
}

function request(email, callbackUrl) {
  return new Request("https://massagelab.app/api/account/email-verification/request", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.29" },
    body: JSON.stringify({ email, callbackUrl }),
  })
}

function createRouteDatabase() {
  const rows = []
  const delegate = {
    async findUnique({ where }) {
      const key = where.purpose_scope_keyHash
      return structuredClone(rows.find((row) => row.purpose === key.purpose && row.scope === key.scope && row.keyHash === key.keyHash) ?? null)
    },
    async upsert({ where, create, update }) {
      const key = where.purpose_scope_keyHash
      const existing = rows.find((row) => row.purpose === key.purpose && row.scope === key.scope && row.keyHash === key.keyHash)
      if (existing) Object.assign(existing, structuredClone(update))
      else rows.push({ id: `bucket-${rows.length + 1}`, ...structuredClone(create) })
    },
    async findMany() { return [] },
    async deleteMany() { return { count: 0 } },
  }
  return {
    rows,
    authRateLimitBucket: delegate,
    user: { async findUnique() { return null } },
    async $queryRaw() { return [] },
    async $transaction(callback, options) {
      return callback({ authRateLimitBucket: delegate }, options)
    },
  }
}
