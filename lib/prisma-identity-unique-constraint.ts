type IdentityUniqueOwner = "USER_EMAIL" | "GOOGLE_ACCOUNT"

const USER_INDEXES = new Set(["User_normalized_email_key", "User_email_key"])
const ACCOUNT_INDEXES = new Set(["Account_provider_providerAccountId_key"])

/**
 * Recognizes only identity constraints whose committed owner can safely be
 * re-read after a P2002 race. Prisma's legacy engine reports model/target;
 * driver adapters report PostgreSQL 23505 details under driverAdapterError.
 */
export function isApprovedIdentityUniqueConstraint(
  error: unknown,
  allowedOwners: readonly IdentityUniqueOwner[],
): boolean {
  if (!isRecord(error) || error.code !== "P2002" || !isRecord(error.meta)) return false
  const allowed = new Set(allowedOwners)
  const meta = error.meta

  if (typeof meta.modelName === "string" || Object.hasOwn(meta, "target")) {
    return legacyConstraintMatches(meta.modelName, meta.target, allowed)
  }

  const adapter = meta.driverAdapterError
  if (!isRecord(adapter) || !isRecord(adapter.cause)) return false
  const cause = adapter.cause
  if (cause.kind !== "UniqueConstraintViolation" || cause.originalCode !== "23505") return false
  return adapterConstraintMatches(cause.constraint, allowed)
}

export function isUserEmailUniqueConstraint(error: unknown): boolean {
  return isApprovedIdentityUniqueConstraint(error, ["USER_EMAIL"])
}

export function isGoogleIdentityUniqueConstraint(error: unknown): boolean {
  return isApprovedIdentityUniqueConstraint(error, ["USER_EMAIL", "GOOGLE_ACCOUNT"])
}

function legacyConstraintMatches(modelName: unknown, target: unknown, allowed: Set<IdentityUniqueOwner>): boolean {
  if (modelName === "User" && allowed.has("USER_EMAIL")) {
    return isUserIndex(target) || exactFields(target, ["email"])
  }
  if (modelName === "Account" && allowed.has("GOOGLE_ACCOUNT")) {
    return target === "Account_provider_providerAccountId_key"
      || exactFields(target, ["provider", "providerAccountId"])
  }
  return false
}

function adapterConstraintMatches(constraint: unknown, allowed: Set<IdentityUniqueOwner>): boolean {
  if (!isRecord(constraint)) return false
  if (typeof constraint.index === "string") {
    return (allowed.has("USER_EMAIL") && USER_INDEXES.has(constraint.index))
      || (allowed.has("GOOGLE_ACCOUNT") && ACCOUNT_INDEXES.has(constraint.index))
  }
  if (!Array.isArray(constraint.fields)) return false
  return (allowed.has("USER_EMAIL") && exactFields(constraint.fields, ["email"]))
    || (allowed.has("GOOGLE_ACCOUNT") && exactFields(constraint.fields, ["provider", "providerAccountId"]))
}

function isUserIndex(value: unknown): boolean {
  return typeof value === "string" && USER_INDEXES.has(value)
}

function exactFields(value: unknown, expected: readonly string[]): boolean {
  return Array.isArray(value)
    && value.length === expected.length
    && expected.every((field, index) => value[index] === field)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}
