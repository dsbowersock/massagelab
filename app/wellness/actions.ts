"use server"

import { revalidatePath } from "next/cache"
import type { Prisma } from "@prisma/client"
import { getCurrentSession } from "@/auth"
import {
  clientWellnessExportFilename,
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

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue
}

async function currentUserId() {
  const session = await getCurrentSession()
  const userId = session?.user?.id

  return typeof userId === "string" && userId.trim() ? userId : null
}

function stringValue(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value : undefined
}

function stringListValue(formData: FormData, key: string) {
  const values = formData.getAll(key).filter((value): value is string => typeof value === "string")

  if (values.length > 0) {
    return values
  }

  return stringValue(formData, key)
}

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
    regions: Array.isArray(entry.regions) ? entry.regions : [],
    sensations: Array.isArray(entry.sensations) ? entry.sensations : [],
    contexts: Array.isArray(entry.contexts) ? entry.contexts : [],
    source: entry.source,
    metadata: entry.metadata && typeof entry.metadata === "object" && !Array.isArray(entry.metadata) ? entry.metadata : {},
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  }
}

function logWellnessActionFailure(action: string, payload: Partial<WellnessEntryPayload> = {}) {
  console.error("Client wellness action failed", sanitizeClientWellnessLogMetadata({
    action,
    category: payload.category,
    status: "error",
  }))
}

export async function createClientWellnessEntryAction(formData: FormData): Promise<WellnessActionResult> {
  const userId = await currentUserId()

  if (!userId) {
    return { ok: false, reason: "sign-in-required" }
  }

  const payload = normalizeClientWellnessEntryInput(entryInputFromFormData(formData))

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

    revalidatePath("/wellness")
    return { ok: true, data: { entry: serializedEntry(entry) } }
  } catch {
    logWellnessActionFailure("create", payload)
    return { ok: false, reason: "save-failed" }
  }
}

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
    logWellnessActionFailure("export")
    return { ok: false, reason: "load-failed" }
  }
}

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
