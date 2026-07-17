"use client"

import * as React from "react"
import Image from "next/image"

import { Button } from "@/components/ui/button"
import { MetalAttentionRing } from "@/components/ui/metal-attention-button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
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
  previewColors?: Partial<Record<ChimerHarmonyValue, readonly string[]>>
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
 * Responsive shared-button harmony selector used by global palette tooling.
 * Each choice remains independently focusable while aria-pressed exposes the
 * single selected palette family without presenting the choices as one track.
 */
export function HarmonyToggleGroup({
  label,
  value,
  onChange,
  options,
  previewColors,
  disabled,
  description,
  embedded,
  className,
  hapticsEnabled,
  hapticDurationMs,
}: HarmonyToggleGroupProps) {
  const activeOptions = React.useMemo(() => options ?? CHIMER_HARMONY_OPTIONS, [options])
  const optionRefs = React.useMemo(
    () => activeOptions.map(() => React.createRef<HTMLButtonElement>()),
    [activeOptions],
  )

  function handleValueChange(nextValue: ChimerHarmonyValue) {
    if (disabled || nextValue === value) {
      return
    }

    onChange(nextValue)
  }

  return (
    <section className={cn(!embedded && styles.controlCard, styles.harmonySection, className)}>
      <p className={styles.harmonyHeader}>{label}</p>
      {description ? <p className={styles.controlDescription}>{description}</p> : null}
      <TooltipProvider delayDuration={250}>
        <div className={styles.harmonyList} role="group" aria-label={label + " options"}>
          {activeOptions.map((option, index) => {
            const isSelected = option.value === value
            const optionPreview = previewColors?.[option.value]
            const previewStyle = optionPreview?.length
              ? { "--ml-harmony-preview": `linear-gradient(135deg, ${optionPreview.join(", ")})` } as React.CSSProperties
              : undefined
            const button = (
              <Button
                ref={optionRefs[index]}
                type="button"
                variant={isSelected ? "attention" : "ctaBlue"}
                size="icon"
                className={cn(optionPreview?.length && styles.harmonyPreviewButton)}
                style={previewStyle}
                aria-label={option.label}
                aria-pressed={isSelected}
                disabled={disabled}
                hapticsEnabled={hapticsEnabled}
                hapticDurationMs={hapticDurationMs}
                onClick={() => handleValueChange(option.value)}
              >
                <Image
                  src={iconPath(option.icon)}
                  alt=""
                  width={32}
                  height={32}
                  className={styles.harmonyIcon}
                  aria-hidden="true"
                />
              </Button>
            )
            const trigger = <TooltipTrigger asChild>{button}</TooltipTrigger>

            return (
              <Tooltip key={option.value}>
                {isSelected ? (
                  <MetalAttentionRing
                    metalMode="always"
                    metalRingCssPx={2}
                    metalStrength={0.78}
                    metalReflectionTargets={optionRefs.filter((_, refIndex) => refIndex !== index)}
                  >
                    {trigger}
                  </MetalAttentionRing>
                ) : trigger}
                <TooltipContent>{option.label}</TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      </TooltipProvider>
    </section>
  )
}
