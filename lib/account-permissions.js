// @ts-check
import { FEATURE_KEYS, hasFeature } from "./membership.js"

export const ACCOUNT_ROLES = /** @type {const} */ ([
  "USER",
  "STUDENT",
  "LICENSED_THERAPIST",
  "CLIENT",
  "EDITOR",
  "ANATOMY_ADMIN",
  "ANATOMY_REVIEWER",
  "ANATOMY_EDITOR",
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
  ANATOMY_REVIEWER: 2.5,
  ANATOMY_EDITOR: 2.75,
  ANATOMY_ADMIN: 2.75,
  ADMIN: 3,
})

/**
 * @param {unknown} value
 * @returns {value is "USER" | "STUDENT" | "LICENSED_THERAPIST" | "CLIENT" | "EDITOR" | "ANATOMY_ADMIN" | "ANATOMY_REVIEWER" | "ANATOMY_EDITOR" | "ADMIN"}
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

  return /** @type {(typeof ACCOUNT_ROLES[number])[]} */ ([...new Set(roles.filter(isAccountRole).map(normalizeAnatomyAdminRole))])
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

    const role = normalizeAnatomyAdminRole(rawRole)
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
  const effectiveRole = normalizeAnatomyAdminRole(role)
  return normalizeRoleAssignments(roleAssignments).some(
    (assignment) => assignment.role === effectiveRole && assignment.status === "VERIFIED",
  )
}

/**
 * @param {unknown[] | undefined | null} roles
 */
export function canManageAnatomyContent(roles) {
  return canEditAnatomyContent(roles)
}

/**
 * Selects the display role from normalized account roles without surfacing the
 * retired ANATOMY_ADMIN label.
 * @param {unknown[] | undefined | null} roles
 */
export function highestRole(roles) {
  const normalizedRoles = normalizeRoleAssignments(roles)
    .filter((assignment) => assignment.status === "VERIFIED")
    .map((assignment) => assignment.role)
  if (normalizedRoles.includes("ADMIN")) return "ADMIN"
  if (normalizedRoles.includes("ANATOMY_EDITOR")) return "ANATOMY_EDITOR"
  if (normalizedRoles.includes("ANATOMY_REVIEWER")) return "ANATOMY_REVIEWER"
  if (normalizedRoles.includes("EDITOR")) return "EDITOR"
  if (normalizedRoles.includes("LICENSED_THERAPIST")) return "LICENSED_THERAPIST"
  if (normalizedRoles.includes("STUDENT")) return "STUDENT"
  if (normalizedRoles.includes("CLIENT")) return "CLIENT"
  return "USER"
}

/**
 * @param {unknown[] | undefined | null} roles
 * @returns {boolean}
 */
export function canReviewAnatomyContent(roles) {
  const normalizedRoles = normalizeRoles(roles)
  return normalizedRoles.includes("ANATOMY_REVIEWER") || normalizedRoles.includes("ANATOMY_EDITOR") || normalizedRoles.includes("ADMIN")
}

/**
 * @param {unknown[] | undefined | null} roles
 * @returns {boolean}
 */
export function canEditAnatomyContent(roles) {
  const normalizedRoles = normalizeRoles(roles)
  return normalizedRoles.includes("ANATOMY_EDITOR") || normalizedRoles.includes("ADMIN")
}

/**
 * @param {unknown[] | undefined | null} roles
 */
export function canAdministerAccounts(roles) {
  return normalizeRoles(roles).includes("ADMIN")
}

/**
 * @param {unknown[] | undefined | null} roleAssignments
 */
export function canManageClients(roleAssignments) {
  const roles = normalizeRoleAssignments(roleAssignments)
  return hasVerifiedRole(roles, "LICENSED_THERAPIST") || roles.some((assignment) => assignment.role === "ADMIN" && assignment.status === "VERIFIED")
}

/**
 * Retires the displayed legacy role while retaining its effective editor authority.
 * @param {unknown} role
 */
function normalizeAnatomyAdminRole(role) {
  const normalized = String(role).toUpperCase()
  return normalized === "ANATOMY_ADMIN" ? "ANATOMY_EDITOR" : normalized
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
 * @param {{ hostedClinicalSyncEnabled?: boolean, features?: string[] }} [options]
 */
export function buildAccountCapabilities(roleAssignments, options = {}) {
  const assignments = normalizeRoleAssignments(roleAssignments)
  const verifiedAssignments = assignments.filter((assignment) => assignment.status === "VERIFIED")
  const roles = verifiedAssignments.map((assignment) => assignment.role)
  const canUsePremiumBackgrounds = hasFeature(options.features, FEATURE_KEYS.premiumBackgrounds)
  const canUseLocalClinicalTools = hasFeature(options.features, FEATURE_KEYS.therapistDocumentationTools)

  return {
    canAdministerAccounts: canAdministerAccounts(roles),
    canManageAnatomyContent: canManageAnatomyContent(roles),
    canManageClients: canManageClients(verifiedAssignments),
    canRequestCredentials: canRequestCredentials(assignments),
    canUseLocalClinicalTools,
    canUsePremiumBackgrounds,
    hasActiveMembershipBenefits: canUsePremiumBackgrounds || canUseLocalClinicalTools,
    hostedClinicalSyncEnabled: Boolean(options.hostedClinicalSyncEnabled),
  }
}
