"use server"

import { revalidatePath } from "next/cache"
import type { Prisma } from "@prisma/client"
import { getCurrentSession } from "@/auth"
import {
  clientWellnessExportFilename,
  normalizeClientWellnessCustomTerms,
  normalizeClientWellnessEntryInput,
  sanitizeClientWellnessLogMetadata,
} from "@/lib/client-wellness"
import { prisma } from "@/lib/prisma"

type WellnessActionResult<T = unknown> = {
  ok: boolean
  reason?: string
  data?: T
}

type WellnessEntryPayload = ReturnType<typeof normalizeClientWellnessEntryInput>

/**
 * Casts normalized wellness payload fragments into Prisma JSON input values.
 *
 * @param value - JSON-compatible data produced by the wellness normalizer.
 * @returns The same value typed for Prisma create and update calls.
 */
function jsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue
}

/**
 * Reads the active session user id without redirecting anonymous visitors.
 *
 * @returns The signed-in user id, or null when the request is anonymous.
 */
async function currentUserId() {
  const session = await getCurrentSession()
  const userId = session?.user?.id

  return typeof userId === "string" && userId.trim() ? userId : null
}

/**
 * Extracts a single string field from a form payload.
 *
 * @param formData - Browser-submitted form data.
 * @param key - Field name to read.
 * @returns The string value, or undefined when the field is absent or not text.
 */
function stringValue(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value : undefined
}

/**
 * Reads repeated string form values while preserving single-value fallback input.
 *
 * @param formData - Browser-submitted form data.
 * @param key - Repeated checkbox or text field name to read.
 * @returns A string array when repeated values exist, otherwise one string or undefined.
 */
function stringListValue(formData: FormData, key: string) {
  const values = formData.getAll(key).filter((value): value is string => typeof value === "string")

  if (values.length > 0) {
    return values
  }

  return stringValue(formData, key)
}

/**
 * Parses a JSON object field while dropping invalid, missing, and array values.
 *
 * @param formData - Browser-submitted form data.
 * @param key - Field name containing serialized JSON.
 * @returns A plain object suitable for normalizer input, or an empty object on failure.
 */
function jsonObjectValue(formData: FormData, key: string) {
  const value = stringValue(formData, key)

  if (!value) {
    return {}
  }

  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

/**
 * Reads custom body-sensation words that should remain private to this user.
 *
 * @param formData - Browser-submitted quick-log form data.
 * @returns Normalized custom terms for private vocabulary suggestions.
 */
function customSensationsFromFormData(formData: FormData) {
  return normalizeClientWellnessCustomTerms(formData.getAll("customSensations"))
}

/**
 * Builds the broad wellness normalizer input from browser form fields.
 *
 * @param formData - Quick-log or ROM form data from the client component.
 * @returns A loose payload that normalizeClientWellnessEntryInput validates before storage.
 */
function entryInputFromFormData(formData: FormData) {
  return {
    category: stringValue(formData, "category"),
    occurredAt: stringValue(formData, "occurredAt"),
    timezone: stringValue(formData, "timezone"),
    summary: stringValue(formData, "summary"),
    intensity: stringValue(formData, "intensity"),
    regions: stringListValue(formData, "regions"),
    sensations: stringListValue(formData, "sensations"),
    contexts: stringListValue(formData, "contexts"),
    source: stringValue(formData, "source"),
    metadata: jsonObjectValue(formData, "metadata"),
  }
}

/**
 * Converts a persisted wellness entry into a browser-safe timeline payload.
 *
 * @param entry - Owner-scoped database row with Date and JSON fields.
 * @returns ISO date strings, string-only list fields, and object-only metadata.
 */
function serializedEntry(entry: {
  id: string
  category: string
  occurredAt: Date
  timezone: string
  summary: string | null
  intensity: number | null
  regions: Prisma.JsonValue
  sensations: Prisma.JsonValue
  contexts: Prisma.JsonValue
  source: string
  metadata: Prisma.JsonValue
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: entry.id,
    category: entry.category,
    occurredAt: entry.occurredAt.toISOString(),
    timezone: entry.timezone,
    summary: entry.summary,
    intensity: entry.intensity,
    regions: Array.isArray(entry.regions) ? entry.regions.filter((item): item is string => typeof item === "string") : [],
    sensations: Array.isArray(entry.sensations) ? entry.sensations.filter((item): item is string => typeof item === "string") : [],
    contexts: Array.isArray(entry.contexts) ? entry.contexts.filter((item): item is string => typeof item === "string") : [],
    source: entry.source,
    metadata: entry.metadata && typeof entry.metadata === "object" && !Array.isArray(entry.metadata) ? entry.metadata : {},
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  }
}

/**
 * Logs sanitized operational failure metadata without copying wellness note content.
 *
 * @param action - Safe action code used for aggregate troubleshooting.
 * @param payload - Optional normalized payload fragment used only for safe category metadata.
 */
function logWellnessActionFailure(action: string, payload: Partial<WellnessEntryPayload> = {}) {
  console.error("Client wellness action failed", sanitizeClientWellnessLogMetadata({
    action,
    category: payload.category,
    status: "error",
  }))
}

/**
 * Stores user-created terms as private suggestions only.
 *
 * These rows are for the current user's future convenience and possible manual
 * review; they are not global vocabulary, therapist-facing records, or shared
 * clinical content.
 *
 * @param userId - Owner id for the signed-in user's private vocabulary.
 * @param category - Wellness category associated with the custom terms.
 * @param customTerms - Normalized user-created terms.
 */
async function createPrivateVocabularySuggestions(userId: string, category: string, customTerms: string[]) {
  if (category !== "body_sensation" || customTerms.length === 0) {
    return
  }

  const existingSuggestions = await prisma.clientWellnessVocabularySuggestion.findMany({
    where: { userId, category, status: "PRIVATE" },
    select: { term: true },
  })
  const existingTerms = new Set(existingSuggestions.map((suggestion) => suggestion.term.trim().toLowerCase()))
  const newTerms = customTerms.filter((term) => !existingTerms.has(term.toLowerCase()))

  if (newTerms.length === 0) {
    return
  }

  await prisma.clientWellnessVocabularySuggestion.createMany({
    data: newTerms.map((term) => ({
      userId,
      category,
      term,
      status: "PRIVATE",
    })),
  })
}

/**
 * Persists one signed-in user's client-owned wellness entry.
 *
 * @param formData - Normal browser form data for quick logs or ROM measurements.
 * @returns ok/data with the serialized entry, sign-in-required, or save-failed.
 */
export async function createClientWellnessEntryAction(formData: FormData): Promise<WellnessActionResult> {
  const userId = await currentUserId()

  if (!userId) {
    return { ok: false, reason: "sign-in-required" }
  }

  const payload = normalizeClientWellnessEntryInput(entryInputFromFormData(formData))
  const customTerms = customSensationsFromFormData(formData)

  try {
    const entry = await prisma.clientWellnessEntry.create({
      data: {
        userId,
        category: payload.category,
        occurredAt: payload.occurredAt,
        timezone: payload.timezone,
        summary: payload.summary,
        intensity: payload.intensity,
        regions: jsonValue(payload.regions),
        sensations: jsonValue(payload.sensations),
        contexts: jsonValue(payload.contexts),
        source: payload.source,
        metadata: jsonValue(payload.metadata),
      },
    })

    try {
      await createPrivateVocabularySuggestions(userId, payload.category, customTerms)
    } catch {
      logWellnessActionFailure("preference", payload)
    }

    revalidatePath("/wellness")
    return { ok: true, data: { entry: serializedEntry(entry) } }
  } catch {
    logWellnessActionFailure("create", payload)
    return { ok: false, reason: "save-failed" }
  }
}

/**
 * Loads the current user's most recent non-deleted wellness entries.
 *
 * @returns ok/data with up to 50 serialized entries, sign-in-required, or load-failed.
 */
export async function listClientWellnessEntriesAction(): Promise<WellnessActionResult> {
  const userId = await currentUserId()

  if (!userId) {
    return { ok: false, reason: "sign-in-required" }
  }

  try {
    const entries = await prisma.clientWellnessEntry.findMany({
      where: { userId, deletedAt: null },
      orderBy: { occurredAt: "desc" },
      take: 50,
    })

    return { ok: true, data: { entries: entries.map(serializedEntry) } }
  } catch {
    logWellnessActionFailure("list")
    return { ok: false, reason: "load-failed" }
  }
}

/**
 * Soft-deletes a current user's wellness entry by id.
 *
 * @param formData - Form data containing the persisted entry id.
 * @returns ok, missing-entry-id, not-found, sign-in-required, or delete-failed.
 */
export async function deleteClientWellnessEntryAction(formData: FormData): Promise<WellnessActionResult> {
  const userId = await currentUserId()

  if (!userId) {
    return { ok: false, reason: "sign-in-required" }
  }

  const id = stringValue(formData, "id")?.trim()

  if (!id) {
    return { ok: false, reason: "missing-entry-id" }
  }

  try {
    const result = await prisma.clientWellnessEntry.updateMany({
      where: { id, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    })

    revalidatePath("/wellness")
    return { ok: result.count > 0, reason: result.count > 0 ? undefined : "not-found" }
  } catch {
    logWellnessActionFailure("delete")
    return { ok: false, reason: "delete-failed" }
  }
}

/**
 * Exports all non-deleted wellness entries for the signed-in user.
 *
 * @returns ok/data with filename, exportedAt, and serialized entries, or an error reason.
 */
export async function exportClientWellnessEntriesAction(): Promise<WellnessActionResult> {
  const userId = await currentUserId()

  if (!userId) {
    return { ok: false, reason: "sign-in-required" }
  }

  try {
    const entries = await prisma.clientWellnessEntry.findMany({
      where: { userId, deletedAt: null },
      orderBy: { occurredAt: "desc" },
    })

    return {
      ok: true,
      data: {
        filename: clientWellnessExportFilename(null),
        exportedAt: new Date().toISOString(),
        entries: entries.map(serializedEntry),
      },
    }
  } catch {
    logWellnessActionFailure("export")
    return { ok: false, reason: "export-failed" }
  }
}

/**
 * Saves the signed-in user's wellness tool settings.
 *
 * @param formData - Form data containing a JSON object in the settings field.
 * @returns ok/data with version and settings, sign-in-required, or preference-save-failed.
 */
export async function updateClientWellnessPreferenceAction(formData: FormData): Promise<WellnessActionResult> {
  const userId = await currentUserId()

  if (!userId) {
    return { ok: false, reason: "sign-in-required" }
  }

  try {
    const settings = jsonObjectValue(formData, "settings")
    const preference = await prisma.clientWellnessPreference.upsert({
      where: { userId },
      create: {
        userId,
        settings: jsonValue(settings),
      },
      update: {
        settings: jsonValue(settings),
      },
    })

    revalidatePath("/wellness")
    return { ok: true, data: { version: preference.version, settings: preference.settings } }
  } catch {
    logWellnessActionFailure("preference")
    return { ok: false, reason: "preference-save-failed" }
  }
}
