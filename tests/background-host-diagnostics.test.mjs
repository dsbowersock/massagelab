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

  it("reports Beam Field's supported palette targets", () => {
    const adapter = backgroundPaletteRegistry["massage-lab-background-beams"]
    const baseEffectProps = {
      massageLabBackgroundBeams: {
        paletteMode: "source",
        speed: 1.4,
      },
    }
    const appliedEffectProps = adapter.applyRoleColors(
      baseEffectProps,
      {
        background: "#010101",
        "beam-1": "#020202",
        "beam-2": "#030303",
        "beam-3": "#040404",
      },
      "custom",
    )

    assert.deepEqual(
      createBackgroundHostDiagnosticSnapshot({
        requestedId: "massage-lab-background-beams",
        loadedId: "massage-lab-background-beams",
        loadStatus: "loaded",
        adapter,
        baseEffectProps,
        appliedEffectProps,
        reducedMotion: false,
        error: null,
      }),
      {
        requestedId: "massage-lab-background-beams",
        loadedId: "massage-lab-background-beams",
        status: "loaded",
        rendererFamily: "css-dom",
        resolvedRendererTargets: {
          "massageLabBackgroundBeams.backgroundColor": "#010101",
          "massageLabBackgroundBeams.colors[0]": "#020202",
          "massageLabBackgroundBeams.colors[1]": "#030303",
          "massageLabBackgroundBeams.colors[2]": "#040404",
          "massageLabBackgroundBeams.paletteMode": "resolved",
        },
        applicationChanged: true,
        fallback: false,
        reducedMotion: false,
        error: null,
      },
    )
  })

  it("reports Collision Beams' supported palette targets", () => {
    const adapter = backgroundPaletteRegistry["massage-lab-collision-beams"]
    const baseEffectProps = {
      massageLabCollisionBeams: {
        paletteMode: "source",
        speed: 1.4,
      },
    }
    const appliedEffectProps = adapter.applyRoleColors(
      baseEffectProps,
      {
        background: "#010101",
        beam: "#020202",
        accent: "#030303",
        particles: "#040404",
        surface: "#050505",
      },
      "custom",
    )

    const snapshot = createBackgroundHostDiagnosticSnapshot({
      requestedId: "massage-lab-collision-beams",
      loadedId: "massage-lab-collision-beams",
      loadStatus: "loaded",
      adapter,
      baseEffectProps,
      appliedEffectProps,
      reducedMotion: false,
      error: null,
    })

    assert.equal(snapshot.status, "loaded")
    assert.equal(snapshot.applicationChanged, true)
    assert.deepEqual(snapshot.resolvedRendererTargets, {
      "massageLabCollisionBeams.accentColor": "#030303",
      "massageLabCollisionBeams.backgroundColor": "#010101",
      "massageLabCollisionBeams.beamColor": "#020202",
      "massageLabCollisionBeams.paletteMode": "resolved",
      "massageLabCollisionBeams.particleColor": "#040404",
      "massageLabCollisionBeams.surfaceColor": "#050505",
    })
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

  it("reports intentionally skipped renderer loads as idle instead of loading", () => {
    const adapter = backgroundPaletteRegistry["massage-lab-retro-grid"]
    const baseEffectProps = { massageLabRetroGrid: { backgroundColor: "#000000" } }

    const skipped = createBackgroundHostDiagnosticSnapshot({
      requestedId: "massage-lab-retro-grid",
      loadedId: null,
      loadStatus: "idle",
      adapter,
      baseEffectProps,
      appliedEffectProps: baseEffectProps,
      reducedMotion: true,
      error: null,
    })

    assert.equal(skipped.status, "idle")
    assert.equal(skipped.fallback, true)
    assert.equal(skipped.error, null)
  })
})
