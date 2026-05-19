"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, Plus, X } from "lucide-react"
import { createAppointmentAction } from "@/app/calendar/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

type TherapistOption = {
  id: string
  label: string
}

type ClientOption = {
  id: string
  label: string
  email: string | null
  phone: string | null
}

type ServiceOption = {
  id: string
  serviceName: string
  variantName: string
  label: string
  durationMinutes: number
  processingMinutes: number
  bufferBeforeMinutes: number
  bufferAfterMinutes: number
  priceCents: number | null
  currency: string
  resourceNames: string[]
  eligibleProviderIds: string[]
}

function formatMoney(cents: number | null, currency: string) {
  if (cents == null) return "No price"
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100)
}

function localHour(value: string) {
  const match = /T(\d{2}):/.exec(value)
  return match ? Number(match[1]) : null
}

export function AppointmentComposer({
  practiceId,
  therapists,
  clients,
  services,
  defaultStartsAt = "",
}: {
  practiceId: string
  therapists: TherapistOption[]
  clients: ClientOption[]
  services: ServiceOption[]
  defaultStartsAt?: string
}) {
  const [therapistId, setTherapistId] = useState(therapists[0]?.id ?? "")
  const [clientId, setClientId] = useState(clients[0]?.id ?? "")
  const [startsAt, setStartsAt] = useState(defaultStartsAt)
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(services[0]?.id ? [services[0].id] : [])
  const selectedClient = clients.find((client) => client.id === clientId)
  const selectedServices = services.filter((service) => selectedServiceIds.includes(service.id))
  const outsideCommonHours = useMemo(() => {
    const hour = localHour(startsAt)
    return hour != null && (hour < 8 || hour >= 19)
  }, [startsAt])
  const totalMinutes = selectedServices.reduce((sum, service) => (
    sum + service.durationMinutes + service.processingMinutes + service.bufferBeforeMinutes + service.bufferAfterMinutes
  ), 0)
  const pricedServices = selectedServices.filter((service) => service.priceCents != null)
  const totalPriceCents = pricedServices.length > 0 ? pricedServices.reduce((sum, service) => sum + Number(service.priceCents), 0) : null
  const currency = selectedServices[0]?.currency ?? "USD"

  function toggleService(serviceId: string) {
    setSelectedServiceIds((current) => {
      if (current.includes(serviceId)) {
        return current.length === 1 ? current : current.filter((id) => id !== serviceId)
      }
      return [...current, serviceId]
    })
  }

  return (
    <form action={createAppointmentAction} className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
      <input type="hidden" name="practiceId" value={practiceId} />
      <div className="space-y-4">
        <Card className="border-neutral-800 bg-card/90 backdrop-blur">
          <CardHeader>
            <CardTitle>Appointment details</CardTitle>
            <CardDescription>Service selections set appointment duration, buffers, price display, and required resources.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Therapist</Label>
                <Select name="therapistId" value={therapistId} onValueChange={setTherapistId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {therapists.map((therapist) => (
                      <SelectItem key={therapist.id} value={therapist.id}>{therapist.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Customer</Label>
                <Select name="practiceClientId" value={clientId} onValueChange={setClientId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>{client.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-3">
              <Label>Services</Label>
              <div className="grid gap-2">
                {services.map((service) => {
                  const selected = selectedServiceIds.includes(service.id)
                  const eligible = service.eligibleProviderIds.length === 0 || service.eligibleProviderIds.includes(therapistId)
                  return (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => eligible && toggleService(service.id)}
                      className={`rounded-md border p-3 text-left transition ${selected ? "border-brand-orange bg-primary/10" : "border-neutral-800 bg-background/70"} ${eligible ? "hover:border-brand-orange/70" : "cursor-not-allowed opacity-50"}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{service.serviceName} - {service.variantName}</p>
                          <p className="text-sm text-muted-foreground">
                            {service.durationMinutes} min work · {service.processingMinutes + service.bufferBeforeMinutes + service.bufferAfterMinutes} min processing/buffer
                          </p>
                          {service.resourceNames.length > 0 ? (
                            <p className="text-xs text-muted-foreground">Resources: {service.resourceNames.join(", ")}</p>
                          ) : null}
                        </div>
                        <span className="text-sm text-muted-foreground">{formatMoney(service.priceCents, service.currency)}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
              {selectedServiceIds.map((id) => <input key={id} type="hidden" name="serviceVariantIds" value={id} />)}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startsAt">Date and time</Label>
                <Input id="startsAt" name="startsAt" type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.currentTarget.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Block preview</Label>
                <div className="rounded-md border border-neutral-800 bg-background/70 px-3 py-2 text-sm">
                  {totalMinutes || 0} minutes · {formatMoney(totalPriceCents, currency)}
                </div>
              </div>
            </div>
            {outsideCommonHours ? (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" />
                <span>This time is outside common working hours. Provider availability and conflicts are checked when you save.</span>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="notes">Operational notes</Label>
              <Textarea id="notes" name="notes" placeholder="Room setup, arrival instructions, or other non-clinical scheduling notes." />
            </div>
          </CardContent>
        </Card>
        <Button type="submit" className="bg-primary hover:bg-brand-orange-glow">
          <Plus className="mr-2 h-4 w-4" />
          Create appointment
        </Button>
      </div>

      <Card className="h-fit border-neutral-800 bg-card/90 backdrop-blur">
        <CardHeader>
          <CardTitle>{selectedClient ? selectedClient.label : "No customer selected"}</CardTitle>
          <CardDescription>Customer details are scheduling context only.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedClient ? (
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>{selectedClient.email ?? "No email on file"}</p>
              <p>{selectedClient.phone ?? "No phone on file"}</p>
            </div>
          ) : null}
          <div className="space-y-2">
            <p className="text-sm font-medium">Selected services</p>
            {selectedServices.map((service) => (
              <div key={service.id} className="flex items-start justify-between gap-3 rounded-md bg-background/70 p-3 text-sm">
                <div>
                  <p>{service.serviceName}</p>
                  <p className="text-muted-foreground">{service.variantName}</p>
                </div>
                <button type="button" onClick={() => toggleService(service.id)} aria-label={`Remove ${service.label}`}>
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
