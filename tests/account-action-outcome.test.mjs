import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"
import { claimVerifiedCredential } from "../lib/credential-claims.js"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)

describe("account action outcome mapping", () => {
  it("returns only the allowlisted success path after operational success", async () => {
    const source = await readFile(new URL("../lib/account-action-outcome.ts", import.meta.url), "utf8")
    const { settleAccountAction } = loadCompiledModule(source, "lib/account-action-outcome.test.ts")
    let ran = false
    const result = await settleAccountAction({
      run: async () => { ran = true },
      successPath: "/account?tab=profile&profile=saved",
      failurePath: "/account?tab=profile&profile=save-failed",
    })
    assert.equal(ran, true)
    assert.equal(result, "/account?tab=profile&profile=saved")
  })

  it("maps a thrown operational failure without leaking its message", async () => {
    const source = await readFile(new URL("../lib/account-action-outcome.ts", import.meta.url), "utf8")
    const { settleAccountAction } = loadCompiledModule(source, "lib/account-action-outcome.test.ts")
    const secretMessage = "provider ORM credential value must stay private"
    const result = await settleAccountAction({
      run: async () => { throw new Error(secretMessage) },
      successPath: "/account?tab=credentials&credential=submitted",
      failurePath: "/account?tab=credentials&credential=submit-failed",
    })
    assert.equal(result, "/account?tab=credentials&credential=submit-failed")
    assert.equal(result.includes(secretMessage), false)
  })

  it("keeps final redirects outside operational settlement in account actions", async () => {
    const actions = await readFile(new URL("../app/account/actions.ts", import.meta.url), "utf8")
    assert.match(actions, /settleAccountAction\(\{[\s\S]*successPath: "\/account\?tab=profile&profile=saved"[\s\S]*failurePath: "\/account\?tab=profile&profile=save-failed"/)
    assert.match(actions, /settleAccountAction\(\{[\s\S]*successPath: "\/account\?tab=credentials&credential=submitted"[\s\S]*failurePath: "\/account\?tab=credentials&credential=submit-failed"/)
    const profileAction = actions.slice(
      actions.indexOf("export async function saveProfileAction"),
      actions.indexOf("function credentialRole"),
    )
    const credentialAction = actions.slice(
      actions.indexOf("export async function requestCredentialVerificationAction"),
      actions.indexOf("/** Cache refresh is best-effort"),
    )
    for (const action of [profileAction, credentialAction]) {
      const settlementIndex = action.indexOf("const destination = await settleAccountAction")
      const refreshIndex = action.indexOf("refreshAccountSurface")
      const redirectIndex = action.indexOf("redirect(destination)")
      assert.ok(settlementIndex >= 0 && refreshIndex > settlementIndex && redirectIndex > refreshIndex)
    }
    assert.equal((actions.match(/redirect\(destination\)/g) ?? []).length, 2)
  })

  it("keeps a durable profile save successful when cache refresh fails and maps true persistence failure", async () => {
    const actionsSource = await readFile(new URL("../app/account/actions.ts", import.meta.url), "utf8")
    const outcomeSource = await readFile(new URL("../lib/account-action-outcome.ts", import.meta.url), "utf8")
    const { settleAccountAction } = loadCompiledModule(outcomeSource, "lib/account-action-outcome.test.ts")

    async function runScenario({ failPersistence = false, failRefreshAt = null } = {}) {
      const calls = []
      const redirect = (destination) => {
        const controlFlow = new Error("redirect")
        controlFlow.destination = destination
        throw controlFlow
      }
      const prisma = {
        userProfile: {
          upsert: async () => {
            calls.push("persist")
            if (failPersistence) throw new Error("private persistence detail")
          },
        },
        $transaction: async () => {
          throw new Error("credential transaction must stay outside profile save")
        },
      }
      const { saveProfileAction } = loadCompiledModule(actionsSource, "app/account/actions.profile.test.ts", {
        "next/cache": {
          revalidatePath: () => {
            calls.push("revalidate")
            if (failRefreshAt === "revalidate") throw new Error("private revalidation detail")
          },
        },
        "next/headers": { headers: async () => new Headers() },
        "next/navigation": { redirect },
        "@/auth": { getCurrentSession: async () => ({ user: { id: "user-1" } }) },
        "@/lib/account-action-outcome": { settleAccountAction },
        "@/lib/account-surface-data": {
          clearAccountSurfaceDataCache: () => {
            calls.push("clear-cache")
            if (failRefreshAt === "clear-cache") throw new Error("private cache detail")
          },
        },
        "@/lib/credential-verification-roles": {
          roleStatusForCredentialStatus: () => "PENDING",
          shouldUpdateCredentialRole: () => false,
        },
        "@/lib/credential-claims": { claimVerifiedCredential },
        "@/lib/legal-acceptance": {
          acceptedDocumentIdsFromInput: () => [],
          legalHeadersMetadata: () => ({}),
          missingRequiredLegalDocuments: () => [],
          recordLegalAcceptances: async () => {},
        },
        "@/lib/legal-documents": { requiredLegalDocumentsForEvent: () => [] },
        "@/lib/license-verification": {
          getJurisdictionVerificationPlan: () => ({
            sourceType: "DOCUMENT_REVIEW",
            sourceUrl: null,
            supportStatus: "MANUAL_REVIEW_REQUIRED",
            message: "Review required.",
          }),
        },
        "@/lib/membership": { buildStudentAccessState: () => null },
        "@/lib/ohio-license-verifier": {
          OHIO_LICENSE_VERIFIER_NAME: "Ohio eLicense",
          ohioExpirationDateToDate: () => null,
          verifyOhioMassageLicense: async () => null,
        },
        "@/lib/prisma": { prisma },
      })
      const formData = new FormData()
      formData.set("display_name", "Safe profile")
      const outcome = saveProfileAction(formData).then(
        () => ({ destination: null }),
        (error) => ({ destination: error.destination }),
      )
      return { ...(await outcome), calls }
    }

    for (const failRefreshAt of ["clear-cache", "revalidate"]) {
      const committed = await runScenario({ failRefreshAt })
      assert.equal(committed.destination, "/account?tab=profile&profile=saved")
      assert.equal(committed.calls[0], "persist")
    }

    const failed = await runScenario({ failPersistence: true })
    assert.equal(failed.destination, "/account?tab=profile&profile=save-failed")
    assert.deepEqual(failed.calls, ["persist"])
  })

  it("keeps credential provider work outside one atomic durable-write boundary", async () => {
    const actions = await readFile(new URL("../app/account/actions.ts", import.meta.url), "utf8")
    const operation = actions.slice(actions.indexOf("async function submitCredentialVerificationOperation"))
    const providerIndex = operation.indexOf("await verifyOhioMassageLicense")
    const transactionIndex = operation.indexOf("await prisma.$transaction")
    assert.ok(providerIndex >= 0 && transactionIndex > providerIndex, "provider verification must settle before the database transaction")
    assert.match(operation, /await prisma\.\$transaction\(async \(transaction\) => \{[\s\S]*recordLegalAcceptances\(\{[\s\S]*prismaClient: transaction/)
    assert.match(operation, /claimVerifiedCredential\(\{[\s\S]*prismaClient: transaction/)
    assert.match(operation, /transaction\.credentialVerification\.(?:findFirst|create|update)/)
    assert.match(operation, /transaction\.userRole\.(?:findUnique|create|update)/)
    assert.match(operation, /transaction\.studentAccess\.upsert/)
    assert.doesNotMatch(operation, /await prisma\.(?:credentialVerification|userRole|studentAccess)\./)
    assert.match(actions, /if \(destination === "\/account\?tab=credentials&credential=submitted"\) \{[\s\S]*refreshAccountSurface/)
  })

  it("rolls back a late credential write failure and retries without duplicates", async () => {
    const actionsSource = await readFile(new URL("../app/account/actions.ts", import.meta.url), "utf8")
    const outcomeSource = await readFile(new URL("../lib/account-action-outcome.ts", import.meta.url), "utf8")
    const { settleAccountAction } = loadCompiledModule(outcomeSource, "lib/account-action-outcome.test.ts")
    const state = { legal: [], credentials: [], roles: [], students: [], claims: [] }
    let failLate = true
    let claimRacePending = false
    let ohioResult = null

    function transactionClient(draft) {
      return {
        legalAcceptance: {
          upsert: async () => {
            if (draft.legal.length === 0) draft.legal.push({ id: "legal-1" })
          },
        },
        credentialVerification: {
          findFirst: async ({ where }) => draft.credentials.find((row) =>
            row.userId === where.userId
            && row.kind === where.kind
            && row.jurisdictionCode === where.jurisdictionCode
            && row.credentialNumber === where.credentialNumber) ?? null,
          create: async ({ data }) => {
            const row = { ...data, id: `credential-${draft.credentials.length + 1}` }
            draft.credentials.push(row)
            return row
          },
          update: async ({ where, data }) => Object.assign(
            draft.credentials.find((row) => row.id === where.id),
            data,
          ),
        },
        userRole: {
          findUnique: async ({ where }) => draft.roles.find((row) =>
            row.userId === where.userId_role.userId && row.role === where.userId_role.role) ?? null,
          create: async ({ data }) => {
            draft.roles.push(data)
            return data
          },
          update: async ({ where, data }) => Object.assign(
            draft.roles.find((row) => row.userId === where.userId_role.userId && row.role === where.userId_role.role),
            data,
          ),
        },
        studentAccess: {
          upsert: async ({ create, update }) => {
            if (failLate) throw new Error("private late ORM failure")
            if (draft.students[0]) Object.assign(draft.students[0], update)
            else draft.students.push(create)
          },
        },
        verifiedCredentialClaim: {
          findUnique: async ({ where }) => {
            const key = where.kind_jurisdictionCode_normalizedCredentialNumber
            return draft.claims.find((claim) =>
              claim.kind === key.kind
              && claim.jurisdictionCode === key.jurisdictionCode
              && claim.normalizedCredentialNumber === key.normalizedCredentialNumber) ?? null
          },
          createMany: async ({ data, skipDuplicates }) => {
            assert.equal(skipDuplicates, true)
            if (claimRacePending) {
              claimRacePending = false
              draft.claims.push({
                ...data[0],
                id: "competing-claim",
                userId: "other-user",
              })
              return { count: 0 }
            }
            draft.claims.push({ id: "created-claim", ...data[0] })
            return { count: 1 }
          },
          update: async ({ where, data }) => {
            const key = where.kind_jurisdictionCode_normalizedCredentialNumber
            return Object.assign(draft.claims.find((claim) =>
              claim.kind === key.kind
              && claim.jurisdictionCode === key.jurisdictionCode
              && claim.normalizedCredentialNumber === key.normalizedCredentialNumber), data)
          },
        },
      }
    }

    const prisma = {
      $transaction: async (operation) => {
        const draft = structuredClone(state)
        const result = await operation(transactionClient(draft))
        Object.assign(state, draft)
        return result
      },
    }
    const redirect = (destination) => {
      const controlFlow = new Error("redirect")
      controlFlow.destination = destination
      throw controlFlow
    }
    const { requestCredentialVerificationAction } = loadCompiledModule(actionsSource, "app/account/actions.test.ts", {
      "next/cache": { revalidatePath() {} },
      "next/headers": { headers: async () => new Headers() },
      "next/navigation": { redirect },
      "@/auth": { getCurrentSession: async () => ({ user: { id: "user-1" } }) },
      "@/lib/account-action-outcome": { settleAccountAction },
      "@/lib/account-surface-data": { clearAccountSurfaceDataCache() {} },
      "@/lib/credential-verification-roles": {
        roleStatusForCredentialStatus: () => "PENDING",
        shouldUpdateCredentialRole: () => false,
      },
      "@/lib/credential-claims": { claimVerifiedCredential },
      "@/lib/legal-acceptance": {
        acceptedDocumentIdsFromInput: () => [],
        legalHeadersMetadata: () => ({}),
        missingRequiredLegalDocuments: () => [],
        recordLegalAcceptances: ({ prismaClient }) => prismaClient.legalAcceptance.upsert({}),
      },
      "@/lib/legal-documents": { requiredLegalDocumentsForEvent: () => [{ key: "therapist", version: "1" }] },
      "@/lib/license-verification": {
        getJurisdictionVerificationPlan: () => ({ sourceType: "DOCUMENT_REVIEW", sourceUrl: null, supportStatus: "MANUAL_REVIEW_REQUIRED", message: "Review required." }),
      },
      "@/lib/membership": {
        buildStudentAccessState: ({ studentStartDate }) => ({
          studentStartDate,
          studentAccessExpiresAt: new Date("2027-08-01T00:00:00.000Z"),
          studentStatus: "ACTIVE",
          eligibleForTherapistDiscount: true,
        }),
      },
      "@/lib/ohio-license-verifier": {
        OHIO_LICENSE_VERIFIER_NAME: "Ohio eLicense",
        ohioExpirationDateToDate: () => null,
        verifyOhioMassageLicense: async () => {
          if (!ohioResult) throw new Error("provider must stay outside this student path")
          return ohioResult
        },
      },
      "@/lib/prisma": { prisma },
    })
    const submission = new FormData()
    submission.set("therapistAgreementAccepted", "true")
    submission.set("credential_kind", "STUDENT_ENROLLMENT")
    submission.set("student_start_date", "2026-08-01")

    await assert.rejects(
      requestCredentialVerificationAction(submission),
      (error) => error.destination === "/account?tab=credentials&credential=submit-failed",
    )
    assert.deepEqual(state, { legal: [], credentials: [], roles: [], students: [], claims: [] })

    failLate = false
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await assert.rejects(
        requestCredentialVerificationAction(submission),
        (error) => error.destination === "/account?tab=credentials&credential=submitted",
      )
    }
    assert.deepEqual(
      Object.fromEntries(Object.entries(state).map(([key, rows]) => [key, rows.length])),
      { legal: 1, credentials: 1, roles: 1, students: 1, claims: 0 },
    )

    ohioResult = {
      status: "VERIFIED",
      checkedAt: "2026-08-29T12:00:00.000Z",
      reasonCode: "OHIO_VERIFIED",
      match: { licenseNumber: true, name: true },
      proof: { expirationDate: null },
    }
    claimRacePending = true
    const duplicateSubmission = new FormData()
    duplicateSubmission.set("therapistAgreementAccepted", "true")
    duplicateSubmission.set("credential_kind", "MASSAGE_LICENSE")
    duplicateSubmission.set("jurisdiction_code", "OH")
    duplicateSubmission.set("credential_number", "33.019598")
    duplicateSubmission.set("legal_first_name", "Test")
    duplicateSubmission.set("legal_last_name", "Therapist")
    await assert.rejects(
      requestCredentialVerificationAction(duplicateSubmission),
      (error) => error.destination === "/account?tab=credentials&credential=submitted",
    )
    assert.equal(state.claims[0]?.userId, "other-user")
    assert.equal(state.credentials.find((row) => row.kind === "MASSAGE_LICENSE")?.status, "PENDING")
    assert.equal(
      state.credentials.find((row) => row.kind === "MASSAGE_LICENSE")?.verificationPayload?.credentialClaim?.reasonCode,
      "DUPLICATE_CREDENTIAL_REVIEW",
    )
  })
})
