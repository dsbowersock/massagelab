import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const limiterSource = await readFile(new URL("../lib/auth-rate-limit.ts", import.meta.url), "utf8")
const limiter = loadCompiledModule(limiterSource, "auth-rate-limit.route-test.ts", {
  "@/lib/prisma": { prisma: {} },
  "@/lib/auth-env": { getAuthSecret: () => "secret" },
  "@/lib/auth-security": { normalizeEmail: (value) => String(value ?? "").trim().toLowerCase() },
  "@/lib/commerce/transactions": { runCommerceTransaction: (client, callback) => client.$transaction(callback, { isolationLevel: "Serializable" }) },
})

const routeSource = await readFile(new URL("../app/api/account/password-reset/request/route.ts", import.meta.url), "utf8")
const route = loadCompiledModule(routeSource, "password-reset-request-route.test.ts", {
  "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
  "@/lib/auth-security": { generateRandomToken: () => "token", hashToken: () => "hash", normalizeEmail: (value) => String(value ?? "").trim().toLowerCase(), tokenExpiresIn: () => new Date() },
  "@/lib/auth-mail": { sendPasswordResetEmail: async () => ({ delivered: true }) },
  "@/lib/auth-rate-limit": limiter,
  "@/lib/auth-env": { getAuthSecret: () => "secret" },
  "@/lib/prisma": { prisma: {} },
})

const NOW = new Date("2026-08-28T12:00:00.000Z")

describe("password reset limiter cutover", () => {
  it("persists both hashed buckets before reset work", async () => {
    const database = createDatabase()
    let snapshot
    const handler = route.createPasswordResetRequestHandler({
      prismaClient: database,
      secret: "secret",
      clock: () => NOW,
      shouldPrune: () => false,
      resetWork: async () => { snapshot = structuredClone(database.rows); return {} },
    })
    const response = await handler(request("Person@Example.com", "203.0.113.5"))

    assert.equal(response.status, 200)
    assert.equal(snapshot.length, 2)
    assert.deepEqual(snapshot.map(({ purpose, scope }) => ({ purpose, scope })).sort((a, b) => a.scope.localeCompare(b.scope)), [
      { purpose: "PASSWORD_RESET", scope: "ACCOUNT" },
      { purpose: "PASSWORD_RESET", scope: "NETWORK" },
    ])
    assert.equal(snapshot.every((row) => row.keyHash.length === 64), true)
    assert.equal(JSON.stringify(snapshot).includes("person@example.com"), false)
    assert.equal(JSON.stringify(snapshot).includes("203.0.113.5"), false)
  })

  it("maps a blocked decision to exact 429 metadata without invoking reset work", async () => {
    const database = createDatabase()
    let workCalls = 0
    const handler = route.createPasswordResetRequestHandler({ prismaClient: database, secret: "secret", clock: () => NOW, shouldPrune: () => false, resetWork: async () => { workCalls += 1; return {} } })
    for (let index = 0; index < 5; index += 1) await handler(request("person@example.com", "203.0.113.5"))
    const response = await handler(request("person@example.com", "203.0.113.5"))

    assert.equal(response.status, 429)
    assert.equal(response.headers.get("retry-after"), "900")
    assert.deepEqual(await response.json(), { message: "Too many requests. Please try again later." })
    assert.equal(workCalls, 5)
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
  return {
    rows,
    authRateLimitBucket: delegate,
    user: { async findUnique() { return null } },
    passwordResetToken: { async create() {} },
    async $transaction(callback) { return callback({ authRateLimitBucket: delegate }) },
  }
}
