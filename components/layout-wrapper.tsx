"use client"

import Image from "next/image"
import Link from "next/link"
import { MovingBackground } from "@/components/moving-background"
import { useSettings } from "@/components/providers/settings-provider"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import { usePathname } from "next/navigation"

function SidebarTriggerBar() {
  const { settings } = useSettings()
  const alignsRight = settings.sidebarPosition === "right"

  return (
    <header
      className={cn(
        "ml-app-topbar relative z-20 flex h-12 shrink-0 items-center gap-2 border-border/60 bg-background/80 px-3 backdrop-blur",
        settings.sidebarTriggerPosition === "bottom" ? "border-t" : "border-b",
        alignsRight && "flex-row-reverse",
      )}
    >
      <SidebarTrigger className={cn(alignsRight ? "-mr-1" : "-ml-1")} />
      <Separator orientation="vertical" className="h-4" />
      <Link href="/" aria-label="MassageLab home" className="flex min-w-0 items-center">
        <Image
          src="/brand/massagelab-wordmark-uppercase-tight.png"
          alt="MassageLab"
          width={180}
          height={54}
          className="h-7 w-auto max-w-36 object-contain"
          unoptimized
          priority
        />
      </Link>
    </header>
  )
}

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings()
  const pathname = usePathname() ?? ""
  const routeOwnsBackground = pathname.startsWith("/chimer") || pathname.startsWith("/anatomime")
  const triggerBar = <SidebarTriggerBar />

  return (
    <div className="ml-app-shell relative isolate flex h-full w-full flex-col overflow-hidden bg-[#050505]">
      {!routeOwnsBackground && (
        <>
          <MovingBackground
            className="pointer-events-none fixed inset-0 z-0 h-[100dvh] w-screen"
            testId="app-moving-background"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-[1] bg-gradient-to-br from-slate-950/75 via-neutral-950/80 to-stone-950/75"
          />
        </>
      )}
      {settings.sidebarTriggerPosition === "top" && triggerBar}
      <div className="ml-app-scroll relative z-10 min-h-0 w-full flex-1 overflow-y-auto overscroll-contain">
        <div className="ml-app-content mx-auto w-full max-w-screen-2xl">{children}</div>
      </div>
      {settings.sidebarTriggerPosition === "bottom" && triggerBar}
    </div>
  )
}

