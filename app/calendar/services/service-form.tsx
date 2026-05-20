import type { Prisma } from "@prisma/client"
import { createServiceAction, updateServiceAction } from "@/app/calendar/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type ServiceFormService = Prisma.ServiceTypeGetPayload<{
  include: {
    variants: {
      include: {
        resourceRequirements: {
          include: { resource: true }
        }
      }
    }
  }
}>

type ServiceFormProvider = {
  userId: string
  user: {
    name: string | null
    email: string | null
  }
}

function priceValue(cents?: number | null) {
  return cents == null ? "" : String(cents / 100)
}

function resourceNames(service?: ServiceFormService | null) {
  if (!service) return ""

  const names = new Set<string>()
  for (const variant of service.variants) {
    for (const requirement of variant.resourceRequirements) {
      names.add(requirement.resource.name)
    }
  }

  return [...names].join(", ")
}

function refLabels(value: Prisma.JsonValue | null | undefined) {
  if (!Array.isArray(value)) return ""
  return value
    .map((item) => {
      if (item && typeof item === "object" && !Array.isArray(item) && "label" in item && typeof item.label === "string") {
        return item.label
      }
      return ""
    })
    .filter(Boolean)
    .join(", ")
}

function promptText(value: Prisma.JsonValue | null | undefined) {
  if (!Array.isArray(value)) return ""
  return value.filter((item): item is string => typeof item === "string").join("\n")
}

export function ServiceForm({
  practiceId,
  providers = [],
  service = null,
}: {
  practiceId: string
  providers?: ServiceFormProvider[]
  service?: ServiceFormService | null
}) {
  const variants = service?.variants ?? []
  const action = service ? updateServiceAction : createServiceAction

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="practiceId" value={practiceId} />
      {service ? <input type="hidden" name="serviceId" value={service.id} /> : null}

      <Card className="border-neutral-800 bg-card/90 backdrop-blur">
        <CardHeader>
          <CardTitle>Service details</CardTitle>
          <CardDescription>These settings control booking visibility, class eligibility, and calendar color.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Service name</Label>
            <Input id="name" name="name" defaultValue={service?.name ?? ""} placeholder="Therapeutic massage" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Input id="category" name="category" defaultValue={service?.category ?? ""} placeholder="Massage" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="color">Calendar color</Label>
            <Input id="color" name="color" type="color" defaultValue={service?.color ?? "#f97316"} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="resourceNames">Required resources</Label>
            <Input id="resourceNames" name="resourceNames" defaultValue={resourceNames(service)} placeholder="Room 1, Table warmer" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="modality">Modality</Label>
            <Input id="modality" name="modality" defaultValue={service?.modality ?? ""} placeholder="Therapeutic massage" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bodyRegions">Body-region focus</Label>
            <Input id="bodyRegions" name="bodyRegions" defaultValue={service?.bodyRegions.join(", ") ?? ""} placeholder="Neck, shoulder, low back" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" defaultValue={service?.description ?? ""} placeholder="Client-facing service summary." />
          </div>
          {providers.length > 0 ? (
            <div className="grid gap-2 md:col-span-2">
              <Label>Eligible providers</Label>
              <div className="grid gap-2 md:grid-cols-2">
                {providers.map((provider) => (
                  <label key={provider.userId} className="flex items-center gap-2 rounded-md border border-neutral-800 bg-background/70 p-3 text-sm">
                    <Checkbox
                      name="eligibleProviderIds"
                      value={provider.userId}
                      defaultChecked={service?.eligibleProviderIds.includes(provider.userId) ?? false}
                    />
                    <span>{provider.user.name ?? provider.user.email}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Leave every provider unchecked to allow all providers in this workspace.</p>
            </div>
          ) : null}
          <label className="flex items-center gap-2 text-sm">
            <Checkbox name="clientVisible" defaultChecked={service?.clientVisible ?? true} />
            <span>Bookable by clients</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox name="classEligible" defaultChecked={service?.classEligible ?? false} />
            <span>Can be used for classes</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox name="inactive" defaultChecked={service ? !service.active : false} />
            <span>Inactive</span>
          </label>
        </CardContent>
      </Card>

      <Card className="border-neutral-800 bg-card/90 backdrop-blur">
        <CardHeader>
          <CardTitle>Variants</CardTitle>
          <CardDescription>Variants set the bookable duration, processing time, buffers, and displayed price.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 3 }, (_, index) => {
            const variant = variants[index]
            return (
              <div key={variant?.id ?? index} className="grid gap-3 rounded-md border border-neutral-800 bg-background/70 p-3 md:grid-cols-6">
                {variant ? <input type="hidden" name={`variantId${index}`} value={variant.id} /> : null}
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor={`variantName${index}`}>Variant</Label>
                  <Input id={`variantName${index}`} name={`variantName${index}`} defaultValue={variant?.name ?? (index === 0 ? "Default" : "")} placeholder="60 minute" required={index === 0} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`variantDurationMinutes${index}`}>Work</Label>
                  <Input id={`variantDurationMinutes${index}`} name={`variantDurationMinutes${index}`} type="number" min="1" defaultValue={variant?.durationMinutes ?? (index === 0 ? 60 : "")} required={index === 0} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`variantProcessingMinutes${index}`}>Processing</Label>
                  <Input id={`variantProcessingMinutes${index}`} name={`variantProcessingMinutes${index}`} type="number" min="0" defaultValue={variant?.processingMinutes ?? 0} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`variantBufferBeforeMinutes${index}`}>Before</Label>
                  <Input id={`variantBufferBeforeMinutes${index}`} name={`variantBufferBeforeMinutes${index}`} type="number" min="0" defaultValue={variant?.bufferBeforeMinutes ?? 0} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`variantBufferAfterMinutes${index}`}>After</Label>
                  <Input id={`variantBufferAfterMinutes${index}`} name={`variantBufferAfterMinutes${index}`} type="number" min="0" defaultValue={variant?.bufferAfterMinutes ?? 0} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`variantPrice${index}`}>Price</Label>
                  <Input id={`variantPrice${index}`} name={`variantPrice${index}`} type="number" min="0" step="0.01" defaultValue={priceValue(variant?.priceCents)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`variantCurrency${index}`}>Currency</Label>
                  <Input id={`variantCurrency${index}`} name={`variantCurrency${index}`} defaultValue={variant?.currency ?? "USD"} />
                </div>
                {index > 0 ? (
                  <label className="flex items-center gap-2 text-sm md:col-span-2">
                    <Checkbox name={`variantActive${index}`} defaultChecked={Boolean(variant?.active)} />
                    <span>Use this variant</span>
                  </label>
                ) : null}
                <label className="flex items-center gap-2 text-sm md:col-span-2">
                  <Checkbox name={`variantHidden${index}`} defaultChecked={variant ? !variant.clientVisible : false} />
                  <span>Hide from client booking</span>
                </label>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card className="border-neutral-800 bg-card/90 backdrop-blur">
        <CardHeader>
          <CardTitle>Clinical templates</CardTitle>
          <CardDescription>Reusable local-first template references only. Do not enter client-specific clinical content here.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="documentationTemplateRefs">Documentation templates</Label>
            <Input id="documentationTemplateRefs" name="documentationTemplateRefs" defaultValue={refLabels(service?.documentationTemplateRefs)} placeholder="Follow-up SOAP shell, Wellness plan" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="intakeTemplateRefs">Intake templates</Label>
            <Input id="intakeTemplateRefs" name="intakeTemplateRefs" defaultValue={refLabels(service?.intakeTemplateRefs)} placeholder="Massage intake, Return visit intake" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="contraindicationPrompts">Contraindication prompts</Label>
            <Textarea id="contraindicationPrompts" name="contraindicationPrompts" defaultValue={promptText(service?.contraindicationPrompts)} placeholder="Ask about acute injury before booking." />
          </div>
        </CardContent>
      </Card>

      <Card className="border-neutral-800 bg-card/90 backdrop-blur">
        <CardHeader>
          <CardTitle>Operations</CardTitle>
          <CardDescription>These fields are stored for provider operations. They do not charge clients or collect payment yet.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Textarea name="supplies" defaultValue={service?.supplies ?? ""} placeholder="Supplies or setup needs" />
          <Textarea name="prepNotes" defaultValue={service?.prepNotes ?? ""} placeholder="Provider prep notes" />
          <Textarea name="intakeRequirements" defaultValue={service?.intakeRequirements ?? ""} placeholder="Intake requirements" />
          <Textarea name="contraindicationNotice" defaultValue={service?.contraindicationNotice ?? ""} placeholder="Contraindication notice" />
          <Textarea name="cancellationPolicy" defaultValue={service?.cancellationPolicy ?? ""} placeholder="Cancellation policy" />
          <Textarea name="noShowPolicy" defaultValue={service?.noShowPolicy ?? ""} placeholder="No-show policy" />
          <Textarea name="depositPolicy" defaultValue={service?.depositPolicy ?? ""} placeholder="Deposit policy" />
          <Textarea name="taxPolicy" defaultValue={service?.taxPolicy ?? ""} placeholder="Tax policy" />
          <Textarea name="packagePolicy" defaultValue={service?.packagePolicy ?? ""} placeholder="Packages or memberships policy" />
        </CardContent>
      </Card>

      <Button type="submit" className="bg-primary hover:bg-brand-orange-glow">
        {service ? "Update service" : "Create service"}
      </Button>
    </form>
  )
}
