import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
}

const carousel = read("components/atmosphere/station-carousel.tsx")
const browseWorkspace = read("app/browse/workspace.tsx")
const atmoWorkspace = read("components/atmoshaper/atmoshaper-workspace.tsx")
const currentMix = read("components/atmoshaper/current-mix.tsx")
const currentMixRail = read("components/atmoshaper/current-mix-rail.tsx")
const sortableRow = read("components/atmoshaper/sortable-layer-row.tsx")
const workspaceModel = read("components/atmoshaper/workspace-model.js")
const styles = read("app/globals.css")
const atmoStylesStart = styles.indexOf("/* AtmoShaper receives")
const atmoStyles = styles.slice(
  atmoStylesStart,
  styles.indexOf("  .ml-music-player-toolbar", atmoStylesStart),
)
const productionSource = [
  carousel,
  browseWorkspace,
  atmoWorkspace,
  currentMix,
  currentMixRail,
  sortableRow,
  workspaceModel,
  atmoStyles,
].join("\n")

describe("AtmoShaper responsive integration source contract", () => {
  it("mounts only the mixer at the AtmoShaper category integration point", () => {
    assert.match(carousel, /import \{ AtmoShaperWorkspace \}/)
    assert.match(
      carousel,
      /isFavoritesCategory && stationItems\.length === 0[\s\S]*?: isAtmoshaperCategory \? \(\s*<AtmoShaperWorkspace \/>\s*\) : \(\s*<AdaptiveCarouselStage/,
    )
    assert.doesNotMatch(carousel, /Coming soon|atmoshaper-coming-soon/)
    assert.match(browseWorkspace, /atmosphereCarouselView === "stations"[\s\S]*?<AtmosphereFavoritesSpeedDial/)
  })

  it("reserves only one edge rail while the library owns the remaining width", () => {
    assert.match(atmoWorkspace, /<CurrentMixRail[\s\S]*?<SoundLibrary/)
    assert.match(atmoWorkspace, /data-current-mix-side=\{drawerSide\}/)
    assert.match(atmoStyles, /--ml-atmoshaper-rail-width:\s*clamp\(/)
    assert.match(atmoStyles, /grid-template-areas:\s*"library rail"/)
    assert.match(atmoStyles, /grid-template-columns:\s*minmax\(0, 1fr\) var\(--ml-atmoshaper-rail-width\)/)
    assert.match(atmoStyles, /\[data-current-mix-side="left"\][\s\S]*?grid-template-areas:\s*"rail library"/)
    assert.match(atmoStyles, /\.ml-atmoshaper-library\s*\{[\s\S]*?grid-area:\s*library/)
    assert.match(atmoStyles, /\.ml-atmoshaper-current-mix-rail\s*\{[\s\S]*?grid-area:\s*rail/)
    assert.match(atmoStyles, /\.ml-atmoshaper-layout\s*\{[\s\S]*?padding-block:\s*0[\s\S]*?padding-inline-end:\s*0/)
    assert.match(
      atmoStyles,
      /\.ml-atmoshaper-layout\[data-current-mix-side="left"\]\s*\{[\s\S]*?padding-inline-start:\s*0[\s\S]*?padding-inline-end:/,
    )
    assert.match(
      atmoStyles,
      /\.ml-atmoshaper-current-mix-rail\s*\{[\s\S]*?position:\s*fixed[\s\S]*?inset-block-start:\s*var\(--ml-atmoshaper-rail-top-reserve\)[\s\S]*?inset-block-end:\s*var\(--ml-atmoshaper-rail-bottom-reserve\)[\s\S]*?border-radius:\s*0[\s\S]*?box-shadow:\s*none/,
    )
  })

  it("uses measured rem geometry with no device, orientation, or zoom branch", () => {
    assert.match(workspaceModel, /ATMOSHAPER_ROOMY_INLINE_REM = 42/)
    assert.match(workspaceModel, /ATMOSHAPER_ROOMY_BLOCK_REM = 32/)
    assert.match(workspaceModel, /inlineSize >= ATMOSHAPER_ROOMY_INLINE_REM \* rootFontSize/)
    assert.match(workspaceModel, /blockSize >= ATMOSHAPER_ROOMY_BLOCK_REM \* rootFontSize/)
    assert.match(atmoWorkspace, /new ResizeObserver/)
    assert.match(atmoWorkspace, /entry\.contentRect\.width, entry\.contentRect\.height/)
    assert.doesNotMatch(
      productionSource,
      /devicePixelRatio|visualViewport(?:\.scale)?|navigator\.userAgent|userAgentData|@media[^\n{]*orientation|@media[^\n{]*zoom|\bzoom\s*:|\b(?:iPhone|iPad|Android|SmartTV)\b/,
    )
  })

  it("widens one fixed edge panel without linking open state to library sizing", () => {
    assert.equal(atmoWorkspace.match(/<Sheet\s/g)?.length ?? 0, 0)
    assert.match(atmoWorkspace, /<CurrentMixRail[\s\S]*?drawerMode=\{drawerMode\}[\s\S]*?drawerSide=\{drawerSide\}[\s\S]*?expanded=\{mixDrawerOpen\}/)
    assert.match(currentMixRail, /data-drawer-mode=\{drawerMode\}/)
    assert.match(currentMixRail, /data-expanded=\{expanded\}/)
    assert.match(currentMixRail, /role=\{expanded \? "dialog" : undefined\}/)
    assert.match(atmoWorkspace, /ml-atmoshaper-current-mix-overlay-narrow/)
    assert.match(atmoStyles, /\.ml-atmoshaper-current-mix-overlay-narrow\s*\{[\s\S]*?background:/)
    assert.match(
      atmoStyles,
      /\.ml-atmoshaper-current-mix-rail\[data-expanded="true"\]\[data-drawer-mode="roomy"\][\s\S]*?inline-size:\s*min\(/,
    )
    assert.match(atmoStyles, /\.ml-atmoshaper-current-mix-rail\[data-expanded="true"\]\[data-drawer-mode="narrow"\][\s\S]*?inline-size:\s*min\(40rem/)
    assert.match(
      atmoStyles,
      /\.ml-atmoshaper-current-mix-rail\s*\{[\s\S]*?width:\s*var\(--ml-atmoshaper-fixed-rail-width\)[\s\S]*?transition:[\s\S]*?inline-size 240ms/,
    )
    assert.match(
      atmoStyles,
      /data-current-mix-side="right"[\s\S]*?\.ml-atmoshaper-current-mix-rail[\s\S]*?inset-inline-end:\s*var\(--ml-atmoshaper-rail-right-reserve\)/,
    )
    assert.match(
      atmoStyles,
      /data-current-mix-side="left"[\s\S]*?\.ml-atmoshaper-current-mix-rail[\s\S]*?inset-inline-start:\s*var\(--ml-safe-left\)/,
    )
    assert.doesNotMatch(atmoStyles, /data-(?:drawer|sheet)-open[\s\S]*?ml-atmoshaper-library/)
  })

  it("bounds library, rail, and drawer overflow inside their own surfaces", () => {
    assert.match(atmoStyles, /\.ml-atmoshaper-workspace\s*\{[\s\S]*?overflow:\s*hidden/)
    assert.match(atmoStyles, /\.ml-atmoshaper-layout\s*\{[\s\S]*?overflow:\s*hidden/)
    assert.match(atmoStyles, /\.ml-atmoshaper-library\s*\{[\s\S]*?overflow-x:\s*hidden[\s\S]*?overflow-y:\s*auto/)
    assert.match(atmoStyles, /\.ml-atmoshaper-current-mix-rail\s*\{[\s\S]*?overflow-x:\s*hidden[\s\S]*?overflow-y:\s*auto/)
    assert.match(atmoStyles, /\.ml-atmoshaper-current-mix-drawer-body\s*\{[\s\S]*?overflow:\s*hidden/)
    assert.match(atmoStyles, /\.ml-atmoshaper-expanded-layers\s*\{[\s\S]*?overflow-x:\s*hidden[\s\S]*?overflow-y:\s*auto/)
    assert.match(atmoStyles, /overscroll-behavior:\s*contain/)
  })

  it("reconstructs app-bar, player, and safe-area exclusions for the fixed panel", () => {
    assert.match(atmoStyles, /--ml-atmoshaper-rail-bottom-reserve:\s*var\(--ml-portal-bottom-stack-height\)/)
    assert.match(atmoStyles, /--ml-atmoshaper-rail-right-reserve:\s*max\(var\(--ml-player-right-safe\), var\(--ml-safe-right\)\)/)
    assert.match(atmoStyles, /data-current-mix-side="left"[\s\S]*?inset-inline-start:\s*var\(--ml-safe-left\)/)
    assert.match(atmoStyles, /data-current-mix-side="right"[\s\S]*?inset-inline-end:\s*var\(--ml-atmoshaper-rail-right-reserve\)/)
    assert.match(atmoStyles, /ml-music-player-bottom:not\(\.ml-music-player-rail\)[\s\S]*?var\(--ml-audio-toolbar-height\)/)
    assert.match(atmoStyles, /ml-music-player-top[\s\S]*?--ml-atmoshaper-rail-top-reserve:[\s\S]*?var\(--ml-audio-toolbar-height\)/)
    assert.match(atmoStyles, /data-app-bar-position="top"[\s\S]*?--ml-atmoshaper-rail-shell-top-reserve/)
  })

  it("keeps sorting on handles and retained rows outside sortable behavior", () => {
    assert.match(currentMix, /class AtmoShaperPointerSensor extends PointerSensor/)
    assert.match(currentMix, /pointerType === "touch"[\s\S]*?distance: 6/)
    assert.match(currentMix, /TouchSensor[\s\S]*?delay: 180, tolerance: 8/)
    assert.match(currentMix, /KeyboardSensor[\s\S]*?sortableKeyboardCoordinates/)
    assert.match(sortableRow, /ml-atmoshaper-layer-drag-handle/)
    assert.match(sortableRow, /\{\.\.\.attributes\}[\s\S]*?\{\.\.\.listeners\}/)
    assert.match(currentMix, /data-sortable="false"/)
  })

  it("removes side motion under reduced motion and retires old layout contracts", () => {
    assert.match(atmoStyles, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.ml-atmoshaper-current-mix-drawer/)
    assert.match(atmoStyles, /\.ml-atmoshaper-layer-row[\s\S]*?animation:\s*none !important[\s\S]*?transition:\s*none !important/)
    assert.doesNotMatch(
      productionSource,
      /CurrentMixTray|Move earlier|Move later|ml-atmoshaper-mix-tray|ml-atmoshaper-current-mix-desktop/,
    )
  })
})
