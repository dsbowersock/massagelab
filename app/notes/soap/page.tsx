"use client"

import { useState } from "react"
import { PageHeading } from "@/components/ui/page-heading"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ChevronLeft, ChevronRight, Download, Save } from 'lucide-react'
import { IdentifyingInfo } from "./components/identifying-info"
import { SubjectiveInfo } from "./components/subjective-info"
import { ObjectiveInfo } from "./components/objective-info"
import { InformedConsent } from "./components/informed-consent"
import { Assessment } from "./components/assessment"
import { Plan } from "./components/plan"
import { BodyDiagram } from "./components/body-diagram"
import { Review } from "./components/review"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const steps = [
  { id: 1, title: "Identifying Information", component: IdentifyingInfo },
  { id: 2, title: "Subjective Information", component: SubjectiveInfo },
  { id: 3, title: "Objective Information", component: ObjectiveInfo },
  { id: 4, title: "Informed Consent", component: InformedConsent },
  { id: 5, title: "Assessment", component: Assessment },
  { id: 6, title: "Plan", component: Plan },
  { id: 7, title: "Body Diagram", component: BodyDiagram },
  { id: 8, title: "Review", component: Review },
]

export default function SoapNotesPage() {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState({
    entries: []
  })
  
  const CurrentStepComponent = steps.find(step => step.id === currentStep)?.component

  const progress = (currentStep / steps.length) * 100

  const handleNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep(prev => prev + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1)
    }
  }

  const handleDownload = () => {
    // TODO: Implement note generation and download
    console.log("Downloading notes:", formData)
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <PageHeading>S.O.A.P. Notes</PageHeading>

        <Card className="p-6">
          <div className="space-y-6">
            {/* Navigation and progress */}
            <div className="space-y-2">
              {/* Desktop Tabs */}
              <div className="hidden md:block">
                <Tabs value={currentStep.toString()} onValueChange={(value) => setCurrentStep(parseInt(value))}>
                  <TabsList className="w-full grid grid-cols-8">
                    {steps.map((step) => (
                      <TabsTrigger
                        key={step.id}
                        value={step.id.toString()}
                        className="text-xs sm:text-sm whitespace-normal h-auto py-2 data-[state=active]:bg-[#ff7043] data-[state=active]:text-white"
                      >
                        {step.title}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>

              {/* Mobile Select Dropdown */}
              <div className="md:hidden">
                <Select value={currentStep.toString()} onValueChange={(value) => setCurrentStep(parseInt(value))}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select step">
                      {steps.find(step => step.id === currentStep)?.title}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {steps.map((step) => (
                      <SelectItem key={step.id} value={step.id.toString()}>
                        {step.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="py-8 px-4 mt-4 bg-black/20 rounded-lg">
                <Progress 
                  value={(currentStep / steps.length) * 100} 
                  className="h-2 bg-neutral-800 [&>div]:bg-[#ff7043]" 
                />
              </div>
            </div>

            {/* Step content */}
            <div className="min-h-[400px]">
              {CurrentStepComponent && (
                <CurrentStepComponent
                  formData={formData}
                  setFormData={setFormData}
                />
              )}
            </div>

            {/* Navigation buttons */}
            <div className="flex justify-between pt-6 border-t">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentStep === 1}
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Previous
              </Button>

              <div className="flex gap-2">
                {currentStep === steps.length ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={handleDownload}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                    <Button
                      variant="default"
                      className="bg-[#ff7043] hover:bg-[#f4511e]"
                      onClick={handleDownload}
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Save & Download
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={handleNext}
                    className="bg-[#ff7043] hover:bg-[#f4511e]"
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

