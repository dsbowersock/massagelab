import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { normalizeGridMotionMantra } from "../lib/grid-motion-mantras.js"

const editorSource = await readFile(
  new URL("../app/chimer/grid-motion-mantra-editor.tsx", import.meta.url),
  "utf8",
)
const editorStylesSource = await readFile(
  new URL("../app/chimer/grid-motion-mantra-editor.module.css", import.meta.url),
  "utf8",
)
const setupSource = await readFile(
  new URL("../app/chimer/set-timer.tsx", import.meta.url),
  "utf8",
)
const runningSource = await readFile(
  new URL("../app/chimer/running-timer.tsx", import.meta.url),
  "utf8",
)

test("shared editor exposes the approved accessible controls and limits", () => {
  assert.match(editorSource, /GridMotionMantraEditor/)
  assert.match(editorSource, />Mantras</)
  assert.match(
    editorSource,
    /Up to 10 phrases\. Each can use 3 words and 28 characters\./,
  )
  assert.match(editorSource, />Add mantra</)
  assert.match(editorSource, />Remove mantra</)
  assert.match(editorSource, /aria-label=\{`Mantra \$\{index \+ 1\}`\}/)
  assert.match(
    editorSource,
    /aria-label=\{`Remove mantra \$\{index \+ 1\}: \$\{mantra\}`\}/,
  )
  assert.match(editorSource, /disabled=\{value\.length >= GRID_MOTION_MANTRA_LIMIT\}/)
  assert.match(editorSource, /disabled=\{value\.length === 1\}/)
})

test("astral drafts can reach 28 Unicode code points without native preemption", () => {
  const twentyEightAstralCharacters = "🪷".repeat(28)

  assert.equal(normalizeGridMotionMantra(twentyEightAstralCharacters), twentyEightAstralCharacters)
  assert.equal(Array.from(twentyEightAstralCharacters).length, 28)
  assert.match(
    editorSource,
    /Array\.from\(value\)[\s\S]*?\.slice\(0, GRID_MOTION_MANTRA_CHARACTER_LIMIT\)/,
  )
  assert.doesNotMatch(editorSource, /\bmaxLength=/)
})

test("focused drafts preserve typable spaces without publishing blank values", () => {
  assert.match(editorSource, /const \[drafts, setDrafts\] = useState/)
  assert.match(editorSource, /focusedIndexRef/)
  assert.match(editorSource, /limitGridMotionMantraDraft\(event\.target\.value\)/)
  assert.match(editorSource, /setDraftAtIndex\(index, nextDraft\)/)
  assert.match(editorSource, /const normalized = normalizeGridMotionMantra\(nextDraft\)/)
  assert.match(editorSource, /if \(normalized\)/)
  assert.match(editorSource, /onBlur=\{\(\) => settleDraft\(index\)\}/)
  assert.match(editorSource, /normalizeGridMotionMantra\(drafts\[index\]\)/)
  assert.match(editorSource, /normalized \|\| value\[index\]/)
  assert.match(editorSource, /className=\{styles\.row\} key=\{index\}/)
  assert.doesNotMatch(editorSource, /value=\{value\[index\]\}/)
})

test("Add uses the shared nonduplicate mantra seed", () => {
  assert.match(
    editorSource,
    /getGridMotionMantraAddSeed/,
  )
  assert.match(
    editorSource,
    /const seed = getGridMotionMantraAddSeed\(value\)/,
  )
  assert.match(editorSource, /const next = \[\.\.\.value, seed\]/)
  assert.doesNotMatch(editorSource, /const next = \[\.\.\.value, "I am calm"\]/)
})

test("setup and running Visual controls reuse the same editor", () => {
  for (const source of [setupSource, runningSource]) {
    assert.match(
      source,
      /import \{ GridMotionMantraEditor \} from "\.\/grid-motion-mantra-editor"/,
    )
    assert.match(source, /<GridMotionMantraEditor/)
  }

  assert.match(
    setupSource,
    /value=\{settings\.massageLabGridMotionMantras\}/,
  )
  assert.match(
    runningSource,
    /value=\{massageLabGridMotionMantras\}/,
  )
})

test("editor layout contains every row and input within phone panels", () => {
  assert.match(editorStylesSource, /\.editor[\s\S]*min-width:\s*0/)
  assert.match(editorStylesSource, /\.row[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) auto/)
  assert.match(editorStylesSource, /\.input[\s\S]*width:\s*100%/)
  assert.match(editorStylesSource, /\.input[\s\S]*min-width:\s*0/)
})
