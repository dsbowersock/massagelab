import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import {
  createCompiledModuleLoader,
  createElement,
  elementText,
  findElement,
  findElements,
  passThroughElement,
  renderFunctionComponents,
} from "./helpers/compiled-module.mjs"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const actionSource = await readFile(new URL("../app/admin/users/[userId]/credit-actions.ts", import.meta.url), "utf8").catch(() => "")
const formSource = await readFile(new URL("../app/admin/users/[userId]/credit-action-form.tsx", import.meta.url), "utf8").catch(() => "")
const pageSource = await readFile(new URL("../app/admin/users/[userId]/page.tsx", import.meta.url), "utf8")
const detailSource = await readFile(new URL("../lib/admin/user-detail.ts", import.meta.url), "utf8")
const browserSource = await readFile(new URL("browser/admin-user-operations.spec.ts", import.meta.url), "utf8")

const idleState = { status: "idle", message: "" }
const operationId = "42b90a0b-41d5-48f8-b798-b6da77178b67"

function creditActionHarness({
  actorUserId = "admin-1",
  serviceResult = {
    previousBalance: 2,
    amount: 5,
    balanceAfter: 7,
    replayed: false,
    emailIntentId: "intent-credit",
  },
  serviceError,
  deliveryResult = { status: "DELIVERED", attemptCount: 1, attempted: true },
  deliveryError,
} = {}) {
  const calls = []
  const compiled = loadCompiledModule(actionSource, "app/admin/users/[userId]/credit-actions.test.ts", {
    "next/cache": { revalidatePath(path) { calls.push(["revalidatePath", path]) } },
    "@/lib/admin/access": {
      async requireFullAdminUser() {
        calls.push(["requireFullAdminUser"])
        return { id: actorUserId }
      },
    },
    "@/lib/admin/email-intents": {
      async deliverAdminEmailIntent(input) {
        calls.push(["deliverAdminEmailIntent", input])
        if (deliveryError) throw deliveryError
        return deliveryResult
      },
    },
    "@/lib/admin/operation-contract": {
      ADMIN_REASON_CODES: ["BACKGROUND_CREDIT_GOODWILL", "ADMIN_CORRECTION", "OTHER"],
      validateAdminReason(reasonCode, note) {
        calls.push(["validateAdminReason", reasonCode, note])
        if (!["BACKGROUND_CREDIT_GOODWILL", "ADMIN_CORRECTION", "OTHER"].includes(reasonCode)) throw new Error("invalid reason")
        if (note?.length > 500 || (reasonCode === "OTHER" && !note?.trim())) throw new Error("invalid note")
      },
    },
    "@/lib/commerce/credit-service": {
      async grantAdminBackgroundCredits(input) {
        calls.push(["grantAdminBackgroundCredits", input])
        if (serviceError) throw serviceError
        return serviceResult
      },
    },
    "@/lib/prisma": { prisma: { marker: "prisma" } },
    "@/lib/safe-error-code": { safeErrorCode() { calls.push(["safeErrorCode"]); return "safe_failure" } },
  })
  return { action: compiled.grantBackgroundCreditsAction, calls }
}

function creditForm(overrides = {}) {
  const values = {
    targetUserId: "user-1",
    operationId,
    amount: "5",
    expectedBalance: "2",
    reasonCode: "BACKGROUND_CREDIT_GOODWILL",
    internalNote: "",
    confirmation: "CONFIRM_BACKGROUND_CREDIT_GRANT",
    ...overrides,
  }
  const formData = new FormData()
  for (const [key, value] of Object.entries(values)) formData.set(key, value)
  return formData
}

function creditUiHarness(actionState = idleState, { useState } = {}) {
  return loadCompiledModule(formSource, "app/admin/users/[userId]/credit-action-form.test.tsx", {
    react: {
      useActionState: () => [actionState, () => {}, false],
      useId: () => "credit-form",
      useState: useState ?? ((initialValue) => [initialValue, () => {}]),
    },
    "react/jsx-runtime": { Fragment: "fragment", jsx: createElement, jsxs: createElement },
    "@/components/ui/button": { Button: passThroughElement("button") },
    "@/lib/admin/operation-contract": {
      ADMIN_REASON_CODES: ["BACKGROUND_CREDIT_GOODWILL", "ADMIN_CORRECTION", "OTHER"],
    },
    "./credit-actions": { grantBackgroundCreditsAction() {}, CreditGrantActionState: {} },
  })
}

describe("Admin background-credit action", () => {
  it("authenticates before validation, binds the route target, and never generates a submission-time key", async () => {
    assert.match(actionSource, /^"use server"/)
    assert.doesNotMatch(actionSource, /randomUUID/)
    const harness = creditActionHarness()
    const result = await harness.action("user-1", idleState, creditForm({ targetUserId: "user-2" }))
    assert.deepEqual(result, { status: "error", message: "Refresh this account before adding background credits." })
    assert.deepEqual(harness.calls, [["requireFullAdminUser"]])
  })

  it("rejects malformed amount, prepared balance, key, confirmation, reason, and note before mutation", async () => {
    for (const invalid of [
      { amount: "0" }, { amount: "26" }, { amount: "1.5" }, { amount: "1e1" },
      { expectedBalance: "-1" }, { expectedBalance: "0.5" }, { expectedBalance: "1e2" },
      { operationId: "not-a-uuid" }, { confirmation: "yes" }, { reasonCode: "NOT_ALLOWED" },
      { reasonCode: "OTHER", internalNote: "" }, { internalNote: "x".repeat(501) },
    ]) {
      const harness = creditActionHarness()
      const result = await harness.action("user-1", idleState, creditForm(invalid))
      assert.equal(result.status, "error")
      assert.equal(harness.calls.some(([name]) => name === "grantAdminBackgroundCredits"), false)
    }
  })

  it("calls exactly one canonical service, then initial delivery, then Access, Activity, and directory revalidation", async () => {
    const harness = creditActionHarness()
    const result = await harness.action("user-1", idleState, creditForm())

    assert.deepEqual(result, {
      status: "success",
      message: "5 background credits were added. The balance changed from 2 to 7. Email notification delivered.",
    })
    assert.deepEqual(harness.calls[0], ["requireFullAdminUser"])
    assert.deepEqual(harness.calls[1], ["validateAdminReason", "BACKGROUND_CREDIT_GOODWILL", null])
    assert.deepEqual(harness.calls[2], ["grantAdminBackgroundCredits", {
      prismaClient: { marker: "prisma" },
      actorUserId: "admin-1",
      targetUserId: "user-1",
      amount: 5,
      expectedBalance: 2,
      reasonCode: "BACKGROUND_CREDIT_GOODWILL",
      internalNote: null,
      idempotencyKey: operationId,
    }])
    assert.equal(harness.calls.filter(([name]) => name === "grantAdminBackgroundCredits").length, 1)
    assert.deepEqual(harness.calls[3], ["deliverAdminEmailIntent", { prismaClient: { marker: "prisma" }, intentId: "intent-credit" }])
    assert.deepEqual(harness.calls.slice(4), [
      ["revalidatePath", "/admin/users/user-1"],
      ["revalidatePath", "/admin/users"],
    ])
  })

  it("keeps committed mutation, replay, and notification outcomes truthful and distinct", async () => {
    const failed = creditActionHarness({ deliveryResult: { status: "FAILED", attemptCount: 1, attempted: true } })
    assert.deepEqual(await failed.action("user-1", idleState, creditForm()), {
      status: "warning",
      message: "5 background credits were added. The balance changed from 2 to 7. The email notification failed. Retry it from Activity.",
    })

    const replay = creditActionHarness({
      serviceResult: {
        previousBalance: 2, amount: 5, balanceAfter: 7, replayed: true, emailIntentId: "intent-credit",
      },
      deliveryResult: { status: "DELIVERED", attemptCount: 1, attempted: false },
    })
    assert.deepEqual(await replay.action("user-1", idleState, creditForm()), {
      status: "success",
      message: "This background-credit grant was already completed. The balance remains 7. The email notification was already delivered; no new send was attempted.",
    })

    const failedReplay = creditActionHarness({
      serviceResult: {
        previousBalance: 2, amount: 5, balanceAfter: 7, replayed: true, emailIntentId: "intent-credit",
      },
      deliveryResult: { status: "FAILED", attemptCount: 1, attempted: false },
    })
    assert.deepEqual(await failedReplay.action("user-1", idleState, creditForm()), {
      status: "warning",
      message: "This background-credit grant was already completed. The balance remains 7. The email notification is recorded as failed; no new send was attempted. Check Activity for the available next step.",
    })

    const pendingReplay = creditActionHarness({
      serviceResult: {
        previousBalance: 2, amount: 5, balanceAfter: 7, replayed: true, emailIntentId: "intent-credit",
      },
    })
    assert.deepEqual(await pendingReplay.action("user-1", idleState, creditForm()), {
      status: "success",
      message: "This background-credit grant was already completed. The balance remains 7. Its pending email notification was delivered.",
    })

    const unconfirmed = creditActionHarness({ deliveryError: new Error("provider recipient detail") })
    const originalConsoleError = console.error
    console.error = () => {}
    try {
      assert.deepEqual(await unconfirmed.action("user-1", idleState, creditForm()), {
        status: "warning",
        message: "5 background credits were added. The balance changed from 2 to 7. Email delivery could not be confirmed. Check Activity before retrying.",
      })
    } finally {
      console.error = originalConsoleError
    }
    assert.deepEqual(unconfirmed.calls.slice(-2), [
      ["revalidatePath", "/admin/users/user-1"],
      ["revalidatePath", "/admin/users"],
    ])
  })

  it("records a self-target delivery failure without promising the suppressed Activity retry control", async () => {
    const selfTarget = creditActionHarness({
      actorUserId: "user-1",
      deliveryResult: { status: "FAILED", attemptCount: 1, attempted: true },
    })

    const result = await selfTarget.action("user-1", idleState, creditForm())

    assert.deepEqual(result, {
      status: "warning",
      message: "5 background credits were added. The balance changed from 2 to 7. The email notification failed. Check Activity for the recorded notification status.",
    })
    assert.doesNotMatch(result.message, /retry/i)
    assert.match(pageSource, /canMutate=\{actor\.id !== userId\}/)
    assert.match(pageSource, /\{creditEvidence \? \([\s\S]*<CreditGrantControls/)
  })

  it("keeps self-target fresh and replayed delivery uncertainty free of retry promises", async () => {
    for (const serviceResult of [
      {
        previousBalance: 2, amount: 5, balanceAfter: 7, replayed: false, emailIntentId: "intent-credit",
      },
      {
        previousBalance: 2, amount: 5, balanceAfter: 7, replayed: true, emailIntentId: "intent-credit",
      },
    ]) {
      const harness = creditActionHarness({
        actorUserId: "user-1",
        serviceResult,
        deliveryError: new Error("provider recipient detail"),
      })
      const originalConsoleError = console.error
      console.error = () => {}
      let result
      try {
        result = await harness.action("user-1", idleState, creditForm())
      } finally {
        console.error = originalConsoleError
      }
      assert.equal(result.status, "warning")
      assert.match(result.message, /Check Activity for the recorded notification status\./)
      assert.doesNotMatch(result.message, /retry/i)
    }
  })

  it("preserves safe stale-state guidance, hides unknown failures, and never delivers or revalidates a failed mutation", async () => {
    const safeMessage = "The background credit balance changed since this grant was prepared. Refresh the account and try again."
    for (const [serviceError, expectedMessage] of [
      [new Error(safeMessage), safeMessage],
      [new Error("database target@example.test secret"), "Background credits could not be added. Refresh the account and try again."],
    ]) {
      const harness = creditActionHarness({ serviceError })
      const logged = []
      const originalConsoleError = console.error
      console.error = (...args) => logged.push(args)
      try {
        const result = await harness.action("user-1", idleState, creditForm())
        assert.deepEqual(result, { status: "error", message: expectedMessage })
      } finally {
        console.error = originalConsoleError
      }
      assert.equal(harness.calls.some(([name]) => name === "deliverAdminEmailIntent"), false)
      assert.equal(harness.calls.some(([name]) => name === "revalidatePath"), false)
      assert.doesNotMatch(JSON.stringify(logged), /user-1|target@example\.test|42b90a0b|database/i)
    }
  })
})

describe("Admin background-credit controls", () => {
  it("renders only for verified targets with explicit usable wallet evidence and a stable server UUID", () => {
    assert.match(pageSource, /creditGrant:\s*randomUUID\(\)/)
    assert.match(pageSource, /detail\.emailVerified === true && normalizedTargetEmail/)
    assert.match(pageSource, /readCreditGrantEvidence/)
    assert.match(pageSource, /<CreditGrantControls/)
    assert.match(detailSource, /emailVerified: Boolean\(user\.emailVerified\)/)
    assert.match(detailSource, /state: user\.backgroundCreditWallet \? "AVAILABLE" : "MISSING"/)
    assert.match(formSource, /type="hidden" name="operationId" value=\{operationId\}/)
    assert.doesNotMatch(`${actionSource}\n${formSource}`, /cannot (?:grant|add).*own account/i)
  })

  it("renders presets and bounded custom input with target, current, Admin delta, and resulting balance", () => {
    const { CreditGrantControls } = creditUiHarness()
    const tree = renderFunctionComponents(CreditGrantControls({
      userId: "user-1",
      targetLabel: "Target User (target@example.test)",
      preparedBalance: 4,
      automaticInitialCredits: 0,
      operationId,
    }))
    assert.match(elementText(tree), /Target User \(target@example\.test\)/)
    assert.match(elementText(tree), /Current balance: 4/)
    assert.match(elementText(tree), /Admin grant: \+1/)
    assert.match(elementText(tree), /Resulting balance: 5/)
    const presetButtons = findElements(tree, (element) => element.type === "button" && element.props.type === "button")
    assert.deepEqual(presetButtons.map(elementText), ["+1", "+2", "+5", "+10"])
    const presetGroup = findElement(tree, (element) => element.props.role === "group" && element.props["aria-label"] === "Credit amount presets")
    assert.ok(presetGroup)
    assert.deepEqual(presetButtons.map((button) => button.props["aria-pressed"]), [true, false, false, false])
    const custom = findElement(tree, (element) => element.type === "input" && element.props.name === "amount")
    assert.deepEqual({ type: custom.props.type, min: custom.props.min, max: custom.props.max, step: custom.props.step }, {
      type: "number", min: 1, max: 25, step: 1,
    })
    assert.doesNotMatch(elementText(tree), /subtract|negative|set balance|exact balance/i)
  })

  it("clears confirmation after either a preset or custom amount change", () => {
    const setterCalls = []
    let hookIndex = 0
    const values = ["1", "BACKGROUND_CREDIT_GOODWILL", "", true]
    const { CreditGrantControls } = creditUiHarness(idleState, {
      useState(initialValue) {
        const index = hookIndex
        hookIndex += 1
        return [values[index] ?? initialValue, (value) => setterCalls.push([index, value])]
      },
    })
    const tree = renderFunctionComponents(CreditGrantControls({
      userId: "user-1", targetLabel: "Target User", preparedBalance: 2, automaticInitialCredits: 0, operationId,
    }))
    const fivePreset = findElement(tree, (element) => element.type === "button" && elementText(element) === "+5")
    const customAmount = findElement(tree, (element) => element.type === "input" && element.props.name === "amount")

    fivePreset.props.onClick()
    customAmount.props.onChange({ target: { value: "3" } })

    assert.deepEqual(setterCalls, [[0, "5"], [3, false], [0, "3"], [3, false]])
    assert.match(formSource, /setConfirmed\(false\)/)
  })

  it("explains missing-wallet initial allocation while submitting prepared zero", () => {
    const { CreditGrantControls } = creditUiHarness()
    const tree = renderFunctionComponents(CreditGrantControls({
      userId: "user-1",
      targetLabel: "Target User",
      preparedBalance: 0,
      automaticInitialCredits: 2,
      operationId,
    }))
    assert.match(elementText(tree), /Current persisted balance: 0/)
    assert.match(elementText(tree), /Automatic verified-account allocation: \+2/)
    assert.match(elementText(tree), /Resulting balance: 2 \+ 1 = 3/)
    const expectedBalance = findElement(tree, (element) => element.type === "input" && element.props.name === "expectedBalance")
    assert.equal(expectedBalance.props.value, 0)
  })

  it("keeps outcome live regions outside the keyed mutable fields so feedback survives revalidation", () => {
    const { CreditGrantControls } = creditUiHarness({ status: "success", message: "Credits added." })
    const controls = CreditGrantControls({
      userId: "user-1", targetLabel: "Target User", preparedBalance: 2, automaticInitialCredits: 0, operationId,
    })
    const fields = findElement(controls, (element) => typeof element.type === "function" && element.type.name === "CreditGrantFields")
    assert.equal(fields.key, `${operationId}:2`)
    assert.equal(Object.hasOwn(fields.props, "actionState"), false)
    const liveRegions = findElements(controls, (element) => element.type === "p" && (element.props.role === "status" || element.props.role === "alert"))
    assert.deepEqual(liveRegions.map((region) => region.props.role), ["status", "status", "alert"])
    assert.deepEqual(liveRegions.map((region) => region.props["aria-live"]), ["polite", "polite", "assertive"])
  })
})

describe("Admin background-credit browser contract", () => {
  it("covers desktop/mobile preset and custom preview, keyboard confirmation, one grant, Activity, and fresh confirmation", () => {
    assert.match(browserSource, /Add background credits/)
    assert.match(browserSource, /getByRole\("button", \{ name: "\+5" \}\)/)
    assert.match(browserSource, /getByLabel\("Custom credit amount"\)/)
    assert.match(browserSource, /Automatic verified-account allocation: \+2/)
    assert.match(browserSource, /Resulting balance: 2 \+ 3 = 5/)
    assert.match(browserSource, /CONFIRM_BACKGROUND_CREDIT_GRANT|I confirm that 3 background credits/)
    assert.match(browserSource, /press\("Enter"\)/)
    assert.match(browserSource, /Background credits added/)
    assert.match(browserSource, /Current balance: 5/)
    assert.match(browserSource, /toBeChecked\(\{ checked: false \}\)/)
    assert.match(browserSource, /fill\("4"\)[\s\S]*toBeChecked\(\{ checked: false \}\)[\s\S]*toBeDisabled\(\)/)
    assert.doesNotMatch(browserSource, /subtract background credits|set exact background credit balance/i)
  })
})
