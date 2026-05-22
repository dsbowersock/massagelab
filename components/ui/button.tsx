import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-[background-color,color,box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:translate-y-px disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[inset_0_-2px_0_hsl(var(--foreground)/0.16),0_1px_8px_hsl(var(--brand-orange-glow)/0.34)] hover:bg-primary/90 hover:shadow-[inset_0_-2.5px_0_hsl(var(--foreground)/0.18),0_2px_10px_hsl(var(--brand-orange-glow)/0.42)] active:bg-primary/85 active:shadow-[inset_0_1px_3px_hsl(var(--background)/0.32),0_1px_3px_hsl(var(--brand-orange-glow)/0.28)]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[inset_0_-2px_0_hsl(var(--foreground)/0.12),0_1px_8px_hsl(var(--destructive)/0.3)] hover:bg-destructive/90 active:shadow-[inset_0_1px_3px_hsl(var(--background)/0.3)]",
        outline:
          "border border-input bg-background shadow-[inset_0_-2px_0_hsl(var(--foreground)/0.05),0_1px_6px_hsl(var(--background)/0.28)] hover:bg-accent hover:text-accent-foreground hover:shadow-[inset_0_-2px_0_hsl(var(--foreground)/0.06),0_2px_8px_hsl(var(--background)/0.32)] active:shadow-[inset_0_1px_3px_hsl(var(--background)/0.24)]",
        secondary:
          "bg-secondary text-secondary-foreground shadow-[inset_0_-2px_0_hsl(var(--foreground)/0.14),0_1px_8px_hsl(var(--secondary)/0.28)] hover:bg-secondary/80 active:shadow-[inset_0_1px_3px_hsl(var(--background)/0.28)]",
        ghost: "shadow-none hover:bg-accent hover:text-accent-foreground active:shadow-none",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
