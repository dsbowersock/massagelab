import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
}

const library = read("components/atmoshaper/sound-library.tsx")
const brainwaveArtwork = read("components/atmoshaper/brainwave-artwork.tsx")
const noiseArtwork = read("components/atmoshaper/noise-artwork.tsx")
const currentMix = read("components/atmoshaper/current-mix.tsx")
const rail = read("components/atmoshaper/current-mix-rail.tsx")
const sortableRow = read("components/atmoshaper/sortable-layer-row.tsx")
const workspace = read("components/atmoshaper/atmoshaper-workspace.tsx")
const styles = read("app/globals.css")
const atmoStylesStart = styles.indexOf("/* AtmoShaper receives")
const atmoStyles = styles.slice(
  atmoStylesStart,
  styles.indexOf("  .ml-music-player-toolbar", atmoStylesStart),
)

describe("AtmoShaper annotated UI refinement contract", () => {
  it("gives the transparent glow-tab rail full vertical breathing room", () => {
    assert.match(atmoStyles, /\.ml-atmoshaper-library-tabs-list\s*\{[\s\S]*?margin-block:\s*0/)
    assert.match(atmoStyles, /\.ml-atmoshaper-library-tabs-list\s*\{[\s\S]*?background:\s*transparent/)
    assert.match(atmoStyles, /\.ml-atmoshaper-library-tabs-list\s*\{[\s\S]*?padding-block:\s*1\.5rem/)
    assert.match(atmoStyles, /\.ml-atmoshaper-library-tabs-list\s*\{[\s\S]*?(?:block-size|height):\s*auto\s*!important/)
    assert.match(atmoStyles, /\.ml-atmoshaper-library-tabs-list\s*\{[\s\S]*?min-block-size:\s*5rem/)
    assert.doesNotMatch(atmoStyles, /\.ml-atmoshaper-library-tabs-list\s*\{[\s\S]*?margin-block:\s*-1\.5rem/)
    assert.match(
      atmoStyles,
      /@container \(min-width:\s*54rem\)[\s\S]*?\.ml-atmoshaper-library-tabs-list,?[\s\S]*?overflow:\s*visible/,
    )
  })

  it("keeps preview controls inside the matching card instead of shifting the library", () => {
    assert.match(library, /ml-atmoshaper-card-preview-controls/)
    assert.match(library, /ml-atmoshaper-card-preview-status/)
    assert.match(library, /Retry preview for \$\{sourceName\}/)
    assert.match(library, /data-preview-active=/)
    assert.doesNotMatch(library, /<PreviewingStrip\s*\/>/)
    assert.doesNotMatch(library, /ml-atmoshaper-preview-strip/)
    assert.doesNotMatch(atmoStyles, /\.ml-atmoshaper-preview-strip/)
    assert.match(atmoStyles, /\.ml-atmoshaper-library-card-actions\s*\{[\s\S]*?min-block-size:/)
    assert.match(atmoStyles, /\.ml-atmoshaper-card-preview-status\s*\{[\s\S]*?text-overflow:\s*ellipsis/)
  })

  it("uses brainwave artwork as a faded backdrop behind flat controls", () => {
    assert.match(library, /ml-atmoshaper-brainwave-panel/)
    assert.match(library, /ml-atmoshaper-brainwave-backdrop[\s\S]*?<BrainwaveArtwork/)
    assert.match(library, /ml-atmoshaper-brainwave-content/)
    assert.doesNotMatch(library, /ml-atmoshaper-library-card ml-atmoshaper-brainwave-card/)
    assert.match(atmoStyles, /\.ml-atmoshaper-brainwave-panel\s*\{[\s\S]*?position:\s*relative/)
    assert.match(atmoStyles, /\.ml-atmoshaper-brainwave-backdrop\s*\{[\s\S]*?position:\s*absolute[\s\S]*?opacity:\s*0\.[123]/)
    assert.match(atmoStyles, /\.ml-atmoshaper-brainwave-panel\s*\{[\s\S]*?border:\s*0/)
    assert.match(library, /data-brainwave-kind=\{kind\}/)
    assert.match(
      atmoStyles,
      /\.ml-atmoshaper-brainwave-panel\[data-brainwave-kind="isochronic"\]\s*\{[\s\S]*?max-width:\s*none[\s\S]*?min-block-size:/,
    )
    assert.doesNotMatch(
      atmoStyles,
      /\.ml-atmoshaper-brainwave-panel\[data-brainwave-kind="binaural"\]\s*\{[\s\S]*?max-width:\s*none/,
    )
    assert.match(atmoStyles, /\.ml-atmoshaper-advanced-controls\s*\{[\s\S]*?border-top:\s*0/)
    assert.match(library, /className="ml-atmoshaper-library-tabs-root mt-4 min-w-0"/)
    assert.match(library, /data-active-library-tab=\{activeTab\}/)
    assert.match(
      library,
      /activeTab === "isochronic" \|\| activeTab === "binaural"[\s\S]*?ml-atmoshaper-library-brainwave-canvas[\s\S]*?<BrainwaveArtwork kind=\{activeTab\}/,
    )
    assert.match(
      atmoStyles,
      /\.ml-atmoshaper-library-brainwave-canvas\s*\{[\s\S]*?position:\s*absolute[\s\S]*?inset-block:\s*-1\.5rem[\s\S]*?inset-inline-start:\s*50%[\s\S]*?width:\s*120%[\s\S]*?transform:\s*translateX\(-50%\)/,
    )
    assert.match(
      atmoStyles,
      /\.ml-atmoshaper-library\s*\{[\s\S]*?overflow-x:\s*hidden/,
    )
    assert.match(
      atmoStyles,
      /\.ml-atmoshaper-brainwave-panel\[data-brainwave-kind="isochronic"\][\s\S]*?\.ml-atmoshaper-brainwave-backdrop,[\s\S]*?\.ml-atmoshaper-brainwave-panel\[data-brainwave-kind="binaural"\][\s\S]*?\.ml-atmoshaper-brainwave-backdrop\s*\{[\s\S]*?display:\s*none/,
    )
    assert.doesNotMatch(brainwaveArtwork, /<linearGradient/)
    assert.doesNotMatch(brainwaveArtwork, /<rect/)
    assert.doesNotMatch(brainwaveArtwork, /d="M24 110 H496"/)
    assert.match(brainwaveArtwork, /data-wave-channel="left"/)
    assert.match(brainwaveArtwork, /data-pulse-envelope="true"/)
    assert.match(
      atmoStyles,
      /\.ml-atmoshaper-library-brainwave-canvas\s*\{[\s\S]*?background:[\s\S]*?radial-gradient[\s\S]*?-webkit-mask-image:[\s\S]*?radial-gradient[\s\S]*?mask-image:[\s\S]*?radial-gradient/,
    )
    assert.doesNotMatch(
      atmoStyles,
      /\.ml-atmoshaper-library-brainwave-canvas\s*\{[^}]*border-radius:/,
    )
  })

  it("lets roomy brainwave preset glows paint beyond their scrolling rail", () => {
    assert.match(atmoStyles, /\.ml-atmoshaper-preset-buttons\s*\{[\s\S]*?margin:\s*0/)
    assert.match(atmoStyles, /\.ml-atmoshaper-preset-buttons\s*\{[\s\S]*?padding-block:\s*0\.75rem/)
    assert.match(atmoStyles, /\.ml-atmoshaper-preset-buttons\s*\{[\s\S]*?padding-inline:\s*0\.25rem/)
    assert.match(
      atmoStyles,
      /@container \(min-width:\s*54rem\)[\s\S]*?\.ml-atmoshaper-preset-buttons\s*\{[\s\S]*?overflow:\s*visible/,
    )
  })

  it("tones down white noise and uses finer brown noise texture", () => {
    assert.doesNotMatch(noiseArtwork, /white:\s*\{[^}]*tint:\s*"#ffffff"/)
    assert.match(noiseArtwork, /white:\s*\{[^}]*base:\s*"#777a76"/)
    assert.match(noiseArtwork, /white:\s*\{[^}]*tint:\s*"#b9bab5"/)
    assert.match(noiseArtwork, /white:\s*\{[^}]*shadow:\s*"#2f322f"/)
    assert.match(noiseArtwork, /white:\s*\{[^}]*wave:\s*"#f2f1ec"/)
    assert.match(noiseArtwork, /white:\s*\{[^}]*textureOpacity:\s*"0\.92"/)
    assert.match(noiseArtwork, /pink:\s*\{[^}]*base:\s*"#4a2730"[^}]*tint:\s*"#f2a0b8"[^}]*shadow:\s*"#1f1017"/)
    assert.match(noiseArtwork, /brown:\s*\{[^}]*base:\s*"#3a2318"[^}]*tint:\s*"#c47c49"[^}]*shadow:\s*"#150d08"/)
    assert.match(noiseArtwork, /brown:\s*\{[^}]*frequency:\s*"0\.58"/)
    assert.match(noiseArtwork, /baseFrequency=\{palette\.frequency\}/)
    assert.match(noiseArtwork, /opacity=\{palette\.textureOpacity\}/)
    assert.match(noiseArtwork, /stroke=\{palette\.wave\}/)
  })

  it("aligns Remove and the drag handle in the layer heading and Mute beside volume", () => {
    assert.match(sortableRow, /children\(reorderHandle\)/)
    assert.match(currentMix, /ml-atmoshaper-layer-header-actions/)
    assert.match(
      currentMix,
      /ml-atmoshaper-layer-header-actions[\s\S]*?Remove[\s\S]*?reorderHandle/,
    )
    assert.match(currentMix, /ml-atmoshaper-layer-volume-row[\s\S]*?Volume for[\s\S]*?Mute/)
    assert.doesNotMatch(sortableRow, /ml-atmoshaper-layer-reorder/)
  })

  it("renders one square labeled rail tile with centered Mute and Solo actions", () => {
    assert.match(currentMix, /ml-atmoshaper-layer-name/)
    assert.match(currentMix, /aria-label=\{`\$\{isSoloed \? "Unsolo" : "Solo"\} \$\{sourceName\}`\}/)
    assert.match(currentMix, /aria-pressed=\{isSoloed\}/)
    assert.match(currentMix, /<AudioLines aria-hidden="true"/)
    assert.match(currentMix, /aria-label=\{`\$\{layer\.muted \? "Unmute" : "Mute"\} \$\{sourceName\}`\}/)
    assert.match(
      atmoStyles,
      /\.ml-atmoshaper-current-mix\[data-expanded="false"\] \.ml-atmoshaper-layer-row\s*\{[\s\S]*?block-size:\s*calc\(var\(--ml-atmoshaper-fixed-rail-width\) - 0\.9rem\)/,
    )
    assert.match(atmoStyles, /\.ml-atmoshaper-current-mix\[data-expanded="false"\] \.ml-atmoshaper-layer-volume-row\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/)
    assert.match(
      atmoStyles,
      /\.ml-atmoshaper-current-mix\[data-expanded="false"\] \.ml-atmoshaper-layer-volume-row > button\s*\{[\s\S]*?display:\s*grid[\s\S]*?place-items:\s*center[\s\S]*?border-radius:\s*0\.4rem/,
    )
  })

  it("expands the one edge rail in place instead of rendering a second control strip", () => {
    assert.match(workspace, /<CurrentMixRail[\s\S]*?expanded=\{mixDrawerOpen\}/)
    assert.doesNotMatch(workspace, /!mixDrawerOpen\s*\?\s*\(\s*<CurrentMixRail/)
    assert.equal(workspace.match(/<Sheet\s/g)?.length ?? 0, 0)
    assert.match(rail, /data-expanded=\{expanded\}/)
    assert.match(rail, /<CurrentMix[\s\S]*?expanded=\{expanded\}/)
    assert.match(currentMix, /ml-atmoshaper-rail-master-volume/)
    assert.match(currentMix, /Open whole mix volume controls/)
    assert.match(currentMix, /ml-atmoshaper-expanded-mix-transport/)
    assert.match(currentMix, /ml-atmoshaper-expanded-master-volume/)
    assert.match(currentMix, /ml-atmoshaper-expanded-layers/)
    assert.match(currentMix, /aria-label=\{`\$\{isSoloed \? "Unsolo" : "Solo"\} \$\{sourceName\}`\}/)
    assert.match(
      atmoStyles,
      /\.ml-atmoshaper-current-mix-rail\s*\{[\s\S]*?width:\s*var\(--ml-atmoshaper-fixed-rail-width\)[\s\S]*?inline-size 240ms/,
    )
    assert.match(
      atmoStyles,
      /\.ml-atmoshaper-current-mix-rail\[data-expanded="true"\][\s\S]*?background:/,
    )
    assert.match(
      atmoStyles,
      /\.ml-atmoshaper-master-volume-slot > \*\s*\{[\s\S]*?width:\s*100%[\s\S]*?min-width:\s*0[\s\S]*?max-width:\s*100%[\s\S]*?box-sizing:\s*border-box/,
    )
    assert.match(
      atmoStyles,
      /\.ml-atmoshaper-expanded-master-volume\s*\{[\s\S]*?border:\s*1px solid[\s\S]*?border-radius:/,
    )
  })

  it("uses one Play or Stop toggle and visibly labels the whole-mix volume", () => {
    assert.match(currentMix, /function AtmoShaperTransportButton/)
    assert.doesNotMatch(currentMix, /function AtmoShaperTransportButtons/)
    assert.match(currentMix, /Whole mix volume/)
    assert.match(currentMix, /transport\.shouldStop \? "Stop AtmoShaper" : "Play AtmoShaper"/)
    assert.match(currentMix, /variant=\{transport\.shouldStop \? "destructive" : "success"\}/)
    assert.doesNotMatch(rail, /Pause AtmoShaper/)
  })

  it("lets an outside interaction collapse the roomy drawer", () => {
    assert.match(workspace, /document\.addEventListener\("pointerdown", handlePointerDown, true\)/)
    assert.match(workspace, /currentMixPanelRef\.current\?\.contains\(target\)/)
    assert.match(workspace, /closeDrawer\(false\)/)
  })
})
