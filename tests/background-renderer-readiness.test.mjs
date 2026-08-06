import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

const rendererPaths = [
  "massage-lab-ripple-grid-background.tsx",
  "massage-lab-dot-field-background.tsx",
  "massage-lab-dot-grid-background.tsx",
  "massage-lab-shape-grid-background.tsx",
]

describe("patterned renderer readiness handshake", () => {
  it("keeps Host import state separate from first-frame readiness", () => {
    const hostSource = readFileSync(
      new URL("../components/backgrounds/BackgroundHost.tsx", import.meta.url),
      "utf8",
    )
    const propsSource = readFileSync(
      new URL("../components/backgrounds/effects/css-backgrounds.tsx", import.meta.url),
      "utf8",
    )

    assert.match(propsSource, /interface BackgroundRendererLifecycleProps/)
    assert.match(propsSource, /onRenderReadyChange\?: \(ready: boolean\) => void/)
    assert.match(hostSource, /data-background-effect-mounted=/)
    assert.match(hostSource, /data-background-effect-ready=/)
    assert.match(hostSource, /reduceBackgroundRendererReadiness/)
    assert.match(hostSource, /requiresRendererReadiness[\s\S]*onRenderReadyChange: handleRenderReadyChange/)
    assert.doesNotMatch(hostSource, /effectMounted: Boolean\(BackgroundComponent\)/)
  })

  it("has every affected renderer report failure/reset and its first completed frame", () => {
    for (const rendererPath of rendererPaths) {
      const source = readFileSync(
        new URL(`../components/backgrounds/effects/${rendererPath}`, import.meta.url),
        "utf8",
      )
      assert.match(source, /onRenderReadyChange/)
      assert.match(source, /reportRenderReadiness\(false\)/)
      assert.match(source, /reportRenderReadiness\(true\)/)
      assert.match(source, /forceContextFailureForReview/)
      assert.match(source, /process\.env\.NODE_ENV !== "production"/)
    }
  })

  it("restores Ripple Grid readiness only after rebuilding a lost WebGL context", () => {
    const source = readFileSync(
      new URL(
        "../components/backgrounds/effects/massage-lab-ripple-grid-background.tsx",
        import.meta.url,
      ),
      "utf8",
    )

    assert.match(source, /webglcontextlost/)
    assert.match(source, /webglcontextrestored/)
    assert.match(source, /event\.preventDefault\(\)/)
    assert.match(source, /handleContextLost[\s\S]*reportRenderReadiness\(false\)/)
    assert.match(source, /handleContextRestored[\s\S]*initializeResources\(\)/)
  })
})
