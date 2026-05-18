// @ts-check

/**
 * @typedef {{ role: string, status: string }} NormalizedRoleAssignment
 * @typedef {{ role?: string | null, roles?: string[] | null, roleAssignments?: NormalizedRoleAssignment[] | null }} RoleAssignmentSessionUser
 */

/**
 * Preserve the session role fallback order used by account surfaces:
 * explicit roleAssignments, then roles, then legacy role, then USER.
 *
 * @param {RoleAssignmentSessionUser | undefined | null} sessionUser
 * @returns {NormalizedRoleAssignment[]}
 */
export function normalizeSessionRoleAssignments(sessionUser) {
  if (Array.isArray(sessionUser?.roleAssignments) && sessionUser.roleAssignments.length > 0) {
    return [...sessionUser.roleAssignments]
  }

  if (Array.isArray(sessionUser?.roles) && sessionUser.roles.length > 0) {
    return sessionUser.roles.map((role) => ({ role, status: "VERIFIED" }))
  }

  return [{ role: sessionUser?.role ?? "USER", status: "VERIFIED" }]
}
