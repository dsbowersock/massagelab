"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { CalendarDays, Check, Clock, LogIn, MapPin, Plus, SlidersHorizontal, UserPlus, UserRound } from "lucide-react"
import { joinBookingWaitlistAction, requestBookingSequenceAction } from "@/app/calendar/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { MAX_PUBLIC_ADD_ONS } from "@/lib/public-booking-constants"
import { cn } from "@/lib/utils"

type BookingVariant = {
  id: string
  serviceId: string
  serviceName: string
  name: string
  durationMinutes: number
  priceCents: number | null
  currency: string
}

type BookingService = {
  id: string
  name: string
  description: string | null
  variants: BookingVariant[]
}

type ProviderPreference = {
  id: string
  label: string
}

type SequenceItem = {
  sortOrder: number
  providerUserId: string
  providerLabel: string
  serviceVariantId: string
  serviceName: string
  serviceVariantName: string
  startsAt: string
  endsAt: string
  massageCapacityMinutes: number
}

type SequenceOption = {
  startsAt: string
  endsAt: string
  status: string
  totalMassageCapacityMinutes: number
  items: SequenceItem[]
}

type BookingOptionModel = {
  practiceId: string
  practiceSlug: string
  practiceName: string
  timeZone: string
  policy: {
    approvalMode: "MANUAL" | "AUTO_CONFIRM"
    anyProviderEnabled: boolean
    dualTimezoneDisplay: boolean
    requireClientAccount: boolean
  }
  viewer: {
    isSignedIn: boolean
  }
  primaryServices: BookingService[]
  addOnServices: BookingService[]
  providers: ProviderPreference[]
  proximity: {
    enabled: boolean
    label: string | null
    latitude: number | null
    longitude: number | null
    radiusMiles: number
  }
}

function moneyLabel(cents: number | null, currency: string) {
  if (cents == null) return null
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(cents / 100)
}

function timeLabel(value: string, timeZone: string) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))
}

function shortTimeLabel(value: string, timeZone: string) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))
}

function distanceMiles(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const earthMiles = 3958.8
  const toRadians = (value: number) => (value * Math.PI) / 180
  const dLat = toRadians(b.latitude - a.latitude)
  const dLon = toRadians(b.longitude - a.longitude)
  const lat1 = toRadians(a.latitude)
  const lat2 = toRadians(b.latitude)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * earthMiles * Math.asin(Math.sqrt(h))
}

export function BookingPicker({ model }: { model: BookingOptionModel }) {
  const pathname = usePathname()
  const firstPrimaryVariant = model.primaryServices[0]?.variants[0]
  const [selectedPrimaryVariantId, setSelectedPrimaryVariantId] = useState(firstPrimaryVariant?.id ?? "")
  const [selectedAddOnVariantIds, setSelectedAddOnVariantIds] = useState<string[]>([])
  const [requestedPressureLevel, setRequestedPressureLevel] = useState(3)
  const [preferredProviderId, setPreferredProviderId] = useState(model.providers[0]?.id ?? "")
  const [distanceNotice, setDistanceNotice] = useState("")
  const [sequenceOptions, setSequenceOptions] = useState<SequenceOption[]>([])
  const [sequenceLoading, setSequenceLoading] = useState(false)
  const [sequenceError, setSequenceError] = useState("")
  const [sequenceLoaded, setSequenceLoaded] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  const [guestName, setGuestName] = useState("")
  const [guestEmail, setGuestEmail] = useState("")
  const [guestPhone, setGuestPhone] = useState("")
  const addOnVariantOrder = useMemo(() => model.addOnServices.flatMap((service) => service.variants.map((variant) => variant.id)), [model.addOnServices])
  const orderedSelectedAddOnVariantIds = useMemo(() => (
    addOnVariantOrder.filter((variantId) => selectedAddOnVariantIds.includes(variantId))
  ), [addOnVariantOrder, selectedAddOnVariantIds])

  const bookingReturnPath = pathname || `/book/${model.practiceSlug}`
  const loginHref = `/login?callbackUrl=${encodeURIComponent(bookingReturnPath)}`
  const registerHref = `/register?callbackUrl=${encodeURIComponent(bookingReturnPath)}`
  const browserTimeZone = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : model.timeZone
  const showLocalTime = model.policy.dualTimezoneDisplay && browserTimeZone && browserTimeZone !== model.timeZone
  const guestContactComplete = model.viewer.isSignedIn || (
    guestName.trim().length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim()) &&
    guestPhone.trim().length > 0
  )

  useEffect(() => {
    if (!selectedPrimaryVariantId) {
      setSequenceOptions([])
      setSequenceError("")
      setSequenceLoaded(false)
      setSequenceLoading(false)
      return
    }

    const controller = new AbortController()
    let active = true

    async function loadSequenceOptions() {
      setSequenceLoading(true)
      setSequenceError("")
      setSequenceLoaded(false)
      setSequenceOptions([])

      try {
        const response = await fetch(`/api/book/${model.practiceSlug}/sequence-options`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            primaryServiceVariantId: selectedPrimaryVariantId,
            addOnServiceVariantIds: orderedSelectedAddOnVariantIds,
            requestedPressureLevel,
            preferredProviderId,
          }),
          signal: controller.signal,
        })
        const payload = await response.json().catch(() => ({}))

        if (!active) return
        if (!response.ok) {
          throw new Error(typeof payload.error === "string" ? payload.error : "Unable to load available times.")
        }

        setSequenceOptions(Array.isArray(payload.options) ? payload.options : [])
        setSequenceLoaded(true)
      } catch (error) {
        if (!active || (error instanceof DOMException && error.name === "AbortError")) {
          return
        }

        setSequenceOptions([])
        setSequenceError(error instanceof Error ? error.message : "Unable to load available times.")
        setSequenceLoaded(true)
      } finally {
        if (active) {
          setSequenceLoading(false)
        }
      }
    }

    loadSequenceOptions()

    return () => {
      active = false
      controller.abort()
    }
  }, [model.practiceSlug, orderedSelectedAddOnVariantIds, preferredProviderId, reloadToken, requestedPressureLevel, selectedPrimaryVariantId])

  function toggleAddOn(variantId: string) {
    setSelectedAddOnVariantIds((current) => {
      if (current.includes(variantId)) return current.filter((id) => id !== variantId)
      if (current.length >= MAX_PUBLIC_ADD_ONS) return current
      return [...current, variantId]
    })
  }

  function checkDistance() {
    if (!model.proximity.enabled || typeof model.proximity.latitude !== "number" || typeof model.proximity.longitude !== "number") {
      setDistanceNotice("This practice has not published a location check yet.")
      return
    }
    if (!navigator.geolocation) {
      setDistanceNotice("Your browser cannot check distance. Review the practice location before booking.")
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const miles = distanceMiles(
          { latitude: position.coords.latitude, longitude: position.coords.longitude },
          { latitude: model.proximity.latitude!, longitude: model.proximity.longitude! },
        )
        if (miles > model.proximity.radiusMiles) {
          setDistanceNotice(`This booking page looks about ${Math.round(miles)} miles from you. You can still book if you are traveling or this is intentional; a therapist directory can help with closer options later.`)
        } else {
          setDistanceNotice(`This practice looks within about ${model.proximity.radiusMiles} miles of you.`)
        }
      },
      () => setDistanceNotice("Distance check was not allowed. You can still book if this is the right practice."),
      { maximumAge: 10 * 60_000, timeout: 10_000 },
    )
  }

  if (!firstPrimaryVariant) {
    return (
      <Card className="border-border/80 bg-card/90 backdrop-blur">
        <CardHeader>
          <CardTitle>No online services yet</CardTitle>
          <CardDescription>This practice has not published client-visible primary services.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.2fr)]">
      <Card className="border-border/80 bg-card/95 shadow-lg shadow-black/15 backdrop-blur">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">1. Choose services</Badge>
            <Badge variant="outline">2. Pressure</Badge>
            <Badge variant="outline">3. Choose time</Badge>
          </div>
          <CardTitle className="mt-3">Services and add-ons</CardTitle>
          <CardDescription>Build one continuous booking request. Add-ons are scheduled after the primary service.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Primary service</p>
            <div className="grid gap-2">
              {model.primaryServices.flatMap((service) => service.variants.map((variant) => {
                const price = moneyLabel(variant.priceCents, variant.currency)
                const selected = variant.id === selectedPrimaryVariantId

                return (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={() => setSelectedPrimaryVariantId(variant.id)}
                    className={cn(
                      "w-full rounded-lg border p-4 text-left transition hover:border-primary/70 hover:bg-primary/5",
                      selected ? "border-primary/70 bg-primary/10" : "border-border/70 bg-background/60",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">{service.name}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {variant.name} · {variant.durationMinutes} min{price ? ` · ${price}` : ""}
                        </p>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {service.description ?? "Choose add-ons, pressure preference, and time."}
                        </p>
                      </div>
                      {selected ? <Check data-icon="inline-start" className="mt-0.5 text-brand-orange" /> : null}
                    </div>
                  </button>
                )
              }))}
            </div>
          </div>

          {model.addOnServices.length > 0 ? (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm font-medium">Add-ons</p>
                <p className="text-xs text-muted-foreground">Choose up to {MAX_PUBLIC_ADD_ONS} add-ons.</p>
                <div className="grid gap-2">
                  {model.addOnServices.flatMap((service) => service.variants.map((variant) => {
                    const price = moneyLabel(variant.priceCents, variant.currency)
                    const selected = selectedAddOnVariantIds.includes(variant.id)
                    const disabled = !selected && selectedAddOnVariantIds.length >= MAX_PUBLIC_ADD_ONS

                    return (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() => toggleAddOn(variant.id)}
                        disabled={disabled}
                        className={cn(
                          "flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm transition hover:border-primary/70",
                          selected ? "border-primary/70 bg-primary/10" : "border-border/70 bg-background/60",
                          disabled && "cursor-not-allowed opacity-50 hover:border-border/70",
                        )}
                      >
                        <span>
                          {service.name} · {variant.name}
                          <span className="ml-2 text-muted-foreground">{variant.durationMinutes} min{price ? ` · ${price}` : ""}</span>
                        </span>
                        {selected ? <Check className="size-4 text-brand-orange" /> : <Plus className="size-4 text-muted-foreground" />}
                      </button>
                    )
                  }))}
                </div>
              </div>
            </>
          ) : null}

          <Separator />
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="size-4 text-brand-orange" />
              <p className="text-sm font-medium">Preferred pressure</p>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setRequestedPressureLevel(level)}
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm font-medium transition hover:border-primary/70",
                    requestedPressureLevel === level ? "border-primary/70 bg-primary/10" : "border-border/70 bg-background/60",
                  )}
                >
                  {level}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Pressure is a comfort preference from light to firm. Higher pressure does not necessarily mean deep tissue.
            </p>
          </div>

          {model.providers.length > 1 ? (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm font-medium">Provider preference</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {model.providers.map((provider) => (
                    <button
                      key={provider.id || "any-provider"}
                      type="button"
                      onClick={() => setPreferredProviderId(provider.id)}
                      className={cn(
                        "rounded-md border p-3 text-left text-sm transition hover:border-primary/70 hover:bg-primary/5",
                        provider.id === preferredProviderId ? "border-primary/70 bg-primary/10" : "border-border/70 bg-background/60",
                      )}
                    >
                      <UserRound className="mb-2 size-4 text-brand-orange" />
                      {provider.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {!model.viewer.isSignedIn ? (
          <AccountBenefitsCard
            guestName={guestName}
            guestEmail={guestEmail}
            guestPhone={guestPhone}
            loginHref={loginHref}
            registerHref={registerHref}
            onGuestNameChange={setGuestName}
            onGuestEmailChange={setGuestEmail}
            onGuestPhoneChange={setGuestPhone}
          />
        ) : null}

        <Card className="border-border/80 bg-card/95 shadow-lg shadow-black/15 backdrop-blur">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays data-icon="inline-start" className="text-brand-orange" />
                  Available sequences
                </CardTitle>
                <CardDescription>
                  {model.policy.approvalMode === "AUTO_CONFIRM" ? "These times confirm immediately." : "These times are sent as appointment requests."}
                </CardDescription>
              </div>
              <Badge variant="outline">{model.timeZone}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {sequenceLoading && !sequenceLoaded ? (
              <div className="rounded-lg border border-border/80 bg-background/50 p-6">
                <p className="text-sm text-muted-foreground">Loading available sequences...</p>
              </div>
            ) : sequenceError ? (
              <div className="rounded-lg border border-dashed border-border/80 bg-background/50 p-6">
                <p className="text-sm text-muted-foreground">{sequenceError}</p>
                <Button type="button" variant="outline" className="mt-4" onClick={() => setReloadToken((value) => value + 1)}>
                  Try again
                </Button>
              </div>
            ) : sequenceOptions.length > 0 ? (
              sequenceOptions.map((option) => (
                <div key={`${option.startsAt}-${option.items.map((item) => item.providerUserId).join("-")}`} className="rounded-lg border border-border/80 bg-background/60 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="flex items-center gap-2 font-medium">
                        <Clock className="size-4 text-brand-orange" />
                        {timeLabel(option.startsAt, model.timeZone)}
                      </p>
                      {showLocalTime ? (
                        <p className="mt-1 text-xs text-muted-foreground">Your local time: {timeLabel(option.startsAt, browserTimeZone)}</p>
                      ) : null}
                    </div>
                    <form action={requestBookingSequenceAction}>
                      <input type="hidden" name="practiceId" value={model.practiceId} />
                      <input type="hidden" name="primaryServiceVariantId" value={selectedPrimaryVariantId} />
                      {orderedSelectedAddOnVariantIds.map((variantId) => (
                        <input key={variantId} type="hidden" name="addOnServiceVariantIds" value={variantId} />
                      ))}
                      <input type="hidden" name="requestedPressureLevel" value={requestedPressureLevel} />
                      <input type="hidden" name="preferredProviderId" value={preferredProviderId} />
                      <input type="hidden" name="startsAt" value={option.startsAt} />
                      <GuestHiddenContactInputs isSignedIn={model.viewer.isSignedIn} guestName={guestName} guestEmail={guestEmail} guestPhone={guestPhone} />
                      <Button type="submit" size="sm" className="bg-primary hover:bg-brand-orange-glow" disabled={!guestContactComplete}>
                        {option.status === "CONFIRMED" ? "Book" : "Request"}
                      </Button>
                    </form>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {option.items.map((item) => (
                      <div key={`${item.sortOrder}-${item.serviceVariantId}`} className="rounded-md border border-border/60 bg-card/70 px-3 py-2 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span>{item.serviceName} · {item.serviceVariantName}</span>
                          <span className="text-muted-foreground">{shortTimeLabel(item.startsAt, model.timeZone)}-{shortTimeLabel(item.endsAt, model.timeZone)}</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{item.providerLabel}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : sequenceLoaded ? (
              <div className="rounded-lg border border-dashed border-border/80 bg-background/50 p-6">
                <p className="text-sm text-muted-foreground">No available sequence fits these services, pressure preference, provider rules, and current capacity.</p>
                <form action={joinBookingWaitlistAction} className="mt-4">
                  <input type="hidden" name="practiceId" value={model.practiceId} />
                  <input type="hidden" name="primaryServiceVariantId" value={selectedPrimaryVariantId} />
                  {orderedSelectedAddOnVariantIds.map((variantId) => (
                    <input key={variantId} type="hidden" name="addOnServiceVariantIds" value={variantId} />
                  ))}
                  <input type="hidden" name="requestedPressureLevel" value={requestedPressureLevel} />
                  <input type="hidden" name="preferredProviderId" value={preferredProviderId} />
                  <GuestHiddenContactInputs isSignedIn={model.viewer.isSignedIn} guestName={guestName} guestEmail={guestEmail} guestPhone={guestPhone} />
                  <Button type="submit" variant="outline" disabled={!guestContactComplete}>Join waitlist</Button>
                </form>
              </div>
            ) : (
              <div className="rounded-lg border border-border/80 bg-background/50 p-6">
                <p className="text-sm text-muted-foreground">Loading available sequences...</p>
              </div>
            )}
          </CardContent>
        </Card>

        {model.proximity.enabled ? (
          <Card className="border-border/80 bg-card/90 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="size-4 text-brand-orange" />
                Practice location
              </CardTitle>
              <CardDescription>{model.proximity.label ?? model.practiceName}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button type="button" variant="outline" size="sm" onClick={checkDistance}>Check distance</Button>
              {distanceNotice ? <p className="text-sm text-muted-foreground">{distanceNotice}</p> : null}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  )
}

function GuestHiddenContactInputs({
  isSignedIn,
  guestName,
  guestEmail,
  guestPhone,
}: {
  isSignedIn: boolean
  guestName: string
  guestEmail: string
  guestPhone: string
}) {
  if (isSignedIn) return null
  return (
    <>
      <input type="hidden" name="guestName" value={guestName} />
      <input type="hidden" name="guestEmail" value={guestEmail} />
      <input type="hidden" name="guestPhone" value={guestPhone} />
    </>
  )
}

function AccountBenefitsCard({
  guestName,
  guestEmail,
  guestPhone,
  loginHref,
  registerHref,
  onGuestNameChange,
  onGuestEmailChange,
  onGuestPhoneChange,
}: {
  guestName: string
  guestEmail: string
  guestPhone: string
  loginHref: string
  registerHref: string
  onGuestNameChange: (value: string) => void
  onGuestEmailChange: (value: string) => void
  onGuestPhoneChange: (value: string) => void
}) {
  return (
    <Card className="border-border/80 bg-card/90 backdrop-blur">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base">Your contact information</CardTitle>
            <CardDescription className="mt-2">
              You can book as a guest. A free account can save these details and make request status easier to track later.
            </CardDescription>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                <UserPlus data-icon="inline-start" />
                Sign in or create account
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Save time with a free MassageLab account</DialogTitle>
                <DialogDescription>
                  Guest booking stays available here. Signing in or creating an account can save your contact details and make request status easier to find later.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 text-sm text-muted-foreground">
                <p>Use an account if you want saved profile details, easier status tracking, and a smoother next booking.</p>
                <p>Continue as guest if you only want to request this appointment right now.</p>
              </div>
              <DialogFooter className="gap-2 sm:justify-start">
                <Button asChild className="bg-primary hover:bg-brand-orange-glow">
                  <Link href={registerHref}>
                    <UserPlus data-icon="inline-start" />
                    Create free account
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={loginHref}>
                    <LogIn data-icon="inline-start" />
                    Sign in
                  </Link>
                </Button>
                <DialogClose asChild>
                  <Button type="button" variant="ghost">Continue as guest</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="space-y-2">
          <Label htmlFor="guestName">Name</Label>
          <Input id="guestName" name="guestName" value={guestName} onChange={(event) => onGuestNameChange(event.target.value)} autoComplete="name" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="guestEmail">Email</Label>
          <Input id="guestEmail" name="guestEmail" type="email" value={guestEmail} onChange={(event) => onGuestEmailChange(event.target.value)} autoComplete="email" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="guestPhone">Phone</Label>
          <Input id="guestPhone" name="guestPhone" type="tel" value={guestPhone} onChange={(event) => onGuestPhoneChange(event.target.value)} autoComplete="tel" required />
        </div>
      </CardContent>
    </Card>
  )
}
