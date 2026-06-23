import * as React from "react"
import {
  AppActionLink,
  AppStatusTile,
  AppSurface,
  appInsetClassName,
  appSurfaceClassName,
} from "@/components/ui/app-surface"
import { Separator } from "@/components/ui/separator"

export const settingsSurfaceClassName = appSurfaceClassName

export const settingsInsetClassName = appInsetClassName

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
    <AppSurface
      id={id}
      title={title}
      description={description}
      icon={icon}
      badge={badge}
      className={className}
      contentClassName={contentClassName}
    >
      {children}
    </AppSurface>
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
    <AppStatusTile label={label} value={value} description={description} />
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
    <AppActionLink href={href} icon={icon} title={title} description={description} badge={badge} />
  )
}

export function SettingsSectionSeparator() {
  return <Separator className="bg-border/80" />
}

export function SettingsCompactRow({
  icon,
  title,
  description,
  trailing,
}: {
  icon?: React.ReactNode
  title: string
  description?: string
  trailing?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {icon ? <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border/70 text-primary">{icon}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        {description ? <span className="mt-0.5 block truncate text-xs text-muted-foreground">{description}</span> : null}
      </span>
      {trailing}
    </div>
  )
}
