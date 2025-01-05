"use client"

import { Card, CardContent } from "@/components/ui/card"

interface BodyDiagramProps {
  formData: any
  setFormData: (data: any) => void
}

export function BodyDiagram({ formData, setFormData }: BodyDiagramProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div>Body Diagram Form - Coming Soon</div>
      </CardContent>
    </Card>
  )
}

