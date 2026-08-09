import type { Prisma, PrismaClient } from "@prisma/client"
import { buildEntitlements } from "../membership.js"

export const ADMIN_USER_DETAIL_SECTIONS = ["overview", "access", "billing", "security", "activity"] as const

export type AdminUserDetailSection = (typeof ADMIN_USER_DETAIL_SECTIONS)[number]

export type AdminUserDetailSectionResult = {
  section: AdminUserDetailSection
  target: { id: string; name: string | null; email: string | null }
  data: Record<string, unknown>
}

type DetailPrismaClient = Pick<PrismaClient, "user" | "session">

/** Converts an untrusted detail-tab value into the initial safe section. */
export function parseAdminUserDetailSection(value: string | undefined): AdminUserDetailSection {
  return ADMIN_USER_DETAIL_SECTIONS.includes(value as AdminUserDetailSection)
    ? value as AdminUserDetailSection
    : "overview"
}

/**
 * Loads exactly one account-detail projection. These selective reads form the
 * privacy boundary: callers must not replace them with an eager User include.
 */
export async function getAdminUserDetailSection(input: {
  prismaClient: DetailPrismaClient
  userId: string
  section: AdminUserDetailSection
  now?: Date
}): Promise<AdminUserDetailSectionResult | null> {
  switch (input.section) {
    case "overview": return loadAdminUserOverview(input)
    case "access": return loadAdminUserAccess(input)
    case "billing": return loadAdminUserBilling(input)
    case "security": return loadAdminUserSecurity(input)
    case "activity": return loadAdminUserActivity(input)
  }
}

/** Loads profile, practice, credential-status, and learning aggregates without credential evidence or clinical records. */
export async function loadAdminUserOverview(input: { prismaClient: DetailPrismaClient; userId: string }): Promise<AdminUserDetailSectionResult | null> {
  const user = await input.prismaClient.user.findUnique({
    where: { id: input.userId }, select: OVERVIEW_SELECT,
  })
  if (!user) return null
  return result("overview", user, {
    emailVerified: Boolean(user.emailVerified),
    profile: user.profile,
    practices: user.practiceMemberships.map(({ role, practice }) => ({ role, practice })),
    credentials: user.credentialVerifications,
    learning: { progressCount: user._count.learningProgress, studySessionCount: user._count.flashcardStudySessions },
  })
}

/** Resolves feature keys from persisted sources, while retaining source and expiration evidence for an operator. */
export async function loadAdminUserAccess(input: { prismaClient: DetailPrismaClient; userId: string; now?: Date }): Promise<AdminUserDetailSectionResult | null> {
  const user = await input.prismaClient.user.findUnique({ where: { id: input.userId }, select: ACCESS_SELECT })
  if (!user) return null
  const entitlements = buildEntitlements({
    subscriptions: user.membershipSubscriptions,
    studentAccess: user.studentAccess,
    now: input.now,
  })
  const featureSource = entitlements.paidLevel ?? (entitlements.studentStatus === "ACTIVE" ? "STUDENT" : "FREE")
  const expiresAt = user.membershipSubscriptions
    .filter((subscription) => ["active", "trialing"].includes(subscription.status.toLowerCase()))
    .map((subscription) => subscription.currentPeriodEnd)
    .filter((value): value is Date => Boolean(value))
    .sort((left, right) => right.getTime() - left.getTime())[0] ?? user.studentAccess?.studentAccessExpiresAt ?? null
  const recentEntries = user.backgroundCreditWallet?.entries ?? []

  return result("access", user, {
    roles: user.roles,
    features: entitlements.features.map((key) => ({ key, source: featureSource, expiresAt: dateValue(expiresAt) })),
    wallet: { balance: user.backgroundCreditWallet?.balance ?? 0, recentEntries: recentEntries.map(withDate("createdAt")) },
    ownership: ownershipSummary(user.backgroundOwnerships),
  })
}

/** Loads local subscription and commerce aggregates only; processor identifiers and payment details remain excluded. */
export async function loadAdminUserBilling(input: { prismaClient: DetailPrismaClient; userId: string }): Promise<AdminUserDetailSectionResult | null> {
  const user = await input.prismaClient.user.findUnique({ where: { id: input.userId }, select: BILLING_SELECT })
  if (!user) return null
  const byStatus: Record<string, number> = {}
  let totalCents = 0
  for (const order of user.commerceOrders) {
    byStatus[order.status] = (byStatus[order.status] ?? 0) + 1
    totalCents += order.totalCents
  }
  return result("billing", user, {
    subscriptions: user.membershipSubscriptions.map((subscription) => ({ ...subscription, currentPeriodEnd: dateValue(subscription.currentPeriodEnd) })),
    commerce: { orderCount: user.commerceOrders.length, totalCents, byStatus },
  })
}

/** Loads provider labels and state booleans, then counts sessions without reading a session record or token. */
export async function loadAdminUserSecurity(input: { prismaClient: DetailPrismaClient; userId: string }): Promise<AdminUserDetailSectionResult | null> {
  const user = await input.prismaClient.user.findUnique({ where: { id: input.userId }, select: SECURITY_SELECT })
  if (!user) return null
  const activeSessionCount = await input.prismaClient.session.count({ where: { userId: input.userId } })
  return result("security", user, {
    providers: [...new Set(user.accounts.map((account) => account.provider))].sort(),
    passwordConfigured: Boolean(user.passwordCredential),
    twoFactorEnabled: Boolean(user.twoFactorSecret?.enabledAt),
    activeSessionCount,
  })
}

/** Loads the latest fifty target-visible activity explanations and safe delivery/outcome states. */
export async function loadAdminUserActivity(input: { prismaClient: DetailPrismaClient; userId: string }): Promise<AdminUserDetailSectionResult | null> {
  const user = await input.prismaClient.user.findUnique({ where: { id: input.userId }, select: ACTIVITY_SELECT })
  if (!user) return null
  return result("activity", user, {
    entries: user.accountActivities.map((activity) => ({
      title: activity.title,
      explanation: activity.explanation,
      effectiveValue: activity.effectiveValue,
      occurredAt: dateValue(activity.occurredAt),
      action: {
        kind: activity.adminAction.actionKind,
        outcome: activity.adminAction.outcome,
        occurredAt: dateValue(activity.adminAction.occurredAt),
      },
      email: activity.adminAction.emailIntent ? {
        kind: activity.adminAction.emailIntent.kind,
        status: activity.adminAction.emailIntent.status,
        deliveredAt: dateValue(activity.adminAction.emailIntent.deliveredAt),
      } : null,
    })),
  })
}

const TARGET_SELECT = { id: true, name: true, email: true } satisfies Prisma.UserSelect
const OVERVIEW_SELECT = {
  ...TARGET_SELECT, emailVerified: true,
  profile: { select: { displayName: true, therapistName: true, therapistLocation: true } },
  practiceMemberships: { select: { role: true, practice: { select: { id: true, name: true } } } },
  credentialVerifications: { select: { kind: true, status: true, jurisdictionCode: true, issuingAuthority: true, displayLabel: true, expiresAt: true } },
  _count: { select: { learningProgress: true, flashcardStudySessions: true } },
} satisfies Prisma.UserSelect
const ACCESS_SELECT = {
  ...TARGET_SELECT,
  roles: { select: { role: true, status: true, source: true, verifiedAt: true, expiresAt: true, revokedAt: true } },
  membershipSubscriptions: { select: { status: true, membershipLevel: true, currentPeriodEnd: true } },
  studentAccess: { select: { studentStatus: true, studentAccessExpiresAt: true, eligibleForTherapistDiscount: true } },
  backgroundCreditWallet: { select: { balance: true, entries: { select: { type: true, delta: true, balanceAfter: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 10 } } },
  backgroundOwnerships: { select: { status: true } },
} satisfies Prisma.UserSelect
const BILLING_SELECT = {
  ...TARGET_SELECT,
  membershipSubscriptions: { select: { membershipLevel: true, status: true, currentPeriodEnd: true, cancelAtPeriodEnd: true }, orderBy: { updatedAt: "desc" } },
  commerceOrders: { select: { status: true, totalCents: true }, orderBy: { createdAt: "desc" }, take: 100 },
} satisfies Prisma.UserSelect
const SECURITY_SELECT = {
  ...TARGET_SELECT,
  accounts: { select: { provider: true } },
  passwordCredential: { select: { id: true } },
  twoFactorSecret: { select: { enabledAt: true } },
} satisfies Prisma.UserSelect
const ACTIVITY_SELECT = {
  ...TARGET_SELECT,
  accountActivities: {
    select: {
      title: true, explanation: true, effectiveValue: true, occurredAt: true,
      adminAction: { select: { actionKind: true, outcome: true, occurredAt: true, emailIntent: { select: { kind: true, status: true, deliveredAt: true } } } },
    }, orderBy: { occurredAt: "desc" }, take: 50,
  },
} satisfies Prisma.UserSelect

function result(section: AdminUserDetailSection, user: { id: string; name: string | null; email: string | null }, data: Record<string, unknown>): AdminUserDetailSectionResult {
  return { section, target: { id: user.id, name: user.name, email: user.email }, data }
}

function dateValue(value: Date | null | undefined) {
  return value?.toISOString() ?? null
}

function withDate<Key extends string>(key: Key) {
  return <Row extends Record<Key, Date>>(row: Row) => ({ ...row, [key]: dateValue(row[key]) })
}

function ownershipSummary(ownerships: Array<{ status: string }>) {
  const byStatus: Record<string, number> = {}
  for (const ownership of ownerships) byStatus[ownership.status] = (byStatus[ownership.status] ?? 0) + 1
  return { total: ownerships.length, byStatus }
}
