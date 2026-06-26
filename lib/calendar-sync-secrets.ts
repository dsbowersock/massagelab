import { decryptSecret, encryptSecret } from "./auth-security.js"

const CALENDAR_SYNC_KEY_NAME = "CALENDAR_SYNC_ENCRYPTION_KEY"

export function encryptCalendarSyncSecret(secret: string, rawKey = process.env.CALENDAR_SYNC_ENCRYPTION_KEY ?? "") {
  return encryptSecret(secret, rawKey, CALENDAR_SYNC_KEY_NAME)
}

export function decryptCalendarSyncSecret(payload: string, rawKey = process.env.CALENDAR_SYNC_ENCRYPTION_KEY ?? "") {
  return decryptSecret(payload, rawKey, CALENDAR_SYNC_KEY_NAME)
}
