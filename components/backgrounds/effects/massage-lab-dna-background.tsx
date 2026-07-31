"use client"

import { type CSSProperties, useEffect, useRef, useState } from "react"
import {
  createDnaNodeRoleAssignments,
  getDnaNodeCycleSeconds,
  getDnaStrandDelaySeconds,
  getDnaStrandPhase,
  getDnaStrandRotationSeconds,
} from "@/lib/dna-background"
import { resolveResponsiveBackgroundTransform } from "@/lib/background-effect-layout"
import type { BackgroundEffectProps, MassageLabDnaOptions } from "./css-backgrounds"
import styles from "./massage-lab-dna-background.module.css"

type MassageLabDnaBackgroundProps = Pick<BackgroundEffectProps, "reduceMotion" | "compactViewport"> & {
  massageLabDna: MassageLabDnaOptions
}

/**
 * Renders the source DNA geometry with CSS-only motion. Node roles belong to a
 * mount, not to saved preferences: palette and geometry updates preserve them,
 * while a changed strand count receives exactly one fresh set after rendering.
 */
export function MassageLabDnaBackground({
  massageLabDna,
  reduceMotion = false,
  compactViewport = false,
}: MassageLabDnaBackgroundProps) {
  const {
    strandCount,
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
    ? Math.min(25, Math.max(0, Math.floor(strandCount)))
    : 0
  const [nodeRoleAssignments, setNodeRoleAssignments] = useState(() => (
    createDnaNodeRoleAssignments(renderStrandCount * 2)
  ))
  const previousStrandCount = useRef(renderStrandCount)

  useEffect(() => {
    if (previousStrandCount.current === renderStrandCount) return

    previousStrandCount.current = renderStrandCount
    setNodeRoleAssignments(createDnaNodeRoleAssignments(renderStrandCount * 2))
  }, [renderStrandCount])

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
    const oneBasedIndex = index + 1
    const phase = getDnaStrandPhase({ oneBasedIndex, total: renderStrandCount })
    const delaySeconds = getDnaStrandDelaySeconds({
      oneBasedIndex,
      total: renderStrandCount,
      speed: nodeMotionSpeed,
    })

    return {
      index,
      style: {
        "--ml-dna-phase": phase,
        "--ml-dna-node-duration": `${nodeCycleSeconds}s`,
        "--ml-dna-node-delay": `${delaySeconds}s`,
        "--ml-dna-start-color": `var(--ml-dna-node-color-${nodeRoleAssignments[index * 2] ?? 0})`,
        "--ml-dna-end-color": `var(--ml-dna-node-color-${nodeRoleAssignments[index * 2 + 1] ?? 0})`,
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
              <span className={styles.node} data-side="start" />
              <span className={styles.node} data-side="end" />
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
