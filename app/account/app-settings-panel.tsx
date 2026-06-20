"use client"

import { Layout, Monitor, Moon, PanelBottom, PanelLeft, PanelTop, Sun, UserRound } from "lucide-react"
import type { AppBarPosition, ThemeMode } from "@/components/providers/settings-provider"
import { useSettings } from "@/components/providers/settings-provider"
import { useTherapistSettings } from "@/components/providers/therapist-settings-provider"
import { getSidebarButtonPosition, resolveSidebarButtonSettings } from "@/lib/app-settings"
import { cn } from "@/lib/utils"
import { SettingsSectionSeparator, SettingsSurface } from "@/components/account/settings-surfaces"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

const sidebarButtonPositions = [
  {
    value: "top-left",
    label: "Upper left",
    description: "Sidebar button starts near the top on the left edge.",
  },
  {
    value: "top-right",
    label: "Upper right",
    description: "Sidebar button starts near the top on the right edge.",
  },
  {
    value: "bottom-left",
    label: "Bottom left",
    description: "Sidebar button stays near the bottom on the left edge.",
  },
  {
    value: "bottom-right",
    label: "Bottom right",
    description: "Sidebar button stays near the bottom on the right edge.",
  },
]

const appBarPositions = [
  {
    value: "top",
    label: "Top",
    description: "Breadcrumb and theme controls stay at the top; the audio player sits at the bottom.",
    icon: PanelTop,
  },
  {
    value: "bottom",
    label: "Bottom",
    description: "Breadcrumb and theme controls move to the bottom; the audio player sits at the top.",
    icon: PanelBottom,
  },
]

const themeModes = [
  {
    value: "system",
    label: "System",
    description: "Follow this device's light or dark preference.",
    icon: Monitor,
  },
  {
    value: "dark",
    label: "Dark",
    description: "Use the darker MassageLab interface.",
    icon: Moon,
  },
  {
    value: "light",
    label: "Light",
    description: "Use the lighter MassageLab interface.",
    icon: Sun,
  },
]

export function AccountAppSettingsPanel() {
  const { settings, updateSettings } = useSettings()
  const sidebarButtonPosition = getSidebarButtonPosition(settings)

  return (
    <div className="flex flex-col gap-5">
      <SettingsSurface
        id="app-layout-settings"
        title="Layout and sidebar"
        description="Choose the app bar edge, audio player edge, and portrait sidebar button placement."
        icon={<Layout data-icon="inline-start" aria-hidden="true" />}
      >
        <div className="flex flex-col gap-3">
          <Label className="text-base">App bar position</Label>
          <RadioGroup
            value={settings.appBarPosition}
            onValueChange={(value) => updateSettings({ appBarPosition: value as AppBarPosition })}
            className="grid gap-3 sm:grid-cols-2"
          >
            {appBarPositions.map((option) => {
              const Icon = option.icon

              return (
                <label
                  key={option.value}
                  htmlFor={`app-bar-${option.value}`}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-md border border-border/80 bg-background/80 p-3 text-left shadow-sm transition hover:border-primary/60 hover:bg-accent",
                    settings.appBarPosition === option.value && "border-primary/70 bg-primary/10 shadow-md shadow-primary/10",
                  )}
                >
                  <RadioGroupItem id={`app-bar-${option.value}`} value={option.value} className="mt-1" />
                  <Icon data-icon="inline-start" className="mt-0.5 text-primary" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{option.label}</span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">{option.description}</span>
                  </span>
                </label>
              )
            })}
          </RadioGroup>
        </div>

        <div className="flex flex-col gap-3">
          <Label className="text-base">Sidebar button position</Label>
          <RadioGroup
            value={sidebarButtonPosition}
            onValueChange={(value) => updateSettings(resolveSidebarButtonSettings(value))}
            className="grid gap-3 sm:grid-cols-2"
          >
            {sidebarButtonPositions.map((option) => (
              <label
                key={option.value}
                htmlFor={`sidebar-${option.value}`}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-md border border-border/80 bg-background/80 p-3 text-left shadow-sm transition hover:border-primary/60 hover:bg-accent",
                  sidebarButtonPosition === option.value && "border-primary/70 bg-primary/10 shadow-md shadow-primary/10",
                )}
              >
                <RadioGroupItem id={`sidebar-${option.value}`} value={option.value} className="mt-1" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{option.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">{option.description}</span>
                </span>
              </label>
            ))}
          </RadioGroup>
        </div>
      </SettingsSurface>

      <SettingsSurface
        id="app-theme-settings"
        title="Theme"
        description="Set the app color mode for this browser."
        icon={<PanelLeft data-icon="inline-start" aria-hidden="true" />}
      >
        <RadioGroup
          value={settings.themeMode}
          onValueChange={(value) => updateSettings({ themeMode: value as ThemeMode })}
          className="grid gap-3 sm:grid-cols-3"
        >
          {themeModes.map((option) => {
            const Icon = option.icon

            return (
              <label
                key={option.value}
                htmlFor={`theme-${option.value}`}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-md border border-border/80 bg-background/80 p-3 text-left shadow-sm transition hover:border-primary/60 hover:bg-accent",
                  settings.themeMode === option.value && "border-primary/70 bg-primary/10 shadow-md shadow-primary/10",
                )}
              >
                <RadioGroupItem id={`theme-${option.value}`} value={option.value} className="mt-1" />
                <Icon data-icon="inline-start" className="mt-0.5 text-primary" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{option.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">{option.description}</span>
                </span>
              </label>
            )
          })}
        </RadioGroup>
      </SettingsSurface>
    </div>
  )
}

export function LocalTherapistDefaultsPanel() {
  const { settings, updateSettings } = useTherapistSettings()

  return (
    <SettingsSurface
      id="local-therapist-defaults"
      title="Local therapist defaults"
      description="These values stay in this browser and pre-fill documentation fields on this device."
      icon={<UserRound data-icon="inline-start" aria-hidden="true" />}
    >
      <div className="grid gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="local-therapist-name">Full name</Label>
          <Input
            id="local-therapist-name"
            value={settings.name}
            onChange={(event) => updateSettings({ name: event.target.value })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="local-therapist-location">Practice location</Label>
          <Input
            id="local-therapist-location"
            value={settings.location}
            onChange={(event) => updateSettings({ location: event.target.value })}
          />
        </div>
      </div>

      <SettingsSectionSeparator />

      <div className="grid gap-5 md:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="local-license-number">License number</Label>
          <Input
            id="local-license-number"
            value={settings.licenseNumber}
            onChange={(event) => updateSettings({ licenseNumber: event.target.value })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="local-license-organization">Licensing organization</Label>
          <Input
            id="local-license-organization"
            value={settings.licenseOrganization}
            onChange={(event) => updateSettings({ licenseOrganization: event.target.value })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="local-npi-number">NPI number</Label>
          <Input
            id="local-npi-number"
            value={settings.npiNumber}
            onChange={(event) => updateSettings({ npiNumber: event.target.value })}
          />
        </div>
      </div>

      <div>
        <Button
          type="button"
          variant="outline"
          onClick={() => updateSettings({
            name: "",
            location: "",
            licenseNumber: "",
            licenseOrganization: "",
            npiNumber: "",
          })}
        >
          Clear local therapist info
        </Button>
      </div>
    </SettingsSurface>
  )
}
