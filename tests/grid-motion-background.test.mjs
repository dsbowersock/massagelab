import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

const rendererSource = await readFile(
  new URL("../components/backgrounds/effects/massage-lab-grid-motion-background.tsx", import.meta.url),
  "utf8",
)
const stylesSource = await readFile(
  new URL("../components/backgrounds/BackgroundHost.module.css", import.meta.url),
  "utf8",
)

function loadRowCountHelper() {
  const match = rendererSource.match(
    /export function resolveGridMotionRowCount\(height: number\): number \{([\s\S]*?)\n\}/,
  )
  assert.ok(match, "Grid Motion exports its row-count helper")
  return Function("height", match[1])
}

describe("Grid Motion responsive autonomous renderer", () => {
  it("derives 6-14 rows from the measured height", () => {
    const resolveGridMotionRowCount = loadRowCountHelper()

    assert.equal(resolveGridMotionRowCount(390), 7)
    assert.equal(resolveGridMotionRowCount(844), 13)
    assert.equal(resolveGridMotionRowCount(1200), 14)
    assert.match(
      rendererSource,
      /Math\.min\(14, Math\.max\(6, Math\.ceil\(height \/ 76\) \+ 1\)\)/,
    )
  })

  it("observes the host height while preserving surviving row offsets", () => {
    assert.match(rendererSource, /useState\(6\)/)
    assert.match(rendererSource, /new ResizeObserver/)
    assert.match(rendererSource, /entry\.contentRect\.height/)
    assert.match(rendererSource, /observer\.disconnect\(\)/)
    assert.match(
      rendererSource,
      /Array\.from\([\s\S]*?\{ length: nextRowCount \},[\s\S]*?currentOffsetsRef\.current\[index\] \?\? 0/,
    )
  })

  it("renders normalized repeating mantras in exactly seven stable-keyed tiles per row", () => {
    assert.match(rendererSource, /normalizeGridMotionMantras\(options\?\.mantras\)/)
    assert.match(rendererSource, /Array\.from\(\{ length: rowCount \}\)/)
    assert.match(rendererSource, /Array\.from\(\{ length: 7 \}\)/)
    assert.match(
      rendererSource,
      /mantras\[\(rowIndex \* 7 \+ itemIndex\) % mantras\.length\]/,
    )
    assert.match(rendererSource, /key=\{`\$\{rowIndex\}-\$\{itemIndex\}-\$\{text\}`\}/)
    assert.doesNotMatch(rendererSource, /DEFAULT_ITEMS/)
  })

  it("adds optional pointer influence to timestamp-derived ambient sine motion", () => {
    assert.match(rendererSource, /const updateMotion = \(timestamp: number\)/)
    assert.match(rendererSource, /const elapsedSeconds = animate[\s\S]*?\(timestamp - startTimestamp\) \/ 1_000[\s\S]*?: 0/)
    assert.match(rendererSource, /const ambientPhase = elapsedSeconds \* 0\.32 \+ index \* 0\.58/)
    assert.match(
      rendererSource,
      /const ambientTarget = Math\.sin\(ambientPhase\) \* options\.maxMoveAmount \* 0\.34 \* direction/,
    )
    assert.match(
      rendererSource,
      /const pointerTarget = options\.cursorInteraction[\s\S]*?\* options\.maxMoveAmount \* 0\.66 \* direction[\s\S]*?: 0/,
    )
    assert.match(rendererSource, /const target = ambientTarget \+ pointerTarget/)
    assert.match(rendererSource, /currentOffsetsRef\.current\[index\] = target/)
    assert.match(rendererSource, /allowCompactViewport:\s*true/)
    assert.match(rendererSource, /respectSystemReducedMotion:\s*true/)
    assert.match(rendererSource, /if \(options\.cursorInteraction\) \{[\s\S]*?addEventListener\("pointermove"/)
  })

  it("uses row-governed sizing and overfills the rotated portrait layer", () => {
    const containerBlock = stylesSource.match(/\.massageLabGridMotionContainer \{[\s\S]*?\n\}/)?.[0]
    const rowBlock = stylesSource.match(/\.massageLabGridMotionRow \{[\s\S]*?\n\}/)?.[0]
    const itemBlock = stylesSource.match(/\.massageLabGridMotionItem \{[\s\S]*?\n\}/)?.[0]

    assert.ok(containerBlock)
    assert.match(containerBlock, /min-height:\s*112%/)
    assert.match(containerBlock, /height:\s*auto/)
    assert.match(containerBlock, /gap:\s*clamp\(0\.45rem, 1\.2vw, 1rem\)/)
    assert.doesNotMatch(containerBlock, /height:\s*min\(92vh, 960px\)/)
    assert.ok(rowBlock)
    assert.match(rowBlock, /grid-template-columns:\s*repeat\(7,/)
    assert.match(rowBlock, /grid-auto-rows:\s*clamp\(3\.4rem, 7\.2vh, 5\.8rem\)/)
    assert.match(rowBlock, /gap:\s*clamp\(0\.45rem, 1\.2vw, 1rem\)/)
    assert.ok(itemBlock)
    assert.doesNotMatch(itemBlock, /aspect-ratio/)
  })
})
