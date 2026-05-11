"use client"

import { Layout, UserRound } from "lucide-react"
import { useSettings } from "@/components/providers/settings-provider"
import { useTherapistSettings } from "@/components/providers/therapist-settings-provider"
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

  return (
    <div className="min-h-screen bg-transparent p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeading>Settings</PageHeading>

        <Tabs defaultValue="layout" className="w-full">
          <TabsList className="grid h-auto grid-cols-2 gap-3 bg-transparent">
            <TabsTrigger value="layout" className="flex items-center gap-2 data-[state=active]:bg-[#ff7043]">
              <Layout className="h-4 w-4" />
              Layout
            </TabsTrigger>
            <TabsTrigger value="therapist" className="flex items-center gap-2 data-[state=active]:bg-[#ff7043]">
              <UserRound className="h-4 w-4" />
              Therapist Info
            </TabsTrigger>
          </TabsList>

          <TabsContent value="layout" className="mt-6">
            <Card className="bg-card/90 backdrop-blur">
              <CardHeader>
                <CardTitle>Layout</CardTitle>
                <CardDescription>Choose where the sidebar lives and where its trigger bar sits.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <Label className="text-base">Sidebar Side</Label>
                  <RadioGroup
                    value={settings.sidebarPosition}
                    onValueChange={(value) => updateSettings({ sidebarPosition: value as "left" | "right" })}
                    className="flex flex-col gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="left" id="sidebar-left" />
                      <Label htmlFor="sidebar-left">Left</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="right" id="sidebar-right" />
                      <Label htmlFor="sidebar-right">Right</Label>
                    </div>
                  </RadioGroup>
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-base">Trigger Bar Position</Label>
                  <RadioGroup
                    value={settings.sidebarTriggerPosition}
                    onValueChange={(value) => updateSettings({ sidebarTriggerPosition: value as "top" | "bottom" })}
                    className="flex flex-col gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="top" id="trigger-top" />
                      <Label htmlFor="trigger-top">Top</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="bottom" id="trigger-bottom" />
                      <Label htmlFor="trigger-bottom">Bottom</Label>
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
