import type { Prisma, PrismaClient } from "@prisma/client"
import { ensureVerifiedUserBackgroundCredits, type PrismaClientOrTransaction } from "../commerce/credit-service.ts"
import { requireBrowserAdminFixtureQaAuthorization } from "./browser-qa-authorization.ts"
import type { BrowserAdminFixtureIdentity } from "./browser-fixture-identity.ts"

type QaEnvironment = Record<string, string | undefined>
type CreditProvisioner = (prismaClient: PrismaClientOrTransaction, userId: string) => Promise<unknown>

// QA-fixture-only lock namespace/version. It serializes first-grant predicates
// across Playwright workers without changing application or commerce behavior.
export const BROWSER_ADMIN_FIXTURE_ADVISORY_LOCK = [0x4d4c, 8] as const

/**
 * Creates a fixture's two verified identities and settles the authenticated
 * operator's initial-credit grant before its cookie can start Auth.js refreshes.
 * A transaction-scoped PostgreSQL advisory lock serializes only this QA setup
 * across Playwright workers, preventing overlapping missing-wallet predicates.
 */
export async function createBrowserAdminFixtureRecords(input: {
  prismaClient: PrismaClient
  identity: BrowserAdminFixtureIdentity
  environment?: QaEnvironment
  provisionCredits?: CreditProvisioner
}) {
  requireBrowserAdminFixtureQaAuthorization(input.environment)
  return input.prismaClient.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(${BROWSER_ADMIN_FIXTURE_ADVISORY_LOCK[0]}, ${BROWSER_ADMIN_FIXTURE_ADVISORY_LOCK[1]})`
    await createBrowserAdminFixtureRecordsInTransaction({
      prismaClient: transaction,
      identity: input.identity,
      provisionCredits: input.provisionCredits,
    })
  })
}

async function createBrowserAdminFixtureRecordsInTransaction(input: {
  prismaClient: Prisma.TransactionClient
  identity: BrowserAdminFixtureIdentity
  provisionCredits?: CreditProvisioner
}) {
  const verifiedAt = new Date("2026-08-09T00:00:00.000Z")
  await input.prismaClient.user.create({
    data: {
      ...input.identity.operator,
      emailVerified: verifiedAt,
      roles: { create: [{ role: "ADMIN", status: "VERIFIED", source: "browser-admin-fixture", verifiedAt }] },
    },
  })
  await input.prismaClient.user.create({
    data: {
      ...input.identity.target,
      emailVerified: verifiedAt,
      roles: { create: [{ role: "USER", status: "VERIFIED", source: "browser-admin-fixture", verifiedAt }] },
    },
  })
  await (input.provisionCredits ?? ensureVerifiedUserBackgroundCredits)(input.prismaClient, input.identity.operator.id)
}
