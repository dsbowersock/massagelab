import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const inputVariants = cva(
  "flex w-full rounded-md border text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/35 md:text-sm",
  {
    variants: {
      density: {
        default: "h-10 px-3 py-2",
        compact: "h-9 px-2.5 py-1.5",
        dense: "h-8 px-2 py-1 text-sm",
      },
      surface: {
        default: "border-input bg-background",
        inset: "border-border/80 bg-background/85 shadow-inner shadow-black/15",
        cutout: "border-border/90 bg-background/70 shadow-inner shadow-black/25",
      },
      tone: {
        default: "",
        setup: "border-[#4AAAAA]/55 focus-visible:ring-[#4AAAAA]",
        anatomime: "border-orange-500/45 focus-visible:ring-orange-500",
      },
      status: {
        default: "",
        error: "border-destructive focus-visible:ring-destructive",
      },
    },
    defaultVariants: {
      density: "default",
      surface: "default",
      tone: "default",
      status: "default",
    },
  },
)

export interface InputProps
  extends Omit<React.ComponentProps<"input">, "size">,
    VariantProps<typeof inputVariants> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, density, surface, tone, status, "aria-invalid": ariaInvalid, ...props }, ref) => (
    <input
      type={type}
      className={cn(inputVariants({ density, surface, tone, status, className }))}
      ref={ref}
      aria-invalid={status === "error" ? true : ariaInvalid}
      {...props}
    />
  ),
)
Input.displayName = "Input"

export { Input, inputVariants }
