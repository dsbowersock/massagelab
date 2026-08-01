"use client"

import { memo, type CSSProperties } from "react"
import {
  getTwistedCubeAlpha,
  getTwistedCubeCycleSeconds,
  getTwistedCubeDelaySeconds,
  getTwistedCubeLayerSizeVmax,
  getTwistedCubeSourceOutline,
  interpolateTwistedCubeOutline,
  TWISTED_CUBES_OPTION_BOUNDS,
  TWISTED_CUBES_VIEWPORT_EXTENT_VMAX,
} from "@/lib/twisted-cubes-background"
import { resolveResponsiveBackgroundTransform } from "@/lib/background-effect-layout"
import type { BackgroundEffectProps, MassageLabTwistedCubesOptions } from "./css-backgrounds"
import styles from "./massage-lab-twisted-cubes-background.module.css"

type MassageLabTwistedCubesBackgroundProps = Pick<BackgroundEffectProps, "reduceMotion" | "compactViewport"> & {
  massageLabTwistedCubes: MassageLabTwistedCubesOptions
}

const CUBE_FACES = ["front", "back", "right", "left", "top", "bottom"] as const

/**
 * Keeps the source cuboid markup fixed at six faces, while the pre-sanitized
 * layer count remains defensively bounded before React allocates DOM nodes.
 * Per-layer color, fade, phase, and depth are presentation-only values. The
 * depth wrapper intentionally sits outside the view rotation, matching the
 * source Cubies transform order so every nested cube stays centered.
 */
export const MassageLabTwistedCubesBackground = memo(function MassageLabTwistedCubesBackground({
  massageLabTwistedCubes,
  reduceMotion = false,
  compactViewport = false,
}: MassageLabTwistedCubesBackgroundProps) {
  const {
    layerCount,
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
    paletteMode,
    backgroundColor,
    outlineAnchors,
  } = massageLabTwistedCubes
  const renderLayerCount = Number.isFinite(layerCount)
    ? Math.min(TWISTED_CUBES_OPTION_BOUNDS.layerCount.maximum, Math.max(0, Math.floor(layerCount)))
    : 0
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
    "--ml-twisted-cubes-scale": responsiveTransform.scale,
    "--ml-twisted-cubes-position-x": `${responsiveTransform.positionX}%`,
    "--ml-twisted-cubes-position-y": `${responsiveTransform.positionY}%`,
    "--ml-twisted-cubes-viewport-extent": `${TWISTED_CUBES_VIEWPORT_EXTENT_VMAX}vmax`,
  } as CSSProperties
  const layers = Array.from({ length: renderLayerCount }, (_, index) => {
    const oneBasedIndex = index + 1
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
        "--ml-twisted-cubes-size": `${getTwistedCubeLayerSizeVmax({
          oneBasedIndex,
          count: renderLayerCount,
          scale: responsiveTransform.scale,
        })}vmax`,
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
                  {CUBE_FACES.map((face) => (
                    <span className={`${styles.face} ${styles[face]}`} key={face} />
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
