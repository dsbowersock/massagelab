"use client"

import { Layout, Moon, Sun, UserRound } from "lucide-react"
import { useSettings } from "@/components/providers/settings-provider"
import { useTherapistSettings } from "@/components/providers/therapist-settings-provider"
import { getSidebarButtonPosition, resolveSidebarButtonSettings } from "@/lib/app-settings"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageHeading } from "@/components/ui/page-heading"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function SettingsPage() {
  const { settings, updateSettings } = useSettings()
  const { settings: therapistSettings, updateSettings: updateTherapistSettings } = useTherapistSettings()
  const sidebarButtonPosition = getSidebarButtonPosition(settings)

  return (
    <div className="min-h-screen bg-transparent p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeading>Settings</PageHeading>

        <Tabs defaultValue="layout" className="w-full">
          <TabsList className="grid h-auto grid-cols-2 gap-3 bg-transparent">
            <TabsTrigger value="layout" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Layout className="h-4 w-4" />
              Layout
            </TabsTrigger>
            <TabsTrigger value="therapist" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <UserRound className="h-4 w-4" />
              Therapist Info
            </TabsTrigger>
          </TabsList>

          <TabsContent value="layout" className="mt-6">
            <Card className="bg-card/90 backdrop-blur">
              <CardHeader>
                <CardTitle>Layout</CardTitle>
                <CardDescription>Choose where the sidebar button sits and how the app should look.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <Label className="text-base">Sidebar Button Position</Label>
                  <RadioGroup
                    value={sidebarButtonPosition}
                    onValueChange={(value) => updateSettings(resolveSidebarButtonSettings(value))}
                    className="grid gap-2 sm:grid-cols-2"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="top-left" id="sidebar-top-left" />
                      <Label htmlFor="sidebar-top-left">Upper Left</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="top-right" id="sidebar-top-right" />
                      <Label htmlFor="sidebar-top-right">Upper Right</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="bottom-left" id="sidebar-bottom-left" />
                      <Label htmlFor="sidebar-bottom-left">Bottom Left</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="bottom-right" id="sidebar-bottom-right" />
                      <Label htmlFor="sidebar-bottom-right">Bottom Right</Label>
                    </div>
                  </RadioGroup>
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-base">Color Theme</Label>
                  <RadioGroup
                    value={settings.themeMode}
                    onValueChange={(value) => updateSettings({ themeMode: value as "dark" | "light" })}
                    className="flex flex-col gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="dark" id="theme-dark" />
                      <Label htmlFor="theme-dark" className="flex items-center gap-2">
                        <Moon className="h-4 w-4" />
                        Dark
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="light" id="theme-light" />
                      <Label htmlFor="theme-light" className="flex items-center gap-2">
                        <Sun className="h-4 w-4" />
                        Light
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="therapist" className="mt-6">
            <Card className="bg-card/90 backdrop-blur">
              <CardHeader>
                <CardTitle>Therapist Information</CardTitle>
                <CardDescription>Stored locally and used to pre-fill documentation on this device.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="therapistName">Full Name</Label>
                  <Input
                    id="therapistName"
                    value={therapistSettings.name}
                    onChange={(event) => updateTherapistSettings({ name: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Practice Location</Label>
                  <Input
                    id="location"
                    value={therapistSettings.location}
                    onChange={(event) => updateTherapistSettings({ location: event.target.value })}
                  />
                </div>
                <div className="grid gap-5 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="licenseNumber">License Number</Label>
                    <Input
                      id="licenseNumber"
                      value={therapistSettings.licenseNumber}
                      onChange={(event) => updateTherapistSettings({ licenseNumber: event.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="licenseOrganization">Licensing Organization</Label>
                    <Input
                      id="licenseOrganization"
                      value={therapistSettings.licenseOrganization}
                      onChange={(event) => updateTherapistSettings({ licenseOrganization: event.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="npiNumber">NPI Number</Label>
                    <Input
                      id="npiNumber"
                      value={therapistSettings.npiNumber}
                      onChange={(event) => updateTherapistSettings({ npiNumber: event.target.value })}
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => updateTherapistSettings({
                    name: "",
                    location: "",
                    licenseNumber: "",
                    licenseOrganization: "",
                    npiNumber: "",
                  })}
                >
                  Clear Local Therapist Info
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
