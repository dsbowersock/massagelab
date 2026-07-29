import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  createBackgroundHostDiagnosticSnapshot,
} from "../components/backgrounds/backgroundHostDiagnostics.ts"
import {
  backgroundPaletteRegistry,
} from "../components/backgrounds/backgroundPaletteRegistry.ts"

describe("BackgroundHost diagnostics", () => {
  it("reports actual applied renderer targets for a loaded supported effect", () => {
    const adapter = backgroundPaletteRegistry["massage-lab-ripple-grid"]
    const baseEffectProps = {
      massageLabRippleGrid: {
        gridColor: "#ffffff",
        enableRainbow: true,
        rippleIntensity: 0.2,
      },
    }
    const appliedEffectProps = adapter.applyRoleColors(
      baseEffectProps,
      { grid: "#ff5119" },
      "custom",
    )

    assert.deepEqual(
      createBackgroundHostDiagnosticSnapshot({
        requestedId: "massage-lab-ripple-grid",
        loadedId: "massage-lab-ripple-grid",
        loadStatus: "loaded",
        adapter,
        baseEffectProps,
        appliedEffectProps,
        reducedMotion: false,
        error: null,
      }),
      {
        requestedId: "massage-lab-ripple-grid",
        loadedId: "massage-lab-ripple-grid",
        status: "loaded",
        rendererFamily: "webgl",
        resolvedRendererTargets: {
          "massageLabRippleGrid.enableRainbow": false,
          "massageLabRippleGrid.gridColor": "#ff5119",
        },
        applicationChanged: true,
        fallback: false,
        reducedMotion: false,
        error: null,
      },
    )
  })

  it("reports unsupported effects truthfully without claiming target mutation", () => {
    const adapter = backgroundPaletteRegistry["massage-lab-aurora"]
    const baseEffectProps = {
      className: "fixed-media",
      media: { src: "/backgrounds/source.mp4" },
    }

    assert.deepEqual(
      createBackgroundHostDiagnosticSnapshot({
        requestedId: "massage-lab-aurora",
        loadedId: "massage-lab-aurora",
        loadStatus: "loaded",
        adapter,
        baseEffectProps,
        appliedEffectProps: baseEffectProps,
        reducedMotion: false,
        error: null,
      }),
      {
        requestedId: "massage-lab-aurora",
        loadedId: "massage-lab-aurora",
        status: "unsupported",
        rendererFamily: "css-dom",
        resolvedRendererTargets: {},
        applicationChanged: false,
        fallback: false,
        reducedMotion: false,
        error: null,
      },
    )
  })

  it("fails closed for stale loads and exposes reduced-motion fallback", () => {
    const adapter = backgroundPaletteRegistry["massage-lab-retro-grid"]
    const baseEffectProps = { massageLabRetroGrid: { backgroundColor: "#000000" } }

    const stale = createBackgroundHostDiagnosticSnapshot({
      requestedId: "massage-lab-retro-grid",
      loadedId: "massage-lab-aerial-rays",
      loadStatus: "loaded",
      adapter,
      baseEffectProps,
      appliedEffectProps: baseEffectProps,
      reducedMotion: false,
      error: null,
    })
    assert.equal(stale.status, "error")
    assert.match(stale.error, /stale renderer/i)

    const reduced = createBackgroundHostDiagnosticSnapshot({
      requestedId: "massage-lab-retro-grid",
      loadedId: null,
      loadStatus: "loading",
      adapter,
      baseEffectProps,
      appliedEffectProps: baseEffectProps,
      reducedMotion: true,
      error: null,
    })
    assert.equal(reduced.status, "loading")
    assert.equal(reduced.fallback, true)
    assert.equal(reduced.reducedMotion, true)
  })
})
