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
const actionSource = await readFile(new URL("../app/admin/users/[userId]/security-actions.ts", import.meta.url), "utf8").catch(() => "")
const formSource = await readFile(new URL("../app/admin/users/[userId]/security-action-forms.tsx", import.meta.url), "utf8").catch(() => "")
const pageSource = await readFile(new URL("../app/admin/users/[userId]/page.tsx", import.meta.url), "utf8")
const browserSource = await readFile(new URL("browser/admin-user-operations.spec.ts", import.meta.url), "utf8")

const idleState = { status: "idle", message: "" }
const operationId = "42b90a0b-41d5-48f8-b798-b6da77178b67"

function securityActionHarness({
  revokeResult = {
    revokedSessionCount: 2,
    beforeAuthSessionVersion: 3,
    afterAuthSessionVersion: 4,
    emailIntentId: "intent-revoke",
    replayed: false,
  },
  resetResult = {
    emailIntentId: "intent-reset",
    replayed: false,
    deliveryStatus: "DELIVERED",
    deliveryAttempted: true,
  },
  twoFactorResult = {
    deletedTwoFactorSecretCount: 1,
    deletedBackupCodeCount: 2,
    revokedSessionCount: 2,
    beforeAuthSessionVersion: 3,
    afterAuthSessionVersion: 4,
    emailIntentId: "intent-2fa",
    replayed: false,
  },
  serviceError,
  deliveryResult = { status: "DELIVERED", attemptCount: 1, attempted: true },
  deliveryError,
} = {}) {
  const calls = []
  const compiled = loadCompiledModule(actionSource, "app/admin/users/[userId]/security-actions.test.ts", {
    "next/cache": { revalidatePath(path) { calls.push(["revalidatePath", path]) } },
    "@/lib/admin/access": {
      async requireFullAdminUser() {
        calls.push(["requireFullAdminUser"])
        return { id: "admin-1" }
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
      ADMIN_REASON_CODES: ["LOGIN_SUPPORT", "SECURITY_RECOVERY", "OTHER"],
      validateAdminReason(reasonCode, note) {
        calls.push(["validateAdminReason", reasonCode, note])
        if (!["LOGIN_SUPPORT", "SECURITY_RECOVERY", "OTHER"].includes(reasonCode)) throw new Error("invalid reason")
        if (note?.length > 500 || (reasonCode === "OTHER" && !note?.trim())) throw new Error("invalid note")
      },
    },
    "@/lib/admin/security-service": {
      async revokeUserSessions(input) {
        calls.push(["revokeUserSessions", input])
        if (serviceError) throw serviceError
        return revokeResult
      },
      async sendAdminPasswordReset(input) {
        calls.push(["sendAdminPasswordReset", input])
        if (serviceError) throw serviceError
        return resetResult
      },
      async resetUserTwoFactor(input) {
        calls.push(["resetUserTwoFactor", input])
        if (serviceError) throw serviceError
        return twoFactorResult
      },
    },
    "@/lib/prisma": { prisma: { marker: "prisma" } },
    "@/lib/safe-error-code": { safeErrorCode() { calls.push(["safeErrorCode"]); return "unexpected_error" } },
  })
  return { compiled, calls }
}

function actionForm(kind, overrides = {}) {
  const common = {
    targetUserId: "user-1",
    operationId,
    reasonCode: "SECURITY_RECOVERY",
    internalNote: "",
  }
  const values = kind === "revoke"
    ? { ...common, expectedAuthSessionVersion: "3", expectedSessionCount: "2", confirmation: "CONFIRM_SECURITY_SESSION_REVOCATION", ...overrides }
    : kind === "password"
      ? { ...common, confirmation: "CONFIRM_ADMIN_PASSWORD_RESET", ...overrides }
      : { ...common, confirmationEmail: "target@example.test", expectedTwoFactorEnabled: "true", ...overrides }
  const formData = new FormData()
  for (const [key, value] of Object.entries(values)) formData.set(key, value)
  return formData
}

function uiHarness(actionState = idleState) {
  return loadCompiledModule(formSource, "app/admin/users/[userId]/security-action-forms.test.tsx", {
    react: {
      useActionState: () => [actionState, () => {}, false],
      useId: () => "test-form",
      useState: (initialValue) => [initialValue, () => {}],
    },
    "react/jsx-runtime": { Fragment: "fragment", jsx: createElement, jsxs: createElement },
    "@/components/ui/button": { Button: passThroughElement("button") },
    "@/lib/admin/operation-contract": { ADMIN_REASON_CODES: ["LOGIN_SUPPORT", "SECURITY_RECOVERY", "OTHER"] },
    "./security-actions": {
      revokeUserSessionsAction() {},
      sendAdminPasswordResetAction() {},
      resetUserTwoFactorAction() {},
      SecurityActionState: {},
    },
  })
}

/** Returns the compiled DetailSection test module; keep its JSX/runtime and module mocks aligned with pageSource imports. */
function detailPageHarness() {
  return loadCompiledModule(
    `${pageSource}\nexport { DetailSection }\n`,
    "app/admin/users/[userId]/page.test.tsx",
    {
      "react/jsx-runtime": { Fragment: "fragment", jsx: createElement, jsxs: createElement },
      "next/link": {},
      "next/navigation": {},
      "@/components/ui/app-surface": {},
      "@/components/ui/button": {},
      "@/components/ui/card": {},
      "@/lib/admin/access": {},
      "@/lib/admin/billing-goodwill": {
        BILLING_GOODWILL_UNRESOLVED_STATUSES: ["PREPARED", "APPLIED", "RECONCILIATION_REQUIRED"],
        isBillingGoodwillUnresolvedStatus: (value) => ["PREPARED", "APPLIED", "RECONCILIATION_REQUIRED"].includes(value),
        previewInvoiceCredit: async () => null,
      },
      "@/lib/admin/browser-billing-goodwill-preview": { browserBillingGoodwillPreviewClient: () => null },
      "./billing-goodwill-form": {
        BillingGoodwillControls: ({ userId, preview, reconciliations, reconciliationsTruncated }) => (
          createElement("billing-goodwill-controls", { userId, preview, reconciliations, reconciliationsTruncated })
        ),
      },
      "./credit-action-form": {},
      "./retry-email-form": {},
      "./role-change-form": {},
      "./security-action-forms": {},
      "./temporary-access-form": {},
      "@/lib/admin/temporary-access": { ADMIN_GRANTABLE_FEATURE_KEYS: [] },
      "@/lib/admin/temporary-access-contract": {
        ADMIN_GRANTABLE_FEATURE_KEYS: [
          "premium_backgrounds",
          "therapist_documentation_tools",
          "calendar_basic_scheduling",
          "calendar_full_scheduling",
          "external_calendar_sync",
        ],
        PER_FEATURE_ACTIVE_LIMIT: 100,
        TOTAL_ACTIVE_LIMIT: 500,
        isGrantableFeature: (value) => typeof value === "string" && [
          "premium_backgrounds",
          "therapist_documentation_tools",
          "calendar_basic_scheduling",
          "calendar_full_scheduling",
          "external_calendar_sync",
        ].includes(value),
        isSafeRecordId: (value) => typeof value === "string" && value.length <= 191 && /^[A-Za-z0-9_-]+$/.test(value),
      },
      "@/lib/admin/user-detail": {},
      "@/lib/commerce/credit-service": { INITIAL_BACKGROUND_CREDIT_COUNT: 2 },
      "@/lib/prisma": {},
      "@/lib/stripe-billing": { getStripeClient: () => ({}) },
    },
  )
}

describe("Admin security server actions", () => {
  it("defines all three bound server actions without generating submission-time operation keys", () => {
    assert.match(actionSource, /^"use server"/)
    assert.match(actionSource, /export async function revokeUserSessionsAction/)
    assert.match(actionSource, /export async function sendAdminPasswordResetAction/)
    assert.match(actionSource, /export async function resetUserTwoFactorAction/)
    assert.doesNotMatch(actionSource, /randomUUID|generateRandomToken/)
  })

  it("authenticates before form validation and rejects route-target tampering for every action", async () => {
    const { compiled, calls } = securityActionHarness()
    for (const [name, kind] of [
      ["revokeUserSessionsAction", "revoke"],
      ["sendAdminPasswordResetAction", "password"],
      ["resetUserTwoFactorAction", "twoFactor"],
    ]) {
      calls.length = 0
      const result = await compiled[name]("user-1", idleState, actionForm(kind, { targetUserId: "user-2" }))
      assert.equal(result.status, "error")
      assert.deepEqual(calls, [["requireFullAdminUser"]])
    }
  })

  it("forwards canonical revoke state, performs one post-commit initial delivery, and revalidates bounded surfaces", async () => {
    const { compiled, calls } = securityActionHarness()
    const result = await compiled.revokeUserSessionsAction("user-1", idleState, actionForm("revoke"))

    assert.equal(result.status, "success")
    assert.match(result.message, /sign-in tokens were invalidated/i)
    assert.match(result.message, /next successful database-backed session refresh/i)
    assert.doesNotMatch(result.message, /2 sessions|2 users|immediate cookie/i)
    assert.deepEqual(calls[0], ["requireFullAdminUser"])
    assert.deepEqual(calls[2], ["revokeUserSessions", {
      prismaClient: { marker: "prisma" }, actorUserId: "admin-1", targetUserId: "user-1",
      expectedAuthSessionVersion: 3, expectedSessionCount: 2, reasonCode: "SECURITY_RECOVERY",
      internalNote: null, idempotencyKey: operationId,
    }])
    assert.deepEqual(calls[3], ["deliverAdminEmailIntent", { prismaClient: { marker: "prisma" }, intentId: "intent-revoke" }])
    assert.deepEqual(calls.slice(-2), [
      ["revalidatePath", "/admin/users/user-1"],
      ["revalidatePath", "/admin/users"],
    ])
  })

  it("uses the standard password-reset service truth and never account-change delivery", async () => {
    const { compiled, calls } = securityActionHarness()
    const result = await compiled.sendAdminPasswordResetAction("user-1", idleState, actionForm("password"))

    assert.deepEqual(result, { status: "success", message: "A fresh password-reset link was created and delivered." })
    assert.equal(calls.filter(([name]) => name === "sendAdminPasswordReset").length, 1)
    assert.equal(calls.some(([name]) => name === "deliverAdminEmailIntent"), false)
    const serviceInput = calls.find(([name]) => name === "sendAdminPasswordReset")[1]
    assert.equal(serviceInput.idempotencyKey, operationId)
    assert.equal(Object.hasOwn(serviceInput, "sendEmail"), false)
  })

  it("revalidates and warns before another request when attempted reset delivery remains pending", async () => {
    const { compiled, calls } = securityActionHarness({
      resetResult: {
        emailIntentId: "intent-reset",
        replayed: false,
        deliveryStatus: "PENDING",
        deliveryAttempted: true,
      },
    })

    const result = await compiled.sendAdminPasswordResetAction("user-1", idleState, actionForm("password"))

    assert.equal(result.status, "warning")
    assert.match(result.message, /delivery was attempted, but its outcome could not be confirmed/i)
    assert.match(result.message, /check Activity before creating another request/i)
    assert.deepEqual(calls.slice(-2), [
      ["revalidatePath", "/admin/users/user-1"],
      ["revalidatePath", "/admin/users"],
    ])
  })

  it("passes typed-email confirmation only to the 2FA service and reports the committed mutation separately from delivery", async () => {
    const { compiled, calls } = securityActionHarness({ deliveryResult: { status: "FAILED", attemptCount: 1, attempted: true } })
    const result = await compiled.resetUserTwoFactorAction("user-1", idleState, actionForm("twoFactor"))

    assert.equal(result.status, "warning")
    assert.match(result.message, /two-factor authentication was reset/i)
    assert.match(result.message, /email notification failed/i)
    const serviceInput = calls.find(([name]) => name === "resetUserTwoFactor")[1]
    assert.equal(serviceInput.confirmationEmail, "target@example.test")
    assert.equal(serviceInput.expectedTwoFactorEnabled, true)
    assert.equal(calls.filter(([name]) => name === "deliverAdminEmailIntent").length, 1)
  })

  it("allowlists only exact operator-safe service errors and keeps logs privacy-safe", async () => {
    const safe = securityActionHarness({ serviceError: new Error("The confirmation email does not match the target account.") })
    const originalConsoleError = console.error
    const logged = []
    console.error = (...args) => logged.push(args)
    try {
      const safeResult = await safe.compiled.resetUserTwoFactorAction("user-1", idleState, actionForm("twoFactor"))
      assert.equal(safeResult.message, "The confirmation email does not match the target account.")

      const unknown = securityActionHarness({ serviceError: new Error("database target@example.test secret") })
      const unknownResult = await unknown.compiled.sendAdminPasswordResetAction("user-1", idleState, actionForm("password"))
      assert.equal(unknownResult.message, "The password-reset request could not be completed. Refresh the account and try again.")
      assert.doesNotMatch(JSON.stringify(logged), /target@example\.test|user-1|42b90a0b|database/i)
    } finally {
      console.error = originalConsoleError
    }
  })
})

describe("Admin security controls", () => {
  it("renders safe evidence, canonical JWT wording, and explicitly labels adapter Session rows as compatibility-only", () => {
    assert.match(pageSource, /Compatibility Session rows/)
    assert.match(pageSource, /not a count of active JWT sessions or users signed out/i)
    assert.match(pageSource, /Sign-in provider types/)
    assert.match(pageSource, /Password configured/)
    assert.match(pageSource, /Two-factor authentication/)
    assert.doesNotMatch(pageSource, /sessionToken|passwordHash|encryptedSecret|backupCode|providerAccountId|devLink/)
  })

  it("renders unavailable compatibility Session evidence without conflating it with a real zero", () => {
    const { DetailSection } = detailPageHarness()
    const compatibilityValue = (detail) => {
      const rendered = renderFunctionComponents(DetailSection({
        detail,
        section: "security",
      }))
      const row = findElement(rendered, (element) => element.props["data-detail-key"] === "Compatibility Session rows")
      const value = findElement(row, (element) => Object.hasOwn(element.props, "data-detail-value"))
      return elementText(value)
    }

    for (const invalidDetail of [
      {},
      { compatibilitySessionCount: null },
      { compatibilitySessionCount: "0" },
      { compatibilitySessionCount: -1 },
      { compatibilitySessionCount: 1.5 },
    ]) {
      assert.equal(
        compatibilityValue(invalidDetail),
        "Unavailable (adapter evidence only; not a count of active JWT sessions or users signed out)",
      )
    }
    assert.equal(
      compatibilityValue({ compatibilitySessionCount: 0 }),
      "0 (adapter evidence only; not a count of active JWT sessions or users signed out)",
    )
  })

  it("uses stable server-rendered UUIDs and exposes failed password resets as fresh-token actions", () => {
    assert.match(pageSource, /revokeSessions:\s*randomUUID\(\)/)
    assert.match(pageSource, /passwordReset:\s*randomUUID\(\)/)
    assert.match(pageSource, /twoFactorReset:\s*randomUUID\(\)/)
    assert.match(pageSource, /failedPasswordReset[\s\S]*<FreshPasswordResetForm/)
    assert.match(pageSource, /operationId=\{operationId\}/)
    assert.match(formSource, /Send a new reset link/)
    assert.match(formSource, /type="hidden" name="operationId" value=\{operationId\}/)
  })

  it("keys Activity rows by durable activity identity so submitted action feedback survives insertions", () => {
    assert.match(pageSource, /type ActivityEntry = \{[\s\S]*id: string/)
    assert.match(pageSource, /<li key=\{entry\.id\} data-activity-id=\{entry\.id\}/)
    assert.doesNotMatch(pageSource, /key=\{`\$\{entry\.occurredAt \?\? "activity"\}-\$\{index\}`\}/)
  })

  it("renders explicit confirmation controls, typed-email confirmation, pending states, and live outcomes", () => {
    assert.match(formSource, /CONFIRM_SECURITY_SESSION_REVOCATION/)
    assert.match(formSource, /CONFIRM_ADMIN_PASSWORD_RESET/)
    assert.match(formSource, /name="confirmationEmail"/)
    assert.match(formSource, /useActionState/)
    assert.match(formSource, /aria-live="polite"/)
    assert.match(formSource, /aria-live="assertive"/)
    assert.match(formSource, /isPending/)
  })

  it("keeps self-target Security read-only with no mutation control", () => {
    const { SelfSecurityManagementNotice } = uiHarness()
    const rendered = renderFunctionComponents(SelfSecurityManagementNotice())
    assert.match(elementText(rendered), /cannot perform security remediation on your own account/i)
    assert.equal(findElement(rendered, (element) => element.type === "form" || element.type === "button"), null)
    assert.match(pageSource, /canManageSecurity=\{actor\.id !== userId\}/)
  })

  it("renders three responsive action cards with disabled default submits and accessible labels", () => {
    const { SecurityActionControls } = uiHarness()
    const controls = SecurityActionControls({
      userId: "user-1",
      targetEmail: "target@example.test",
      emailVerified: true,
      passwordConfigured: true,
      twoFactorEnabled: true,
      expectedAuthSessionVersion: 3,
      expectedSessionCount: 2,
      operationIds: {
        revokeSessions: "9ed1d8b5-7941-4da6-9456-715cccf4afe4",
        passwordReset: "c93e0806-4cbe-4d0b-a80d-93a611661ed8",
        twoFactorReset: "6c9da6f1-c7f7-4a79-9bb2-12cb35643a2d",
      },
    })
    const rendered = renderFunctionComponents(controls)
    const forms = findElements(rendered, (element) => element.type === "form")
    const buttons = findElements(rendered, (element) => element.type === "button")
    assert.equal(forms.length, 3)
    assert.equal(buttons.length, 3)
    assert.equal(buttons.every((button) => button.props.disabled === true), true)
    assert.match(elementText(rendered), /Revoke sign-in tokens and sessions/)
    assert.match(elementText(rendered), /Send password reset/)
    assert.match(elementText(rendered), /Reset two-factor authentication/)
    assert.equal(findElements(rendered, (element) => element.type === "span" && elementText(element) === "Current state:").length, 3)
    assert.equal(findElements(rendered, (element) => element.type === "span" && elementText(element) === "After confirmation:").length, 3)
    assert.match(formSource, /grid gap-4 xl:grid-cols-3/)
  })

  it("keeps completed two-factor reset feedback visible after refreshed evidence disables the form", () => {
    const completedMessage = "Two-factor authentication was reset and existing sign-in tokens were invalidated."
    const { SecurityActionControls } = uiHarness({ status: "success", message: completedMessage })
    const controls = SecurityActionControls({
      userId: "user-1",
      targetEmail: "target@example.test",
      emailVerified: true,
      passwordConfigured: true,
      twoFactorEnabled: false,
      expectedAuthSessionVersion: 4,
      expectedSessionCount: 0,
      operationIds: {
        revokeSessions: "9ed1d8b5-7941-4da6-9456-715cccf4afe4",
        passwordReset: "c93e0806-4cbe-4d0b-a80d-93a611661ed8",
        twoFactorReset: "6c9da6f1-c7f7-4a79-9bb2-12cb35643a2d",
      },
    })
    const rendered = renderFunctionComponents(controls)
    const twoFactorCard = findElement(rendered, (element) => (
      element.type === "article" && /Reset two-factor authentication/.test(elementText(element))
    ))

    assert.ok(twoFactorCard)
    assert.match(elementText(twoFactorCard), new RegExp(completedMessage.replaceAll(".", String.raw`\.`)))
    assert.equal(findElement(twoFactorCard, (element) => element.type === "form"), null)
  })
})

describe("Admin security browser contract", () => {
  it("covers desktop/mobile controls, keyboard confirmation, self suppression, fresh reset resend, typed email, and JWT invalidation", () => {
    assert.match(browserSource, /Revoke sign-in tokens and sessions/)
    assert.match(browserSource, /Send password reset/)
    assert.match(browserSource, /Reset two-factor authentication/)
    assert.match(browserSource, /Send a new reset link/)
    assert.match(browserSource, /confirmation email/i)
    assert.match(browserSource, /toBeDisabled\(\)/)
    assert.match(browserSource, /toBeEnabled\(\)/)
    assert.match(browserSource, /press\("Enter"\)/)
    assert.match(browserSource, /\/api\/auth\/session/)
    assert.match(browserSource, /fixture\.operator\.id/)
    assert.match(browserSource, /cannot perform security remediation on your own account/i)
    assert.match(browserSource, /const submittedActivityId = await failedReset\.getAttribute\("data-activity-id"\)/)
    assert.match(browserSource, /const submittedFailedReset = page\.locator\(`\[data-activity-id="\$\{submittedActivityId\}"\]`\)/)
    assert.match(browserSource, /const submittedFeedback = submittedFailedReset\.getByRole\("status"\)/)
    assert.match(browserSource, /toHaveCount\(2\)[\s\S]*submittedFeedback[\s\S]*fresh password-reset link was created, but email delivery failed/i)
    assert.match(pageSource, /data-detail-key=\{label\}/)
    assert.match(pageSource, /data-detail-value/)
    assert.match(browserSource, /\[data-detail-key="Two-factor authentication"\] \[data-detail-value\]/)
    assert.doesNotMatch(browserSource, /xpath=following-sibling/)
  })
})
