import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const selectableCardVariants = cva(
  "group flex w-full items-start gap-3 rounded-lg border text-left ring-offset-background transition-[background-color,border-color,box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[selected=true]:translate-y-px",
  {
    variants: {
      tone: {
        default: "border-border/80 bg-card/90 hover:border-primary/45 data-[selected=true]:border-primary data-[selected=true]:bg-primary/10 data-[selected=true]:shadow-inner",
        orange: "border-orange-500/35 bg-card/90 hover:border-orange-500/60 data-[selected=true]:border-orange-500 data-[selected=true]:bg-orange-500/10",
        setup: "border-[#4AAAAA]/40 bg-card/90 hover:border-[#4AAAAA]/70 data-[selected=true]:border-[#4AAAAA] data-[selected=true]:bg-[#4AAAAA]/15",
        anatomime: "border-orange-500/35 bg-background/75 hover:border-orange-500/60 data-[selected=true]:border-orange-500 data-[selected=true]:bg-orange-500/10",
        quiet: "border-border/60 bg-background/55 hover:border-border data-[selected=true]:border-muted-foreground/60 data-[selected=true]:bg-muted/65",
      },
      density: {
        default: "min-h-24 p-4",
        compact: "min-h-20 p-3",
        dense: "min-h-16 p-2.5",
      },
    },
    defaultVariants: {
      tone: "default",
      density: "default",
    },
  },
)

export interface SelectableCardProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "title">,
    VariantProps<typeof selectableCardVariants> {
  title: React.ReactNode
  description?: React.ReactNode
  icon?: React.ReactNode
  iconInset?: boolean
  selected?: boolean
}

const SelectableCard = React.forwardRef<HTMLButtonElement, SelectableCardProps>(
  ({
    className,
    tone,
    density,
    title,
    description,
    icon,
    iconInset = false,
    selected = false,
    disabled,
    ...props
  }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(selectableCardVariants({ tone, density, className }))}
      data-selected={selected}
      aria-pressed={selected}
      disabled={disabled}
      {...props}
    >
      {icon ? (
        <span
          className={cn(
            "mt-0.5 grid size-9 shrink-0 place-items-center rounded-md text-primary",
            iconInset && "border border-border/70 bg-background/75 shadow-inner shadow-black/20",
          )}
          aria-hidden="true"
        >
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-foreground">{title}</span>
        {description ? <span className="mt-1 block text-sm leading-5 text-muted-foreground">{description}</span> : null}
      </span>
    </button>
  ),
)
SelectableCard.displayName = "SelectableCard"

export { SelectableCard, selectableCardVariants }
