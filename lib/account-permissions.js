// @ts-check

export const ACCOUNT_ROLES = /** @type {const} */ ([
  "USER",
  "STUDENT",
  "LICENSED_THERAPIST",
  "CLIENT",
  "EDITOR",
  "ADMIN",
])

export const VERIFICATION_STATUSES = /** @type {const} */ ([
  "UNVERIFIED",
  "PENDING",
  "VERIFIED",
  "EXPIRED",
  "REJECTED",
  "REVOKED",
])

const ROLE_RANK = Object.freeze({
  USER: 1,
  STUDENT: 1,
  LICENSED_THERAPIST: 1,
  CLIENT: 1,
  EDITOR: 2,
  ADMIN: 3,
})

/**
 * @param {unknown} value
 * @returns {value is "USER" | "STUDENT" | "LICENSED_THERAPIST" | "CLIENT" | "EDITOR" | "ADMIN"}
 */
export function isAccountRole(value) {
  return typeof value === "string" && ACCOUNT_ROLES.includes(/** @type {typeof ACCOUNT_ROLES[number]} */ (value.toUpperCase()))
}

/**
 * @param {unknown} value
 * @returns {value is "UNVERIFIED" | "PENDING" | "VERIFIED" | "EXPIRED" | "REJECTED" | "REVOKED"}
 */
export function isVerificationStatus(value) {
  return typeof value === "string" && VERIFICATION_STATUSES.includes(/** @type {typeof VERIFICATION_STATUSES[number]} */ (value.toUpperCase()))
}

/**
 * @param {unknown[] | undefined | null} roles
 */
export function normalizeRoles(roles) {
  if (!Array.isArray(roles)) {
    return []
  }

  return /** @type {(typeof ACCOUNT_ROLES[number])[]} */ ([...new Set(roles.filter(isAccountRole).map((role) => String(role).toUpperCase()))])
}

/**
 * @param {unknown[] | undefined | null} roleAssignments
 */
export function normalizeRoleAssignments(roleAssignments) {
  if (!Array.isArray(roleAssignments)) {
    return []
  }

  const normalized = []
  const seen = new Set()

  for (const assignment of roleAssignments) {
    const rawRole = typeof assignment === "string"
      ? assignment
      : assignment && typeof assignment === "object" && "role" in assignment
        ? /** @type {{ role?: unknown }} */ (assignment).role
        : undefined

    if (!isAccountRole(rawRole)) {
      continue
    }

    const rawStatus = typeof assignment === "string"
      ? "VERIFIED"
      : assignment && typeof assignment === "object" && "status" in assignment
        ? /** @type {{ status?: unknown }} */ (assignment).status
        : "VERIFIED"

    const role = /** @type {typeof ACCOUNT_ROLES[number]} */ (String(rawRole).toUpperCase())
    const status = isVerificationStatus(rawStatus)
      ? /** @type {typeof VERIFICATION_STATUSES[number]} */ (String(rawStatus).toUpperCase())
      : "UNVERIFIED"
    const key = `${role}:${status}`

    if (!seen.has(key)) {
      normalized.push({ role, status })
      seen.add(key)
    }
  }

  return normalized
}

/**
 * @param {unknown[] | undefined | null} roles
 * @param {typeof ACCOUNT_ROLES[number] | Lowercase<typeof ACCOUNT_ROLES[number]>} requiredRole
 */
export function hasRequiredRole(roles, requiredRole) {
  const normalizedRoles = normalizeRoles(roles)
  const requiredRank = ROLE_RANK[/** @type {typeof ACCOUNT_ROLES[number]} */ (requiredRole.toUpperCase())]

  return normalizedRoles.some((role) => ROLE_RANK[/** @type {typeof ACCOUNT_ROLES[number]} */ (role)] >= requiredRank)
}

/**
 * @param {unknown[] | undefined | null} roleAssignments
 * @param {typeof ACCOUNT_ROLES[number]} role
 */
export function hasVerifiedRole(roleAssignments, role) {
  return normalizeRoleAssignments(roleAssignments).some(
    (assignment) => assignment.role === role && assignment.status === "VERIFIED",
  )
}

/**
 * @param {unknown[] | undefined | null} roles
 */
export function canManageAnatomyContent(roles) {
  return hasRequiredRole(roles, "EDITOR")
}

/**
 * @param {unknown[] | undefined | null} roles
 */
export function canAdministerAccounts(roles) {
  return hasRequiredRole(roles, "ADMIN")
}

/**
 * @param {unknown[] | undefined | null} roleAssignments
 */
export function canManageClients(roleAssignments) {
  const roles = normalizeRoleAssignments(roleAssignments)
  return hasVerifiedRole(roles, "LICENSED_THERAPIST") || roles.some((assignment) => assignment.role === "ADMIN" && assignment.status === "VERIFIED")
}

/**
 * @param {unknown[] | undefined | null} roleAssignments
 */
export function canRequestCredentials(roleAssignments) {
  const roles = normalizeRoleAssignments(roleAssignments)
  return roles.some((assignment) => ["USER", "STUDENT", "LICENSED_THERAPIST", "CLIENT"].includes(assignment.role))
}

/**
 * @param {unknown[] | undefined | null} roleAssignments
 * @param {{ hostedClinicalSyncEnabled?: boolean }} [options]
 */
export function buildAccountCapabilities(roleAssignments, options = {}) {
  const assignments = normalizeRoleAssignments(roleAssignments)
  const roles = assignments.map((assignment) => assignment.role)

  return {
    canAdministerAccounts: canAdministerAccounts(roles),
    canManageAnatomyContent: canManageAnatomyContent(roles),
    canManageClients: canManageClients(assignments),
    canRequestCredentials: canRequestCredentials(assignments),
    canUseLocalClinicalTools: true,
    hostedClinicalSyncEnabled: Boolean(options.hostedClinicalSyncEnabled),
  }
}
