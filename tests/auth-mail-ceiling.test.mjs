import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const authMailSource = await readFile(new URL("../lib/auth-mail.ts", import.meta.url), "utf8")
const DELIVERY_BUDGET_EXPORT_PATTERN = /export const ACCOUNT_CHANGE_EMAIL_DELIVERY_BUDGET_MS = SMTP_DNS_TIMEOUT_MS\s*\+\s*SMTP_CONNECTION_TIMEOUT_MS\s*\+\s*SMTP_GREETING_TIMEOUT_MS\s*\+\s*SMTP_SOCKET_TIMEOUT_MS/

/** Loads the private mail boundary with provider and limiter doubles only. */
function loadAuthMail({
  decisions = [],
  send = async () => ({ accepted: ["recipient"] }),
  deliveryBudgetMs,
} = {}) {
  const limiterCalls = []
  const transportOptions = []
  const messages = []
  let closed = 0
  // Direct injection is unavailable at this private boundary, so the test rewrites the
  // module constant and exposes sendMail. Keep DELIVERY_BUDGET_EXPORT_PATTERN synchronized
  // with the production export so a changed deadline definition fails before replacement.
  const boundedSource = deliveryBudgetMs === undefined
    ? authMailSource
    : (() => {
        assert.match(authMailSource, DELIVERY_BUDGET_EXPORT_PATTERN)
        return authMailSource.replace(
          DELIVERY_BUDGET_EXPORT_PATTERN,
          `export const ACCOUNT_CHANGE_EMAIL_DELIVERY_BUDGET_MS = ${deliveryBudgetMs}`,
        )
      })()
  const instrumentedSource = `${boundedSource}\nexport const __testSendMail = sendMail\n`
  const authMailModule = loadCompiledModule(instrumentedSource, "auth-mail-ceiling.review-test.ts", {
    "nodemailer-v9": {
      createTransport(options) {
        transportOptions.push(options)
        return {
          async sendMail(message) {
            messages.push(message)
            return send(message)
          },
          close() {
            closed += 1
          },
        }
      },
    },
    "./auth-env.ts": { getSiteUrl: () => "https://massagelab.example" },
    "./auth-registration.js": {
      buildVerificationEmailUrl: (_siteUrl, token, callbackUrl) => (
        `https://massagelab.example/verify-email?token=${token}&callbackUrl=${encodeURIComponent(callbackUrl ?? "/onboarding")}`
      ),
    },
    "./operational-rate-limit.ts": {
      async consumeOperationalRateLimit(request) {
        limiterCalls.push(request)
        return decisions.shift() ?? { allowed: true }
      },
    },
  })

  return {
    module: authMailModule,
    limiterCalls,
    transportOptions,
    messages,
    get closed() { return closed },
  }
}

/** Temporarily supplies either a complete or absent SMTP configuration. */
async function withSmtpConfig(configured, callback) {
  const names = ["SMTP_HOST", "SMTP_FROM", "SMTP_USER", "SMTP_PASSWORD", "SMTP_PORT"]
  const previous = new Map(names.map((name) => [name, process.env[name]]))
  try {
    for (const name of names) delete process.env[name]
    if (configured) {
      process.env.SMTP_HOST = "smtp.example"
      process.env.SMTP_FROM = "noreply@example.test"
      process.env.SMTP_PORT = "587"
    }
    return await callback()
  } finally {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  }
}

describe("global authentication mail ceiling", () => {
  it("matches only the intended delivery-budget export expression", () => {
    const splitExpression = `
export const ACCOUNT_CHANGE_EMAIL_DELIVERY_BUDGET_MS = SMTP_DNS_TIMEOUT_MS
export const unrelatedBudget = SMTP_CONNECTION_TIMEOUT_MS
  + SMTP_GREETING_TIMEOUT_MS
  + SMTP_SOCKET_TIMEOUT_MS
`

    assert.doesNotMatch(splitExpression, DELIVERY_BUDGET_EXPORT_PATTERN)
  })

  it("does not consume quota or construct a transporter when SMTP is unconfigured", async () => {
    const fixture = loadAuthMail()

    const result = await withSmtpConfig(false, () => (
      fixture.module.sendVerificationEmail("member@example.com", "token")
    ))

    assert.equal(result.delivered, false)
    assert.deepEqual(fixture.limiterCalls, [])
    assert.deepEqual(fixture.transportOptions, [])
    assert.deepEqual(fixture.messages, [])
  })

  it("classifies verification, reset, setup, and existing-account mail as public auth", async () => {
    const fixture = loadAuthMail()

    await withSmtpConfig(true, async () => {
      await fixture.module.sendVerificationEmail("member@example.com", "verification")
      await fixture.module.sendPasswordResetEmail("member@example.com", "reset")
      await fixture.module.sendPasswordSetupEmail("member@example.com", "setup", true)
      await fixture.module.sendExistingAccountRegistrationNotice("member@example.com")
    })

    assert.deepEqual(fixture.limiterCalls, [
      { operation: "EMAIL_PUBLIC_AUTH" },
      { operation: "EMAIL_PUBLIC_AUTH" },
      { operation: "EMAIL_PUBLIC_AUTH" },
      { operation: "EMAIL_PUBLIC_AUTH" },
    ])
    assert.equal(fixture.transportOptions.length, 4)
    assert.equal(fixture.messages.length, 4)
    assert.match(fixture.messages[3].subject, /MassageLab account sign-in request/)
    assert.match(fixture.messages[3].text, /existing password/i)
  })

  it("classifies account-change notifications as security mail", async () => {
    const fixture = loadAuthMail()

    const result = await withSmtpConfig(true, () => fixture.module.sendAccountChangeEmail(
      "member@example.com",
      "Your MassageLab account changed",
      "If this was not you, recover your account.",
    ))

    assert.deepEqual(result, { delivered: true })
    assert.deepEqual(fixture.limiterCalls, [{ operation: "EMAIL_SECURITY" }])
    assert.equal(fixture.messages.length, 1)
  })

  it("fails closed silently without constructing a transporter when quota denies or is unavailable", { concurrency: false }, async () => {
    const fixture = loadAuthMail({
      decisions: [
        { allowed: false, reason: "RATE_LIMITED", retryAfterSeconds: 30 },
        { allowed: false, reason: "UNAVAILABLE" },
      ],
    })

    const originalConsole = {
      debug: console.debug,
      error: console.error,
      info: console.info,
      log: console.log,
      warn: console.warn,
    }
    const consoleCalls = []
    console.debug = (...args) => consoleCalls.push(["debug", ...args])
    console.error = (...args) => consoleCalls.push(["error", ...args])
    console.info = (...args) => consoleCalls.push(["info", ...args])
    console.log = (...args) => consoleCalls.push(["log", ...args])
    console.warn = (...args) => consoleCalls.push(["warn", ...args])
    let results
    try {
      results = await withSmtpConfig(true, async () => [
        await fixture.module.sendVerificationEmail("member@example.com", "one"),
        await fixture.module.sendAccountChangeEmail("member@example.com", "Notice", "Message"),
      ])
    } finally {
      console.debug = originalConsole.debug
      console.error = originalConsole.error
      console.info = originalConsole.info
      console.log = originalConsole.log
      console.warn = originalConsole.warn
    }

    assert.deepEqual(results.map(({ delivered }) => delivered), [false, false])
    assert.deepEqual(fixture.limiterCalls, [
      { operation: "EMAIL_PUBLIC_AUTH" },
      { operation: "EMAIL_SECURITY" },
    ])
    assert.deepEqual(fixture.transportOptions, [])
    assert.deepEqual(fixture.messages, [])
    assert.deepEqual(consoleCalls, [])
    assert.match(
      authMailSource,
      /Expected limiter denials are intentionally silent at this shared mail boundary[\s\S]*aggregate or sampled caller telemetry[\s\S]*allowlisted mail class\/policy and reason[\s\S]*never recipient, subject, or decision details/i,
    )
  })

  it("attempts SMTP exactly once after an allowed decision and does not refund failures", async () => {
    const fixture = loadAuthMail({
      decisions: [{ allowed: true }],
      send: async () => { throw new Error("provider detail must stay private") },
    })

    const originalConsoleError = console.error
    console.error = () => {}
    try {
      const result = await withSmtpConfig(true, () => (
        fixture.module.sendPasswordResetEmail("member@example.com", "reset")
      ))
      assert.equal(result.delivered, false)
    } finally {
      console.error = originalConsoleError
    }

    assert.deepEqual(fixture.limiterCalls, [{ operation: "EMAIL_PUBLIC_AUTH" }])
    assert.equal(fixture.transportOptions.length, 1)
    assert.equal(fixture.messages.length, 1)
  })

  it("keeps the allowed attempt charged when the SMTP deadline closes a hung provider", async () => {
    const fixture = loadAuthMail({
      decisions: [{ allowed: true }],
      deliveryBudgetMs: 1,
      send: () => new Promise(() => {}),
    })

    const originalConsoleError = console.error
    console.error = () => {}
    try {
      const result = await withSmtpConfig(true, () => (
        fixture.module.sendVerificationEmail("member@example.com", "verification")
      ))
      assert.equal(result.delivered, false)
    } finally {
      console.error = originalConsoleError
    }

    assert.deepEqual(fixture.limiterCalls, [{ operation: "EMAIL_PUBLIC_AUTH" }])
    assert.equal(fixture.transportOptions.length, 1)
    assert.equal(fixture.messages.length, 1)
    assert.equal(fixture.closed, 1)
  })

  it("rejects an unknown private classification before quota or SMTP work", async () => {
    const fixture = loadAuthMail()

    const result = await withSmtpConfig(true, () => fixture.module.__testSendMail(
      "UNKNOWN",
      "member@example.com",
      "Subject",
      "Message",
    ))

    assert.deepEqual(result, { delivered: false })
    assert.deepEqual(fixture.limiterCalls, [])
    assert.deepEqual(fixture.transportOptions, [])
    assert.deepEqual(fixture.messages, [])
  })
})
