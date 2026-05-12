"use client"

import Image from "next/image"
import Link from "next/link"
import { LogIn } from "lucide-react"
import { MovingBackground } from "@/components/moving-background"
import { useSettings } from "@/components/providers/settings-provider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useSidebar } from "@/components/ui/sidebar"
import type { SidebarUser } from "@/components/sidebar/app-sidebar-client"
import { cn } from "@/lib/utils"
import { usePathname } from "next/navigation"

function initials(name: string, email: string) {
  const source = name || email

  if (!source) {
    return "ML"
  }

  const parts = source
    .replace(/@.*/, "")
    .split(/\s+|[._-]+/)
    .filter(Boolean)

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "ML"
}

function PortraitSidebarBar({ user }: { user: SidebarUser }) {
  const { settings } = useSettings()
  const { renderMode, toggleSidebar } = useSidebar()
  const alignsRight = settings.sidebarPosition === "right"
  const alignsBottom = settings.sidebarTriggerPosition === "bottom"

  if (renderMode !== "drawer") {
    return null
  }

  const userName = user?.name || "Account"
  const userEmail = user?.email || ""
  const accountControl = user ? (
    <Link
      href="/account"
      aria-label="Account"
      title="Account"
      className="inline-flex h-10 min-w-10 items-center justify-center rounded-full border border-border/70 bg-background/90 px-1 text-foreground shadow-sm transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <Avatar className="h-8 w-8">
        {user.image && <AvatarImage src={user.image} alt={userName} />}
        <AvatarFallback>{initials(userName, userEmail)}</AvatarFallback>
      </Avatar>
    </Link>
  ) : (
    <Link
      href="/login"
      className="inline-flex h-10 items-center gap-2 rounded-full border border-border/70 bg-background/90 px-3 text-sm font-medium text-foreground shadow-sm transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <LogIn className="h-4 w-4" />
      <span>Sign in</span>
    </Link>
  )

  const logoTrigger = (
    <button
      type="button"
      aria-label="Open sidebar"
      title="Open sidebar"
      onClick={toggleSidebar}
      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/70 bg-background/90 text-foreground shadow-sm transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <Image
        src="/brand/massagelab-mark-square-tight.png"
        alt=""
        width={32}
        height={32}
        className="object-contain"
        unoptimized
        priority
      />
    </button>
  )

  return (
    <div
      className={cn(
        "ml-portrait-sidebar-bar fixed inset-x-0 z-30 flex items-center justify-between border-border/70 bg-background/90 px-3 py-2 shadow-lg backdrop-blur",
        alignsBottom
          ? "bottom-0 border-t pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)]"
          : "top-0 border-b pt-[calc(env(safe-area-inset-top,0px)+0.5rem)]",
      )}
    >
      {alignsRight ? (
        <>
          {accountControl}
          {logoTrigger}
        </>
      ) : (
        <>
          {logoTrigger}
          {accountControl}
        </>
      )}
    </div>
  )
}

function RouteWordmark({ visible }: { visible: boolean }) {
  if (!visible) {
    return null
  }

  return (
    <Link
      href="/"
      aria-label="MassageLab home"
      className="ml-route-wordmark fixed left-1/2 top-[calc(env(safe-area-inset-top,0px)+0.7rem)] z-20 -translate-x-1/2 rounded-sm px-2 py-1 transition duration-300 hover:opacity-90"
    >
      <Image
        src="/brand/massagelab-wordmark-uppercase-tight.png"
        alt="MassageLab"
        width={180}
        height={54}
        className="h-8 w-auto object-contain drop-shadow-[0_0_20px_hsl(var(--brand-orange-glow)/0.18)]"
        data-testid="route-brand-wordmark"
        style={{ viewTransitionName: "massagelab-wordmark" }}
        unoptimized
        priority
      />
    </Link>
  )
}

export function LayoutWrapper({ children, user }: { children: React.ReactNode; user: SidebarUser }) {
  const pathname = usePathname() ?? ""
  const { settings } = useSettings()
  const { renderMode } = useSidebar()
  const isHomePage = pathname === "/"
  const showRouteWordmark = !isHomePage
  const routeOwnsBackground = pathname.startsWith("/chimer") || pathname.startsWith("/anatomime")
  const hasPortraitBar = renderMode === "drawer"
  const portraitBarAtBottom = settings.sidebarTriggerPosition === "bottom"

  return (
    <div className="ml-app-shell relative isolate flex h-full w-full flex-col overflow-hidden bg-background">
      {!routeOwnsBackground && (
        <>
          <MovingBackground
            className="pointer-events-none fixed inset-0 z-0 h-[100dvh] w-screen"
            testId="app-moving-background"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-[1] bg-background/80"
          />
        </>
      )}
      <PortraitSidebarBar user={user} />
      <RouteWordmark visible={showRouteWordmark} />
      <div className="ml-app-scroll relative z-10 min-h-0 w-full flex-1 overflow-y-auto overscroll-contain">
        <div
          className={cn(
            "ml-app-content mx-auto w-full max-w-screen-2xl",
            hasPortraitBar && portraitBarAtBottom && "pb-[calc(env(safe-area-inset-bottom,0px)+4.5rem)]",
            hasPortraitBar && !portraitBarAtBottom
              ? "pt-[calc(env(safe-area-inset-top,0px)+4.5rem)]"
              : showRouteWordmark && "pt-[calc(env(safe-area-inset-top,0px)+3.75rem)]",
          )}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

