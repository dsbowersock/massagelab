import type { PrismaClient } from "@prisma/client"
import { ensureVerifiedUserBackgroundCredits } from "../commerce/credit-service.ts"
import { requireBrowserAdminFixtureQaAuthorization } from "./browser-qa-authorization.ts"
import type { BrowserAdminFixtureIdentity } from "./browser-fixture-identity.ts"

type QaEnvironment = Record<string, string | undefined>
type CreditProvisioner = (prismaClient: PrismaClient, userId: string) => Promise<unknown>

/**
 * Creates a fixture's two verified identities and settles the authenticated
 * operator's initial-credit grant before its cookie can start Auth.js refreshes.
 * This prevents concurrent first-request provisioning from downgrading a valid
 * Admin session through the restricted auth fallback.
 */
export async function createBrowserAdminFixtureRecords(input: {
  prismaClient: PrismaClient
  identity: BrowserAdminFixtureIdentity
  environment?: QaEnvironment
  provisionCredits?: CreditProvisioner
}) {
  requireBrowserAdminFixtureQaAuthorization(input.environment)
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
