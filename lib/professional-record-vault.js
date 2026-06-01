import {
  INTAKE_WORKSPACE_STORAGE_KEY,
  INTAKE_WORKSPACE_VAULT_FORMAT,
  createDefaultIntakeWorkspace,
  normalizeIntakeWorkspace,
} from "./local-intake-builder.js"

export const PROFESSIONAL_RECORD_VAULT_STORAGE_KEY = "massagelab-professional-record-vault-v1"
export const PROFESSIONAL_RECORD_VAULT_FORMAT = "massagelab-professional-record-vault"
export const PROFESSIONAL_RECORD_VAULT_BUNDLE_FORMAT = "massagelab-professional-record-vault-bundle"
export const PROFESSIONAL_RECORD_VAULT_ITERATIONS = 150000

export const LEGACY_PROFESSIONAL_RECORD_STORAGE_KEYS = {
  soap: "massagelab-soap-draft",
  intake: INTAKE_WORKSPACE_STORAGE_KEY,
  journal: "massagelab-client-journal-draft",
  rom: "massagelab-rom-session-draft",
}

export class ProfessionalRecordVaultError extends Error {
  constructor(message, options) {
    super(message, options)
    this.name = "ProfessionalRecordVaultError"
  }
}

export function createEmptyProfessionalRecordVaultPayload(now = new Date()) {
  const timestamp = isoDate(now)

  return {
    schemaVersion: 1,
    records: {
      soap: {
        draft: null,
        updatedAt: "",
      },
      intake: {
        workspace: createDefaultIntakeWorkspace(now),
        updatedAt: timestamp,
      },
      journal: {
        draft: null,
        updatedAt: "",
      },
      rom: {
        draft: null,
        updatedAt: "",
      },
    },
  }
}

export function normalizeProfessionalRecordVaultPayload(value) {
  const source = isPlainObject(value) ? value : {}
  const records = isPlainObject(source.records) ? source.records : source
  const empty = createEmptyProfessionalRecordVaultPayload()

  return {
    schemaVersion: 1,
    records: {
      soap: normalizeRecordSlot(records.soap, empty.records.soap),
      intake: normalizeIntakeSlot(records.intake, empty.records.intake),
      journal: normalizeRecordSlot(records.journal, empty.records.journal),
      rom: normalizeRecordSlot(records.rom, empty.records.rom),
    },
  }
}

export function setProfessionalRecordVaultDraft(payload, recordType, draft, updatedAt = new Date()) {
  const normalized = normalizeProfessionalRecordVaultPayload(payload)
  if (!["soap", "journal", "rom"].includes(recordType)) {
    throw new ProfessionalRecordVaultError(`Unsupported professional record draft type: ${recordType}`)
  }

  return {
    ...normalized,
    records: {
      ...normalized.records,
      [recordType]: {
        draft: isPlainObject(draft) ? clone(draft) : null,
        updatedAt: draft ? isoDate(updatedAt) : "",
      },
    },
  }
}

export function setProfessionalRecordVaultIntakeWorkspace(payload, workspace, updatedAt = new Date()) {
  const normalized = normalizeProfessionalRecordVaultPayload(payload)
  const nextWorkspace = normalizeIntakeWorkspace({
    ...workspace,
    updatedAt: isoDate(updatedAt),
  })

  return {
    ...normalized,
    records: {
      ...normalized.records,
      intake: {
        workspace: nextWorkspace,
        updatedAt: nextWorkspace.updatedAt || isoDate(updatedAt),
      },
    },
  }
}

export function isEncryptedProfessionalRecordVault(value) {
  return isEncryptedEnvelope(value, PROFESSIONAL_RECORD_VAULT_FORMAT)
}

export function isEncryptedProfessionalRecordVaultBundle(value) {
  return isEncryptedEnvelope(value, PROFESSIONAL_RECORD_VAULT_BUNDLE_FORMAT)
}

export async function createEncryptedProfessionalRecordVault(payload, password, options = {}) {
  return createEncryptedEnvelope({
    payload,
    password,
    format: PROFESSIONAL_RECORD_VAULT_FORMAT,
    purpose: "professional-record-vault",
    createdAt: options.createdAt,
    updatedAt: options.updatedAt,
    iterations: options.iterations,
  })
}

export async function decryptEncryptedProfessionalRecordVault(vault, password) {
  if (!isEncryptedProfessionalRecordVault(vault)) {
    throw new ProfessionalRecordVaultError("Expected a MassageLab professional-record vault.")
  }

  try {
    return normalizeProfessionalRecordVaultPayload(await decryptEnvelopePayload(vault, password))
  } catch (error) {
    throw new ProfessionalRecordVaultError("Could not unlock professional-record vault. Check the passphrase and try again.", { cause: error })
  }
}

export async function createEncryptedProfessionalRecordBundle(payload, password, options = {}) {
  return createEncryptedEnvelope({
    payload,
    password,
    format: PROFESSIONAL_RECORD_VAULT_BUNDLE_FORMAT,
    purpose: "professional-record-vault-bundle",
    createdAt: options.createdAt,
    updatedAt: options.updatedAt,
    iterations: options.iterations,
  })
}

export async function decryptEncryptedProfessionalRecordBundle(bundle, password) {
  if (!isEncryptedProfessionalRecordVaultBundle(bundle)) {
    throw new ProfessionalRecordVaultError("Expected a MassageLab encrypted professional-record bundle.")
  }

  try {
    return normalizeProfessionalRecordVaultPayload(await decryptEnvelopePayload(bundle, password))
  } catch (error) {
    throw new ProfessionalRecordVaultError("Could not decrypt professional-record bundle. Check the password and try again.", { cause: error })
  }
}

export function collectLegacyProfessionalRecordMigration(readItem, now = new Date()) {
  const payload = createEmptyProfessionalRecordVaultPayload(now)
  const plaintextKeysToRemove = []
  const warnings = []
  let legacyPlaintextFound = false
  let encryptedIntakeVaultFound = false

  const soap = parseLegacyJson(readItem(LEGACY_PROFESSIONAL_RECORD_STORAGE_KEYS.soap), "SOAP draft", warnings)
  if (isPlainObject(soap) && soap.noteType === "soap") {
    payload.records.soap = { draft: soap, updatedAt: isoDate(now) }
    plaintextKeysToRemove.push(LEGACY_PROFESSIONAL_RECORD_STORAGE_KEYS.soap)
    legacyPlaintextFound = true
  } else if (soap !== null) {
    warnings.push("Legacy SOAP draft was not imported because it did not match the SOAP document shape.")
  }

  const intake = parseLegacyJson(readItem(LEGACY_PROFESSIONAL_RECORD_STORAGE_KEYS.intake), "intake workspace", warnings)
  if (isPlainObject(intake) && intake.format === INTAKE_WORKSPACE_VAULT_FORMAT) {
    encryptedIntakeVaultFound = true
    warnings.push("An older encrypted intake vault exists and was preserved. It was not migrated into the global vault.")
  } else if (isLikelyPlaintextIntakeWorkspace(intake)) {
    const workspace = normalizeIntakeWorkspace(intake)
    payload.records.intake = { workspace, updatedAt: workspace.updatedAt || isoDate(now) }
    plaintextKeysToRemove.push(LEGACY_PROFESSIONAL_RECORD_STORAGE_KEYS.intake)
    legacyPlaintextFound = true
  } else if (intake !== null) {
    warnings.push("Legacy intake workspace was not imported because it did not match the intake workspace shape.")
  }

  const journal = parseLegacyJson(readItem(LEGACY_PROFESSIONAL_RECORD_STORAGE_KEYS.journal), "journal draft", warnings)
  if (isPlainObject(journal) && journal.documentType === "client-journal") {
    payload.records.journal = { draft: journal, updatedAt: isoDate(now) }
    plaintextKeysToRemove.push(LEGACY_PROFESSIONAL_RECORD_STORAGE_KEYS.journal)
    legacyPlaintextFound = true
  } else if (journal !== null) {
    warnings.push("Legacy journal draft was not imported because it did not match the journal document shape.")
  }

  const rom = parseLegacyJson(readItem(LEGACY_PROFESSIONAL_RECORD_STORAGE_KEYS.rom), "ROM draft", warnings)
  if (isPlainObject(rom) && rom.documentType === "rom-session") {
    payload.records.rom = { draft: rom, updatedAt: isoDate(now) }
    plaintextKeysToRemove.push(LEGACY_PROFESSIONAL_RECORD_STORAGE_KEYS.rom)
    legacyPlaintextFound = true
  } else if (rom !== null) {
    warnings.push("Legacy ROM draft was not imported because it did not match the ROM document shape.")
  }

  return {
    payload: normalizeProfessionalRecordVaultPayload(payload),
    plaintextKeysToRemove,
    warnings,
    legacyPlaintextFound,
    encryptedIntakeVaultFound,
  }
}

function normalizeRecordSlot(value, fallback) {
  const source = isPlainObject(value) ? value : {}
  return {
    draft: isPlainObject(source.draft) ? clone(source.draft) : fallback.draft,
    updatedAt: text(source.updatedAt),
  }
}

function normalizeIntakeSlot(value, fallback) {
  const source = isPlainObject(value) ? value : {}
  const workspace = isPlainObject(source.workspace)
    ? normalizeIntakeWorkspace(source.workspace)
    : fallback.workspace

  return {
    workspace,
    updatedAt: text(source.updatedAt) || workspace.updatedAt || fallback.updatedAt,
  }
}

function parseLegacyJson(raw, label, warnings) {
  if (!raw) return null

  try {
    return JSON.parse(raw)
  } catch {
    warnings.push(`Legacy ${label} was not imported because it is not valid JSON.`)
    return null
  }
}

function isLikelyPlaintextIntakeWorkspace(value) {
  return isPlainObject(value)
    && (value.schemaVersion === 1 || Array.isArray(value.templates) || Array.isArray(value.clients) || Array.isArray(value.documents))
}

async function createEncryptedEnvelope({ payload, password, format, purpose, createdAt, updatedAt, iterations }) {
  const cleanPassword = text(password)
  if (cleanPassword.length < 8) {
    throw new ProfessionalRecordVaultError("Professional-record vault passphrase must be at least 8 characters.")
  }

  const iterationCount = Number(iterations) || PROFESSIONAL_RECORD_VAULT_ITERATIONS
  const encrypted = await encryptJsonPayload(normalizeProfessionalRecordVaultPayload(payload), cleanPassword, iterationCount)
  const timestamp = isoDate(updatedAt ?? new Date())

  return {
    schemaVersion: 1,
    format,
    purpose,
    algorithm: "AES-GCM",
    kdf: "PBKDF2-SHA-256",
    iterations: iterationCount,
    salt: encrypted.salt,
    iv: encrypted.iv,
    ciphertext: encrypted.ciphertext,
    createdAt: text(createdAt) || timestamp,
    updatedAt: timestamp,
    localFirst: true,
  }
}

function isEncryptedEnvelope(value, format) {
  return isPlainObject(value)
    && value.schemaVersion === 1
    && value.format === format
    && value.algorithm === "AES-GCM"
    && value.kdf === "PBKDF2-SHA-256"
    && Boolean(text(value.salt))
    && Boolean(text(value.iv))
    && Boolean(text(value.ciphertext))
}

async function decryptEnvelopePayload(envelope, password) {
  const cryptoApi = getCryptoApi()
  const salt = base64ToBytes(envelope.salt)
  const iv = base64ToBytes(envelope.iv)
  const ciphertext = base64ToBytes(envelope.ciphertext)
  const key = await deriveAesGcmKey(text(password), salt, Number(envelope.iterations) || PROFESSIONAL_RECORD_VAULT_ITERATIONS)
  const plaintext = await cryptoApi.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext)
  return JSON.parse(new TextDecoder().decode(plaintext))
}

async function encryptJsonPayload(data, password, iterations) {
  const cryptoApi = getCryptoApi()
  const salt = cryptoApi.getRandomValues(new Uint8Array(16))
  const iv = cryptoApi.getRandomValues(new Uint8Array(12))
  const key = await deriveAesGcmKey(password, salt, iterations)
  const encoded = new TextEncoder().encode(JSON.stringify(data))
  const ciphertext = await cryptoApi.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded)

  return {
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  }
}

async function deriveAesGcmKey(password, salt, iterations) {
  const cryptoApi = getCryptoApi()
  const material = await cryptoApi.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  )

  return cryptoApi.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  )
}

function getCryptoApi() {
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) {
    throw new ProfessionalRecordVaultError("Web Crypto is required for encrypted professional-record vaults.")
  }
  return globalThis.crypto
}

function bytesToBase64(bytes) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64")
  }

  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToBytes(value) {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(value, "base64"))
  }

  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function text(value) {
  return typeof value === "string" ? value.trim() : ""
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function isoDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}
