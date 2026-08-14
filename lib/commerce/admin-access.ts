import { loadAdminActor, requireFullAdminUser } from "../admin/access.ts"

type AdminRoleRow = { role: string; status: string }
type LoadedAdminUser = {
  id: string
  name?: string | null
  email?: string | null
  emailVerified?: Date | null
  roles: AdminRoleRow[]
}

type AdminPrismaClient = {
  user: {
    findUnique(input: unknown): Promise<LoadedAdminUser | null>
  }
}

export type CommerceAdminUser = { id: string; accountLabel: string }

/** Reloads database verification and verified ADMIN authority without trusting JWT roles. */
export async function getCommerceAdminUser(input: {
  sessionUserId: string | null
  loadUser?: (userId: string) => Promise<LoadedAdminUser | null>
}): Promise<CommerceAdminUser | null> {
  const actor = input.loadUser
    ? await loadAdminActor({ prismaClient: loadUserAdapter(input.loadUser), sessionUserId: input.sessionUserId })
    : await loadDefaultAdminActor(input.sessionUserId)

  return actor?.canAdministerAccounts ? toCommerceAdminUser(actor) : null
}

/** Redirects server-rendered pages/actions only after fresh database authorization. */
export async function requireCommerceAdminUser(input?: {
  prismaClient: AdminPrismaClient
  sessionUser: { id?: string | null } | null
}): Promise<CommerceAdminUser> {
  if (input) {
    const admin = await requireFullAdminUser({
      prismaClient: sharedPrismaClient(input.prismaClient),
      sessionUserId: input.sessionUser?.id ?? null,
    })
    return toCommerceAdminUser(admin)
  }

  return toCommerceAdminUser(await requireFullAdminUser())
}

async function loadDefaultAdminActor(sessionUserId: string | null) {
  const { prisma } = await import("../prisma.ts")
  return loadAdminActor({ prismaClient: prisma, sessionUserId })
}

/** Bridges the legacy caller loader to the shared actor's narrow user lookup. */
function loadUserAdapter(loadUser: (userId: string) => Promise<LoadedAdminUser | null>) {
  return {
    user: {
      findUnique: ({ where }: { where: { id: string } }) => loadUser(where.id),
    },
  } as unknown as Parameters<typeof loadAdminActor>[0]["prismaClient"]
}

/** Adapts the longstanding structural caller contract to the shared Prisma guard. */
function sharedPrismaClient(prismaClient: AdminPrismaClient) {
  return prismaClient as unknown as Parameters<typeof loadAdminActor>[0]["prismaClient"]
}

function toCommerceAdminUser(actor: { id: string; accountLabel: string }): CommerceAdminUser {
  return { id: actor.id, accountLabel: actor.accountLabel }
}
