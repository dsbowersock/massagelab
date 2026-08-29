import test from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

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
  assert.match(linkIndicator, /useLinkStatus/)
  assert.match(linkIndicator, /aria-hidden="true"/)
  assert.match(pendingNavigation, /startTransition/)
  assert.match(appToolLink, /<Link \{\.\.\.linkProps\}>/)
  assert.match(appToolLink, /<AppToolLinkContent \{\.\.\.contentProps\} \/>/)
  assert.doesNotMatch(sidebar, /router\.push\(href\)/)
  assert.match(sidebar, /onNavigate=/)
  assert.match(calendarTopBar, /usePendingNavigation/)
  assert.match(intakePage, /usePendingNavigation/)
  assert.doesNotMatch(rootLayout, /key=\{[^}]*pathname|searchParams/)
  assert.doesNotMatch(layoutWrapper, /key=\{[^}]*pathname|searchParams/)
  assert.match(runningTimer, /router\.replace\(intent\.href\)/)
  assert.match(runningTimer, /router\.push\(intent\.href\)/)
})
