import "server-only"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { Prisma } from "@prisma/client"
import { assertCalendarDatabaseReady } from "@/lib/calendar-readiness"
import { FEATURE_KEYS, getUserEntitlementState } from "@/lib/membership"
import { prisma } from "@/lib/prisma"
import {
  FREE_CALENDAR_LIMITS,
  sanitizeServiceClinicalTemplatePayload,
  sanitizeServicePolicyPayload,
} from "@/lib/service-catalog"
import {
  STAFF_ROLES,
  assertPracticeAccess,
  currentUserId,
  fieldBoolean,
  fieldPriceCents,
  fieldString,
  positiveMinutes,
} from "./access"
import {
  serviceBookingRole,
  serviceCountsTowardCapacity,
} from "./service-catalog"

function parseResourceNames(formData: FormData) {
  return fieldString(formData, "resourceNames")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
    .slice(0, 10)
}

function parseBodyRegions(formData: FormData) {
  return fieldString(formData, "bodyRegions")
    .split(",")
    .map((region) => region.trim())
    .filter(Boolean)
    .slice(0, 20)
}

function parseProviderEligibility(formData: FormData) {
  const checked = formData.getAll("eligibleProviderIds")
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean)
  if (checked.length > 0) {
    return checked.slice(0, 50)
  }

  return fieldString(formData, "eligibleProviderIds")
    .split(",")
    .map((providerId) => providerId.trim())
    .filter(Boolean)
    .slice(0, 50)
}

function parseTemplateRefs(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 20)
    .map((label) => ({ id: label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || label, label }))
}

function parsePromptList(value: string) {
  return value
    .split("\n")
    .map((prompt) => prompt.trim())
    .filter(Boolean)
    .slice(0, 20)
}

/**
 * Parses up to three submitted service variants into the write shape used by
 * service create/update actions. Inactive or incomplete rows are ignored, the
 * first active row must have a positive duration, and at least one usable
 * variant is required before a service can be saved.
 */
function parseServiceVariants(formData: FormData) {
  const variants = Array.from({ length: 3 }, (_, index) => {
    const name = fieldString(formData, `variantName${index}`) || (index === 0 ? "Default" : "")
    const durationMinutes = positiveMinutes(formData, `variantDurationMinutes${index}`, index === 0 ? 60 : 0)
    const active = index === 0 || fieldBoolean(formData, `variantActive${index}`)

    if (!name || durationMinutes <= 0 || !active) return null

    return {
      id: fieldString(formData, `variantId${index}`) || null,
      name,
      durationMinutes,
      processingMinutes: positiveMinutes(formData, `variantProcessingMinutes${index}`, 0),
      bufferBeforeMinutes: positiveMinutes(formData, `variantBufferBeforeMinutes${index}`, 0),
      bufferAfterMinutes: positiveMinutes(formData, `variantBufferAfterMinutes${index}`, 0),
      priceCents: fieldPriceCents(formData, `variantPrice${index}`),
      currency: fieldString(formData, `variantCurrency${index}`).toUpperCase() || "USD",
      active: true,
      clientVisible: !fieldBoolean(formData, `variantHidden${index}`),
      sortOrder: index,
    }
  }).filter(Boolean)

  if (variants.length === 0) {
    throw new Error("Add at least one service variant with a valid duration.")
  }

  return variants as Array<{
    id: string | null
    name: string
    durationMinutes: number
    processingMinutes: number
    bufferBeforeMinutes: number
    bufferAfterMinutes: number
    priceCents: number | null
    currency: string
    active: boolean
    clientVisible: boolean
    sortOrder: number
  }>
}

/**
 * Enforces the free calendar catalog limits before service writes.
 * Paid scheduling access bypasses these caps through feature-key entitlements,
 * not displayed plan names.
 */
async function assertServiceCatalogLimits({
  practiceId,
  userId,
  variantCount,
  resultingActive,
  updatingServiceId,
}: {
  practiceId: string
  userId: string
  variantCount: number
  resultingActive: boolean
  updatingServiceId?: string
}) {
  const entitlements = await getUserEntitlementState(prisma, userId)
  if (entitlements.hasFeature(FEATURE_KEYS.calendarFullScheduling)) return

  if (variantCount > FREE_CALENDAR_LIMITS.activeVariantsPerService) {
    throw new Error("Free calendars can keep up to three active variants per service.")
  }

  if (resultingActive) {
    const activeServiceCount = await prisma.serviceType.count({
      where: {
        practiceId,
        active: true,
        ...(updatingServiceId ? { id: { not: updatingServiceId } } : {}),
      },
    })
    if (activeServiceCount >= FREE_CALENDAR_LIMITS.activeServices) {
      throw new Error("Free calendars can keep up to three active services.")
    }
  }
}

/**
 * Resolves named practice resources inside the service write transaction.
 * Existing resources are reused by name; missing resources are created and the
 * resulting records are returned for variant-resource join rows.
 */
async function ensureCalendarResources(tx: Prisma.TransactionClient, practiceId: string, names: string[]) {
  const resources = []

  for (const name of names) {
    const existing = await tx.calendarResource.findFirst({
      where: { practiceId, name },
    })

    if (existing) {
      resources.push(existing)
    } else {
      resources.push(await tx.calendarResource.create({
        data: {
          practiceId,
          name,
        },
      }))
    }
  }

  return resources
}

export async function createService(formData: FormData) {
  const userId = await currentUserId()
  await assertCalendarDatabaseReady()
  const practiceId = fieldString(formData, "practiceId")
  const name = fieldString(formData, "name")
  const description = fieldString(formData, "description")
  const category = fieldString(formData, "category")
  const bookingRole = serviceBookingRole(formData)
  const countsTowardMassageCapacity = serviceCountsTowardCapacity(formData, bookingRole)
  const color = fieldString(formData, "color")
  const variants = parseServiceVariants(formData)
  const resourceNames = parseResourceNames(formData)
  const resultingActive = !fieldBoolean(formData, "inactive")
  const clinicalFields = sanitizeServiceClinicalTemplatePayload({
    modality: fieldString(formData, "modality"),
    bodyRegionFocus: parseBodyRegions(formData),
    documentationTemplateRefs: parseTemplateRefs(fieldString(formData, "documentationTemplateRefs")),
    intakeTemplateRefs: parseTemplateRefs(fieldString(formData, "intakeTemplateRefs")),
    contraindicationPrompts: parsePromptList(fieldString(formData, "contraindicationPrompts")),
  })
  const policyFields = sanitizeServicePolicyPayload({
    supplies: fieldString(formData, "supplies"),
    prepNotes: fieldString(formData, "prepNotes"),
    intakeRequirements: fieldString(formData, "intakeRequirements"),
    contraindicationNotice: fieldString(formData, "contraindicationNotice"),
    cancellationPolicy: fieldString(formData, "cancellationPolicy"),
    noShowPolicy: fieldString(formData, "noShowPolicy"),
    depositPolicy: fieldString(formData, "depositPolicy"),
    taxPolicy: fieldString(formData, "taxPolicy"),
    packagePolicy: fieldString(formData, "packagePolicy"),
  })

  await assertPracticeAccess(practiceId, userId, STAFF_ROLES)
  await assertServiceCatalogLimits({ practiceId, userId, variantCount: variants.length, resultingActive })

  if (!name) {
    throw new Error("Service name is required.")
  }

  const service = await prisma.$transaction(async (tx) => {
    const createdService = await tx.serviceType.create({
      data: {
        practiceId,
        name,
        description: description || null,
        category: category || null,
        color: color || null,
        durationMinutes: variants[0].durationMinutes,
        bufferMinutes: variants[0].bufferAfterMinutes,
        clientVisible: fieldBoolean(formData, "clientVisible"),
        bookingRole,
        countsTowardMassageCapacity,
        classEligible: fieldBoolean(formData, "classEligible"),
        supplies: String(policyFields.supplies ?? "") || null,
        prepNotes: String(policyFields.prepNotes ?? "") || null,
        intakeRequirements: String(policyFields.intakeRequirements ?? "") || null,
        contraindicationNotice: String(policyFields.contraindicationNotice ?? "") || null,
        modality: String(clinicalFields.modality ?? "") || null,
        bodyRegions: Array.isArray(clinicalFields.bodyRegionFocus) ? clinicalFields.bodyRegionFocus.map(String) : [],
        eligibleProviderIds: parseProviderEligibility(formData),
        documentationTemplateRefs: (clinicalFields.documentationTemplateRefs ?? []) as Prisma.InputJsonValue,
        intakeTemplateRefs: (clinicalFields.intakeTemplateRefs ?? []) as Prisma.InputJsonValue,
        contraindicationPrompts: (clinicalFields.contraindicationPrompts ?? []) as Prisma.InputJsonValue,
        cancellationPolicy: String(policyFields.cancellationPolicy ?? "") || null,
        noShowPolicy: String(policyFields.noShowPolicy ?? "") || null,
        depositPolicy: String(policyFields.depositPolicy ?? "") || null,
        taxPolicy: String(policyFields.taxPolicy ?? "") || null,
        packagePolicy: String(policyFields.packagePolicy ?? "") || null,
        active: resultingActive,
        variants: {
          create: variants.map((variant) => ({
            name: variant.name,
            durationMinutes: variant.durationMinutes,
            processingMinutes: variant.processingMinutes,
            bufferBeforeMinutes: variant.bufferBeforeMinutes,
            bufferAfterMinutes: variant.bufferAfterMinutes,
            priceCents: variant.priceCents,
            currency: variant.currency,
            active: variant.active,
            clientVisible: variant.clientVisible,
            sortOrder: variant.sortOrder,
          })),
        },
      },
      include: { variants: true },
    })

    const resources = await ensureCalendarResources(tx, practiceId, resourceNames)
    if (resources.length > 0) {
      await tx.serviceVariantResource.createMany({
        data: createdService.variants.flatMap((variant) => resources.map((resource) => ({
          serviceVariantId: variant.id,
          resourceId: resource.id,
        }))),
        skipDuplicates: true,
      })
    }

    return createdService
  })

  revalidatePath("/calendar")
  revalidatePath("/calendar/services")
  redirect(`/calendar/services/${service.id}`)
}

export async function updateService(formData: FormData) {
  const userId = await currentUserId()
  await assertCalendarDatabaseReady()
  const practiceId = fieldString(formData, "practiceId")
  const serviceId = fieldString(formData, "serviceId")
  const name = fieldString(formData, "name")
  const description = fieldString(formData, "description")
  const category = fieldString(formData, "category")
  const bookingRole = serviceBookingRole(formData)
  const countsTowardMassageCapacity = serviceCountsTowardCapacity(formData, bookingRole)
  const color = fieldString(formData, "color")
  const variants = parseServiceVariants(formData)
  const resourceNames = parseResourceNames(formData)
  const resultingActive = !fieldBoolean(formData, "inactive")
  const clinicalFields = sanitizeServiceClinicalTemplatePayload({
    modality: fieldString(formData, "modality"),
    bodyRegionFocus: parseBodyRegions(formData),
    documentationTemplateRefs: parseTemplateRefs(fieldString(formData, "documentationTemplateRefs")),
    intakeTemplateRefs: parseTemplateRefs(fieldString(formData, "intakeTemplateRefs")),
    contraindicationPrompts: parsePromptList(fieldString(formData, "contraindicationPrompts")),
  })
  const policyFields = sanitizeServicePolicyPayload({
    supplies: fieldString(formData, "supplies"),
    prepNotes: fieldString(formData, "prepNotes"),
    intakeRequirements: fieldString(formData, "intakeRequirements"),
    contraindicationNotice: fieldString(formData, "contraindicationNotice"),
    cancellationPolicy: fieldString(formData, "cancellationPolicy"),
    noShowPolicy: fieldString(formData, "noShowPolicy"),
    depositPolicy: fieldString(formData, "depositPolicy"),
    taxPolicy: fieldString(formData, "taxPolicy"),
    packagePolicy: fieldString(formData, "packagePolicy"),
  })

  await assertPracticeAccess(practiceId, userId, STAFF_ROLES)

  if (!serviceId) {
    throw new Error("Choose a valid service.")
  }
  if (!name) {
    throw new Error("Service name is required.")
  }
  await assertServiceCatalogLimits({
    practiceId,
    userId,
    variantCount: variants.length,
    resultingActive,
    updatingServiceId: serviceId,
  })

  const existingService = await prisma.serviceType.findFirst({
    where: { id: serviceId, practiceId },
    select: { id: true },
  })

  if (!existingService) {
    throw new Error("Choose a valid service.")
  }

  await prisma.$transaction(async (tx) => {
    await tx.serviceType.update({
      where: { id: serviceId },
      data: {
        name,
        description: description || null,
        category: category || null,
        color: color || null,
        durationMinutes: variants[0].durationMinutes,
        bufferMinutes: variants[0].bufferAfterMinutes,
        clientVisible: fieldBoolean(formData, "clientVisible"),
        bookingRole,
        countsTowardMassageCapacity,
        classEligible: fieldBoolean(formData, "classEligible"),
        supplies: String(policyFields.supplies ?? "") || null,
        prepNotes: String(policyFields.prepNotes ?? "") || null,
        intakeRequirements: String(policyFields.intakeRequirements ?? "") || null,
        contraindicationNotice: String(policyFields.contraindicationNotice ?? "") || null,
        modality: String(clinicalFields.modality ?? "") || null,
        bodyRegions: Array.isArray(clinicalFields.bodyRegionFocus) ? clinicalFields.bodyRegionFocus.map(String) : [],
        eligibleProviderIds: parseProviderEligibility(formData),
        documentationTemplateRefs: (clinicalFields.documentationTemplateRefs ?? []) as Prisma.InputJsonValue,
        intakeTemplateRefs: (clinicalFields.intakeTemplateRefs ?? []) as Prisma.InputJsonValue,
        contraindicationPrompts: (clinicalFields.contraindicationPrompts ?? []) as Prisma.InputJsonValue,
        cancellationPolicy: String(policyFields.cancellationPolicy ?? "") || null,
        noShowPolicy: String(policyFields.noShowPolicy ?? "") || null,
        depositPolicy: String(policyFields.depositPolicy ?? "") || null,
        taxPolicy: String(policyFields.taxPolicy ?? "") || null,
        packagePolicy: String(policyFields.packagePolicy ?? "") || null,
        active: resultingActive,
      },
    })

    await tx.serviceVariant.deleteMany({
      where: {
        serviceTypeId: serviceId,
        id: { notIn: variants.map((variant) => variant.id).filter(Boolean) as string[] },
      },
    })

    const savedVariants = []
    for (const variant of variants) {
      if (variant.id) {
        const existingVariant = await tx.serviceVariant.findFirst({
          where: { id: variant.id, serviceTypeId: serviceId },
          select: { id: true },
        })
        if (!existingVariant) {
          throw new Error("Choose a valid service variant.")
        }
        savedVariants.push(await tx.serviceVariant.update({
          where: { id: variant.id },
          data: {
            name: variant.name,
            durationMinutes: variant.durationMinutes,
            processingMinutes: variant.processingMinutes,
            bufferBeforeMinutes: variant.bufferBeforeMinutes,
            bufferAfterMinutes: variant.bufferAfterMinutes,
            priceCents: variant.priceCents,
            currency: variant.currency,
            active: variant.active,
            clientVisible: variant.clientVisible,
            sortOrder: variant.sortOrder,
          },
        }))
      } else {
        savedVariants.push(await tx.serviceVariant.create({
          data: {
            serviceTypeId: serviceId,
            name: variant.name,
            durationMinutes: variant.durationMinutes,
            processingMinutes: variant.processingMinutes,
            bufferBeforeMinutes: variant.bufferBeforeMinutes,
            bufferAfterMinutes: variant.bufferAfterMinutes,
            priceCents: variant.priceCents,
            currency: variant.currency,
            active: variant.active,
            clientVisible: variant.clientVisible,
            sortOrder: variant.sortOrder,
          },
        }))
      }
    }

    await tx.serviceVariantResource.deleteMany({
      where: { serviceVariant: { serviceTypeId: serviceId } },
    })

    const resources = await ensureCalendarResources(tx, practiceId, resourceNames)
    if (resources.length > 0) {
      await tx.serviceVariantResource.createMany({
        data: savedVariants.flatMap((variant) => resources.map((resource) => ({
          serviceVariantId: variant.id,
          resourceId: resource.id,
        }))),
        skipDuplicates: true,
      })
    }
  })

  revalidatePath("/calendar")
  revalidatePath("/calendar/services")
  revalidatePath(`/calendar/services/${serviceId}`)
  redirect(`/calendar/services/${serviceId}`)
}
