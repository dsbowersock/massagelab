"use client"

import { useMemo } from "react"
import Image from "next/image"

import { SegmentedToggleGroup } from "@/components/ui/segmented-toggle-group"
import { cn } from "@/lib/utils"
import { type HapticPressOptions } from "@/components/chimer-controls/haptics"
import styles from "./chimer-controls.module.css"

const HARMONY_ICON_PATH_PREFIX = "/massagelab_color_harmony_icons/massagelab_color_harmony_icons/svg"

export type ChimerHarmonyValue = "custom" | "analogous" | "complementary" | "split-complementary" | "triad" | "square" | "compound" | "shades" | "monochromatic"
export type ChimerHarmonyOption = {
  value: ChimerHarmonyValue
  label: string
  icon: string
  description?: string
}

export const CHIMER_HARMONY_OPTIONS: readonly ChimerHarmonyOption[] = [
  { value: "custom", label: "Custom", icon: "custom" },
  { value: "analogous", label: "Analogous", icon: "analogous" },
  { value: "complementary", label: "Complementary", icon: "complementary" },
  { value: "split-complementary", label: "Split Complementary", icon: "split-complementary" },
  { value: "triad", label: "Triad", icon: "triad" },
  { value: "square", label: "Square", icon: "square" },
  { value: "compound", label: "Compound", icon: "compound" },
  { value: "shades", label: "Shades", icon: "shades" },
  { value: "monochromatic", label: "Monochromatic", icon: "monochromatic" },
]

export interface HarmonyToggleGroupProps {
  label: string
  value: ChimerHarmonyValue
  onChange: (value: ChimerHarmonyValue) => void
  options?: readonly ChimerHarmonyOption[]
  disabled?: boolean
  description?: string
  embedded?: boolean
  className?: string
  hapticsEnabled?: HapticPressOptions["hapticsEnabled"]
  hapticDurationMs?: HapticPressOptions["hapticDurationMs"]
}

function iconPath(iconName: string) {
  return `${HARMONY_ICON_PATH_PREFIX}/${iconName}.svg`
}

/**
 * Horizontal segmented harmony selector used by global palette tooling.
 */
export function HarmonyToggleGroup({
  label,
  value,
  onChange,
  options,
  disabled,
  description,
  embedded,
  className,
  hapticsEnabled,
  hapticDurationMs,
}: HarmonyToggleGroupProps) {
  const activeOptions = useMemo(() => options ?? CHIMER_HARMONY_OPTIONS, [options])
  const segmentedOptions = useMemo(() => activeOptions.map((option) => ({
    value: option.value,
    label: option.label,
    icon: (
      <Image
        src={iconPath(option.icon)}
        alt=""
        width={16}
        height={16}
        className={styles.harmonyIcon}
        aria-hidden="true"
      />
    ),
  })), [activeOptions])

  function handleValueChange(nextValue: string) {
    if (disabled || !nextValue || nextValue === value) {
      return
    }

    onChange(nextValue as ChimerHarmonyValue)
  }

  return (
    <section className={cn(!embedded && styles.controlCard, styles.harmonySection, className)}>
      <p className={styles.harmonyHeader}>{label}</p>
      {description ? <p className={styles.controlDescription}>{description}</p> : null}
      <SegmentedToggleGroup
        label={`${label} options`}
        value={value}
        onValueChange={handleValueChange}
        disabled={disabled}
        iconOnly
        activeTone="attention"
        activeRing
        reflectSiblingOptions
        hapticsEnabled={hapticsEnabled}
        hapticDurationMs={hapticDurationMs}
        className={styles.harmonyList}
        options={segmentedOptions}
      />
    </section>
  )
}
