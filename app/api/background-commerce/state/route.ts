import type { PrismaClient } from "@prisma/client"
import {
  commerceApiErrorResponse,
  getBackgroundCommerceSnapshot,
  privateCommerceJson,
  requireVerifiedCommerceRouteUser,
  type BackgroundCommerceSnapshot,
  type CommerceRouteIdentityDependencies,
} from "../../../../lib/commerce/snapshot-service.ts"

export const runtime = "nodejs"

type StateDependencies = CommerceRouteIdentityDependencies & {
  getSnapshot: (userId: string) => Promise<BackgroundCommerceSnapshot>
}

async function appPrisma(): Promise<PrismaClient> {
  return (await import("../../../../lib/prisma.ts")).prisma
}

function defaultDependencies(): StateDependencies {
  return {
    getSessionUserId: async () => (await (await import("../../../../auth.ts")).getCurrentSession())?.user?.id ?? null,
    loadUser: async (userId) => (await appPrisma()).user.findUnique({ where: { id: userId }, select: { id: true, emailVerified: true } }),
    getSnapshot: async (userId) => getBackgroundCommerceSnapshot({ prismaClient: await appPrisma(), userId }),
  }
}

/** Builds a testable GET endpoint without weakening its fresh database identity check. */
export function createBackgroundCommerceStateGetHandler(
  overrides: Partial<StateDependencies> = {},
): () => Promise<Response> {
  const dependencies = { ...defaultDependencies(), ...overrides }
  return async () => {
    try {
      const user = await requireVerifiedCommerceRouteUser(dependencies)
      return privateCommerceJson(await dependencies.getSnapshot(user.id))
    } catch (error) {
      return commerceApiErrorResponse(error)
    }
  }
}

export const GET = createBackgroundCommerceStateGetHandler()
