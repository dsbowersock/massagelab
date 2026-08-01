import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

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

  assert.match(componentSource, /const renderStrandCount = Number\.isFinite\(strandCount\)[\s\S]*?Math\.min\(81, Math\.max\(0, Math\.floor\(strandCount\)\)\)[\s\S]*?: 0/)
  assert.match(componentSource, /createDnaNodeRoleAssignments\(renderStrandCount \* 2\)/)
  assert.doesNotMatch(componentSource, /Array\.from\(\{ length: strandCount \}/)
  assert.match(componentSource, /resolveResponsiveBackgroundTransform/)
  assert.match(componentSource, /aria-hidden="true"/)
  assert.match(componentSource, /data-reduce-motion=\{reduceMotion \|\| undefined\}/)
  assert.match(componentSource, /className=\{styles\.root\}/)
  assert.match(componentSource, /className=\{styles\.scene\}/)
  assert.match(componentSource, /className=\{styles\.composition\}/)
  assert.match(componentSource, /className=\{styles\.strand\}/)
  assert.match(componentSource, /className=\{styles\.connector\}/)
  assert.match(componentSource, /className=\{styles\.node\}/)
  assert.doesNotMatch(componentCode, /\b(?:iframe|canvas|webgl|fetch|XMLHttpRequest|addEventListener|removeEventListener|ResizeObserver|window\.|document\.)\b/i)
  assert.doesNotMatch(componentCode, /(?:billing|account|entitlement|stripe|registry|storage)/i)
  assert.doesNotMatch(componentCode, /\b(?:button|input|select|textarea|tabIndex|onClick|onPointer|onDrag)\b/)

  assert.match(stylesheetSource, /width:\s*26vmin/)
  assert.match(stylesheetSource, /height:\s*max\(120vmin,\s*115vmax\)/)
  assert.match(stylesheetSource, /@keyframes\s+mlDnaNodeCrossover/)
  assert.match(stylesheetSource, /@keyframes\s+mlDnaConnectorCollapse/)
  assert.match(stylesheetSource, /@keyframes\s+mlDnaStrandRotate/)
  assert.match(stylesheetSource, /gap:\s*var\(--ml-dna-strand-spacing\)/)
  assert.match(stylesheetSource, /animation-direction:\s*reverse/)
  assert.match(stylesheetSource, /25%,[\s\S]*?75%[\s\S]*?scaleX\(0\)/)
  assert.match(stylesheetSource, /\[data-reduce-motion\]/)
  assert.match(stylesheetSource, /\.root \{[\s\S]*?pointer-events:\s*none;/)
  assert.match(stylesheetSource, /\.root\[data-reduce-motion\] \.composition,[\s\S]*?\.root\[data-reduce-motion\] \.node \{[\s\S]*?animation:\s*none;/)
  assert.doesNotMatch(stylesheetSource, /(?:^|\n)\s*(?:body|:root|\*)\s*(?:,|\{)/m)
  assert.doesNotMatch(stylesheetCode, /(?:@font-face|font-family|min-height|touch-action)/i)
})

test("DNA options extend the shared background effect contract", () => {
  const effectPropsSource = readFileSync(effectPropsPath, "utf8")

  assert.match(effectPropsSource, /export interface MassageLabDnaOptions \{[\s\S]*?strandCount: number;?[\s\S]*?nodeRoleColors: readonly \[string, string, string, string\];?[\s\S]*?outlineColor: string;?[\s\S]*?\}/)
  assert.doesNotMatch(effectPropsSource, /\bnodeColors\b/)
  assert.match(effectPropsSource, /export interface BackgroundEffectProps \{[\s\S]*?reduceMotion\?: boolean;?[\s\S]*?compactViewport\?: boolean;?[\s\S]*?massageLabDna\?: MassageLabDnaOptions;?/)
})
