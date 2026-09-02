import type { Prisma } from "@prisma/client"
import { isAdminEmail } from "@/lib/auth-env"
import { buildAccountCapabilities, highestRole as highestAccountRole, normalizeRoleAssignments } from "@/lib/account-permissions"
import { runCommerceTransaction } from "@/lib/commerce/transactions"
import { buildEntitlements, loadActiveTemporaryGrants } from "@/lib/membership"
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

/**
 * Refreshes verified identity and role state after Google authentication.
 * Repeat sign-ins never open a background-credit provisioning transaction.
 */
export async function ensureGoogleUserState(userId: string, email?: string | null) {
  await runCommerceTransaction(prisma, async (txValue) => {
    const tx = txValue as Prisma.TransactionClient
    const updateResult = await tx.user.updateMany({
      where: { id: userId },
      data: { emailVerified: new Date() },
    })

    if (updateResult.count > 0) {
      await ensureUserRole(userId, email, tx)
    }
  })
}

/**
 * Loads the request-time account snapshot used by authentication. Full-Admin
 * features come only from a verified persisted role, never from stale session
 * claims, and remain separate from paid membership level. The request-time
 * snapshot is read-only with respect to background-credit provisioning.
 */
export async function getUserAuthState(
  userId: string,
  database: AuthDatabase = prisma,
  loadTemporaryGrants: typeof loadActiveTemporaryGrants = loadActiveTemporaryGrants,
) {
  // Capture one boundary for both the database predicate and defensive pure
  // resolver so a grant cannot change state midway through one auth refresh.
  const now = new Date()
  const [user, temporaryGrants] = await Promise.all([database.user.findUnique({
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
  }), loadTemporaryGrants(database, userId, now)])

  const roleAssignments = normalizeRoleAssignments(user?.roles.map((role) => ({
    role: role.role,
    status: role.status,
  })) ?? [{ role: "USER", status: "VERIFIED" }]) as Array<{ role: AccountRole; status: VerificationStatus }>
  const roles = roleAssignments.map((role) => role.role)

  const hasVerifiedAdminRole = roleAssignments.some((assignment) => (
    assignment.role === "ADMIN" && assignment.status === "VERIFIED"
  ))
  if (user?.email && isAdminEmail(user.email) && !hasVerifiedAdminRole) {
    await ensureUserRole(userId, user.email, database)
    const persistedAdminRole = await database.userRole.findUnique({
      where: { userId_role: { userId, role: "ADMIN" } },
      select: { role: true, status: true },
    })
    if (persistedAdminRole?.role === "ADMIN" && persistedAdminRole.status === "VERIFIED") {
      if (!roles.includes(persistedAdminRole.role)) {
        roles.push(persistedAdminRole.role)
      }
      roleAssignments.push(persistedAdminRole)
    }
  }
  const adminAccess = roleAssignments.some((assignment) => (
    assignment.role === "ADMIN" && assignment.status === "VERIFIED"
  ))
  const entitlements = buildEntitlements({
    adminAccess,
    subscriptions: user?.membershipSubscriptions ?? [],
    studentAccess: user?.studentAccess ?? null,
    temporaryGrants,
    now,
  })

  return {
    authSessionVersion: user?.authSessionVersion,
    role: highestRole(roleAssignments),
    roles,
    roleAssignments,
    capabilities: buildAccountCapabilities(roleAssignments, {
      features: entitlements.features,
      hostedClinicalSyncEnabled: isHostedClinicalSyncEnabled(),
    }),
    featureKeys: entitlements.features,
    emailVerified: Boolean(user?.emailVerified),
    twoFactorEnabled: Boolean(user?.twoFactorSecret?.enabledAt),
  }
}
