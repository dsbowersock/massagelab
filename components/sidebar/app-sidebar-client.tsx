"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { signOut } from "next-auth/react"
import {
  BadgeDollarSign,
  Brain,
  BookOpen,
  BriefcaseBusiness,
  Calculator,
  CalendarCog,
  CalendarDays,
  CalendarOff,
  ChevronsUpDown,
  ChevronRight,
  Clock,
  ClipboardList,
  FileText,
  Home,
  Info,
  Images,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  LogIn,
  LogOut,
  LucideIcon,
  Map,
  MoreHorizontal,
  Plus,
  Radio,
  Settings,
  Settings2,
  ShieldCheck,
  Timer,
  UserPlus,
  UserRound,
  UsersRound,
  Wind,
  Wrench,
} from "lucide-react"
import { useSettings } from "@/components/providers/settings-provider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
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
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useSidebarCalendarContext } from "@/components/sidebar/sidebar-calendar-provider"
import { isNavigationRouteActive } from "@/lib/navigation"
import { shouldExpandSidebarFromRail } from "@/lib/sidebar-layout"
import { cn } from "@/lib/utils"

export type SidebarUser = {
  name: string
  email: string
  image: string
  quickActionOnboarding?: {
    primaryRole?: unknown
    useCases?: unknown
    quickActions?: unknown
  }
} | null

const routeIcons = {
  BadgeDollarSign,
  Brain,
  BookOpen,
  BriefcaseBusiness,
  Calculator,
  CalendarCog,
  CalendarDays,
  CalendarOff,
  Clock,
  ClipboardList,
  FileText,
  Home,
  Info,
  Images,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  Map,
  Plus,
  Radio,
  Settings,
  Settings2,
  ShieldCheck,
  Timer,
  UserRound,
  UsersRound,
  Wind,
} satisfies Record<string, LucideIcon>

const primaryGroupIcons: Record<string, LucideIcon> = {
  tools: Wrench,
  atmosphere: Radio,
  documentation: FileText,
  education: BookOpen,
  games: Brain,
  about: Info,
}

const sidebarSectionTriggerClass = cn(
  "h-9 cursor-pointer gap-2 px-2 text-sm font-semibold text-sidebar-foreground",
  "hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground data-[state=open]:bg-sidebar-accent/60",
  "group-data-[collapsible=icon]:!mt-0 group-data-[collapsible=icon]:!h-9 group-data-[collapsible=icon]:!w-9",
  "group-data-[collapsible=icon]:!px-0 group-data-[collapsible=icon]:!opacity-100 group-data-[collapsible=icon]:justify-center",
)
const primaryChildRouteListClass = cn(
  "ml-4 mt-1 border-l border-sidebar-border/70 pl-2",
  "group-data-[collapsible=icon]:hidden",
)
const primaryChildRouteButtonClass = cn(
  "h-8 rounded-md px-2 text-[0.8125rem] font-normal text-sidebar-foreground/85",
  "data-[active=true]:font-medium [&>svg]:size-3.5",
)

function SidebarSectionTrigger({
  icon: Icon,
  label,
  onRailOpen,
}: {
  icon: LucideIcon
  label: string
  onRailOpen: () => void
}) {
  const { renderMode, setOpen, state } = useSidebar()

  return (
    <SidebarGroupLabel asChild className={sidebarSectionTriggerClass}>
      <CollapsibleTrigger
        aria-label={label}
        title={label}
        onClick={(event) => {
          if (shouldExpandSidebarFromRail({ renderMode, state })) {
            event.preventDefault()
            onRailOpen()
            setOpen(true)
          }
        }}
      >
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

export type SidebarNavigation = {
  primaryNavigationGroups: NavigationGroup[]
  secondaryNavigationRoutes: NavigationRoute[]
  accountMenuRoutes: NavigationRoute[]
  calendarSidebarActions: NavigationRoute[]
  calendarMenuActions: NavigationRoute[]
}

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
  nested = false,
  route,
  pathname,
  tooltipSide,
}: {
  nested?: boolean
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
        className={cn(nested && primaryChildRouteButtonClass)}
      >
        <Link href={route.href} onClick={(event) => navigateFromSidebar(event, route.href)}>
          <Icon />
          <span>{route.label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function NavPrimary({
  calendarMenuRoutes,
  pathname,
  primaryGroups,
  tooltipSide,
}: {
  calendarMenuRoutes: NavigationRoute[]
  pathname: string
  primaryGroups: NavigationGroup[]
  tooltipSide: "left" | "right"
}) {
  const activeGroupIds = React.useMemo(() => {
    return primaryGroups
      .filter((group) => group.id !== "home")
      .filter((group) => group.routes.some((route) => isNavigationRouteActive(pathname, route.href)))
      .map((group) => group.id)
  }, [pathname, primaryGroups])
  const activeGroupKey = activeGroupIds.join("|")
  const [openGroupIds, setOpenGroupIds] = React.useState<Set<string>>(() => new Set(activeGroupIds))

  React.useEffect(() => {
    if (activeGroupIds.length === 0) {
      return
    }

    setOpenGroupIds((current) => {
      const next = new Set(current)

      for (const groupId of activeGroupIds) {
        next.add(groupId)
      }

      return next
    })
  }, [activeGroupKey, activeGroupIds])

  const setGroupOpen = React.useCallback((groupId: string, isOpen: boolean) => {
    setOpenGroupIds((current) => {
      const next = new Set(current)

      if (isOpen) {
        next.add(groupId)
      } else {
        next.delete(groupId)
      }

      return next
    })
  }, [])

  const expandGroup = React.useCallback((groupId: string) => {
    setGroupOpen(groupId, true)
  }, [setGroupOpen])

  return (
    <>
      {primaryGroups.map((group) => {
        if (group.id === "home") {
          return (
            <SidebarGroup key={group.id} className="py-1">
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.routes.map((route) => (
                    route.id === "calendar" ? (
                      <CalendarSidebarRoute key={route.id} calendarMenuRoutes={calendarMenuRoutes} pathname={pathname} tooltipSide={tooltipSide} />
                    ) : (
                      <SidebarRoute key={route.id} route={route} pathname={pathname} tooltipSide={tooltipSide} />
                    )
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )
        }

        const groupIsOpen = openGroupIds.has(group.id)

        return (
          <Collapsible
            key={group.id}
            open={groupIsOpen}
            onOpenChange={(isOpen) => setGroupOpen(group.id, isOpen)}
            className="group/collapsible"
          >
            <SidebarGroup className="py-1">
              <SidebarSectionTrigger
                icon={primaryGroupIcons[group.id] ?? FileText}
                label={group.label}
                onRailOpen={() => expandGroup(group.id)}
              />
              <CollapsibleContent className="group-data-[collapsible=icon]:hidden">
                <SidebarGroupContent className={primaryChildRouteListClass}>
                  <SidebarMenu className="gap-0.5">
                    {group.routes.map((route) => (
                      route.id === "calendar" ? (
                        <CalendarSidebarRoute key={route.id} nested calendarMenuRoutes={calendarMenuRoutes} pathname={pathname} tooltipSide={tooltipSide} />
                    ) : (
                        <SidebarRoute key={route.id} nested route={route} pathname={pathname} tooltipSide={tooltipSide} />
                      )
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

function formatSidebarCount(count: number) {
  if (count > 99) {
    return "99+"
  }

  return String(count)
}

function CalendarRequestBadges({
  pendingAppointmentRequestCount,
  openWaitlistEntryCount,
}: {
  pendingAppointmentRequestCount: number
  openWaitlistEntryCount: number
}) {
  const hasRequests = pendingAppointmentRequestCount > 0
  const hasWaitlist = openWaitlistEntryCount > 0

  if (!hasRequests && !hasWaitlist) {
    return null
  }

  return (
    <>
      <div className="absolute right-8 top-1/2 flex -translate-y-1/2 items-center gap-1 group-data-[collapsible=icon]:hidden">
        {hasRequests && (
          <Badge
            variant="secondary"
            className="h-5 rounded-full px-1.5 py-0 text-[10px] leading-none"
            title={`${pendingAppointmentRequestCount} pending appointment request${pendingAppointmentRequestCount === 1 ? "" : "s"}`}
          >
            R {formatSidebarCount(pendingAppointmentRequestCount)}
          </Badge>
        )}
        {hasWaitlist && (
          <Badge
            variant="outline"
            className="h-5 rounded-full border-sidebar-border bg-sidebar-accent/60 px-1.5 py-0 text-[10px] leading-none text-sidebar-foreground"
            title={`${openWaitlistEntryCount} open waitlist ${openWaitlistEntryCount === 1 ? "entry" : "entries"}`}
          >
            W {formatSidebarCount(openWaitlistEntryCount)}
          </Badge>
        )}
      </div>
      <span
        aria-hidden="true"
        className="absolute right-1.5 top-1.5 hidden size-1.5 rounded-full bg-primary shadow-[0_0_0_2px_hsl(var(--sidebar-background))] group-data-[collapsible=icon]:block"
      />
    </>
  )
}

function CalendarSidebarRoute({
  calendarMenuRoutes,
  nested = false,
  pathname,
  tooltipSide,
}: {
  calendarMenuRoutes: NavigationRoute[]
  nested?: boolean
  pathname: string
  tooltipSide: "left" | "right"
}) {
  const { isMobile } = useSidebar()
  const { settings } = useSettings()
  const { calendarContext } = useSidebarCalendarContext()
  const { navigateFromSidebar } = useSidebarNavigation()
  const menuSide = isMobile ? "bottom" : settings.sidebarPosition === "right" ? "left" : "right"
  const menuAlign = isMobile ? "end" : "start"
  const pendingAppointmentRequestCount = calendarContext.pendingAppointmentRequestCount ?? 0
  const openWaitlistEntryCount = calendarContext.openWaitlistEntryCount ?? 0

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isNavigationRouteActive(pathname, "/calendar")}
        tooltip={{ children: "Calendar", side: tooltipSide }}
        className={cn("group-has-[[data-sidebar=menu-action]]/menu-item:pr-[5.75rem]", nested && primaryChildRouteButtonClass)}
      >
        <Link href="/calendar" onClick={(event) => navigateFromSidebar(event, "/calendar")}>
          <CalendarDays />
          <span>Calendar</span>
        </Link>
      </SidebarMenuButton>
      <CalendarRequestBadges
        pendingAppointmentRequestCount={pendingAppointmentRequestCount}
        openWaitlistEntryCount={openWaitlistEntryCount}
      />
      {calendarMenuRoutes.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuAction showOnHover aria-label="Calendar actions" data-slot="menu-action-trigger">
              <MoreHorizontal />
            </SidebarMenuAction>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            data-sidebar-floating="true"
            side={menuSide}
            align={menuAlign}
            sideOffset={4}
            className="min-w-56"
          >
            <DropdownMenuLabel>Calendar actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {calendarMenuRoutes.map((route) => {
              const Icon = routeIcons[route.icon] ?? CalendarDays

              return (
                <DropdownMenuItem key={route.id} asChild>
                  <Link href={route.href} onClick={(event) => navigateFromSidebar(event, route.href)}>
                    <Icon className="mr-2 h-4 w-4" />
                    {route.label}
                  </Link>
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </SidebarMenuItem>
  )
}

function NavSecondary({
  compact = false,
  pathname,
  secondaryRoutes,
}: {
  compact?: boolean
  pathname: string
  secondaryRoutes: NavigationRoute[]
}) {
  const { navigateFromSidebar } = useSidebarNavigation()

  if (secondaryRoutes.length === 0) {
    return null
  }

  return (
    <SidebarGroup className="p-0">
      <SidebarGroupContent>
        <SidebarMenu className={cn(compact && "gap-1")}>
          {secondaryRoutes.map((route) => {
            const Icon = routeIcons[route.icon] ?? LifeBuoy

            return (
              <SidebarMenuItem key={route.id}>
                <SidebarMenuButton
                  asChild
                  size="sm"
                  isActive={isNavigationRouteActive(pathname, route.href)}
                  className={cn(compact && "h-8 px-2 text-xs")}
                >
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

function AccountMenu({
  accountRoutes,
  compact = false,
  pathname,
  user,
}: {
  accountRoutes: NavigationRoute[]
  compact?: boolean
  pathname: string
  user: SidebarUser
}) {
  const { isMobile } = useSidebar()
  const { settings } = useSettings()
  const { closeMobileSidebar, navigateFromSidebar } = useSidebarNavigation()
  const name = user?.name || "Guest"
  const email = user?.email || "Sign in to sync"
  const fallback = initials(name, email)
  const menuSide = isMobile ? "bottom" : settings.sidebarPosition === "right" ? "left" : "right"
  const isAccountRouteActive = accountRoutes.some((route) => isNavigationRouteActive(pathname, route.href))
  const supportRoute = accountRoutes.find((route) => route.id === "user-support")

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              isActive={isAccountRouteActive}
              size="lg"
              className={cn(
                "data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground",
                compact && "h-10",
              )}
            >
              <Avatar className={cn("h-8 w-8 rounded-lg", compact && "h-7 w-7")}>
                {user?.image && <AvatarImage src={user.image} alt={name} />}
                <AvatarFallback className="rounded-lg">{fallback}</AvatarFallback>
              </Avatar>
              <span className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-semibold">{name}</span>
                <span className={cn("truncate text-xs", compact && "hidden")}>{email}</span>
              </span>
              <ChevronsUpDown className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            data-sidebar-floating="true"
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
                  <Link href="/account" onClick={(event) => navigateFromSidebar(event, "/account")}>
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                {supportRoute && (
                  <DropdownMenuItem asChild>
                    <Link href={supportRoute.href} onClick={(event) => navigateFromSidebar(event, supportRoute.href)}>
                      <LifeBuoy className="mr-2 h-4 w-4" />
                      {supportRoute.label}
                    </Link>
                  </DropdownMenuItem>
                )}
              </DropdownMenuGroup>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

function SidebarLogoHomeLink({ tooltipSide }: { tooltipSide: "left" | "right" }) {
  const { navigateFromSidebar } = useSidebarNavigation()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href="/"
              aria-label="MassageLab home"
              title="MassageLab home"
              onClick={(event) => navigateFromSidebar(event, "/")}
              className={cn(
                "ml-sidebar-brand-frame flex h-10 w-full items-center justify-center rounded-full border p-1 text-sidebar-accent-foreground shadow-sm transition-[background-color,box-shadow,filter,transform] hover:brightness-105",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                "group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0",
              )}
            >
              <Image
                src="/brand/massagelab-mark-square-tight-20260622.png"
                alt=""
                width={32}
                height={32}
                className="hidden object-contain group-data-[collapsible=icon]:block"
                data-testid="sidebar-brand-mark-trigger"
                sizes="32px"
                loading="eager"
              />
              <Image
                src="/brand/massagelab-wordmark-uppercase-tight-20260622.png"
                alt=""
                width={180}
                height={54}
                className="h-8 w-auto max-w-36 object-contain group-data-[collapsible=icon]:hidden"
                data-testid="sidebar-brand-wordmark-trigger"
                sizes="180px"
                loading="eager"
              />
              <span className="sr-only">MassageLab home</span>
            </Link>
          </TooltipTrigger>
          <TooltipContent side={tooltipSide}>MassageLab home</TooltipContent>
        </Tooltip>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

export function AppSidebarClient({
  navigation,
  user,
}: {
  navigation: SidebarNavigation
  user: SidebarUser
}) {
  const pathname = usePathname() ?? ""
  const { settings } = useSettings()
  const { renderMode, setOpen } = useSidebar()
  const tooltipSide = settings.sidebarPosition === "right" ? "left" : "right"
  const { navigateFromSidebar } = useSidebarNavigation()
  const isDrawer = renderMode === "drawer"
  const isCompactLandscape = renderMode === "compact-rail"
  const previousPathnameRef = React.useRef(pathname)

  React.useEffect(() => {
    if (previousPathnameRef.current === pathname) {
      return
    }

    previousPathnameRef.current = pathname

    if (renderMode !== "drawer") {
      setOpen(false)
    }
  }, [pathname, renderMode, setOpen])

  return (
    <Sidebar side={settings.sidebarPosition} collapsible="icon">
      {isDrawer ? (
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild size="lg" className="justify-center data-[state=open]:bg-sidebar-accent">
                <Link href="/" aria-label="MassageLab home" onClick={(event) => navigateFromSidebar(event, "/")}>
                  <span className="ml-sidebar-brand-frame hidden aspect-square size-8 items-center justify-center rounded-full border text-sidebar-accent-foreground group-data-[collapsible=icon]:flex">
                    <Image
                      src="/brand/massagelab-mark-square-tight-20260622.png"
                      alt=""
                      width={28}
                      height={28}
                      className="object-contain"
                      data-testid="sidebar-brand-mark"
                      sizes="28px"
                      loading="eager"
                    />
                  </span>
                  <Image
                    src="/brand/massagelab-wordmark-uppercase-tight-20260622.png"
                    alt="MassageLab"
                    width={180}
                    height={54}
                    className={cn("h-8 w-auto max-w-36 object-contain group-data-[collapsible=icon]:hidden")}
                    data-testid="sidebar-brand-wordmark"
                    sizes="180px"
                    loading="eager"
                  />
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
      ) : (
        <SidebarHeader>
          <SidebarLogoHomeLink tooltipSide={tooltipSide} />
        </SidebarHeader>
      )}
      {isCompactLandscape ? (
        <>
          <SidebarContent
            className={cn(
              "gap-0 group-data-[state=expanded]:grid group-data-[state=expanded]:overflow-hidden",
              settings.sidebarPosition === "right"
                ? "group-data-[state=expanded]:grid-cols-[10rem_minmax(0,1fr)]"
                : "group-data-[state=expanded]:grid-cols-[minmax(0,1fr)_10rem]",
            )}
          >
            <div className={cn(
              "min-h-0 overflow-auto",
              settings.sidebarPosition === "right" && "group-data-[state=expanded]:order-2",
            )}>
              <NavPrimary
                calendarMenuRoutes={navigation.calendarMenuActions}
                pathname={pathname}
                primaryGroups={navigation.primaryNavigationGroups}
                tooltipSide={tooltipSide}
              />
            </div>
            <div
              className={cn(
                "hidden min-h-0 flex-col p-2 group-data-[state=expanded]:flex",
                "justify-end",
                settings.sidebarPosition === "right"
                  ? "border-r border-sidebar-border group-data-[state=expanded]:order-1"
                  : "border-l border-sidebar-border group-data-[state=expanded]:order-2",
              )}
            >
              <div className="flex flex-col gap-2">
                <NavSecondary pathname={pathname} secondaryRoutes={navigation.secondaryNavigationRoutes} compact />
                <AccountMenu accountRoutes={navigation.accountMenuRoutes} user={user} pathname={pathname} compact />
              </div>
            </div>
          </SidebarContent>
          <SidebarFooter className="group-data-[state=expanded]:hidden">
            <AccountMenu accountRoutes={navigation.accountMenuRoutes} user={user} pathname={pathname} compact />
          </SidebarFooter>
        </>
      ) : (
        <>
          <SidebarContent className="gap-0">
            <NavPrimary
              calendarMenuRoutes={navigation.calendarMenuActions}
              pathname={pathname}
              primaryGroups={navigation.primaryNavigationGroups}
              tooltipSide={tooltipSide}
            />
          </SidebarContent>
          <SidebarFooter className={cn(isDrawer && "gap-2 border-t border-sidebar-border")}>
            <NavSecondary pathname={pathname} secondaryRoutes={navigation.secondaryNavigationRoutes} />
            <AccountMenu accountRoutes={navigation.accountMenuRoutes} user={user} pathname={pathname} />
          </SidebarFooter>
        </>
      )}
      <SidebarRail />
    </Sidebar>
  )
}
