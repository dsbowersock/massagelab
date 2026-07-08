"use client"

import { Button, type ButtonProps } from "@/components/ui/button"

export type TactileButtonProps = ButtonProps

/**
 * Chimer compatibility wrapper that now delegates visual styling, press
 * feedback, and haptics to the shared sitewide `Button` component.
 */
export function TactileButton({
  className,
  pressFeedback = true,
  type = "button",
  ...buttonProps
}: TactileButtonProps) {
  return (
    <Button
      type={type}
      pressFeedback={pressFeedback}
      className={className}
      {...buttonProps}
    />
  )
}
