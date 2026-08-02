"use client"

import { memo, type CSSProperties } from "react"
import {
  getTwistedCubeAlpha,
  getTwistedCubeCycleSeconds,
  getTwistedCubeDelaySeconds,
  getTwistedCubeLayerSizeVmax,
  getTwistedCubeSourceOutline,
  interpolateTwistedCubeOutline,
  sanitizeTwistedCubesBackgroundOptions,
  TWISTED_CUBES_OPTION_BOUNDS,
  TWISTED_CUBES_SOURCE_BACKGROUND_COLOR,
  TWISTED_CUBES_SOURCE_OUTLINE_ANCHORS,
} from "@/lib/twisted-cubes-background"
import {
  resolveRenderCount,
  resolveResponsiveBackgroundTransform,
} from "@/lib/background-effect-layout"
import type { BackgroundEffectProps, MassageLabTwistedCubesOptions } from "./css-backgrounds"
import styles from "./massage-lab-twisted-cubes-background.module.css"

type MassageLabTwistedCubesBackgroundProps = Pick<BackgroundEffectProps, "reduceMotion" | "compactViewport"> & {
  massageLabTwistedCubes?: MassageLabTwistedCubesOptions
}

const CUBE_EDGES = [
  ["x", "negative", "negative"],
  ["x", "negative", "positive"],
  ["x", "positive", "negative"],
  ["x", "positive", "positive"],
  ["y", "negative", "negative"],
  ["y", "negative", "positive"],
  ["y", "positive", "negative"],
  ["y", "positive", "positive"],
  ["z", "negative", "negative"],
  ["z", "negative", "positive"],
  ["z", "positive", "negative"],
  ["z", "positive", "positive"],
] as const

/**
 * Draws each cuboid from twelve thin edges instead of six viewport-sized
 * transparent faces. The wireframe retains every cube-layer line throughout
 * rotation while avoiding the oversized raster surfaces that can overwhelm a
 * mobile GPU. Layer count remains defensively bounded before React allocates
 * DOM nodes; color, fade, phase, and depth are presentation-only values.
 */
export const MassageLabTwistedCubesBackground = memo(function MassageLabTwistedCubesBackground({
  massageLabTwistedCubes,
  reduceMotion = false,
  compactViewport = false,
}: MassageLabTwistedCubesBackgroundProps) {
  // This wrapper currently calls no React hooks, so the absent-options guard
  // is safe before renderer calculations. Split a hooked renderer if that changes.
  if (!massageLabTwistedCubes) return null
  const {
    layerCount,
    paletteMode = "source",
    backgroundColor = TWISTED_CUBES_SOURCE_BACKGROUND_COLOR,
    outlineAnchors = TWISTED_CUBES_SOURCE_OUTLINE_ANCHORS,
  } = massageLabTwistedCubes
  const {
    rotationSpeed,
    layerStagger,
    viewAngleX,
    viewAngleY,
    scale,
    positionX,
    positionY,
    layerDepthSpacing,
    opacityFalloff,
    outlineThickness,
  } = sanitizeTwistedCubesBackgroundOptions(massageLabTwistedCubes)
  // Persisted options enforce the product minimum; malformed direct host input
  // fails closed to inert DOM instead of fabricating the minimum render load.
  const renderLayerCount = resolveRenderCount(
    layerCount,
    TWISTED_CUBES_OPTION_BOUNDS.layerCount.maximum,
  )
  const responsiveTransform = resolveResponsiveBackgroundTransform({
    scale,
    positionX,
    positionY,
    compactViewport,
  })
  const rootStyle = {
    "--ml-twisted-cubes-background-color": backgroundColor,
    "--ml-twisted-cubes-cycle": `${getTwistedCubeCycleSeconds(rotationSpeed)}s`,
    "--ml-twisted-cubes-view-angle-x": `${viewAngleX}deg`,
    "--ml-twisted-cubes-view-angle-y": `${viewAngleY}deg`,
  } as CSSProperties
  const sceneStyle = {
    "--ml-twisted-cubes-position-x": `${responsiveTransform.positionX}vw`,
    "--ml-twisted-cubes-position-y": `${responsiveTransform.positionY}vh`,
  } as CSSProperties
  const layers = Array.from({ length: renderLayerCount }, (_, index) => {
    const oneBasedIndex = index + 1
    const layerSizeVmax = getTwistedCubeLayerSizeVmax({
      oneBasedIndex,
      count: renderLayerCount,
      scale: responsiveTransform.scale,
    })
    const outline = paletteMode === "source"
      ? getTwistedCubeSourceOutline({ oneBasedIndex, count: renderLayerCount })
      : interpolateTwistedCubeOutline({ anchors: outlineAnchors, oneBasedIndex, count: renderLayerCount })

    return {
      index,
      style: {
        "--ml-twisted-cubes-outline": outline,
        "--ml-twisted-cubes-alpha": getTwistedCubeAlpha({
          oneBasedIndex,
          count: renderLayerCount,
          opacityFalloff,
        }),
        "--ml-twisted-cubes-delay": `${getTwistedCubeDelaySeconds({
          oneBasedIndex,
          count: renderLayerCount,
          stagger: layerStagger,
        })}s`,
        "--ml-twisted-cubes-depth": `${(renderLayerCount - oneBasedIndex) * layerDepthSpacing}vmin`,
        "--ml-twisted-cubes-size": `${layerSizeVmax}vmax`,
        "--ml-twisted-cubes-half-size": `${layerSizeVmax / 2}vmax`,
        "--ml-twisted-cubes-outline-thickness": outlineThickness,
        zIndex: renderLayerCount - oneBasedIndex,
      } as CSSProperties,
    }
  })

  return (
    <div
      className={styles.root}
      style={rootStyle}
      data-reduce-motion={reduceMotion || undefined}
      aria-hidden="true"
    >
      <div className={styles.scene} style={sceneStyle}>
        {layers.map((layer) => (
          <span className={styles.layer} style={layer.style} key={layer.index}>
            <span className={styles.view}>
              <span className={styles.cube}>
                <span className={styles.cuboid}>
                  {CUBE_EDGES.map(([axis, firstSide, secondSide]) => (
                    <span
                      className={styles.edge}
                      data-axis={axis}
                      data-first-side={firstSide}
                      data-second-side={secondSide}
                      key={`${axis}-${firstSide}-${secondSide}`}
                    />
                  ))}
                </span>
              </span>
            </span>
          </span>
        ))}
      </div>
    </div>
  )
})
