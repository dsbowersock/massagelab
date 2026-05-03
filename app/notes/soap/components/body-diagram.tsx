"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface BodyDiagramProps {
  formData: any
  setFormData: (data: any) => void
}

export function BodyDiagram({ formData, setFormData }: BodyDiagramProps) {
  const bodyDiagram = formData.bodyDiagram || {}

  const handleChange = (field: string, value: string) => {
    setFormData({
      ...formData,
      bodyDiagram: {
        ...bodyDiagram,
        [field]: value,
      },
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Body Map Notes</CardTitle>
        <CardDescription>
          Text-based body mapping for the alpha. A visual diagram can be added later without changing the export model.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="regions">Regions / Areas</Label>
          <Textarea
            id="regions"
            value={bodyDiagram.regions || ""}
            onChange={(event) => handleChange("regions", event.target.value)}
            placeholder="Document areas treated, avoided, tender, restricted, or reassessed..."
            className="min-h-[120px]"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bodyNotes">Additional Notes</Label>
          <Textarea
            id="bodyNotes"
            value={bodyDiagram.notes || ""}
            onChange={(event) => handleChange("notes", event.target.value)}
            className="min-h-[120px]"
          />
        </div>
      </CardContent>
    </Card>
  )
}
