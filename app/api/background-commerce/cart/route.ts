import type { PrismaClient } from "@prisma/client"
import {
  addCommerceCartItem,
  getCommerceCartSnapshot,
  removeCommerceCartItem,
  type CartMutationInput,
  type CartServiceInput,
  type CommerceCartSnapshot,
} from "../../../../lib/commerce/cart-service.ts"
import { COMMERCE_ERROR_CODES, CommerceError } from "../../../../lib/commerce/errors.ts"
import {
  commerceApiErrorResponse,
  privateCommerceJson,
  requireVerifiedCommerceRouteUser,
  type CommerceRouteIdentityDependencies,
} from "../../../../lib/commerce/snapshot-service.ts"

export const runtime = "nodejs"

type CartDependencies = CommerceRouteIdentityDependencies & {
  getCart: (input: Omit<CartServiceInput, "prismaClient">) => Promise<CommerceCartSnapshot>
  addItem: (input: Omit<CartMutationInput, "prismaClient">) => Promise<CommerceCartSnapshot>
  removeItem: (input: Omit<CartMutationInput, "prismaClient">) => Promise<CommerceCartSnapshot>
}

async function appPrisma(): Promise<PrismaClient> {
  return (await import("../../../../lib/prisma.ts")).prisma
}

function defaultDependencies(): CartDependencies {
  return {
    getSessionUserId: async () => (await (await import("../../../../auth.ts")).getCurrentSession())?.user?.id ?? null,
    loadUser: async (userId) => (await appPrisma()).user.findUnique({ where: { id: userId }, select: { id: true, emailVerified: true } }),
    getCart: async (input) => getCommerceCartSnapshot({ prismaClient: await appPrisma(), ...input }),
    addItem: async (input) => addCommerceCartItem({ prismaClient: await appPrisma(), ...input }),
    removeItem: async (input) => removeCommerceCartItem({ prismaClient: await appPrisma(), ...input }),
  }
}

async function jsonBody(request: Request): Promise<Record<string, unknown>> {
  const value = await request.json().catch(() => null)
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

export function createBackgroundCommerceCartHandlers(overrides: Partial<CartDependencies> = {}) {
  const dependencies = { ...defaultDependencies(), ...overrides }
  const withUser = (operation: (userId: string, request: Request) => Promise<CommerceCartSnapshot>) => (
    async (request: Request) => {
      try {
        const user = await requireVerifiedCommerceRouteUser(dependencies)
        return privateCommerceJson(await operation(user.id, request))
      } catch (error) {
        return commerceApiErrorResponse(error)
      }
    }
  )
  const mutationInput = async (userId: string, request: Request): Promise<Omit<CartMutationInput, "prismaClient">> => {
    const body = await jsonBody(request)
    const productKey = typeof body.backgroundId === "string" ? body.backgroundId.trim() : ""
    if (!productKey) throw new CommerceError({ code: COMMERCE_ERROR_CODES.CATALOG_UNAVAILABLE })
    return { userId, productType: "background", productKey }
  }
  return {
    GET: withUser((userId) => dependencies.getCart({ userId })),
    POST: withUser(async (userId, request) => dependencies.addItem(await mutationInput(userId, request))),
    DELETE: withUser(async (userId, request) => dependencies.removeItem(await mutationInput(userId, request))),
  }
}

const handlers = createBackgroundCommerceCartHandlers()
export const GET = handlers.GET
export const POST = handlers.POST
export const DELETE = handlers.DELETE
