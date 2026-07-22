import { canAdministerAccounts } from "../account-permissions.js"

type AdminRoleRow = { role: string; status: string }
type LoadedAdminUser = {
  id: string
  name?: string | null
  email?: string | null
  emailVerified?: Date | null
  roles: AdminRoleRow[]
}

export type CommerceAdminUser = { id: string; accountLabel: string }

async function defaultLoadUser(userId: string): Promise<LoadedAdminUser | null> {
  const { prisma } = await import("../prisma.ts")
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      roles: { select: { role: true, status: true } },
    },
  }) as Promise<LoadedAdminUser | null>
}

/** Reloads database verification and verified ADMIN authority without trusting JWT roles. */
export async function getCommerceAdminUser(input: {
  sessionUserId: string | null
  loadUser?: (userId: string) => Promise<LoadedAdminUser | null>
}): Promise<CommerceAdminUser | null> {
  if (!input.sessionUserId) return null
  const user = await (input.loadUser ?? defaultLoadUser)(input.sessionUserId)
  if (!user || user.emailVerified === null) return null
  const verifiedRoles = user.roles
    .filter((assignment) => assignment.status === "VERIFIED")
    .map((assignment) => assignment.role)
  if (!canAdministerAccounts(verifiedRoles)) return null

  return {
    id: user.id,
    accountLabel: user.name?.trim() || user.email?.trim() || `Account ${user.id}`,
  }
}

/** Redirects server-rendered pages/actions only after fresh database authorization. */
export async function requireCommerceAdminUser(input?: {
  prismaClient: { user: { findUnique(input: unknown): Promise<LoadedAdminUser | null> } }
  sessionUser: { id?: string | null } | null
}): Promise<CommerceAdminUser> {
  if (input) {
    const admin = await getCommerceAdminUser({
      sessionUserId: input.sessionUser?.id ?? null,
      loadUser: (userId) => input.prismaClient.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          emailVerified: true,
          roles: { select: { role: true, status: true } },
        },
      }),
    })
    if (!admin) throw new Error("Commerce administration requires verified ADMIN authority.")
    return admin
  }

  const [{ getCurrentSession }, { redirect }] = await Promise.all([
    import("../../auth.ts"),
    import("next/navigation"),
  ])
  const session = await getCurrentSession()
  const admin = await getCommerceAdminUser({ sessionUserId: session?.user?.id ?? null })
  if (!session?.user?.id) redirect("/login")
  if (!admin) redirect("/account")
  return admin as CommerceAdminUser
}
