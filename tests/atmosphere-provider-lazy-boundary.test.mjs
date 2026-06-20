import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

const providerSourcePath = new URL("../components/providers/music-provider.tsx", import.meta.url)
const providerSource = await readFile(providerSourcePath, "utf8")

describe("Atmosphere provider lazy-loading boundary", () => {
  it("keeps heavy audio runtime modules out of the global provider's static imports", () => {
    const heavyRuntimeModules = [
      "stations",
      "runtime-controller",
      "generative-fm-runtime",
      "tone-proof-runtime",
    ]

    for (const moduleName of heavyRuntimeModules) {
      assert.doesNotMatch(
        providerSource,
        new RegExp(`from\\s+["@']@/lib/atmosphere/${moduleName}["@']`),
        `${moduleName} should stay behind the lazy runtime loader`,
      )
      assert.match(
        providerSource,
        new RegExp(`import\\s*\\(\\s*["']@/lib/atmosphere/${moduleName}["']\\s*\\)`),
        `${moduleName} should still be loaded by the runtime path`,
      )
    }
  })
})
