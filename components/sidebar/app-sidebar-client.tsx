"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { signOut } from "next-auth/react"
import {
  Brain,
  CalendarDays,
  ChevronsUpDown,
  ChevronRight,
  Clock,
  FileText,
  Home,
  LifeBuoy,
  LogIn,
  LogOut,
  LucideIcon,
  Map,
  Plus,
  Settings,
  ShieldCheck,
  Timer,
  UserPlus,
  UserRound,
  Wrench,
} from "lucide-react"
import { useSettings } from "@/components/providers/settings-provider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Calendar } from "@/components/ui/calendar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  accountMenuRoutes,
  calendarSidebarActions,
  isNavigationRouteActive,
  primaryNavigationGroups,
  secondaryNavigationRoutes,
} from "@/lib/navigation"
import { cn } from "@/lib/utils"

export type SidebarCalendarContext = {
  practice: {
    id: string
    name: string
  } | null
  therapists: Array<{
    id: string
    label: string
  }>
  canManageAvailability: boolean
}

export type SidebarUser = {
  name: string
  email: string
  image: string
} | null

const routeIcons = {
  Brain,
  CalendarDays,
  Clock,
  FileText,
  Home,
  LifeBuoy,
  Map,
  Plus,
  Settings,
  ShieldCheck,
  Timer,
  UserRound,
} satisfies Record<string, LucideIcon>

const primaryGroupIcons: Record<string, LucideIcon> = {
  tools: Wrench,
  documentation: FileText,
  games: Brain,
}

const sidebarSectionTriggerClass = cn(
  "cursor-pointer gap-2",
  "group-data-[collapsible=icon]:!mt-0 group-data-[collapsible=icon]:!h-8 group-data-[collapsible=icon]:!w-8",
  "group-data-[collapsible=icon]:!px-0 group-data-[collapsible=icon]:!opacity-100 group-data-[collapsible=icon]:justify-center",
)

function SidebarSectionTrigger({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <SidebarGroupLabel asChild className={sidebarSectionTriggerClass}>
      <CollapsibleTrigger aria-label={label} title={label}>
        <Icon aria-hidden="true" />
        <span className="truncate group-data-[collapsible=icon]:hidden">{label}</span>
        <ChevronRight className="ml-auto transition-transform group-data-[collapsible=icon]:hidden group-data-[state=open]/collapsible:rotate-90" />
      </CollapsibleTrigger>
    </SidebarGroupLabel>
  )
}

type NavigationRoute = {
  id: string
  href: string
  label: string
  icon: keyof typeof routeIcons
}

type NavigationGroup = {
  id: string
  label: string
  routes: NavigationRoute[]
}

const primaryGroups = primaryNavigationGroups as NavigationGroup[]
const secondaryRoutes = secondaryNavigationRoutes as NavigationRoute[]
const accountRoutes = accountMenuRoutes as NavigationRoute[]
const calendarActions = calendarSidebarActions as NavigationRoute[]

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

function useSidebarNavigation() {
  const { isMobile, setOpenMobile } = useSidebar()
  const router = useRouter()

  const closeMobileSidebar = React.useCallback(() => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }, [isMobile, setOpenMobile])

  const navigateFromSidebar = React.useCallback((event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (
      !isMobile
      || event.defaultPrevented
      || event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.altKey
      || event.shiftKey
      || event.currentTarget.target
    ) {
      return
    }

    event.preventDefault()
    router.push(href)
    setOpenMobile(false)
  }, [isMobile, router, setOpenMobile])

  return { closeMobileSidebar, navigateFromSidebar }
}

function SidebarRoute({
  route,
  pathname,
  tooltipSide,
}: {
  route: NavigationRoute
  pathname: string
  tooltipSide: "left" | "right"
}) {
  const Icon = routeIcons[route.icon] ?? Home
  const { navigateFromSidebar } = useSidebarNavigation()

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isNavigationRouteActive(pathname, route.href)}
        tooltip={{ children: route.label, side: tooltipSide }}
      >
        <Link href={route.href} onClick={(event) => navigateFromSidebar(event, route.href)}>
          <Icon />
          <span>{route.label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function NavPrimary({ pathname, tooltipSide }: { pathname: string; tooltipSide: "left" | "right" }) {
  return (
    <>
      {primaryGroups.map((group) => {
        if (group.id === "home") {
          return (
            <SidebarGroup key={group.id} className="py-1">
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.routes.map((route) => (
                    <SidebarRoute key={route.id} route={route} pathname={pathname} tooltipSide={tooltipSide} />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )
        }

        return (
          <Collapsible key={group.id} className="group/collapsible">
            <SidebarGroup className="py-1">
              <SidebarSectionTrigger icon={primaryGroupIcons[group.id] ?? FileText} label={group.label} />
              <CollapsibleContent className="group-data-[collapsible=icon]:hidden">
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.routes.map((route) => (
                      <SidebarRoute key={route.id} route={route} pathname={pathname} tooltipSide={tooltipSide} />
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        )
      })}
    </>
  )
}

function CalendarSidebarSection({
  calendarContext,
  pathname,
}: {
  calendarContext: SidebarCalendarContext
  pathname: string
}) {
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(new Date())
  const [selectedTherapistId, setSelectedTherapistId] = React.useState(calendarContext.therapists[0]?.id ?? "")
  const { navigateFromSidebar } = useSidebarNavigation()

  React.useEffect(() => {
    setSelectedTherapistId(calendarContext.therapists[0]?.id ?? "")
  }, [calendarContext.therapists])

  return (
    <Collapsible className="group/collapsible">
      <SidebarGroup className="py-1">
        <SidebarSectionTrigger icon={CalendarDays} label="Calendar" />
        <CollapsibleContent className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupContent className="flex flex-col gap-3">
            {calendarContext.therapists.length > 1 && (
              <Select value={selectedTherapistId} onValueChange={setSelectedTherapistId}>
                <SelectTrigger className="h-8 border-sidebar-border bg-sidebar-accent/40 text-xs">
                  <SelectValue placeholder="Practitioner" />
                </SelectTrigger>
                <SelectContent>
                  {calendarContext.therapists.map((therapist) => (
                    <SelectItem key={therapist.id} value={therapist.id}>
                      {therapist.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => setSelectedDate(date)}
              className="mx-auto w-full rounded-md border border-sidebar-border bg-sidebar-accent/20 p-2 [--cell-size:1.4rem]"
            />
            <SidebarMenu>
              {calendarActions.map((route) => {
                const Icon = routeIcons[route.icon] ?? CalendarDays
                const isActive = route.id === "calendar-availability"
                  ? isNavigationRouteActive(pathname, route.href)
                  : route.id === "calendar-open" && pathname === "/calendar"

                return (
                  <SidebarMenuItem key={route.id}>
                    <SidebarMenuButton asChild size="sm" isActive={isActive}>
                      <Link href={route.href} onClick={(event) => navigateFromSidebar(event, route.href)}>
                        <Icon />
                        <span>{route.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  )
}

function NavSecondary({ pathname }: { pathname: string }) {
  const { navigateFromSidebar } = useSidebarNavigation()

  return (
    <SidebarGroup className="p-0">
      <SidebarGroupContent>
        <SidebarMenu>
          {secondaryRoutes.map((route) => {
            const Icon = routeIcons[route.icon] ?? LifeBuoy

            return (
              <SidebarMenuItem key={route.id}>
                <SidebarMenuButton asChild size="sm" isActive={isNavigationRouteActive(pathname, route.href)}>
                  <Link href={route.href} onClick={(event) => navigateFromSidebar(event, route.href)}>
                    <Icon />
                    <span>{route.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

function AccountMenu({ user, pathname }: { user: SidebarUser; pathname: string }) {
  const { isMobile } = useSidebar()
  const { settings } = useSettings()
  const { closeMobileSidebar, navigateFromSidebar } = useSidebarNavigation()
  const name = user?.name || "Guest"
  const email = user?.email || "Sign in to sync"
  const fallback = initials(name, email)
  const menuSide = isMobile ? "bottom" : settings.sidebarPosition === "right" ? "left" : "right"
  const isAccountRouteActive = accountRoutes.some((route) => isNavigationRouteActive(pathname, route.href))

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              isActive={isAccountRouteActive}
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                {user?.image && <AvatarImage src={user.image} alt={name} />}
                <AvatarFallback className="rounded-lg">{fallback}</AvatarFallback>
              </Avatar>
              <span className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{name}</span>
                <span className="truncate text-xs">{email}</span>
              </span>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={menuSide}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  {user?.image && <AvatarImage src={user.image} alt={name} />}
                  <AvatarFallback className="rounded-lg">{fallback}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{name}</span>
                  <span className="truncate text-xs">{email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {user ? (
              <>
                <DropdownMenuGroup>
                  {accountRoutes.map((route) => {
                    const Icon = routeIcons[route.icon] ?? UserRound

                    return (
                      <DropdownMenuItem key={route.id} asChild>
                        <Link href={route.href} onClick={(event) => navigateFromSidebar(event, route.href)}>
                          <Icon className="mr-2 h-4 w-4" />
                          {route.label}
                        </Link>
                      </DropdownMenuItem>
                    )
                  })}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => {
                  closeMobileSidebar()
                  void signOut({ redirectTo: "/" })
                }}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <Link href="/login" onClick={(event) => navigateFromSidebar(event, "/login")}>
                    <LogIn className="mr-2 h-4 w-4" />
                    Login
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/register" onClick={(event) => navigateFromSidebar(event, "/register")}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Create Account
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings" onClick={(event) => navigateFromSidebar(event, "/settings")}>
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuGroup>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

export function AppSidebarClient({
  user,
  calendarContext,
}: {
  user: SidebarUser
  calendarContext: SidebarCalendarContext
}) {
  const pathname = usePathname() ?? ""
  const { settings } = useSettings()
  const tooltipSide = settings.sidebarPosition === "right" ? "left" : "right"
  const { navigateFromSidebar } = useSidebarNavigation()

  return (
    <Sidebar side={settings.sidebarPosition} collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" className="justify-center data-[state=open]:bg-sidebar-accent">
              <Link href="/" aria-label="MassageLab home" onClick={(event) => navigateFromSidebar(event, "/")}>
                <span className="hidden aspect-square size-8 items-center justify-center rounded-lg border border-sidebar-border bg-sidebar-accent/80 text-sidebar-accent-foreground group-data-[collapsible=icon]:flex">
                  <Image
                    src="/brand/massagelab-mark-square-tight.png"
                    alt=""
                    width={32}
                    height={32}
                    className="h-7 w-7 object-contain"
                    data-testid="sidebar-brand-mark"
                    unoptimized
                    priority
                  />
                </span>
                <Image
                  src="/brand/massagelab-wordmark-uppercase-tight.png"
                  alt="MassageLab"
                  width={180}
                  height={54}
                  className={cn("h-8 w-auto max-w-36 object-contain group-data-[collapsible=icon]:hidden")}
                  data-testid="sidebar-brand-wordmark"
                  unoptimized
                  priority
                />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="gap-0">
        <NavPrimary pathname={pathname} tooltipSide={tooltipSide} />
        <CalendarSidebarSection calendarContext={calendarContext} pathname={pathname} />
      </SidebarContent>
      <SidebarFooter>
        <NavSecondary pathname={pathname} />
        <AccountMenu user={user} pathname={pathname} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
