import { isAdminEmail } from "@/lib/auth-env"
import { buildAccountCapabilities } from "@/lib/account-permissions"
import { buildEntitlements } from "@/lib/membership"
import { isHostedClinicalSyncEnabled } from "@/lib/phi-sync"
import type { AccountRole, VerificationStatus } from "@/lib/domain-types"
import { prisma } from "@/lib/prisma"

export function highestRole(roles: AccountRole[]): AccountRole {
  if (roles.includes("ADMIN")) return "ADMIN"
  if (roles.includes("EDITOR")) return "EDITOR"
  if (roles.includes("LICENSED_THERAPIST")) return "LICENSED_THERAPIST"
  if (roles.includes("STUDENT")) return "STUDENT"
  if (roles.includes("CLIENT")) return "CLIENT"
  return "USER"
}

async function upsertVerifiedRole(userId: string, role: AccountRole, source: string) {
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
      status: "VERIFIED",
      source,
      verifiedAt: new Date(),
    },
    update: {
      status: "VERIFIED",
      source,
      verifiedAt: new Date(),
      revokedAt: null,
    },
  })
}

export async function ensureUserRole(userId: string, email?: string | null) {
  await upsertVerifiedRole(userId, "USER", "system")

  if (isAdminEmail(email)) {
    await upsertVerifiedRole(userId, "ADMIN", "admin-email")
    return "ADMIN"
  }

  return "USER"
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
        select: { role: true, status: true },
      },
      membershipSubscriptions: {
        select: {
          status: true,
          membershipLevel: true,
          currentPeriodEnd: true,
        },
      },
      studentAccess: {
        select: {
          studentStatus: true,
          studentAccessExpiresAt: true,
          eligibleForTherapistDiscount: true,
        },
      },
      twoFactorSecret: {
        select: { enabledAt: true },
      },
    },
  })

  const roleAssignments = (user?.roles.map((role) => ({
    role: role.role,
    status: role.status,
  })) ?? [{ role: "USER", status: "VERIFIED" }]) as Array<{ role: AccountRole; status: VerificationStatus }>
  const roles = roleAssignments.map((role) => role.role)

  if (user?.email && isAdminEmail(user.email) && !roles.includes("ADMIN")) {
    await ensureUserRole(userId, user.email)
    roles.push("ADMIN")
    roleAssignments.push({ role: "ADMIN", status: "VERIFIED" })
  }

  return {
    role: highestRole(roles),
    roles,
    roleAssignments,
    capabilities: buildAccountCapabilities(roleAssignments, {
      features: buildEntitlements({
        subscriptions: user?.membershipSubscriptions ?? [],
        studentAccess: user?.studentAccess ?? null,
      }).features,
      hostedClinicalSyncEnabled: isHostedClinicalSyncEnabled(),
    }),
    emailVerified: Boolean(user?.emailVerified),
    twoFactorEnabled: Boolean(user?.twoFactorSecret?.enabledAt),
  }
}
