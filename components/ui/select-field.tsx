import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const selectFieldVariants = cva(
  "ml-select-control h-10 w-full appearance-none pr-9 text-sm disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      density: {
        default: "h-10 px-3 py-2",
        compact: "h-9 px-2.5 py-1.5",
        dense: "h-8 px-2 py-1 text-xs",
      },
      surface: {
        default: "",
        inset: "",
        cutout: "",
      },
      tone: {
        default: "",
        setup: "border-[#4AAAAA]/55 focus-visible:ring-[#4AAAAA]",
        anatomime: "border-orange-500/45 focus-visible:ring-orange-500",
        attention: "border-fuchsia-500/45 focus-visible:ring-fuchsia-500",
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

export interface SelectFieldProps
  extends Omit<React.ComponentProps<"select">, "size">,
    VariantProps<typeof selectFieldVariants> {
  label: string
  description?: string
  errorMessage?: string
  containerClassName?: string
}

export const SelectField = React.forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({
    id,
    label,
    description,
    errorMessage,
    containerClassName,
    className,
    density,
    surface,
    tone,
    status,
    "aria-describedby": ariaDescribedBy,
    "aria-invalid": ariaInvalid,
    children,
    ...props
  }, ref) => {
    const generatedId = React.useId()
    const fieldId = id ?? generatedId
    const descriptionId = description ? `${fieldId}-description` : undefined
    const errorId = errorMessage ? `${fieldId}-error` : undefined
    const describedBy = [ariaDescribedBy, descriptionId, errorId].filter(Boolean).join(" ") || undefined
    const resolvedStatus = errorMessage ? "error" : status

    return (
      <label htmlFor={fieldId} className={cn("grid gap-1.5 text-sm font-medium", containerClassName)}>
        <span>{label}</span>
        <span className="relative block">
          <select
            ref={ref}
            id={fieldId}
            className={cn(selectFieldVariants({ density, surface, tone, status: resolvedStatus, className }))}
            aria-describedby={describedBy}
            data-surface={surface ?? "default"}
            data-tone={tone ?? "default"}
            data-status={resolvedStatus ?? "default"}
            aria-invalid={resolvedStatus === "error" ? true : ariaInvalid}
            {...props}
          >
            {children}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
        </span>
        {description ? <span id={descriptionId} className="text-xs font-normal text-muted-foreground">{description}</span> : null}
        {errorMessage ? <span id={errorId} className="text-xs font-medium text-destructive">{errorMessage}</span> : null}
      </label>
    )
  },
)
SelectField.displayName = "SelectField"

export { selectFieldVariants }
