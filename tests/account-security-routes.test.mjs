import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"
import ts from "typescript"

import {
  createCompiledModuleLoader,
  createElement,
  elementText,
  findElement,
  passThroughElement,
  renderFunctionComponents,
} from "./helpers/compiled-module.mjs"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const routeFiles = {
  confirm: "../app/api/account/security/google/link/confirm/route.ts",
  unlink: "../app/api/account/security/google/unlink/route.ts",
  password: "../app/api/account/security/password/route.ts",
  disable: "../app/api/account/security/password/disable/route.ts",
}

const routeSources = Object.fromEntries(await Promise.all(
  Object.entries(routeFiles).map(async ([key, path]) => [key, await readFile(new URL(path, import.meta.url), "utf8")]),
))
const linkFormSource = await readFile(new URL("../app/account/link-google/link-google-form.tsx", import.meta.url), "utf8")
const linkPageSource = await readFile(new URL("../app/account/link-google/page.tsx", import.meta.url), "utf8")
const methodsPanelSource = await readFile(new URL("../app/account/security/sign-in-methods-panel.tsx", import.meta.url), "utf8")
const securityPanelSource = await readFile(new URL("../app/account/security/security-panel.tsx", import.meta.url), "utf8")
const twoFactorPanelUrl = new URL("../app/account/security/two-factor-management-panel.tsx", import.meta.url)
assert.equal(
  existsSync(fileURLToPath(twoFactorPanelUrl)),
  true,
  "the account security 2FA panel source must exist",
)
const twoFactorPanelSource = await readFile(twoFactorPanelUrl, "utf8")
const linkRecoveryUrl = new URL("../lib/google-link-confirmation-recovery.ts", import.meta.url)

/** Extracts the exact string members from the account-method action-state union. */
function methodActionStateTokens(source) {
  const match = /type MethodActionState\s*=\s*(?:\|\s*)?((?:"[^"]+"\s*(?:\|\s*)?)+)/.exec(source)
  assert.ok(match, "MethodActionState string-literal union must exist")
  return [...match[1].matchAll(/"([^"]+)"/g)].map((token) => token[1]).sort()
}

/** Bounds one nested action handler by the declaration of its next sibling. */
function actionHandlerSource(source, functionName, nextFunctionName) {
  const startMarker = `  async function ${functionName}(`
  const endMarker = `\n  async function ${nextFunctionName}(`
  const start = source.indexOf(startMarker)
  assert.notEqual(start, -1, `missing ${functionName} action handler`)
  const end = source.indexOf(endMarker, start + startMarker.length)
  assert.notEqual(end, -1, `missing ${nextFunctionName} boundary after ${functionName}`)
  return source.slice(start, end)
}

/** Finds direct, optional, indexed, destructured, or whole-object copies of `result.message`. */
function resultMessageReads(source) {
  const sourceFile = ts.createSourceFile(
    "result-message-privacy.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
  const reads = []
  const unwrapExpression = (node) => {
    let value = node
    while (
      value
      && (ts.isParenthesizedExpression(value)
        || ts.isAsExpression(value)
        || ts.isTypeAssertionExpression(value)
        || ts.isNonNullExpression(value)
        || ts.isSatisfiesExpression(value))
    ) {
      value = value.expression
    }
    return value
  }
  const isResult = (node) => {
    const value = unwrapExpression(node)
    return Boolean(value && ts.isIdentifier(value) && value.text === "result")
  }
  const isMessage = (node) => {
    const value = unwrapExpression(node)
    return Boolean(
      value
      && ((ts.isIdentifier(value) && value.text === "message")
        || (ts.isStringLiteralLike(value) && value.text === "message")),
    )
  }
  const objectLiteralReadsMessage = (node) => {
    const value = ts.isParenthesizedExpression(node) ? node.expression : node
    return ts.isObjectLiteralExpression(value) && value.properties.some((property) => (
      ts.isSpreadAssignment(property)
      || (ts.isShorthandPropertyAssignment(property) && property.name.text === "message")
      || (ts.isPropertyAssignment(property) && isMessage(property.name))
    ))
  }
  const isNamedObjectMethod = (node, objectName, methodName) => {
    const value = unwrapExpression(node)
    return Boolean(
      value
      && ts.isPropertyAccessExpression(value)
      && ts.isIdentifier(value.expression)
      && value.expression.text === objectName
      && value.name.text === methodName
    )
  }
  const callCopiesResult = (node) => {
    if (!ts.isCallExpression(node)) return false
    const callee = unwrapExpression(node.expression)
    if (ts.isIdentifier(callee) && callee.text === "structuredClone") {
      return isResult(node.arguments[0])
    }
    if (isNamedObjectMethod(callee, "JSON", "stringify")) {
      return isResult(node.arguments[0])
    }
    if (isNamedObjectMethod(callee, "Object", "assign")) {
      return node.arguments.slice(1).some((argument) => isResult(argument))
    }
    return false
  }

  function visit(node) {
    if (
      ts.isPropertyAccessExpression(node)
      && isResult(node.expression)
      && node.name.text === "message"
    ) {
      reads.push(node)
    } else if (
      ts.isElementAccessExpression(node)
      && isResult(node.expression)
      && isMessage(node.argumentExpression)
    ) {
      reads.push(node)
    } else if (
      ts.isVariableDeclaration(node)
      && isResult(node.initializer)
      && ts.isObjectBindingPattern(node.name)
      && node.name.elements.some((element) => (
        element.dotDotDotToken || isMessage(element.propertyName ?? element.name)
      ))
    ) {
      reads.push(node)
    } else if (
      ts.isBinaryExpression(node)
      && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
      && isResult(node.right)
      && objectLiteralReadsMessage(node.left)
    ) {
      reads.push(node)
    } else if (
      ts.isSpreadAssignment(node)
      && isResult(node.expression)
    ) {
      reads.push(node)
    } else if (callCopiesResult(node)) {
      reads.push(node)
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return reads
}

const UPDATED = {
  status: "UPDATED",
  emailIntentId: "notice-1",
  googleLinked: true,
  passwordEnabled: true,
}

describe("account security route adapters", () => {
  it("requires authentication for every account-method mutation", async () => {
    for (const routeName of Object.keys(routeFiles)) {
      const scenario = loadRoute(routeName, { session: null })
      const response = await scenario.POST(requestFor(routeName, validBody(routeName)))
      assert.equal(response.status, 401, routeName)
      assert.deepEqual(response.body, {
        code: "AUTHENTICATION_REQUIRED",
        message: "Sign in and try again.",
      }, routeName)
      assert.deepEqual(scenario.serviceCalls, [], routeName)
      assert.equal(scenario.scheduled.length, 0, routeName)
    }
  })

  it("accepts only each route's narrow proof fields and exact confirmation", async () => {
    const malformed = [
      ["confirm", { confirmed: "true" }],
      ["confirm", { confirmed: true, password: "must-not-enter-this-route" }],
      ["unlink", { confirmed: true, password: "password", providerAccountId: "secret-provider-id" }],
      ["password", { mode: "ADD", newPassword: "a-long-new-password", confirmed: 1 }],
      ["password", { mode: "REMOVE", newPassword: "a-long-new-password", confirmed: true }],
      ["disable", { confirmed: true, twoFactorCode: "123456" }],
    ]
    for (const [routeName, body] of malformed) {
      const scenario = loadRoute(routeName)
      const response = await scenario.POST(requestFor(routeName, body))
      assert.equal(response.status, 400, `${routeName}: ${JSON.stringify(body)}`)
      assert.equal(response.body.code, "INVALID_REQUEST")
      assert.deepEqual(scenario.serviceCalls, [])
    }
  })

  it("requires an exact bound matching intent and fresh matching Credentials session", async () => {
    for (const options of [
      { resolvedIntent: null },
      { resolvedIntent: { id: "intent-1", targetUserId: "other-user" } },
      { session: { user: { id: "user-1" }, lastPasswordAuthenticatedAt: Date.parse("2026-08-28T11:54:59.999Z") } },
      { session: { user: { id: "user-1" } } },
    ]) {
      const scenario = loadRoute("confirm", options)
      const response = await scenario.POST(requestFor("confirm", { confirmed: true }))
      assert.equal(response.status, 403)
      assert.equal(response.body.code, "PROOF_EXPIRED")
      assert.deepEqual(scenario.serviceCalls, [])
    }
  })

  it("passes only the cookie-resolved intent and fresh session claim to Google link confirmation", async () => {
    const scenario = loadRoute("confirm")
    const response = await scenario.POST(requestFor("confirm", { confirmed: true }, "intent-cookie-value"))

    assert.equal(response.status, 200)
    assert.deepEqual(response.body, {
      code: "GOOGLE_LINKED",
      message: "Google sign-in is now linked to this MassageLab account.",
      googleLinked: true,
      hasPasswordCredential: true,
    })
    assert.deepEqual(scenario.intentCalls, [{
      cookieValue: "intent-cookie-value",
      purpose: "SIGN_IN_OR_LINK",
      status: "PROVIDER_PROVEN",
    }])
    assert.deepEqual(scenario.serviceCalls, [{
      intentId: "intent-1",
      sessionUserId: "user-1",
      lastPasswordAuthenticatedAt: Date.parse("2026-08-28T12:00:00.000Z"),
      confirmed: true,
    }])
    assert.equal(scenario.scheduled.length, 1)
    await scenario.scheduled[0]()
    assert.deepEqual(scenario.deliveryCalls, ["notice-1"])
    assertCookieCleared(response)
  })

  it("maps proof-domain rejections safely and never schedules delivery on rejection", async () => {
    for (const [routeName, code, status] of [
      ["unlink", "TWO_FACTOR_REQUIRED", 403],
      ["unlink", "LAST_METHOD", 409],
      ["password", "ALREADY_LINKED", 409],
      ["password", "INVALID_PROOF", 403],
      ["disable", "INTENT_EXPIRED", 403],
      ["confirm", "CONFLICT", 409],
    ]) {
      const scenario = loadRoute(routeName, { result: { status: "REJECTED", code } })
      const response = await scenario.POST(requestFor(routeName, validBody(routeName)))
      assert.equal(response.status, status, `${routeName}:${code}`)
      assert.equal(response.body.code, code === "INTENT_EXPIRED" ? "PROOF_EXPIRED" : code)
      assert.equal(scenario.scheduled.length, 0)
      assert.equal(response.cookieSets.length, 0)
      assert.deepEqual(Object.keys(response.body).sort(), ["code", "message"])
    }
  })

  it("maps direct-proof throttling to bounded Retry-After responses without mutation follow-up", async () => {
    for (const routeName of ["unlink", "password"]) {
      for (const [retryAfterSeconds, expectedHeader] of [
        [47, "47"],
        [901, "900"],
        [0, "1"],
        [1.5, "1"],
      ]) {
        const scenario = loadRoute(routeName, {
          result: { status: "REJECTED", code: "RATE_LIMITED", retryAfterSeconds },
        })
        const response = await scenario.POST(requestFor(routeName, validBody(routeName)))

        assert.equal(response.status, 429, `${routeName}:${retryAfterSeconds}`)
        assert.equal(response.headers.get("Retry-After"), expectedHeader, `${routeName}:${retryAfterSeconds}`)
        assert.deepEqual(response.body, {
          code: "RATE_LIMITED",
          message: "Too many attempts. Wait a little, then try again.",
        })
        assert.equal(scenario.serviceCalls.length, 1)
        assert.equal(scenario.scheduled.length, 0)
        assert.equal(response.cookieSets.length, 0)
      }
    }
  })

  it("delegates unlink, password add/change, and password disable once, then schedules notice and clears consumed bindings", async () => {
    const cases = [
      ["unlink", { ...UPDATED, googleLinked: false }, false],
      ["password", UPDATED, true],
      ["disable", { ...UPDATED, passwordEnabled: false }, true],
    ]
    for (const [routeName, result, clearsCookie] of cases) {
      const scenario = loadRoute(routeName, { result })
      const response = await scenario.POST(requestFor(routeName, validBody(routeName)))
      assert.equal(response.status, 200, routeName)
      assert.equal(scenario.serviceCalls.length, 1, routeName)
      assert.equal(scenario.scheduled.length, 1, routeName)
      assert.deepEqual(Object.keys(response.body).sort(), ["code", "googleLinked", "hasPasswordCredential", "message"])
      assert.equal(response.body.googleLinked, result.googleLinked)
      assert.equal(response.body.hasPasswordCredential, result.passwordEnabled)
      assert.equal(response.cookieSets.length, clearsCookie ? 1 : 0)
      if (clearsCookie) assertCookieCleared(response)
    }
  })

  it("proves ADD before hashing and passes only raw new password into the proof-owning service", async () => {
    const events = []
    const scenario = loadRoute("password", {
      onResolveIntent: () => events.push("preflight"),
      onHash: () => events.push("route-hash"),
      onMutate: (input) => {
        events.push("service")
        assert.equal(input.newPassword, "a-long-new-password")
        assert.equal(Object.hasOwn(input, "newPasswordHash"), false)
        assert.deepEqual(input.googleReauthPreflight, { intentId: "intent-1", targetUserId: "user-1" })
      },
    })

    const response = await scenario.POST(requestFor("password", validBody("password")))

    assert.equal(response.status, 200)
    assert.deepEqual(events, ["preflight", "service"])
  })

  it("keeps raw proof and provider material out of responses, logs, and route-owned persistence", () => {
    for (const [name, source] of Object.entries(routeSources)) {
      assert.doesNotMatch(source, /console\s*\.|logger\s*\./, name)
      assert.doesNotMatch(source, /providerAccountId|providerEmailHash|browserBindingHash/, name)
      assert.doesNotMatch(source, /\.(?:create|update|updateMany|upsert|delete|deleteMany)\s*\(/, name)
    }
  })
})

describe("recoverable account-method UI contracts", () => {
  it("recognizes every direct result-message access form at the privacy boundary", () => {
    for (const source of [
      "consume(result.message)",
      "consume(result?.message)",
      "consume((result).message)",
      "consume(result!.message)",
      "consume((result as { message: string }).message)",
      'consume(result["message"])',
      'consume(result[("message")])',
      'consume(result["message" as const])',
      'consume(result?.["message"])',
      "const { message } = result",
      "const { message } = (result satisfies { message: string })",
      "const { message: feedback } = result",
      "({ message } = result)",
      "const { ...rest } = result",
      "const { code, ...rest } = result",
      "({ ...rest } = result)",
      "consume({ ...result })",
      "consume({ code: 'safe', ...result })",
      "Object.assign({}, result)",
      "Object.assign({}, safe, (result as MethodResult))",
      "JSON.stringify(result)",
      "JSON.stringify((result satisfies MethodResult))",
      "structuredClone(result)",
      "structuredClone(result!)",
    ]) {
      assert.equal(resultMessageReads(source).length, 1, source)
    }
    for (const source of [
      "consume(result.code); const { code } = result",
      "const { ...rest } = other; consume({ ...other })",
      "consume({ message: safeMessage })",
      "Object.assign(result, { code: 'safe' })",
      "Object.assign({}, { code: result.code })",
      "JSON.stringify(result.code)",
      "JSON.stringify(other)",
      "structuredClone(result.code)",
      "structuredClone(other)",
    ]) {
      assert.equal(resultMessageReads(source).length, 0, source)
    }
  })

  it("allowlists actionable matching-account recovery without rendering arbitrary response text", async () => {
    assert.equal(
      existsSync(fileURLToPath(linkRecoveryUrl)),
      true,
      "missing controlled Google-link recovery owner",
    )
    const recoverySource = await readFile(linkRecoveryUrl, "utf8")
    const {
      resolveCredentialLinkRecovery,
      resolveGoogleLinkConfirmationRecovery,
    } = loadCompiledModule(recoverySource, "lib/google-link-confirmation-recovery.test.ts")

    assert.deepEqual(resolveCredentialLinkRecovery("TWO_FACTOR_REQUIRED"), {
      message: "Enter your authenticator or backup code, then try again.",
      needsTwoFactor: true,
    })
    assert.deepEqual(resolveCredentialLinkRecovery("TWO_FACTOR_INVALID"), {
      message: "The authenticator or backup code was not accepted. Check the code and try again.",
      needsTwoFactor: true,
    })
    assert.deepEqual(resolveCredentialLinkRecovery("INVALID_CREDENTIALS"), {
      message: "The account email or password was not accepted. Try again or reset your password.",
      needsTwoFactor: false,
    })
    assert.deepEqual(resolveCredentialLinkRecovery("CredentialsSignin"), {
      message: "The account email or password was not accepted. Try again or reset your password.",
      needsTwoFactor: false,
    })
    assert.deepEqual(resolveCredentialLinkRecovery("EMAIL_UNVERIFIED"), {
      message: "Verify this account's email, then try again.",
      needsTwoFactor: false,
    })
    assert.deepEqual(resolveCredentialLinkRecovery("RATE_LIMITED"), {
      message: "Too many attempts. Wait a little, then try again.",
      needsTwoFactor: false,
    })

    assert.deepEqual(resolveGoogleLinkConfirmationRecovery(403, "PROOF_EXPIRED"), {
      message: "This confirmation expired or belongs to another session. Start again with Google sign-in.",
    })
    assert.deepEqual(resolveGoogleLinkConfirmationRecovery(401, "AUTHENTICATION_REQUIRED"), {
      message: "Your password confirmation ended. Start again with Google sign-in, then confirm the password account.",
    })
    assert.deepEqual(resolveGoogleLinkConfirmationRecovery(409, "ALREADY_LINKED"), {
      message: "Google sign-in is already linked. Return to Account Security to review your sign-in methods.",
    })
    for (const code of ["CONFLICT", "LAST_METHOD"]) {
      assert.deepEqual(resolveGoogleLinkConfirmationRecovery(409, code), {
        message: "Your sign-in methods changed. Refresh Account Security, then start Google sign-in again if it is not linked.",
      })
    }
    assert.deepEqual(resolveGoogleLinkConfirmationRecovery(400, "INVALID_REQUEST"), {
      message: "Confirm that Google and password should open the same account, then try again.",
    })

    const generic = { message: "Something went wrong. Please try again." }
    assert.deepEqual(resolveCredentialLinkRecovery("private-provider-detail"), generic)
    assert.deepEqual(resolveGoogleLinkConfirmationRecovery(500, "PROOF_EXPIRED"), generic)
    assert.deepEqual(resolveGoogleLinkConfirmationRecovery(403, "private-provider-detail"), generic)
    assert.match(linkFormSource, /resolveCredentialLinkRecovery/)
    assert.match(linkFormSource, /resolveGoogleLinkConfirmationRecovery/)
    assert.doesNotMatch(linkFormSource, /result\.message/)
  })

  it("signs in with Credentials before link confirmation and sends confirmation only", () => {
    const signInIndex = linkFormSource.indexOf('signIn("credentials"')
    const confirmIndex = linkFormSource.indexOf('fetch("/api/account/security/google/link/confirm"')
    assert.ok(signInIndex >= 0)
    assert.ok(confirmIndex > signInIndex)
    const confirmationBody = linkFormSource.slice(confirmIndex, confirmIndex + 600)
    assert.match(confirmationBody, /JSON\.stringify\(\{\s*confirmed:\s*true\s*\}\)/)
    assert.doesNotMatch(confirmationBody, /password|twoFactorCode|provider|intent/i)
    assert.match(linkFormSource, /same MassageLab account/i)
    assert.match(linkFormSource, /redirect:\s*false/)
  })

  it("never reveals intent or provider identifiers from the link page", () => {
    assert.doesNotMatch(linkPageSource, /intentId|providerAccountId|providerEmailHash|browserBindingToken/)
    assert.match(linkPageSource, /AUTH_METHOD_INTENT_COOKIE/)
    assert.match(linkPageSource, /validIntent/)
  })

  it("keeps the security shell composition-only and gives two-factor recovery one owner", () => {
    assert.match(securityPanelSource, /<SignInMethodsPanel/)
    assert.match(securityPanelSource, /<TwoFactorManagementPanel/)
    assert.doesNotMatch(securityPanelSource, /\/api\/account\/security\//)
    assert.doesNotMatch(securityPanelSource, /qrCode|manualCode|backupCodes|verificationCode/)
    assert.match(twoFactorPanelSource, /data-two-factor-action/)
    const expectedActionStates = ["error", "idle", "proving", "redirecting", "saving", "success"]
    assert.deepEqual(methodActionStateTokens(methodsPanelSource), expectedActionStates)
    assert.deepEqual(methodActionStateTokens(`
      type MethodActionState =
        | "idle"
        | "proving"
        | "saving"
        | "redirecting"
        | "success"
        | "error"
    `), expectedActionStates)
    const savePasswordHandler = actionHandlerSource(methodsPanelSource, "savePassword", "unlinkGoogle")
    let previousMarkerIndex = -1
    for (const marker of [
      "try {",
      'const response = await fetch("/api/account/security/password"',
      "} catch {",
      "} finally {",
    ]) {
      const markerIndex = savePasswordHandler.indexOf(marker, previousMarkerIndex + 1)
      assert.notEqual(markerIndex, -1, `savePassword must contain ordered ${marker}`)
      previousMarkerIndex = markerIndex
    }
    assert.match(methodsPanelSource, /aria-busy/)
    assert.match(methodsPanelSource, /role=\{(?=[^}]*"alert")(?=[^}]*"status")(?=[^}]*\?)(?=[^}]*:)[^}]*\}/)
    assert.match(methodsPanelSource, /aria-live=\{(?=[^}]*"assertive")(?=[^}]*"polite")(?=[^}]*\?)(?=[^}]*:)[^}]*\}/)
    assert.match(twoFactorPanelSource, /resolveTwoFactorManagementRecovery/)
    assert.equal(
      resultMessageReads(twoFactorPanelSource).length,
      0,
      "two-factor recovery must not render arbitrary response message fields",
    )
    assert.doesNotMatch(twoFactorPanelSource, /localStorage|sessionStorage|useRouter|router\.refresh|console\s*\.|logger\s*\./)
  })

  it("keeps every sign-in method action's proof and confirmation state isolated", () => {
    for (const owner of [
      "addPassword",
      "addPasswordConfirmed",
      "changeCurrentPassword",
      "changeNewPassword",
      "changeTwoFactorCode",
      "changePasswordConfirmed",
      "unlinkPassword",
      "unlinkTwoFactorCode",
      "unlinkGoogleConfirmed",
      "disablePasswordConfirmed",
    ]) {
      assert.match(methodsPanelSource, new RegExp(`\\[${owner},\\s*set${owner[0].toUpperCase()}${owner.slice(1)}\\]`), owner)
    }
    assert.doesNotMatch(methodsPanelSource, /\[confirmChange,|\[currentPassword,|\[newPassword,|\[twoFactorCode,/)
    assert.match(methodsPanelSource, /mode,\s*currentPassword:\s*changeCurrentPassword,\s*newPassword:\s*changeNewPassword,\s*twoFactorCode:\s*changeTwoFactorCode,\s*confirmed:\s*changePasswordConfirmed/)
    assert.match(methodsPanelSource, /password:\s*unlinkPassword,\s*twoFactorCode:\s*unlinkTwoFactorCode,\s*confirmed:\s*unlinkGoogleConfirmed/)
    assert.match(methodsPanelSource, /JSON\.stringify\(\{\s*confirmed:\s*disablePasswordConfirmed\s*\}\)/)
  })

  it("signs out after destructive method changes while add and rejected changes stay on the page", async () => {
    for (const action of ["change", "unlink", "disable"]) {
      const harness = createMethodsPanelHarness({
        action,
        response: jsonResponse(200, methodSuccess(action)),
      })
      try {
        await harness.invoke(action)
        assert.deepEqual(harness.signOutCalls, [[{
          redirectTo: "/login?security=sign-in-methods-changed",
        }]], action)
        assert.equal(harness.pendingDuringSignOut.length, 1, action)
        assert.equal(harness.pendingDuringSignOut[0].props.disabled, true, action)
        assert.equal(harness.pendingDuringSignOut[0].props["aria-busy"], true, action)
        assert.notEqual(harness.pendingAction(), null, action)
      } finally {
        harness.restore()
      }
    }

    const addHarness = createMethodsPanelHarness({
      action: "add",
      response: jsonResponse(200, methodSuccess("add")),
      href: "https://massagelab.test/account?tab=security&reauth=complete&return=%2Fclock#methods",
    })
    try {
      await addHarness.invoke("add")
      assert.deepEqual(addHarness.signOutCalls, [])
      assert.equal(addHarness.pendingAction(), null)
    } finally {
      addHarness.restore()
    }

    for (const action of ["change", "unlink", "disable"]) {
      const harness = createMethodsPanelHarness({
        action,
        response: jsonResponse(403, { code: "INVALID_PROOF", message: "Try again." }),
      })
      try {
        await harness.invoke(action)
        assert.deepEqual(harness.signOutCalls, [], action)
        assert.equal(harness.pendingAction(), null, action)
      } finally {
        harness.restore()
      }
    }
  })

  it("forces login navigation when post-mutation sign-out rejects or returns without navigating", async () => {
    for (const signOutBehavior of ["reject", "no-navigation"]) {
      const harness = createMethodsPanelHarness({
        action: "change",
        response: jsonResponse(200, methodSuccess("change")),
        signOutBehavior,
      })
      try {
        await harness.invoke("change")
        assert.equal(harness.href(), "https://massagelab.test/login?security=sign-in-methods-changed", signOutBehavior)
        assert.equal(harness.pendingAction(), "password", signOutBehavior)
        assert.deepEqual(harness.signOutCalls, [[{
          redirectTo: "/login?security=sign-in-methods-changed",
        }]], signOutBehavior)
      } finally {
        harness.restore()
      }
    }
  })

  it("removes only the consumed or expired reauth marker and restores Google proof actions", async () => {
    const successfulAdd = createMethodsPanelHarness({
      action: "add",
      response: jsonResponse(200, methodSuccess("add")),
      href: "https://massagelab.test/account?tab=security&reauth=complete&return=%2Fclock#methods",
    })
    try {
      await successfulAdd.invoke("add")
      assert.deepEqual(successfulAdd.routerReplaceCalls, [[
        "/account?tab=security&return=%2Fclock#methods",
        { scroll: false },
      ]])
    } finally {
      successfulAdd.restore()
    }

    for (const action of ["add", "disable"]) {
      const harness = createMethodsPanelHarness({
        action,
        response: jsonResponse(403, {
          code: "PROOF_EXPIRED",
          message: "This confirmation expired. Confirm with Google again.",
        }),
        href: "https://massagelab.test/account?tab=security&reauth=complete&return=%2Fclock#methods",
      })
      try {
        await harness.invoke(action)
        assert.deepEqual(harness.routerReplaceCalls, [[
          "/account?tab=security&return=%2Fclock#methods",
          { scroll: false },
        ]], action)
        assert.equal(harness.href(), "https://massagelab.test/account?tab=security&return=%2Fclock#methods", action)
        const retryLabel = action === "add" ? "Add password" : "Confirm Google to disable password"
        assert.ok(findButton(harness.render(), retryLabel), action)
        assert.deepEqual(harness.signOutCalls, [], action)
      } finally {
        harness.restore()
      }
    }
  })
})

function methodSuccess(action) {
  if (action === "unlink") {
    return { code: "GOOGLE_UNLINKED", message: "Google sign-in was removed.", googleLinked: false, hasPasswordCredential: true }
  }
  if (action === "disable") {
    return { code: "PASSWORD_DISABLED", message: "Password sign-in was disabled.", googleLinked: true, hasPasswordCredential: false }
  }
  return { code: "PASSWORD_UPDATED", message: "Password sign-in was saved.", googleLinked: true, hasPasswordCredential: true }
}

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return body },
  }
}

/** Executes the real sign-in-method panel with deterministic hook, navigation, and request owners. */
function createMethodsPanelHarness({
  action,
  response,
  signOutBehavior = "navigate",
  href = action === "disable"
    ? "https://massagelab.test/account?tab=security&reauth=complete"
    : "https://massagelab.test/account?tab=security",
}) {
  const hooks = createMethodsPanelHookRuntime()
  const signOutCalls = []
  const routerReplaceCalls = []
  const pendingDuringSignOut = []
  let currentUrl = new URL(href)
  let actionLock = null
  const props = {
    hasPasswordCredential: action !== "add",
    googleLinked: true,
    pendingAction: null,
    beginAction(nextAction) {
      if (actionLock !== null) return false
      actionLock = nextAction
      props.pendingAction = nextAction
      return true
    },
    finishAction(expectedAction) {
      if (actionLock !== expectedAction) return
      actionLock = null
      props.pendingAction = null
    },
    onMethodAvailabilityChange(update) {
      Object.assign(props, update)
    },
  }
  const location = {}
  Object.defineProperties(location, {
    href: {
      get: () => currentUrl.href,
      set: (value) => { currentUrl = new URL(String(value), currentUrl) },
    },
    pathname: { get: () => currentUrl.pathname },
    search: { get: () => currentUrl.search },
    hash: { get: () => currentUrl.hash },
  })

  const previousFetch = globalThis.fetch
  const previousWindow = globalThis.window
  globalThis.fetch = async () => response
  globalThis.window = { location }
  let restored = false

  const router = {
    replace(path, options) {
      routerReplaceCalls.push([path, options])
      currentUrl = new URL(path, currentUrl)
    },
  }
  let compiled
  try {
    compiled = loadCompiledModule(methodsPanelSource, "app/account/security/sign-in-methods-panel.ui-test.tsx", {
      react: hooks.react,
      "react/jsx-runtime": { Fragment: "fragment", jsx: createElement, jsxs: createElement },
      "next-auth/react": {
        async signIn(_provider, options) {
          currentUrl = new URL(String(options?.redirectTo ?? currentUrl.href), currentUrl)
        },
        async signOut(...args) {
          signOutCalls.push(args)
          pendingDuringSignOut.push(findButton(render(), "Saving sign-in method…"))
          if (signOutBehavior === "reject") throw new Error("sign-out failed")
          if (signOutBehavior === "navigate") {
            currentUrl = new URL(String(args[0]?.redirectTo ?? currentUrl.href), currentUrl)
          }
        },
      },
      "next/navigation": { useRouter: () => router },
      "@/components/forms/async-action-button": {
        AsyncActionButton(buttonProps) {
          return createElement("button", {
            ...buttonProps,
            "aria-busy": buttonProps.pending,
            disabled: buttonProps.pending || buttonProps.disabled,
            children: buttonProps.pending ? buttonProps.pendingLabel : buttonProps.idleLabel,
          })
        },
      },
      "@/components/ui/app-surface": {
        AppInset: passThroughElement("div"),
        AppSurface({ title, description, children, ...surfaceProps }) {
          return createElement("section", { ...surfaceProps, children: [title, description, children] })
        },
      },
      "@/components/ui/input": { Input: passThroughElement("input") },
      "@/components/ui/label": { Label: passThroughElement("label") },
    })
  } catch (error) {
    restore()
    throw error
  }

  function render() {
    hooks.startRender()
    return renderFunctionComponents(compiled.SignInMethodsPanel(props))
  }

  async function invoke(nextAction) {
    const tree = render()
    if (nextAction === "disable") {
      const control = findButton(tree, "Disable password sign-in")
      assert.ok(control, nextAction)
      await control.props.onClick()
      return
    }
    const label = nextAction === "change"
      ? "Update password"
      : nextAction === "unlink"
        ? "Unlink Google"
        : "Add password sign-in"
    const form = findElement(tree, (element) => element.type === "form" && elementText(element).includes(label))
    assert.ok(form, nextAction)
    await form.props.onSubmit({ preventDefault() {} })
  }

  function restore() {
    if (restored) return
    restored = true
    globalThis.fetch = previousFetch
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
  }

  render()
  return {
    href: () => currentUrl.href,
    invoke,
    pendingAction: () => props.pendingAction,
    pendingDuringSignOut,
    render,
    restore,
    routerReplaceCalls,
    signOutCalls,
  }
}

function createMethodsPanelHookRuntime() {
  const state = []
  const mountedEffects = new Set()
  let cursor = 0
  return {
    startRender() { cursor = 0 },
    react: {
      useState(initialValue) {
        const index = cursor
        cursor += 1
        if (!(index in state)) state[index] = typeof initialValue === "function" ? initialValue() : initialValue
        return [state[index], (value) => {
          state[index] = typeof value === "function" ? value(state[index]) : value
        }]
      },
      useEffect(effect) {
        const index = cursor
        cursor += 1
        if (mountedEffects.has(index)) return
        mountedEffects.add(index)
        effect()
      },
    },
  }
}

function findButton(tree, label) {
  return findElement(tree, (element) => element.type === "button" && elementText(element) === label)
}

function loadRoute(routeName, {
  session = {
    user: { id: "user-1" },
    lastPasswordAuthenticatedAt: Date.parse("2026-08-28T12:00:00.000Z"),
  },
  result,
  resolvedIntent = { id: "intent-1", targetUserId: "user-1" },
  onResolveIntent = () => {},
  onHash = () => {},
  onMutate = () => {},
} = {}) {
  const source = routeSources[routeName]
  const scheduled = []
  const serviceCalls = []
  const deliveryCalls = []
  const intentCalls = []
  const prisma = {}
  const services = {
    async confirmGoogleLink(input) { serviceCalls.push(publicServiceInput(input)); return result ?? UPDATED },
    async removeGoogleMethod(input) { serviceCalls.push(publicServiceInput(input)); return result ?? { ...UPDATED, googleLinked: false } },
    async setPasswordMethod(input) { onMutate(input); serviceCalls.push(publicServiceInput(input)); return result ?? UPDATED },
    async removePasswordMethod(input) { serviceCalls.push(publicServiceInput(input)); return result ?? { ...UPDATED, passwordEnabled: false } },
  }
  const dependencies = {
    "next/server": {
      after: (callback) => scheduled.push(callback),
      NextResponse: responseAdapter(),
    },
    "@/auth": { getCurrentSession: async () => session },
    "@/lib/account-security-email-intents": {
      deliverAccountSecurityEmailIntent: async ({ intentId }) => { deliveryCalls.push(intentId) },
    },
    "@/lib/account-security-methods": services,
    "@/lib/account-surface-data": { clearAccountSurfaceDataCache: () => {} },
    "@/lib/auth-env": { getAuthSecret: () => "route-secret" },
    "@/lib/auth-method-intents": {
      AUTH_METHOD_INTENT_COOKIE: "ml-auth-method-binding",
      resolveBoundAuthMethodIntent: async (input) => {
        onResolveIntent(input)
        intentCalls.push({ cookieValue: input.cookieValue, purpose: input.purpose, status: input.status })
        assert.equal(input.prismaClient, prisma)
        assert.equal(input.secret, "route-secret")
        return resolvedIntent
      },
    },
    "@/lib/auth-request": { authRequestNetworkIdentifier: () => "network" },
    "@/lib/auth-security": { hashPassword: async () => { onHash(); return "argon2-hash" } },
    "@/lib/prisma": { prisma },
  }
  const routeModule = loadCompiledModule(source, `${routeName}-account-security-route.test.ts`, dependencies)
  const factoryName = {
    confirm: "createGoogleLinkConfirmHandler",
    unlink: "createGoogleUnlinkHandler",
    password: "createPasswordMethodHandler",
    disable: "createPasswordDisableHandler",
  }[routeName]
  const POST = routeModule[factoryName]({
    prismaClient: prisma,
    getSession: async () => session,
    secret: "route-secret",
    resolveIntent: dependencies["@/lib/auth-method-intents"].resolveBoundAuthMethodIntent,
    mutate: services[{
      confirm: "confirmGoogleLink",
      unlink: "removeGoogleMethod",
      password: "setPasswordMethod",
      disable: "removePasswordMethod",
    }[routeName]],
    scheduleAfter: dependencies["next/server"].after,
    deliver: dependencies["@/lib/account-security-email-intents"].deliverAccountSecurityEmailIntent,
    hashPassword: dependencies["@/lib/auth-security"].hashPassword,
    clock: () => new Date("2026-08-28T12:00:00.000Z"),
    clearCache: () => {},
  })
  return { POST, scheduled, serviceCalls, deliveryCalls, intentCalls }
}

function publicServiceInput(input) {
  const copy = { ...input }
  delete copy.prismaClient
  delete copy.verifyPasswordMethodProofFn
  delete copy.newPasswordHash
  delete copy.newPassword
  delete copy.hashPasswordFn
  delete copy.googleReauthPreflight
  delete copy.secret
  delete copy.now
  delete copy.networkIdentifier
  return copy
}

function responseAdapter() {
  return {
    json(body, init = {}) {
      const response = {
        body,
        status: init.status ?? 200,
        headers: new Headers(init.headers),
        cookieSets: [],
      }
      response.cookies = { set: (...args) => response.cookieSets.push(args) }
      return response
    },
  }
}

function requestFor(routeName, body, cookie = "intent-cookie-value") {
  const path = {
    confirm: "google/link/confirm",
    unlink: "google/unlink",
    password: "password",
    disable: "password/disable",
  }[routeName]
  return new Request(`https://massagelab.test/api/account/security/${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `ml-auth-method-binding=${cookie}`,
      "x-forwarded-for": "203.0.113.9",
    },
    body: JSON.stringify(body),
  })
}

function validBody(routeName) {
  if (routeName === "confirm" || routeName === "disable") return { confirmed: true }
  if (routeName === "unlink") return { password: "current-password", twoFactorCode: "123456", confirmed: true }
  return { mode: "ADD", newPassword: "a-long-new-password", confirmed: true }
}

function assertCookieCleared(response) {
  assert.equal(response.cookieSets.length, 1)
  const [name, value, options] = response.cookieSets[0]
  assert.equal(name, "ml-auth-method-binding")
  assert.equal(value, "")
  assert.equal(options.maxAge, 0)
  assert.equal(options.httpOnly, true)
  assert.equal(options.sameSite, "lax")
  assert.equal(options.path, "/")
  assert.equal(typeof options.secure, "boolean")
}
