export type PublicRequestNamespace =
  | "public-booking-v1"
  | "public-waitlist-v1"

const CANONICAL_UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

/** Returns a canonical lowercase UUIDv4 without changing caller-provided text. */
export function normalizePublicRequestId(value: unknown): string | null {
  return typeof value === "string" && CANONICAL_UUID_V4.test(value) ? value : null
}
