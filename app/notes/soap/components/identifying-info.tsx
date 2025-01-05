"use client"

import { useEffect } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { useTherapistSettings } from "@/components/providers/therapist-settings-provider"

interface IdentifyingInfoProps {
  formData: any
  setFormData: (data: any) => void
}

export function IdentifyingInfo({ formData, setFormData }: IdentifyingInfoProps) {
  const { settings: therapistSettings } = useTherapistSettings()

  useEffect(() => {
    // Set default date to today
    const today = new Date().toISOString().split('T')[0]
    
    // Pre-populate therapist information from settings
    setFormData(prev => ({
      ...prev,
      date: today,
      therapistName: therapistSettings.name || prev.therapistName,
      location: therapistSettings.location || prev.location,
      licenseNumber: therapistSettings.licenseNumber || prev.licenseNumber,
      licenseOrganization: therapistSettings.licenseOrganization || prev.licenseOrganization,
      npiNumber: therapistSettings.npiNumber || prev.npiNumber
    }))
  }, [setFormData, therapistSettings])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="clientName">Client Name</Label>
            <Input
              id="clientName"
              name="clientName"
              placeholder="Enter client's full name"
              value={formData.clientName || ""}
              onChange={handleChange}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dateOfBirth">Date of Birth</Label>
            <Input
              id="dateOfBirth"
              name="dateOfBirth"
              type="date"
              value={formData.dateOfBirth || ""}
              onChange={handleChange}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Date of Session</Label>
            <Input
              id="date"
              name="date"
              type="date"
              value={formData.date || ""}
              onChange={handleChange}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="time">Time of Session</Label>
            <Input
              id="time"
              name="time"
              type="time"
              value={formData.time || ""}
              onChange={handleChange}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="therapistName">Therapist Name</Label>
            <Input
              id="therapistName"
              name="therapistName"
              value={formData.therapistName || ""}
              onChange={handleChange}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              name="location"
              value={formData.location || ""}
              onChange={handleChange}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="licenseNumber">License Number</Label>
            <Input
              id="licenseNumber"
              name="licenseNumber"
              value={formData.licenseNumber || ""}
              onChange={handleChange}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="licenseOrganization">Licensing Organization</Label>
            <Input
              id="licenseOrganization"
              name="licenseOrganization"
              value={formData.licenseOrganization || ""}
              onChange={handleChange}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="npiNumber">NPI Number</Label>
            <Input
              id="npiNumber"
              name="npiNumber"
              value={formData.npiNumber || ""}
              onChange={handleChange}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="clientNumber">Client Number/ID</Label>
            <Input
              id="clientNumber"
              name="clientNumber"
              placeholder="Enter client's ID number"
              value={formData.clientNumber || ""}
              onChange={handleChange}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

