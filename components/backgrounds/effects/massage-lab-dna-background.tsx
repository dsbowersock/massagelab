"use client"

import { memo, type CSSProperties, useState } from "react"
import {
  createDnaStrandAssignments,
  DNA_OPTION_BOUNDS,
  getDnaNodeCycleSeconds,
  getDnaStrandDelaySeconds,
  getDnaStrandRotationSeconds,
} from "@/lib/dna-background"
import { resolveResponsiveBackgroundTransform } from "@/lib/background-effect-layout"
import type { BackgroundEffectProps, MassageLabDnaOptions } from "./css-backgrounds"
import styles from "./massage-lab-dna-background.module.css"

type MassageLabDnaBackgroundProps = Pick<BackgroundEffectProps, "reduceMotion" | "compactViewport"> & {
  massageLabDna: MassageLabDnaOptions
}

/**
 * Renders the source DNA geometry with CSS-only motion. Biologically valid
 * base pairs and independent node palette roles belong to a mount, not saved
 * preferences; a changed strand count receives one fresh assignment set.
 */
export const MassageLabDnaBackground = memo(function MassageLabDnaBackground({
  massageLabDna,
  reduceMotion = false,
  compactViewport = false,
}: MassageLabDnaBackgroundProps) {
  const {
    strandCount,
    showBaseLetters,
    nodeMotionSpeed,
    strandRotationSpeed,
    strandAngle,
    scale,
    positionX,
    positionY,
    strandSpacing,
    connectorWidth,
    connectorThickness,
    outlineThickness,
    backgroundColor,
    nodeRoleColors,
    connectorColor,
    outlineColor,
  } = massageLabDna
  const renderStrandCount = Number.isFinite(strandCount)
    ? Math.min(DNA_OPTION_BOUNDS.strandCount.maximum, Math.max(0, Math.floor(strandCount)))
    : 0
  const [strandAssignments, setStrandAssignments] = useState(() => (
    createDnaStrandAssignments(renderStrandCount)
  ))
  const [previousStrandCount, setPreviousStrandCount] = useState(renderStrandCount)

  // React restarts this render immediately, so a new count never paints with
  // stale assignments while the mount-stable set remains unchanged otherwise.
  if (previousStrandCount !== renderStrandCount) {
    setPreviousStrandCount(renderStrandCount)
    setStrandAssignments(createDnaStrandAssignments(renderStrandCount))
  }

  const responsiveTransform = resolveResponsiveBackgroundTransform({
    scale,
    positionX,
    positionY,
    compactViewport,
  })
  const nodeCycleSeconds = getDnaNodeCycleSeconds(nodeMotionSpeed)
  const strandRotationSeconds = getDnaStrandRotationSeconds(strandRotationSpeed)
  const rootStyle = {
    "--ml-dna-background-color": backgroundColor,
    "--ml-dna-node-color-0": nodeRoleColors[0],
    "--ml-dna-node-color-1": nodeRoleColors[1],
    "--ml-dna-node-color-2": nodeRoleColors[2],
    "--ml-dna-node-color-3": nodeRoleColors[3],
    "--ml-dna-connector-color": connectorColor,
    "--ml-dna-outline-color": outlineColor,
    "--ml-dna-strand-angle": `${strandAngle}deg`,
    "--ml-dna-strand-spacing": `${strandSpacing}vmin`,
    "--ml-dna-connector-width": `${connectorWidth}%`,
    "--ml-dna-connector-thickness": `${connectorThickness}%`,
    "--ml-dna-outline-thickness": `${outlineThickness}vmin`,
    "--ml-dna-rotation-duration": `${strandRotationSeconds}s`,
  } as CSSProperties
  const sceneStyle = {
    "--ml-dna-scale": responsiveTransform.scale,
    "--ml-dna-position-x": `${responsiveTransform.positionX}%`,
    "--ml-dna-position-y": `${responsiveTransform.positionY}%`,
  } as CSSProperties
  const strands = Array.from({ length: renderStrandCount }, (_, index) => {
    const assignment = strandAssignments[index] ?? {
      startBase: "A",
      endBase: "T",
      startRole: 0,
      endRole: 0,
    }
    const oneBasedIndex = index + 1
    const delaySeconds = getDnaStrandDelaySeconds({
      oneBasedIndex,
      total: renderStrandCount,
      speed: nodeMotionSpeed,
    })

    return {
      index,
      ...assignment,
      style: {
        "--ml-dna-node-duration": `${nodeCycleSeconds}s`,
        "--ml-dna-node-delay": `${delaySeconds}s`,
        "--ml-dna-start-color": `var(--ml-dna-node-color-${assignment.startRole})`,
        "--ml-dna-end-color": `var(--ml-dna-node-color-${assignment.endRole})`,
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
        <div className={styles.composition}>
          {strands.map((strand) => (
            <span className={styles.strand} style={strand.style} key={strand.index}>
              <span className={styles.connector} />
              <span className={styles.node} data-side="start" data-base={strand.startBase}>
                {showBaseLetters && <span className={styles.nodeLabel}>{strand.startBase}</span>}
              </span>
              <span className={styles.node} data-side="end" data-base={strand.endBase}>
                {showBaseLetters && <span className={styles.nodeLabel}>{strand.endBase}</span>}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
})
