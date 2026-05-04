function normalizeEnvValue(value?: string | null) {
  return value?.trim() ?? ""
}

function isConfiguredEnvValue(value?: string | null) {
  const normalized = normalizeEnvValue(value)

  return Boolean(normalized && !/replace-with|example|your-/i.test(normalized))
}

function firstConfiguredEnvValue(names: string[]) {
  for (const name of names) {
    const value = process.env[name]

    if (isConfiguredEnvValue(value)) {
      return normalizeEnvValue(value)
    }
  }

  return ""
}

export function getAdminEmails() {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().replace(/^['"]|['"]$/g, "").toLowerCase())
      .filter(Boolean),
  )
}

export function isAdminEmail(email?: string | null) {
  return Boolean(email && getAdminEmails().has(email.toLowerCase()))
}

export function hasGoogleAuthConfig() {
  return Boolean(getGoogleAuthConfig())
}

export function getGoogleAuthConfig() {
  const clientId = firstConfiguredEnvValue(["AUTH_GOOGLE_ID", "AUTH_GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_ID"])
  const clientSecret = firstConfiguredEnvValue(["AUTH_GOOGLE_SECRET", "AUTH_GOOGLE_CLIENT_SECRET", "GOOGLE_CLIENT_SECRET"])

  if (!clientId || !clientSecret) {
    return null
  }

  return {
    clientId,
    clientSecret,
  }
}

export function getAuthSecret() {
  return firstConfiguredEnvValue(["AUTH_SECRET", "NEXTAUTH_SECRET"])
}

export function getSiteUrl() {
  return firstConfiguredEnvValue(["AUTH_URL", "NEXTAUTH_URL"]) || "http://localhost:3000"
}
