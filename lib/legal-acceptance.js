// @ts-check

import { legalDocumentAcceptanceId } from "./legal-documents.js"

/**
 * @typedef {{ key: string, version: string, shortLabel: string }} AcceptedLegalDocument
 * @typedef {{ ipAddress?: string | null, userAgent?: string | null }} LegalRequestMetadata
 * @typedef {any} LegalAcceptanceClient
 */

/**
 * Normalize accepted document ids from client payloads and form-derived records.
 *
 * @param {unknown} input
 * @returns {Set<string>}
 */
export function acceptedDocumentIdsFromInput(input) {
  const ids = new Set()

  if (typeof input === "string") {
    addAcceptedId(ids, input)
    return ids
  }

  if (Array.isArray(input) || input instanceof Set) {
    for (const value of input) addAcceptedId(ids, value)
    return ids
  }

  if (input && typeof input === "object") {
    for (const [key, value] of Object.entries(input)) {
      if (value === true) addAcceptedId(ids, key)
    }
  }

  return ids
}

/**
 * @param {Set<string>} ids
 * @param {unknown} value
 */
function addAcceptedId(ids, value) {
  if (typeof value === "string" && value.trim()) ids.add(value.trim())
}

/**
 * @param {{ acceptedDocumentIds: unknown, documents: AcceptedLegalDocument[] }} input
 * @returns {AcceptedLegalDocument[]}
 */
export function missingRequiredLegalDocuments({ acceptedDocumentIds, documents }) {
  const accepted = acceptedDocumentIdsFromInput(acceptedDocumentIds)
  return documents.filter((document) => !accepted.has(legalDocumentAcceptanceId(document)))
}

/**
 * @param {Request} request
 * @returns {{ ipAddress: string | null, userAgent: string | null }}
 */
export function legalRequestMetadata(request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()

  return {
    ipAddress: forwardedFor || request.headers.get("x-real-ip") || null,
    userAgent: request.headers.get("user-agent") || null,
  }
}

/**
 * @param {{ prismaClient: LegalAcceptanceClient, userId: string, documents: AcceptedLegalDocument[], metadata?: LegalRequestMetadata }} input
 * @returns {Promise<unknown[]>}
 */
export async function recordLegalAcceptances({ prismaClient, userId, documents, metadata = {} }) {
  const acceptedAt = new Date()
  const rows = []

  for (const document of documents) {
    rows.push(await prismaClient.legalAcceptance.upsert({
      where: {
        userId_documentKey_documentVersion: {
          userId,
          documentKey: document.key,
          documentVersion: document.version,
        },
      },
      create: {
        userId,
        documentKey: document.key,
        documentVersion: document.version,
        acceptedAt,
        ipAddress: metadata.ipAddress ?? null,
        userAgent: metadata.userAgent ?? null,
      },
      update: {},
    }))
  }

  return rows
}

/**
 * @param {{ prismaClient: LegalAcceptanceClient, userId: string, documents: AcceptedLegalDocument[] }} input
 * @returns {Promise<boolean>}
 */
export async function hasAcceptedCurrentDocuments({ prismaClient, userId, documents }) {
  if (documents.length === 0) return true

  /** @type {Array<{ documentKey: string, documentVersion: string }>} */
  const existing = await prismaClient.legalAcceptance.findMany({
    where: {
      userId,
      OR: documents.map((document) => ({
        documentKey: document.key,
        documentVersion: document.version,
      })),
    },
    select: {
      documentKey: true,
      documentVersion: true,
    },
  })
  const accepted = new Set(existing.map((row) => `${row.documentKey}:${row.documentVersion}`))

  return documents.every((document) => accepted.has(legalDocumentAcceptanceId(document)))
}
