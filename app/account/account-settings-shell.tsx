"use client"

import * as React from "react"
import Link from "next/link"
import {
  Accessibility,
  ArrowLeft,
  BadgeCheck,
  Bell,
  Building2,
  CalendarDays,
  ChevronRight,
  CreditCard,
  ExternalLink,
  FileCheck2,
  KeyRound,
  LucideIcon,
  ReceiptText,
  Search,
  Settings2,
  UserRound,
  UsersRound,
} from "lucide-react"
import { filterAccountPageGroups } from "@/lib/account-page"
import { cn } from "@/lib/utils"
import { settingsSurfaceClassName } from "@/components/account/settings-surfaces"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tabs } from "@/components/ui/tabs"

type AccountNavigationStatus = "current" | "planned" | "link"

type AccountNavigationItem = {
  id: string
  label: string
  description: string
  icon: string
  status: AccountNavigationStatus | string
  statusLabel: string
  href?: string
  sections: string[]
}

type AccountNavigationGroup = {
  id: string
  label: string
  description: string
  items: AccountNavigationItem[]
}

type AccountSettingsShellProps = {
  children: React.ReactNode
  defaultValue: string
  groups: AccountNavigationGroup[]
  itemStatuses: Record<string, string>
  showMobileIndexFirst: boolean
  user: {
    name: string
    email: string
    image?: string | null
  }
}

const accountShellIcons = {
  Accessibility,
  BadgeCheck,
  Bell,
  Building2,
  CalendarDays,
  CreditCard,
  FileCheck2,
  KeyRound,
  ReceiptText,
  Settings2,
  UserRound,
  UsersRound,
} satisfies Record<string, LucideIcon>

export function AccountSettingsShell({
  children,
  defaultValue,
  groups,
  itemStatuses,
  showMobileIndexFirst,
  user,
}: AccountSettingsShellProps) {
  const [activeSection, setActiveSection] = React.useState(defaultValue)
  const [query, setQuery] = React.useState("")
  const [mobileIndexVisible, setMobileIndexVisible] = React.useState(showMobileIndexFirst)
  const shellRef = React.useRef<HTMLDivElement | null>(null)
  const filteredGroups = filterAccountPageGroups(query, groups as never) as AccountNavigationGroup[]
  const activeItem = groups
    .flatMap((group) => group.items)
    .find((item) => item.id === activeSection)

  function chooseSection(id: string) {
    setActiveSection(id)
    setMobileIndexVisible(false)

    const url = new URL(window.location.href)
    url.search = ""
    url.searchParams.set("tab", id)
    window.history.replaceState(null, "", url.toString())

    window.requestAnimationFrame(() => {
      shellRef.current?.scrollIntoView({ block: "start" })
    })
  }

  function showMobileIndex() {
    setMobileIndexVisible(true)

    window.requestAnimationFrame(() => {
      shellRef.current?.scrollIntoView({ block: "start" })
    })
  }

  return (
    <Tabs value={activeSection} onValueChange={chooseSection} className="min-w-0">
      <div ref={shellRef} className="min-w-0">
        <div className={cn(
          "flex flex-col gap-5 md:grid md:grid-cols-[18rem_minmax(0,1fr)] md:items-start md:gap-6",
          mobileIndexVisible && "hidden md:grid",
        )}>
          <AccountRail
            activeSection={activeSection}
            groups={filteredGroups}
            itemStatuses={itemStatuses}
            onChooseSection={chooseSection}
            query={query}
            setQuery={setQuery}
            user={user}
          />

          <div className="min-w-0">
            <div className="mb-4 flex items-center gap-3 md:hidden">
              <Button type="button" variant="ghost" size="icon" onClick={showMobileIndex} aria-label="Back to account settings">
                <ArrowLeft data-icon="inline-start" />
              </Button>
              <div className="min-w-0">
                <p className="truncate text-sm text-muted-foreground">Account</p>
                <h2 className="truncate text-xl font-semibold">{activeItem?.label ?? "Account"}</h2>
              </div>
            </div>
            {children}
          </div>
        </div>

        <div className={cn("md:hidden", !mobileIndexVisible && "hidden")}>
          <MobileAccountIndex
            activeSection={activeSection}
            groups={filteredGroups}
            itemStatuses={itemStatuses}
            onChooseSection={chooseSection}
            query={query}
            setQuery={setQuery}
            user={user}
          />
        </div>
      </div>
    </Tabs>
  )
}

function AccountRail({
  activeSection,
  groups,
  itemStatuses,
  onChooseSection,
  query,
  setQuery,
  user,
}: {
  activeSection: string
  groups: AccountNavigationGroup[]
  itemStatuses: Record<string, string>
  onChooseSection: (id: string) => void
  query: string
  setQuery: (query: string) => void
  user: AccountSettingsShellProps["user"]
}) {
  return (
    <aside className="hidden md:sticky md:top-4 md:block">
      <Card className={settingsSurfaceClassName}>
        <CardHeader className="p-4">
          <div className="flex items-center gap-3">
            <Avatar className="size-10 rounded-lg">
              {user.image ? <AvatarImage src={user.image} alt={user.name} /> : null}
              <AvatarFallback className="rounded-lg">{initials(user.name, user.email)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <CardTitle className="truncate text-base">{user.name}</CardTitle>
              <CardDescription className="truncate">{user.email}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 p-4 pt-0">
          <AccountSearchInput query={query} setQuery={setQuery} />
          <ScrollArea className="max-h-[calc(100vh-13rem)] pr-3">
            <AccountNavGroups
              activeSection={activeSection}
              groups={groups}
              itemStatuses={itemStatuses}
              onChooseSection={onChooseSection}
              variant="rail"
            />
          </ScrollArea>
        </CardContent>
      </Card>
    </aside>
  )
}

function MobileAccountIndex({
  activeSection,
  groups,
  itemStatuses,
  onChooseSection,
  query,
  setQuery,
  user,
}: {
  activeSection: string
  groups: AccountNavigationGroup[]
  itemStatuses: Record<string, string>
  onChooseSection: (id: string) => void
  query: string
  setQuery: (query: string) => void
  user: AccountSettingsShellProps["user"]
}) {
  return (
    <div className="flex flex-col gap-5">
      <Card className={settingsSurfaceClassName}>
        <CardHeader className="p-4">
          <div className="flex items-center gap-3">
            <Avatar className="size-12 rounded-lg">
              {user.image ? <AvatarImage src={user.image} alt={user.name} /> : null}
              <AvatarFallback className="rounded-lg">{initials(user.name, user.email)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <CardTitle className="truncate text-xl">{user.name}</CardTitle>
              <CardDescription className="truncate">{user.email}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <AccountSearchInput query={query} setQuery={setQuery} />
        </CardContent>
      </Card>

      <AccountNavGroups
        activeSection={activeSection}
        groups={groups}
        itemStatuses={itemStatuses}
        onChooseSection={onChooseSection}
        variant="mobile"
      />
    </div>
  )
}

function AccountSearchInput({
  query,
  setQuery,
}: {
  query: string
  setQuery: (query: string) => void
}) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <Input
        aria-label="Search account settings"
        className="pl-9"
        placeholder="Search account settings"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
    </div>
  )
}

function AccountNavGroups({
  activeSection,
  groups,
  itemStatuses,
  onChooseSection,
  variant,
}: {
  activeSection: string
  groups: AccountNavigationGroup[]
  itemStatuses: Record<string, string>
  onChooseSection: (id: string) => void
  variant: "rail" | "mobile"
}) {
  if (groups.length === 0) {
    return (
      <Card className={settingsSurfaceClassName}>
        <CardContent className="p-4 text-sm text-muted-foreground">
          No account settings match that search.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={cn("flex flex-col", variant === "rail" ? "gap-5" : "gap-4")}>
      {groups.map((group) => (
        <section key={group.id} className={cn(variant === "mobile" && cn("rounded-lg", settingsSurfaceClassName))}>
          <div className={cn("flex flex-col gap-1", variant === "mobile" ? "p-4 pb-2" : "pb-2")}>
            <h3 className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">{group.label}</h3>
            {variant === "mobile" ? <p className="text-sm text-muted-foreground">{group.description}</p> : null}
          </div>
          <div className="flex flex-col">
            {group.items.map((item, index) => (
              <React.Fragment key={item.id}>
                <AccountNavItem
                  active={activeSection === item.id}
                  item={item}
                  statusText={itemStatuses[item.id] ?? item.statusLabel}
                  onChooseSection={onChooseSection}
                  variant={variant}
                />
                {variant === "mobile" && index < group.items.length - 1 ? <Separator /> : null}
              </React.Fragment>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function AccountNavItem({
  active,
  item,
  statusText,
  onChooseSection,
  variant,
}: {
  active: boolean
  item: AccountNavigationItem
  statusText: string
  onChooseSection: (id: string) => void
  variant: "rail" | "mobile"
}) {
  const Icon = accountShellIcons[item.icon as keyof typeof accountShellIcons] ?? UserRound
  const content = (
    <>
      <span className={cn(
        "flex shrink-0 items-center justify-center rounded-md border border-transparent text-muted-foreground",
        variant === "mobile" ? "size-9" : "size-8",
        active && "border-primary/50 bg-primary/15 text-primary shadow-sm shadow-primary/10",
      )}>
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium">{item.label}</span>
          {item.status === "planned" ? <Badge variant="outline" className="shrink-0 border-brand-orange/40 text-brand-orange">Planned</Badge> : null}
        </span>
        <span className={cn("mt-0.5 block text-xs text-muted-foreground", variant === "rail" ? "line-clamp-2" : "line-clamp-1")}>
          {statusText || item.description}
        </span>
      </span>
      {item.status === "link" ? (
        <ExternalLink className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      ) : (
        <ChevronRight className={cn("size-4 shrink-0 text-muted-foreground", variant === "rail" && item.status === "current" && "hidden")} aria-hidden="true" />
      )}
    </>
  )
  const className = cn(
    "flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors",
    active
      ? "border-primary/60 bg-primary/15 text-foreground shadow-sm shadow-primary/10"
      : "border-transparent text-foreground hover:border-border/80 hover:bg-accent hover:text-accent-foreground",
    item.status === "planned" && "cursor-default opacity-80 hover:bg-transparent hover:text-foreground",
    variant === "mobile" && "rounded-none px-4 py-4",
  )

  if (item.href) {
    return (
      <Link href={item.href} className={className}>
        {content}
      </Link>
    )
  }

  if (item.status === "planned") {
    return (
      <div className={className} aria-disabled="true">
        {content}
      </div>
    )
  }

  return (
    <button type="button" className={className} onClick={() => onChooseSection(item.id)}>
      {content}
    </button>
  )
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
