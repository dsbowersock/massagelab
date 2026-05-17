import * as React from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export const settingsSurfaceClassName =
  "border-border/80 bg-card/95 shadow-xl shadow-black/25 ring-1 ring-white/[0.03] backdrop-blur"

export const settingsInsetClassName =
  "rounded-md border border-border/80 bg-background/85 shadow-inner shadow-black/10"

export function SettingsSurface({
  id,
  title,
  description,
  icon,
  badge,
  children,
  className,
  contentClassName,
}: {
  id?: string
  title: string
  description?: string
  icon?: React.ReactNode
  badge?: string
  children: React.ReactNode
  className?: string
  contentClassName?: string
}) {
  return (
    <Card id={id} className={cn(settingsSurfaceClassName, className)}>
      <CardHeader className="flex flex-col gap-1 space-y-0">
        <div className="flex flex-wrap items-center gap-2">
          {icon ? <span className="text-primary">{icon}</span> : null}
          <CardTitle className="text-xl">{title}</CardTitle>
          {badge ? (
            <Badge variant="outline" className="border-primary/50 text-primary">
              {badge}
            </Badge>
          ) : null}
        </div>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className={cn("flex flex-col gap-5", contentClassName)}>{children}</CardContent>
    </Card>
  )
}

export function SettingsStatusTile({
  label,
  value,
  description,
}: {
  label: string
  value: string
  description?: string
}) {
  return (
    <div className={cn(settingsInsetClassName, "p-3")}>
      <p className="text-xs uppercase tracking-normal text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-medium">{value}</p>
      {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
    </div>
  )
}

export function SettingsActionLink({
  href,
  icon,
  title,
  description,
  badge,
}: {
  href: string
  icon?: React.ReactNode
  title: string
  description: string
  badge?: string
}) {
  return (
    <Button
      asChild
      variant="outline"
      className="h-auto w-full items-start justify-start whitespace-normal border-border/80 bg-background/80 p-4 text-left shadow-sm transition hover:border-primary/60 hover:bg-accent"
    >
      <Link href={href}>
        <span className="flex min-w-0 flex-1 items-start gap-3">
          {icon ? <span className="mt-0.5 shrink-0 text-primary">{icon}</span> : null}
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
              {title}
              {badge ? (
                <Badge variant="secondary" className="shrink-0">
                  {badge}
                </Badge>
              ) : null}
            </span>
            <span className="mt-1 block text-sm font-normal leading-5 text-muted-foreground">{description}</span>
          </span>
          <ChevronRight data-icon="inline-end" className="mt-0.5 shrink-0" aria-hidden="true" />
        </span>
      </Link>
    </Button>
  )
}

export function SettingsSectionSeparator() {
  return <Separator className="bg-border/80" />
}
