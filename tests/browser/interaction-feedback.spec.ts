import { expect, test, type Page } from "@playwright/test"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"
import { isBrowserQaDatabaseTargetAuthorized } from "../../scripts/assert-browser-qa-database-target.mjs"

const hasPrivateQaAuthorization = isBrowserQaDatabaseTargetAuthorized(process.env)
const PRIVATE_QA_SKIP_REASON = "Account action browser QA requires the missing explicit disposable-database opt-in/authorization."
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const require = createRequire(import.meta.url)
let billingFixtureRoot: string | null = null
let billingFixtureBundle: string | null = null

/** Bundles the production pending-form owner into a disposable local browser fixture. */
async function buildBillingFixtureBundle() {
  if (billingFixtureBundle) return billingFixtureBundle

  billingFixtureRoot = mkdtempSync(path.join(tmpdir(), "massagelab-billing-feedback-"))
  const outputRoot = path.join(billingFixtureRoot, "dist")
  const componentPath = path.join(billingFixtureRoot, "pending-submission-form.js")
  const buttonPath = path.join(billingFixtureRoot, "button.js")
  const asyncButtonPath = path.join(billingFixtureRoot, "async-action-button.js")
  const loaderPath = path.join(billingFixtureRoot, "loader.js")
  const metalButtonPath = path.join(billingFixtureRoot, "metal-attention-button.js")
  const utilsPath = path.join(billingFixtureRoot, "utils.js")
  const entryPath = path.join(billingFixtureRoot, "entry.js")
  const pendingFormSource = readFileSync(
    path.join(projectRoot, "components/forms/pending-submission-form.tsx"),
    "utf8",
  )
  writeFileSync(componentPath, ts.transpileModule(pendingFormSource, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText)
  writeFileSync(buttonPath, `
    import React from "react";
    export function Button({ children, ...props }) {
      return React.createElement("button", props, children);
    }
  `)
  writeFileSync(asyncButtonPath, `
    import React from "react";
    export function AsyncActionButton({ pending, idleLabel, pendingLabel, ...props }) {
      return React.createElement("button", {
        ...props,
        disabled: Boolean(props.disabled || pending),
        "aria-busy": pending,
      }, pending ? pendingLabel : idleLabel);
    }
  `)
  writeFileSync(loaderPath, `
    import React from "react";
    export function Loader(props) { return React.createElement("span", props); }
  `)
  writeFileSync(metalButtonPath, `
    import React from "react";
    export function MetalAttentionButton({ children, metalFullWidth, ...props }) {
      return React.createElement("button", {
        ...props,
        "data-metal-full-width": metalFullWidth ? "true" : undefined,
      }, children);
    }
  `)
  writeFileSync(utilsPath, `
    export function cn(...values) { return values.filter(Boolean).join(" "); }
  `)
  writeFileSync(entryPath, `
    import React from "react";
    import { createRoot } from "react-dom/client";
    import { PendingSubmissionForm, PendingSubmitButton } from ${JSON.stringify(componentPath)};

    const forms = [
      {
        id: "subscription",
        action: "/api/billing/checkout",
        idleLabel: "Start membership checkout",
        pendingLabel: "Opening secure subscription checkout…",
        fields: [
          ["membershipLevel", "SUPPORTER"],
          ["supporterAmountChoiceId", "support-1"],
          ["interval", "month"],
          ["acceptedLegalDocuments", "membership-billing-refunds:test"],
        ],
        requiresTerms: true,
      },
      {
        id: "portal",
        action: "/api/billing/portal",
        idleLabel: "Manage billing account",
        pendingLabel: "Opening billing portal…",
        fields: [["destination", "manage"]],
      },
      {
        id: "donation",
        action: "/api/billing/donation",
        idleLabel: "Support with $5",
        pendingLabel: "Opening secure checkout…",
        fields: [["amountCents", "500"]],
      },
    ];

    createRoot(document.getElementById("root")).render(
      React.createElement("main", null, forms.map((form) =>
        React.createElement(PendingSubmissionForm, {
          key: form.id,
          action: form.action,
          method: "post",
          pendingLabel: form.pendingLabel,
          "data-testid": "billing-form-" + form.id,
        },
          ...form.fields.map(([name, value]) => React.createElement("input", {
            key: name,
            type: "hidden",
            name,
            value,
          })),
          form.requiresTerms ? React.createElement("label", null,
            React.createElement("input", {
              type: "checkbox",
              name: "billingTermsAccepted",
              value: "true",
              required: true,
            }),
            "I agree to the membership billing terms",
          ) : null,
          React.createElement(PendingSubmitButton, {
            type: "submit",
            pendingLabel: form.pendingLabel,
            presentation: form.id === "donation" ? "button" : "metal-attention",
            metalFullWidth: form.id !== "donation",
          }, form.idleLabel),
        )
      )),
    );
  `)

  const webpack = require("next/dist/compiled/webpack/webpack").webpack
  await new Promise<void>((resolve, reject) => {
    webpack({
      mode: "development",
      context: projectRoot,
      entry: entryPath,
      output: { path: outputRoot, filename: "fixture.js" },
      resolve: {
        extensions: [".js"],
        alias: {
          "@/components/forms/async-action-button": asyncButtonPath,
          "@/components/ui/button": buttonPath,
          "@/components/ui/loader": loaderPath,
          "@/components/ui/metal-attention-button": metalButtonPath,
          "@/lib/utils": utilsPath,
        },
        modules: [path.join(projectRoot, "node_modules"), "node_modules"],
      },
    }, (error: Error | null, stats: { hasErrors(): boolean; toString(options: object): string } | undefined) => {
      if (error) return reject(error)
      if (stats?.hasErrors()) return reject(new Error(stats.toString({ errors: true, warnings: false })))
      resolve()
    })
  })

  billingFixtureBundle = readFileSync(path.join(outputRoot, "fixture.js"), "utf8")
  return billingFixtureBundle
}

async function openBillingFixture(page: Page) {
  const bundle = await buildBillingFixtureBundle()
  await page.route("**/__interaction-feedback-billing-fixture.js", async (route) => {
    await route.fulfill({ status: 200, contentType: "text/javascript; charset=utf-8", body: bundle })
  })
  await page.route((url) => url.pathname === "/__interaction-feedback-billing-fixture", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: '<main id="root"></main><script src="/__interaction-feedback-billing-fixture.js"></script>',
    })
  })
  await page.goto("/__interaction-feedback-billing-fixture", { waitUntil: "domcontentloaded" })
}

test.afterAll(() => {
  if (billingFixtureRoot) rmSync(billingFixtureRoot, { recursive: true, force: true })
})

async function assertOneDelayedJsonSubmission({
  page,
  url,
  submit,
  pendingLabel,
  response,
}: {
  page: Page
  url: string
  submit: () => Promise<void>
  pendingLabel: string
  response: { status: number; body: Record<string, unknown> }
}) {
  let requests = 0
  await page.route(`**${url}`, async (route) => {
    requests += 1
    await new Promise((resolve) => setTimeout(resolve, 700))
    await route.fulfill({
      status: response.status,
      contentType: "application/json",
      body: JSON.stringify(response.body),
    })
  })
  await submit()
  const pending = page.getByRole("button", { name: pendingLabel })
  await expect(pending).toBeDisabled()
  await expect(pending).toHaveAttribute("aria-busy", "true")
  await expect(page.getByRole("status")).toHaveCount(1)
  await pending.click({ force: true })
  await expect.poll(() => requests).toBe(1)
  return { requests: () => requests }
}

type NativeBillingFixtureCase = {
  fixtureId: "subscription" | "portal" | "donation"
  action: string
  idleLabel: string
  pendingLabel: string
  expectedFields: Record<string, string>
  returnPath: string
  returnHeading: RegExp
  requiresTerms?: boolean
}

async function assertOneDelayedNativeBillingSubmission({
  page,
  fixtureId,
  action,
  idleLabel,
  pendingLabel,
  expectedFields,
  returnPath,
  returnHeading,
  requiresTerms = false,
}: NativeBillingFixtureCase & { page: Page }) {
  let requests = 0
  let method = ""
  let contentType = ""
  let postedFields: Record<string, string> = {}
  await page.route(`**${action}`, async (route) => {
    const request = route.request()
    requests += 1
    method = request.method()
    contentType = request.headers()["content-type"] ?? ""
    postedFields = Object.fromEntries(new URLSearchParams(request.postData() ?? ""))
    await new Promise((resolve) => setTimeout(resolve, 900))
    await route.fulfill({ status: 303, headers: { location: returnPath }, body: "" })
  })
  await openBillingFixture(page)
  const form = page.getByTestId(`billing-form-${fixtureId}`)
  await expect(form).toHaveAttribute("action", action)
  await expect(form).toHaveAttribute("method", "post")
  if (requiresTerms) await form.getByRole("checkbox").check()

  await form.getByRole("button", { name: idleLabel }).evaluate((element) => {
    ;(element as HTMLButtonElement).click()
  })
  const pending = form.getByRole("button", { name: pendingLabel })
  await expect(pending).toBeDisabled()
  await expect(pending).toHaveAttribute("aria-busy", "true")
  await expect(form).toHaveAttribute("aria-busy", "true")
  await expect(form.getByRole("status")).toHaveCount(1)
  await expect(form.getByRole("status")).toHaveText(pendingLabel)
  await form.evaluate((element) => {
    ;(element as HTMLFormElement).requestSubmit()
  })
  await expect.poll(() => requests).toBe(1)

  await expect.poll(() => {
    const url = new URL(page.url())
    return `${url.pathname}${url.search}`
  }).toBe(returnPath)
  await expect(page.getByRole("heading", { name: returnHeading })).toBeVisible()
  expect(method).toBe("POST")
  expect(contentType).toMatch(/^application\/x-www-form-urlencoded(?:;|$)/i)
  expect(postedFields).toEqual(expectedFields)
}

async function centerProofDrone(page: Page) {
  const carousel = page.getByTestId("station-carousel-stage")
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const play = page.getByRole("button", { name: /^Play MassageLab Proof Drone$/i })
    if (await play.isVisible().catch(() => false)) return play
    await carousel.getByRole("button", { name: "Next station" }).click()
  }
  throw new Error("MassageLab Proof Drone did not become the active station card.")
}

async function startProofDrone(page: Page) {
  await page.goto("/music", { waitUntil: "domcontentloaded" })
  await (await centerProofDrone(page)).click()
  const toolbar = page.getByTestId("music-player-toolbar")
  await expect(toolbar).toBeVisible()
  await expect(page.getByText("MassageLab Proof Drone").last()).toBeVisible()
  await expect(toolbar).toHaveAttribute("data-playback-state", "playing", { timeout: 30_000 })
  return toolbar
}

async function delayNavigationResponse(page: Page, pathname: string) {
  await page.route(`**${pathname}*`, async (route) => {
    const request = route.request()
    const headers = request.headers()
    if (headers["next-router-prefetch"] || headers["purpose"] === "prefetch") {
      await route.abort()
      return
    }

    if (headers.rsc || request.isNavigationRequest()) {
      const response = await route.fetch()
      await new Promise((resolve) => setTimeout(resolve, 550))
      await route.fulfill({ response })
      return
    }

    await route.continue()
  })
}

async function installPremiumAccount(page: Page) {
  await page.route("**/api/auth/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user: { id: "interaction-feedback", email: "feedback@example.com" } }),
    })
  })
  await page.route("**/api/account/preferences", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        accessAuthoritative: true,
        features: ["premium_backgrounds"],
        ownedBackgroundIds: [],
        chimerSettings: {},
        appSettings: {},
      }),
    })
  })
}

async function startActiveChimer(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("massagelab-chimer-settings", JSON.stringify({ showTimerSeconds: true }))
  })
  await installPremiumAccount(page)
  await page.goto("/chimer", { waitUntil: "domcontentloaded" })
  await page.getByRole("button", { name: /^Increase minutes$/i }).click()
  for (let step = 0; step < 4; step += 1) {
    await page.getByRole("button", { name: /^Continue$/i }).click()
  }
  await page.getByRole("button", { name: /^Start Chimer$/i }).click()
  await expect(page.getByTestId("running-timer-clock")).toBeVisible()
}

test("shows throttled shell feedback while an owned tool Link keeps music mounted", async ({ page }) => {
  test.setTimeout(120_000)
  await delayNavigationResponse(page, "/clock")
  const toolbar = await startProofDrone(page)
  await toolbar.evaluate((element) => {
    Reflect.set(window, "__interactionFeedbackMusicToolbar", element)
  })

  await page.getByRole("link", { name: "Open clock" }).click()
  await expect(page.getByRole("link", { name: "Open clock" })).toHaveAttribute("data-navigation-pending", "true")
  const progress = page.locator('[data-route-progress="pending"]')
  await expect(progress).toBeVisible()
  await expect(progress).toHaveCSS("pointer-events", "none")
  await page.waitForTimeout(220)
  await expect(page.getByRole("status", { name: "Loading page" })).toHaveCount(1)
  await expect(page).toHaveURL(/\/clock/)
  await expect(progress).toHaveCount(0)
  await expect(page.getByRole("status", { name: "Loading page" })).toHaveCount(0)
  await expect(page.getByText("MassageLab Proof Drone").last()).toBeVisible()
  await expect(toolbar).toHaveAttribute("data-playback-state", "playing")
  expect(await page.evaluate(() => (
    Reflect.get(window, "__interactionFeedbackMusicToolbar")
    === document.querySelector('[data-testid="music-player-toolbar"]')
  ))).toBe(true)
})

test("keeps the proof-drone session through the real music visualizer Link", async ({ page }) => {
  test.setTimeout(120_000)
  const toolbar = await startProofDrone(page)
  await toolbar.evaluate((element) => {
    Reflect.set(window, "__interactionFeedbackMusicToolbar", element)
  })

  await toolbar.getByRole("link", { name: "Background", exact: true }).click()
  await expect(page).toHaveURL(/\/clock\?[^#]*source=music/)
  await expect(page.getByText("MassageLab Proof Drone").last()).toBeVisible()
  await expect(toolbar).toHaveAttribute("data-playback-state", "playing")
  expect(await page.evaluate(() => (
    Reflect.get(window, "__interactionFeedbackMusicToolbar")
    === document.querySelector('[data-testid="music-player-toolbar"]')
  ))).toBe(true)
})

test("keeps the running Chimer timer node through a Visual draft edit", async ({ page }) => {
  test.setTimeout(120_000)
  await startActiveChimer(page)
  const timer = page.getByTestId("running-timer-clock")
  const before = (await timer.textContent())?.replace(/\s+/g, "")
  await page.evaluate(() => {
    Reflect.set(window, "__interactionFeedbackTimer", document.querySelector('[data-testid="running-timer-clock"]'))
  })

  await page.getByRole("button", { name: "Visual", exact: true }).click()
  const visual = page.getByRole("dialog", { name: "Visual controls" })
  await visual.getByRole("radio", { name: "Custom", exact: true }).click()
  await visual.getByLabel(/color mapping$/).first().selectOption("6")

  expect(await page.evaluate(() => (
    Reflect.get(window, "__interactionFeedbackTimer")
    === document.querySelector('[data-testid="running-timer-clock"]')
  ))).toBe(true)
  await expect.poll(async () => (await timer.textContent())?.replace(/\s+/g, "")).not.toBe(before)
})

const nativeBillingCases: readonly NativeBillingFixtureCase[] = [
  {
    fixtureId: "subscription" as const,
    action: "/api/billing/checkout",
    idleLabel: "Start membership checkout",
    pendingLabel: "Opening secure subscription checkout…",
    expectedFields: {
      membershipLevel: "SUPPORTER",
      supporterAmountChoiceId: "support-1",
      interval: "month",
      acceptedLegalDocuments: "membership-billing-refunds:test",
      billingTermsAccepted: "true",
    },
    returnPath: "/account?tab=membership&checkout=cancelled",
    returnHeading: /sign in to manage membership/i,
    requiresTerms: true,
  },
  {
    fixtureId: "portal" as const,
    action: "/api/billing/portal",
    idleLabel: "Manage billing account",
    pendingLabel: "Opening billing portal…",
    expectedFields: { destination: "manage" },
    returnPath: "/account?tab=membership&portal=returned",
    returnHeading: /sign in to manage membership/i,
  },
  {
    fixtureId: "donation" as const,
    action: "/api/billing/donation",
    idleLabel: "Support with $5",
    pendingLabel: "Opening secure checkout…",
    expectedFields: { amountCents: "500" },
    returnPath: "/pricing?donation=cancelled",
    returnHeading: /one-time support checkout cancelled/i,
  },
]

for (const billingCase of nativeBillingCases) {
  test(`${billingCase.fixtureId} native redirect owns one delayed POST and returns through the app`, async ({ page }) => {
    await assertOneDelayedNativeBillingSubmission({ page, ...billingCase })
  })
}

test("registration immediately announces one delayed request and blocks repeat activation", async ({ page }) => {
  await page.goto("/register", { waitUntil: "domcontentloaded" })
  await page.getByLabel("Email").fill("interaction-register@example.test")
  await page.getByLabel("Password").fill("not-a-real-password")
  for (const checkbox of await page.getByRole("checkbox").all()) await checkbox.check()
  const tracked = await assertOneDelayedJsonSubmission({
    page,
    url: "/api/account/register",
    submit: () => page.getByRole("button", { name: "Create account with email" }).click(),
    pendingLabel: "Creating account…",
    response: { status: 202, body: { message: "Check your email to continue." } },
  })
  await expect(page.getByRole("status")).toContainText("Check your email to continue.")
  expect(tracked.requests()).toBe(1)
})

test("reset request and confirmation own delayed feedback without duplicate requests", async ({ page }) => {
  await page.goto("/forgot-password", { waitUntil: "domcontentloaded" })
  await page.getByLabel("Email").fill("interaction-reset@example.test")
  const request = await assertOneDelayedJsonSubmission({
    page,
    url: "/api/account/password-reset/request",
    submit: () => page.getByRole("button", { name: "Send reset link" }).click(),
    pendingLabel: "Sending reset instructions…",
    response: { status: 202, body: { message: "If that email is registered, a reset link has been sent." } },
  })
  await expect(page.getByRole("button", { name: "Send reset link" })).toBeEnabled()
  expect(request.requests()).toBe(1)

  await page.goto("/reset-password?token=interaction-token", { waitUntil: "domcontentloaded" })
  await page.getByLabel("New password").fill("not-a-real-password")
  const confirmation = await assertOneDelayedJsonSubmission({
    page,
    url: "/api/account/password-reset/confirm",
    submit: () => page.getByRole("button", { name: "Update password" }).click(),
    pendingLabel: "Updating password…",
    response: { status: 200, body: { message: "Password updated." } },
  })
  await expect(page.getByRole("button", { name: "Update password" })).toBeEnabled()
  expect(confirmation.requests()).toBe(1)
})

test("aborted reset requests clear busy state and expose a generic alert", async ({ page }) => {
  await page.route("**/api/account/password-reset/request", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500))
    await route.abort("failed")
  })
  await page.goto("/forgot-password", { waitUntil: "domcontentloaded" })
  await page.getByLabel("Email").fill("interaction-abort@example.test")
  await page.getByRole("button", { name: "Send reset link" }).click()
  await expect(page.getByRole("button", { name: "Sending reset instructions…" })).toBeDisabled()
  await expect(page.getByRole("alert")).toContainText("Something went wrong. Please try again.")
  await expect(page.getByRole("button", { name: "Send reset link" })).toBeEnabled()

  await page.unrouteAll({ behavior: "wait" })
  await page.route("**/api/account/password-reset/confirm", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500))
    await route.abort("failed")
  })
  await page.goto("/reset-password?token=interaction-token", { waitUntil: "domcontentloaded" })
  await page.getByLabel("New password").fill("not-a-real-password")
  await page.getByRole("button", { name: "Update password" }).click()
  await expect(page.getByRole("button", { name: "Updating password…" })).toBeDisabled()
  await expect(page.getByRole("alert")).toContainText("Something went wrong. Please try again.")
  await expect(page.getByRole("button", { name: "Update password" })).toBeEnabled()
})

test.describe("private account action settlement", () => {
  test.beforeEach(() => {
    test.skip(!hasPrivateQaAuthorization, PRIVATE_QA_SKIP_REASON)
  })

  test.afterEach(async ({}, testInfo) => {
    if (!hasPrivateQaAuthorization) return
    const fixture = await import("./identity-method-safety-fixture")
    for (const scenario of ["MATCHING_LINK", "GOOGLE_ONLY", "BOTH_METHODS"] as const) {
      await fixture.removeIdentityMethodSafetyFixture(testInfo.project.name, scenario)
    }
  })

  test("delayed link confirmation has one owner and recovers after an aborted confirmation", async ({ context, page }, testInfo) => {
    const fixture = await import("./identity-method-safety-fixture")
    const installed = await fixture.installIdentityMethodSafetyFixture({
      context,
      baseURL: String(testInfo.project.use.baseURL),
      projectName: testInfo.project.name,
      scenario: "MATCHING_LINK",
      signedIn: false,
    })
    let confirmations = 0
    await page.route("**/api/account/security/google/link/confirm", async (route) => {
      confirmations += 1
      await new Promise((resolve) => setTimeout(resolve, 650))
      await route.abort("failed")
    })
    await page.goto("/account/link-google", { waitUntil: "domcontentloaded" })
    await page.getByLabel("Account email").fill(installed.identity.user.email)
    await page.getByLabel("Password").fill(installed.password)
    await page.getByRole("button", { name: "Confirm same MassageLab account" }).click()
    await expect(page.getByRole("button", { name: "Connecting Google…" })).toBeDisabled()
    await page.getByRole("button", { name: "Connecting Google…" }).click({ force: true })
    await expect(page.getByRole("alert")).toContainText("Something went wrong. Please try again.")
    await expect(page.getByRole("button", { name: "Confirm same MassageLab account" })).toBeEnabled()
    expect(confirmations).toBe(1)
  })

  test("profile Server Action follows framework settlement and returns an explicit success notice", async ({ context, page }, testInfo) => {
    const fixture = await import("./identity-method-safety-fixture")
    await fixture.installIdentityMethodSafetyFixture({
      context,
      baseURL: String(testInfo.project.use.baseURL),
      projectName: testInfo.project.name,
      scenario: "BOTH_METHODS",
    })
    let actions = 0
    await page.route("**/account?tab=profile*", async (route) => {
      if (route.request().method() !== "POST" || !route.request().headers()["next-action"]) {
        await route.continue()
        return
      }
      actions += 1
      if (actions === 1) {
        await new Promise((resolve) => setTimeout(resolve, 700))
        await route.abort("failed")
        return
      }
      const response = await route.fetch()
      await new Promise((resolve) => setTimeout(resolve, 700))
      await route.fulfill({ response })
    })
    await page.goto("/account?tab=profile", { waitUntil: "domcontentloaded" })
    await page.getByLabel("Display name").fill("Browser profile")
    await page.getByRole("button", { name: "Save profile" }).click()
    await expect(page.getByRole("button", { name: "Saving profile…" })).toBeDisabled()
    await page.getByRole("button", { name: "Saving profile…" }).click({ force: true })
    await expect(page.getByRole("button", { name: "Save profile" })).toBeEnabled()
    expect(actions).toBe(1)
    await page.getByRole("button", { name: "Save profile" }).click()
    await expect(page.getByRole("button", { name: "Saving profile…" })).toBeDisabled()
    await expect(page).toHaveURL(/\/account\?tab=profile&profile=saved/)
    await expect(page.getByRole("heading", { name: "Profile saved" })).toBeVisible()
    expect(actions).toBe(2)
  })

  test("Google intent and password-method requests block overlap and recover after abort", async ({ context, page }, testInfo) => {
    const fixture = await import("./identity-method-safety-fixture")
    await fixture.installIdentityMethodSafetyFixture({
      context,
      baseURL: String(testInfo.project.use.baseURL),
      projectName: testInfo.project.name,
      scenario: "GOOGLE_ONLY",
    })
    let intents = 0
    await page.route("**/api/auth/google/intent", async (route) => {
      intents += 1
      await new Promise((resolve) => setTimeout(resolve, 650))
      await route.abort("failed")
    })
    await page.goto("/account?tab=security", { waitUntil: "domcontentloaded" })
    await page.getByRole("button", { name: "Add password" }).click()
    const proofPending = page.getByRole("button", { name: "Saving sign-in method…" })
    await expect(proofPending).toBeDisabled()
    await proofPending.click({ force: true })
    await expect(page.getByRole("alert")).toContainText("Something went wrong. Please try again.")
    await expect(page.getByRole("button", { name: "Add password" })).toBeEnabled()
    expect(intents).toBe(1)

    await fixture.removeIdentityMethodSafetyFixture(testInfo.project.name, "GOOGLE_ONLY")
    const installed = await fixture.installIdentityMethodSafetyFixture({
      context,
      baseURL: String(testInfo.project.use.baseURL),
      projectName: testInfo.project.name,
      scenario: "BOTH_METHODS",
    })
    let passwordRequests = 0
    await page.route("**/api/account/security/password", async (route) => {
      passwordRequests += 1
      await new Promise((resolve) => setTimeout(resolve, 650))
      await route.abort("failed")
    })
    await page.goto("/account?tab=security", { waitUntil: "domcontentloaded" })
    await page.getByLabel("Current password").fill(installed.password)
    await page.getByLabel("New password").fill("a-new-browser-password")
    await page.getByText("Confirm this password sign-in change.").click()
    await page.getByRole("button", { name: "Update password" }).click()
    const methodPending = page.getByRole("button", { name: "Saving sign-in method…" })
    await expect(methodPending).toBeDisabled()
    await methodPending.click({ force: true })
    await expect(page.getByRole("alert")).toContainText("Something went wrong. Please try again.")
    await expect(page.getByRole("button", { name: "Update password" })).toBeEnabled()
    expect(passwordRequests).toBe(1)
  })
})
