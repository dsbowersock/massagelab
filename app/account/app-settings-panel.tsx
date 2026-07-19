"use client"

import { Layout, Monitor, Moon, PanelBottom, PanelLeft, PanelRight, PanelTop, Sun, UserRound, Waves } from "lucide-react"
import type { AmbientMotionMode, AppBarPosition, SidebarPosition, ThemeMode } from "@/components/providers/settings-provider"
import { useSettings } from "@/components/providers/settings-provider"
import { useTherapistSettings } from "@/components/providers/therapist-settings-provider"
import { cn } from "@/lib/utils"
import { SettingsSectionSeparator, SettingsSurface } from "@/components/account/settings-surfaces"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ToggleControl } from "@/components/ui/toggle-control"

const sidebarSides = [
  {
    value: "left",
    label: "Left",
    description: "Keep the drawer button and sidebar on the left edge.",
    icon: PanelLeft,
  },
  {
    value: "right",
    label: "Right",
    description: "Keep the drawer button and sidebar on the right edge.",
    icon: PanelRight,
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

const ambientMotionModes = [
  {
    value: "system",
    label: "System",
    description: "Follow this device's reduced-motion preference.",
    icon: Monitor,
  },
  {
    value: "reduced",
    label: "Low motion",
    description: "Use static visual backgrounds in MassageLab.",
    icon: Waves,
  },
]

export function AccountAppSettingsPanel() {
  const { settings, updateSettings } = useSettings()

  return (
    <div className="flex flex-col gap-5">
      <SettingsSurface
        id="app-layout-settings"
        title="Layout and sidebar"
        description="Choose the main bar edge, drawer side, theme behavior, and quick-action defaults."
        icon={<Layout data-icon="inline-start" aria-hidden="true" />}
      >
        <div className="flex flex-col gap-3">
          <Label className="text-base">App bar position</Label>
          <RadioGroup
            value={settings.appBarPosition}
            onValueChange={(value) => updateSettings({
              appBarPosition: value as AppBarPosition,
              sidebarTriggerPosition: value as AppBarPosition,
            })}
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
          <Label className="text-base">Sidebar side</Label>
          <RadioGroup
            value={settings.sidebarPosition}
            onValueChange={(value) => updateSettings({ sidebarPosition: value as SidebarPosition })}
            className="grid gap-3 sm:grid-cols-2"
          >
            {sidebarSides.map((option) => {
              const Icon = option.icon

              return (
                <label
                  key={option.value}
                  htmlFor={`sidebar-${option.value}`}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-md border border-border/80 bg-background/80 p-3 text-left shadow-sm transition hover:border-primary/60 hover:bg-accent",
                    settings.sidebarPosition === option.value && "border-primary/70 bg-primary/10 shadow-md shadow-primary/10",
                  )}
                >
                  <RadioGroupItem id={`sidebar-${option.value}`} value={option.value} className="mt-1" />
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

        <div className="rounded-md border border-border/80 bg-background/80 p-3 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Quick actions</p>
          <p className="mt-1">
            The global plus button starts with role-aware defaults from onboarding. Full drag-and-drop customization can build on the saved quick-action keys in app preferences.
          </p>
        </div>
      </SettingsSurface>

      <SettingsSurface
        id="app-theme-settings"
        title="Theme and motion"
        description="Set the app color mode and ambient visual motion for this browser."
        icon={<PanelLeft data-icon="inline-start" aria-hidden="true" />}
      >
        <div className="flex flex-col gap-3">
          <Label className="text-base">Color mode</Label>
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
        </div>

        <SettingsSectionSeparator />

        <div className="flex flex-col gap-3">
          <Label className="text-base">Visual background motion</Label>
          <RadioGroup
            value={settings.ambientMotionMode}
            onValueChange={(value) => updateSettings({ ambientMotionMode: value as AmbientMotionMode })}
            className="grid gap-3 sm:grid-cols-2"
          >
            {ambientMotionModes.map((option) => {
              const Icon = option.icon

              return (
                <label
                  key={option.value}
                  htmlFor={`ambient-motion-${option.value}`}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-md border border-border/80 bg-background/80 p-3 text-left shadow-sm transition hover:border-primary/60 hover:bg-accent",
                    settings.ambientMotionMode === option.value && "border-primary/70 bg-primary/10 shadow-md shadow-primary/10",
                  )}
                >
                  <RadioGroupItem id={`ambient-motion-${option.value}`} value={option.value} className="mt-1" />
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
      </SettingsSurface>

      <SettingsSurface
        id="app-haptics-settings"
        title="Input feedback"
        description="Enable subtle haptic feedback for button presses where supported."
        icon={<Waves data-icon="inline-start" aria-hidden="true" />}
      >
        <ToggleControl
          label="Haptic feedback"
          description="Enable subtle vibration on key UI taps, if supported by the device."
          checked={settings.hapticFeedbackEnabled}
          onCheckedChange={(checked) => updateSettings({ hapticFeedbackEnabled: checked })}
        />
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
