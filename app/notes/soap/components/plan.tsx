"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface PlanProps {
  formData: any
  setFormData: (data: any) => void
}

export function Plan({ formData, setFormData }: PlanProps) {
  const treatmentPlan = formData.treatmentPlan || {}

  const handleChange = (field: string, value: string) => {
    setFormData({
      ...formData,
      treatmentPlan: {
        ...treatmentPlan,
        [field]: value,
      },
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Treatment Plan</CardTitle>
        <CardDescription>Document follow-up, home care, and referral guidance.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="nextSession">Next Session</Label>
            <Input
              id="nextSession"
              value={treatmentPlan.nextSession || ""}
              onChange={(event) => handleChange("nextSession", event.target.value)}
              placeholder="e.g., Reassess in 2 weeks"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="frequency">Recommended Frequency</Label>
            <Input
              id="frequency"
              value={treatmentPlan.frequency || ""}
              onChange={(event) => handleChange("frequency", event.target.value)}
              placeholder="e.g., Weekly for 4 weeks"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="homeCare">Home Care</Label>
          <Textarea
            id="homeCare"
            value={treatmentPlan.homeCare || ""}
            onChange={(event) => handleChange("homeCare", event.target.value)}
            placeholder="Exercises, hydration guidance, ergonomic changes, or self-care recommendations..."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="referrals">Referrals / Follow-up</Label>
          <Textarea
            id="referrals"
            value={treatmentPlan.referrals || ""}
            onChange={(event) => handleChange("referrals", event.target.value)}
            placeholder="Referral suggestions or coordination notes..."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="planNotes">Additional Plan Notes</Label>
          <Textarea
            id="planNotes"
            value={treatmentPlan.notes || ""}
            onChange={(event) => handleChange("notes", event.target.value)}
          />
        </div>
      </CardContent>
    </Card>
  )
}
