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

const loaderElementStatePattern =
  /const \[loaderElement, setLoaderElement\] = React\.useState<HTMLDivElement \| null>\(null\)/
const contextualColorPatternSourcePattern =
  /const contextualColorPattern = \/\(\?:currentColor\|var\\\(\)\/i/
const usesContextualColorPattern =
  /const usesContextualColor = contextualColorPattern\.test\(`\$\{color\} \$\{colorBack\}`\)/
const contextualHexColorPattern =
  /hexToRgba\(canResolveColors \? color : "transparent", contextElement\)/
const loaderRefCallbackPattern = /ref=\{setLoaderElement\}/
const loaderContextualGuardPattern =
  /if \(!usesContextualColor\) \{\s+return\s+\}[\s\S]*bumpColorResolutionEpoch\(\)/
const loaderDocumentRootObserverPattern = /observeElement\(document\.documentElement\)/
const loaderBodyObserverPattern = /observeElement\(document\.body\)/
const loaderElementObserverPattern = /observeElement\(loaderElement\)/
const loaderAncestorObserverPattern = /while \(elementToObserve\)/
const shaderFallbackPattern = /setUseFallback\(true\)/
const shaderPremultipliedBlendPattern =
  /gl\.blendFunc\(gl\.ONE, gl\.ONE_MINUS_SRC_ALPHA\)/
const shaderBufferCleanupPattern = /gl\.deleteBuffer\(positionBuffer\)/
const shaderContextLossPattern = /webglcontextlost/
const shaderStaticFramePattern = /const currentSpeed = currentSpeedRef\.current/
const shaderStaticFrameStopPattern =
  /currentSpeed > 0 \? requestAnimationFrame\(render\) : null/
const shaderUniformRefPattern = /const uniformsRef = React\.useRef\(uniforms\)/
const shaderUniformKeySignaturePattern =
  /const uniformKeySignature = React\.useMemo\(\s*\(\) => createUniformKeySignature\(uniforms\),\s*\[uniforms\]\s*\)/
const shaderUniformLocationSignaturePattern =
  /uniformKeySignature\s*\?\s*uniformKeySignature\.split\(uniformKeyDelimiter\)/
const shaderRenderUniformRefPattern = /Object\.entries\(uniformsRef\.current\)\.forEach/
const shaderInitDependenciesPattern = /\[fragmentShader, uniformKeySignature\]/
const shaderMountRafDependenciesPattern =
  /\[fragmentShader, uniformKeySignature, width, height, speed, prefersReducedMotion, useFallback\]/
const shaderOldInitDependenciesPattern = /\[fragmentShader, uniforms\]/
const shaderOldRafDependenciesPattern =
  /\[fragmentShader, uniforms, width, height, speed, prefersReducedMotion, useFallback\]/

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
    assert.match(loaderSource, loaderElementStatePattern)
    assert.match(loaderSource, contextualColorPatternSourcePattern)
    assert.match(loaderSource, usesContextualColorPattern)
    assert.match(loaderSource, contextualHexColorPattern)
    assert.match(loaderSource, loaderRefCallbackPattern)
    assert.match(loaderSource, loaderContextualGuardPattern)
    assert.match(loaderSource, loaderDocumentRootObserverPattern)
    assert.match(loaderSource, loaderBodyObserverPattern)
    assert.match(loaderSource, loaderElementObserverPattern)
    assert.doesNotMatch(loaderSource, loaderAncestorObserverPattern)
    assert.match(loaderSource, /const isAriaHidden = ariaHidden === true \|\| ariaHidden === "true"/)
    assert.match(loaderSource, /role=\{isAriaHidden \? role : role \?\? "status"\}/)
    assert.match(loaderSource, /aria-live=\{isAriaHidden \? ariaLive : ariaLive \?\? "polite"\}/)
    assert.match(loaderSource, /<span className="sr-only">\{label\.trim\(\) \|\| "Loading"\}<\/span>/)
    assert.match(loaderSource, /fragmentShader=\{fragmentShader\}/)
    assert.match(loaderSource, /Math\.max\(14, Math\.min\(140, Math\.round\(size\)\)\)/)
    assert.match(shaderMountSource, /webgl2/)
    assert.match(shaderMountSource, /prefers-reduced-motion: reduce/)
    assert.match(shaderMountSource, /currentSpeedRef\.current = prefersReducedMotion \? 0 : speed/)
    assert.match(shaderMountSource, shaderFallbackPattern)
    assert.match(shaderMountSource, shaderPremultipliedBlendPattern)
    assert.match(shaderMountSource, shaderBufferCleanupPattern)
    assert.match(shaderMountSource, shaderContextLossPattern)
    assert.match(shaderMountSource, shaderStaticFramePattern)
    assert.match(shaderMountSource, shaderStaticFrameStopPattern)
    assert.match(shaderMountSource, shaderUniformRefPattern)
    assert.match(shaderMountSource, shaderUniformKeySignaturePattern)
    assert.match(shaderMountSource, shaderUniformLocationSignaturePattern)
    assert.match(shaderMountSource, shaderRenderUniformRefPattern)
    assert.match(shaderMountSource, shaderInitDependenciesPattern)
    assert.match(shaderMountSource, shaderMountRafDependenciesPattern)
    assert.doesNotMatch(shaderMountSource, shaderOldInitDependenciesPattern)
    assert.doesNotMatch(shaderMountSource, shaderOldRafDependenciesPattern)
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
    assert.match(gallerySource, /Omit the shape to choose Sphere, Swirl, or Ripple randomly/)
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
