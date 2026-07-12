import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

const [
  loaderSource,
  shaderMountSource,
  ditherShaderSource,
  globalsSource,
  chimerLoaderSource,
  runningTimerSource,
  gallerySource,
  accountPageSource,
  preferenceSyncSource,
  supportDiagnosticSource,
  musicLoadingSource,
] = await Promise.all([
  readFile(new URL("../components/ui/loader.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/ui/shader-mount.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/ui/shaders/dither.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  readFile(new URL("../components/chimer-controls/Loader.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/chimer/running-timer.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/dev/buttons/loader-gallery.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/account/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/account/preference-sync.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/support/support-diagnostic-report.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/providers/music-loading-progress.tsx", import.meta.url), "utf8"),
])

describe("Sitewide loader", () => {
  it("provides the labeled shared shader sphere/dither loader", () => {
    assert.match(loaderSource, /const randomLoaderShapes = \["sphere", "swirl", "ripple"\] as const/)
    assert.match(loaderSource, /function pickRandomLoaderShape\(\): LoaderShape/)
    assert.match(loaderSource, /const \[randomShape\] = React\.useState<LoaderShape>\(pickRandomLoaderShape\)/)
    assert.match(loaderSource, /const resolvedShape = shape \?\? randomShape/)
    assert.match(loaderSource, /const shapeValue = shapeMap\[resolvedShape\]/)
    assert.doesNotMatch(loaderSource, /shape = "sphere"/)
    assert.match(loaderSource, /variant = "dither"/)
    assert.match(loaderSource, /color = "#ea580c"/)
    assert.match(loaderSource, /const \[loaderElement, setLoaderElement\] = React\.useState<HTMLDivElement \| null>\(null\)/)
    assert.match(loaderSource, /hexToRgba\(canResolveColors \? color : "transparent", contextElement\)/)
    assert.match(loaderSource, /ref=\{setLoaderElement\}/)
    assert.match(loaderSource, /const isAriaHidden = ariaHidden === true \|\| ariaHidden === "true"/)
    assert.match(loaderSource, /role=\{isAriaHidden \? role : role \?\? "status"\}/)
    assert.match(loaderSource, /aria-live=\{isAriaHidden \? ariaLive : ariaLive \?\? "polite"\}/)
    assert.match(loaderSource, /<span className="sr-only">\{label\.trim\(\) \|\| "Loading"\}<\/span>/)
    assert.match(loaderSource, /fragmentShader=\{fragmentShader\}/)
    assert.match(loaderSource, /Math\.max\(14, Math\.min\(140, Math\.round\(size\)\)\)/)
    assert.match(shaderMountSource, /webgl2/)
    assert.match(shaderMountSource, /prefers-reduced-motion: reduce/)
    assert.match(shaderMountSource, /currentSpeedRef\.current = prefersReducedMotion \? 0 : speed/)
    assert.match(shaderMountSource, /setUseFallback\(true\)/)
    assert.match(shaderMountSource, /gl\.blendFunc\(gl\.ONE, gl\.ONE_MINUS_SRC_ALPHA\)/)
    assert.match(shaderMountSource, /gl\.deleteBuffer\(positionBuffer\)/)
    assert.match(shaderMountSource, /currentSpeedRef\.current === 0/)
    assert.match(shaderMountSource, /\[fragmentShader, uniforms, width, height, speed, prefersReducedMotion, useFallback\]/)
    assert.match(ditherShaderSource, /4x4 Bayer dithering matrix/)
    assert.match(ditherShaderSource, /uniform float u_pxSize/)
    assert.doesNotMatch(globalsSource, /\.ml-loader-sphere/)
  })

  it("keeps Chimer preview loading on the shared implementation", () => {
    assert.match(chimerLoaderSource, /export \{ Loader \} from "@\/components\/ui\/loader"/)
    assert.match(chimerLoaderSource, /export type \{ LoaderProps \}/)
    assert.match(runningTimerSource, /from "@\/components\/chimer-controls\/Loader"/)
    assert.match(runningTimerSource, /label="Loading preview"/)
  })

  it("shows the approved loader in the dev gallery and true indeterminate waits", () => {
    assert.match(gallerySource, /Indeterminate loader/)
    assert.match(gallerySource, /Keep skeletons and progress bars when they explain more/)
    assert.match(gallerySource, /size: 26/)
    assert.match(gallerySource, /sphereComparisonSize: 42/)
    assert.match(gallerySource, /sphereComparisonSize: 76/)
    assert.match(gallerySource, /sphereComparisonSize: 106/)
    assert.match(gallerySource, /speed: 0\.35/)
    assert.match(gallerySource, /swirlSpeed: 0\.35/)
    assert.match(gallerySource, /swirlSpeed: 0\.45/)
    assert.match(gallerySource, /rippleSpeed: 0\.35/)
    assert.match(gallerySource, /rippleSpeed: 0\.45/)
    assert.doesNotMatch(gallerySource, /sphereSize/)
    assert.match(gallerySource, /size=\{example\.sphereComparisonSize\}/)
    assert.match(gallerySource, /speed=\{example\.swirlSpeed\}/)
    assert.match(gallerySource, /speed=\{example\.rippleSpeed\}/)
    assert.match(gallerySource, /Swirl comparison/)
    assert.match(gallerySource, /Ripple comparison/)
    assert.match(gallerySource, /shape="swirl"/)
    assert.match(gallerySource, /shape="ripple"/)
    assert.match(accountPageSource, /<Loader label="Loading account section"/)
    assert.match(preferenceSyncSource, /<Loader aria-hidden="true" label="Syncing preferences"/)
    assert.match(supportDiagnosticSource, /<Loader aria-hidden="true" label="Sending diagnostic"/)
    assert.doesNotMatch(preferenceSyncSource, /animate-spin/)
  })

  it("retains determinate progress for music preparation", () => {
    assert.match(musicLoadingSource, /<Progress/)
    assert.match(musicLoadingSource, /aria-label="Station loading progress"/)
  })
})
