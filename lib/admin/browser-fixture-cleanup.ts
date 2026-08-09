import type { PrismaClient } from "@prisma/client"
import { requireBrowserAdminFixtureQaAuthorization } from "./browser-qa-authorization.ts"
import { createBrowserAdminFixtureIdentity } from "./browser-fixture-identity.ts"

type FixtureCleanupPrismaClient = Pick<PrismaClient, "backgroundCreditEntry" | "backgroundCreditWallet" | "commerceEvent" | "user">
type QaEnvironment = Record<string, string | undefined>

/**
 * Removes only real provisioning records created for one browser fixture. The
 * order releases restrictive User and Wallet foreign keys without sweeping
 * unrelated commerce or account records from the disposable QA database.
 */
export async function removeBrowserAdminFixtureRecords(input: {
  prismaClient: FixtureCleanupPrismaClient
  projectName: string
  environment?: QaEnvironment
}) {
  requireBrowserAdminFixtureQaAuthorization(input.environment)
  const identity = createBrowserAdminFixtureIdentity(input.projectName)
  const userIds = [identity.operator.id, identity.target.id]

  await input.prismaClient.commerceEvent.deleteMany({ where: { userId: { in: userIds } } })
  await input.prismaClient.backgroundCreditEntry.deleteMany({ where: { userId: { in: userIds } } })
  await input.prismaClient.backgroundCreditWallet.deleteMany({ where: { userId: { in: userIds } } })
  await input.prismaClient.user.deleteMany({ where: { id: { in: userIds } } })
}
