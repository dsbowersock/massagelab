// @ts-check

/**
 * @param {string} status
 */
export function roleStatusForCredentialStatus(status) {
  if (status === "VERIFIED") return "VERIFIED"
  if (status === "REJECTED") return "UNVERIFIED"
  return "PENDING"
}

/**
 * @param {string | null | undefined} existingRoleStatus
 * @param {string} credentialStatus
 */
export function shouldUpdateCredentialRole(existingRoleStatus, credentialStatus) {
  return credentialStatus === "VERIFIED" || existingRoleStatus !== "VERIFIED"
}
