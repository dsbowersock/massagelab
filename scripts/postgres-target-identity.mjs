import { createHash } from "node:crypto"

const ALLOWED_CONNECTION_PARAMETERS = new Set(["sslmode", "channel_binding"])
const TARGET_ALTERING_PARAMETERS = new Set(["schema", "options", "search_path"])

/**
 * Parses the non-secret PostgreSQL identity that determines role and database
 * scope. Passwords and approved transport parameters never enter the result.
 */
export function parsePostgresTargetIdentity(value, {
  label = "PostgreSQL target",
  requireDirectNeon = false,
} = {}) {
  const connectionString = typeof value === "string" ? value.trim() : ""
  if (!connectionString) throw new Error(`${label} is required.`)

  let parsed
  try {
    parsed = new URL(connectionString)
  } catch {
    throw new Error(`${label} must be a valid PostgreSQL URL.`)
  }
  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    throw new Error(`${label} must be a PostgreSQL URL.`)
  }

  let username
  let database
  try {
    username = decodeURIComponent(parsed.username)
    database = decodeURIComponent(parsed.pathname.replace(/^\/+|\/+$/g, ""))
  } catch {
    throw new Error(`${label} contains invalid URL encoding.`)
  }
  if (!username || !parsed.hostname || !database || database.includes("/")) {
    throw new Error(`${label} requires one username, host, and database name.`)
  }
  if (requireDirectNeon && (
    !parsed.hostname.toLowerCase().endsWith(".neon.tech")
    || parsed.hostname.toLowerCase().includes("-pooler.")
  )) {
    throw new Error(`${label} must be a direct non-pooler Neon connection.`)
  }

  const seenParameters = new Set()
  for (const [rawName] of parsed.searchParams) {
    const name = rawName.toLowerCase()
    if (seenParameters.has(name)) {
      throw new Error(`${label} contains a duplicate connection parameter.`)
    }
    seenParameters.add(name)
    if (TARGET_ALTERING_PARAMETERS.has(name)) {
      throw new Error(`${label} contains a target-altering connection parameter.`)
    }
    if (rawName !== name || !ALLOWED_CONNECTION_PARAMETERS.has(name)) {
      throw new Error(`${label} contains a connection parameter that is not allowed.`)
    }
  }

  return {
    username,
    host: parsed.hostname.toLowerCase(),
    port: parsed.port || "5432",
    database,
  }
}

/** Hashes one or more sanitized identity tuples under a caller-specific domain. */
export function fingerprintPostgresTargetIdentities(identities, namespace) {
  if (!Array.isArray(identities) || identities.length === 0 || !namespace) {
    throw new Error("PostgreSQL target fingerprint requires identities and a namespace.")
  }
  return createHash("sha256")
    .update(`${namespace}\0`)
    .update(JSON.stringify(identities))
    .digest("hex")
}
