import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const testsDirectory = path.dirname(fileURLToPath(import.meta.url))
const rootDirectory = path.resolve(testsDirectory, "..")
const componentPath = path.join(rootDirectory, "components/backgrounds/effects/massage-lab-twisted-cubes-background.tsx")
const stylesheetPath = path.join(rootDirectory, "components/backgrounds/effects/massage-lab-twisted-cubes-background.module.css")
const effectPropsPath = path.join(rootDirectory, "components/backgrounds/effects/css-backgrounds.tsx")

test("the Twisted Cubes renderer stays a scoped, non-interactive CSS DOM effect", () => {
  assert.equal(existsSync(componentPath), true, "the scoped Twisted Cubes renderer exists")
  assert.equal(existsSync(stylesheetPath), true, "the scoped Twisted Cubes stylesheet exists")

  const componentSource = readFileSync(componentPath, "utf8")
  const stylesheetSource = readFileSync(stylesheetPath, "utf8")

  assert.match(componentSource, /getTwistedCubeSourceOutline/)
  assert.match(componentSource, /interpolateTwistedCubeOutline/)
  assert.match(componentSource, /resolveResponsiveBackgroundTransform/)
  assert.match(componentSource, /aria-hidden="true"/)
  assert.match(componentSource, /data-reduce-motion=\{reduceMotion \|\| undefined\}/)
  assert.match(componentSource, /Math\.min\(30, Math\.max\(0, Math\.floor\(layerCount\)\)\)/)
  assert.match(componentSource, /const CUBE_FACES = \["front", "back", "right", "left", "top", "bottom"\] as const/)
  assert.match(componentSource, /CUBE_FACES\.map\(\(face\) =>/)
  assert.match(componentSource, /className=\{styles\.root\}/)
  assert.match(componentSource, /className=\{styles\.scene\}/)
  assert.match(componentSource, /className=\{styles\.layer\}/)
  assert.match(componentSource, /className=\{styles\.cube\}/)
  assert.match(componentSource, /className=\{styles\.cuboid\}/)
  assert.doesNotMatch(componentSource, /\b(?:iframe|canvas|webgl|fetch|XMLHttpRequest|addEventListener|removeEventListener|ResizeObserver|window\.|document\.)\b/i)
  assert.doesNotMatch(componentSource, /(?:billing|account|entitlement|stripe|registry|storage)/i)
  assert.doesNotMatch(componentSource, /\b(?:button|input|select|textarea|tabIndex|onClick|onPointer|onDrag|onTouch|cursor)\b/)

  assert.match(stylesheetSource, /perspective:\s*800px/)
  assert.match(stylesheetSource, /transform-style:\s*preserve-3d/)
  assert.match(stylesheetSource, /@keyframes\s+mlTwistedCubesRotate/)
  assert.match(stylesheetSource, /cubic-bezier\(0\.5, 0, 0\.5, 1\)/)
  for (const stage of ["0%", "25%", "50%", "75%", "100%"]) {
    assert.match(stylesheetSource, new RegExp(`${stage}\\s*\\{`))
  }
  assert.match(stylesheetSource, /\.front/)
  assert.match(stylesheetSource, /\.back/)
  assert.match(stylesheetSource, /\.right/)
  assert.match(stylesheetSource, /\.left/)
  assert.match(stylesheetSource, /\.top/)
  assert.match(stylesheetSource, /\.bottom/)
  assert.match(stylesheetSource, /\.root\[data-reduce-motion\] \.cube \{[\s\S]*?animation:\s*none;/)
  assert.match(stylesheetSource, /\.root\[data-reduce-motion\] \.cube \{[\s\S]*?transform:\s*rotateX\(180deg\) rotateY\(180deg\) rotateZ\(0deg\);/)
  assert.doesNotMatch(stylesheetSource, /(?:^|\n)\s*(?:body|:root|\*)\s*(?:,|\{)/m)
  assert.doesNotMatch(stylesheetSource, /(?:@font-face|font-family|min-height|touch-action|cursor)/i)
})

test("Twisted Cubes options extend the shared background effect contract", () => {
  const effectPropsSource = readFileSync(effectPropsPath, "utf8")

  assert.match(effectPropsSource, /export interface MassageLabTwistedCubesOptions \{[\s\S]*?layerCount: number;?[\s\S]*?paletteMode: "source" \| "resolved";?[\s\S]*?outlineAnchors: readonly \[string, string, string, string, string, string\];?[\s\S]*?\}/)
  assert.match(effectPropsSource, /export interface BackgroundEffectProps \{[\s\S]*?reduceMotion\?: boolean;?[\s\S]*?compactViewport\?: boolean;?[\s\S]*?massageLabTwistedCubes\?: MassageLabTwistedCubesOptions;?/)
})
