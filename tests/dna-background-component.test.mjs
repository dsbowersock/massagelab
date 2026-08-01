import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import { extractInterfaceBody } from "./helpers/source-structure.mjs"

const testsDirectory = path.dirname(fileURLToPath(import.meta.url))
const rootDirectory = path.resolve(testsDirectory, "..")
const componentPath = path.join(rootDirectory, "components/backgrounds/effects/massage-lab-dna-background.tsx")
const stylesheetPath = path.join(rootDirectory, "components/backgrounds/effects/massage-lab-dna-background.module.css")
const effectPropsPath = path.join(rootDirectory, "components/backgrounds/effects/css-backgrounds.tsx")

const stripSourceComments = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/.*$/gm, "")

test("the DNA renderer stays a scoped, non-interactive CSS DOM effect", () => {
  assert.equal(existsSync(componentPath), true, "the scoped DNA renderer exists")
  assert.equal(existsSync(stylesheetPath), true, "the scoped DNA stylesheet exists")

  const componentSource = readFileSync(componentPath, "utf8")
  const stylesheetSource = readFileSync(stylesheetPath, "utf8")
  const componentCode = stripSourceComments(componentSource)
  const stylesheetCode = stripSourceComments(stylesheetSource)

  assert.match(componentCode, /const renderStrandCount = Number\.isFinite\(strandCount\)[\s\S]*?Math\.min\(81, Math\.max\(0, Math\.floor\(strandCount\)\)\)[\s\S]*?: 0/)
  assert.match(componentCode, /createDnaStrandAssignments\(renderStrandCount\)/)
  assert.match(componentCode, /data-base=\{strand\.startBase\}/)
  assert.match(componentCode, /data-base=\{strand\.endBase\}/)
  assert.match(componentCode, /showBaseLetters && <span className=\{styles\.nodeLabel\}>/)
  assert.doesNotMatch(componentCode, /Array\.from\(\{ length: strandCount \}/)
  assert.match(componentCode, /resolveResponsiveBackgroundTransform/)
  assert.match(componentCode, /aria-hidden="true"/)
  assert.match(componentCode, /data-reduce-motion=\{reduceMotion \|\| undefined\}/)
  assert.match(componentCode, /className=\{styles\.root\}/)
  assert.match(componentCode, /className=\{styles\.scene\}/)
  assert.match(componentCode, /className=\{styles\.composition\}/)
  assert.match(componentCode, /className=\{styles\.strand\}/)
  assert.match(componentCode, /className=\{styles\.connector\}/)
  assert.match(componentCode, /className=\{styles\.node\}/)
  assert.doesNotMatch(componentCode, /\b(?:iframe|canvas|webgl|fetch|XMLHttpRequest|addEventListener|removeEventListener|ResizeObserver|window\.|document\.)\b/i)
  assert.doesNotMatch(componentCode, /(?:billing|account|entitlement|stripe|registry|storage)/i)
  assert.doesNotMatch(componentCode, /\b(?:button|input|select|textarea|tabIndex|onClick|onPointer|onDrag)\b/)

  assert.match(stylesheetCode, /width:\s*26vmin/)
  assert.match(stylesheetCode, /height:\s*max\(240vmin,\s*230vmax\)/)
  assert.match(stylesheetCode, /@keyframes\s+mlDnaNodeCrossover/)
  assert.match(stylesheetCode, /@keyframes\s+mlDnaConnectorCollapse/)
  assert.match(stylesheetCode, /@keyframes\s+mlDnaStrandRotate/)
  assert.match(stylesheetCode, /gap:\s*var\(--ml-dna-strand-spacing\)/)
  assert.match(stylesheetCode, /animation-direction:\s*reverse/)
  assert.match(stylesheetCode, /\.nodeLabel\s*\{[\s\S]*?font-weight:\s*800/)
  assert.match(stylesheetCode, /25%,[\s\S]*?75%[\s\S]*?scaleX\(0\)/)
  assert.match(stylesheetCode, /\[data-reduce-motion\]/)
  assert.match(stylesheetCode, /\.root \{[\s\S]*?pointer-events:\s*none;/)
  assert.match(stylesheetCode, /\.root\[data-reduce-motion\] \.composition,[\s\S]*?\.root\[data-reduce-motion\] \.node \{[\s\S]*?animation:\s*none;/)
  assert.doesNotMatch(stylesheetCode, /(?:^|\n)\s*(?:body|:root|\*)\s*(?:,|\{)/m)
  assert.doesNotMatch(stylesheetCode, /(?:@font-face|font-family|min-height|touch-action)/i)
})

test("DNA options extend the shared background effect contract", () => {
  const effectPropsSource = readFileSync(effectPropsPath, "utf8")
  const dnaOptions = extractInterfaceBody(effectPropsSource, "MassageLabDnaOptions")
  const effectProps = extractInterfaceBody(effectPropsSource, "BackgroundEffectProps")

  assert.match(dnaOptions, /strandCount: number;?[\s\S]*?showBaseLetters: boolean;?[\s\S]*?nodeRoleColors: readonly \[string, string, string, string\];?[\s\S]*?outlineColor: string;?/)
  assert.doesNotMatch(dnaOptions, /\bnodeColors\b/)
  assert.match(effectProps, /reduceMotion\?: boolean;?[\s\S]*?compactViewport\?: boolean;?[\s\S]*?massageLabDna\?: MassageLabDnaOptions;?/)
})
