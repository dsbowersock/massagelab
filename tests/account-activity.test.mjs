import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)

const accountPageSource = await readFile(new URL("../app/account/page.tsx", import.meta.url), "utf8")
const adminDetailSource = await readFile(new URL("../app/admin/users/[userId]/page.tsx", import.meta.url), "utf8")
const emailActionSource = await readFile(new URL("../app/admin/users/[userId]/email-actions.ts", import.meta.url), "utf8").catch(() => "")
const retryFormSource = await readFile(new URL("../app/admin/users/[userId]/retry-email-form.tsx", import.meta.url), "utf8").catch(() => "")
const securityFormSource = await readFile(new URL("../app/admin/users/[userId]/security-action-forms.tsx", import.meta.url), "utf8").catch(() => "")

const idleState = { status: "idle", message: "" }

/**
 * Compiles the retry action with a delivered result by default. A serviceError
 * overrides that result; the returned action and ordered calls expose every
 * authorization, service, safe-code, and revalidation interaction.
 */
function retryActionHarness({
  serviceResult = { status: "DELIVERED", attemptCount: 2, attempted: true, replayed: false },
  serviceError,
  safeCode = "provider_error",
} = {}) {
  const calls = []
  const compiledAction = loadCompiledModule(emailActionSource, "app/admin/users/[userId]/email-actions.test.ts", {
    "next/cache": { revalidatePath(path) { calls.push(["revalidatePath", path]) } },
    "@/lib/admin/access": { async requireFullAdminUser() { calls.push(["requireFullAdminUser"]); return { id: "admin-1" } } },
    "@/lib/admin/email-intents": {
      async retryAdminEmailIntent(input) {
        calls.push(["retryAdminEmailIntent", input])
        if (serviceError) throw serviceError
        return serviceResult
      },
    },
    "@/lib/prisma": { prisma: { marker: "prisma" } },
    "@/lib/safe-error-code": {
      safeErrorCode(error) {
        calls.push(["safeErrorCode", error])
        return safeCode
      },
    },
  })
  return { action: compiledAction.retryFailedEmailIntentAction, calls }
}

function retryForm({ intentId = "intent-1", operationId = "b7653eb8-0f7b-43b8-9d31-6657ab6c3a22" } = {}) {
  const formData = new FormData()
  formData.set("intentId", intentId)
  formData.set("operationId", operationId)
  return formData
}

describe("account activity surfaces", () => {
  it("renders a signed-in activity tab with an empty state and accessible timestamps", () => {
    assert.match(accountPageSource, /function ActivityTab/)
    assert.match(accountPageSource, /id="account-activity"/)
    assert.match(accountPageSource, /No account activity yet/i)
    assert.match(accountPageSource, /<time dateTime=\{entry\.occurredAt\}/)
    assert.match(accountPageSource, /activity:\s*"Sign in"/)
  })

  it("renders an explicit retry for recoverable pending or failed non-password email intents", () => {
    assert.match(retryFormSource, /Retry email notification/)
    assert.match(adminDetailSource, /const canRetry = email\?\.retryEligible === true/)
    assert.match(adminDetailSource, /failedPasswordReset[\s\S]*FreshPasswordResetForm/)
    assert.match(securityFormSource, /Send a new reset link/)
    assert.match(securityFormSource, /sendAdminPasswordResetAction\.bind\(null, userId\)/)
    assert.doesNotMatch(emailActionSource, /sendAdminPasswordReset/)
    assert.match(emailActionSource, /"use server"/)
    assert.match(emailActionSource, /requireFullAdminUser\(\)/)
    assert.match(emailActionSource, /retryAdminEmailIntent\(/)
    assert.match(adminDetailSource, /const operationId = randomUUID\(\)/)
    assert.match(adminDetailSource, /<RetryEmailForm[\s\S]*operationId=\{operationId\}/)
    assert.match(retryFormSource, /useActionState\([\s\S]*retryFailedEmailIntentAction\.bind\(null, userId\)/)
    assert.match(retryFormSource, /type="hidden" name="operationId" value=\{operationId\}/)
    assert.match(retryFormSource, /role=\{actionState\.status === "error" \? "alert" : "status"\}/)
    assert.match(emailActionSource, /formData\.get\("operationId"\)/)
    assert.match(emailActionSource, /expectedTargetUserId: userId/)
    assert.doesNotMatch(emailActionSource, /crypto\.randomUUID\(\)/)
    assert.match(emailActionSource, /revalidatePath\(`\/admin\/users\/\$\{encodeURIComponent\(userId\)\}`\)/)
  })

  it("returns safe error state for invalid retry fields before invoking the service", async () => {
    const { action, calls } = retryActionHarness()

    const result = await action("user-1", idleState, retryForm({ intentId: "" }))

    assert.deepEqual(result, { status: "error", message: "Choose a valid email notification." })
    assert.deepEqual(calls, [["requireFullAdminUser"]])
  })

  it("returns success or delivery-failure state and refreshes persisted results", async () => {
    const success = retryActionHarness()
    const successResult = await success.action("user-1", idleState, retryForm())
    assert.deepEqual(successResult, { status: "success", message: "Email notification retried." })
    assert.equal(success.calls[1][1].expectedTargetUserId, "user-1")
    assert.equal(success.calls[1][1].idempotencyKey, "b7653eb8-0f7b-43b8-9d31-6657ab6c3a22")
    assert.deepEqual(success.calls[2], ["revalidatePath", "/admin/users/user-1"])

    const alreadyDelivered = retryActionHarness({
      serviceResult: { status: "DELIVERED", attemptCount: 2, attempted: false, replayed: true },
    })
    const alreadyDeliveredResult = await alreadyDelivered.action("user-1", idleState, retryForm())
    assert.deepEqual(alreadyDeliveredResult, {
      status: "success",
      message: "The email notification was already delivered; no new send was attempted.",
    })
    assert.deepEqual(alreadyDelivered.calls[2], ["revalidatePath", "/admin/users/user-1"])

    const failed = retryActionHarness({
      serviceResult: { status: "FAILED", attemptCount: 2, attempted: true, replayed: false },
    })
    const failedResult = await failed.action("user-1", idleState, retryForm())
    assert.deepEqual(failedResult, { status: "error", message: "The email could not be delivered. You can retry again." })
    assert.deepEqual(failed.calls[2], ["revalidatePath", "/admin/users/user-1"])

    const replayedFailure = retryActionHarness({
      serviceResult: { status: "FAILED", attemptCount: 2, attempted: false, replayed: true },
    })
    const replayedFailureResult = await replayedFailure.action("user-1", idleState, retryForm())
    assert.deepEqual(replayedFailureResult, {
      status: "error",
      message: "The earlier email delivery attempt failed; no new send was attempted. You can retry again.",
    })
    assert.deepEqual(replayedFailure.calls[2], ["revalidatePath", "/admin/users/user-1"])

    for (const serviceResult of [
      { status: "BUSY", attemptCount: 2, attempted: false, replayed: false },
      { status: "AMBIGUOUS", attemptCount: 2, attempted: true, replayed: false },
    ]) {
      const unconfirmed = retryActionHarness({ serviceResult })
      const result = await unconfirmed.action("user-1", idleState, retryForm())
      assert.deepEqual(result, {
        status: "error",
        message: "Email delivery could not be confirmed. Check Activity before retrying.",
      }, serviceResult.status)
      assert.doesNotMatch(result.message, /could not be delivered/i, serviceResult.status)
    }
  })

  it("converts service exceptions into a generic retry error without leaking details", async () => {
    const serviceError = new Error("provider secret")
    const { action, calls } = retryActionHarness({ serviceError })
    const logged = []
    const originalConsoleError = console.error
    console.error = (...args) => logged.push(args)
    let result
    try {
      result = await action("user-1", idleState, retryForm())
    } finally {
      console.error = originalConsoleError
    }

    assert.deepEqual(result, { status: "error", message: "The email retry could not be completed." })
    assert.doesNotMatch(result.message, /provider secret/)
    assert.deepEqual(calls.at(-1), ["safeErrorCode", serviceError])
    assert.deepEqual(logged, [["Admin email retry failed", { intentId: "intent-1", code: "provider_error" }]])
    assert.doesNotMatch(JSON.stringify(logged), /provider secret|user-1|b7653eb8|operationId|recipient/i)
    assert.equal(logged.flat(Infinity).includes(serviceError), false)
  })
})
