import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import {
  createCompiledModuleLoader,
  createElement,
  elementText,
  findElement,
  passThroughElement,
  renderFunctionComponents,
} from "./helpers/compiled-module.mjs"
import {
  buildVerificationEmailUrl,
  buildVerificationLoginPath,
  normalizeEmailVerificationParams,
  REGISTRATION_VERIFICATION_FAILED_MESSAGE,
  REGISTRATION_VERIFICATION_SENT_MESSAGE,
  registrationVerificationResponse,
  sendRegistrationVerification,
} from "../lib/auth-registration.js"
import {
  buildRegistrationLegalProviderRedirectPath,
  isRegistrationLegalAcceptancePath,
  safePostLegalAcceptanceCallback,
} from "../lib/legal-acceptance-gate.js"
import { REGISTRATION_PAUSED_MESSAGE } from "../lib/public-launch-controls.js"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)

describe("registration email delivery policy", () => {
  it("returns the registration pause before parsing or account work", async () => {
    const afterCallbacks = []
    let jsonCalls = 0
    let registrationCalls = 0
    const { POST } = await loadRegistrationRoute({
      afterCallbacks,
      registrationOpen: false,
      registerWork: async () => {
        registrationCalls += 1
        return { status: "ACCEPTED" }
      },
    })

    const response = await POST({
      headers: new Headers(),
      json: async () => {
        jsonCalls += 1
        throw new Error("paused registration must not parse a body")
      },
    })

    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), {
      message: REGISTRATION_PAUSED_MESSAGE,
    })
    assert.equal(jsonCalls, 0)
    assert.equal(registrationCalls, 0)
    assert.deepEqual(afterCallbacks, [])
  })

  it("returns success only when verification has a deliverable path", () => {
    assert.deepEqual(registrationVerificationResponse({ delivered: true }), {
      status: 200,
      body: { message: REGISTRATION_VERIFICATION_SENT_MESSAGE },
    })
    assert.deepEqual(registrationVerificationResponse({ delivered: false }), {
      status: 503,
      body: { message: REGISTRATION_VERIFICATION_FAILED_MESSAGE },
    })
  })

  it("allows development verification links without SMTP delivery", () => {
    assert.deepEqual(registrationVerificationResponse({ delivered: false, devLink: "/verify-email?token=dev" }), {
      status: 200,
      body: {
        message: REGISTRATION_VERIFICATION_SENT_MESSAGE,
        devLink: "/verify-email?token=dev",
      },
    })
  })

  it("delegates every valid account state to the enumeration-safe registration owner", async () => {
    const registerRoute = await readFile(new URL("../app/api/account/register/route.ts", import.meta.url), "utf8")
    const authMail = await readFile(new URL("../lib/auth-mail.ts", import.meta.url), "utf8")

    assert.match(registerRoute, /registerPasswordAccount\(\{/)
    assert.match(registerRoute, /verifyPassword,/)
    assert.match(registerRoute, /ensureUserRole,/)
    assert.match(registerRoute, /recordLegalAcceptances,/)
    assert.match(registerRoute, /legalMetadata: legalRequestMetadata\(request\)/)
    assert.match(registerRoute, /safePostLegalAcceptanceCallback\(body\.callbackUrl\)/)
    assert.match(registerRoute, /PUBLIC_ACCOUNT_ENTRY_MESSAGE[\s\S]*status: 202/)
    assert.doesNotMatch(registerRoute, /prisma\.(?:user|emailVerificationToken|passwordResetToken)\./)
    assert.doesNotMatch(registerRoute, /account already exists/i)
    assert.match(registerRoute, /sendPasswordSetup: sendPasswordSetupEmail/)
    assert.doesNotMatch(registerRoute, /sendPasswordReset: sendPasswordResetEmail/)
    assert.match(authMail, /export async function sendPasswordSetupEmail/)
    assert.match(authMail, /same MassageLab account/i)
    assert.match(authMail, /does not create a duplicate account/i)
    assert.match(authMail, /does not disconnect Google sign-in/i)
    assert.match(authMail, /ignore this email and nothing will change/i)
  })

  it("validates before delegating quota-first work and maps exact rate-limit metadata", async () => {
    const registerRoute = await readFile(new URL("../app/api/account/register/route.ts", import.meta.url), "utf8")

    assert.ok(registerRoute.indexOf("isPublicAccountEmail(email)") < registerRoute.indexOf("registerPasswordAccount({"))
    assert.ok(registerRoute.indexOf("missingLegalDocuments.length") < registerRoute.indexOf("registerPasswordAccount({"))
    assert.match(registerRoute, /consumeRateLimit: consumeEmailWorkRateLimit/)
    assert.match(registerRoute, /result\.retryAfterSeconds/)
    assert.match(registerRoute, /"Retry-After": String\(result\.retryAfterSeconds\)/)
    assert.doesNotMatch(registerRoute, /assertRateLimit|recordFailedAttempt|rateLimitKey|prisma\.authAttempt/)
  })

  it("returns neutral 202 before an unresolved provider task scheduled through Next after", async () => {
    const afterCallbacks = []
    let providerStarted = false
    let releaseProvider
    const provider = new Promise((resolve) => { releaseProvider = resolve })
    const { POST } = await loadRegistrationRoute({
      afterCallbacks,
      registerWork: async (input) => {
        input.scheduleAccountWork(() => {
          providerStarted = true
          return provider
        })
        return { status: "ACCEPTED" }
      },
    })

    const response = await POST(new Request("https://massagelab.app/api/account/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "person@example.com", password: "a-long-password", acceptedLegalDocuments: [] }),
    }))

    assert.equal(response.status, 202)
    assert.equal(providerStarted, false)
    assert.equal(afterCallbacks.length, 1)
    const delivery = afterCallbacks[0]()
    assert.equal(providerStarted, true)
    releaseProvider({ delivered: false })
    await delivery
  })

  it("presents Google registration and email-password registration on the register page", async () => {
    const registerPage = await readFile(new URL("../app/register/page.tsx", import.meta.url), "utf8")
    const registerForm = await readFile(new URL("../app/register/register-form.tsx", import.meta.url), "utf8")
    const loginForm = await readFile(new URL("../app/login/login-form.tsx", import.meta.url), "utf8")

    assert.match(registerPage, /hasGoogleAuthConfig/)
    assert.match(registerPage, /getPublicLaunchControls/)
    assert.match(registerPage, /registrationOpen=\{getPublicLaunchControls\(\)\.registrationOpen\}/)
    assert.match(registerPage, /initialCallbackUrl=\{callbackUrl\}/)
    assert.match(registerPage, /Only allow same-origin, root-relative post-registration redirects/)
    assert.match(registerPage, /callbackUrl\?: string \| string\[\]/)
    assert.match(registerPage, /firstQueryValue\(\(await searchParams\)\.callbackUrl\)/)
    assert.match(registerForm, /Continue with Google/)
    assert.match(registerForm, /startGoogleAuthMethodIntent\(googleRedirectTo\)/)
    assert.match(registerForm, /Create account with email/)
    assert.match(registerForm, /callbackUrl: initialCallbackUrl/)
    assert.match(registerForm, /buildRegistrationLegalProviderRedirectPath/)
    assert.match(registerForm, /REGISTRATION_REQUEST_FAILED_MESSAGE/)
    assert.match(registerForm, /if \(!beginEntryAction\("email"\)\) return/)
    assert.match(registerForm, /finally \{\s*finishEntryAction\(\)/)
    assert.match(registerForm, /if \(!navigating\) finishEntryAction\(\)/)
    assert.match(registerForm, /role=\{statusIsError \? "alert" : "status"\}/)
    assert.match(registerForm, /aria-live=\{statusIsError \? "assertive" : "polite"\}/)
    for (const [name, source] of [["login", loginForm], ["register", registerForm]]) {
      assert.match(source, /useEntryAction\(\)/, name)
      assert.match(source, /startGoogleAuthMethodIntent\(googleRedirectTo\)/, name)
      assert.doesNotMatch(source, /emailSubmissionLock|googleSubmissionLock|registrationSubmissionLock/, name)
    }
    assert.match(loginForm, /disabled=\{entryAction !== "idle"\}/)
    assert.match(loginForm, /pendingLabel="Signing in…"/)
    assert.match(loginForm, /pendingLabel="Connecting to Google…"/)
    assert.match(registerForm, /pendingLabel="Creating account…"/)
    assert.match(registerForm, /pendingLabel="Connecting to Google…"/)
    assert.match(registerForm, /matching email[\s\S]*same account[\s\S]*inbox/i)
  })

  it("renders the registration pause and disables only the paused email submit", async () => {
    const paused = await loadRegisterFormScenario(false)
    assert.equal(paused.status?.props.children, REGISTRATION_PAUSED_MESSAGE)
    assert.equal(paused.submit.props.disabled, true)

    const open = await loadRegisterFormScenario(true)
    assert.equal(open.status, null)
    assert.equal(open.submit.props.disabled, false)
  })

  it("retains email entry ownership only after push and refresh both start", async () => {
    const completed = await loadLoginFormScenario()
    await completed.submit()
    assert.deepEqual(completed.flow, [
      "prevent-default",
      "begin:email",
      "sign-in:credentials",
      "push:/account",
      "refresh",
    ])

    const interrupted = await loadLoginFormScenario({ refreshError: new Error("navigation interrupted") })
    await interrupted.submit()
    assert.deepEqual(interrupted.flow, [
      "prevent-default",
      "begin:email",
      "sign-in:credentials",
      "push:/account",
      "refresh",
      "finish",
    ])
  })

  it("explains only the allowlisted sign-in-method security return", async () => {
    const changed = await loadLoginFormScenario({ security: "sign-in-methods-changed" })
    assert.equal(changed.statusText, "Your sign-in methods changed. Sign in again to continue.")

    const unknown = await loadLoginFormScenario({ security: "private-provider-detail" })
    assert.equal(unknown.statusText, "")
  })

  it("clears a stale two-factor challenge when either primary credential changes", async () => {
    for (const changedField of ["email", "password"]) {
      const scenario = await loadStatefulLoginFormScenario([
        { error: "CredentialsSignin", code: "TWO_FACTOR_REQUIRED" },
        { error: null },
      ])
      scenario.change("email", "first@example.test")
      scenario.change("password", "first-password")
      await scenario.submit()

      let tree = scenario.render()
      assert.ok(loginField(tree, "twoFactorCode"), changedField)
      assert.match(elementText(tree), /Enter your authenticator app code or a backup code\./)
      scenario.change("twoFactorCode", "123456")
      scenario.change(changedField, changedField === "email" ? "second@example.test" : "second-password")

      tree = scenario.render()
      assert.equal(loginField(tree, "twoFactorCode"), null, changedField)
      assert.doesNotMatch(elementText(tree), /Enter your authenticator app code or a backup code\./)
      await scenario.submit()
      assert.equal(scenario.signInCalls[1][1].twoFactorCode, "", changedField)
    }
  })

  it("locks primary credentials while their email sign-in response is pending", async () => {
    let resolveSignIn
    const pendingSignIn = new Promise((resolve) => { resolveSignIn = resolve })
    const scenario = await loadStatefulLoginFormScenario([pendingSignIn])
    scenario.change("email", "first@example.test")
    scenario.change("password", "first-password")

    const submission = scenario.submit()
    assert.equal(loginField(scenario.render(), "email").props.disabled, true)
    assert.equal(loginField(scenario.render(), "password").props.disabled, true)

    resolveSignIn({ error: "CredentialsSignin" })
    await submission
    assert.equal(loginField(scenario.render(), "email").props.disabled, false)
    assert.equal(loginField(scenario.render(), "password").props.disabled, false)
  })

  it("preserves one sanitized legal-accept callback in the login registration handoff", async () => {
    const loginForm = await readFile(new URL("../app/login/login-form.tsx", import.meta.url), "utf8")

    assert.match(loginForm, /const requestedCallbackUrl = searchParams\.get\("callbackUrl"\)/)
    assert.match(
      loginForm,
      /isRegistrationLegalAcceptancePath\(requestedCallbackUrl\)[\s\S]*buildRegistrationLegalProviderRedirectPath\(requestedCallbackUrl\)[\s\S]*safePostLegalAcceptanceCallback\(requestedCallbackUrl, "\/account"\)/,
    )
    assert.match(
      loginForm,
      /href=\{`\/register\?callbackUrl=\$\{encodeURIComponent\(callbackUrl\)\}`\}/,
    )
  })

  it("rebuilds one legal-acceptance callback in the register link", async () => {
    const scenario = await loadLoginFormScenario({
      callbackUrl: "/legal/accept?callbackUrl=%2Fclock%3Fpanel%3Dbackground&callbackUrl=%2Fother&ignored=1",
    })

    assert.equal(
      scenario.registerHref,
      "/register?callbackUrl=%2Flegal%2Faccept%3FcallbackUrl%3D%252Fclock%253Fpanel%253Dbackground",
    )
  })

  it("uses fixed truthful setup copy for Google-linked and other passwordless accounts", async () => {
    const authMail = await import("../lib/auth-mail.ts")
    assert.equal(typeof authMail.passwordSetupEmailCopy, "function")

    const google = authMail.passwordSetupEmailCopy("https://massagelab.app/reset-password?token=safe", true)
    const other = authMail.passwordSetupEmailCopy("https://massagelab.app/reset-password?token=safe", false)

    assert.match(google.text, /same MassageLab account/i)
    assert.match(google.text, /does not create a duplicate account/i)
    assert.match(google.text, /does not disconnect Google sign-in/i)
    assert.match(other.text, /existing MassageLab account/i)
    assert.match(other.text, /existing sign-in methods remain connected/i)
    assert.doesNotMatch(other.text, /Google/i)
  })

  it("offers privacy-neutral verification resend from login and every unresolved verification state", async () => {
    const loginForm = await readFile(new URL("../app/login/login-form.tsx", import.meta.url), "utf8")
    const verifyPage = await readFile(new URL("../app/verify-email/page.tsx", import.meta.url), "utf8")
    const resendForm = await readFile(new URL("../app/verify-email/resend-verification-form.tsx", import.meta.url), "utf8")

    assert.match(loginForm, /href=\{verificationRequestHref\}[\s\S]*Resend verification email/)
    assert.match(verifyPage, /import \{ ResendVerificationForm \}/)
    assert.match(verifyPage, /!verified[\s\S]*<ResendVerificationForm callbackUrl=\{callbackUrl\}/)
    assert.match(resendForm, /JSON\.stringify\(\{ email, callbackUrl \}\)/)
    assert.doesNotMatch(resendForm, /[?&]email=|searchParams\.set\("email"/)
  })

  it("preserves an app-local callback through email verification and sign-in", async () => {
    const authMail = await readFile(new URL("../lib/auth-mail.ts", import.meta.url), "utf8")
    const verifyPage = await readFile(new URL("../app/verify-email/page.tsx", import.meta.url), "utf8")
    const callbackUrl = "/clock?source=music&panel=background&commerceCart=open"
    const verificationUrl = new URL(
      buildVerificationEmailUrl("https://www.massagelab.app", "token-safe", callbackUrl),
    )

    assert.equal(verificationUrl.searchParams.get("token"), "token-safe")
    assert.equal(verificationUrl.searchParams.get("callbackUrl"), callbackUrl)
    assert.equal(
      buildVerificationLoginPath(true, verificationUrl.searchParams.get("callbackUrl")),
      "/login?callbackUrl=%2Fclock%3Fsource%3Dmusic%26panel%3Dbackground%26commerceCart%3Dopen&verified=1",
    )
    assert.equal(
      new URL(
        buildVerificationEmailUrl("https://www.massagelab.app", "token-safe", "https://example.com"),
      ).searchParams.get("callbackUrl"),
      "/onboarding",
    )
    assert.equal(
      buildVerificationLoginPath(false, "https://example.com"),
      "/login?callbackUrl=%2Fonboarding",
    )

    const unsafeCallbacks = [
      "//example.com/clock",
      "https://massagelab.app.example.com/clock",
      "/\\example.com/clock",
      "\\example.com/clock",
      { path: "/clock" },
      42,
    ]
    for (const unsafeCallback of unsafeCallbacks) {
      const unsafeVerificationUrl = new URL(
        buildVerificationEmailUrl("https://www.massagelab.app", "token-safe", unsafeCallback),
      )
      assert.equal(unsafeVerificationUrl.searchParams.get("callbackUrl"), "/onboarding")
      assert.equal(
        buildVerificationLoginPath(false, unsafeCallback),
        "/login?callbackUrl=%2Fonboarding",
      )
      assert.equal(
        buildVerificationLoginPath(true, unsafeCallback),
        "/login?callbackUrl=%2Fonboarding&verified=1",
      )
    }

    assert.deepEqual(
      normalizeEmailVerificationParams({
        token: "token-safe",
        callbackUrl,
      }),
      { token: "token-safe", callbackUrl },
    )
    assert.deepEqual(
      normalizeEmailVerificationParams({
        token: ["token-safe", "token-repeated"],
        callbackUrl: ["//example.com", callbackUrl],
      }),
      { token: "", callbackUrl: "/onboarding" },
    )
    assert.deepEqual(
      normalizeEmailVerificationParams({
        token: "token-safe",
        callbackUrl: [callbackUrl, "/other"],
      }),
      { token: "token-safe", callbackUrl: "/onboarding" },
    )

    let delivered
    const deliveryResult = await sendRegistrationVerification(
      async (email, token, safeCallbackUrl) => {
        delivered = { email, token, callbackUrl: safeCallbackUrl }
        return { delivered: true }
      },
      "person@example.com",
      "token-safe",
      "https://example.com/checkout",
    )
    assert.deepEqual(deliveryResult, { delivered: true })
    assert.deepEqual(delivered, {
      email: "person@example.com",
      token: "token-safe",
      callbackUrl: "/onboarding",
    })

    assert.match(authMail, /buildVerificationEmailUrl\(getSiteUrl\(\), token, callbackUrl\)/)
    assert.match(verifyPage, /normalizeEmailVerificationParams\(await searchParams\)/)
    assert.match(verifyPage, /buildVerificationLoginPath\(verified, callbackUrl\)/)
  })
})

/** Executes the real email-login handler with deterministic entry and router owners. */
async function loadLoginFormScenario({ callbackUrl, refreshError, security } = {}) {
  const loginSource = await readFile(new URL("../app/login/login-form.tsx", import.meta.url), "utf8")
  const flow = []
  const searchParams = new URLSearchParams()
  if (callbackUrl !== undefined) searchParams.set("callbackUrl", callbackUrl)
  if (security !== undefined) searchParams.set("security", security)
  const router = {
    push(path) {
      flow.push(`push:${path}`)
    },
    refresh() {
      flow.push("refresh")
      if (refreshError) throw refreshError
    },
  }
  const Div = passThroughElement("div")
  const login = loadCompiledModule(loginSource, "app/login/login-form.behavior.test.tsx", {
    react: { useState: (value) => [value, () => {}] },
    "react/jsx-runtime": {
      Fragment: Symbol.for("auth-registration-test.fragment"),
      jsx: createElement,
      jsxs: createElement,
    },
    "next/link": { __esModule: true, default: passThroughElement("a") },
    "next/navigation": {
      useRouter: () => router,
      useSearchParams: () => searchParams,
    },
    "next-auth/react": {
      signIn: async (provider) => {
        flow.push(`sign-in:${provider}`)
        return { error: null }
      },
    },
    "lucide-react": { Mail: Div, ShieldCheck: Div },
    "@/components/forms/async-action-button": { AsyncActionButton: passThroughElement("button") },
    "@/components/ui/app-surface": { AppInset: Div, AppSurface: Div },
    "@/components/ui/input": { Input: passThroughElement("input") },
    "@/components/ui/label": { Label: passThroughElement("label") },
    "@/lib/auth-entry-actions": {
      startGoogleAuthMethodIntent: async () => "navigating",
      useEntryAction: () => ({
        entryAction: "idle",
        beginEntryAction(action) {
          flow.push(`begin:${action}`)
          return true
        },
        finishEntryAction() {
          flow.push("finish")
        },
      }),
    },
    "@/lib/auth-registration": { buildVerificationRequestPath: () => "/verify-email" },
    "@/lib/legal-acceptance-gate": {
      buildRegistrationLegalProviderRedirectPath,
      isRegistrationLegalAcceptancePath,
      safePostLegalAcceptanceCallback,
    },
  })
  const tree = renderFunctionComponents(login.LoginForm({ googleEnabled: true }))
  const form = findElement(tree, (element) => element.type === "form")
  assert.ok(form, "LoginForm must render its email form")
  const registerLink = findElement(tree, (element) => (
    element.type === "a" && element.props.children === "Create an account"
  ))
  assert.ok(registerLink, "LoginForm must render its registration link")

  return {
    flow,
    registerHref: registerLink.props.href,
    statusText: elementText(findElement(tree, (element) => element.props.role === "status")),
    submit: () => form.props.onSubmit({ preventDefault: () => flow.push("prevent-default") }),
  }
}

/** Runs LoginForm through stateful rerenders so challenge recovery remains user-observable. */
async function loadStatefulLoginFormScenario(signInResults) {
  const loginSource = await readFile(new URL("../app/login/login-form.tsx", import.meta.url), "utf8")
  const hooks = createLoginHookRuntime()
  const signInCalls = []
  let entryAction = "idle"
  const router = { push() {}, refresh() {} }
  const Div = passThroughElement("div")
  const login = loadCompiledModule(loginSource, "app/login/login-form.stateful-test.tsx", {
    react: hooks.react,
    "react/jsx-runtime": { Fragment: Symbol.for("auth-registration-test.fragment"), jsx: createElement, jsxs: createElement },
    "next/link": { __esModule: true, default: passThroughElement("a") },
    "next/navigation": {
      useRouter: () => router,
      useSearchParams: () => new URLSearchParams(),
    },
    "next-auth/react": {
      async signIn(...args) {
        signInCalls.push(args)
        return signInResults[signInCalls.length - 1]
      },
    },
    "lucide-react": { Mail: Div, ShieldCheck: Div },
    "@/components/forms/async-action-button": { AsyncActionButton: passThroughElement("button") },
    "@/components/ui/app-surface": { AppInset: Div, AppSurface: Div },
    "@/components/ui/input": { Input: passThroughElement("input") },
    "@/components/ui/label": { Label: passThroughElement("label") },
    "@/lib/auth-entry-actions": {
      startGoogleAuthMethodIntent: async () => "navigating",
      useEntryAction: () => ({
        entryAction,
        beginEntryAction(nextAction) {
          if (entryAction !== "idle") return false
          entryAction = nextAction
          return true
        },
        finishEntryAction() { entryAction = "idle" },
      }),
    },
    "@/lib/auth-registration": { buildVerificationRequestPath: () => "/verify-email" },
    "@/lib/legal-acceptance-gate": {
      buildRegistrationLegalProviderRedirectPath,
      isRegistrationLegalAcceptancePath,
      safePostLegalAcceptanceCallback,
    },
  })

  function render() {
    hooks.startRender()
    return renderFunctionComponents(login.LoginForm({ googleEnabled: true }))
  }

  function change(id, value) {
    const field = loginField(render(), id)
    assert.ok(field, id)
    field.props.onChange({ target: { value } })
  }

  async function submit() {
    const form = findElement(render(), (element) => element.type === "form")
    assert.ok(form)
    await form.props.onSubmit({ preventDefault() {} })
  }

  return { change, render, signInCalls, submit }
}

/** Stores hook state by call position; every simulated rerender must begin with startRender(). */
function createLoginHookRuntime() {
  const state = []
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
    },
  }
}

function loginField(tree, id) {
  return findElement(tree, (element) => element.props.id === id)
}

/** Renders the real RegisterForm with inert UI owners so launch-control props remain observable. */
async function loadRegisterFormScenario(registrationOpen) {
  const registerSource = await readFile(new URL("../app/register/register-form.tsx", import.meta.url), "utf8")
  const Div = passThroughElement("div")
  const register = loadCompiledModule(registerSource, "app/register/register-form.behavior.test.tsx", {
    react: { useState: (value) => [value, () => {}] },
    "react/jsx-runtime": {
      Fragment: Symbol.for("auth-registration-test.fragment"),
      jsx: createElement,
      jsxs: createElement,
    },
    "next/link": { __esModule: true, default: passThroughElement("a") },
    "lucide-react": { Mail: Div, ShieldCheck: Div },
    "@/components/forms/async-action-button": { AsyncActionButton: passThroughElement("button") },
    "@/components/ui/app-surface": { AppInset: Div, AppSurface: Div },
    "@/components/ui/input": { Input: passThroughElement("input") },
    "@/components/ui/label": { Label: passThroughElement("label") },
    "@/lib/auth-entry-actions": {
      startGoogleAuthMethodIntent: async () => "navigating",
      useEntryAction: () => ({
        entryAction: "idle",
        beginEntryAction: () => true,
        finishEntryAction: () => undefined,
      }),
    },
    "@/lib/auth-entry-messages": { PUBLIC_ACCOUNT_ENTRY_MESSAGE: "Check your email." },
    "@/lib/legal-acceptance-gate": { buildRegistrationLegalProviderRedirectPath },
    "@/lib/legal-documents": {
      legalDocumentAcceptanceId: (document) => document.key,
      requiredLegalDocumentsForEvent: () => [],
    },
    "@/lib/public-launch-controls": { REGISTRATION_PAUSED_MESSAGE },
  })
  const tree = renderFunctionComponents(register.RegisterForm({
    googleEnabled: true,
    initialCallbackUrl: "/onboarding",
    registrationOpen,
  }))
  const submit = findElement(tree, (element) => element.type === "button" && element.props.type === "submit")
  assert.ok(submit, "RegisterForm must render its email submit")
  return {
    status: findElement(tree, (element) => element.type === "p" && element.props.role === "status"),
    submit,
  }
}

async function loadRegistrationRoute({ afterCallbacks, registerWork, registrationOpen = true }) {
  const source = await readFile(new URL("../app/api/account/register/route.ts", import.meta.url), "utf8")
  return loadCompiledModule(source, "account-register-route.review-test.ts", {
    "next/server": {
      after: (callback) => afterCallbacks.push(callback),
      NextResponse: { json: (body, init) => Response.json(body, init) },
    },
    "@/lib/auth-env": { getAuthSecret: () => "secret" },
    "@/lib/auth-mail": {
      sendAccountChangeEmail: async () => ({ delivered: true }),
      sendPasswordSetupEmail: async () => ({ delivered: true }),
      sendPasswordResetEmail: async () => ({ delivered: true }),
      sendVerificationEmail: async () => ({ delivered: true }),
    },
    "@/lib/auth-rate-limit": { consumeEmailWorkRateLimit: async () => ({ allowed: true }) },
    "@/lib/public-launch-controls": {
      getPublicLaunchControls: () => ({
        registrationOpen,
        supporterCheckoutOpen: true,
      }),
      REGISTRATION_PAUSED_MESSAGE,
    },
    "@/lib/auth-entry-messages": {
      PUBLIC_ACCOUNT_ENTRY_MESSAGE: "Check that email address for the appropriate sign-in, verification, or recovery next step.",
    },
    "@/lib/auth-request": {
      authRequestNetworkIdentifier: () => "network",
      isPublicAccountEmail: () => true,
    },
    "@/lib/auth-registration-service": {
      registerPasswordAccount: registerWork,
    },
    "@/lib/auth-registration": { sendRegistrationVerification: (sender, ...args) => sender(...args) },
    "@/lib/auth-security": {
      generateRandomToken: () => "token",
      hashPassword: async () => "hash",
      hashToken: () => "token-hash",
      normalizeEmail: (value) => String(value ?? "").trim().toLowerCase(),
      tokenExpiresIn: () => new Date(),
      verifyPassword: async () => true,
    },
    "@/lib/auth-users": { ensureUserRole: async () => "USER" },
    "@/lib/legal-acceptance": {
      acceptedDocumentIdsFromInput: () => new Set(),
      legalRequestMetadata: () => ({}),
      missingRequiredLegalDocuments: () => [],
      recordLegalAcceptances: async () => [],
    },
    "@/lib/legal-acceptance-gate": { safePostLegalAcceptanceCallback: () => "/onboarding" },
    "@/lib/legal-documents": { requiredLegalDocumentsForEvent: () => [] },
    "@/lib/prisma": { prisma: {} },
  })
}
