import { expect, test, type Page, type Route } from "@playwright/test"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"
import { isBrowserQaDatabaseTargetAuthorized } from "../../scripts/assert-browser-qa-database-target.mjs"
import { centerCarouselItem } from "./carousel-test-helpers"
import {
  discardRouteFeedbackAccessibilityObserver,
  expectNoHorizontalViewportOverflow,
  expectVisibleRouteProgressBar,
  expectVisibleRouteLoaderCanvas,
  focusWithKeyboard,
  installRouteFeedbackAccessibilityObserver,
  readRouteFeedbackAccessibilityObserver,
} from "./interaction-feedback-accessibility-helpers"
import { installNativeSubmitSnapshotRecorder } from "./native-submission-snapshot"

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
        idleLabel: "$5",
        ariaLabel: "$5 Small project support",
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
            "aria-label": form.ariaLabel,
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
      if (!stats) return reject(new Error("The billing fixture webpack build produced no stats."))
      if (stats.hasErrors()) return reject(new Error(stats.toString({ errors: true, warnings: false })))
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
      body: '<style>.invisible{visibility:hidden}</style><main id="root"></main><script src="/__interaction-feedback-billing-fixture.js"></script>',
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
  // Other controls may keep empty live regions mounted; this request owns one non-empty announcement.
  const requestAnnouncement = page.getByRole("status").filter({ hasText: pendingLabel })
  await expect(requestAnnouncement).toHaveCount(1)
  await expect(requestAnnouncement).toHaveText(pendingLabel)
  await pending.click({ force: true })
  await expect.poll(() => requests).toBe(1)
  return { requests: () => requests }
}

type NativeBillingFixtureCase = {
  fixtureId: "subscription" | "portal" | "donation"
  action: string
  controlName: string
  pendingLabel: string
  expectedFields: Record<string, string>
  returnPath: string
  returnNotices: readonly string[]
  requiresTerms?: boolean
  stableAccessibleName?: boolean
}

async function assertOneDelayedNativeBillingSubmission({
  page,
  fixtureId,
  action,
  controlName,
  pendingLabel,
  expectedFields,
  returnPath,
  returnNotices,
  requiresTerms = false,
  stableAccessibleName = false,
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

  const control = form.getByRole("button", { name: controlName })
  const recorder = await installNativeSubmitSnapshotRecorder({ page, form, pendingLabel })
  await control.evaluate((element) => {
    ;(element as HTMLButtonElement).click()
  })
  const pendingSnapshot = await recorder.snapshot
  expect(pendingSnapshot).toMatchObject({
    buttonAriaBusy: "true",
    buttonDisabled: true,
    formAriaBusy: "true",
    pendingCopyVisible: true,
    statusCount: 1,
    statusText: pendingLabel,
  })
  if (stableAccessibleName) expect(pendingSnapshot.buttonAriaLabel).toBe(controlName)
  await expect.poll(() => requests).toBe(1)

  await expect.poll(() => {
    const url = new URL(page.url())
    return `${url.pathname}${url.search}`
  }).toBe(returnPath)
  for (const notice of returnNotices) {
    await expect(page.getByText(notice, { exact: true }).filter({ visible: true })).toBeVisible()
  }
  expect(method).toBe("POST")
  expect(contentType).toMatch(/^application\/x-www-form-urlencoded(?:;|$)/i)
  expect(postedFields).toEqual(expectedFields)
}

async function startProofDrone(page: Page) {
  await page.goto("/music", { waitUntil: "domcontentloaded" })
  await centerCarouselItem(page, "mlab-proof-drone", "Next station")
  await page.getByRole("button", { name: /^Play MassageLab Proof Drone$/i }).click()
  const toolbar = page.getByTestId("music-player-toolbar")
  await expect(toolbar).toBeVisible()
  await expect(page.getByText("MassageLab Proof Drone").last()).toBeVisible()
  await expect(toolbar).toHaveAttribute("data-playback-state", "playing", { timeout: 30_000 })
  return toolbar
}

async function delayNavigationResponse(page: Page, pathname: string, delayMs = 550) {
  await page.route(`**${pathname}*`, async (route) => {
    const request = route.request()
    const headers = request.headers()
    if (headers["next-router-prefetch"] || headers["purpose"] === "prefetch") {
      await route.abort()
      return
    }

    if (headers.rsc || request.isNavigationRequest()) {
      const response = await route.fetch()
      await new Promise((resolve) => setTimeout(resolve, delayMs))
      await route.fulfill({ response })
      return
    }

    await route.continue()
  })
}

/** Holds one real RSC response until the test explicitly releases it, then always unregisters. */
async function holdNavigationResponse(page: Page, pathname: string) {
  const pattern = `**${pathname}*`
  let releaseHold: () => void = () => undefined
  let requestStarted = false
  let requestFinished = false
  let markRequestStarted: () => void = () => undefined
  let markRequestFinished: () => void = () => undefined
  const hold = new Promise<void>((resolve) => {
    releaseHold = resolve
  })
  const started = new Promise<void>((resolve) => {
    markRequestStarted = resolve
  })
  const finished = new Promise<void>((resolve) => {
    markRequestFinished = resolve
  })
  const handler = async (route: Route) => {
    const request = route.request()
    const headers = request.headers()
    if (headers["next-router-prefetch"] || headers["purpose"] === "prefetch") {
      await route.abort()
      return
    }

    if (headers.rsc || request.isNavigationRequest()) {
      requestStarted = true
      markRequestStarted()
      try {
        const response = await route.fetch()
        await hold
        await route.fulfill({ response })
      } finally {
        requestFinished = true
        markRequestFinished()
      }
      return
    }

    await route.continue()
  }
  await page.route(pattern, handler)

  return {
    waitForRequest: () => started,
    release: releaseHold,
    async releaseAndCleanup() {
      releaseHold()
      if (requestStarted && !requestFinished) await finished
      await page.unroute(pattern, handler)
    },
  }
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
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined)
  await page.getByRole("button", { name: /^Increase minutes$/i }).click()
  for (let step = 0; step < 4; step += 1) {
    const continueButton = page.getByRole("button", { name: /^Continue$/i })
    await expect(continueButton).toBeEnabled()
    await continueButton.click()
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
  await installRouteFeedbackAccessibilityObserver(page)

  await page.getByRole("link", { name: "Open clock" }).click({ noWaitAfter: true })
  await expect(page.getByRole("link", { name: "Open clock" })).toHaveAttribute("data-navigation-pending", "true")
  await expect(page).toHaveURL(/\/clock/)
  expect(await readRouteFeedbackAccessibilityObserver(page)).toMatchObject({
    maximumConcurrentStatusCount: 1,
    pointerEvents: "none",
    progressSeen: true,
    statusOccurrences: 1,
    statusTexts: ["Loading page"],
  })
  await expect(page.locator('[data-route-progress="pending"]')).toHaveCount(0)
  await expect(page.getByRole("status").filter({ hasText: /^Loading page$/ })).toHaveCount(0)
  await expect(page.getByText("MassageLab Proof Drone").last()).toBeVisible()
  await expect(toolbar).toHaveAttribute("data-playback-state", "playing")
  expect(await page.evaluate(() => (
    Reflect.get(window, "__interactionFeedbackMusicToolbar")
    === document.querySelector('[data-testid="music-player-toolbar"]')
  ))).toBe(true)
})

test("desktop route feedback keeps keyboard focus and persistent controls uncovered at 1280x900", async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1280, height: 900 })
  await delayNavigationResponse(page, "/clock", 900)
  const toolbar = await startProofDrone(page)
  await toolbar.evaluate((element) => {
    Reflect.set(window, "__interactionFeedbackViewportToolbar", element)
  })

  const openClock = page.getByRole("link", { name: "Open clock" }).filter({ visible: true }).first()
  await focusWithKeyboard(page, openClock)
  await expect(openClock).toBeFocused()
  expect(await openClock.evaluate((element) => element.matches(":focus-visible"))).toBe(true)
  await installRouteFeedbackAccessibilityObserver(page)
  await page.keyboard.press("Enter")
  await expect(page).toHaveURL(/\/clock/)
  expect(await readRouteFeedbackAccessibilityObserver(page)).toMatchObject({
    controlCentersUncovered: true,
    controlsSeen: 2,
    feedbackOwnedFocus: false,
    maximumHorizontalOverflow: 0,
    pointerEvents: "none",
    progressSeen: true,
  })
  await expect(page.locator('[data-route-progress="pending"]')).toHaveCount(0)
  await expectNoHorizontalViewportOverflow(page)
  expect(await page.evaluate(() => (
    Reflect.get(window, "__interactionFeedbackViewportToolbar")
    === document.querySelector('[data-testid="music-player-toolbar"]')
  ))).toBe(true)
})

test("mobile portrait action feedback stays operable with enlarged text and keyboard activation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  let requests = 0
  await page.route("**/api/account/password-reset/request", async (route) => {
    requests += 1
    await new Promise((resolve) => setTimeout(resolve, 700))
    await route.fulfill({
      status: 202,
      contentType: "application/json",
      body: JSON.stringify({ message: "If that email is registered, a reset link has been sent." }),
    })
  })
  await page.goto("/forgot-password", { waitUntil: "domcontentloaded" })
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" })
  const email = page.getByLabel("Email")
  await email.fill("interaction-enlarged@example.test")
  await email.focus()
  await page.keyboard.press("Tab")

  const submit = page.getByRole("button", { name: "Send reset link" })
  await expect(submit).toBeFocused()
  expect(await submit.evaluate((element) => element.matches(":focus-visible"))).toBe(true)
  await page.keyboard.press("Enter")

  const pending = page.getByRole("button", { name: "Sending reset instructions…" })
  await expect(pending).toBeDisabled()
  await expect(pending).toHaveAttribute("aria-busy", "true")
  expect(await page.evaluate(() => ({
    insidePendingStatus: Boolean(document.activeElement?.closest('[role="status"]')),
    tagName: document.activeElement?.tagName,
  }))).toEqual({ insidePendingStatus: false, tagName: "BODY" })
  await expect(page.getByRole("status").filter({ hasText: /^Sending reset instructions…$/ })).toHaveCount(1)
  await expect(page.getByRole("navigation", { name: "MassageLab main navigation" })).toBeVisible()
  await expectNoHorizontalViewportOverflow(page)
  await expect.poll(() => requests).toBe(1)
  await expect(submit).toBeEnabled()
})

test("compact landscape route feedback remains visible and static with reduced motion", async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 844, height: 390 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  const clockHold = await holdNavigationResponse(page, "/clock")
  let clockObserverInstalled = false
  let toolbar: Awaited<ReturnType<typeof startProofDrone>> | undefined
  try {
    toolbar = await startProofDrone(page)
    await toolbar.evaluate((element) => {
      Reflect.set(window, "__interactionFeedbackPersistentToolbar", element)
    })

    await test.step("capture-phase feedback-focus positive control", async () => {
      const positiveControl = page.locator('[data-interaction-feedback-positive-control="true"]')
      let positiveControlObserverInstalled = false
      try {
        await page.evaluate(() => {
          const owner = document.createElement("div")
          owner.setAttribute("data-route-progress", "pending")
          owner.setAttribute("data-interaction-feedback-positive-control", "true")
          const status = document.createElement("div")
          status.setAttribute("role", "status")
          status.setAttribute("aria-label", "Loading page")
          const focusTarget = document.createElement("button")
          focusTarget.type = "button"
          focusTarget.textContent = "Positive feedback focus target"
          status.append(focusTarget)
          owner.append(status)
          document.body.append(owner)
        })
        await installRouteFeedbackAccessibilityObserver(page)
        positiveControlObserverInstalled = true
        await page.evaluate(() => {
          Reflect.set(
            window,
            "__interactionFeedbackPositiveControlReceipt",
            Reflect.get(window, "__interactionFeedbackAccessibilityObserved"),
          )
        })

        const positiveFocusTarget = positiveControl.getByRole("button", {
          name: "Positive feedback focus target",
        })
        await positiveFocusTarget.focus()
        await expect(positiveFocusTarget).toBeFocused()
        const positiveReceipt = await readRouteFeedbackAccessibilityObserver(page)
        positiveControlObserverInstalled = false
        expect(positiveReceipt.feedbackOwnedFocus).toBe(true)
        expect(await page.evaluate(() => (
          Reflect.has(window, "__interactionFeedbackAccessibilityObserver")
          || Reflect.has(window, "__interactionFeedbackAccessibilityFocusListener")
          || Reflect.has(window, "__interactionFeedbackAccessibilityCleanup")
        ))).toBe(false)

        const postCleanupReceipt = await page.evaluate(async () => {
          const receipt = Reflect.get(
            window,
            "__interactionFeedbackPositiveControlReceipt",
          ) as {
            feedbackOwnedFocus: boolean
            progressSeen: boolean
            statusOccurrences: number
          }
          receipt.feedbackOwnedFocus = false
          receipt.progressSeen = false
          receipt.statusOccurrences = 0
          document.body.tabIndex = -1
          document.body.focus()
          document.querySelector<HTMLElement>(
            '[data-interaction-feedback-positive-control="true"] button',
          )?.focus()
          document.querySelector(
            '[data-interaction-feedback-positive-control="true"]',
          )?.append(document.createElement("span"))
          await new Promise((resolve) => setTimeout(resolve, 0))
          return {
            feedbackOwnedFocus: receipt.feedbackOwnedFocus,
            progressSeen: receipt.progressSeen,
            statusOccurrences: receipt.statusOccurrences,
          }
        })
        expect(postCleanupReceipt).toEqual({
          feedbackOwnedFocus: false,
          progressSeen: false,
          statusOccurrences: 0,
        })
      } finally {
        if (positiveControlObserverInstalled) {
          await discardRouteFeedbackAccessibilityObserver(page)
        }
        await page.evaluate(() => {
          document.querySelector(
            '[data-interaction-feedback-positive-control="true"]',
          )?.remove()
          Reflect.deleteProperty(window, "__interactionFeedbackPositiveControlReceipt")
        })
      }
      await expect(positiveControl).toHaveCount(0)
    })

    const openClock = page.getByRole("link", { name: "Open clock" }).filter({ visible: true }).first()
    await focusWithKeyboard(page, openClock)
    await installRouteFeedbackAccessibilityObserver(page)
    clockObserverInstalled = true
    await page.keyboard.press("Enter")
    await clockHold.waitForRequest()

    await expect(openClock).toHaveAttribute("data-navigation-pending", "true")
    const routeProgress = page.locator('[data-route-progress="pending"]')
    await expect(routeProgress).toHaveCount(1)
    await expect(routeProgress).toHaveAttribute("data-route-feedback-owner", "link")
    await expectVisibleRouteProgressBar(routeProgress)

    const routeLoader = routeProgress.locator('[data-route-loader="shell-safe"]')
    await expectVisibleRouteLoaderCanvas(routeLoader)
    await expect(routeProgress).toHaveAttribute("data-route-feedback-announcement", "live")
    const reducedRouteLoaderInitial = await routeLoader.screenshot({ scale: "css" })
    expect(reducedRouteLoaderInitial.byteLength).toBeGreaterThan(0)
    const routeLoaderCanvas = routeLoader.locator("canvas")
    await routeLoaderCanvas.evaluate((canvas) => {
      canvas.style.visibility = "hidden"
    })
    const reducedRouteLoaderWithoutCanvas = await routeLoader.screenshot({ scale: "css" })
    await routeLoaderCanvas.evaluate((canvas) => {
      canvas.style.visibility = "visible"
    })
    const reducedRouteLoaderRestored = await routeLoader.screenshot({ scale: "css" })
    expect(
      reducedRouteLoaderWithoutCanvas.equals(reducedRouteLoaderInitial),
      "The real route Loader canvas should contribute nontransparent visible pixels.",
    ).toBe(false)
    expect(
      reducedRouteLoaderRestored.equals(reducedRouteLoaderInitial),
      "Restoring the real route Loader canvas should restore the same visible pixels.",
    ).toBe(true)
    await page.waitForTimeout(400)
    await expectVisibleRouteLoaderCanvas(routeLoader)
    const reducedRouteLoaderLater = await routeLoader.screenshot({ scale: "css" })
    expect(
      reducedRouteLoaderLater.equals(reducedRouteLoaderInitial),
      "The visible reduced-motion route Loader should keep identical rendered pixels across 400ms.",
    ).toBe(true)

    clockHold.release()
    await expect(page).toHaveURL(/\/clock/)
    await expect(page.locator('[data-route-progress="pending"]')).toHaveCount(0)
    const clockReceipt = await readRouteFeedbackAccessibilityObserver(page)
    clockObserverInstalled = false
    expect(clockReceipt).toMatchObject({
      barAnimationName: "none",
      controlCentersUncovered: true,
      feedbackOwnedFocus: false,
      maximumConcurrentProgressCount: 1,
      maximumConcurrentStatusCount: 1,
      maximumHorizontalOverflow: 0,
      pointerEvents: "none",
      progressSeen: true,
      statusOccurrences: 1,
      statusTexts: ["Loading page"],
    })
    const clockLinkLive = clockReceipt.ownerPresentations.indexOf("link:live")
    const clockRootVisual = clockReceipt.ownerPresentations.indexOf("root:visual-only")
    expect(clockLinkLive).toBeGreaterThanOrEqual(0)
    expect(clockRootVisual).toBeGreaterThan(clockLinkLive)
    expect(await page.evaluate(() => (
      Reflect.has(window, "__interactionFeedbackAccessibilityObserver")
      || Reflect.has(window, "__interactionFeedbackAccessibilityFocusListener")
      || Reflect.has(window, "__interactionFeedbackAccessibilityCleanup")
    ))).toBe(false)
    expect(await page.evaluate(() => (
      Reflect.get(window, "__interactionFeedbackPersistentToolbar")
      === document.querySelector('[data-testid="music-player-toolbar"]')
    ))).toBe(true)
  } finally {
    clockHold.release()
    if (clockObserverInstalled) await discardRouteFeedbackAccessibilityObserver(page)
    await clockHold.releaseAndCleanup()
  }

  if (!toolbar) throw new Error("The persistent toolbar marker was not established.")
  await page.goBack()
  await expect(page).toHaveURL(/\/music/)
  expect(await page.evaluate(() => (
    Reflect.get(window, "__interactionFeedbackPersistentToolbar")
    === document.querySelector('[data-testid="music-player-toolbar"]')
  ))).toBe(true)

  const secondClockHold = await holdNavigationResponse(page, "/clock")
  let secondClockObserverInstalled = false
  try {
    const secondOpenClock = page.getByRole("link", { name: "Open clock" }).filter({ visible: true }).first()
    await focusWithKeyboard(page, secondOpenClock)
    await installRouteFeedbackAccessibilityObserver(page)
    secondClockObserverInstalled = true
    await page.keyboard.press("Enter")
    await secondClockHold.waitForRequest()

    await expect(secondOpenClock).toHaveAttribute("data-navigation-pending", "true")
    const secondRouteProgress = page.locator('[data-route-progress="pending"]')
    await expect(secondRouteProgress).toHaveCount(1)
    await expect(secondRouteProgress).toHaveAttribute("data-route-feedback-owner", "link")
    await expectVisibleRouteProgressBar(secondRouteProgress)
    await expectVisibleRouteLoaderCanvas(secondRouteProgress.locator('[data-route-loader="shell-safe"]'))
    await expect(secondRouteProgress).toHaveAttribute("data-route-feedback-announcement", "live")

    secondClockHold.release()
    await expect(page).toHaveURL(/\/clock/)
    await expect(page.locator('[data-route-progress="pending"]')).toHaveCount(0)
    const secondClockReceipt = await readRouteFeedbackAccessibilityObserver(page)
    secondClockObserverInstalled = false
    expect(secondClockReceipt).toMatchObject({
      feedbackOwnedFocus: false,
      maximumConcurrentProgressCount: 1,
      maximumConcurrentStatusCount: 1,
      statusOccurrences: 1,
      statusTexts: ["Loading page"],
    })
    const secondClockLinkLive = secondClockReceipt.ownerPresentations.indexOf("link:live")
    expect(secondClockLinkLive).toBeGreaterThanOrEqual(0)
    expect(await page.evaluate(() => (
      Reflect.has(window, "__interactionFeedbackAccessibilityObserver")
      || Reflect.has(window, "__interactionFeedbackAccessibilityFocusListener")
      || Reflect.has(window, "__interactionFeedbackAccessibilityCleanup")
    ))).toBe(false)
    await expect(toolbar).toHaveAttribute("data-playback-state", "playing")
    expect(await page.evaluate(() => (
      Reflect.get(window, "__interactionFeedbackPersistentToolbar")
      === document.querySelector('[data-testid="music-player-toolbar"]')
    ))).toBe(true)
    await expectNoHorizontalViewportOverflow(page)
  } finally {
    secondClockHold.release()
    if (secondClockObserverInstalled) await discardRouteFeedbackAccessibilityObserver(page)
    await secondClockHold.releaseAndCleanup()
  }
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
    controlName: "Start membership checkout",
    pendingLabel: "Opening secure subscription checkout…",
    expectedFields: {
      membershipLevel: "SUPPORTER",
      supporterAmountChoiceId: "support-1",
      interval: "month",
      acceptedLegalDocuments: "membership-billing-refunds:test",
      billingTermsAccepted: "true",
    },
    returnPath: "/account?tab=membership&checkout=cancelled",
    returnNotices: ["Checkout cancelled", "Sign in to manage membership and billing"],
    requiresTerms: true,
  },
  {
    fixtureId: "portal" as const,
    action: "/api/billing/portal",
    controlName: "Manage billing account",
    pendingLabel: "Opening billing portal…",
    expectedFields: { destination: "manage" },
    returnPath: "/account?tab=membership&portal=returned",
    returnNotices: ["Sign in to manage membership and billing"],
  },
  {
    fixtureId: "donation" as const,
    action: "/api/billing/donation",
    controlName: "$5 Small project support",
    pendingLabel: "Opening secure checkout…",
    expectedFields: { amountCents: "500" },
    returnPath: "/pricing?donation=cancelled",
    returnNotices: ["One-time support checkout cancelled"],
    stableAccessibleName: true,
  },
]

test("donation fixture keeps its production label while pending copy is announced", async ({ page }) => {
  let requests = 0
  await page.route("**/api/billing/donation", async (route) => {
    requests += 1
    await new Promise((resolve) => setTimeout(resolve, 900))
    await route.fulfill({ status: 204, body: "" })
  })
  await openBillingFixture(page)
  const form = page.getByTestId("billing-form-donation")
  const controlName = "$5 Small project support"
  const pendingLabel = "Opening secure checkout…"
  const control = form.getByRole("button", { name: controlName })
  const recorder = await installNativeSubmitSnapshotRecorder({ page, form, pendingLabel })

  await control.evaluate((element) => {
    ;(element as HTMLButtonElement).click()
  })
  const pendingSnapshot = await recorder.snapshot
  expect(pendingSnapshot).toMatchObject({
    buttonAriaBusy: "true",
    buttonAriaLabel: controlName,
    buttonDisabled: true,
    formAriaBusy: "true",
    pendingCopyVisible: true,
    statusCount: 1,
    statusText: pendingLabel,
  })
  await expect.poll(() => requests).toBe(1)
  await expect(page).toHaveURL(/__interaction-feedback-billing-fixture$/)
})

test("native constraint validation stays idle until the billing form is valid", async ({ page }) => {
  let requests = 0
  await page.route("**/api/billing/checkout", async (route) => {
    requests += 1
    await new Promise((resolve) => setTimeout(resolve, 900))
    await route.fulfill({ status: 204, body: "" })
  })
  await openBillingFixture(page)
  const form = page.getByTestId("billing-form-subscription")
  const control = form.getByRole("button", { name: "Start membership checkout" })
  await form.evaluate((element) => {
    Reflect.set(window, "__billingSubmitEvents", 0)
    element.addEventListener("submit", () => {
      const submits = Number(Reflect.get(window, "__billingSubmitEvents") ?? 0)
      Reflect.set(window, "__billingSubmitEvents", submits + 1)
    })
  })

  await control.click()
  await page.waitForTimeout(100)
  expect(requests).toBe(0)
  expect(await page.evaluate(() => Reflect.get(window, "__billingSubmitEvents"))).toBe(0)
  await expect(form).toHaveAttribute("aria-busy", "false")
  await expect(control).toBeEnabled()
  await expect(control).toHaveAttribute("aria-busy", "false")
  await expect(form.getByRole("status")).toHaveCount(1)
  await expect(form.getByRole("status")).toHaveText("")
  await expect(form.getByText("Opening secure subscription checkout…", { exact: true })).toBeHidden()

  await form.getByRole("checkbox").check()
  const recorder = await installNativeSubmitSnapshotRecorder({
    page,
    form,
    pendingLabel: "Opening secure subscription checkout…",
  })
  await control.evaluate((element) => {
    ;(element as HTMLButtonElement).click()
  })
  const pendingSnapshot = await recorder.snapshot
  expect(pendingSnapshot).toMatchObject({
    buttonAriaBusy: "true",
    buttonDisabled: true,
    formAriaBusy: "true",
    pendingCopyVisible: true,
    statusCount: 1,
  })
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }))
  })
  await expect(form).toHaveAttribute("aria-busy", "false")
  await expect(control).toBeEnabled()
  await expect(form.getByRole("status")).toHaveText("")
  await expect.poll(() => requests).toBe(1)
  await expect(page).toHaveURL(/__interaction-feedback-billing-fixture$/)
})

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
  await expect(page.getByRole("status").filter({ hasText: "Check your email to continue." })).toHaveCount(1)
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
  const requestOwner = page.locator("form").filter({ has: page.getByLabel("Email") }).locator("..")
  await page.getByRole("button", { name: "Send reset link" }).click()
  await expect(page.getByRole("button", { name: "Sending reset instructions…" })).toBeDisabled()
  await expect(requestOwner.getByRole("alert").filter({
    hasText: /^Something went wrong\. Please try again\.$/,
  })).toHaveText("Something went wrong. Please try again.")
  await expect(page.getByRole("button", { name: "Send reset link" })).toBeEnabled()

  await page.unrouteAll({ behavior: "wait" })
  await page.route("**/api/account/password-reset/confirm", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500))
    await route.abort("failed")
  })
  await page.goto("/reset-password?token=interaction-token", { waitUntil: "domcontentloaded" })
  await page.getByLabel("New password").fill("not-a-real-password")
  const confirmationOwner = page.locator("form").filter({ has: page.getByLabel("New password") }).locator("..")
  await page.getByRole("button", { name: "Update password" }).click()
  await expect(page.getByRole("button", { name: "Updating password…" })).toBeDisabled()
  await expect(confirmationOwner.getByRole("alert").filter({
    hasText: /^Something went wrong\. Please try again\.$/,
  })).toHaveText("Something went wrong. Please try again.")
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
