export const MAX_PUBLIC_ADD_ONS: 3

export type PublicBookingSequenceDescriptor = {
  primaryServiceVariantId: string
  addOnServiceVariantIds: string[]
  requestedPressureLevel: number
  preferredProviderId: string
}

export type PublicBookingSequenceProvider = {
  userId: string
  label?: string
  publiclyBookable?: boolean
  minRestMinutes?: number | null
  dailyAppointmentLimit?: number | null
  weeklyAppointmentLimit?: number | null
  requireClientAccount?: boolean | null
}

export type PublicBookingSequenceItem = {
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

export type PublicBookingSequenceOption = {
  startsAt: string
  endsAt: string
  status: string
  totalMassageCapacityMinutes: number
  items: PublicBookingSequenceItem[]
}

export type PublicBookingSequenceContext = {
  practice: {
    id: string
    slug: string
    timezone: string
  }
  policy: {
    dailyAppointmentLimit?: number | null
  }
  variants: any[]
  selections: any[]
  providers: PublicBookingSequenceProvider[]
  options: PublicBookingSequenceOption[]
  allowGuestBooking: boolean
  accountMode: string
}

export function normalizePublicBookingSequenceDescriptor(input: unknown): PublicBookingSequenceDescriptor

export function buildPublicBookingSequenceCacheKey(input: {
  practiceId: string
  primaryServiceVariantId: string
  addOnServiceVariantIds: string[]
  requestedPressureLevel: number
  preferredProviderId?: string | null
  maxOptions?: number
  accountMode?: string
  policySignature: string
  serviceSignature: string
  providerSignature: string
  schedulingSignature?: string
}): string

export function publicBookingSequenceOptions(input: {
  practiceId: string
  primaryServiceVariantId: string
  addOnServiceVariantIds?: string[]
  requestedPressureLevel: number
  preferredProviderId?: string
  viewerUserId?: string | null
  now?: Date
  maxOptions?: number
  db?: any
}): Promise<PublicBookingSequenceContext>

export function cachedPublicBookingSequenceOptions(input: {
  practiceId: string
  primaryServiceVariantId: string
  addOnServiceVariantIds?: string[]
  requestedPressureLevel: number
  preferredProviderId?: string
  viewerUserId?: string | null
  maxOptions?: number
}): Promise<PublicBookingSequenceContext>

export function clearPublicBookingSequenceOptionsCache(): void
