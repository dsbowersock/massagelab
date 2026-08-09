import type { Prisma, PrismaClient } from "@prisma/client"
import { buildAccountCapabilities, normalizeRoleAssignments } from "../account-permissions.js"
import {
  SUPPORTER_AMOUNT_CHOICES,
  buildEntitlements,
  getConfiguredMembershipOptions,
} from "../membership.js"

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
  environment?: NodeJS.ProcessEnv
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
    image: safeImageReference(user.image),
    emailVerified: Boolean(user.emailVerified),
    profile: user.profile,
    practices: boundedCollection(
      user.practiceMemberships.map(({ role, practice }) => ({ role, practice })),
      user._count.practiceMemberships,
    ),
    credentials: boundedCollection(user.credentialVerifications.map((credential) => ({
      ...credential,
      checkedAt: dateValue(credential.checkedAt),
      verifiedAt: dateValue(credential.verifiedAt),
      expiresAt: dateValue(credential.expiresAt),
    })), user._count.credentialVerifications),
    learning: {
      progressCount: user._count.learningProgress,
      studySessionCount: user._count.flashcardStudySessions,
      achievementCount: user._count.achievements,
    },
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
  const roles = normalizeRoleEvidence(user.roles)
  const recentEntries = user.backgroundCreditWallet?.entries ?? []

  return result("access", user, {
    roles,
    features: entitlements.featureDetails.map((feature) => ({ ...feature, expiresAt: dateValue(feature.expiresAt) })),
    capabilities: buildAccountCapabilities(roles, { features: entitlements.features }),
    subscriptions: boundedCollection(user.membershipSubscriptions.map((subscription) => ({
      membershipLevel: subscription.membershipLevel,
      status: subscription.status,
      currentPeriodEnd: dateValue(subscription.currentPeriodEnd),
    })), user._count.membershipSubscriptions),
    wallet: { balance: user.backgroundCreditWallet?.balance ?? 0, recentEntries: recentEntries.map(withDate("createdAt")) },
    ownership: boundedCollection(user.backgroundOwnerships.map((ownership) => ({
      ...ownership,
      acquiredAt: dateValue(ownership.acquiredAt),
      statusChangedAt: dateValue(ownership.statusChangedAt),
    })), user._count.backgroundOwnerships),
  })
}

/** Loads local subscription and commerce aggregates only; processor identifiers and payment details remain excluded. */
export async function loadAdminUserBilling(input: { prismaClient: DetailPrismaClient; userId: string; environment?: NodeJS.ProcessEnv }): Promise<AdminUserDetailSectionResult | null> {
  const user = await input.prismaClient.user.findUnique({ where: { id: input.userId }, select: BILLING_SELECT })
  if (!user) return null
  const configuredOptions = getConfiguredMembershipOptions(input.environment ?? process.env)
  return result("billing", user, {
    subscriptions: boundedCollection(user.membershipSubscriptions.map((subscription) => ({
      membershipLevel: subscription.membershipLevel,
      status: subscription.status,
      currentPeriodEnd: dateValue(subscription.currentPeriodEnd),
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      lastLocalSyncAt: dateValue(subscription.updatedAt),
      pricing: supporterPricingEvidence(subscription.stripePriceId, configuredOptions),
    })), user._count.membershipSubscriptions),
    commerce: {
      totalOrderCount: user._count.commerceOrders,
      truncated: user._count.commerceOrders > user.commerceOrders.length,
      recentOrders: user.commerceOrders.map((order) => {
        const disputes = order.payments.flatMap((payment) => payment.disputes)
        const sampledDisputeCount = order.payments.reduce((total, payment) => total + payment._count.disputes, 0)
        const paymentsTruncated = order._count.payments > order.payments.length
        return {
          status: order.status,
          fulfillmentStatus: order.fulfillmentStatus,
          currency: order.currency,
          subtotalCents: order.subtotalCents,
          taxCents: order.taxCents,
          totalCents: order.totalCents,
          failureCode: order.failureCode,
          createdAt: dateValue(order.createdAt),
          detailHref: `/admin/commerce/${encodeURIComponent(order.id)}`,
          reconciliationState: commerceReconciliationState(order),
          items: boundedCollection(order.items, order._count.items),
          refunds: boundedCollection(order.refunds.map((refund) => ({
            ...refund,
            processedAt: dateValue(refund.processedAt),
            createdAt: dateValue(refund.createdAt),
          })), order._count.refunds),
          disputes: boundedCollection(disputes.map((dispute) => ({
            ...dispute,
            openedAt: dateValue(dispute.openedAt),
            closedAt: dateValue(dispute.closedAt),
          })), paymentsTruncated ? null : sampledDisputeCount, {
            lowerBound: sampledDisputeCount,
            truncated: paymentsTruncated || sampledDisputeCount > disputes.length,
          }),
        }
      }),
    },
  })
}

/** Loads provider labels and state booleans, then counts sessions without reading a session record or token. */
export async function loadAdminUserSecurity(input: { prismaClient: DetailPrismaClient; userId: string; now?: Date }): Promise<AdminUserDetailSectionResult | null> {
  const user = await input.prismaClient.user.findUnique({ where: { id: input.userId }, select: SECURITY_SELECT })
  if (!user) return null
  const activeSessionCount = await input.prismaClient.session.count({
    where: { userId: input.userId, expires: { gt: input.now ?? new Date() } },
  })
  const providerItems = [...new Set(user.accounts.map((account) => account.provider))].sort()
  const connectionsTruncated = user._count.accounts > user.accounts.length
  return result("security", user, {
    providers: {
      items: providerItems,
      total: connectionsTruncated ? null : providerItems.length,
      totalState: connectionsTruncated ? "UNKNOWN" : "KNOWN",
      truncated: connectionsTruncated,
    },
    connections: { shown: user.accounts.length, total: user._count.accounts, truncated: connectionsTruncated },
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
        intentId: activity.adminAction.emailIntent.id,
        kind: activity.adminAction.emailIntent.kind,
        status: activity.adminAction.emailIntent.status,
        failureCode: activity.adminAction.emailIntent.failureCode,
        attemptCount: activity.adminAction.emailIntent.attemptCount,
        lastAttemptAt: dateValue(activity.adminAction.emailIntent.lastAttemptAt),
        deliveredAt: dateValue(activity.adminAction.emailIntent.deliveredAt),
      } : null,
    })),
  })
}

const TARGET_SELECT = { id: true, name: true, email: true } satisfies Prisma.UserSelect
const OVERVIEW_SELECT = {
  ...TARGET_SELECT, image: true, emailVerified: true,
  profile: { select: { displayName: true, therapistName: true, therapistLocation: true } },
  practiceMemberships: {
    select: { role: true, practice: { select: { id: true, name: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 25,
  },
  credentialVerifications: {
    select: {
      kind: true,
      status: true,
      jurisdictionCode: true,
      credentialNumber: true,
      issuingAuthority: true,
      displayLabel: true,
      sourceType: true,
      checkedAt: true,
      verifiedAt: true,
      expiresAt: true,
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: 25,
  },
  _count: { select: { learningProgress: true, flashcardStudySessions: true, achievements: true, practiceMemberships: true, credentialVerifications: true } },
} satisfies Prisma.UserSelect
const ACCESS_SELECT = {
  ...TARGET_SELECT,
  roles: {
    select: { role: true, status: true, source: true, verifiedAt: true, expiresAt: true, revokedAt: true },
    orderBy: [{ role: "asc" }, { status: "asc" }],
  },
  membershipSubscriptions: {
    select: { status: true, membershipLevel: true, currentPeriodEnd: true },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: 25,
  },
  studentAccess: { select: { studentStatus: true, studentAccessExpiresAt: true, eligibleForTherapistDiscount: true } },
  backgroundCreditWallet: { select: { balance: true, entries: { select: { type: true, delta: true, balanceAfter: true, createdAt: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 10 } } },
  backgroundOwnerships: {
    select: { backgroundKey: true, source: true, status: true, acquiredAt: true, statusChangedAt: true },
    orderBy: [{ acquiredAt: "desc" }, { id: "desc" }],
    take: 25,
  },
  _count: { select: { membershipSubscriptions: true, backgroundOwnerships: true } },
} satisfies Prisma.UserSelect
const BILLING_SELECT = {
  ...TARGET_SELECT,
  membershipSubscriptions: {
    where: { membershipLevel: "SUPPORTER" },
    select: { membershipLevel: true, status: true, stripePriceId: true, currentPeriodEnd: true, cancelAtPeriodEnd: true, updatedAt: true },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: 25,
  },
  commerceOrders: {
    select: {
      id: true,
      status: true,
      fulfillmentStatus: true,
      currency: true,
      subtotalCents: true,
      taxCents: true,
      totalCents: true,
      failureCode: true,
      createdAt: true,
      items: {
        select: { displayName: true, fulfillmentStatus: true, lineTotalCents: true, currency: true },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 25,
      },
      refunds: {
        select: { status: true, amountCents: true, currency: true, reasonCode: true, failureCode: true, processedAt: true, createdAt: true },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 25,
      },
      payments: {
        select: {
          disputes: {
            select: { status: true, amountCents: true, currency: true, reasonCode: true, openedAt: true, closedAt: true },
            orderBy: [{ openedAt: "desc" }, { id: "desc" }],
            take: 25,
          },
          _count: { select: { disputes: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 25,
      },
      _count: { select: { items: true, refunds: true, payments: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 100,
  },
  _count: { select: { membershipSubscriptions: { where: { membershipLevel: "SUPPORTER" } }, commerceOrders: true } },
} satisfies Prisma.UserSelect
const SECURITY_SELECT = {
  ...TARGET_SELECT,
  accounts: { select: { provider: true }, orderBy: [{ provider: "asc" }, { id: "asc" }], take: 25 },
  passwordCredential: { select: { id: true } },
  twoFactorSecret: { select: { enabledAt: true } },
  _count: { select: { accounts: true } },
} satisfies Prisma.UserSelect
const ACTIVITY_SELECT = {
  ...TARGET_SELECT,
  accountActivities: {
    select: {
      title: true, explanation: true, effectiveValue: true, occurredAt: true,
      adminAction: { select: { actionKind: true, outcome: true, occurredAt: true, emailIntent: { select: { id: true, kind: true, status: true, failureCode: true, attemptCount: true, lastAttemptAt: true, deliveredAt: true } } } },
    }, orderBy: [{ occurredAt: "desc" }, { id: "desc" }], take: 50,
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

function boundedCollection<Item>(
  items: Item[],
  total: number | null,
  evidence: { lowerBound?: number; truncated?: boolean } = {},
) {
  return {
    items,
    ...(evidence.lowerBound === undefined ? {} : { shown: items.length }),
    total,
    ...(evidence.lowerBound === undefined ? {} : { lowerBound: evidence.lowerBound }),
    truncated: evidence.truncated ?? (total !== null && total > items.length),
  }
}

/** Allows only ordinary web/root-relative image references into the Admin projection. */
function safeImageReference(value: string | null) {
  if (!value || value.length > 2_048) return null
  if (value.startsWith("/")) return value
  try {
    const parsed = new URL(value)
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? value : null
  } catch {
    return null
  }
}

/**
 * Normalizes retired role values through the shared compatibility owner, then
 * retains one deterministic modern evidence row for each role/status pair.
 */
function normalizeRoleEvidence(roles: Array<{
  role: string
  status: string
  source: string
  verifiedAt: Date | null
  expiresAt: Date | null
  revokedAt: Date | null
}>) {
  return normalizeRoleAssignments(roles).map((assignment) => {
    const candidates = roles.filter((role) => {
      const normalized = normalizeRoleAssignments([role])[0]
      return normalized?.role === assignment.role && normalized.status === assignment.status
    })
    const evidence = candidates.find((candidate) => candidate.role === assignment.role) ?? candidates[0]
    return {
      ...assignment,
      source: evidence?.source ?? "unknown",
      verifiedAt: dateValue(evidence?.verifiedAt),
      expiresAt: dateValue(evidence?.expiresAt),
      revokedAt: dateValue(evidence?.revokedAt),
    }
  })
}

function supporterPricingEvidence(
  stripePriceId: string | null,
  configuredOptions: ReturnType<typeof getConfiguredMembershipOptions>,
) {
  const option = stripePriceId
    ? configuredOptions.find((candidate) => candidate.priceId === stripePriceId && candidate.membershipLevel === "SUPPORTER")
    : null
  const choice = option
    ? SUPPORTER_AMOUNT_CHOICES.find((candidate) => candidate.id === option.supporterAmountChoiceId)
    : null
  if (!option || !choice) {
    return { state: "UNAVAILABLE", amountChoiceId: null, amountCents: null, interval: null }
  }
  return {
    state: "KNOWN",
    amountChoiceId: choice.id,
    amountCents: option.interval === "year" ? choice.yearAmountCents : choice.monthAmountCents,
    interval: option.interval,
  }
}

/** Describes only complete or sampled local warning evidence; truncated clean samples remain explicitly unknown. */
function commerceReconciliationState(order: {
  status: string
  failureCode: string | null
  refunds: Array<{ status: string }>
  payments: Array<{ disputes: Array<{ status: string }>; _count: { disputes: number } }>
  _count: { refunds: number; payments: number }
}) {
  if (order.status === "REVIEW_REQUIRED") return "REVIEW_REQUIRED"
  if (order.refunds.some((refund) => refund.status === "PENDING")) return "PENDING_REFUND"
  if (order.payments.some((payment) => payment.disputes.some((dispute) => dispute.status === "OPEN"))) return "OPEN_DISPUTE"
  if (order.failureCode) return "FAILURE_RECORDED"
  const evidenceTruncated = order._count.refunds > order.refunds.length
    || order._count.payments > order.payments.length
    || order.payments.some((payment) => payment._count.disputes > payment.disputes.length)
  if (evidenceTruncated) return "UNKNOWN"
  return "NOT_FLAGGED"
}
