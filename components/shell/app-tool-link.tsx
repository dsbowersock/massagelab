"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { isNavigationRouteActive } from "@/lib/navigation"
import { cn } from "@/lib/utils"

/**
 * Renders a global tool shortcut with shared route-family active semantics.
 */
export function AppToolLink({
  href,
  label,
  icon: Icon,
  showLabel = false,
  className,
}: {
  href: string
  label: string
  icon: LucideIcon
  showLabel?: boolean
  className?: string
}) {
  const pathname = usePathname() ?? "/"
  const active = isNavigationRouteActive(pathname, href)

  return (
    <Button asChild variant="ctaBlue" size="icon" className={cn("ml-app-tool-link", className)}>
      <Link href={href} aria-label={label} aria-current={active ? "page" : undefined} data-active={active}>
        <Icon aria-hidden="true" />
        {showLabel ? <span>{label}</span> : null}
      </Link>
    </Button>
  )
}
