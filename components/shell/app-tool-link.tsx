"use client"

import { forwardRef, type ComponentPropsWithoutRef } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { isNavigationRouteActive } from "@/lib/navigation"
import { cn } from "@/lib/utils"

type AppToolLinkProps = {
  href: string
  label: string
  icon: LucideIcon
  showLabel?: boolean
  className?: string
} & Omit<
  ComponentPropsWithoutRef<typeof Link>,
  "href" | "children" | "className" | "aria-label" | "aria-current"
>

/**
 * Renders a global tool shortcut and forwards composed trigger behavior to its anchor.
 */
export const AppToolLink = forwardRef<HTMLAnchorElement, AppToolLinkProps>(function AppToolLink({
  href,
  label,
  icon: Icon,
  showLabel = false,
  className,
  ...triggerProps
}, ref) {
  const pathname = usePathname() ?? "/"
  const active = isNavigationRouteActive(pathname, href)

  return (
    <Button asChild variant="ctaBlue" size="icon" className={cn("ml-app-tool-link", className)}>
      <Link
        {...triggerProps}
        ref={ref}
        href={href}
        aria-label={label}
        aria-current={active ? "page" : undefined}
        data-active={active}
      >
        <Icon aria-hidden="true" />
        {showLabel ? <span>{label}</span> : null}
      </Link>
    </Button>
  )
})
