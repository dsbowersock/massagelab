import * as React from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export const appPageShellClassName = "min-h-screen bg-transparent p-4 sm:p-6 lg:p-8"

export const appPageWidthClassNames = {
  narrow: "max-w-xl",
  prose: "max-w-3xl",
  standard: "max-w-4xl",
  wide: "max-w-6xl",
  full: "max-w-7xl",
} as const

export const appSurfaceClassName =
  "border-border/80 bg-card/95 shadow-xl shadow-black/25 ring-1 ring-white/[0.03] backdrop-blur"

export const appInsetClassName =
  "rounded-md border border-border/80 bg-background/85 shadow-inner shadow-black/10"

export const appCalloutClassName =
  "border-primary/50 bg-primary/10 shadow-sm shadow-primary/10 ring-1 ring-primary/10 backdrop-blur"

export const appActionRowClassName =
  "h-auto w-full items-start justify-start whitespace-normal border-border/80 bg-background/80 p-4 text-left shadow-sm transition hover:border-primary/60 hover:bg-accent"

export const appMediaTileClassName =
  "rounded-md border border-border/80 bg-card/95 shadow-xl shadow-black/20 ring-1 ring-white/[0.03] backdrop-blur"

export const appRailScrollerClassName =
  "-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 [scrollbar-width:none] sm:-mx-6 sm:px-6 [&::-webkit-scrollbar]:hidden"

export type AppPageWidth = keyof typeof appPageWidthClassNames

export function AppPageShell({
  children,
  width = "wide",
  className,
  contentClassName,
}: {
  children: React.ReactNode
  title?: React.ReactNode
  description?: React.ReactNode
  width?: AppPageWidth
  align?: "left" | "center"
  className?: string
  contentClassName?: string
  headingClassName?: string
}) {
  return (
    <div className={cn(appPageShellClassName, className)}>
      <div className={cn("mx-auto flex w-full flex-col gap-6", appPageWidthClassNames[width], contentClassName)}>
        {children}
      </div>
    </div>
  )
}

export function AppSurface({
  id,
  title,
  description,
  icon,
  badge,
  children,
  className,
  headerClassName,
  contentClassName,
}: {
  id?: string
  title?: React.ReactNode
  description?: React.ReactNode
  icon?: React.ReactNode
  badge?: string
  children?: React.ReactNode
  className?: string
  headerClassName?: string
  contentClassName?: string
}) {
  const hasHeader = title || description || icon || badge

  return (
    <Card id={id} className={cn(appSurfaceClassName, className)}>
      {hasHeader ? (
        <CardHeader className={cn("flex flex-col gap-1 space-y-0", headerClassName)}>
          {title || icon || badge ? (
            <div className="flex flex-wrap items-center gap-2">
              {icon ? <span className="text-primary">{icon}</span> : null}
              {title ? <CardTitle className="text-xl">{title}</CardTitle> : null}
              {badge ? (
                <Badge variant="outline" className="border-primary/50 text-primary">
                  {badge}
                </Badge>
              ) : null}
            </div>
          ) : null}
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
      ) : null}
      {children ? <CardContent className={cn("flex flex-col gap-5", !hasHeader && "pt-6", contentClassName)}>{children}</CardContent> : null}
    </Card>
  )
}

export function AppInset({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={cn(appInsetClassName, className)}>{children}</div>
}

export function AppStatusTile({
  label,
  value,
  description,
  href,
}: {
  label: string
  value: string
  description?: string
  href?: string
}) {
  const content = (
    <>
      <p className="text-xs uppercase tracking-normal text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-medium">{value}</p>
      {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
    </>
  )

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          appInsetClassName,
          "block p-3 transition hover:border-primary/60 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
      >
        {content}
      </Link>
    )
  }

  return <AppInset className="p-3">{content}</AppInset>
}

export function AppActionLink({
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
    <Button asChild variant="outline" className={appActionRowClassName}>
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

export function AppNotice({
  title,
  description,
  tone = "default",
  className,
}: {
  title: string
  description?: string
  tone?: "default" | "accent" | "destructive"
  className?: string
}) {
  return (
    <div
      className={cn(
        "rounded-md border p-3 text-sm",
        tone === "default" && "border-border/80 bg-card/95",
        tone === "accent" && "border-primary/50 bg-primary/10",
        tone === "destructive" && "border-destructive/40 bg-destructive/10",
        className,
      )}
    >
      <p className="font-medium">{title}</p>
      {description ? <p className="mt-1 text-muted-foreground">{description}</p> : null}
    </div>
  )
}
