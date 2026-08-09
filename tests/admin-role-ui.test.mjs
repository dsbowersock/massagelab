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
const actionSource = await readFile(new URL("../app/admin/users/[userId]/role-actions.ts", import.meta.url), "utf8")
const formSource = await readFile(new URL("../app/admin/users/[userId]/role-change-form.tsx", import.meta.url), "utf8")
const pageSource = await readFile(new URL("../app/admin/users/[userId]/page.tsx", import.meta.url), "utf8")
const browserSource = await readFile(new URL("browser/admin-user-operations.spec.ts", import.meta.url), "utf8")
const playwrightSource = await readFile(new URL("../playwright.config.ts", import.meta.url), "utf8")

const idleState = { status: "idle", message: "" }
const operationId = "42b90a0b-41d5-48f8-b798-b6da77178b67"

function roleActionHarness({
  serviceResult = {
    beforeRoles: ["USER"],
    afterRoles: ["ANATOMY_REVIEWER", "USER"],
    revokedSessionCount: 0,
    emailIntentId: "intent-1",
    replayed: false,
  },
  serviceError,
  deliveryResult = { status: "DELIVERED", attemptCount: 1, attempted: true },
  deliveryError,
  safeCode = "safe_failure",
} = {}) {
  const calls = []
  const compiledAction = loadCompiledModule(actionSource, "app/admin/users/[userId]/role-actions.test.ts", {
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
      ADMIN_REASON_CODES: ["ROLE_ASSIGNMENT", "ROLE_REVOCATION", "OTHER"],
      validateAdminReason(reasonCode, note) {
        calls.push(["validateAdminReason", reasonCode, note])
        if (!["ROLE_ASSIGNMENT", "ROLE_REVOCATION", "OTHER"].includes(reasonCode)) throw new Error("invalid reason")
        if (note?.length > 500 || (reasonCode === "OTHER" && !note?.trim())) throw new Error("invalid note")
      },
    },
    "@/lib/admin/role-service": {
      async changeAnatomyRole(input) {
        calls.push(["changeAnatomyRole", input])
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
  return { action: compiledAction.changeAnatomyRoleAction, calls }
}

function roleForm(overrides = {}) {
  const values = {
    targetUserId: "user-1",
    role: "ANATOMY_REVIEWER",
    operation: "ASSIGN",
    expectedStatus: "ABSENT",
    reasonCode: "ROLE_ASSIGNMENT",
    internalNote: "",
    operationId,
    confirmation: "CONFIRM_ANATOMY_ROLE_CHANGE",
    ...overrides,
  }
  const formData = new FormData()
  for (const [key, value] of Object.entries(values)) formData.set(key, value)
  return formData
}

function roleUiHarness(actionState = idleState) {
  return loadCompiledModule(formSource, "app/admin/users/[userId]/role-change-form.test.tsx", {
    react: {
      useActionState: () => [actionState, () => {}, false],
      useId: () => "test-form",
      useState: (initialValue) => [initialValue, () => {}],
    },
    "react/jsx-runtime": {
      Fragment: "fragment",
      jsx: createElement,
      jsxs: createElement,
    },
    "@/components/ui/button": { Button: passThroughElement("button") },
    "@/lib/admin/operation-contract": {
      ADMIN_REASON_CODES: ["ROLE_ASSIGNMENT", "ROLE_REVOCATION", "OTHER"],
    },
    "./role-actions": { changeAnatomyRoleAction() {}, RoleChangeActionState: {} },
  })
}

describe("Admin anatomy role action", () => {
  it("authenticates before validating form input and fails closed on target tampering", async () => {
    const invalid = roleActionHarness()
    const invalidResult = await invalid.action("user-1", idleState, roleForm({ targetUserId: "user-2" }))
    assert.deepEqual(invalidResult, { status: "error", message: "Refresh this account before changing its role." })
    assert.deepEqual(invalid.calls, [["requireFullAdminUser"]])
  })

  it("rejects unsupported role, operation, status, key, confirmation, reason, and notes before mutation", async () => {
    const invalidForms = [
      { role: "ADMIN" },
      { operation: "DELETE" },
      { expectedStatus: "PENDING" },
      { operationId: "not-a-uuid" },
      { confirmation: "yes" },
      { reasonCode: "NOT_ALLOWED" },
      { reasonCode: "OTHER", internalNote: "" },
      { internalNote: "x".repeat(501) },
    ]
    for (const invalidFields of invalidForms) {
      const harness = roleActionHarness()
      const result = await harness.action("user-1", idleState, roleForm(invalidFields))
      assert.equal(result.status, "error")
      assert.equal(harness.calls.some(([name]) => name === "changeAnatomyRole"), false)
    }
  })

  it("forwards assignment and revocation inputs only after shared reason validation", async () => {
    for (const roleInput of [
      { role: "ANATOMY_REVIEWER", operation: "ASSIGN", expectedStatus: "ABSENT", reasonCode: "ROLE_ASSIGNMENT" },
      { role: "ANATOMY_EDITOR", operation: "REVOKE", expectedStatus: "VERIFIED", reasonCode: "ROLE_REVOCATION" },
    ]) {
      const harness = roleActionHarness()
      const result = await harness.action("user-1", idleState, roleForm(roleInput))
      assert.deepEqual(result, {
        status: "success",
        message: "The anatomy role changed. Existing sign-in tokens were invalidated; the user will be signed out on their next successful database-backed session refresh. Email notification delivered.",
      })
      assert.deepEqual(harness.calls[0], ["requireFullAdminUser"])
      assert.deepEqual(harness.calls[1], ["validateAdminReason", roleInput.reasonCode, null])
      const serviceCall = harness.calls[2]
      assert.equal(serviceCall[0], "changeAnatomyRole")
      assert.deepEqual(serviceCall[1], {
        prismaClient: { marker: "prisma" },
        actorUserId: "admin-1",
        targetUserId: "user-1",
        role: roleInput.role,
        operation: roleInput.operation,
        expectedStatus: roleInput.expectedStatus,
        reasonCode: roleInput.reasonCode,
        internalNote: null,
        idempotencyKey: operationId,
      })
      assert.deepEqual(harness.calls[3], ["deliverAdminEmailIntent", { prismaClient: { marker: "prisma" }, intentId: "intent-1" }])
      assert.deepEqual(harness.calls.slice(4), [
        ["revalidatePath", "/admin/users/user-1"],
        ["revalidatePath", "/admin/users"],
      ])
    }
  })

  it("does not attempt delivery or revalidation when the local mutation fails", async () => {
    const serviceError = new Error("sensitive service detail")
    const harness = roleActionHarness({ serviceError })
    const logged = []
    const originalConsoleError = console.error
    console.error = (...args) => logged.push(args)
    let result
    try {
      result = await harness.action("user-1", idleState, roleForm())
    } finally {
      console.error = originalConsoleError
    }
    assert.deepEqual(result, { status: "error", message: "The anatomy role could not be changed. Refresh the account and try again." })
    assert.equal(harness.calls.some(([name]) => name === "deliverAdminEmailIntent"), false)
    assert.equal(harness.calls.some(([name]) => name === "revalidatePath"), false)
    assert.deepEqual(logged, [["Admin anatomy role change failed", { code: "safe_failure", role: "ANATOMY_REVIEWER", operation: "ASSIGN" }]])
    assert.doesNotMatch(JSON.stringify(logged), /user-1|sensitive service detail|42b90a0b|internalNote/i)
  })

  it("preserves only exact stale-state and self-target service guidance", async () => {
    for (const message of [
      "This role changed since this operation was prepared. Refresh the account and try again.",
      "You cannot change your own delegated anatomy role.",
    ]) {
      const harness = roleActionHarness({ serviceError: new Error(message) })
      const originalConsoleError = console.error
      console.error = () => {}
      try {
        assert.deepEqual(await harness.action("user-1", idleState, roleForm()), {
          status: "error",
          message,
        })
      } finally {
        console.error = originalConsoleError
      }
    }

    const unknown = roleActionHarness({ serviceError: new Error("sensitive database detail") })
    const originalConsoleError = console.error
    console.error = () => {}
    try {
      const result = await unknown.action("user-1", idleState, roleForm())
      assert.equal(result.message, "The anatomy role could not be changed. Refresh the account and try again.")
      assert.doesNotMatch(result.message, /sensitive database detail/)
    } finally {
      console.error = originalConsoleError
    }
  })

  it("recovers a pending replay with exactly one initial delivery attempt and no new mutation claim", async () => {
    const harness = roleActionHarness({
      serviceResult: {
        beforeRoles: ["USER"], afterRoles: ["ANATOMY_REVIEWER", "USER"], revokedSessionCount: 0,
        emailIntentId: "intent-1", replayed: true,
      },
    })
    const result = await harness.action("user-1", idleState, roleForm())

    assert.deepEqual(result, {
      status: "success",
      message: "This anatomy role change was already completed. The pending email notification was delivered.",
    })
    assert.equal(harness.calls.filter(([name]) => name === "deliverAdminEmailIntent").length, 1)
    assert.doesNotMatch(result.message, /signed out|was signed out|new sign-out/i)
    assert.deepEqual(harness.calls.slice(-2), [
      ["revalidatePath", "/admin/users/user-1"],
      ["revalidatePath", "/admin/users"],
    ])
  })

  it("reports failed and delivered replay records without claiming another send or sign-out", async () => {
    const replayed = {
      beforeRoles: ["USER"], afterRoles: ["ANATOMY_REVIEWER", "USER"], revokedSessionCount: 0,
      emailIntentId: "intent-1", replayed: true,
    }
    for (const [deliveryResult, expected] of [
      [
        { status: "DELIVERED", attemptCount: 1, attempted: false },
        { status: "success", message: "This anatomy role change was already completed. The email notification was already delivered; no new send was attempted." },
      ],
      [
        { status: "FAILED", attemptCount: 1, attempted: false },
        { status: "warning", message: "This anatomy role change was already completed. The email notification is recorded as failed; no new send was attempted. Check Activity for the available next step." },
      ],
    ]) {
      const harness = roleActionHarness({ serviceResult: replayed, deliveryResult })
      const result = await harness.action("user-1", idleState, roleForm())
      assert.deepEqual(result, expected)
      assert.equal(harness.calls.filter(([name]) => name === "deliverAdminEmailIntent").length, 1)
      assert.doesNotMatch(result.message, /signed out|was signed out|new sign-out/i)
    }
  })

  it("reports a failed pending-replay attempt and an unconfirmed replay without a new mutation claim", async () => {
    const replayed = {
      beforeRoles: ["USER"], afterRoles: ["ANATOMY_REVIEWER", "USER"], revokedSessionCount: 0,
      emailIntentId: "intent-1", replayed: true,
    }
    const failed = roleActionHarness({
      serviceResult: replayed,
      deliveryResult: { status: "FAILED", attemptCount: 1, attempted: true },
    })
    assert.deepEqual(await failed.action("user-1", idleState, roleForm()), {
      status: "warning",
      message: "This anatomy role change was already completed. Delivery of its pending email notification failed. Retry it from Activity.",
    })

    const unconfirmed = roleActionHarness({ serviceResult: replayed, deliveryError: new Error("provider detail") })
    const originalConsoleError = console.error
    console.error = () => {}
    try {
      assert.deepEqual(await unconfirmed.action("user-1", idleState, roleForm()), {
        status: "warning",
        message: "This anatomy role change was already completed, but email delivery could not be confirmed. Check Activity before retrying.",
      })
    } finally {
      console.error = originalConsoleError
    }
  })

  it("reports durable notification failure as retryable after the completed local mutation", async () => {
    const harness = roleActionHarness({ deliveryResult: { status: "FAILED", attemptCount: 1, attempted: true } })
    const result = await harness.action("user-1", idleState, roleForm())
    assert.deepEqual(result, {
      status: "warning",
      message: "The anatomy role changed. Existing sign-in tokens were invalidated; the user will be signed out on their next successful database-backed session refresh. The email notification failed. Retry it from Activity.",
    })
    assert.equal(harness.calls.some(([name]) => name === "deliverAdminEmailIntent"), true)
    assert.deepEqual(harness.calls.slice(-2), [
      ["revalidatePath", "/admin/users/user-1"],
      ["revalidatePath", "/admin/users"],
    ])
  })

  it("does not promise retry when durable delivery records no transport attempt", async () => {
    const harness = roleActionHarness({ deliveryResult: { status: "FAILED", attemptCount: 0, attempted: false } })
    const result = await harness.action("user-1", idleState, roleForm())
    assert.deepEqual(result, {
      status: "warning",
      message: "The anatomy role changed. Existing sign-in tokens were invalidated; the user will be signed out on their next successful database-backed session refresh. No email was sent. Check Activity for the notification status.",
    })
    assert.doesNotMatch(result.message, /retry/i)
  })

  it("does not promise retry when delivery throws and its durable outcome is unconfirmed", async () => {
    const harness = roleActionHarness({ deliveryError: new Error("provider recipient detail") })
    const originalConsoleError = console.error
    console.error = () => {}
    let result
    try {
      result = await harness.action("user-1", idleState, roleForm())
    } finally {
      console.error = originalConsoleError
    }
    assert.deepEqual(result, {
      status: "warning",
      message: "The anatomy role changed. Existing sign-in tokens were invalidated; the user will be signed out on their next successful database-backed session refresh. Email delivery could not be confirmed. Check Activity before retrying.",
    })
    assert.doesNotMatch(result.message, /Retry it from Activity/)
  })
})

describe("Admin anatomy role controls", () => {
  it("renders only Reviewer and Editor controls with stable server-generated operation keys", () => {
    assert.match(pageSource, /section === "access"[\s\S]*<AccessSection/)
    assert.match(pageSource, /ANATOMY_REVIEWER:\s*randomUUID\(\)/)
    assert.match(pageSource, /ANATOMY_EDITOR:\s*randomUUID\(\)/)
    assert.match(formSource, /<RoleChangeFields[\s\S]*key=\{`\$\{role\}:\$\{operationId\}:\$\{status\}:\$\{operation\}`\}/)
    assert.match(formSource, /ANATOMY_REVIEWER/)
    assert.match(formSource, /ANATOMY_EDITOR/)
    assert.match(formSource, /Reviewer can review anatomy content/)
    assert.match(formSource, /Editor can review and edit anatomy content/)
    assert.doesNotMatch(formSource, /value=["']ADMIN["']/)
    assert.doesNotMatch(formSource, /value=["']ANATOMY_ADMIN["']/)
    assert.doesNotMatch(formSource, /value=["']EDITOR["']/)
    assert.doesNotMatch(actionSource, /randomUUID/)
  })

  it("shows exact state, fails closed on pending evidence, and announces safe outcomes", () => {
    assert.match(formSource, /Current state:/)
    assert.match(formSource, /After confirmation:/)
    assert.match(formSource, /PENDING/)
    assert.match(formSource, /cannot be changed while its assignment/)
    assert.match(formSource, /useActionState\([\s\S]*changeAnatomyRoleAction\.bind\(null, userId\)/)
    assert.match(formSource, /<section[^>]*aria-labelledby="delegated-role-controls-heading"/)
    const actionConfirmation = actionSource.match(/ROLE_CHANGE_CONFIRMATION = "([^"]+)"/)?.[1]
    const formConfirmation = formSource.match(/ROLE_CHANGE_CONFIRMATION = "([^"]+)"/)?.[1]
    assert.equal(actionConfirmation, "CONFIRM_ANATOMY_ROLE_CHANGE")
    assert.equal(formConfirmation, actionConfirmation)
  })

  it("keeps distinct success, warning, and error live regions outside remounted fields", () => {
    const { RoleChangeControls } = roleUiHarness()
    const controls = RoleChangeControls({
      userId: "user-1",
      roles: [],
      operationIds: {
        ANATOMY_REVIEWER: "9ed1d8b5-7941-4da6-9456-715cccf4afe4",
        ANATOMY_EDITOR: "c93e0806-4cbe-4d0b-a80d-93a611661ed8",
      },
    })
    const reviewerOwner = findElement(controls, (element) => (
      typeof element.type === "function" && element.props.role === "ANATOMY_REVIEWER"
    ))
    const reviewerTree = reviewerOwner.type(reviewerOwner.props)
    const fieldsOwner = findElement(reviewerTree, (element) => (
      typeof element.type === "function" && element.type.name === "RoleChangeFields"
    ))
    assert.equal(Object.hasOwn(fieldsOwner.props, "actionState"), false)

    const liveRegions = findElements(reviewerTree, (element) => (
      element.type === "p" && (element.props.role === "status" || element.props.role === "alert")
    ))
    assert.equal(liveRegions.length, 3)
    assert.deepEqual(liveRegions.map((region) => region.props.role), ["status", "status", "alert"])
    assert.deepEqual(liveRegions.map((region) => region.props["aria-live"]), ["polite", "polite", "assertive"])
    assert.match(liveRegions[0].props.className, /emerald/)
    assert.match(liveRegions[1].props.className, /amber/)
    assert.match(liveRegions[2].props.className, /destructive/)
  })

  it("renders the post-assignment Revoke operation as a fresh disabled, unconfirmed form", () => {
    const { RoleChangeControls } = roleUiHarness()
    const operationIds = {
      ANATOMY_REVIEWER: "9ed1d8b5-7941-4da6-9456-715cccf4afe4",
      ANATOMY_EDITOR: "c93e0806-4cbe-4d0b-a80d-93a611661ed8",
    }
    const controls = RoleChangeControls({
      userId: "user-1",
      roles: [{ role: "ANATOMY_REVIEWER", status: "VERIFIED", source: "admin" }],
      operationIds,
    })
    const reviewerOwner = findElement(controls, (element) => (
      typeof element.type === "function" && element.props.role === "ANATOMY_REVIEWER"
    ))
    const reviewerTree = reviewerOwner.type(reviewerOwner.props)
    const fieldsOwner = findElement(reviewerTree, (element) => (
      typeof element.type === "function" && element.type.name === "RoleChangeFields"
    ))
    assert.equal(fieldsOwner.key, `ANATOMY_REVIEWER:${operationIds.ANATOMY_REVIEWER}:VERIFIED:REVOKE`)

    const rendered = renderFunctionComponents(controls)
    const revokeButton = findElement(rendered, (element) => (
      element.type === "button" && /Revoke Anatomy Reviewer/.test(elementText(element))
    ))
    const confirmation = findElement(rendered, (element) => (
      element.type === "input" && element.props.name === "confirmation"
    ))
    assert.equal(revokeButton.props.disabled, true)
    assert.equal(confirmation.props.checked, false)
  })

  it("renders self-target role management as read-only with no mutation control", () => {
    const { SelfRoleManagementNotice } = roleUiHarness()
    const rendered = renderFunctionComponents(SelfRoleManagementNotice())
    assert.match(elementText(rendered), /cannot change delegated anatomy roles on your own account/i)
    assert.equal(findElement(rendered, (element) => element.type === "form" || element.type === "button"), null)
    assert.match(pageSource, /const actor = await requireFullAdminUser\(\)/)
    assert.match(pageSource, /canManageRoles=\{actor\.id !== userId\}/)
    assert.match(pageSource, /canManageRoles \? \([\s\S]*<RoleChangeControls[\s\S]*<SelfRoleManagementNotice/)
    assert.equal((pageSource.match(/requireFullAdminUser\(\)/g) ?? []).length, 1)
  })

  it("defines desktop/mobile browser acceptance and blanks SMTP for Playwright-owned servers", () => {
    assert.match(browserSource, /browser\.newContext\(\)/)
    assert.match(browserSource, /installSignedInSessionCookie/)
    assert.match(browserSource, /usesPlaywrightOwnedServer/)
    assert.doesNotMatch(browserSource, /test\.skip\(!usesPlaywrightOwnedServer/)
    assert.match(browserSource, /if \(!usesPlaywrightOwnedServer\) \{[\s\S]*throw new Error\(["']Admin user operations browser QA requires Playwright's SMTP-disabled spawned server\./)
    assert.match(browserSource, /press\("Enter"\)/)
    assert.doesNotMatch(browserSource, /targetPage\.getByText\(fixture\.target\.name/)
    assert.match(browserSource, /\/api\/auth\/session/)
    assert.match(browserSource, /beforeSession\.user\?\.id/)
    assert.match(browserSource, /afterSession\?\.user\?\.id/)
    assert.doesNotMatch(browserSource, /targetCookies|authjs\\?\.session-token/)
    assert.doesNotMatch(browserSource, /targetPage\.getByText\("Sign in to sync your account"/)
    assert.match(browserSource, /detailOverflow/)
    assert.match(browserSource, /Anatomy Editor/)
    assert.match(browserSource, /Revoke Anatomy Reviewer/)
    assert.match(browserSource, /toBeChecked\(\{ checked: false \}\)/)
    assert.doesNotMatch(browserSource, /page\.reload/)
    for (const name of ["SMTP_HOST", "SMTP_FROM", "SMTP_USER", "SMTP_PASSWORD", "SMTP_PORT"]) {
      assert.match(playwrightSource, new RegExp(`${name}: ""`))
    }
    assert.match(playwrightSource, /runsAdminUserOperations/)
    assert.match(playwrightSource, /!runsDevelopmentPaletteReview && !runsAdminUserOperations/)
  })
})
