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

test("the DNA renderer stays a scoped, non-interactive CSS DOM effect", () => {
  assert.equal(existsSync(componentPath), true, "the scoped DNA renderer exists")
  assert.equal(existsSync(stylesheetPath), true, "the scoped DNA stylesheet exists")

  const componentSource = readFileSync(componentPath, "utf8")
  const stylesheetSource = readFileSync(stylesheetPath, "utf8")

  assert.match(componentSource, /createDnaNodeRoleAssignments\(strandCount \* 2\)/)
  assert.match(componentSource, /resolveResponsiveBackgroundTransform/)
  assert.match(componentSource, /aria-hidden="true"/)
  assert.match(componentSource, /data-reduce-motion=\{reduceMotion \|\| undefined\}/)
  assert.match(componentSource, /className=\{styles\.root\}/)
  assert.match(componentSource, /className=\{styles\.scene\}/)
  assert.match(componentSource, /className=\{styles\.strand\}/)
  assert.match(componentSource, /className=\{styles\.connector\}/)
  assert.match(componentSource, /className=\{styles\.node\}/)
  assert.doesNotMatch(componentSource, /\b(?:iframe|canvas|webgl|fetch|XMLHttpRequest|addEventListener|removeEventListener|ResizeObserver|window\.|document\.)\b/i)
  assert.doesNotMatch(componentSource, /(?:billing|account|entitlement|stripe|registry|storage)/i)
  assert.doesNotMatch(componentSource, /\b(?:button|input|select|textarea|tabIndex|onClick|onPointer|onDrag)\b/)

  assert.match(stylesheetSource, /height:\s*65vmin/)
  assert.match(stylesheetSource, /aspect-ratio:\s*2\s*\/\s*5/)
  assert.match(stylesheetSource, /@keyframes\s+mlDnaNodeCrossover/)
  assert.match(stylesheetSource, /@keyframes\s+mlDnaConnectorCollapse/)
  assert.match(stylesheetSource, /@keyframes\s+mlDnaStrandRotate/)
  assert.match(stylesheetSource, /\[data-reduce-motion\]/)
  assert.doesNotMatch(stylesheetSource, /(?:^|[\s,])(?:body|:root|\*)(?:\s|\{|,|$)/m)
  assert.doesNotMatch(stylesheetSource, /(?:@font-face|font-family|min-height|touch-action)/i)
})

test("DNA options extend the shared background effect contract", () => {
  const effectPropsSource = readFileSync(effectPropsPath, "utf8")

  assert.match(effectPropsSource, /export interface MassageLabDnaOptions \{[\s\S]*?strandCount: number;?[\s\S]*?nodeColors: readonly \[string, string, string, string\];?[\s\S]*?outlineColor: string;?[\s\S]*?\}/)
  assert.match(effectPropsSource, /export interface BackgroundEffectProps \{[\s\S]*?reduceMotion\?: boolean;?[\s\S]*?compactViewport\?: boolean;?[\s\S]*?massageLabDna\?: MassageLabDnaOptions;?/)
})
