import { getSiteUrl } from "./auth-env.ts"

function normalizedEnv(value?: string | null) {
  return value?.trim() ?? ""
}

function configuredEnv(value?: string | null) {
  const normalized = normalizedEnv(value)
  return Boolean(normalized && !/replace-with|example|your-/i.test(normalized))
}

export function getGoogleCalendarSyncConfig() {
  const clientId = normalizedEnv(process.env.GOOGLE_CALENDAR_CLIENT_ID)
  const clientSecret = normalizedEnv(process.env.GOOGLE_CALENDAR_CLIENT_SECRET)
  const configuredRedirectUri = normalizedEnv(process.env.GOOGLE_CALENDAR_REDIRECT_URI)

  if (!configuredEnv(clientId) || !configuredEnv(clientSecret)) {
    return null
  }

  return {
    clientId,
    clientSecret,
    redirectUri: configuredEnv(configuredRedirectUri)
      ? configuredRedirectUri
      : `${getSiteUrl().replace(/\/$/, "")}/api/calendar/google/callback`,
  }
}

export function hasGoogleCalendarSyncConfig() {
  return Boolean(getGoogleCalendarSyncConfig())
}
