"use client"

import { useEffect, useMemo, useState } from "react"
import { ClipboardList, Plus, RotateCcw, Trash2 } from "lucide-react"
import { AppPageShell, AppSurface, appCalloutClassName } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import {
  calculateServiceMenuPlan,
  normalizeServiceMenuInput,
} from "@/lib/business-plan-template-tools"
import {
  MetricTile,
  NumberField,
  TextAreaField,
  TextField,
  formatMoney,
  formatNumber,
} from "../_components/business-tool-fields"

type ServiceMenuInput = ReturnType<typeof normalizeServiceMenuInput>
type ServiceItem = ServiceMenuInput["services"][number]

const STORAGE_KEY = "massagelab-business-planner-service-menu-v1"

export function ServiceMenuClient() {
  const [input, setInput] = useState<ServiceMenuInput>(() => normalizeServiceMenuInput({}))
  const [storageReady, setStorageReady] = useState(false)
  const plan = useMemo(() => calculateServiceMenuPlan(input), [input])

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        setInput(normalizeServiceMenuInput(JSON.parse(stored)))
      } catch {
        window.localStorage.removeItem(STORAGE_KEY)
      }
    }
    setStorageReady(true)
  }, [])

  useEffect(() => {
    if (!storageReady) return

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(input))
  }, [input, storageReady])

  function updateService(index: number, field: keyof ServiceItem, value: string | number) {
    setInput((current) => normalizeServiceMenuInput({
      ...current,
      services: current.services.map((service, serviceIndex) => (
        serviceIndex === index ? { ...service, [field]: value } : service
      )),
    }))
  }

  function addService() {
    setInput((current) => normalizeServiceMenuInput({
      ...current,
      services: [
        ...current.services,
        { name: "Massage service", minutes: 60, price: 0 },
      ],
    }))
  }

  function removeService(index: number) {
    setInput((current) => normalizeServiceMenuInput({
      ...current,
      services: current.services.filter((_, serviceIndex) => serviceIndex !== index),
    }))
  }

  function updatePolicy(field: keyof Pick<ServiceMenuInput, "cancellationNoticeHours" | "lateCancellationFee" | "noShowFee">, value: number) {
    setInput((current) => normalizeServiceMenuInput({
      ...current,
      [field]: value,
    }))
  }

  function updatePrivacySteps(value: string) {
    setInput((current) => normalizeServiceMenuInput({
      ...current,
      privacySteps: value.split("\n"),
    }))
  }

  function resetWorksheet() {
    setInput(normalizeServiceMenuInput({}))
  }

  return (
    <AppPageShell width="full" contentClassName="gap-6">
      <AppSurface
        title="Service Menu and Policies"
        description="Draft the service, pricing, scheduling, cancellation, no-show, and documentation privacy pieces of the business plan template."
        icon={<ClipboardList className="h-5 w-5" aria-hidden="true" />}
        badge="Browser worksheet"
        className={appCalloutClassName}
      >
        <div className="grid gap-3 md:grid-cols-4">
          <MetricTile label="Services" value={String(plan.serviceCount)} />
          <MetricTile label="Average hourly rate" value={formatMoney(plan.averageHourlyRate)} />
          <MetricTile label="Lowest price" value={formatMoney(plan.lowestPrice)} />
          <MetricTile label="Highest price" value={formatMoney(plan.highestPrice)} />
        </div>
      </AppSurface>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
        <div className="space-y-6">
          <AppSurface
            title="Service menu"
            description="List each service students plan to offer, then compare the implied hourly rate."
          >
            <div className="space-y-3">
              {input.services.map((service, index) => (
                <div key={`service-${index}`} className="grid gap-3 rounded-md border border-border/80 bg-background/70 p-3 md:grid-cols-[minmax(0,1fr)_8rem_8rem_auto] md:items-end">
                  <TextField
                    id={`service-${index}-name`}
                    label="Service"
                    value={service.name}
                    onChange={(value) => updateService(index, "name", value)}
                  />
                  <NumberField
                    id={`service-${index}-minutes`}
                    label="Minutes"
                    value={service.minutes}
                    step="15"
                    onChange={(value) => updateService(index, "minutes", value)}
                  />
                  <NumberField
                    id={`service-${index}-price`}
                    label="Price"
                    value={service.price}
                    onChange={(value) => updateService(index, "price", value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10"
                    aria-label={`Remove ${service.name || "service"}`}
                    onClick={() => removeService(index)}
                    disabled={input.services.length <= 1}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={addService}>
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                Add service
              </Button>
              <Button type="button" variant="outline" onClick={resetWorksheet}>
                <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
                Reset worksheet
              </Button>
            </div>
          </AppSurface>

          <AppSurface
            title="Client policies"
            description="Write the template's scheduling, cancellation, no-show, and client-documentation privacy rules."
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <NumberField
                id="policy-cancellation-hours"
                label="Cancellation notice hours"
                value={input.cancellationNoticeHours}
                onChange={(value) => updatePolicy("cancellationNoticeHours", value)}
              />
              <NumberField
                id="policy-late-fee"
                label="Late-cancellation fee"
                value={input.lateCancellationFee}
                onChange={(value) => updatePolicy("lateCancellationFee", value)}
              />
              <NumberField
                id="policy-no-show-fee"
                label="No-show fee"
                value={input.noShowFee}
                onChange={(value) => updatePolicy("noShowFee", value)}
              />
            </div>
            <TextAreaField
              id="policy-privacy-steps"
              label="Documentation privacy steps"
              value={input.privacySteps.join("\n")}
              rows={5}
              onChange={updatePrivacySteps}
            />
          </AppSurface>
        </div>

        <div className="space-y-6">
          <AppSurface
            title="Menu summary"
            description="A practical view of the service list and hourly-rate spread."
          >
            <div className="space-y-3">
              {plan.rows.map((service, index) => (
                <div key={`${service.name}-${index}`} className="rounded-md border border-border/80 bg-background/70 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{service.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatNumber(service.minutes)} minutes at {formatMoney(service.price)}</p>
                    </div>
                    <p className="text-sm font-semibold">{formatMoney(service.hourlyRate)} / hour</p>
                  </div>
                </div>
              ))}
            </div>
          </AppSurface>

          <AppSurface
            title="Policy summary"
            description="A draft sentence students can adapt into the Business Operation section."
          >
            <p className="text-sm leading-6 text-muted-foreground">{plan.policySummary}</p>
          </AppSurface>
        </div>
      </div>
    </AppPageShell>
  )
}
