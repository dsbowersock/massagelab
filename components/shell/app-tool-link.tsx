"use client"

import {
  forwardRef,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MetalAttentionRing } from "@/components/ui/metal-attention-button"
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
 * Mounts MetalFx only after its responsive app-bar copy has measurable geometry.
 * The shell renders desktop and mobile bars together, so hidden copies must stay
 * on the plain CTA treatment until their layout becomes visible.
 */
function ActiveToolMetalRing({ children }: { children: ReactNode }) {
  const probeRef = useRef<HTMLSpanElement | null>(null)
  const [hasVisibleGeometry, setHasVisibleGeometry] = useState(false)

  useLayoutEffect(() => {
    const probe = probeRef.current
    if (!probe) return undefined

    const measure = () => {
      const bounds = probe.getBoundingClientRect()
      setHasVisibleGeometry(bounds.width >= 3 && bounds.height >= 3)
    }
    const resizeObserver = new ResizeObserver(measure)
    resizeObserver.observe(probe)
    measure()
    return () => resizeObserver.disconnect()
  }, [])

  return (
    <span ref={probeRef} className="ml-app-tool-link-active-ring-probe">
      {hasVisibleGeometry ? (
        <MetalAttentionRing className="ml-app-tool-link-active-ring">
          {children}
        </MetalAttentionRing>
      ) : children}
    </span>
  )
}

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

  const toolLink = (
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

  return active ? <ActiveToolMetalRing>{toolLink}</ActiveToolMetalRing> : toolLink
})
