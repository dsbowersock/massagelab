"use server"

import {
  saveBookingPolicy,
  saveProviderBookingPolicy,
  saveProviderCapacityRules,
  savePublicBookingUrl,
} from "./actions/booking"
import {
  convertWaitlistEntry,
  joinBookingWaitlist,
  requestBookingSequence,
} from "./actions/public-booking"
import { saveCalendarPreferences } from "./actions/preferences"
import {
  createAppointment,
  createAppointmentForm,
  createCalendarBlock,
  createClass,
  createPersonalEvent,
  createReminder,
  requestAppointment,
  updateAppointmentRequestStatus,
} from "./actions/events"
import type { AppointmentActionState } from "./actions/types"
import {
  createService,
  updateService,
} from "./actions/services"
import {
  createAvailabilityOverride,
  createAvailabilityRule,
  createAvailabilitySchedule,
  createPractice,
} from "./actions/setup"
import { rescheduleCalendarEvent } from "./actions/reschedule"

export async function saveBookingPolicyAction(formData: FormData) {
  return saveBookingPolicy(formData)
}

export async function savePublicBookingUrlAction(formData: FormData) {
  return savePublicBookingUrl(formData)
}

export async function saveProviderBookingPolicyAction(formData: FormData) {
  return saveProviderBookingPolicy(formData)
}

export async function saveProviderCapacityRulesAction(formData: FormData) {
  return saveProviderCapacityRules(formData)
}

export async function requestBookingSequenceAction(formData: FormData) {
  return requestBookingSequence(formData)
}

export async function joinBookingWaitlistAction(formData: FormData) {
  return joinBookingWaitlist(formData)
}

export async function convertWaitlistEntryAction(formData: FormData) {
  return convertWaitlistEntry(formData)
}

export async function saveCalendarPreferencesAction(input: Record<string, unknown>) {
  return saveCalendarPreferences(input)
}

export async function createAvailabilityScheduleAction(formData: FormData) {
  return createAvailabilitySchedule(formData)
}

export async function createAvailabilityOverrideAction(formData: FormData) {
  return createAvailabilityOverride(formData)
}

export async function rescheduleCalendarEventAction(input: FormData | Record<string, unknown>) {
  return rescheduleCalendarEvent(input)
}

export async function createPracticeAction(formData: FormData) {
  return createPractice(formData)
}

export async function createAvailabilityRuleAction(formData: FormData) {
  return createAvailabilityRule(formData)
}

export async function createServiceAction(formData: FormData) {
  return createService(formData)
}

export async function updateServiceAction(formData: FormData) {
  return updateService(formData)
}
export async function createAppointmentAction(formData: FormData) {
  return createAppointment(formData)
}

export async function createAppointmentFormAction(
  previousState: AppointmentActionState,
  formData: FormData,
): Promise<AppointmentActionState> {
  return createAppointmentForm(previousState, formData)
}

export async function createPersonalEventAction(formData: FormData) {
  return createPersonalEvent(formData)
}

export async function createCalendarBlockAction(formData: FormData) {
  return createCalendarBlock(formData)
}

export async function createClassAction(formData: FormData) {
  return createClass(formData)
}

export async function createReminderAction(formData: FormData) {
  return createReminder(formData)
}

export async function requestAppointmentAction(formData: FormData) {
  return requestAppointment(formData)
}

export async function updateAppointmentRequestStatusAction(formData: FormData) {
  return updateAppointmentRequestStatus(formData)
}
