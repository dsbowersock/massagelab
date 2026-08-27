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
        new RegExp(`import\\s+(?!type\\b)[^;\\n]*from\\s+["@']@/lib/atmosphere/${moduleName}["@']`),
        `${moduleName} should stay behind the lazy runtime loader`,
      )
      assert.match(
        providerSource,
        new RegExp(`import\\s*\\(\\s*["']@/lib/atmosphere/${moduleName}["']\\s*\\)`),
        `${moduleName} should still be loaded by the runtime path`,
      )
    }
  })

  it("loads AtmoShaper through its single composition root only", () => {
    assert.doesNotMatch(
      providerSource,
      /^import\s+(?!type\b)[^;\n]*from\s+["'](?:tone(?:\/[^"']*)?|@\/lib\/atmoshaper\/(?:runtime|mix-controller|generated-audio-runtime))["']/m,
    )
    assert.doesNotMatch(providerSource, /^import .*@\/lib\/atmoshaper\/runtime/m)
    assert.equal(
      (providerSource.match(/import\("@\/lib\/atmoshaper\/runtime"\)/g) ?? []).length,
      1,
      "the provider should dynamically import exactly the AtmoShaper composition root",
    )
    assert.doesNotMatch(providerSource, /@generative-music\//)
    assert.doesNotMatch(
      providerSource,
      /^import .*@\/lib\/atmosphere\/(?:generative-fm-runtime|tone-proof-runtime)/m,
      "generator runtime modules must have no static provider imports, including type-only imports",
    )
    assert.match(
      providerSource,
      /const loadAtmoShaperRuntime = useCallback\([\s\S]*?import\("@\/lib\/atmoshaper\/runtime"\)/,
      "mix and preview must share the one lazy AtmoShaper composition loader",
    )
    assert.match(providerSource, /const previewAtmoShaperLayer = useCallback[\s\S]*?loadAtmoShaperRuntime\(runtimeLease\)/)
    assert.match(providerSource, /const playAtmoShaper = useCallback[\s\S]*?loadAtmoShaperRuntime\(runtimeLease\)/)
  })
})
