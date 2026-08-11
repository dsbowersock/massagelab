import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import {
  createCompiledModuleLoader,
  createElement,
  elementText,
  passThroughElement,
  renderFunctionComponents,
} from "./helpers/compiled-module.mjs"
import {
  browserBillingGoodwillPreviewClient,
  isBrowserBillingGoodwillMutationBlocked,
} from "../lib/admin/browser-billing-goodwill-preview.ts"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)

const [pageSource, actionSource, formSource, directorySource, directoryPageSource, dashboardSource, browserSource] = await Promise.all([
  readFile(new URL("../app/admin/users/[userId]/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/admin/users/[userId]/billing-actions.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/admin/users/[userId]/billing-goodwill-form.tsx", import.meta.url), "utf8"),
  readFile(new URL("../lib/admin/user-directory.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/admin/users/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("./browser/admin-user-operations.spec.ts", import.meta.url), "utf8"),
])
const idleState = { status: "idle", message: "" }
const operationId = "42b90a0b-41d5-48f8-b798-b6da77178b67"

describe("Admin billing-goodwill UI", () => {
  it("offers only bounded positive USD invoice-credit choices", () => {
    assert.match(formSource, /const PRESETS = \[100, 200, 500, 1000, 2000, 5000\] as const/)
    assert.match(formSource, /min=\{?0\.01\}?/)
    assert.match(formSource, /max=\{?100\}?/)
    assert.match(formSource, /step=\{?0\.01\}?/)
    assert.match(formSource, /Projected next invoice/)
    assert.match(formSource, /Current Stripe credit/)
    assert.match(formSource, /Requested credit/)
    assert.match(formSource, /Resulting credit/)
    assert.doesNotMatch(formSource, /coupon|trial end|renewal date|payment method|debit|reversal/i)
  })

  it("requires fresh exact email and amount confirmation under one rendered operation key", () => {
    assert.match(pageSource, /randomUUID\(\)/)
    assert.match(pageSource, /BillingGoodwillControls/)
    assert.match(formSource, /name="operationId"/)
    assert.match(formSource, /name="confirmationEmail"/)
    assert.match(formSource, /name="confirmationAmount"/)
    assert.match(formSource, /type the target email/i)
    assert.match(formSource, /exact dollar amount/i)
    assert.match(actionSource, /await requireFullAdminUser\(\)/)
    assert.match(actionSource, /targetUserId !== boundUserId/)
    assert.match(actionSource, /applyInvoiceCredit/)
    assert.match(actionSource, /reconcileInvoiceCredit/)
  })

  it("delivers only verified bundles and exposes one same-key reconciliation action", () => {
    assert.match(actionSource, /result\.status === "VERIFIED"[\s\S]*result\.emailIntentId/)
    assert.match(actionSource, /deliverAdminEmailIntent/)
    assert.match(actionSource, /RECONCILIATION_REQUIRED/)
    assert.match(formSource, /Reconcile/)
    assert.match(formSource, /name="reconcileOperationId"/)
    assert.match(formSource, /name="reconciliationEmail"/)
    assert.match(formSource, /name="reconciliationAmount"/)
    assert.match(formSource, /Type the target email exactly as shown/)
    assert.match(formSource, /Type the exact stored dollar amount/)
    assert.match(formSource, /confirmationNonce/)
    assert.match(formSource, /useFormStatus/)
    assert.match(formSource, /const \[applyState, applyAction/)
    assert.match(formSource, /const \[reconcileState, reconcileAction/)
    assert.match(pageSource, /BILLING_GOODWILL_UNRESOLVED_STATUSES/)
    assert.match(actionSource, /BILLING_GOODWILL_UNRESOLVED_STATUSES/)
    assert.match(directorySource, /BILLING_GOODWILL_UNRESOLVED_STATUSES/)
    assert.match(pageSource, /take: 26/)
    assert.match(pageSource, /slice\(0, 25\)/)
    assert.match(formSource, /reconciliationsTruncated/)
    assert.match(formSource, /Recovery evidence is limited to the newest 25 unresolved operations/)
    assert.match(formSource, /aria-live="polite"/)
    assert.match(formSource, /aria-live="assertive"/)
  })

  it("counts unresolved goodwill without exposing Stripe identifiers in directory rows", () => {
    assert.match(directorySource, /adminBillingGoodwillOperation/)
    assert.match(directorySource, /BILLING_GOODWILL_UNRESOLVED_STATUSES/)
    assert.match(directorySource, /billingGoodwillOperationsAsTarget/)
    assert.match(directoryPageSource, /Unresolved billing goodwill/)
    assert.match(dashboardSource, /unresolvedBillingGoodwillOperations/)
    assert.doesNotMatch(directoryPageSource, /stripeCustomerId|stripeSubscriptionId|stripeBalanceTransactionId/)
  })

  it("keeps browser coverage presentation-only at both configured projects", () => {
    assert.match(browserSource, /previews billing goodwill confirmation without creating a Stripe transaction/i)
    assert.match(browserSource, /Current Stripe credit/)
    assert.match(browserSource, /Projected next invoice/)
    assert.match(browserSource, /desktop-chromium|testInfo\.project\.name/)
    assert.match(browserSource, /formSubmissionCount/)
    assert.match(browserSource, /matchingPostRequests/)
    assert.doesNotMatch(browserSource, /createBalanceTransaction/)
  })

  it("keeps apply and reconcile feedback mounted when preview fails and the reconciled row disappears", () => {
    let actionOwner = 0
    const compiled = loadCompiledModule(formSource, "app/admin/users/[userId]/billing-goodwill-form.test.tsx", {
      react: {
        useActionState() {
          actionOwner += 1
          return actionOwner === 1
            ? [{ status: "success", message: "Apply outcome survived." }, () => {}, false]
            : [{ status: "warning", message: "Reconcile outcome survived." }, () => {}, false]
        },
        useId: () => "billing-form",
        useState: (initialValue) => [initialValue, () => {}],
      },
      "react-dom": { useFormStatus: () => ({ pending: false }) },
      "react/jsx-runtime": { Fragment: "fragment", jsx: createElement, jsxs: createElement },
      "@/components/ui/button": { Button: passThroughElement("button") },
      "@/lib/admin/operation-contract": { ADMIN_REASON_CODES: ["BILLING_GOODWILL"] },
      "./billing-actions": { applyBillingGoodwillAction() {}, reconcileBillingGoodwillAction() {} },
    })
    const tree = renderFunctionComponents(compiled.BillingGoodwillControls({
      userId: "user-1",
      preview: null,
      reconciliations: [],
    }))
    assert.match(elementText(tree), /Apply outcome survived/)
    assert.match(elementText(tree), /Reconcile outcome survived/)
  })

  it("shows the local recovery state and truthful newest-25 truncation warning without provider identifiers", () => {
    const compiled = loadCompiledModule(formSource, "app/admin/users/[userId]/billing-goodwill-form.recovery.test.tsx", {
      react: {
        useActionState: () => [idleState, () => {}, false],
        useId: () => "billing-form",
        useState: (initialValue) => [initialValue, () => {}],
      },
      "react-dom": { useFormStatus: () => ({ pending: false }) },
      "react/jsx-runtime": { Fragment: "fragment", jsx: createElement, jsxs: createElement },
      "@/components/ui/button": { Button: passThroughElement("button") },
      "@/lib/admin/operation-contract": { ADMIN_REASON_CODES: ["BILLING_GOODWILL"] },
      "./billing-actions": { applyBillingGoodwillAction() {}, reconcileBillingGoodwillAction() {} },
    })
    const tree = renderFunctionComponents(compiled.BillingGoodwillControls({
      userId: "user-1",
      preview: null,
      reconciliations: [{
        operationId: "operation-prepared",
        confirmationNonce: "fresh-nonce",
        targetEmail: "user@example.test",
        status: "PREPARED",
        amountCents: 200,
        startingCreditCents: 300,
        failureCode: null,
        createdAt: "2026-08-08T00:00:00.000Z",
      }],
      reconciliationsTruncated: true,
    }))
    const text = elementText(tree)
    assert.match(text, /Recovery statePREPARED/)
    assert.match(text, /Recovery evidence is limited to the newest 25 unresolved operations/)
    assert.doesNotMatch(text, /cus_|sub_|cbtxn_/)
  })

  it("enables the read-only browser preview only for opted-in disposable identities outside Vercel Production", async () => {
    const target = "browser-admin-target-desktop-chromium"
    const authorizedEnvironment = {
      DATABASE_URL: "postgresql://example.test/not-real",
      MASSAGELAB_BROWSER_QA_DATABASE: "1",
    }
    assert.equal(browserBillingGoodwillPreviewClient(target, {}), null)
    assert.equal(browserBillingGoodwillPreviewClient(target, {
      ...authorizedEnvironment,
      VERCEL_ENV: "production",
    }), null)
    assert.equal(isBrowserBillingGoodwillMutationBlocked(target, {}), false)
    assert.equal(isBrowserBillingGoodwillMutationBlocked("user-1", authorizedEnvironment), false)
    assert.equal(isBrowserBillingGoodwillMutationBlocked(target, { ...authorizedEnvironment, VERCEL_ENV: "production" }), false)
    assert.equal(isBrowserBillingGoodwillMutationBlocked(target, authorizedEnvironment), true)
    const client = browserBillingGoodwillPreviewClient(target, authorizedEnvironment)
    assert.ok(client)
    assert.deepEqual(await client.customers.retrieve("cus_browserdesktopchromium"), {
      id: "cus_browserdesktopchromium", balance: 0, livemode: false,
    })
    await assert.rejects(
      () => client.customers.createBalanceTransaction("cus_browserdesktopchromium", { amount: -100, currency: "usd" }),
      /must not create Stripe balance transactions/i,
    )
  })

  it("authorizes before parsing, route-binds the target, and preserves the rendered key", async () => {
    const harness = actionHarness()
    const rejected = await harness.actions.applyBillingGoodwillAction("user-1", idleState, applyForm({ targetUserId: "user-2" }))
    assert.deepEqual(rejected, { status: "error", message: "Refresh this account before applying billing goodwill." })
    assert.deepEqual(harness.calls, [
      ["requireFullAdminUser"],
      ["isBrowserBillingGoodwillMutationBlocked", "user-1"],
    ])

    const accepted = actionHarness()
    const result = await accepted.actions.applyBillingGoodwillAction("user-1", idleState, applyForm())
    assert.equal(result.status, "success")
    const serviceCall = accepted.calls.find(([name]) => name === "applyInvoiceCredit")
    assert.equal(serviceCall[1].idempotencyKey, operationId)
    assert.equal(serviceCall[1].amountCents, 200)
    assert.equal(serviceCall[1].confirmationEmail, "user@example.test")
    assert.deepEqual(accepted.calls.find(([name]) => name === "deliverAdminEmailIntent")[1], {
      prismaClient: accepted.prisma,
      intentId: "intent-goodwill",
    })
  })

  it("rejects inexact confirmation and never notifies an unresolved mutation", async () => {
    for (const invalid of [
      { amountCents: "0" }, { amountCents: "10001" }, { confirmationAmount: "2" },
      { confirmationAmount: "2.01" }, { confirmationEmail: " USER@EXAMPLE.TEST " },
      { operationId: "not-a-uuid" }, { reasonCode: "INVALID" },
    ]) {
      const harness = actionHarness()
      const result = await harness.actions.applyBillingGoodwillAction("user-1", idleState, applyForm(invalid))
      assert.equal(result.status, "error")
      assert.equal(harness.calls.some(([name]) => name === "applyInvoiceCredit"), false)
    }
    const unresolved = actionHarness({
      applyResult: { operationId: "operation-row", status: "RECONCILIATION_REQUIRED", amountCents: 200, endingCreditCents: null, replayed: false, emailIntentId: null },
    })
    const result = await unresolved.actions.applyBillingGoodwillAction("user-1", idleState, applyForm())
    assert.equal(result.status, "warning")
    assert.match(result.message, /No email was sent/)
    assert.equal(unresolved.calls.some(([name]) => name === "deliverAdminEmailIntent"), false)
  })

  it("reloads one route-owned unresolved row and reconciles with its stored immutable key", async () => {
    const harness = actionHarness()
    const form = reconcileForm()
    const result = await harness.actions.reconcileBillingGoodwillAction("user-1", idleState, form)
    assert.deepEqual(result, {
      status: "success",
      message: "The invoice credit is verified. The resulting Stripe credit is $5.00. Email notification delivered.",
    })
    const call = harness.calls.find(([name]) => name === "reconcileInvoiceCredit")
    assert.equal(call[1].targetUserId, "user-1")
    assert.equal(call[1].idempotencyKey, "stored-stripe-key")
    assert.equal(harness.calls.filter(([name]) => name === "reconcileInvoiceCredit").length, 1)
  })

  it("admits PREPARED, APPLIED, and RECONCILIATION_REQUIRED recovery rows through one canonical query", async () => {
    for (const status of ["PREPARED", "APPLIED", "RECONCILIATION_REQUIRED"]) {
      const harness = actionHarness({ operationRow: { status } })
      const result = await harness.actions.reconcileBillingGoodwillAction("user-1", idleState, reconcileForm())
      assert.equal(result.status, "success", status)
      const query = harness.calls.find(([name]) => name === "findFirst")[1]
      assert.deepEqual(query.where.status, { in: ["PREPARED", "APPLIED", "RECONCILIATION_REQUIRED"] })
    }
  })

  it("requires exact fresh reconciliation email and stored amount confirmation before service invocation", async () => {
    for (const invalid of [
      { reconciliationEmail: "" },
      { reconciliationEmail: " USER@EXAMPLE.TEST " },
      { reconciliationEmail: "other@example.test" },
      { reconciliationAmount: "" },
      { reconciliationAmount: "2" },
      { reconciliationAmount: "2.01" },
      { reconcileOperationId: "other-operation" },
    ]) {
      const harness = actionHarness()
      const result = await harness.actions.reconcileBillingGoodwillAction("user-1", idleState, reconcileForm(invalid))
      assert.equal(result.status, "error")
      assert.equal(harness.calls.some(([name]) => name === "reconcileInvoiceCredit"), false)
    }
    for (const operationRow of [
      { amountCents: 0 },
      { amountCents: 10_001 },
      { id: "different-operation" },
      { targetUserId: "different-user" },
      { target: { email: null } },
    ]) {
      const harness = actionHarness({ operationRow })
      const result = await harness.actions.reconcileBillingGoodwillAction("user-1", idleState, reconcileForm())
      assert.equal(result.status, "error")
      assert.equal(harness.calls.some(([name]) => name === "reconcileInvoiceCredit"), false)
    }
  })

  it("keeps apply replay truth while reconciliation pending-delivery copy stays context-neutral", async () => {
    const replay = actionHarness({
      applyResult: { operationId: "operation-row", status: "VERIFIED", amountCents: 200, endingCreditCents: 500, replayed: true, emailIntentId: "intent-goodwill" },
    })
    assert.deepEqual(await replay.actions.applyBillingGoodwillAction("user-1", idleState, applyForm()), {
      status: "success",
      message: "This invoice credit was already verified. The resulting Stripe credit is $5.00. Email notification delivered.",
    })

    const pendingDelivery = actionHarness({ deliveryResult: { status: "PENDING" } })
    assert.deepEqual(await pendingDelivery.actions.reconcileBillingGoodwillAction("user-1", idleState, reconcileForm()), {
      status: "warning",
      message: "The invoice credit is verified. The resulting Stripe credit is $5.00. Check Activity for the recorded notification status.",
    })
  })

  it("blocks both mutation actions for the exact opted-in browser-QA identity before service or Stripe client construction", async () => {
    const applyHarness = actionHarness({ browserMutationBlocked: true })
    assert.deepEqual(await applyHarness.actions.applyBillingGoodwillAction("browser-admin-target-desktop-chromium", idleState, applyForm({
      targetUserId: "browser-admin-target-desktop-chromium",
    })), {
      status: "error",
      message: "Billing goodwill mutation is disabled for browser QA. No Stripe change was attempted.",
    })
    assert.deepEqual(applyHarness.calls, [
      ["requireFullAdminUser"],
      ["isBrowserBillingGoodwillMutationBlocked", "browser-admin-target-desktop-chromium"],
    ])

    const reconcileHarness = actionHarness({ browserMutationBlocked: true })
    assert.deepEqual(await reconcileHarness.actions.reconcileBillingGoodwillAction(
      "browser-admin-target-desktop-chromium",
      idleState,
      reconcileForm({ targetUserId: "browser-admin-target-desktop-chromium" }),
    ), {
      status: "error",
      message: "Billing goodwill mutation is disabled for browser QA. No Stripe change was attempted.",
    })
    assert.deepEqual(reconcileHarness.calls, [
      ["requireFullAdminUser"],
      ["isBrowserBillingGoodwillMutationBlocked", "browser-admin-target-desktop-chromium"],
    ])
  })
})

function actionHarness({
  applyResult = { operationId: "operation-row", status: "VERIFIED", amountCents: 200, endingCreditCents: 500, replayed: false, emailIntentId: "intent-goodwill" },
  reconcileResult = { operationId: "operation-row", status: "VERIFIED", amountCents: 200, endingCreditCents: 500, replayed: true, emailIntentId: "intent-goodwill" },
  deliveryResult = { status: "DELIVERED" },
  operationRow = {},
  browserMutationBlocked = false,
} = {}) {
  const calls = []
  const prisma = {
    marker: "prisma",
    adminBillingGoodwillOperation: {
      async findFirst(input) {
        calls.push(["findFirst", input])
        const row = {
          id: "operation-row",
          targetUserId: "user-1", amountCents: 200, startingBalanceCents: 300,
          status: "RECONCILIATION_REQUIRED",
          reasonCode: "BILLING_GOODWILL", internalNote: null, idempotencyKey: "stored-stripe-key",
          target: { email: "user@example.test" },
          ...operationRow,
        }
        const acceptedStatuses = input.where.status?.in ?? [input.where.status]
        return acceptedStatuses.includes(row.status) ? row : null
      },
    },
  }
  const actions = loadCompiledModule(actionSource, "app/admin/users/[userId]/billing-actions.test.ts", {
    "next/cache": { revalidatePath(path) { calls.push(["revalidatePath", path]) } },
    "@/lib/admin/access": { async requireFullAdminUser() { calls.push(["requireFullAdminUser"]); return { id: "admin-1" } } },
    "@/lib/admin/billing-goodwill": {
      BILLING_GOODWILL_UNRESOLVED_STATUSES: ["PREPARED", "APPLIED", "RECONCILIATION_REQUIRED"],
      async applyInvoiceCredit(input) { calls.push(["applyInvoiceCredit", input]); return applyResult },
      async reconcileInvoiceCredit(input) { calls.push(["reconcileInvoiceCredit", input]); return reconcileResult },
    },
    "@/lib/admin/browser-billing-goodwill-preview": {
      isBrowserBillingGoodwillMutationBlocked(userId) {
        calls.push(["isBrowserBillingGoodwillMutationBlocked", userId])
        return browserMutationBlocked
      },
    },
    "@/lib/admin/email-intents": { async deliverAdminEmailIntent(input) { calls.push(["deliverAdminEmailIntent", input]); return deliveryResult } },
    "@/lib/admin/operation-contract": {
      ADMIN_REASON_CODES: ["BILLING_GOODWILL", "ADMIN_CORRECTION", "OTHER"],
      validateAdminReason(reason, note) {
        calls.push(["validateAdminReason", reason, note])
        if (!["BILLING_GOODWILL", "ADMIN_CORRECTION", "OTHER"].includes(reason) || (reason === "OTHER" && !note?.trim())) throw new Error("invalid")
      },
    },
    "@/lib/prisma": { prisma },
    "@/lib/safe-error-code": { safeErrorCode: () => "safe_error" },
    "@/lib/stripe-billing": { getStripeClient: () => { calls.push(["getStripeClient"]); return { marker: "stripe" } } },
  })
  return { actions, calls, prisma }
}

function applyForm(overrides = {}) {
  const values = {
    targetUserId: "user-1",
    operationId,
    amountCents: "200",
    expectedStartingCreditCents: "300",
    confirmationEmail: "user@example.test",
    confirmationAmount: "2.00",
    reasonCode: "BILLING_GOODWILL",
    internalNote: "",
    ...overrides,
  }
  const form = new FormData()
  for (const [key, value] of Object.entries(values)) form.set(key, value)
  return form
}

function reconcileForm(overrides = {}) {
  const values = {
    targetUserId: "user-1",
    reconcileOperationId: "operation-row",
    reconciliationEmail: "user@example.test",
    reconciliationAmount: "2.00",
    ...overrides,
  }
  const form = new FormData()
  for (const [key, value] of Object.entries(values)) form.set(key, value)
  return form
}
