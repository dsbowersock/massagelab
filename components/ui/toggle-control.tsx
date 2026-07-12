"use client"

import * as React from "react"

import { Switch, type SwitchProps } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

export interface ToggleControlProps
  extends Omit<SwitchProps, "checked" | "onCheckedChange" | "size"> {
  label: string
  icon?: React.ReactNode
  description?: string
  valueLabel?: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  density?: "roomy" | "compact" | "dense"
}

const switchSizeByDensity = {
  roomy: "default",
  compact: "compact",
  dense: "dense",
} as const

/**
 * Presents a binary setting with consistent label, description, density, and
 * physical Switch treatment across roomy settings pages and dense workspaces.
 */
export function ToggleControl({
  label,
  icon,
  description,
  valueLabel,
  checked,
  onCheckedChange,
  density = "roomy",
  className,
  ...switchProps
}: ToggleControlProps) {
  return (
    <section className={cn("ml-toggle-control", className)} data-density={density}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {icon ? <span className="shrink-0 text-primary">{icon}</span> : null}
          <p className="ml-toggle-control-label">{label}</p>
        </div>
        {description ? <p className="ml-toggle-control-description">{description}</p> : null}
      </div>
      <Switch
        {...switchProps}
        checked={checked}
        onCheckedChange={onCheckedChange}
        size={switchSizeByDensity[density]}
        aria-label={`${label}: ${valueLabel ?? (checked ? "on" : "off")}`}
      />
    </section>
  )
}
