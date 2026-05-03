function normalizeEnvValue(value?: string | null) {
  return value?.trim() ?? ""
}

function isConfiguredEnvValue(value?: string | null) {
  const normalized = normalizeEnvValue(value)

  return Boolean(normalized && !/replace-with|example|your-/i.test(normalized))
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
  if (!isConfiguredEnvValue(process.env.AUTH_GOOGLE_ID) || !isConfiguredEnvValue(process.env.AUTH_GOOGLE_SECRET)) {
    return null
  }

  return {
    clientId: normalizeEnvValue(process.env.AUTH_GOOGLE_ID),
    clientSecret: normalizeEnvValue(process.env.AUTH_GOOGLE_SECRET),
  }
}

export function getSiteUrl() {
  return process.env.AUTH_URL ?? "http://localhost:3000"
}
