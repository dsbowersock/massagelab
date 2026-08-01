import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import { extractInterfaceBody } from "./helpers/source-structure.mjs"

const testsDirectory = path.dirname(fileURLToPath(import.meta.url))
const rootDirectory = path.resolve(testsDirectory, "..")
const componentPath = path.join(rootDirectory, "components/backgrounds/effects/massage-lab-twisted-cubes-background.tsx")
const stylesheetPath = path.join(rootDirectory, "components/backgrounds/effects/massage-lab-twisted-cubes-background.module.css")
const effectPropsPath = path.join(rootDirectory, "components/backgrounds/effects/css-backgrounds.tsx")

const stripSourceComments = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/.*$/gm, "")

test("the Twisted Cubes renderer stays a scoped, non-interactive CSS DOM effect", () => {
  assert.equal(existsSync(componentPath), true, "the scoped Twisted Cubes renderer exists")
  assert.equal(existsSync(stylesheetPath), true, "the scoped Twisted Cubes stylesheet exists")

  const componentSource = readFileSync(componentPath, "utf8")
  const stylesheetSource = readFileSync(stylesheetPath, "utf8")
  const componentCode = stripSourceComments(componentSource)
  const stylesheetCode = stripSourceComments(stylesheetSource)

  assert.match(componentCode, /getTwistedCubeSourceOutline/)
  assert.match(componentCode, /interpolateTwistedCubeOutline/)
  assert.match(componentCode, /resolveResponsiveBackgroundTransform/)
  assert.match(componentCode, /aria-hidden="true"/)
  assert.match(componentCode, /data-reduce-motion=\{reduceMotion \|\| undefined\}/)
  assert.match(componentCode, /Math\.min\(30, Math\.max\(0, Math\.floor\(layerCount\)\)\)/)
  assert.match(componentCode, /const CUBE_FACES = \["front", "back", "right", "left", "top", "bottom"\] as const/)
  assert.match(componentCode, /CUBE_FACES\.map\(\(face\) =>/)
  assert.match(componentCode, /className=\{styles\.root\}/)
  assert.match(componentCode, /className=\{styles\.scene\}/)
  assert.match(componentCode, /className=\{styles\.layer\}/)
  assert.match(componentCode, /<span className=\{styles\.layer\}[^>]*>[\s\S]*?<span className=\{styles\.view\}>[\s\S]*?<span className=\{styles\.cube\}>[\s\S]*?<span className=\{styles\.cuboid\}>[\s\S]*?CUBE_FACES\.map/)
  assert.match(componentCode, /"--ml-twisted-cubes-depth": `\$\{\(renderLayerCount - oneBasedIndex\) \* layerDepthSpacing\}vmin`/)
  assert.match(componentCode, /"--ml-twisted-cubes-size": `\$\{getTwistedCubeLayerSizeVmax\(\{[\s\S]*?oneBasedIndex,[\s\S]*?count: renderLayerCount,[\s\S]*?scale: responsiveTransform\.scale,[\s\S]*?\}\)\}vmax`/)
  assert.match(componentCode, /"--ml-twisted-cubes-viewport-extent": `\$\{TWISTED_CUBES_VIEWPORT_EXTENT_VMAX\}vmax`/)
  assert.match(componentCode, /className=\{styles\.cube\}/)
  assert.match(componentCode, /className=\{styles\.cuboid\}/)
  assert.doesNotMatch(componentCode, /\b(?:iframe|canvas|webgl|fetch|XMLHttpRequest|addEventListener|removeEventListener|ResizeObserver|window\.|document\.)\b/i)
  assert.doesNotMatch(componentCode, /(?:billing|account|entitlement|stripe|registry|storage)/i)
  assert.doesNotMatch(componentCode, /\b(?:button|input|select|textarea|tabIndex|onClick|onPointer|onDrag|onTouch|cursor)\b/)

  assert.doesNotMatch(stylesheetCode, /perspective:/)
  assert.match(stylesheetCode, /width:\s*var\(--ml-twisted-cubes-viewport-extent\)/)
  assert.match(stylesheetCode, /height:\s*var\(--ml-twisted-cubes-viewport-extent\)/)
  assert.match(stylesheetCode, /\.face\s*\{[^}]*?background:\s*transparent;/)
  assert.doesNotMatch(stylesheetCode, /\.face\s*\{[^}]*?background:\s*var\(--ml-twisted-cubes-background-color\)/)
  assert.match(stylesheetCode, /transform-style:\s*preserve-3d/)
  assert.match(stylesheetCode, /@keyframes\s+mlTwistedCubesRotate/)
  assert.match(stylesheetCode, /backface-visibility:\s*hidden/)
  assert.doesNotMatch(stylesheetCode, /scale\(var\(--ml-twisted-cubes-scale\)\)/)
  assert.match(stylesheetCode, /cubic-bezier\(0\.5, 0\.1, 0\.5, 0\.9\)/)
  assert.match(
    stylesheetCode,
    /\.cube\s*\{[^}]*transform:\s*translate\(-50%, -50%\) rotateZ\(0deg\) rotateX\(0deg\) rotateZ\(0deg\);[^}]*animation:/,
  )
  assert.match(
    stylesheetCode,
    /0%\s*\{[^}]*transform:\s*translate\(-50%, -50%\) rotateZ\(0deg\) rotateX\(0deg\) rotateZ\(0deg\);/,
  )
  for (const stage of ["0%", "33%", "66%", "100%"]) {
    assert.match(stylesheetCode, new RegExp(`(?:^|\\n)\\s*${stage}\\s*\\{`))
  }
  assert.match(stylesheetCode, /\.front/)
  assert.match(stylesheetCode, /\.back/)
  assert.match(stylesheetCode, /\.right/)
  assert.match(stylesheetCode, /\.left/)
  assert.match(stylesheetCode, /\.top/)
  assert.match(stylesheetCode, /\.bottom/)
  assert.match(stylesheetCode, /\.root\[data-reduce-motion\] \.cube \{[\s\S]*?animation:\s*none;/)
  assert.match(stylesheetCode, /\.root\[data-reduce-motion\] \.cube \{[\s\S]*?transform:\s*translate\(-50%, -50%\) rotateZ\(90deg\) rotateX\(90deg\) rotateZ\(0deg\);/)
  assert.doesNotMatch(stylesheetCode, /(?:^|\n)\s*(?:body|:root|\*)\s*(?:,|\{)/m)
  assert.doesNotMatch(stylesheetCode, /(?:@font-face|font-family|min-height|touch-action|cursor)/i)
})

test("Twisted Cubes options extend the shared background effect contract", () => {
  const effectPropsSource = readFileSync(effectPropsPath, "utf8")
  const cubesOptions = extractInterfaceBody(effectPropsSource, "MassageLabTwistedCubesOptions")
  const effectProps = extractInterfaceBody(effectPropsSource, "BackgroundEffectProps")

  assert.match(cubesOptions, /layerCount: number;?/)
  assert.match(cubesOptions, /paletteMode: "source" \| "resolved";?/)
  assert.match(cubesOptions, /outlineAnchors: readonly \[string, string, string, string, string, string\];?/)
  assert.match(effectProps, /reduceMotion\?: boolean;?/)
  assert.match(effectProps, /compactViewport\?: boolean;?/)
  assert.match(effectProps, /massageLabTwistedCubes\?: MassageLabTwistedCubesOptions;?/)
})
