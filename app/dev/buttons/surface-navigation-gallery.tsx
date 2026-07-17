"use client"

import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  Clock3,
  Home,
  Layers3,
  Menu,
  Moon,
  Plus,
  Music2,
  Settings,
  Sun,
} from "lucide-react"

import { useResolvedTheme } from "@/components/providers/settings-provider"
import { AppInset, AppSurface } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export function SurfaceNavigationGallery() {
  const resolvedTheme = useResolvedTheme()
  const ThemeIcon = resolvedTheme === "dark" ? Moon : Sun
  return (
    <div className="space-y-8">
      <section className="space-y-4" aria-labelledby="navigation-heading">
        <div>
          <h2 id="navigation-heading" className="text-2xl font-semibold">Navigation controls</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            Drawer rows remain in the existing sidebar family; app-bar controls use shared Button intent and touch sizing.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <AppSurface title="Drawer section and nested rows" description="Shell-only navigation stays in the sidebar family unless a second consumer appears.">
            <nav className="max-w-md rounded-lg border border-sidebar-border bg-sidebar p-2 text-sidebar-foreground" aria-label="Drawer review">
              <button
                type="button"
                className="flex h-12 w-full items-center gap-3 rounded-lg bg-sidebar-accent px-3 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                aria-expanded="true"
              >
                <BookOpen className="size-5" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">Education</span>
                <ChevronDown className="size-4" aria-hidden="true" />
              </button>
              <div className="ml-4 mt-1 grid gap-1 border-l border-sidebar-border/70 pl-2">
                <button type="button" className="flex h-10 items-center gap-2 rounded-md px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
                  <BookOpen className="size-4" aria-hidden="true" />
                  Flashcards
                </button>
                <button
                  type="button"
                  className="ml-sidebar-route flex h-10 items-center gap-2 rounded-md px-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                  data-active="true"
                  aria-current="page"
                >
                  <Layers3 className="size-4" aria-hidden="true" />
                  Decks
                </button>
                <button type="button" className="flex h-10 items-center gap-2 rounded-md px-2 text-sm opacity-50" disabled>
                  <Settings className="size-4" aria-hidden="true" />
                  Disabled route
                </button>
              </div>
            </nav>
          </AppSurface>

          <AppSurface title="Topbar icon buttons" description="Compact shell controls keep shared icon-button focus and press mechanics.">
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-background/70 p-3">
              <Button variant={resolvedTheme === "dark" ? "glow" : "default"} size="icon" className="rounded-full" aria-label="Open menu"><Menu aria-hidden="true" /></Button>
              <Button variant="ctaBlue" size="icon" aria-label="Music"><Music2 aria-hidden="true" /></Button>
              <Button variant="ctaBlue" size="icon" aria-label="Clock"><Clock3 aria-hidden="true" /></Button>
              <Button variant="default" size="icon" className="rounded-full" aria-label="Quick actions"><Plus aria-hidden="true" /></Button>
              <Button variant="ctaBlue" size="icon" aria-label="Calendar"><CalendarDays aria-hidden="true" /></Button>
              <Button variant={resolvedTheme === "dark" ? "glow" : "default"} size="icon" className="rounded-full" aria-label="Theme"><ThemeIcon aria-hidden="true" /></Button>
              <Button variant="ctaBlue" size="icon" aria-label="Disabled settings" disabled><Settings aria-hidden="true" /></Button>
            </div>
          </AppSurface>

          <AppSurface title="Bottom navigation" description="Phone controls preserve larger touch targets and active/inactive distinction." className="lg:col-span-2">
            <nav className="mx-auto flex w-full max-w-md items-center justify-around gap-2 rounded-2xl border border-border/80 bg-background/90 p-2" aria-label="Bottom navigation review">
              <Button variant="ctaBlue" size="icon" aria-label="Home active" aria-current="page"><Home aria-hidden="true" /></Button>
              <Button variant="ctaBlue" size="icon" aria-label="Music inactive"><Music2 aria-hidden="true" /></Button>
              <Button variant="ctaBlue" size="icon" aria-label="Clock inactive"><Clock3 aria-hidden="true" /></Button>
              <Button variant="ctaBlue" size="icon" aria-label="Calendar inactive"><CalendarDays aria-hidden="true" /></Button>
              <Button variant={resolvedTheme === "dark" ? "glow" : "default"} size="icon" className="rounded-full" aria-label="Open navigation"><Menu aria-hidden="true" /></Button>
            </nav>
          </AppSurface>
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="surface-heading">
        <div>
          <h2 id="surface-heading" className="text-2xl font-semibold">App surfaces and containers</h2>
          <p className="mt-1 text-sm text-muted-foreground">Structural variants stay separate from control geometry and can opt out of gradients.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <AppSurface title="Card" description="Default route card." variant="card">
            <p className="text-sm text-muted-foreground">Raised card surface</p>
          </AppSurface>
          <AppSurface title="Inset panel" description="Grouped controls and cutout regions." variant="inset">
            <AppInset className="p-3 text-sm text-muted-foreground">Nested inset content</AppInset>
          </AppSurface>
          <AppSurface title="Route container" description="Subtle route-accent boundary." variant="route">
            <p className="text-sm text-muted-foreground">Route-owned layout, shared surface construction</p>
          </AppSurface>
          <AppSurface title="Dialog surface" description="Elevated modal construction." variant="dialog">
            <p className="text-sm text-muted-foreground">Dialog-style surface</p>
          </AppSurface>
          <AppSurface title="Popover surface" description="Compact floating construction." variant="popover">
            <p className="text-sm text-muted-foreground">Popover-style surface</p>
          </AppSurface>
          <AppSurface title="No-gradient container" description="Flat structural option for Clock and Chimer groups." variant="flat">
            <p className="text-sm text-muted-foreground">No gradient or raised depth</p>
          </AppSurface>
        </div>
      </section>

      <AppSurface title="Live dialog and popover" description="Exercise focus trapping, Escape behavior, and trigger focus restoration.">
        <div className="flex flex-wrap gap-3">
          <Dialog>
            <DialogTrigger asChild><Button variant="outline">Open dialog</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Shared dialog surface</DialogTitle>
                <DialogDescription>Review spacing, elevation, focus, and close behavior.</DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>

          <Popover>
            <PopoverTrigger asChild><Button variant="secondary">Open popover</Button></PopoverTrigger>
            <PopoverContent>
              <p className="font-semibold">Shared popover surface</p>
              <p className="mt-1 text-sm text-muted-foreground">Compact floating controls retain the same field and button families.</p>
            </PopoverContent>
          </Popover>
        </div>
      </AppSurface>
    </div>
  )
}
