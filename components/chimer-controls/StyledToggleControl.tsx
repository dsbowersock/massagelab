"use client"

import { ToggleControl, type ToggleControlProps } from "@/components/ui/toggle-control"

type StyledToggleControlProps = Omit<ToggleControlProps, "density">

/**
 * Styled boolean switch used by Chimer controls, with label/value structure
 * matching the rest of the tactile control family.
 */
export function StyledToggleControl(props: StyledToggleControlProps) {
  return <ToggleControl {...props} density="compact" />
}
