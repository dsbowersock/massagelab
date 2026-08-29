import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"

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
    assert.match(actions, /const destination = await settleAccountAction\([\s\S]*\)\s*redirect\(destination\)/)
    assert.equal((actions.match(/redirect\(destination\)/g) ?? []).length, 2)
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
    assert.match(actions, /if \(destination === "\/account\?tab=credentials&credential=submitted"\) \{[\s\S]*refreshCredentialAccountSurface/)
  })

  it("rolls back a late credential write failure and retries without duplicates", async () => {
    const actionsSource = await readFile(new URL("../app/account/actions.ts", import.meta.url), "utf8")
    const outcomeSource = await readFile(new URL("../lib/account-action-outcome.ts", import.meta.url), "utf8")
    const { settleAccountAction } = loadCompiledModule(outcomeSource, "lib/account-action-outcome.test.ts")
    const state = { legal: [], credentials: [], roles: [], students: [] }
    let failLate = true

    function transactionClient(draft) {
      return {
        legalAcceptance: {
          upsert: async () => {
            if (draft.legal.length === 0) draft.legal.push({ id: "legal-1" })
          },
        },
        credentialVerification: {
          findFirst: async () => draft.credentials[0] ?? null,
          create: async ({ data }) => {
            const row = { ...data, id: "credential-1" }
            draft.credentials.push(row)
            return row
          },
          update: async ({ data }) => Object.assign(draft.credentials[0], data),
        },
        userRole: {
          findUnique: async () => draft.roles[0] ?? null,
          create: async ({ data }) => {
            draft.roles.push(data)
            return data
          },
          update: async ({ data }) => Object.assign(draft.roles[0], data),
        },
        studentAccess: {
          upsert: async ({ create, update }) => {
            if (failLate) throw new Error("private late ORM failure")
            if (draft.students[0]) Object.assign(draft.students[0], update)
            else draft.students.push(create)
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
      "@/lib/credential-claims": { claimVerifiedCredential: async () => { throw new Error("unexpected claim") } },
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
        verifyOhioMassageLicense: async () => { throw new Error("provider must stay outside this student path") },
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
    assert.deepEqual(state, { legal: [], credentials: [], roles: [], students: [] })

    failLate = false
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await assert.rejects(
        requestCredentialVerificationAction(submission),
        (error) => error.destination === "/account?tab=credentials&credential=submitted",
      )
    }
    assert.deepEqual(
      Object.fromEntries(Object.entries(state).map(([key, rows]) => [key, rows.length])),
      { legal: 1, credentials: 1, roles: 1, students: 1 },
    )
  })
})
