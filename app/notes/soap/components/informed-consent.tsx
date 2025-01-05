"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { format } from "date-fns"

interface InformedConsentProps {
  formData: any
  setFormData: (data: any) => void
}

export function InformedConsent({ formData, setFormData }: InformedConsentProps) {
  const [clientName, setClientName] = useState(formData.clientName || "")
  const [date, setDate] = useState(formData.consentDate || format(new Date(), "yyyy-MM-dd"))
  const [initials, setInitials] = useState(formData.consentInitials || "")
  const [acknowledged, setAcknowledged] = useState(false)

  const handleSubmit = () => {
    setFormData({
      ...formData,
      consentName: clientName,
      consentDate: date,
      consentInitials: initials,
      consentAcknowledged: acknowledged
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Informed Consent</CardTitle>
        <CardDescription>
          Please read and acknowledge the following agreement
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <ScrollArea className="h-[400px] rounded-md border p-4">
          <div className="space-y-4 text-sm">
            <p className="font-semibold">Important Information:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Draping will be used during the session – only the area being worked on will be uncovered.</li>
              <li>Clients under the age of 17 must be accompanied by a parent or legal guardian during the entire session.</li>
              <li>Informed written consent must be provided by parent or legal guardian for any client under the age of 17.</li>
            </ul>

            <div className="pt-4">
              I, <span className="font-semibold">{clientName || "_______________"}</span>, understand that the massage I receive is provided
              for the basic purpose of relaxation and relief of muscular tension. If I experience any pain or discomfort during this
              session, I will immediately inform the therapist so that the pressure and/or strokes may be adjusted to my level of
              comfort.
            </div>

            <p>
              I further understand that massage should not be construed as a substitute for medical examination,
              diagnosis, or treatment and that I should see a physician, chiropractor or other qualified medical specialist for any
              mental or physical ailment that I am aware of.
            </p>

            <p>
              I understand that massage therapists are not qualified to perform spinal or skeletal adjustments, diagnose, prescribe,
              or treat any physical or mental illness, and that nothing said in the course of the session given should be construed as such.
            </p>

            <p>
              Because massage should not be performed under certain medical conditions, I affirm that I have stated all my known
              medical conditions, and answered all questions honestly. I agree to keep the therapist updated as to any changes in my
              medical profile and understand that there shall be no liability on the therapist's part should I fail to do so.
            </p>
          </div>
        </ScrollArea>

        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="clientName">Print Full Name</Label>
            <Input
              id="clientName"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Enter your full name"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="initials">Initials</Label>
            <Input
              id="initials"
              value={initials}
              onChange={(e) => setInitials(e.target.value.toUpperCase())}
              placeholder="Enter your initials"
              maxLength={3}
              className="uppercase"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="acknowledge"
              checked={acknowledged}
              onCheckedChange={(checked) => setAcknowledged(checked as boolean)}
            />
            <Label htmlFor="acknowledge" className="text-sm">
              I acknowledge that I have read and understand this agreement and all my questions 
              have been answered to my satisfaction.
            </Label>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button
          onClick={handleSubmit}
          disabled={!clientName || !date || !initials || !acknowledged}
          className="w-full"
        >
          Confirm and Continue
        </Button>
      </CardFooter>
    </Card>
  )
}

