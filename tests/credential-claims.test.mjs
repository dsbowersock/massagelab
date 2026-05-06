import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildCredentialClaimKey,
  claimVerifiedCredential,
  normalizeCredentialClaimNumber,
} from "../lib/credential-claims.js"

function fakePrisma(initialClaims = []) {
  const claims = new Map()

  for (const claim of initialClaims) {
    claims.set(claimKey(claim), { ...claim })
  }

  return {
    claims,
    verifiedCredentialClaim: {
      async findUnique({ where }) {
        return claims.get(claimKey(where.kind_jurisdictionCode_normalizedCredentialNumber)) ?? null
      },
      async create({ data }) {
        const key = claimKey(data)

        if (claims.has(key)) {
          const error = new Error("Unique constraint failed")
          error.code = "P2002"
          throw error
        }

        const claim = {
          id: `claim-${claims.size + 1}`,
          ...data,
        }
        claims.set(key, claim)
        return claim
      },
      async update({ where, data }) {
        const key = claimKey(where.kind_jurisdictionCode_normalizedCredentialNumber)
        const current = claims.get(key)
        const updated = { ...current, ...data }
        claims.set(key, updated)
        return updated
      },
    },
  }
}

function claimKey(claim) {
  return `${claim.kind}:${claim.jurisdictionCode}:${claim.normalizedCredentialNumber}`
}

describe("Verified credential claims", () => {
  it("normalizes credential claim keys for database uniqueness", () => {
    assert.equal(normalizeCredentialClaimNumber(" 33.019598 "), "33019598")
    assert.deepEqual(
      buildCredentialClaimKey({
        kind: "MASSAGE_LICENSE",
        jurisdictionCode: " oh ",
        credentialNumber: "33.019598",
      }),
      {
        kind: "MASSAGE_LICENSE",
        jurisdictionCode: "OH",
        normalizedCredentialNumber: "33019598",
      },
    )
  })

  it("claims a verified credential for the first user and refreshes same-user claims", async () => {
    const prismaClient = fakePrisma()
    const firstClaim = await claimVerifiedCredential({
      prismaClient,
      userId: "user-1",
      kind: "MASSAGE_LICENSE",
      jurisdictionCode: "OH",
      credentialNumber: "33.019598",
      credentialVerificationId: "verification-1",
      source: "OHIO_ELICENSE_VISUALFORCE",
    })
    const secondClaim = await claimVerifiedCredential({
      prismaClient,
      userId: "user-1",
      kind: "MASSAGE_LICENSE",
      jurisdictionCode: "OH",
      credentialNumber: "33019598",
      credentialVerificationId: "verification-2",
      source: "OHIO_ELICENSE_VISUALFORCE",
    })

    assert.equal(firstClaim.claimed, true)
    assert.equal(secondClaim.claimed, true)
    assert.equal(prismaClient.claims.size, 1)
  })

  it("keeps a second user pending when a verified credential is already claimed", async () => {
    const prismaClient = fakePrisma([
      {
        id: "claim-1",
        userId: "user-1",
        kind: "MASSAGE_LICENSE",
        jurisdictionCode: "OH",
        normalizedCredentialNumber: "33019598",
      },
    ])
    const duplicateClaim = await claimVerifiedCredential({
      prismaClient,
      userId: "user-2",
      kind: "MASSAGE_LICENSE",
      jurisdictionCode: "OH",
      credentialNumber: "33.019598",
      credentialVerificationId: "verification-2",
      source: "OHIO_ELICENSE_VISUALFORCE",
    })

    assert.equal(duplicateClaim.claimed, false)
    assert.equal(duplicateClaim.reasonCode, "DUPLICATE_CREDENTIAL_REVIEW")
    assert.equal(duplicateClaim.existingClaim?.id, "claim-1")
  })
})
