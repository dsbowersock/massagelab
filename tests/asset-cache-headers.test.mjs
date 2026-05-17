import test from "node:test"
import assert from "node:assert/strict"
import nextConfig from "../next.config.mjs"

test("versionless brand and icon assets revalidate instead of using immutable caching", async () => {
  const rules = await nextConfig.headers()
  const versionlessAssetRules = rules.filter((rule) => (
    rule.source === "/brand/:path*" || rule.source === "/icons/:path*"
  ))

  assert.equal(versionlessAssetRules.length, 2)

  for (const rule of versionlessAssetRules) {
    const cacheControl = rule.headers.find((header) => header.key.toLowerCase() === "cache-control")?.value

    assert.equal(cacheControl, "public, max-age=0, must-revalidate")
    assert.doesNotMatch(cacheControl, /immutable/)
  }
})
