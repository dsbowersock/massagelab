/** Support reasons permitted on immutable admin action records. */
export const ADMIN_REASON_CODES = [
  "USER_REQUEST",
  "LOGIN_SUPPORT",
  "ACCESS_REMEDIATION",
  "BILLING_GOODWILL",
  "BACKGROUND_CREDIT_GOODWILL",
  "ROLE_ASSIGNMENT",
  "ROLE_REVOCATION",
  "SECURITY_RECOVERY",
  "ADMIN_CORRECTION",
  "OTHER",
] as const

export type AdminReasonCode = typeof ADMIN_REASON_CODES[number]

/** Inclusive bounds shared by the Admin grant service, action, and controls. */
export const ADMIN_BACKGROUND_CREDIT_GRANT_MIN = 1
export const ADMIN_BACKGROUND_CREDIT_GRANT_MAX = 25

/** JSON-safe metadata accepted on admin records after sensitive-key screening. */
export type AdminSafePayload = Record<string, AdminSafeValue>
export type AdminSafeValue = string | number | boolean | null | AdminSafeValue[] | { [key: string]: AdminSafeValue }

export const ADMIN_SAFE_PAYLOAD_MAX_DEPTH = 5
export const ADMIN_SAFE_PAYLOAD_MAX_ENTRIES = 50
/** Keys stay short so the small-entry limit cannot hide oversized metadata. */
export const ADMIN_SAFE_PAYLOAD_MAX_KEY_LENGTH = 100
export const ADMIN_SAFE_PAYLOAD_MAX_STRING_LENGTH = 500

const FORBIDDEN_ADMIN_PAYLOAD_KEY = /password|token|secret|backup|payment_method|clinical|soap|intake|journal|rom/i

/**
 * Validates the support reason before an immutable admin action is persisted.
 * `OTHER` deliberately requires an internal explanation so it remains auditable.
 */
export function validateAdminReason(reasonCode: string, internalNote?: string | null): asserts reasonCode is AdminReasonCode {
  if (!ADMIN_REASON_CODES.includes(reasonCode as AdminReasonCode)) {
    throw new Error("Select a valid support reason.")
  }

  if (typeof internalNote === "string" && internalNote.length > 500) {
    throw new Error("Internal notes are limited to 500 characters.")
  }

  if (reasonCode === "OTHER" && (!internalNote || !internalNote.trim())) {
    throw new Error("Other requires an internal note.")
  }
}

/**
 * Returns a JSON-safe admin payload only when it is small, plain data and contains
 * no restricted field names. The generic error messages avoid exposing rejected values.
 */
export function validateAdminSafePayload(payload: unknown): AdminSafePayload {
  if (!isPlainRecord(payload)) {
    throw new Error("Admin payload must be a plain object.")
  }

  return snapshotAdminSafeValue(payload, 0, { entries: 0 }, new WeakSet<object>()) as AdminSafePayload
}

/** Alias for metadata fields stored alongside immutable admin operation records. */
export const validateAdminMetadata = validateAdminSafePayload

/**
 * Copies only own enumerable data properties so later mutations and accessors on
 * caller-owned input cannot affect a persisted audit payload.
 */
function snapshotAdminSafeValue(
  value: unknown,
  depth: number,
  counter: { entries: number },
  ancestors: WeakSet<object>,
): AdminSafeValue {
  if (depth > ADMIN_SAFE_PAYLOAD_MAX_DEPTH) {
    throw new Error("Admin payload exceeds the supported size.")
  }

  if (value === null || typeof value === "boolean") return value

  if (typeof value === "string") {
    if (value.length > ADMIN_SAFE_PAYLOAD_MAX_STRING_LENGTH) {
      throw new Error("Admin payload exceeds the supported size.")
    }
    return value
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Admin payload must contain JSON-compatible values.")
    return value
  }

  if (Array.isArray(value)) {
    return snapshotAdminSafeArray(value, depth, counter, ancestors)
  }

  if (!isPlainRecord(value)) {
    throw new Error("Admin payload must contain JSON-compatible values.")
  }

  if (ancestors.has(value)) {
    throw new Error("Admin payload must contain JSON-compatible values.")
  }
  ancestors.add(value)

  const snapshot: Record<string, AdminSafeValue> = {}
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (!descriptor?.enumerable) continue
    if (!("value" in descriptor)) {
      throw new Error("Admin payload must contain JSON-compatible values.")
    }
    if (typeof key !== "string") continue

    countAdminPayloadEntry(counter)
    validateAdminPayloadKeyLength(key)
    if (FORBIDDEN_ADMIN_PAYLOAD_KEY.test(key)) {
      throw new Error("Admin payload contains restricted data.")
    }
    Object.defineProperty(snapshot, key, {
      configurable: true,
      enumerable: true,
      value: snapshotAdminSafeValue(descriptor.value, depth + 1, counter, ancestors),
      writable: true,
    })
  }

  ancestors.delete(value)
  return snapshot
}

/**
 * Snapshots indexed array values while screening every enumerable extra
 * property. Extra properties are validated for safety but are not persisted.
 */
function snapshotAdminSafeArray(
  value: unknown[],
  depth: number,
  counter: { entries: number },
  ancestors: WeakSet<object>,
): AdminSafeValue[] {
  if (ancestors.has(value)) {
    throw new Error("Admin payload must contain JSON-compatible values.")
  }
  ancestors.add(value)

  const snapshot: AdminSafeValue[] = []
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length")
  if (!lengthDescriptor || !("value" in lengthDescriptor) || !Number.isSafeInteger(lengthDescriptor.value)) {
    throw new Error("Admin payload must contain JSON-compatible values.")
  }

  for (let index = 0; index < lengthDescriptor.value; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
    countAdminPayloadEntry(counter)
    if (descriptor && !("value" in descriptor)) {
      throw new Error("Admin payload must contain JSON-compatible values.")
    }
    snapshot.push(descriptor
      ? snapshotAdminSafeValue(descriptor.value, depth + 1, counter, ancestors)
      : null)
  }

  for (const key of Reflect.ownKeys(value)) {
    if (key === "length" || isArrayIndex(key, lengthDescriptor.value)) continue
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (!descriptor?.enumerable) continue
    if (!("value" in descriptor)) {
      throw new Error("Admin payload must contain JSON-compatible values.")
    }
    if (typeof key === "string") {
      validateAdminPayloadKeyLength(key)
      if (FORBIDDEN_ADMIN_PAYLOAD_KEY.test(key)) {
        throw new Error("Admin payload contains restricted data.")
      }
    }
    countAdminPayloadEntry(counter)
    snapshotAdminSafeValue(descriptor.value, depth + 1, counter, ancestors)
  }

  ancestors.delete(value)
  return snapshot
}

function validateAdminPayloadKeyLength(key: string): void {
  if (key.length > ADMIN_SAFE_PAYLOAD_MAX_KEY_LENGTH) {
    throw new Error("Admin payload exceeds the supported size.")
  }
}

function isArrayIndex(key: PropertyKey, length: number): boolean {
  if (typeof key !== "string" || !/^(?:0|[1-9]\d*)$/.test(key)) return false

  const index = Number(key)
  return Number.isSafeInteger(index) && index >= 0 && index < length
}

function countAdminPayloadEntry(counter: { entries: number }): void {
  counter.entries += 1
  if (counter.entries > ADMIN_SAFE_PAYLOAD_MAX_ENTRIES) {
    throw new Error("Admin payload exceeds the supported size.")
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}
