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

  it("keeps the SDK policy explicit and session-free", () => {
    const options = source("sentry.options.ts")
    const policy = source("lib/sentry-options.js")

    assert.match(options, /dataCollection:\s*getAnonymousSentryDataCollection\(\)/)
    assert.match(options, /enableLogs:\s*false/)
    assert.match(options, /enableMetrics:\s*false/)
    assert.match(options, /maxBreadcrumbs:\s*0/)
    assert.match(policy, /"BrowserSession"/)
    assert.match(policy, /"Replay"/)
  })
})
