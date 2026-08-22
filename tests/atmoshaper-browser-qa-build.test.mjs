import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import test from "node:test"

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
const readIfPresent = (path) => {
  const url = new URL(`../${path}`, import.meta.url)
  return existsSync(url) ? readFileSync(url, "utf8") : ""
}

test("AtmoShaper browser-QA hooks live behind one explicit QA-only build", () => {
  const packageData = JSON.parse(read("package.json"))
  const provider = read("components/providers/music-provider.tsx")
  const runtime = read("lib/atmoshaper/runtime.ts")
  const qaOwner = readIfPresent("lib/atmoshaper/browser-qa.ts")
  const disabledOwner = readIfPresent("lib/atmoshaper/browser-qa-disabled.ts")
  const nextConfig = read("next.config.mjs")
  const workflow = read(".github/workflows/ci.yml")

  assert.equal(packageData.scripts["build:browser-qa"], "node scripts/build-browser-qa.mjs")
  assert.equal(
    packageData.scripts["atmoshaper:assert-production-bundle"],
    "node scripts/assert-atmoshaper-production-bundle.mjs",
  )
  assert.match(workflow, /browser_build:[\s\S]*?NEXT_PUBLIC_ATMOSHAPER_BROWSER_QA: "1"/)
  assert.match(nextConfig, /atmoShaperBrowserQaEnabled[\s\S]*browser-qa\.ts[\s\S]*browser-qa-disabled\.ts/)
  assert.match(nextConfig, /"@\/lib\/atmoshaper\/browser-qa": atmoShaperBrowserQaModule/)
  assert.doesNotMatch(disabledOwner, /massagelabAtmoShaperBrowserQa|failNextSourceIds|Browser QA injected failure/)
  for (const source of [provider, runtime]) {
    assert.match(source, /process\.env\.NEXT_PUBLIC_ATMOSHAPER_BROWSER_QA === "1"/)
    assert.match(source, /import\("@\/lib\/atmoshaper\/browser-qa"\)/)
    assert.doesNotMatch(source, /massagelabAtmoShaperBrowserQa|failNextSourceIds|Browser QA injected failure/)
  }
  assert.match(qaOwner, /massagelabAtmoShaperBrowserQa/)
  assert.match(qaOwner, /localhost/)
  assert.match(qaOwner, /splice\(failureIndex, 1\)/)
})
