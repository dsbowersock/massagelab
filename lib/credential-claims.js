// @ts-check

/**
 * @param {unknown} value
 */
export function normalizeCredentialClaimNumber(value) {
  if (typeof value !== "string" && typeof value !== "number") return ""

  return String(value).trim().toUpperCase().replace(/[^A-Z0-9]/g, "")
}

/**
 * @param {{
 *   kind: string,
 *   jurisdictionCode?: string | null,
 *   credentialNumber?: string | null,
 * }} input
 */
export function buildCredentialClaimKey(input) {
  return {
    kind: input.kind,
    jurisdictionCode: typeof input.jurisdictionCode === "string" ? input.jurisdictionCode.trim().toUpperCase() : "",
    normalizedCredentialNumber: normalizeCredentialClaimNumber(input.credentialNumber),
  }
}

/**
 * @param {{
 *   prismaClient: {
 *     verifiedCredentialClaim: {
 *       findUnique: Function,
 *       createMany: Function,
 *       update: Function,
 *     },
 *   },
 *   userId: string,
 *   kind: string,
 *   jurisdictionCode?: string | null,
 *   credentialNumber?: string | null,
 *   credentialVerificationId?: string | null,
 *   source: string,
 *   expiresAt?: Date | null,
 * }} input
 */
export async function claimVerifiedCredential(input) {
  const key = buildCredentialClaimKey(input)

  if (!key.kind || !key.jurisdictionCode || !key.normalizedCredentialNumber) {
    return {
      claimed: false,
      reasonCode: "MISSING_CREDENTIAL_CLAIM_INPUT",
      key,
      existingClaim: null,
    }
  }

  const uniqueWhere = {
    kind_jurisdictionCode_normalizedCredentialNumber: key,
  }
  const existingClaim = await input.prismaClient.verifiedCredentialClaim.findUnique({
    where: uniqueWhere,
  })

  if (existingClaim && existingClaim.userId !== input.userId) {
    return {
      claimed: false,
      reasonCode: "DUPLICATE_CREDENTIAL_REVIEW",
      key,
      existingClaim: publicClaim(existingClaim),
    }
  }

  if (existingClaim) {
    const updatedClaim = await input.prismaClient.verifiedCredentialClaim.update({
      where: uniqueWhere,
      data: {
        credentialVerificationId: input.credentialVerificationId ?? null,
        source: input.source,
        claimedAt: new Date(),
        expiresAt: input.expiresAt ?? null,
      },
    })

    return {
      claimed: true,
      reasonCode: "CREDENTIAL_CLAIMED",
      key,
      existingClaim: publicClaim(updatedClaim),
    }
  }

  // The insert omits the generated id, leaving the public claim key as its only
  // supplied unique value. ON CONFLICT avoids aborting a transaction on a race.
  const inserted = await input.prismaClient.verifiedCredentialClaim.createMany({
    data: [{
      userId: input.userId,
      kind: input.kind,
      jurisdictionCode: key.jurisdictionCode,
      normalizedCredentialNumber: key.normalizedCredentialNumber,
      credentialVerificationId: input.credentialVerificationId ?? null,
      source: input.source,
      expiresAt: input.expiresAt ?? null,
    }],
    skipDuplicates: true,
  })
  const committedClaim = await input.prismaClient.verifiedCredentialClaim.findUnique({
    where: uniqueWhere,
  })

  if (!committedClaim) {
    throw new Error("Credential claim write completed without a readable owner")
  }

  if (committedClaim.userId !== input.userId) {
    return {
      claimed: false,
      reasonCode: "DUPLICATE_CREDENTIAL_REVIEW",
      key,
      existingClaim: publicClaim(committedClaim),
    }
  }

  if (inserted.count === 0) {
    const refreshedClaim = await input.prismaClient.verifiedCredentialClaim.update({
      where: uniqueWhere,
      data: {
        credentialVerificationId: input.credentialVerificationId ?? null,
        source: input.source,
        claimedAt: new Date(),
        expiresAt: input.expiresAt ?? null,
      },
    })
    return {
      claimed: true,
      reasonCode: "CREDENTIAL_CLAIMED",
      key,
      existingClaim: publicClaim(refreshedClaim),
    }
  }

  return {
    claimed: true,
    reasonCode: "CREDENTIAL_CLAIMED",
    key,
    existingClaim: publicClaim(committedClaim),
  }
}

/**
 * @param {unknown} claim
 */
function publicClaim(claim) {
  if (!claim || typeof claim !== "object" || Array.isArray(claim)) return null

  const record = /** @type {Record<string, unknown>} */ (claim)

  return {
    id: typeof record.id === "string" ? record.id : null,
    userId: typeof record.userId === "string" ? record.userId : null,
    kind: typeof record.kind === "string" ? record.kind : null,
    jurisdictionCode: typeof record.jurisdictionCode === "string" ? record.jurisdictionCode : null,
    normalizedCredentialNumber:
      typeof record.normalizedCredentialNumber === "string" ? record.normalizedCredentialNumber : null,
  }
}
