import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { readFileSync, readdirSync } from "node:fs"
import { extname, join, relative } from "node:path"

const ROOT = process.cwd()
const SOURCE_EXTENSIONS = new Set([".js", ".mjs", ".ts", ".tsx"])

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return SOURCE_EXTENSIONS.has(extname(entry.name)) ? [path] : []
  })
}

function source(path) {
  return readFileSync(join(ROOT, path), "utf8")
}

describe("anonymous operational Sentry boundary", () => {
  it("keeps prohibited Sentry products and identity APIs out of application source", () => {
    const files = ["app", "components", "lib"]
      .flatMap((directory) => sourceFiles(join(ROOT, directory)))
    const combined = files.map((path) => `${relative(ROOT, path)}\n${readFileSync(path, "utf8")}`).join("\n")

    assert.doesNotMatch(combined, /Sentry\.(?:setUser|showReportDialog|captureUserFeedback|addAttachment)/)
    assert.doesNotMatch(combined, /(?:replayIntegration|feedbackIntegration|captureConsoleIntegration)\s*\(/)
    assert.doesNotMatch(combined, /@sentry\/replay/)
  })

  it("limits application capture sites to global errors and voluntary diagnostics", () => {
    const files = ["app", "components", "lib"]
      .flatMap((directory) => sourceFiles(join(ROOT, directory)))
    const captureSites = files
      .filter((path) => /Sentry\.(?:captureException|captureMessage)\s*\(/.test(readFileSync(path, "utf8")))
      .map((path) => relative(ROOT, path).replaceAll("\\", "/"))
      .sort()

    assert.deepEqual(captureSites, [
      "app/api/support/problem-report/route.ts",
      "app/global-error.tsx",
    ])
  })

  it("pins root Sentry framework hooks without allowing additional capture APIs", () => {
    const rootSources = [
      ["instrumentation.ts", source("instrumentation.ts")],
      ["instrumentation-client.ts", source("instrumentation-client.ts")],
    ]

    assert.match(rootSources[0][1], /export const onRequestError\s*=\s*Sentry\.captureRequestError/)
    assert.match(rootSources[1][1], /export const onRouterTransitionStart\s*=\s*Sentry\.captureRouterTransitionStart/)

    const rootCaptureCalls = rootSources
      .flatMap(([path, contents]) => [...contents.matchAll(/Sentry\.capture[A-Za-z0-9_]+/g)]
        .map(([match]) => `${path}:${match}`))
      .sort()

    assert.deepEqual(rootCaptureCalls, [
      "instrumentation-client.ts:Sentry.captureRouterTransitionStart",
      "instrumentation.ts:Sentry.captureRequestError",
    ])
  })

  it("keeps the SDK policy explicit and session-free", () => {
    const options = source("sentry.options.ts")
    const policy = source("lib/sentry-options.js")

    assert.match(options, /dataCollection:\s*getAnonymousSentryDataCollection\(\)/)
    assert.match(options, /enableLogs:\s*false/)
    assert.match(options, /enableMetrics:\s*false/)
    assert.match(options, /maxBreadcrumbs:\s*0/)
    assert.match(options, /integrations\(defaultIntegrations\)\s*{\s*return filterAnonymousSentryIntegrations\(defaultIntegrations\)\s*}/s)
    assert.match(policy, /"BrowserSession"/)
    assert.match(policy, /"Replay"/)
  })

  it("documents anonymous diagnostics without presenting them as product analytics", () => {
    const deployment = source("docs/wiki/deployment.md")
    const privacy = source("docs/wiki/privacy-and-phi.md")
    const combined = `${deployment}\n${privacy}`

    for (const phrase of [
      "no account, user, visitor, or session identifier",
      "automatic click, input, navigation, console, and network breadcrumbs are disabled",
      "not product analytics",
      "Prevent Storing of IP Addresses",
    ]) {
      assert.match(combined, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"))
    }
  })
})
