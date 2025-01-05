"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Plus, X } from 'lucide-react'

interface AssessmentProps {
  formData: any
  setFormData: (data: any) => void
}

interface TechniqueEntry {
  technique: string
  area: string
  reasoning: string
  outcome: string
}

export function Assessment({ formData, setFormData }: AssessmentProps) {
  const handleChange = (field: string, value: any) => {
    setFormData({
      ...formData,
      assessment: {
        ...formData.assessment,
        [field]: value
      }
    })
  }

  const addTechnique = () => {
    const currentTechniques = formData.assessment?.techniques || []
    handleChange('techniques', [
      ...currentTechniques,
      { technique: '', area: '', reasoning: '', outcome: '' }
    ])
  }

  const updateTechnique = (index: number, field: keyof TechniqueEntry, value: string) => {
    const techniques = [...(formData.assessment?.techniques || [])]
    techniques[index] = {
      ...techniques[index],
      [field]: value
    }
    handleChange('techniques', techniques)
  }

  const removeTechnique = (index: number) => {
    const techniques = formData.assessment?.techniques || []
    handleChange('techniques', techniques.filter((_: any, i: number) => i !== index))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Session Assessment</CardTitle>
        <CardDescription>
          Document your assessment of the session, including techniques used and their outcomes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="overallAssessment">Overall Assessment</Label>
            <Textarea
              id="overallAssessment"
              placeholder="Describe your overall assessment of the client's condition and response to treatment..."
              value={formData.assessment?.overallAssessment || ''}
              onChange={(e) => handleChange('overallAssessment', e.target.value)}
              className="min-h-[100px]"
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Techniques Applied</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addTechnique}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Technique
              </Button>
            </div>

            <div className="space-y-4">
              {(formData.assessment?.techniques || []).map((technique: TechniqueEntry, index: number) => (
                <Card key={index}>
                  <CardContent className="pt-6">
                    <div className="relative space-y-4">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0"
                        onClick={() => removeTechnique(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>

                      <div className="space-y-2">
                        <Label htmlFor={`technique-${index}`}>Technique/Modality Used</Label>
                        <Input
                          id={`technique-${index}`}
                          placeholder="e.g., Deep Tissue, Swedish, Trigger Point Therapy"
                          value={technique.technique}
                          onChange={(e) => updateTechnique(index, 'technique', e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`area-${index}`}>Area Treated</Label>
                        <Input
                          id={`area-${index}`}
                          placeholder="Specific area or region treated"
                          value={technique.area}
                          onChange={(e) => updateTechnique(index, 'area', e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`reasoning-${index}`}>Clinical Reasoning</Label>
                        <Textarea
                          id={`reasoning-${index}`}
                          placeholder="Why did you choose this technique for this area?"
                          value={technique.reasoning}
                          onChange={(e) => updateTechnique(index, 'reasoning', e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`outcome-${index}`}>Observed Outcome</Label>
                        <Textarea
                          id={`outcome-${index}`}
                          placeholder="What was the immediate result or response?"
                          value={technique.outcome}
                          onChange={(e) => updateTechnique(index, 'outcome', e.target.value)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="findings">Key Findings</Label>
            <Textarea
              id="findings"
              placeholder="Document any significant findings or observations..."
              value={formData.assessment?.findings || ''}
              onChange={(e) => handleChange('findings', e.target.value)}
              className="min-h-[100px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="clinicalNotes">Additional Clinical Notes</Label>
            <Textarea
              id="clinicalNotes"
              placeholder="Any other relevant information about the session..."
              value={formData.assessment?.clinicalNotes || ''}
              onChange={(e) => handleChange('clinicalNotes', e.target.value)}
              className="min-h-[100px]"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

