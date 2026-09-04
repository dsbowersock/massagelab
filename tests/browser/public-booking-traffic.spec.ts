import { expect, test, type Page, type Route } from "@playwright/test"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const require = createRequire(import.meta.url)
const fixturePath = "/__public-booking-traffic-fixture"
const fixtureBundlePath = `${fixturePath}.js`
const availabilityPath = "/api/book/browser-qa/sequence-options"
const fixedNow = new Date("2026-09-01T12:00:00.000Z")
let fixtureRoot: string | null = null
let fixtureBundle: string | null = null

type ActionState =
  | { status: "IDLE" }
  | { status: "SUCCESS"; redirectTo: string }
  | { status: "VALIDATION_ERROR" | "CONFLICT" | "UNAVAILABLE"; message: string }
  | { status: "RATE_LIMITED"; message: string; retryAfterSeconds: number }

type ActionResponse =
  | { delayMs?: number; state: ActionState; throws?: false }
  | { delayMs?: number; throws: true }

type BrowserQaBridge = {
  actionResponses: { booking: ActionResponse[]; waitlist: ActionResponse[] }
  actionCalls: Array<{ kind: "booking" | "waitlist"; fields: Record<string, string> }>
  pushes: string[]
}

declare global {
  interface Window {
    __publicBookingQa: BrowserQaBridge
  }
}

function transpile(source: string) {
  return ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText
}

/**
 * Bundles the real BookingPicker against presentation and transport stubs. The
 * fixture exercises production state/effect/form code without rendering a
 * database-backed public page or invoking a real Server Action.
 */
async function buildPublicBookingFixtureBundle() {
  if (fixtureBundle) return fixtureBundle

  fixtureRoot = mkdtempSync(path.join(tmpdir(), "massagelab-public-booking-traffic-"))
  const outputRoot = path.join(fixtureRoot, "dist")
  const pickerPath = path.join(fixtureRoot, "booking-picker.js")
  const statePath = path.join(fixtureRoot, "public-booking-state.js")
  const actionsPath = path.join(fixtureRoot, "actions.js")
  const navigationPath = path.join(fixtureRoot, "navigation.js")
  const linkPath = path.join(fixtureRoot, "link.js")
  const uiPath = path.join(fixtureRoot, "ui.js")
  const constantsPath = path.join(fixtureRoot, "constants.js")
  const utilsPath = path.join(fixtureRoot, "utils.js")
  const entryPath = path.join(fixtureRoot, "entry.js")

  writeFileSync(pickerPath, transpile(readFileSync(
    path.join(projectRoot, "app/book/[practiceSlug]/booking-picker.tsx"),
    "utf8",
  )))
  writeFileSync(statePath, transpile(readFileSync(
    path.join(projectRoot, "app/calendar/actions/public-booking-state.ts"),
    "utf8",
  )))
  writeFileSync(actionsPath, `
    async function run(kind, formData) {
      const bridge = window.__publicBookingQa;
      const fields = {};
      for (const [name, value] of formData.entries()) fields[name] = String(value);
      bridge.actionCalls.push({ kind, fields });
      const response = bridge.actionResponses[kind].shift();
      if (!response) throw new Error("Missing intercepted action response for " + kind);
      if (response.delayMs) await new Promise((resolve) => window.setTimeout(resolve, response.delayMs));
      if (response.throws) throw new Error("Intercepted ambiguous action transport failure");
      return response.state;
    }
    export async function requestBookingSequenceAction(_previousState, formData) {
      return run("booking", formData);
    }
    export async function joinBookingWaitlistAction(_previousState, formData) {
      return run("waitlist", formData);
    }
  `)
  writeFileSync(navigationPath, `
    const router = {
      push(href) {
        window.__publicBookingQa.pushes.push(href);
        window.history.pushState({}, "", href);
        window.dispatchEvent(new PopStateEvent("popstate"));
      },
    };
    export function usePathname() { return window.location.pathname; }
    export function useRouter() { return router; }
  `)
  writeFileSync(linkPath, `
    import React from "react";
    export default function Link({ href, children, ...props }) {
      return React.createElement("a", { ...props, href }, children);
    }
  `)
  writeFileSync(uiPath, `
    import React from "react";
    const div = (name) => function Component({ children, asChild, ...props }) {
      if (asChild && React.isValidElement(children)) return React.cloneElement(children, props);
      return React.createElement("div", { ...props, "data-qa-ui": name }, children);
    };
    export function AppSurface({ title, description, icon, children, contentClassName, ...props }) {
      return React.createElement("section", props,
        title ? React.createElement("h2", null, icon, title) : null,
        description ? React.createElement("p", null, description) : null,
        children,
      );
    }
    export const Badge = div("badge");
    export const Card = div("card");
    export const CardContent = div("card-content");
    export const CardDescription = div("card-description");
    export const CardHeader = div("card-header");
    export function CardTitle({ children, ...props }) { return React.createElement("h2", props, children); }
    export const Dialog = div("dialog");
    export const DialogContent = div("dialog-content");
    export const DialogDescription = div("dialog-description");
    export const DialogFooter = div("dialog-footer");
    export const DialogHeader = div("dialog-header");
    export const DialogTitle = div("dialog-title");
    export const DialogTrigger = div("dialog-trigger");
    export const DialogClose = div("dialog-close");
    export const Popover = div("popover");
    export const PopoverContent = div("popover-content");
    export const PopoverTrigger = div("popover-trigger");
    export const Separator = () => React.createElement("hr");
    export const Calendar = () => React.createElement("div", { "data-qa-ui": "calendar" });
    export const Label = ({ htmlFor, children, ...props }) => React.createElement("label", { ...props, htmlFor }, children);
    export const Input = React.forwardRef((props, ref) => React.createElement("input", { ...props, ref }));
    export const Button = React.forwardRef(({ asChild, children, variant, size, ...props }, ref) => {
      if (asChild && React.isValidElement(children)) return React.cloneElement(children, { ...props, ref });
      return React.createElement("button", { ...props, ref }, children);
    });
  `)
  writeFileSync(constantsPath, "export const MAX_PUBLIC_ADD_ONS = 3;\n")
  writeFileSync(utilsPath, "export function cn(...values) { return values.filter(Boolean).join(' '); }\n")
  writeFileSync(entryPath, `
    import React from "react";
    import { createRoot } from "react-dom/client";
    import { BookingPicker } from ${JSON.stringify(pickerPath)};

    window.__publicBookingQa = {
      actionResponses: { booking: [], waitlist: [] },
      actionCalls: [],
      pushes: [],
    };
    const signedIn = new URLSearchParams(window.location.search).get("signedIn") === "1";
    const variant = (id, name, durationMinutes) => ({
      id,
      serviceId: "service-1",
      serviceName: "Massage",
      name,
      durationMinutes,
      priceCents: 9000,
      currency: "USD",
    });
    const model = {
      practiceId: "practice-browser-qa",
      practiceSlug: "browser-qa",
      practiceName: "Browser QA Practice",
      timeZone: "UTC",
      policy: { approvalMode: "AUTO_CONFIRM", anyProviderEnabled: true, requireClientAccount: false },
      viewer: { isSignedIn: signedIn },
      primaryServices: [{
        id: "service-1",
        name: "Massage",
        description: "A deterministic browser-only fixture.",
        variants: [variant("variant-1", "Restorative", 60), variant("variant-2", "Deep reset", 75)],
      }],
      addOnServices: [],
      providers: [{ id: "provider-1", label: "QA Provider" }],
      proximity: { enabled: false, label: null, latitude: null, longitude: null, radiusMiles: 50 },
    };
    createRoot(document.getElementById("root")).render(React.createElement(BookingPicker, { model }));
  `)

  const webpack = require("next/dist/compiled/webpack/webpack").webpack
  await new Promise<void>((resolve, reject) => {
    webpack({
      mode: "development",
      context: projectRoot,
      entry: entryPath,
      devtool: false,
      output: { path: outputRoot, filename: "fixture.js" },
      resolve: {
        extensions: [".js"],
        alias: {
          "@/app/calendar/actions$": actionsPath,
          "@/app/calendar/actions/public-booking-state$": statePath,
          "@/components/ui/app-surface$": uiPath,
          "@/components/ui/badge$": uiPath,
          "@/components/ui/button$": uiPath,
          "@/components/ui/calendar$": uiPath,
          "@/components/ui/card$": uiPath,
          "@/components/ui/dialog$": uiPath,
          "@/components/ui/input$": uiPath,
          "@/components/ui/label$": uiPath,
          "@/components/ui/popover$": uiPath,
          "@/components/ui/separator$": uiPath,
          "@/lib/public-booking-constants$": constantsPath,
          "@/lib/public-booking-picker$": path.join(projectRoot, "lib/public-booking-picker.js"),
          "@/lib/utils$": utilsPath,
          "next/link$": linkPath,
          "next/navigation$": navigationPath,
        },
        modules: [path.join(projectRoot, "node_modules"), "node_modules"],
      },
    }, (error: Error | null, stats: { hasErrors(): boolean; toString(options: object): string } | undefined) => {
      if (error) return reject(error)
      if (!stats) return reject(new Error("The public-booking fixture build produced no stats."))
      if (stats.hasErrors()) return reject(new Error(stats.toString({ errors: true, warnings: false })))
      resolve()
    })
  })

  fixtureBundle = readFileSync(path.join(outputRoot, "fixture.js"), "utf8")
  return fixtureBundle
}

function option(startsAt: string) {
  const endsAt = new Date(new Date(startsAt).getTime() + 60 * 60_000).toISOString()
  return {
    startsAt,
    endsAt,
    status: "CONFIRMED",
    totalMassageCapacityMinutes: 60,
    items: [{
      sortOrder: 0,
      providerUserId: "provider-1",
      providerLabel: "QA Provider",
      serviceVariantId: "variant-1",
      serviceName: "Massage",
      serviceVariantName: "Restorative",
      startsAt,
      endsAt,
      massageCapacityMinutes: 60,
    }],
  }
}

async function fulfillJson(route: Route, status: number, payload: unknown, headers: Record<string, string> = {}) {
  await route.fulfill({
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
    body: JSON.stringify(payload),
  })
}

async function openFixture({
  page,
  signedIn = false,
  availability,
}: {
  page: Page
  signedIn?: boolean
  availability: (route: Route, call: number) => Promise<void>
}) {
  const bundle = await buildPublicBookingFixtureBundle()
  const unexpectedRequests: string[] = []
  const availabilityBodies: Array<Record<string, unknown>> = []
  let availabilityCalls = 0

  await page.route("**/*", async (route) => {
    unexpectedRequests.push(route.request().url())
    await route.abort()
  })
  await page.route((url) => url.pathname === availabilityPath, async (route) => {
    availabilityCalls += 1
    availabilityBodies.push(route.request().postDataJSON() as Record<string, unknown>)
    await availability(route, availabilityCalls)
  })
  await page.route((url) => url.pathname === fixtureBundlePath, async (route) => {
    await route.fulfill({ status: 200, contentType: "text/javascript; charset=utf-8", body: bundle })
  })
  await page.route((url) => url.pathname === fixturePath, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: `<main><div id="public-booking-step-indicators"></div><div id="root"></div></main><script src="${fixtureBundlePath}"></script>`,
    })
  })

  await page.goto(`${fixturePath}?signedIn=${signedIn ? "1" : "0"}`, { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("heading", { name: "Services and add-ons" })).toBeVisible()
  return {
    availabilityCalls: () => availabilityCalls,
    availabilityBodies,
    unexpectedRequests,
  }
}

async function pauseClock(page: Page) {
  await page.clock.install({ time: fixedNow })
  await page.clock.pauseAt(fixedNow)
}

async function goToTimeStep(page: Page, { signedIn = false }: { signedIn?: boolean } = {}) {
  await page.getByRole("button", { name: "Continue", exact: true }).click()
  if (!signedIn) {
    await page.getByLabel("Name", { exact: true }).fill("Guest Person")
    await page.getByLabel("Email", { exact: true }).fill("guest@example.test")
    await page.getByLabel("Phone", { exact: true }).fill("555-0100")
  }
  await page.getByRole("button", { name: "Choose time", exact: true }).click()
}

async function setActionResponses(page: Page, kind: "booking" | "waitlist", responses: ActionResponse[]) {
  await page.evaluate(({ actionKind, values }) => {
    window.__publicBookingQa.actionResponses[actionKind] = values
  }, { actionKind: kind, values: responses })
}

async function actionSnapshot(page: Page) {
  return page.evaluate(() => ({
    calls: window.__publicBookingQa.actionCalls,
    pushes: window.__publicBookingQa.pushes,
  }))
}

test.afterAll(() => {
  if (fixtureRoot) rmSync(fixtureRoot, { recursive: true, force: true })
})

test("availability waits 350ms and ignores an aborted stale response", async ({ page }) => {
  await pauseClock(page)
  let releaseFirst!: () => void
  const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve })
  const fixture = await openFixture({
    page,
    availability: async (route, call) => {
      if (call === 1) {
        await firstGate
        await fulfillJson(route, 200, { options: [option("2026-09-02T10:00:00.000Z")] }).catch(() => {})
        return
      }
      await fulfillJson(route, 200, { options: [option("2026-09-02T11:00:00.000Z")] })
    },
  })

  await page.clock.fastForward(349)
  expect(fixture.availabilityCalls()).toBe(0)
  await page.getByRole("button", { name: /Deep reset · 75 min/ }).click()
  await page.clock.fastForward(349)
  expect(fixture.availabilityCalls()).toBe(0)
  await page.clock.fastForward(1)
  await expect.poll(fixture.availabilityCalls).toBe(1)
  expect(fixture.availabilityBodies).toHaveLength(1)
  expect(fixture.availabilityBodies[0].primaryServiceVariantId).toBe("variant-2")

  await page.getByRole("button", { name: /Restorative · 60 min/ }).click()
  await page.clock.fastForward(349)
  expect(fixture.availabilityCalls()).toBe(1)
  await page.clock.fastForward(1)
  await expect.poll(fixture.availabilityCalls).toBe(2)
  expect(fixture.availabilityBodies).toHaveLength(2)
  expect(fixture.availabilityBodies[1].primaryServiceVariantId).toBe("variant-1")

  await goToTimeStep(page)
  await expect(page.getByRole("button", { name: "11:00 AM", exact: true })).toBeVisible()
  releaseFirst()
  await page.clock.runFor(1_000)
  await expect(page.getByRole("button", { name: "10:00 AM", exact: true })).toHaveCount(0)
  expect(fixture.unexpectedRequests).toEqual([])
})

test("availability honors Retry-After and 503 without automatic replay", async ({ page }) => {
  await pauseClock(page)
  let releaseFinal!: () => void
  const finalGate = new Promise<void>((resolve) => { releaseFinal = resolve })
  const fixture = await openFixture({
    page,
    availability: async (route, call) => {
      if (call === 1) {
        await fulfillJson(route, 429, { error: "Slow down." }, { "Retry-After": "1.5" })
        return
      }
      if (call === 2) {
        await fulfillJson(route, 429, { error: "Slow down." }, { "Retry-After": "3" })
        return
      }
      if (call === 3) {
        await fulfillJson(route, 503, { error: "Temporarily unavailable." })
        return
      }
      await finalGate
      await fulfillJson(route, 200, { options: [option("2026-09-02T10:00:00.000Z")] })
    },
  })
  await page.clock.fastForward(350)
  await expect.poll(fixture.availabilityCalls).toBe(1)
  await goToTimeStep(page)

  const retry = page.getByRole("button", { name: "Try again", exact: true })
  await expect(page.locator('p:not([role="status"])').filter({
    hasText: "Unable to load available times. Try again when you're ready.",
  })).toBeVisible()
  await expect(retry).toBeEnabled()
  await retry.click()
  await page.clock.fastForward(349)
  expect(fixture.availabilityCalls()).toBe(1)
  await page.clock.fastForward(1)
  await expect.poll(fixture.availabilityCalls).toBe(2)

  const retryCountdown = page.getByRole("button", { name: /^Try again in \d+s$/ })
  await expect(retryCountdown).toBeDisabled()
  await expect(page.getByRole("status")).toContainText("Try again in 3 seconds")
  await page.clock.runFor(2_999)
  expect(fixture.availabilityCalls()).toBe(2)
  await expect(retryCountdown).toBeDisabled()
  await page.clock.runFor(1)
  expect(fixture.availabilityCalls()).toBe(2)

  await expect(retry).toBeEnabled()
  await retry.click()
  await page.clock.fastForward(350)
  await expect.poll(fixture.availabilityCalls).toBe(3)
  await expect(page.locator('p:not([role="status"])').filter({
    hasText: "Booking availability is temporarily unavailable. Try again when you're ready.",
  })).toBeVisible()
  await expect(retry).toBeEnabled()

  await retry.click()
  await page.clock.fastForward(350)
  await expect.poll(fixture.availabilityCalls).toBe(4)
  await expect(page.getByText("Loading available times...", { exact: true })).toBeVisible()
  releaseFinal()
  await expect(page.getByText("Weekly availability", { exact: true })).toBeVisible()
  expect(fixture.unexpectedRequests).toEqual([])
})

test("guest booking keeps one request identity through pending and recovery, then rotates deliberately", async ({ page }) => {
  await pauseClock(page)
  const fixture = await openFixture({
    page,
    availability: async (route) => fulfillJson(route, 200, {
      options: [option("2026-09-02T10:00:00.000Z")],
    }),
  })
  await page.clock.fastForward(350)
  await goToTimeStep(page)
  await page.getByRole("button", { name: "10:00 AM", exact: true }).click()
  await setActionResponses(page, "booking", [
    {
      delayMs: 1_000,
      state: { status: "RATE_LIMITED", message: "Too many requests. Please wait before trying again.", retryAfterSeconds: 3 },
    },
    { state: { status: "CONFLICT", message: "This request could not be completed. Start a new request and try again." } },
    { state: { status: "CONFLICT", message: "This request could not be completed. Start a new request and try again." } },
    { delayMs: 500, throws: true },
    { state: { status: "SUCCESS", redirectTo: "/book/browser-qa/success" } },
  ])

  const bookingForm = page.locator('form:has(input[name="startsAt"])')
  const requestIdInput = bookingForm.locator('input[name="requestId"]')
  const originalRequestId = await requestIdInput.inputValue()
  expect(originalRequestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  await bookingForm.getByRole("button", { name: "Book selected time" }).click()
  await expect(bookingForm).toHaveAttribute("aria-busy", "true")
  await expect(bookingForm.getByRole("button", { name: "Submitting request..." })).toBeDisabled()
  await page.clock.runFor(999)
  expect((await actionSnapshot(page)).calls).toHaveLength(1)
  await page.clock.runFor(1)
  await expect(bookingForm.getByRole("button", { name: "Try again in 3s" })).toBeDisabled()
  expect(await requestIdInput.inputValue()).toBe(originalRequestId)
  await page.clock.runFor(2_999)
  expect((await actionSnapshot(page)).calls).toHaveLength(1)
  await page.clock.runFor(1)

  await bookingForm.getByRole("button", { name: "Book selected time" }).click()
  await expect(page.getByRole("alert")).toHaveText("This request could not be completed. Start a new request and try again.")
  expect(await requestIdInput.inputValue()).toBe(originalRequestId)
  await bookingForm.getByRole("button", { name: "Start a new booking request" }).click()
  const deliberateRequestId = await requestIdInput.inputValue()
  expect(deliberateRequestId).not.toBe(originalRequestId)
  await expect(page.getByRole("alert")).toHaveCount(0)

  await bookingForm.getByRole("button", { name: "Book selected time" }).click()
  await expect(bookingForm.getByRole("alert")).toHaveText("This request could not be completed. Start a new request and try again.")
  await bookingForm.getByRole("button", { name: "Book selected time" }).click()
  await expect(bookingForm.getByRole("button", { name: "Start a new booking request" })).toBeDisabled()
  await page.clock.runFor(500)
  await expect(bookingForm.getByRole("status")).toContainText("Booking is temporarily unavailable")
  expect(await requestIdInput.inputValue()).toBe(deliberateRequestId)
  await bookingForm.getByRole("button", { name: "Book selected time" }).click()
  await expect.poll(async () => (await actionSnapshot(page)).pushes).toEqual(["/book/browser-qa/success"])
  await expect(page).toHaveURL(/\/book\/browser-qa\/success$/)
  expect(await requestIdInput.inputValue()).not.toBe(deliberateRequestId)

  const snapshot = await actionSnapshot(page)
  expect(snapshot.calls.map((call) => call.fields.requestId)).toEqual([
    originalRequestId,
    originalRequestId,
    deliberateRequestId,
    deliberateRequestId,
    deliberateRequestId,
  ])
  expect(snapshot.calls[0].fields).toMatchObject({
    guestName: "Guest Person",
    guestEmail: "guest@example.test",
    guestPhone: "555-0100",
  })
  expect(snapshot.pushes).toHaveLength(1)
  expect(fixture.unexpectedRequests).toEqual([])
})

test("signed-in waitlist path submits once without guest identity or external traffic", async ({ page }) => {
  await pauseClock(page)
  const fixture = await openFixture({
    page,
    signedIn: true,
    availability: async (route) => fulfillJson(route, 200, { options: [] }),
  })
  await page.clock.fastForward(350)
  await goToTimeStep(page, { signedIn: true })
  await expect(page.getByLabel("Email", { exact: true })).toHaveCount(0)
  await setActionResponses(page, "waitlist", [{
    delayMs: 750,
    state: { status: "SUCCESS", redirectTo: "/book/browser-qa/waitlist" },
  }])

  const waitlistForm = page.locator('form:has(input[name="requestId"]):not(:has(input[name="startsAt"]))')
  const requestIdInput = waitlistForm.locator('input[name="requestId"]')
  const requestId = await requestIdInput.inputValue()
  await waitlistForm.getByRole("button", { name: "Join waitlist" }).click()
  await expect(waitlistForm).toHaveAttribute("aria-busy", "true")
  await expect(waitlistForm.getByRole("button", { name: "Joining waitlist..." })).toBeDisabled()
  await page.clock.runFor(750)
  await expect(page).toHaveURL(/\/book\/browser-qa\/waitlist$/)
  expect(await requestIdInput.inputValue()).not.toBe(requestId)

  const snapshot = await actionSnapshot(page)
  expect(snapshot.calls).toHaveLength(1)
  expect(snapshot.calls[0].fields.requestId).toBe(requestId)
  expect(snapshot.calls[0].fields.guestName).toBeUndefined()
  expect(snapshot.calls[0].fields.guestEmail).toBeUndefined()
  expect(snapshot.calls[0].fields.guestPhone).toBeUndefined()
  expect(snapshot.pushes).toEqual(["/book/browser-qa/waitlist"])
  expect(fixture.unexpectedRequests).toEqual([])
})
