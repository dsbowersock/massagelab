import "server-only"

import { Prisma } from "@prisma/client"
import { MAX_PUBLIC_ADD_ONS } from "@/lib/public-booking-sequences"
import { prisma } from "@/lib/prisma"
import {
  buildServiceSnapshot,
  composeAppointmentServices,
  serviceVariantBookableMinutes,
} from "@/lib/service-catalog"
import { fieldBoolean, fieldString } from "./access"

export type ServiceVariantForScheduling = Prisma.ServiceVariantGetPayload<{
  include: {
    serviceType: true
    resourceRequirements: {
      include: { resource: true }
    }
  }
}>

export async function getServiceVariantForScheduling({
  practiceId,
  serviceVariantId,
  serviceTypeId,
  providerUserId,
  clientVisible = false,
  classEligible = false,
}: {
  practiceId: string
  serviceVariantId?: string
  serviceTypeId?: string
  providerUserId?: string
  clientVisible?: boolean
  classEligible?: boolean
}) {
  const variant = await prisma.serviceVariant.findFirst({
    where: {
      ...(serviceVariantId ? { id: serviceVariantId } : {}),
      ...(serviceTypeId ? { serviceTypeId } : {}),
      active: true,
      ...(clientVisible ? { clientVisible: true } : {}),
      serviceType: {
        practiceId,
        active: true,
        ...(clientVisible ? { clientVisible: true } : {}),
        ...(classEligible ? { classEligible: true } : {}),
      },
    },
    include: {
      serviceType: true,
      resourceRequirements: {
        include: { resource: true },
      },
    },
    orderBy: [
      { sortOrder: "asc" },
      { durationMinutes: "asc" },
    ],
  })

  if (!variant) {
    throw new Error(classEligible ? "Choose a class-eligible service variant." : "Choose an available service variant.")
  }
  if (providerUserId && variant.serviceType.eligibleProviderIds.length > 0 && !variant.serviceType.eligibleProviderIds.includes(providerUserId)) {
    throw new Error("Choose a provider who is eligible for the selected service.")
  }

  return variant
}

export async function getServiceVariantsForScheduling({
  practiceId,
  serviceVariantIds,
  providerUserId,
  clientVisible = false,
}: {
  practiceId: string
  serviceVariantIds: string[]
  providerUserId: string
  clientVisible?: boolean
}) {
  const uniqueIds = [...new Set(serviceVariantIds.filter(Boolean))].slice(0, 6)
  if (uniqueIds.length === 0) {
    throw new Error("Choose at least one available service.")
  }

  const variants = await Promise.all(uniqueIds.map((serviceVariantId) => (
    getServiceVariantForScheduling({ practiceId, serviceVariantId, providerUserId, clientVisible })
  )))

  return variants
}

export function serviceResourceIds(variant: ServiceVariantForScheduling) {
  return variant.resourceRequirements
    .filter((requirement) => requirement.resource.active)
    .map((requirement) => requirement.resourceId)
}

export function serviceSnapshotForCreate(variant: ServiceVariantForScheduling) {
  return buildServiceSnapshot({ service: variant.serviceType, variant })
}

export function selectedServiceVariantIds(formData: FormData) {
  const ids = formData.getAll("serviceVariantIds")
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean)
  const single = fieldString(formData, "serviceVariantId")
  return ids.length > 0 ? ids : (single ? [single] : [])
}

export function selectedAddOnVariantIds(formData: FormData) {
  const values = formData.getAll("addOnServiceVariantIds")
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean)
  const commaList = fieldString(formData, "addOnServiceVariantIds")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)

  return [...new Set([...values, ...commaList])].slice(0, MAX_PUBLIC_ADD_ONS)
}

export function serviceBookingRole(formData: FormData) {
  return fieldString(formData, "bookingRole") === "ADD_ON" ? "ADD_ON" : "PRIMARY"
}

export function serviceCountsTowardCapacity(formData: FormData, bookingRole: "PRIMARY" | "ADD_ON") {
  void bookingRole
  if (formData.has("countsTowardMassageCapacity")) {
    return fieldBoolean(formData, "countsTowardMassageCapacity")
  }

  return false
}

export function serviceCompositionForCreate(variants: ServiceVariantForScheduling[]) {
  return composeAppointmentServices(variants.map((variant) => ({
    service: variant.serviceType,
    variant,
    resourceIds: serviceResourceIds(variant),
  })))
}

export function serviceCompositionEndTime(startsAt: Date, variants: ServiceVariantForScheduling[]) {
  const totalMinutes = variants.reduce((sum, variant) => sum + serviceVariantBookableMinutes(variant), 0)
  return new Date(startsAt.getTime() + totalMinutes * 60_000)
}
