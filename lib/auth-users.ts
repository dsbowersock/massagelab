import type { Prisma } from "@prisma/client"
import { isAdminEmail } from "@/lib/auth-env"
import { buildAccountCapabilities, highestRole as highestAccountRole, normalizeRoleAssignments } from "@/lib/account-permissions"
import { ensureVerifiedUserBackgroundCredits } from "@/lib/commerce/credit-service"
import { runCommerceTransaction } from "@/lib/commerce/transactions"
import { buildEntitlements } from "@/lib/membership"
import { isHostedClinicalSyncEnabled } from "@/lib/phi-sync"
import type { AccountRole, VerificationStatus } from "@/lib/domain-types"
import { prisma } from "@/lib/prisma"

type AuthDatabase = typeof prisma | Prisma.TransactionClient
type AccountRoleAssignment = { role: AccountRole; status: VerificationStatus }

export function highestRole(roles: Array<AccountRole | AccountRoleAssignment>): AccountRole {
  return highestAccountRole(roles) as AccountRole
}

async function upsertVerifiedRole(database: AuthDatabase, userId: string, role: AccountRole, source: string) {
  await database.userRole.upsert({
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

export async function ensureUserRole(userId: string, email?: string | null, database: AuthDatabase = prisma) {
  await upsertVerifiedRole(database, userId, "USER", "system")

  if (isAdminEmail(email)) {
    await upsertVerifiedRole(database, userId, "ADMIN", "admin-email")
    return "ADMIN"
  }

  return "USER"
}

export async function ensureGoogleUserState(userId: string, email?: string | null) {
  await runCommerceTransaction(prisma, async (txValue) => {
    const tx = txValue as Prisma.TransactionClient
    const updateResult = await tx.user.updateMany({
      where: { id: userId },
      data: { emailVerified: new Date() },
    })

    if (updateResult.count > 0) {
      await ensureUserRole(userId, email, tx)
      await ensureVerifiedUserBackgroundCredits(tx, userId)
    }
  })
}

export async function getUserAuthState(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      emailVerified: true,
      authSessionVersion: true,
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

  const roleAssignments = normalizeRoleAssignments(user?.roles.map((role) => ({
    role: role.role,
    status: role.status,
  })) ?? [{ role: "USER", status: "VERIFIED" }]) as Array<{ role: AccountRole; status: VerificationStatus }>
  const roles = roleAssignments.map((role) => role.role)

  // Safe deployment repair: the service independently reloads verification and
  // remains idempotent when this account state is loaded repeatedly.
  if (user?.emailVerified) {
    await ensureVerifiedUserBackgroundCredits(prisma, userId)
  }

  if (user?.email && isAdminEmail(user.email) && !roles.includes("ADMIN")) {
    await ensureUserRole(userId, user.email)
    roles.push("ADMIN")
    roleAssignments.push({ role: "ADMIN", status: "VERIFIED" })
  }

  return {
    authSessionVersion: user?.authSessionVersion,
    role: highestRole(roleAssignments),
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
