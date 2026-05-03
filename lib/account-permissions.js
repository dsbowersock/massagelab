// @ts-check

export const ACCOUNT_ROLES = /** @type {const} */ (["USER", "EDITOR", "ADMIN"])

const ROLE_RANK = Object.freeze({
  USER: 1,
  EDITOR: 2,
  ADMIN: 3,
})

/**
 * @param {unknown} value
 * @returns {value is "USER" | "EDITOR" | "ADMIN"}
 */
export function isAccountRole(value) {
  return typeof value === "string" && ACCOUNT_ROLES.includes(/** @type {"USER" | "EDITOR" | "ADMIN"} */ (value.toUpperCase()))
}

/**
 * @param {unknown[] | undefined | null} roles
 */
export function normalizeRoles(roles) {
  if (!Array.isArray(roles)) {
    return []
  }

  return /** @type {("USER" | "EDITOR" | "ADMIN")[]} */ ([...new Set(roles.filter(isAccountRole).map((role) => String(role).toUpperCase()))])
}

/**
 * @param {unknown[] | undefined | null} roles
 * @param {"USER" | "EDITOR" | "ADMIN" | "user" | "editor" | "admin"} requiredRole
 */
export function hasRequiredRole(roles, requiredRole) {
  const normalizedRoles = normalizeRoles(roles)
  const requiredRank = ROLE_RANK[/** @type {"USER" | "EDITOR" | "ADMIN"} */ (requiredRole.toUpperCase())]

  return normalizedRoles.some((role) => ROLE_RANK[/** @type {"USER" | "EDITOR" | "ADMIN"} */ (role)] >= requiredRank)
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
