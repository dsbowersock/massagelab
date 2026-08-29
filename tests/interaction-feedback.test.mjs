import test from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
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
  assert.doesNotMatch(rootLayout, /key=\{[^}]*pathname|searchParams/)
  assert.doesNotMatch(layoutWrapper, /key=\{[^}]*pathname|searchParams/)
  assert.match(runningTimer, /router\.replace\(intent\.href\)/)
  assert.match(runningTimer, /router\.push\(intent\.href\)/)
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
})

test("pending submission form keeps function identity and owns native first-submit claiming", () => {
  const pendingForm = source("components/forms/pending-submission-form.tsx")
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
  const compiled = loadCompiledModule(pendingForm, "components/forms/pending-submission-form.test.tsx", {
    react: {
      createContext: () => ({ Provider: passThroughElement("provider") }),
      useContext: () => false,
      useRef: (value) => ({ current: value }),
      useState: (value) => [value, () => {}],
    },
    "react-dom": {
      flushSync: (callback) => { flushes += 1; callback() },
      useFormStatus: () => ({ pending: formPending }),
    },
    "react/jsx-runtime": { Fragment: "fragment", jsx: createElement, jsxs: createElement },
    "@/components/forms/async-action-button": { AsyncActionButton: passThroughElement("async-button") },
  })
  const action = async () => {}
  const formTree = renderFunctionComponents(compiled.PendingSubmissionForm({ action, children: createElement("input", { name: "kept" }) }))
  const form = findElement(formTree, ({ type }) => type === "form")
  assert.equal(form.props.action, action)
  assert.equal(findElement(formTree, ({ type }) => type === "input").props.name, "kept")

  const nativeTree = renderFunctionComponents(compiled.PendingSubmissionForm({
    action: "/native-target",
    method: "post",
    children: createElement("input", { type: "hidden", name: "token", value: "kept" }),
  }))
  const nativeForm = findElement(nativeTree, ({ type }) => type === "form")
  assert.equal(nativeForm.props.action, "/native-target")
  assert.equal(nativeForm.props.method, "post")
  assert.equal(findElement(nativeTree, ({ type }) => type === "input").props.value, "kept")
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

  const invalidTree = renderFunctionComponents(compiled.PendingSubmissionForm({ action: "/native-target" }))
  const invalidForm = findElement(invalidTree, ({ type }) => type === "form")
  invalidForm.props.onSubmit({
    defaultPrevented: false,
    currentTarget: { checkValidity: () => false },
    preventDefault: () => { prevented += 1 },
  })
  assert.equal(flushes, 1)

  formPending = true
  const buttonTree = renderFunctionComponents(compiled.PendingSubmitButton({ idleLabel: "Save", pendingLabel: "Saving…" }))
  const button = findElement(buttonTree, ({ type }) => type === "async-button")
  assert.equal(button.props.pending, true)
  assert.equal(button.props.pendingLabel, "Saving…")
})

test("affected client account actions declare recoverable settlement boundaries", () => {
  const affectedForms = [
    "app/login/login-form.tsx",
    "app/register/register-form.tsx",
    "app/forgot-password/page.tsx",
    "app/reset-password/reset-password-form.tsx",
    "app/account/link-google/link-google-form.tsx",
    "app/account/security/sign-in-methods-panel.tsx",
    "app/account/security/security-panel.tsx",
  ]
  for (const path of affectedForms) {
    const client = source(path)
    assert.match(client, /try \{[\s\S]*catch(?: \([^)]*\))? \{[\s\S]*finally \{/, path)
    assert.match(client, /Something went wrong\. Please try again\./, path)
  }
})
