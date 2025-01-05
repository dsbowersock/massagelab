"use client"

import { useSettings } from "@/components/providers/settings-provider"
import { useTherapistSettings } from "@/components/providers/therapist-settings-provider"
import { PageHeading } from "@/components/ui/page-heading"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Bell, Layout, Lock, User, Volume2, Eye, FileText } from 'lucide-react'

export default function SettingsPage() {
  const { settings, updateSettings } = useSettings()
  const { settings: therapistSettings, updateSettings: updateTherapistSettings } = useTherapistSettings()

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <PageHeading>Settings</PageHeading>

        <Tabs defaultValue="layout" className="w-full">
          <TabsList className="grid grid-cols-3 grid-rows-3 gap-4 bg-transparent h-auto sm:grid-cols-7 sm:grid-rows-1">
            <TabsTrigger value="layout" className="flex items-center gap-2 data-[state=active]:bg-[#ff7043]">
              <Layout className="h-4 w-4" />
              <span className="hidden sm:inline">Layout</span>
            </TabsTrigger>
            <TabsTrigger value="account" className="flex items-center gap-2 data-[state=active]:bg-[#ff7043]">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Account</span>
            </TabsTrigger>
            <TabsTrigger value="therapist" className="flex items-center gap-2 data-[state=active]:bg-[#ff7043]">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Therapist Info</span>
            </TabsTrigger>
            <TabsTrigger value="privacy" className="flex items-center gap-2 data-[state=active]:bg-[#ff7043]">
              <Lock className="h-4 w-4" />
              <span className="hidden sm:inline">Privacy</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2 data-[state=active]:bg-[#ff7043]">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Notifications</span>
            </TabsTrigger>
            <TabsTrigger value="accessibility" className="flex items-center gap-2 data-[state=active]:bg-[#ff7043]">
              <Eye className="h-4 w-4" />
              <span className="hidden sm:inline">Accessibility</span>
            </TabsTrigger>
            <TabsTrigger value="audio" className="flex items-center gap-2 data-[state=active]:bg-[#ff7043]">
              <Volume2 className="h-4 w-4" />
              <span className="hidden sm:inline">Audio</span>
            </TabsTrigger>
          </TabsList>

          <div className="mt-6 space-y-6">
            <TabsContent value="layout">
              <Card>
                <CardHeader>
                  <CardTitle>Layout Settings</CardTitle>
                  <CardDescription>
                    Customize how the application layout appears and behaves
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Label className="text-base">Sidebar Behavior</Label>
                    <RadioGroup
                      value={settings.sidebarBehavior}
                      onValueChange={(value) => 
                        updateSettings({ sidebarBehavior: value as "responsive" | "fixed" })
                      }
                      className="mt-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="responsive" id="responsive" />
                        <Label htmlFor="responsive">Responsive (changes with screen orientation)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="fixed" id="fixed" />
                        <Label htmlFor="fixed">Fixed Position</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div>
                    <Label className="text-base">Wide Screen Position</Label>
                    <RadioGroup
                      value={settings.sidebarPosition}
                      onValueChange={(value) => 
                        updateSettings({ sidebarPosition: value as "left" | "right" })
                      }
                      className="mt-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="left" id="left" />
                        <Label htmlFor="left">Left Side</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="right" id="right" />
                        <Label htmlFor="right">Right Side</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div>
                    <Label className="text-base">Narrow Screen Position</Label>
                    <RadioGroup
                      value={settings.sidebarNarrowPosition}
                      onValueChange={(value) => 
                        updateSettings({ sidebarNarrowPosition: value as "top" | "bottom" })
                      }
                      className="mt-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="top" id="top" />
                        <Label htmlFor="top">Top</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="bottom" id="bottom" />
                        <Label htmlFor="bottom">Bottom</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="account">
              <Card>
                <CardHeader>
                  <CardTitle>Account Settings</CardTitle>
                  <CardDescription>
                    Manage your account details and preferences
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">Display Name</Label>
                    <Input id="name" placeholder="Your display name" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bio">Bio</Label>
                    <Input id="bio" placeholder="A short bio about yourself" />
                  </div>
                  <div className="space-y-2">
                    <Label>Email Preferences</Label>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="marketing" className="flex flex-col space-y-1">
                          <span>Marketing emails</span>
                          <span className="font-normal text-sm text-muted-foreground">
                            Receive emails about new features and updates
                          </span>
                        </Label>
                        <Switch id="marketing" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="therapist">
              <Card>
                <CardHeader>
                  <CardTitle>Therapist Information</CardTitle>
                  <CardDescription>
                    Your information will be used to pre-fill forms and documentation
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="therapistName">Full Name</Label>
                    <Input
                      id="therapistName"
                      value={therapistSettings.name}
                      onChange={(e) => updateTherapistSettings({ name: e.target.value })}
                      placeholder="Enter your full name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="location">Practice Location</Label>
                    <Input
                      id="location"
                      value={therapistSettings.location}
                      onChange={(e) => updateTherapistSettings({ location: e.target.value })}
                      placeholder="Enter your practice location"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="licenseNumber">License Number</Label>
                    <Input
                      id="licenseNumber"
                      value={therapistSettings.licenseNumber}
                      onChange={(e) => updateTherapistSettings({ licenseNumber: e.target.value })}
                      placeholder="Enter your license number"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="licenseOrganization">Licensing Organization</Label>
                    <Input
                      id="licenseOrganization"
                      value={therapistSettings.licenseOrganization}
                      onChange={(e) => updateTherapistSettings({ licenseOrganization: e.target.value })}
                      placeholder="Enter your licensing organization"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="npiNumber">NPI Number</Label>
                    <Input
                      id="npiNumber"
                      value={therapistSettings.npiNumber}
                      onChange={(e) => updateTherapistSettings({ npiNumber: e.target.value })}
                      placeholder="Enter your NPI number"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="privacy">
              <Card>
                <CardHeader>
                  <CardTitle>Privacy Settings</CardTitle>
                  <CardDescription>
                    Manage your privacy preferences and data sharing settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="profile-visible" className="flex flex-col space-y-1">
                        <span>Profile Visibility</span>
                        <span className="font-normal text-sm text-muted-foreground">
                          Make your profile visible to other users
                        </span>
                      </Label>
                      <Switch id="profile-visible" />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="share-progress" className="flex flex-col space-y-1">
                        <span>Share Progress</span>
                        <span className="font-normal text-sm text-muted-foreground">
                          Share your learning progress with other users
                        </span>
                      </Label>
                      <Switch id="share-progress" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notifications">
              <Card>
                <CardHeader>
                  <CardTitle>Notification Settings</CardTitle>
                  <CardDescription>
                    Choose what notifications you want to receive
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="timer-notifications" className="flex flex-col space-y-1">
                        <span>Timer Notifications</span>
                        <span className="font-normal text-sm text-muted-foreground">
                          Receive notifications when timers complete
                        </span>
                      </Label>
                      <Switch id="timer-notifications" defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="game-invites" className="flex flex-col space-y-1">
                        <span>Game Invites</span>
                        <span className="font-normal text-sm text-muted-foreground">
                          Receive notifications for Anatomime game invites
                        </span>
                      </Label>
                      <Switch id="game-invites" defaultChecked />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="accessibility">
              <Card>
                <CardHeader>
                  <CardTitle>Accessibility Settings</CardTitle>
                  <CardDescription>
                    Customize the interface to meet your needs
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Text Size</Label>
                      <Slider
                        defaultValue={[100]}
                        max={200}
                        min={75}
                        step={25}
                        className="w-full"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="reduce-motion" className="flex flex-col space-y-1">
                        <span>Reduce Motion</span>
                        <span className="font-normal text-sm text-muted-foreground">
                          Minimize animations and transitions
                        </span>
                      </Label>
                      <Switch id="reduce-motion" />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="high-contrast" className="flex flex-col space-y-1">
                        <span>High Contrast</span>
                        <span className="font-normal text-sm text-muted-foreground">
                          Increase contrast for better visibility
                        </span>
                      </Label>
                      <Switch id="high-contrast" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="audio">
              <Card>
                <CardHeader>
                  <CardTitle>Audio Settings</CardTitle>
                  <CardDescription>
                    Customize sound preferences for timers and background music
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Timer Volume</Label>
                      <Slider
                        defaultValue={[80]}
                        max={100}
                        step={1}
                        className="w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Music Volume</Label>
                      <Slider
                        defaultValue={[50]}
                        max={100}
                        step={1}
                        className="w-full"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="mute-all" className="flex flex-col space-y-1">
                        <span>Mute All Sounds</span>
                        <span className="font-normal text-sm text-muted-foreground">
                          Disable all audio output
                        </span>
                      </Label>
                      <Switch id="mute-all" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  )
}

