import test from "node:test"
import assert from "node:assert/strict"
import { createServer } from "node:http"
import { createRequire } from "node:module"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"
import {
  createCompiledModuleLoader,
  createElement,
  elementText,
  findElement,
  passThroughElement,
  renderFunctionComponents,
} from "./helpers/compiled-module.mjs"

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const require = createRequire(import.meta.url)

function source(relativePath) {
  const absolutePath = path.join(projectRoot, relativePath)
  assert.ok(existsSync(absolutePath), `Expected ${relativePath} to exist before reading it`)
  return readFileSync(absolutePath, "utf8")
}

test("persistent-shell navigation feedback has focused owners and preserves route-local guards", () => {
  const rootLoading = source("app/loading.tsx")
  const routeFeedback = source("components/shell/route-loading-feedback.tsx")
  const linkIndicator = source("components/shell/link-pending-indicator.tsx")
  const pendingNavigation = source("components/shell/use-pending-navigation.ts")
  const appToolLink = source("components/shell/app-tool-link.tsx")
  const sidebar = source("components/sidebar/app-sidebar-client.tsx")
  const calendarTopBar = source("components/calendar/calendar-operator-top-bar.tsx")
  const intakePage = source("app/notes/intake/client-page.tsx")
  const rootLayout = source("app/layout.tsx")
  const layoutWrapper = source("components/layout-wrapper.tsx")
  const runningTimer = source("app/chimer/running-timer.tsx")

  assert.match(rootLoading, /<RouteLoadingFeedback/)
  assert.doesNotMatch(rootLoading, /Provider/)
  assert.match(routeFeedback, /loaderDelayMs = 180/)
  assert.match(routeFeedback, /data-route-progress="pending"/)
  assert.match(routeFeedback, /pointer-events-none/)
  assert.match(routeFeedback, /aria-busy/)
  assert.match(routeFeedback, /data-route-loader="shell-safe"/)
  assert.match(routeFeedback, /top-20/)
  assert.match(linkIndicator, /useLinkStatus/)
  assert.match(linkIndicator, /aria-hidden="true"/)
  assert.match(pendingNavigation, /startTransition/)
  assert.match(appToolLink, /<Link \{\.\.\.linkProps\}>/)
  assert.match(appToolLink, /<AppToolLinkContent \{\.\.\.contentProps\} \/>/)
  assert.doesNotMatch(sidebar, /router\.push\(href\)/)
  assert.match(sidebar, /onNavigate=/)
  assert.match(sidebar, /function SidebarPendingLinkContent/)
  assert.match(sidebar, /function CalendarSidebarRoute[\s\S]*<SidebarPendingLinkContent/)
  assert.match(sidebar, /function NavSecondary[\s\S]*<SidebarPendingLinkContent/)
  assert.match(sidebar, /function AccountMenu[\s\S]*<SidebarPendingLinkContent/)
  assert.match(calendarTopBar, /usePendingNavigation/)
  assert.match(calendarTopBar, /Loading selected calendar date…/)
  assert.match(calendarTopBar, /open=\{open \|\| isPending\}/)
  assert.match(intakePage, /usePendingNavigation/)
  assert.match(intakePage, /Saving intake and opening SOAP editor…/)
  assert.match(intakePage, /role="status"/)
  assert.doesNotMatch(rootLayout, /key=\{[^}]*(?:pathname|searchParams)/)
  assert.doesNotMatch(layoutWrapper, /key=\{[^}]*(?:pathname|searchParams)/)
  assert.match(runningTimer, /router\.replace\(intent\.href\)/)
  assert.match(runningTimer, /router\.push\(intent\.href\)/)
})

test("an owned Link promotes one shared fixed feedback owner for its full pending lifetime", () => {
  const rootLoading = source("app/loading.tsx")
  const routeFeedback = source("components/shell/route-loading-feedback.tsx")
  const linkIndicator = source("components/shell/link-pending-indicator.tsx")

  assert.match(rootLoading, /<RouteLoadingFeedback owner="root" \/>/)
  assert.match(routeFeedback, /owner\?: "root" \| "link"/)
  assert.match(routeFeedback, /registerRouteFeedbackOwner/)
  assert.match(routeFeedback, /loaderReady: boolean/)
  assert.match(routeFeedback, /routeFeedbackAnnouncementOwnerId/)
  assert.match(routeFeedback, /routeFeedbackAnnouncementResetTimeoutId/)
  assert.match(routeFeedback, /clearTimeout\(routeFeedbackAnnouncementResetTimeoutId\)/)
  assert.match(routeFeedback, /scheduleRouteFeedbackAnnouncementReset/)
  assert.match(routeFeedback, /aria-hidden=\{presentation\.announce \? undefined : "true"\}/)
  assert.match(routeFeedback, /data-route-feedback-owner=\{owner\}/)
  assert.match(linkIndicator, /createPortal/)
  assert.match(linkIndicator, /RouteLoadingFeedback/)
  assert.match(linkIndicator, /pending && portalHost/)
  assert.match(linkIndicator, /<RouteLoadingFeedback owner="link" \/>/)
  assert.doesNotMatch(routeFeedback, /addEventListener\("click"|history\.(?:pushState|replaceState)/)
})

test("shared async action button exposes one stable accessible pending owner", () => {
  const asyncButton = source("components/forms/async-action-button.tsx")
  assert.match(asyncButton, /export type AsyncActionButtonProps\s*=\s*\n?\s*Omit<React\.ComponentProps<typeof Button>, "children" \| "aria-busy">/)
  assert.match(asyncButton, /pending: boolean/)
  assert.match(asyncButton, /idleLabel: string/)
  assert.match(asyncButton, /pendingLabel: string/)
  assert.match(asyncButton, /icon\?: React\.ReactNode/)

  const compiled = loadCompiledModule(asyncButton, "components/forms/async-action-button.test.tsx", {
    react: {},
    "react/jsx-runtime": { Fragment: "fragment", jsx: createElement, jsxs: createElement },
    "@/components/ui/button": { Button: passThroughElement("button") },
    "@/components/ui/loader": { Loader: passThroughElement("loader") },
    "@/lib/utils": { cn: (...values) => values.filter(Boolean).join(" ") },
  })
  const render = (pending) => renderFunctionComponents(compiled.AsyncActionButton({
    pending,
    idleLabel: "Save",
    pendingLabel: "Saving…",
    icon: createElement("icon", {}),
    onClick() {},
  }))
  const idle = render(false)
  const pending = render(true)
  const idleControl = findElement(idle, ({ type }) => type === "button")
  const pendingControl = findElement(pending, ({ type }) => type === "button")
  assert.equal(idleControl.props.disabled, false)
  assert.equal(idleControl.props["aria-busy"], false)
  assert.equal(pendingControl.props.disabled, true)
  assert.equal(pendingControl.props["aria-busy"], true)
  assert.match(elementText(idle), /Save/)
  assert.match(elementText(pending), /Saving…/)
  assert.match(asyncButton, /grid[\s\S]*invisible/)
  assert.match(asyncButton, /role="status"/)
  assert.match(asyncButton, /aria-live="polite"/)
  const loader = findElement(pending, ({ type }) => type === "loader")
  assert.equal(loader.props.size, 18)
  assert.equal(loader.props["aria-hidden"], "true")
  const idleStatus = findElement(idle, ({ props }) => props.role === "status")
  const pendingStatus = findElement(pending, ({ props }) => props.role === "status")
  assert.ok(idleStatus)
  assert.ok(pendingStatus)
  assert.equal(elementText(idleStatus), "")
  assert.equal(elementText(pendingStatus), "Saving…")
})

test("pending submission form keeps function identity and owns native first-submit claiming", () => {
  const pendingForm = source("components/forms/pending-submission-form.tsx")
  assert.match(pendingForm, /export type PendingSubmissionFormProps = Omit<\s*React\.ComponentPropsWithoutRef<"form">,\s*"onSubmit" \| "aria-busy"\s*> & \{ pendingLabel: string \}/s)
  assert.match(pendingForm, /export type PendingSubmitButtonProps =\s*Omit<React\.ComponentProps<typeof Button>, "children" \| "aria-busy"> & \{\s*children: React\.ReactNode\s*pendingLabel: string\s*presentation\?: "button" \| "metal-attention"\s*metalFullWidth\?: boolean\s*\}/s)
  assert.match(pendingForm, /typeof action === "function"/)
  assert.match(pendingForm, /action=\{action\}/)
  assert.match(pendingForm, /useFormStatus\(\)/)
  assert.match(pendingForm, /flushSync/)
  assert.match(pendingForm, /checkValidity\(\)/)
  assert.match(pendingForm, /pendingRef\.current/)
  assert.match(pendingForm, /event\.preventDefault\(\)/)
  assert.match(pendingForm, /method=\{method\}/)

  let formPending = false
  let flushes = 0
  let nativePendingState
  let pendingRef
  let pageShowHandler
  let removedPageShowHandler
  let effectCleanup
  const compiled = loadCompiledModule(pendingForm, "components/forms/pending-submission-form.test.tsx", {
    react: {
      Component: class Component {},
      createContext: () => ({ Provider: passThroughElement("provider") }),
      useContext: () => null,
      useEffect: (effect) => { effectCleanup = effect() },
      useRef: (value) => {
        pendingRef = { current: value }
        return pendingRef
      },
      useState: (value) => {
        nativePendingState ??= value
        return [nativePendingState, (next) => { nativePendingState = next }]
      },
    },
    "react-dom": {
      flushSync: (callback) => { flushes += 1; callback() },
      useFormStatus: () => ({ pending: formPending }),
    },
    "react/jsx-runtime": { Fragment: "fragment", jsx: createElement, jsxs: createElement },
    "@/components/forms/async-action-button": { AsyncActionButton: passThroughElement("async-button") },
    "@/components/ui/button": { Button: passThroughElement("button") },
    "@/components/ui/loader": { Loader: passThroughElement("loader") },
    "@/components/ui/metal-attention-button": { MetalAttentionButton: passThroughElement("metal-button") },
    "@/lib/utils": { cn: (...values) => values.filter(Boolean).join(" ") },
  })
  const action = async () => {}
  const previousWindow = globalThis.window
  try {
  globalThis.window = {
    addEventListener: (name, handler) => {
      if (name === "pageshow") pageShowHandler = handler
    },
    removeEventListener: (name, handler) => {
      if (name === "pageshow") removedPageShowHandler = handler
    },
  }
  const formTree = compiled.PendingSubmissionForm({ action, method: "post", pendingLabel: "Saving…", children: createElement("input", { name: "kept" }) })
  const form = findElement(formTree, ({ type }) => type === "form")
  assert.equal(form.props.action, action)
  assert.equal(form.props.method, "post")
  assert.equal(findElement(formTree, ({ type }) => type === "input").props.name, "kept")

  const nativeTree = renderFunctionComponents(compiled.PendingSubmissionForm({
    action: "/native-target",
    method: "post",
    pendingLabel: "Opening…",
    children: createElement("input", { type: "hidden", name: "token", value: "kept" }),
  }))
  const nativeForm = findElement(nativeTree, ({ type }) => type === "form")
  assert.equal(nativeForm.props.action, "/native-target")
  assert.equal(nativeForm.props.method, "post")
  assert.equal(findElement(nativeTree, ({ type }) => type === "input").props.value, "kept")
  const nativeIdleStatus = findElement(nativeTree, ({ props }) => props.role === "status")
  assert.ok(nativeIdleStatus)
  assert.equal(elementText(nativeIdleStatus), "")
  let prevented = 0
  const validEvent = {
    defaultPrevented: false,
    currentTarget: { checkValidity: () => true },
    preventDefault: () => { prevented += 1 },
  }
  nativeForm.props.onSubmit(validEvent)
  nativeForm.props.onSubmit(validEvent)
  assert.equal(flushes, 1)
  assert.equal(prevented, 1)
  assert.equal(nativePendingState, true)
  assert.equal(typeof pageShowHandler, "function")
  pageShowHandler({ persisted: false })
  assert.equal(nativePendingState, true)
  pageShowHandler({ persisted: true })
  assert.equal(nativePendingState, false)
  assert.equal(pendingRef.current, false)
  nativeForm.props.onSubmit(validEvent)
  assert.equal(flushes, 2)

  const invalidTree = renderFunctionComponents(compiled.PendingSubmissionForm({ action: "/native-target", pendingLabel: "Opening…" }))
  const invalidForm = findElement(invalidTree, ({ type }) => type === "form")
  invalidForm.props.onSubmit({
    defaultPrevented: false,
    currentTarget: { checkValidity: () => false },
    preventDefault: () => { prevented += 1 },
  })
  assert.equal(flushes, 2)

  formPending = true
  const buttonTree = renderFunctionComponents(compiled.PendingSubmitButton({
    children: "Save",
    pendingLabel: "Saving…",
    presentation: "metal-attention",
    metalFullWidth: true,
  }))
  const button = findElement(buttonTree, ({ type }) => type === "metal-button")
  assert.equal(button.props.disabled, true)
  assert.equal(button.props["aria-busy"], true)
  assert.equal(button.props.metalFullWidth, true)
  assert.match(elementText(button), /Saving…/)
  const loader = findElement(buttonTree, ({ type }) => type === "loader")
  assert.equal(loader.props.size, 18)
  assert.equal(loader.props["aria-hidden"], "true")
  assert.equal(findElement(buttonTree, ({ props }) => props.role === "status").props.role, "status")

  formPending = false
  const legacyButtonTree = renderFunctionComponents(compiled.PendingSubmitButton({
    idleLabel: "Save",
    pendingLabel: "Saving…",
  }))
  assert.equal(
    elementText(findElement(
      legacyButtonTree,
      ({ type, props }) => type === "span" && props["aria-hidden"] === false,
    )),
    "Save",
  )
  const legacyIdleStatus = findElement(legacyButtonTree, ({ props }) => props.role === "status")
  assert.ok(legacyIdleStatus)
  assert.equal(elementText(legacyIdleStatus), "")
  effectCleanup()
  assert.equal(removedPageShowHandler, pageShowHandler)
  } finally {
    globalThis.window = previousWindow
  }
})

test("pending submission unit harness owns its global window cleanup boundary", () => {
  const interactionTest = source("tests/interaction-feedback.test.mjs")
  const harness = interactionTest.slice(
    interactionTest.indexOf('test("pending submission form keeps function identity'),
    interactionTest.indexOf('test("pending submission unit harness owns its global window cleanup boundary'),
  )
  assert.match(
    harness,
    /const previousWindow = globalThis\.window\s+try \{\s+globalThis\.window = \{/,
  )
  assert.match(
    harness,
    /assert\.equal\(removedPageShowHandler, pageShowHandler\)\s*\} finally \{\s*globalThis\.window = previousWindow\s*\}/,
  )
})

test("billing browser evidence covers native invalid-form idleness and the production donation label", () => {
  const browserSpec = source("tests/browser/interaction-feedback.spec.ts")
  const nativeSnapshot = source("tests/browser/native-submission-snapshot.ts")

  assert.match(browserSpec, /test\("native constraint validation stays idle until the billing form is valid"/)
  assert.match(browserSpec, /test\("donation fixture keeps its production label while pending copy is announced"/)
  assert.match(browserSpec, /ariaLabel: "\$5 Small project support"/)
  assert.match(browserSpec, /form\.getByRole\("status"\)\)\.toHaveCount\(1\)/)
  assert.match(browserSpec, /PageTransitionEvent\("pageshow", \{ persisted: true \}\)/)
  assert.match(nativeSnapshot, /requestSubmit\(\)/)
})

test("function actions recover after real React DOM resolution and rejection", { timeout: 45_000 }, async () => {
  const pendingFormSource = source("components/forms/pending-submission-form.tsx")
  assert.match(pendingFormSource, /class PendingSubmissionErrorBoundary/)
  assert.match(pendingFormSource, /Something went wrong\. Please try again\./)

  let fixtureRoot = null
  let server = null
  let browser = null
  try {
  // This real-browser harness proves function Server Action recovery after both
  // React DOM settlement paths. A real browser is required, so Chromium must be installed.
  fixtureRoot = mkdtempSync(path.join(tmpdir(), "massagelab-form-settlement-"))
  const outputRoot = path.join(fixtureRoot, "dist")
  const componentPath = path.join(fixtureRoot, "pending-submission-form.js")
  const buttonPath = path.join(fixtureRoot, "async-action-button.js")
  const entryPath = path.join(fixtureRoot, "entry.js")
  const transpiled = ts.transpileModule(pendingFormSource, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  }).outputText
  writeFileSync(componentPath, transpiled)
  writeFileSync(buttonPath, `
    import React from "react";
    export function Button({ children, ...props }) {
      return React.createElement("button", props, children);
    }
    export function MetalAttentionButton({ children, metalFullWidth, ...props }) {
      return React.createElement("button", { ...props, "data-metal-full-width": metalFullWidth }, children);
    }
    export function Loader(props) {
      return React.createElement("span", props);
    }
    export function cn(...values) {
      return values.filter(Boolean).join(" ");
    }
    export function AsyncActionButton({ pending, idleLabel, pendingLabel, ...props }) {
      return React.createElement("button", { ...props, disabled: Boolean(props.disabled || pending) }, pending ? pendingLabel : idleLabel);
    }
  `)
  writeFileSync(entryPath, `
    import React from "react";
    import { createRoot } from "react-dom/client";
    import { PendingSubmissionForm, PendingSubmitButton } from ${JSON.stringify(componentPath)};
    let settle;
    let reject;
    window.calls = 0;
    const action = () => {
      window.calls += 1;
      return new Promise((resolve, rejectPromise) => { settle = resolve; reject = rejectPromise; });
    };
    window.formHarness = {
      resolve: () => settle(),
      reject: () => reject(new Error("private provider detail")),
    };
    createRoot(document.getElementById("root")).render(
      React.createElement(PendingSubmissionForm, { action, method: "post", pendingLabel: "Saving…" },
        React.createElement(PendingSubmitButton, { pendingLabel: "Saving…" }, "Save")
      )
    );
  `)

  const webpackModule = require("next/dist/compiled/webpack/webpack")
  const webpack = webpackModule.webpack
  await new Promise((resolve, rejectPromise) => {
    webpack({
      mode: "development",
      context: projectRoot,
      entry: entryPath,
      output: { path: outputRoot, filename: "fixture.js" },
      resolve: {
        extensions: [".js"],
        alias: {
          "@/components/forms/async-action-button": buttonPath,
          "@/components/ui/button": buttonPath,
          "@/components/ui/loader": buttonPath,
          "@/components/ui/metal-attention-button": buttonPath,
          "@/lib/utils": buttonPath,
        },
        modules: [path.join(projectRoot, "node_modules"), "node_modules"],
      },
    }, (error, stats) => {
      if (error) return rejectPromise(error)
      if (!stats) return rejectPromise(new Error("The function-action fixture webpack build produced no stats."))
      if (stats.hasErrors()) return rejectPromise(new Error(stats.toString({ errors: true, warnings: false })))
      resolve()
    })
  })

  server = createServer((request, response) => {
    response.setHeader("content-type", request.url === "/fixture.js" ? "text/javascript; charset=utf-8" : "text/html; charset=utf-8")
    response.end(request.url === "/fixture.js"
      ? readFileSync(path.join(outputRoot, "fixture.js"))
      : '<div id="root"></div><script src="/fixture.js"></script>')
  })
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  assert.ok(address && typeof address === "object")
  const { chromium } = require("playwright")
  browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()
    await page.goto(`http://127.0.0.1:${address.port}`)
    const button = page.getByRole("button", { name: "Save" })
    await button.click()
    await page.waitForFunction(() => window.calls === 1)
    await page.waitForFunction(() => document.querySelector("button")?.disabled === true)
    await page.getByRole("button", { name: "Saving…" }).waitFor()
    await page.evaluate(() => window.formHarness.resolve())
    await button.waitFor()
    assert.equal(await button.isEnabled(), true)

    await button.click()
    await page.waitForFunction(() => window.calls === 2)
    await page.evaluate(() => window.formHarness.reject())
    await page.getByRole("alert").waitFor()
    assert.equal(await page.getByRole("alert").textContent(), "Something went wrong. Please try again.")
    await page.getByRole("button", { name: "Save" }).waitFor()
    assert.equal(await page.getByRole("button", { name: "Save" }).isEnabled(), true)

    await button.click()
    await page.waitForFunction(() => window.calls === 3)
    await page.getByRole("button", { name: "Saving…" }).waitFor()
    assert.equal(await page.getByRole("alert").count(), 0)
    await page.evaluate(() => window.formHarness.resolve())
    await button.waitFor()
    assert.equal(await page.getByRole("alert").count(), 0)

    await button.click()
    await page.waitForFunction(() => window.calls === 4)
    await page.getByRole("button", { name: "Saving…" }).waitFor()
    assert.equal(await page.getByRole("alert").count(), 0)
    await page.evaluate(() => window.formHarness.reject())
    await page.getByRole("alert").waitFor()
    assert.equal(await page.getByRole("alert").textContent(), "Something went wrong. Please try again.")
  } finally {
    try {
      if (browser) await browser.close()
    } finally {
      try {
        if (server?.listening) await new Promise((resolve) => server.close(resolve))
      } finally {
        if (fixtureRoot) rmSync(fixtureRoot, { recursive: true, force: true })
      }
    }
  }
})

test("real React DOM harness owns setup failures inside its cleanup boundary", () => {
  const interactionTest = source("tests/interaction-feedback.test.mjs")
  const harness = interactionTest.slice(interactionTest.indexOf('test("function actions recover'))
  assert.match(harness, /let server = null/)
  assert.match(harness, /let browser = null/)
  assert.match(harness, /try \{[\s\S]*server = createServer[\s\S]*browser = await chromium\.launch/)
  assert.match(harness, /finally \{[\s\S]*if \(browser\)[\s\S]*if \(server\?\.listening\)[\s\S]*rmSync\(fixtureRoot/)
})

test("async client account action owners declare recoverable settlement boundaries", () => {
  const asyncActionOwners = [
    "app/login/login-form.tsx",
    "app/register/register-form.tsx",
    "app/forgot-password/page.tsx",
    "app/reset-password/reset-password-form.tsx",
    "app/account/link-google/link-google-form.tsx",
    "app/account/security/sign-in-methods-panel.tsx",
  ]
  for (const path of asyncActionOwners) {
    const client = source(path)
    assert.match(client, /try \{[\s\S]*catch(?: \([^)]*\))? \{[\s\S]*finally \{/, path)
    assert.match(
      client,
      path.endsWith("link-google-form.tsx")
        ? /GENERIC_GOOGLE_LINK_RECOVERY_MESSAGE/
        : /Something went wrong\. Please try again\./,
      path,
    )
  }
})

test("security mutations share one synchronous owner across sign-in methods and 2FA", () => {
  const securityPanel = source("app/account/security/security-panel.tsx")
  const methodsPanel = source("app/account/security/sign-in-methods-panel.tsx")
  assert.match(securityPanel, /type PendingSecurityAction =[\s\S]*"google-proof"[\s\S]*"backup-codes"/)
  assert.equal((securityPanel.match(/const actionLock = useRef<PendingSecurityAction>\(null\)/g) ?? []).length, 1)
  assert.match(securityPanel, /<SignInMethodsPanel[\s\S]*pendingAction=\{pendingAction\}[\s\S]*beginAction=\{beginAction\}[\s\S]*finishAction=\{finishAction\}/)
  assert.doesNotMatch(methodsPanel, /useRef/)
  assert.doesNotMatch(methodsPanel, /setPendingAction/)
  assert.match(methodsPanel, /pendingAction: PendingSecurityAction/)
  assert.match(methodsPanel, /beginAction: \(action: Exclude<PendingSecurityAction, null>\) => boolean/)
  assert.match(methodsPanel, /finishAction: \(action: Exclude<PendingSecurityAction, null>\) => void/)
})

test("Auth.js redirect flows retain their synchronous owner after document navigation starts", () => {
  const entryActions = source("lib/auth-entry-actions.ts")
  assert.match(entryActions, /const initialHref = currentHref\(\)/)
  assert.match(entryActions, /await signInImpl\("google", \{ redirectTo: result\.callbackUrl \}\)/)
  assert.match(entryActions, /if \(currentHref\(\) === initialHref\) throw new Error\("Google navigation did not start"\)/)
  assert.match(entryActions, /return "navigating"/)

  for (const relativePath of [
    "app/login/login-form.tsx",
    "app/register/register-form.tsx",
  ]) {
    const client = source(relativePath)
    assert.match(client, /let navigating = false/, relativePath)
    assert.match(client, /navigating = await startGoogleAuthMethodIntent\(googleRedirectTo\) === "navigating"/, relativePath)
    assert.match(client, /if \(!navigating\) finishEntryAction\(\)/, relativePath)
  }

  const methodsPanel = source("app/account/security/sign-in-methods-panel.tsx")
  assert.match(methodsPanel, /let documentNavigationStarted = false/)
  assert.match(methodsPanel, /const initialHref = window\.location\.href/)
  assert.match(methodsPanel, /documentNavigationStarted = window\.location\.href !== initialHref/)
  assert.match(methodsPanel, /if \(!documentNavigationStarted\) finishAction\("google-proof"\)/)
})

test("client response owners pre-mount live regions and keep route copy separate from transport failures", () => {
  const linkGoogle = source("app/account/link-google/link-google-form.tsx")
  const methodsPanel = source("app/account/security/sign-in-methods-panel.tsx")
  const resetPassword = source("app/reset-password/reset-password-form.tsx")
  const serverSidebar = source("components/sidebar/sidebar.tsx")

  assert.match(linkGoogle, /<p role="status" aria-live="polite" aria-atomic="true"/)
  assert.match(linkGoogle, /<p role="alert" aria-live="assertive" aria-atomic="true"/)
  assert.doesNotMatch(linkGoogle, /setActionState\("success"\)/)
  assert.doesNotMatch(linkGoogle, /setMessage\("The sign-in methods now belong/)

  assert.equal((methodsPanel.match(/setMessage\(safeMethodResponseMessage\(/g) ?? []).length, 3)
  assert.doesNotMatch(methodsPanel, /throw new Error\(result\.message/)
  assert.doesNotMatch(methodsPanel, /catch \(error\)[\s\S]{0,160}error\.message/)
  assert.match(methodsPanel, /catch \{\s*setActionState\("error"\)\s*setMessage\("Something went wrong\. Please try again\."\)/)

  assert.match(resetPassword, /<p role="status" aria-live="polite" aria-atomic="true"/)
  assert.match(resetPassword, /<p role="alert" aria-live="assertive" aria-atomic="true"/)

  assert.match(serverSidebar, /\/\*\* Whether the signed-in owner belongs to at least one practice\. \*\/\s*hasPracticeMembership: boolean/)
  assert.match(serverSidebar, /\/\*\*[\s\S]{0,240}canonical account owner[\s\S]{0,240}\*\/\s*export async function getAppSidebarData/)
})
