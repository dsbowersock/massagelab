import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import {
  extractInterfaceBody,
  maskCssComments,
  maskSourceComments,
  NON_INTERACTIVE_BACKGROUND_SOURCE_PATTERNS,
} from "./helpers/source-structure.mjs"
import { DNA_BASE_ROLE_INDEX, DNA_OPTION_BOUNDS } from "../lib/dna-background.js"

const testsDirectory = path.dirname(fileURLToPath(import.meta.url))
const rootDirectory = path.resolve(testsDirectory, "..")
const componentPath = path.join(rootDirectory, "components/backgrounds/effects/massage-lab-dna-background.tsx")
const stylesheetPath = path.join(rootDirectory, "components/backgrounds/effects/massage-lab-dna-background.module.css")
const effectPropsPath = path.join(rootDirectory, "components/backgrounds/effects/css-backgrounds.tsx")

test("the DNA renderer stays a scoped, non-interactive CSS DOM effect", () => {
  assert.equal(existsSync(componentPath), true, "the scoped DNA renderer exists")
  assert.equal(existsSync(stylesheetPath), true, "the scoped DNA stylesheet exists")

  const componentSource = readFileSync(componentPath, "utf8")
  const stylesheetSource = readFileSync(stylesheetPath, "utf8")
  const componentCode = maskSourceComments(componentSource)
  const stylesheetCode = maskCssComments(stylesheetSource)

  assert.equal(DNA_OPTION_BOUNDS.strandCount.maximum, 81)
  assert.deepEqual(DNA_BASE_ROLE_INDEX, { A: 0, T: 1, G: 2, C: 3 })
  assert.match(componentCode, /const renderStrandCount = resolveRenderCount\([\s\S]*?strandCount,[\s\S]*?DNA_OPTION_BOUNDS\.strandCount\.maximum,[\s\S]*?\)/)
  assert.match(componentCode, /createDnaStrandAssignments\(renderStrandCount\)/)
  assert.match(componentCode, /const \[previousStrandCount, setPreviousStrandCount\] = useState\(renderStrandCount\)[\s\S]*?if \(previousStrandCount !== renderStrandCount\) \{[\s\S]*?setStrandAssignments\(createDnaStrandAssignments\(renderStrandCount\)\)/)
  assert.doesNotMatch(componentCode, /\buse(?:Effect|Ref)\b/)
  assert.match(componentCode, /data-base=\{strand\.startBase\}/)
  assert.match(componentCode, /data-base=\{strand\.endBase\}/)
  assert.match(componentCode, /showBaseLetters && <span className=\{styles\.nodeLabel\}>/)
  assert.doesNotMatch(componentCode, /Array\.from\(\s*\{\s*length:\s*strandCount\s*\}/)
  assert.match(componentCode, /resolveResponsiveBackgroundTransform/)
  assert.match(componentCode, /aria-hidden="true"/)
  assert.match(componentCode, /data-reduce-motion=\{reduceMotion \|\| undefined\}/)
  assert.match(componentCode, /className=\{styles\.root\}/)
  assert.match(componentCode, /className=\{styles\.scene\}/)
  assert.match(componentCode, /className=\{styles\.composition\}/)
  assert.match(componentCode, /className=\{styles\.strand\}/)
  assert.match(componentCode, /className=\{styles\.connector\}/)
  assert.match(componentCode, /className=\{styles\.node\}/)
  for (const forbiddenPattern of NON_INTERACTIVE_BACKGROUND_SOURCE_PATTERNS) {
    assert.doesNotMatch(componentCode, forbiddenPattern)
  }

  assert.match(componentCode, /"--ml-dna-scene-width": `\$\{DNA_SOURCE_GEOMETRY\.widthVmin\}vmin`/)
  assert.match(componentCode, /"--ml-dna-scene-height": `max\(\$\{DNA_SOURCE_GEOMETRY\.minimumHeightVmin\}vmin, \$\{DNA_SOURCE_GEOMETRY\.viewportHeightVmax\}vmax\)`/)
  assert.match(stylesheetCode, /width:\s*var\(--ml-dna-scene-width\)/)
  assert.match(stylesheetCode, /height:\s*var\(--ml-dna-scene-height\)/)
  assert.match(stylesheetCode, /\.scene\s*\{[\s\S]*?transform-style:\s*preserve-3d/)
  assert.match(stylesheetCode, /@keyframes\s+mlDnaNodeCrossover/)
  assert.match(stylesheetCode, /@keyframes\s+mlDnaConnectorCollapse/)
  assert.match(stylesheetCode, /@keyframes\s+mlDnaStrandRotate/)
  assert.match(stylesheetCode, /gap:\s*var\(--ml-dna-strand-spacing\)/)
  assert.match(stylesheetCode, /animation-direction:\s*reverse/)
  assert.match(stylesheetCode, /\.nodeLabel\s*\{[\s\S]*?font-weight:\s*800/)
  assert.match(stylesheetCode, /\.nodeLabel\s*\{[\s\S]*?color:\s*var\(--ml-dna-outline-color\)/)
  assert.match(componentCode, /if \(!props\.massageLabDna\) return null/)
  assert.match(stylesheetCode, /25%,[\s\S]*?75%[\s\S]*?scaleX\(0\)/)
  assert.match(stylesheetCode, /\[data-reduce-motion\]/)
  assert.match(stylesheetCode, /\.root \{[\s\S]*?pointer-events:\s*none;/)
  assert.match(stylesheetCode, /\.root\[data-reduce-motion\] \.composition,[\s\S]*?\.root\[data-reduce-motion\] \.node \{[\s\S]*?animation:\s*none;/)
  assert.doesNotMatch(stylesheetCode, /(?:^|\n)\s*(?:body|:root|\*)\s*(?:,|\{)/m)
  assert.doesNotMatch(stylesheetCode, /(?:@font-face|font-family|min-height|touch-action)/i)
})

test("DNA options extend the shared background effect contract", () => {
  const effectPropsSource = readFileSync(effectPropsPath, "utf8")
  const dnaOptions = extractInterfaceBody(effectPropsSource, "MassageLabDnaOptions", "css-backgrounds.tsx")
  const effectProps = extractInterfaceBody(effectPropsSource, "BackgroundEffectProps", "css-backgrounds.tsx")

  assert.match(dnaOptions, /strandCount: number;?/)
  assert.match(dnaOptions, /showBaseLetters: boolean;?/)
  assert.match(dnaOptions, /nodeRoleColors: readonly \[string, string, string, string\];?/)
  assert.match(dnaOptions, /outlineColor: string;?/)
  assert.doesNotMatch(dnaOptions, /\bnodeColors\b/)
  assert.match(effectProps, /reduceMotion\?: boolean;?[\s\S]*?compactViewport\?: boolean;?[\s\S]*?massageLabDna\?: MassageLabDnaHostOptions;?/)
})
