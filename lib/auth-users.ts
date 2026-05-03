import { isAdminEmail } from "@/lib/auth-env"
import type { AccountRole } from "@/lib/domain-types"
import { prisma } from "@/lib/prisma"

export function highestRole(roles: AccountRole[]): AccountRole {
  if (roles.includes("ADMIN")) return "ADMIN"
  if (roles.includes("EDITOR")) return "EDITOR"
  return "USER"
}

export async function ensureUserRole(userId: string, email?: string | null) {
  const role = isAdminEmail(email) ? "ADMIN" : "USER"

  await prisma.userRole.upsert({
    where: {
      userId_role: {
        userId,
        role,
      },
    },
    create: {
      userId,
      role,
    },
    update: {},
  })

  return role
}

export async function ensureGoogleUserState(userId: string, email?: string | null) {
  const updateResult = await prisma.user.updateMany({
    where: { id: userId },
    data: { emailVerified: new Date() },
  })

  if (updateResult.count > 0) {
    await ensureUserRole(userId, email)
  }
}

export async function getUserAuthState(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      emailVerified: true,
      roles: {
        select: { role: true },
      },
      twoFactorSecret: {
        select: { enabledAt: true },
      },
    },
  })

  const roles = (user?.roles.map((role) => role.role) ?? ["USER"]) as AccountRole[]

  if (user?.email && isAdminEmail(user.email) && !roles.includes("ADMIN")) {
    await ensureUserRole(userId, user.email)
    roles.push("ADMIN")
  }

  return {
    role: highestRole(roles),
    emailVerified: Boolean(user?.emailVerified),
    twoFactorEnabled: Boolean(user?.twoFactorSecret?.enabledAt),
  }
}
