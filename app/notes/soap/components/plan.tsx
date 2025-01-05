"use client"

import { Card, CardContent } from "@/components/ui/card"

interface PlanProps {
  formData: any
  setFormData: (data: any) => void
}

export function Plan({ formData, setFormData }: PlanProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div>Treatment Plan Form - Coming Soon</div>
      </CardContent>
    </Card>
  )
}

