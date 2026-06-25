import { getSiteUrl } from "./auth-env.ts"

const PLACEHOLDER_ENV_VALUES = new Set([
  "replace-with-google-calendar-client-id",
  "replace-with-google-calendar-client-secret",
  "replace-with-google-calendar-redirect-uri",
  "replace-with-google-client-id",
  "replace-with-google-client-secret",
  "replace-with-client-id",
  "replace-with-client-secret",
  "your-google-calendar-client-id",
  "your-google-calendar-client-secret",
  "your-google-calendar-redirect-uri",
  "your-google-client-id",
  "your-google-client-secret",
  "your-client-id",
  "your-client-secret",
  "example-google-calendar-client-id",
  "example-google-calendar-client-secret",
  "example-google-calendar-redirect-uri",
  "example-google-client-id",
  "example-google-client-secret",
  "example-client-id",
  "example-client-secret",
])

function normalizedEnv(value?: string | null) {
  return value?.trim() ?? ""
}

function configuredEnv(value?: string | null) {
  const normalized = normalizedEnv(value)
  return Boolean(normalized && !PLACEHOLDER_ENV_VALUES.has(normalized.toLowerCase()))
}

function validAbsoluteUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

export function getGoogleCalendarSyncConfig() {
  const clientId = normalizedEnv(process.env.GOOGLE_CALENDAR_CLIENT_ID)
  const clientSecret = normalizedEnv(process.env.GOOGLE_CALENDAR_CLIENT_SECRET)
  const configuredRedirectUri = normalizedEnv(process.env.GOOGLE_CALENDAR_REDIRECT_URI)

  if (!configuredEnv(clientId) || !configuredEnv(clientSecret)) {
    return null
  }

  const redirectUri = configuredEnv(configuredRedirectUri)
    ? configuredRedirectUri
    : `${getSiteUrl().replace(/\/$/, "")}/api/calendar/google/callback`
  if (!validAbsoluteUrl(redirectUri)) return null

  return {
    clientId,
    clientSecret,
    redirectUri,
  }
}

export function hasGoogleCalendarSyncConfig() {
  return Boolean(getGoogleCalendarSyncConfig())
}
