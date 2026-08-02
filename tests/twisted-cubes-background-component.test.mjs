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
import {
  DEFAULT_TWISTED_CUBES_BACKGROUND_OPTIONS,
  TWISTED_CUBES_OPTION_BOUNDS,
} from "../lib/twisted-cubes-background.js"

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
  const componentCode = maskSourceComments(componentSource)
  const stylesheetCode = maskCssComments(stylesheetSource)

  assert.match(componentCode, /getTwistedCubeSourceOutline/)
  assert.match(componentCode, /interpolateTwistedCubeOutline/)
  assert.match(componentCode, /paletteMode = "source"/)
  assert.match(componentCode, /backgroundColor = TWISTED_CUBES_SOURCE_BACKGROUND_COLOR/)
  assert.match(componentCode, /outlineAnchors = TWISTED_CUBES_SOURCE_OUTLINE_ANCHORS/)
  assert.match(componentCode, /resolveResponsiveBackgroundTransform/)
  assert.match(componentCode, /aria-hidden="true"/)
  assert.match(componentCode, /data-reduce-motion=\{reduceMotion \|\| undefined\}/)
  assert.match(componentCode, /if \(!massageLabTwistedCubes\) return null/)
  const sanitizedDestructuring = /const \{([\s\S]*?)\} = sanitizeTwistedCubesBackgroundOptions\(massageLabTwistedCubes\)/.exec(componentCode)
  assert.notEqual(sanitizedDestructuring, null, "the renderer destructures sanitized Twisted Cubes options")
  for (const optionName of Object.keys(DEFAULT_TWISTED_CUBES_BACKGROUND_OPTIONS).filter((name) => name !== "layerCount")) {
    assert.match(sanitizedDestructuring[1], new RegExp(`\\b${optionName}\\b`), optionName)
  }
  assert.match(componentCode, /const \{[\s\S]*?\blayerCount\b[\s\S]*?\} = massageLabTwistedCubes/)
  assert.equal(TWISTED_CUBES_OPTION_BOUNDS.layerCount.maximum, 30)
  assert.match(componentCode, /const renderLayerCount = resolveRenderCount\([\s\S]*?layerCount,[\s\S]*?TWISTED_CUBES_OPTION_BOUNDS\.layerCount\.maximum,[\s\S]*?\)/)
  assert.match(componentCode, /const CUBE_EDGES = \[/)
  assert.match(componentCode, /CUBE_EDGES\.map\(\(\[axis, firstSide, secondSide\]\) =>/)
  assert.match(componentCode, /className=\{styles\.root\}/)
  assert.match(componentCode, /className=\{styles\.scene\}/)
  assert.match(componentCode, /className=\{styles\.layer\}/)
  assert.match(componentCode, /<span className=\{styles\.layer\}[^>]*>[\s\S]*?<span className=\{styles\.view\}>[\s\S]*?<span className=\{styles\.cube\}>[\s\S]*?<span className=\{styles\.cuboid\}>[\s\S]*?CUBE_EDGES\.map/)
  assert.match(componentCode, /"--ml-twisted-cubes-depth": `\$\{\(renderLayerCount - oneBasedIndex\) \* layerDepthSpacing\}vmin`/)
  assert.match(componentCode, /const layerSizeVmax = getTwistedCubeLayerSizeVmax\(\{[\s\S]*?oneBasedIndex,[\s\S]*?count: renderLayerCount,[\s\S]*?scale: responsiveTransform\.scale,[\s\S]*?\}\)/)
  assert.match(componentCode, /"--ml-twisted-cubes-size": `\$\{layerSizeVmax\}vmax`/)
  assert.match(componentCode, /"--ml-twisted-cubes-half-size": `\$\{layerSizeVmax \/ 2\}vmax`/)
  assert.doesNotMatch(componentCode, /--ml-twisted-cubes-viewport-extent/)
  assert.match(componentCode, /className=\{styles\.cube\}/)
  assert.match(componentCode, /className=\{styles\.cuboid\}/)
  for (const forbiddenPattern of NON_INTERACTIVE_BACKGROUND_SOURCE_PATTERNS) {
    assert.doesNotMatch(componentCode, forbiddenPattern)
  }

  assert.match(stylesheetCode, /\.root\s*\{[^}]*?pointer-events:\s*none;/)
  assert.doesNotMatch(stylesheetCode, /perspective:/)
  assert.match(stylesheetCode, /\.scene\s*\{[^}]*?width:\s*0;[^}]*?height:\s*0;/)
  assert.match(stylesheetCode, /\.view\s*\{[^}]*?transform:\s*rotateX\(var\(--ml-twisted-cubes-view-angle-x\)\) rotateY\(var\(--ml-twisted-cubes-view-angle-y\)\) translateZ\(var\(--ml-twisted-cubes-depth\)\);/)
  assert.doesNotMatch(stylesheetCode, /\.layer\s*\{[^}]*?transform:/)
  assert.match(stylesheetCode, /\.edge\s*\{[^}]*?height:\s*calc\(var\(--ml-twisted-cubes-outline-thickness\) \* 50vmin\);/)
  assert.match(stylesheetCode, /\.edge\s*\{[^}]*?background:\s*var\(--ml-twisted-cubes-outline\);/)
  assert.match(stylesheetCode, /transform-style:\s*preserve-3d/)
  assert.match(stylesheetCode, /@keyframes\s+mlTwistedCubesRotate/)
  assert.doesNotMatch(stylesheetCode, /backface-visibility/)
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
  for (const axis of ["x", "y", "z"]) {
    assert.match(stylesheetCode, new RegExp(`\\.edge\\[data-axis="${axis}"\\]`))
  }
  assert.match(stylesheetCode, /\.root\[data-reduce-motion\] \.cube \{[^}]*?animation:\s*none;/)
  assert.match(stylesheetCode, /\.root\[data-reduce-motion\] \.cube \{[^}]*?transform:\s*translate\(-50%, -50%\) rotateZ\(90deg\) rotateX\(90deg\) rotateZ\(0deg\);/)
  assert.doesNotMatch(stylesheetCode, /(?:^|\n)\s*(?:body|:root|\*)\s*(?:,|\{)/m)
  assert.doesNotMatch(stylesheetCode, /(?:@font-face|font-family|min-height|touch-action|cursor)/i)
})

test("Twisted Cubes options extend the shared background effect contract", () => {
  const effectPropsSource = readFileSync(effectPropsPath, "utf8")
  const cubesOptions = extractInterfaceBody(effectPropsSource, "MassageLabTwistedCubesOptions", "css-backgrounds.tsx")
  const effectProps = extractInterfaceBody(effectPropsSource, "BackgroundEffectProps", "css-backgrounds.tsx")

  assert.match(cubesOptions, /layerCount: number;?/)
  assert.match(cubesOptions, /paletteMode: "source" \| "resolved";?/)
  assert.match(cubesOptions, /outlineAnchors: readonly \[string, string, string, string, string, string\];?/)
  assert.match(effectProps, /reduceMotion\?: boolean;?/)
  assert.match(effectProps, /compactViewport\?: boolean;?/)
  assert.match(effectProps, /massageLabTwistedCubes\?: MassageLabTwistedCubesHostOptions;?/)
})
