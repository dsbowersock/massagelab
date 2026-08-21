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
const styles = read("app/globals.css")
const productionSource = [carousel, browseWorkspace, atmoWorkspace, currentMix, styles].join("\n")

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

  it("allocates wide library and Current Mix columns from the measured workspace", () => {
    assert.match(atmoWorkspace, /ml-atmoshaper-layout/)
    assert.match(styles, /\.ml-atmoshaper-workspace\s*\{[\s\S]*?container-type:\s*size/)
    assert.match(
      styles,
      /\.ml-atmoshaper-layout\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)\s+minmax\(clamp\(/,
    )
    assert.match(styles, /gap:\s*clamp\(/)
    assert.match(styles, /\.ml-atmoshaper-library[\s\S]*?min-width:\s*0[\s\S]*?min-height:\s*0/)
    assert.match(styles, /\.ml-atmoshaper-current-mix-desktop[\s\S]*?overflow-y:\s*auto/)
    assert.match(styles, /cqh/)
  })

  it("uses a sticky compact tray and focus-restoring full-mix Sheet when narrow", () => {
    assert.match(atmoWorkspace, /SheetTrigger/)
    assert.match(atmoWorkspace, /SheetContent[\s\S]*?side="bottom"/)
    assert.match(atmoWorkspace, /SheetTitle/)
    assert.match(atmoWorkspace, /SheetDescription/)
    assert.match(atmoWorkspace, /<CurrentMixTray/)
    assert.match(atmoWorkspace, /Open full Current Mix/)
    assert.match(styles, /@container\s*\(max-width:\s*46rem\)/)
    assert.match(styles, /\.ml-atmoshaper-layout\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/)
    assert.match(styles, /\.ml-atmoshaper-current-mix-desktop\s*\{[\s\S]*?display:\s*none/)
    assert.match(styles, /\.ml-atmoshaper-mix-tray\s*\{[\s\S]*?position:\s*sticky/)
  })

  it("bounds internal overflow and gives portaled Sheets a root-owned navigation reservation", () => {
    assert.match(styles, /\.ml-atmoshaper-library\s*\{[\s\S]*?overflow-y:\s*auto/)
    assert.match(styles, /overscroll-behavior:\s*contain/)
    assert.match(styles, /overflow-x:\s*hidden/)
    assert.match(styles, /--ml-portal-bottom-stack-height:\s*var\(--ml-safe-bottom\)/)
    assert.match(
      styles,
      /html\[data-app-bar-position="bottom"\][\s\S]*?--ml-portal-bottom-stack-height:\s*calc\(var\(--ml-safe-bottom\) \+ var\(--ml-(?:desktop-app-bar|main-bar)-height\)\)/,
    )
    assert.match(styles, /\.ml-atmoshaper-current-mix-sheet[\s\S]*?max-block-size:\s*calc\(100dvh/)
  })

  it("adds audio height only for an active bottom player and keeps top or rail navigation-safe", () => {
    const inactiveSheetRule = styles.match(
      /\.ml-atmoshaper-current-mix-sheet \{([\s\S]*?)\n  \}/,
    )?.[1] ?? ""
    const activeBottomRule = styles.match(
      /body\.ml-music-player-active\.ml-music-player-bottom:not\(\.ml-music-player-rail\)\s+\.ml-atmoshaper-current-mix-sheet \{([\s\S]*?)\n  \}/,
    )?.[1] ?? ""
    const topAndRailRule = styles.match(
      /body\.ml-music-player-active\.ml-music-player-top \.ml-atmoshaper-current-mix-sheet,\s*body\.ml-music-player-active\.ml-music-player-rail \.ml-atmoshaper-current-mix-sheet \{([\s\S]*?)\n  \}/,
    )?.[1] ?? ""

    assert.match(inactiveSheetRule, /--ml-atmoshaper-sheet-bottom-reserve:\s*var\(--ml-portal-bottom-stack-height\)/)
    assert.doesNotMatch(inactiveSheetRule, /--ml-audio-toolbar-height/)
    assert.match(activeBottomRule, /var\(--ml-portal-bottom-stack-height\)[\s\S]*?var\(--ml-audio-toolbar-height\)/)
    assert.match(topAndRailRule, /--ml-atmoshaper-sheet-bottom-reserve:\s*var\(--ml-portal-bottom-stack-height\)/)
    assert.doesNotMatch(topAndRailRule, /--ml-audio-toolbar-height/)
  })

  it("keeps the tray and transport reachable in constrained landscape", () => {
    const constrainedLandscape = styles.match(
      /@media \(orientation:\s*landscape\) and \(max-width:\s*60rem\) and \(max-height:\s*31\.25rem\) \{([\s\S]*?)\n  \}/,
    )?.[1] ?? ""

    assert.match(constrainedLandscape, /\.ml-atmoshaper-layout[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/)
    assert.match(constrainedLandscape, /\.ml-atmoshaper-current-mix-desktop[\s\S]*?display:\s*none/)
    assert.match(constrainedLandscape, /\.ml-atmoshaper-mix-tray[\s\S]*?display:\s*grid/)
    assert.match(styles, /\.ml-atmoshaper-mix-tray[\s\S]*?max-block-size/)
    assert.match(currentMix, /ml-atmoshaper-tray-transport/)
    assert.match(currentMix, /Play AtmoShaper|Pause AtmoShaper/)
    assert.match(currentMix, /Stop AtmoShaper/)
  })

  it("stacks the compact tray controls when enlarged text leaves very little inline room", () => {
    const narrowestContainer = styles.match(
      /@container \(max-width:\s*26rem\) \{([\s\S]*?)\n  \}/,
    )?.[1] ?? ""

    assert.match(narrowestContainer, /\.ml-atmoshaper-mix-tray[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/)
    assert.match(narrowestContainer, /\.ml-atmoshaper-current-mix-tray-summary[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/)
  })

  it("removes decorative motion without detecting devices, user agents, or zoom", () => {
    assert.match(styles, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.ml-atmoshaper/)
    assert.doesNotMatch(
      productionSource,
      /devicePixelRatio|visualViewport(?:\.scale)?|navigator\.userAgent|userAgentData|@media[^\n{]*zoom|\bzoom\s*:|\b(?:iPhone|iPad|Android|SmartTV)\b/,
    )
  })
})
