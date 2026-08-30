import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const routeSource = await readFile(
  new URL("../app/api/account/password-reset/confirm/route.ts", import.meta.url),
  "utf8",
)

/** Loads the confirm route with only its public dependencies and records owner handoff ordering. */
function loadRoute({
  eligible = true,
  result = { status: "UPDATED", emailIntentId: "intent-recovered" },
  hashPassword = async () => "password-hash",
  deliver = async () => ({ status: "DELIVERED", attempted: true, attemptCount: 1 }),
} = {}) {
  const calls = []
  const capturedTimes = {}
  const afterCallbacks = []
  const prisma = new Proxy({}, {
    get(_target, property) {
      throw new Error(`The confirm route accessed Prisma directly through ${String(property)}.`)
    },
  })
  const route = loadCompiledModule(
    routeSource,
    "app/api/account/password-reset/confirm/route.ts",
    {
      "next/server": {
        after: (callback) => afterCallbacks.push(callback),
        NextResponse: {
          json: (body, init = {}) => ({ body, status: init.status ?? 200 }),
        },
      },
      "@/lib/auth-security": {
        hashToken: (token) => {
          calls.push(["hashToken", token])
          return "token-hash"
        },
        hashPassword: async (password) => {
          calls.push(["hashPassword", password])
          return hashPassword(password)
        },
      },
      "@/lib/password-reset-confirmation": {
        isPasswordResetTokenEligible: async (input) => {
          calls.push(["isPasswordResetTokenEligible", { tokenHash: input.tokenHash }])
          assert.equal(input.prismaClient, prisma)
          capturedTimes.eligibility = input.now
          return eligible
        },
        confirmPasswordReset: async (input) => {
          calls.push(["confirmPasswordReset", {
            tokenHash: input.tokenHash,
            passwordHash: input.passwordHash,
          }])
          assert.equal(input.prismaClient, prisma)
          capturedTimes.confirmationInput = input
          return typeof result === "function" ? result(input) : result
        },
      },
      "@/lib/account-security-email-intents": {
        deliverAccountSecurityEmailIntent: async (input) => {
          calls.push(["deliverAccountSecurityEmailIntent", { intentId: input.intentId }])
          assert.equal(input.prismaClient, prisma)
          return deliver(input)
        },
      },
      "@/lib/prisma": { prisma },
    },
  )

  return { POST: route.POST, calls, capturedTimes, afterCallbacks }
}

function resetRequest(body) {
  return new Request("https://massagelab.app/api/account/password-reset/confirm", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("password reset confirmation route", () => {
  it("validates first, then hashes and delegates both reset sources to the shared owner", async () => {
    const invalid = loadRoute()
    const invalidResponse = await invalid.POST(resetRequest({ token: "", password: "too-short" }))

    assert.deepEqual(invalidResponse, {
      body: { message: "Use a valid reset link and a password with at least 12 characters." },
      status: 400,
    })
    assert.deepEqual(invalid.calls, [])

    const { POST, calls, capturedTimes, afterCallbacks } = loadRoute()
    const response = await POST(resetRequest({
      token: "raw-reset-token",
      password: "a-long-new-password",
    }))

    assert.deepEqual(response, {
      body: { message: "Password updated. You can sign in now." },
      status: 200,
    })
    assert.deepEqual(calls, [
      ["hashToken", "raw-reset-token"],
      ["isPasswordResetTokenEligible", { tokenHash: "token-hash" }],
      ["hashPassword", "a-long-new-password"],
      ["confirmPasswordReset", { tokenHash: "token-hash", passwordHash: "password-hash" }],
    ])
    assert.equal(afterCallbacks.length, 1)
    await afterCallbacks[0]()
    assert.deepEqual(calls, [
      ["hashToken", "raw-reset-token"],
      ["isPasswordResetTokenEligible", { tokenHash: "token-hash" }],
      ["hashPassword", "a-long-new-password"],
      ["confirmPasswordReset", { tokenHash: "token-hash", passwordHash: "password-hash" }],
      ["deliverAccountSecurityEmailIntent", { intentId: "intent-recovered" }],
    ])
    assert.equal(capturedTimes.eligibility instanceof Date, true)
    assert.equal(Object.hasOwn(capturedTimes.confirmationInput, "now"), false)
    assert.equal(Object.hasOwn(capturedTimes.confirmationInput, "clock"), false)
  })

  it("returns success before deferred delivery and settles a rejected delivery safely", async () => {
    const { POST, calls, afterCallbacks } = loadRoute({
      deliver: async () => { throw new Error("delivery unavailable") },
    })

    const response = await POST(resetRequest({
      token: "raw-reset-token",
      password: "a-long-new-password",
    }))

    assert.deepEqual(response, {
      body: { message: "Password updated. You can sign in now." },
      status: 200,
    })
    assert.equal(calls.some(([name]) => name === "deliverAccountSecurityEmailIntent"), false)
    assert.equal(afterCallbacks.length, 1)
    await assert.doesNotReject(() => afterCallbacks[0]())
    assert.equal(calls.some(([name]) => name === "deliverAccountSecurityEmailIntent"), true)
  })

  for (const [article, condition] of [["a", "missing"], ["an", "expired"], ["a", "consumed"]]) {
    it(`rejects ${article} ${condition} token before password hashing or mutation handoff`, async () => {
      const { POST, calls } = loadRoute({ eligible: false })

      const response = await POST(resetRequest({
        token: "raw-reset-token",
        password: "a-long-new-password",
      }))

      assert.deepEqual(response, {
        body: { message: "This reset link is expired or has already been used." },
        status: 400,
      })
      assert.deepEqual(calls, [
        ["hashToken", "raw-reset-token"],
        ["isPasswordResetTokenEligible", { tokenHash: "token-hash" }],
      ])
    })
  }

  it("preserves the invalid-link response when eligibility passes but the transactional claim loses", async () => {
    const { POST, calls } = loadRoute({ result: { status: "INVALID" } })

    const response = await POST(resetRequest({
      token: "raw-reset-token",
      password: "a-long-new-password",
    }))

    assert.deepEqual(response, {
      body: { message: "This reset link is expired or has already been used." },
      status: 400,
    })
    assert.deepEqual(calls, [
      ["hashToken", "raw-reset-token"],
      ["isPasswordResetTokenEligible", { tokenHash: "token-hash" }],
      ["hashPassword", "a-long-new-password"],
      ["confirmPasswordReset", { tokenHash: "token-hash", passwordHash: "password-hash" }],
    ])
  })

  it("does not freeze authoritative claim time while Argon2 hashing is in progress", async () => {
    const RealDate = globalThis.Date
    let currentTime = "2026-08-12T12:00:00.000Z"
    class ControlledDate extends RealDate {
      constructor(...args) {
        super(...(args.length === 0 ? [currentTime] : args))
      }
    }
    globalThis.Date = ControlledDate

    try {
      const { POST, calls, capturedTimes } = loadRoute({
        hashPassword: async () => {
          currentTime = "2026-08-12T12:00:02.000Z"
          return "password-hash"
        },
        result: (input) => {
          assert.equal(Object.hasOwn(input, "now"), false)
          assert.equal(Object.hasOwn(input, "clock"), false)
          return { status: "INVALID" }
        },
      })

      const response = await POST(resetRequest({
        token: "raw-reset-token",
        password: "a-long-new-password",
      }))

      assert.deepEqual(response, {
        body: { message: "This reset link is expired or has already been used." },
        status: 400,
      })
      assert.deepEqual(calls, [
        ["hashToken", "raw-reset-token"],
        ["isPasswordResetTokenEligible", { tokenHash: "token-hash" }],
        ["hashPassword", "a-long-new-password"],
        ["confirmPasswordReset", { tokenHash: "token-hash", passwordHash: "password-hash" }],
      ])
      assert.equal(capturedTimes.eligibility.toISOString(), "2026-08-12T12:00:00.000Z")
      assert.equal(Object.hasOwn(capturedTimes.confirmationInput, "now"), false)
      assert.equal(Object.hasOwn(capturedTimes.confirmationInput, "clock"), false)
    } finally {
      globalThis.Date = RealDate
    }
  })

  it("does not inspect issuer evidence or write reset rows directly", () => {
    assert.doesNotMatch(routeSource, /passwordResetToken\.(findUnique|update)/)
    assert.doesNotMatch(routeSource, /passwordCredential\.upsert/)
    assert.doesNotMatch(routeSource, /\$transaction|\.(?:create|updateMany|upsert|deleteMany)\s*\(/)
    assert.doesNotMatch(routeSource, /issuer|adminAction/i)
    assert.doesNotMatch(routeSource, /\b(?:console|logger)\s*\./)
    assert.doesNotMatch(routeSource, /\bselect\s*:/)
  })
})
