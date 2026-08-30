import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildCredentialClaimKey,
  claimVerifiedCredential,
  normalizeCredentialClaimNumber,
} from "../lib/credential-claims.js"

function fakePrisma(initialClaims = [], { createRaceClaim = null, createManyError = null } = {}) {
  const claims = new Map()
  let transactionAborted = false
  let racePending = Boolean(createRaceClaim)

  for (const claim of initialClaims) {
    claims.set(claimKey(claim), { ...claim })
  }

  return {
    claims,
    verifiedCredentialClaim: {
      async findUnique({ where }) {
        if (transactionAborted) throw new Error("current transaction is aborted")
        return claims.get(claimKey(where.kind_jurisdictionCode_normalizedCredentialNumber)) ?? null
      },
      async create() {
        transactionAborted = true
        assert.fail("claimVerifiedCredential must insert through createMany")
      },
      async createMany({ data, skipDuplicates }) {
        assert.equal(skipDuplicates, true)
        assert.equal(transactionAborted, false, "the insert must not abort the surrounding transaction")
        if (createManyError) throw createManyError
        const claim = data[0]
        const key = claimKey(claim)

        if (racePending) {
          racePending = false
          claims.set(key, { ...createRaceClaim })
          return { count: 0 }
        }
        if (claims.has(key)) return { count: 0 }

        claims.set(key, { id: `claim-${claims.size + 1}`, ...claim })
        return { count: 1 }
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

  it("reads a concurrent cross-user winner without aborting the surrounding transaction", async () => {
    const concurrentWinner = {
      id: "claim-race-winner",
      userId: "user-1",
      kind: "MASSAGE_LICENSE",
      jurisdictionCode: "OH",
      normalizedCredentialNumber: "33019598",
    }
    const prismaClient = fakePrisma([], { createRaceClaim: concurrentWinner })

    const result = await claimVerifiedCredential({
      prismaClient,
      userId: "user-2",
      kind: "MASSAGE_LICENSE",
      jurisdictionCode: "OH",
      credentialNumber: "33.019598",
      credentialVerificationId: "verification-2",
      source: "OHIO_ELICENSE_VISUALFORCE",
    })

    assert.equal(result.claimed, false)
    assert.equal(result.reasonCode, "DUPLICATE_CREDENTIAL_REVIEW")
    assert.equal(result.existingClaim?.id, "claim-race-winner")
  })

  it("does not convert unrelated create failures into duplicate-claim review", async () => {
    const unrelated = Object.assign(new Error("unrelated unique failure"), {
      code: "P2002",
      meta: { modelName: "OtherModel", target: ["otherField"] },
    })
    const prismaClient = fakePrisma([], { createManyError: unrelated })

    await assert.rejects(
      claimVerifiedCredential({
        prismaClient,
        userId: "user-2",
        kind: "MASSAGE_LICENSE",
        jurisdictionCode: "OH",
        credentialNumber: "33.019598",
        credentialVerificationId: "verification-2",
        source: "OHIO_ELICENSE_VISUALFORCE",
      }),
      (error) => error === unrelated,
    )
  })
})
