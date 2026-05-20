"use client"

import { useMemo, useState } from "react"
import { CalendarDays, Check, Clock, UserRound } from "lucide-react"
import { requestAppointmentAction } from "@/app/calendar/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

type BookingSlot = {
  startsAt: string
  label: string
  request: {
    practiceId: string
    therapistId: string
    serviceVariantId: string
    startsAt: string
  }
}

type BookingDay = {
  date: string
  label: string
  slots: BookingSlot[]
}

type BookingProvider = {
  id: string
  label: string
  days: BookingDay[]
}

type BookingVariant = {
  id: string
  serviceId: string
  serviceName: string
  name: string
  durationMinutes: number
  bufferAfterMinutes: number
  priceCents: number | null
  currency: string
  providers: BookingProvider[]
}

type BookingService = {
  id: string
  name: string
  description: string | null
  variants: BookingVariant[]
}

type BookingOptionModel = {
  practiceId: string
  timeZone: string
  services: BookingService[]
}

function moneyLabel(cents: number | null, currency: string) {
  if (cents == null) return null
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(cents / 100)
}

function slotCount(provider: BookingProvider) {
  return provider.days.reduce((total, day) => total + day.slots.length, 0)
}

export function BookingPicker({ model }: { model: BookingOptionModel }) {
  const firstService = model.services[0]
  const [selectedServiceId, setSelectedServiceId] = useState(firstService?.id ?? "")
  const selectedService = model.services.find((service) => service.id === selectedServiceId) ?? firstService
  const firstVariant = selectedService?.variants[0]
  const [selectedVariantId, setSelectedVariantId] = useState(firstVariant?.id ?? "")
  const selectedVariant = selectedService?.variants.find((variant) => variant.id === selectedVariantId) ?? firstVariant
  const firstProvider = selectedVariant?.providers[0]
  const [selectedProviderId, setSelectedProviderId] = useState(firstProvider?.id ?? "")
  const selectedProvider = selectedVariant?.providers.find((provider) => provider.id === selectedProviderId) ?? firstProvider

  const selectedProviderSlots = useMemo(() => (
    selectedProvider?.days.reduce((total, day) => total + day.slots.length, 0) ?? 0
  ), [selectedProvider])

  if (!firstService) {
    return (
      <Card className="border-border/80 bg-card/90 backdrop-blur">
        <CardHeader>
          <CardTitle>No online services yet</CardTitle>
          <CardDescription>This practice has not published client-visible services.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)]">
      <Card className="border-border/80 bg-card/95 shadow-lg shadow-black/15 backdrop-blur">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">1. Choose service</Badge>
            <Badge variant="outline">2. Choose provider</Badge>
            <Badge variant="outline">3. Choose time</Badge>
          </div>
          <CardTitle className="mt-3">Services</CardTitle>
          <CardDescription>Select the service and duration that best matches the appointment.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {model.services.map((service) => {
            const active = service.id === selectedService?.id

            return (
              <button
                key={service.id}
                type="button"
                onClick={() => {
                  setSelectedServiceId(service.id)
                  setSelectedVariantId(service.variants[0]?.id ?? "")
                  setSelectedProviderId(service.variants[0]?.providers[0]?.id ?? "")
                }}
                className={cn(
                  "w-full rounded-lg border p-4 text-left transition hover:border-primary/70 hover:bg-primary/5",
                  active ? "border-primary/70 bg-primary/10" : "border-border/70 bg-background/60",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{service.name}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {service.description ?? "Choose a provider and appointment time."}
                    </p>
                  </div>
                  {active ? <Check data-icon="inline-start" className="mt-0.5 text-brand-orange" /> : null}
                </div>
              </button>
            )
          })}

          {selectedService && selectedService.variants.length > 1 ? (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm font-medium">Durations</p>
                <div className="grid gap-2">
                  {selectedService.variants.map((variant) => {
                    const price = moneyLabel(variant.priceCents, variant.currency)

                    return (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() => {
                          setSelectedVariantId(variant.id)
                          setSelectedProviderId(variant.providers[0]?.id ?? "")
                        }}
                        className={cn(
                          "flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm transition hover:border-primary/70",
                          variant.id === selectedVariant?.id ? "border-primary/70 bg-primary/10" : "border-border/70 bg-background/60",
                        )}
                      >
                        <span>{variant.name}</span>
                        <span className="text-muted-foreground">
                          {variant.durationMinutes} min{price ? ` · ${price}` : ""}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4">
        <Card className="border-border/80 bg-card/95 shadow-lg shadow-black/15 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound data-icon="inline-start" className="text-brand-orange" />
              Provider
            </CardTitle>
            <CardDescription>Times update from the selected provider working hours and existing blocks.</CardDescription>
          </CardHeader>
          <CardContent>
            {selectedVariant && selectedVariant.providers.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {selectedVariant.providers.map((provider) => (
                  <button
                    key={provider.id}
                    type="button"
                    onClick={() => setSelectedProviderId(provider.id)}
                    className={cn(
                      "rounded-md border p-3 text-left transition hover:border-primary/70 hover:bg-primary/5",
                      provider.id === selectedProvider?.id ? "border-primary/70 bg-primary/10" : "border-border/70 bg-background/60",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{provider.label}</span>
                      <Badge variant={slotCount(provider) > 0 ? "secondary" : "outline"}>
                        {slotCount(provider)} slots
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No provider can be booked for this service online.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95 shadow-lg shadow-black/15 backdrop-blur">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays data-icon="inline-start" className="text-brand-orange" />
                  Available times
                </CardTitle>
                <CardDescription>
                  {selectedVariant ? `${selectedVariant.serviceName} · ${selectedVariant.durationMinutes} minutes` : "Choose a service to see times."}
                </CardDescription>
              </div>
              {selectedProvider ? <Badge variant="outline">{selectedProvider.label}</Badge> : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedProvider && selectedProviderSlots > 0 ? (
              selectedProvider.days.map((day) => (
                <div key={day.date} className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Clock data-icon="inline-start" className="text-brand-orange" />
                    {day.label}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {day.slots.map((slot) => (
                      <form key={slot.startsAt} action={requestAppointmentAction}>
                        <input type="hidden" name="practiceId" value={slot.request.practiceId} />
                        <input type="hidden" name="therapistId" value={slot.request.therapistId} />
                        <input type="hidden" name="serviceVariantId" value={slot.request.serviceVariantId} />
                        <input type="hidden" name="startsAt" value={slot.request.startsAt} />
                        <Button type="submit" variant="outline" size="sm" className="rounded-full">
                          {slot.label}
                        </Button>
                      </form>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-border/80 bg-background/50 p-6 text-sm text-muted-foreground">
                No available times found for this service and provider in the next 7 days.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
