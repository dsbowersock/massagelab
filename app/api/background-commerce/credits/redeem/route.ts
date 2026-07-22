import type { PrismaClient } from "@prisma/client"
import { redeemBackgroundCredit } from "../../../../../lib/commerce/background-access.ts"
import { COMMERCE_ERROR_CODES, CommerceError } from "../../../../../lib/commerce/errors.ts"
import {
  commerceApiErrorResponse,
  privateCommerceJson,
  requireVerifiedCommerceRouteUser,
  type CommerceRouteIdentityDependencies,
} from "../../../../../lib/commerce/snapshot-service.ts"

export const runtime = "nodejs"

type RedeemResult = { backgroundId: string; remainingCredits: number }
type RedeemDependencies = CommerceRouteIdentityDependencies & {
  redeem: (input: { userId: string; backgroundId: string; confirmationAccepted: true; idempotencyKey: string }) => Promise<RedeemResult>
}

async function appPrisma(): Promise<PrismaClient> {
  return (await import("../../../../../lib/prisma.ts")).prisma
}

function defaultDependencies(): RedeemDependencies {
  return {
    getSessionUserId: async () => (await (await import("../../../../../auth.ts")).getCurrentSession())?.user?.id ?? null,
    loadUser: async (userId) => (await appPrisma()).user.findUnique({ where: { id: userId }, select: { id: true, emailVerified: true } }),
    redeem: async (input) => redeemBackgroundCredit({ prismaClient: await appPrisma(), ...input }),
  }
}

async function jsonBody(request: Request): Promise<Record<string, unknown>> {
  const value = await request.json().catch(() => null)
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

export function createBackgroundCommerceRedeemPostHandler(
  overrides: Partial<RedeemDependencies> = {},
): (request: Request) => Promise<Response> {
  const dependencies = { ...defaultDependencies(), ...overrides }
  return async (request) => {
    try {
      const user = await requireVerifiedCommerceRouteUser(dependencies)
      const body = await jsonBody(request)
      const backgroundId = typeof body.backgroundId === "string" ? body.backgroundId.trim() : ""
      const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : ""
      if (!backgroundId) throw new CommerceError({ code: COMMERCE_ERROR_CODES.CATALOG_UNAVAILABLE })
      if (body.confirmationAccepted !== true) throw new CommerceError({ code: COMMERCE_ERROR_CODES.LEGAL_CONSENT_REQUIRED })
      if (!idempotencyKey) throw new CommerceError({ code: COMMERCE_ERROR_CODES.STALE_CONCURRENCY })
      return privateCommerceJson(await dependencies.redeem({
        userId: user.id, backgroundId, confirmationAccepted: true, idempotencyKey,
      }))
    } catch (error) {
      return commerceApiErrorResponse(error)
    }
  }
}

export const POST = createBackgroundCommerceRedeemPostHandler()
