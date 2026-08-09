import type { Prisma, PrismaClient, Role, VerificationStatus } from "@prisma/client"
import { normalizeRoleAssignments } from "../account-permissions.js"

const ROLE_FILTER_VALUES = new Set([
  "USER",
  "STUDENT",
  "LICENSED_THERAPIST",
  "CLIENT",
  "EDITOR",
  "ANATOMY_REVIEWER",
  "ANATOMY_EDITOR",
  "ADMIN",
])
const SUBSCRIPTION_STATUS_FILTER_VALUES = new Set([
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "paused",
  "incomplete",
  "incomplete_expired",
  "canceled",
])
const ACTIVE_SUPPORTER_STATUSES = ["active", "trialing"]
const UNRESOLVED_EMAIL_STATUSES: Array<"PENDING" | "FAILED"> = ["PENDING", "FAILED"]

export type AdminUserDirectoryQuery = {
  query: string
  pageSize: number
  cursor: string | null
  emailVerified: "verified" | "unverified" | null
  role: string | null
  roleStatus: "verified" | "pending" | "rejected" | "revoked" | null
  subscriptionStatus: string | null
  creditState: "positive" | "zero" | null
  unresolvedIssue: "yes" | "no" | null
}

export type AdminUserDirectoryRow = {
  id: string
  name: string | null
  email: string | null
  emailVerified: boolean
  roles: Array<{ role: string; status: string }>
  subscriptionStatus: string | null
  creditBalance: number
  unresolvedIssueCount: number
}

type DirectoryPrismaClient = Pick<PrismaClient, "adminEmailIntent" | "commerceOrder" | "user">

/**
 * Normalizes the GET-only directory inputs before they influence a database
 * query. This is deliberately an allowlist: filters describe persisted domain
 * states, never arbitrary columns or relationship paths.
 */
export function parseUserDirectoryQuery(value: Record<string, string | undefined>): AdminUserDirectoryQuery {
  const query = (value.q ?? "").trim().slice(0, 100)
  const pageSize = clampPageSize(value.pageSize)
  const cursor = decodeCursor(value.cursor)
  const emailVerified = oneOf(value.emailVerified, ["verified", "unverified"] as const)
  const role = upperOneOf(value.role, ROLE_FILTER_VALUES)
  const roleStatus = oneOf(value.roleStatus, ["verified", "pending", "rejected", "revoked"] as const)
  const subscriptionStatus = lowerOneOf(value.subscriptionStatus, SUBSCRIPTION_STATUS_FILTER_VALUES)
  const creditState = oneOf(value.creditState, ["positive", "zero"] as const)
  const unresolvedIssue = oneOf(value.unresolvedIssue, ["yes", "no"] as const)

  return {
    query,
    pageSize,
    cursor,
    emailVerified,
    role,
    roleStatus,
    subscriptionStatus,
    creditState,
    unresolvedIssue,
  }
}

/**
 * Reads a bounded admin-only account page. The Prisma select intentionally
 * excludes authentication, provider, payment, metadata, and clinical fields;
 * callers receive only the operational row projection below.
 */
export async function listAdminUsers(input: {
  prismaClient: DirectoryPrismaClient
  input: Partial<AdminUserDirectoryQuery>
}) {
  const query = normalizeDirectoryQuery(input.input)
  const where = directoryWhere(query)
  const [rows, previousRows] = await Promise.all([
    input.prismaClient.user.findMany({
      where,
      select: ADMIN_USER_DIRECTORY_SELECT,
      orderBy: { id: "asc" },
      take: query.pageSize + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    }),
    query.cursor
      ? input.prismaClient.user.findMany({
        where: withPreviousCursorBoundary(where, query.cursor),
        select: { id: true },
        orderBy: { id: "desc" },
        take: query.pageSize,
      })
      : Promise.resolve([]),
  ])
  const hasNextPage = rows.length > query.pageSize
  const visibleRows = rows.slice(0, query.pageSize)

  return {
    items: visibleRows.map(toAdminUserDirectoryRow),
    nextCursor: hasNextPage ? encodeCursor(visibleRows.at(-1)?.id ?? null) : null,
    previousCursor: previousRows.length === query.pageSize
      ? encodeCursor(previousRows.at(-1)?.id ?? null)
      : null,
    // Page two has no earlier internal ID cursor, but it must still link back
    // to the cursorless initial page.
    hasPreviousPage: Boolean(query.cursor),
  }
}

/** Returns only aggregate account-operation counts; no account records are loaded for dashboard summaries. */
export async function getAdminUserMetrics(input: { prismaClient: DirectoryPrismaClient; now?: Date }) {
  const now = input.now ?? new Date()
  const [totalAccounts, verifiedAccounts, activeSupporters, unresolvedCommerceOperations, unresolvedEmailOperations] = await Promise.all([
    input.prismaClient.user.count({}),
    input.prismaClient.user.count({ where: { emailVerified: { not: null } } }),
    input.prismaClient.user.count({
      where: {
        membershipSubscriptions: {
          some: {
            membershipLevel: "SUPPORTER",
            status: { in: ACTIVE_SUPPORTER_STATUSES },
            OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: now } }],
          },
        },
      },
    }),
    input.prismaClient.commerceOrder.count({ where: unresolvedCommerceWhere() }),
    input.prismaClient.adminEmailIntent.count({ where: { status: { in: UNRESOLVED_EMAIL_STATUSES } } }),
  ])

  return {
    totalAccounts,
    verifiedAccounts,
    activeSupporters,
    unresolvedOperations: unresolvedCommerceOperations + unresolvedEmailOperations,
  }
}

const ADMIN_USER_DIRECTORY_SELECT = {
  id: true,
  name: true,
  email: true,
  emailVerified: true,
  roles: { select: { role: true, status: true }, orderBy: [{ role: "asc" }, { status: "asc" }] },
  membershipSubscriptions: {
    where: { membershipLevel: "SUPPORTER" },
    select: { status: true },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: 1,
  },
  backgroundCreditWallet: { select: { balance: true } },
  _count: {
    select: {
      commerceOrders: { where: unresolvedCommerceWhere() },
      adminEmailIntents: { where: { status: { in: UNRESOLVED_EMAIL_STATUSES } } },
    },
  },
} satisfies Prisma.UserSelect

function toAdminUserDirectoryRow(row: {
  id: string
  name: string | null
  email: string | null
  emailVerified: Date | null
  roles: Array<{ role: string; status: string }>
  membershipSubscriptions: Array<{ status: string }>
  backgroundCreditWallet: { balance: number } | null
  _count: { commerceOrders: number; adminEmailIntents: number }
}): AdminUserDirectoryRow {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    emailVerified: Boolean(row.emailVerified),
    roles: normalizeRoleAssignments(row.roles),
    subscriptionStatus: row.membershipSubscriptions[0]?.status ?? null,
    creditBalance: row.backgroundCreditWallet?.balance ?? 0,
    unresolvedIssueCount: row._count.commerceOrders + row._count.adminEmailIntents,
  }
}

function directoryWhere(query: AdminUserDirectoryQuery): Prisma.UserWhereInput {
  const conditions: Prisma.UserWhereInput[] = []
  if (query.query) {
    conditions.push({
      OR: ["name", "email", "id"].map((field) => ({
        [field]: { contains: query.query, mode: "insensitive" },
      })),
    })
  }
  if (query.emailVerified === "verified") conditions.push({ emailVerified: { not: null } })
  if (query.emailVerified === "unverified") conditions.push({ emailVerified: null })
  if (query.role || query.roleStatus) {
    conditions.push({
      roles: {
        some: {
          ...(query.role ? { role: query.role as Role } : {}),
          ...(query.roleStatus ? { status: query.roleStatus.toUpperCase() as VerificationStatus } : {}),
        },
      },
    })
  }
  if (query.subscriptionStatus) {
    conditions.push({ membershipSubscriptions: { some: { membershipLevel: "SUPPORTER", status: query.subscriptionStatus } } })
  }
  if (query.creditState === "positive") {
    conditions.push({ backgroundCreditWallet: { is: { balance: { gt: 0 } } } })
  }
  if (query.creditState === "zero") {
    conditions.push({ OR: [{ backgroundCreditWallet: { is: null } }, { backgroundCreditWallet: { is: { balance: 0 } } }] })
  }
  if (query.unresolvedIssue) {
    const unresolved = unresolvedUserWhere()
    conditions.push(query.unresolvedIssue === "yes" ? unresolved : { NOT: unresolved })
  }
  return conditions.length ? { AND: conditions } : {}
}

/** A commerce operation remains unresolved until review, refund, or dispute state is cleared. */
function unresolvedCommerceWhere(): Prisma.CommerceOrderWhereInput {
  return {
    OR: [
      { status: "REVIEW_REQUIRED" },
      { refunds: { some: { status: "PENDING" } } },
      { payments: { some: { disputes: { some: { status: "OPEN" } } } } },
    ],
  }
}

function unresolvedUserWhere(): Prisma.UserWhereInput {
  return {
    OR: [
      { commerceOrders: { some: unresolvedCommerceWhere() } },
      { adminEmailIntents: { some: { status: { in: UNRESOLVED_EMAIL_STATUSES } } } },
    ],
  }
}

function withPreviousCursorBoundary(where: Prisma.UserWhereInput, cursor: string): Prisma.UserWhereInput {
  if (Array.isArray(where.AND)) {
    return { AND: [...where.AND, { id: { lt: cursor } }] }
  }
  return { AND: [where, { id: { lt: cursor } }] }
}

function normalizeDirectoryQuery(value: Partial<AdminUserDirectoryQuery>): AdminUserDirectoryQuery {
  return parseUserDirectoryQuery({
    q: value.query,
    pageSize: value.pageSize === undefined ? undefined : String(value.pageSize),
    cursor: value.cursor ? encodeCursor(value.cursor) ?? undefined : undefined,
    emailVerified: value.emailVerified ?? undefined,
    role: value.role ?? undefined,
    roleStatus: value.roleStatus ?? undefined,
    subscriptionStatus: value.subscriptionStatus ?? undefined,
    creditState: value.creditState ?? undefined,
    unresolvedIssue: value.unresolvedIssue ?? undefined,
  })
}

function clampPageSize(value: string | undefined) {
  if (!value || !/^\d+$/.test(value)) return 25
  return Math.min(50, Math.max(1, Number(value)))
}

function encodeCursor(value: string | null) {
  return value ? Buffer.from(value).toString("base64url") : null
}

function decodeCursor(value: string | undefined) {
  if (!value || !/^[A-Za-z0-9_-]+$/.test(value)) return null
  const decoded = Buffer.from(value, "base64url").toString("utf8")
  return decoded && decoded.length <= 128 && Buffer.from(decoded).toString("base64url") === value ? decoded : null
}

function oneOf<T extends string>(value: string | undefined, values: readonly T[]) {
  return values.includes(value as T) ? value as T : null
}

function upperOneOf(value: string | undefined, values: Set<string>) {
  const normalized = value?.toUpperCase()
  return normalized && values.has(normalized) ? normalized : null
}

function lowerOneOf(value: string | undefined, values: Set<string>) {
  const normalized = value?.toLowerCase()
  return normalized && values.has(normalized) ? normalized : null
}
