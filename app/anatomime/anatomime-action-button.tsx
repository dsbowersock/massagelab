"use client"

import * as React from "react"

import { Button, type ButtonProps } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type AnatomimeActionIntent = "primary" | "secondary" | "danger"

export interface AnatomimeActionButtonProps extends Omit<ButtonProps, "tone" | "variant"> {
  /** Selects route intent while the shared Button owns visual and interaction mechanics. */
  intent?: AnatomimeActionIntent
}

const intentVariants: Record<AnatomimeActionIntent, ButtonProps["variant"]> = {
  primary: "default",
  secondary: "outline",
  danger: "destructive",
}

/**
 * Thin Anatomime semantic alias for ordinary actions. It contributes only the
 * route tone and flex-layout hook; shared Button remains the family authority.
 */
export const AnatomimeActionButton = React.forwardRef<HTMLButtonElement, AnatomimeActionButtonProps>(
  ({ className, intent = "primary", ...props }, ref) => (
    <Button
      ref={ref}
      tone="anatomime"
      variant={intentVariants[intent]}
      className={cn("anatomime-action-layout", className)}
      {...props}
    />
  ),
)

AnatomimeActionButton.displayName = "AnatomimeActionButton"
