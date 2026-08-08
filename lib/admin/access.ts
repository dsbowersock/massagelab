import type { PrismaClient } from "@prisma/client"
import {
  canAdministerAccounts,
  canEditAnatomyContent,
  canReviewAnatomyContent,
  normalizeRoleAssignments,
} from "../account-permissions.js"

export { canEditAnatomyContent, canReviewAnatomyContent }

export type AdminActor = {
  id: string
  accountLabel: string
  roles: string[]
  canReviewAnatomy: boolean
  canEditAnatomy: boolean
  canAdministerAccounts: boolean
}

type AdminAccessInput = {
  prismaClient?: Pick<PrismaClient, "user">
  sessionUserId?: string | null
}

/**
 * Loads the minimal, current database authority needed by all administrative
 * surfaces. Session claims deliberately provide identity only, never roles.
 */
export async function loadAdminActor(input: {
  prismaClient: Pick<PrismaClient, "user">
  sessionUserId: string | null
}): Promise<AdminActor | null> {
  if (!input.sessionUserId) return null

  const user = await input.prismaClient.user.findUnique({
    where: { id: input.sessionUserId },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      roles: { select: { role: true, status: true } },
    },
  })

  if (!user?.emailVerified || !user.email?.trim()) return null

  const roles = normalizeRoleAssignments(user.roles)
    .filter((assignment) => assignment.status === "VERIFIED")
    .map((assignment) => assignment.role)

  return {
    id: user.id,
    accountLabel: accountLabelFor(user),
    roles,
    canReviewAnatomy: canReviewAnatomyContent(roles),
    canEditAnatomy: canEditAnatomyContent(roles),
    canAdministerAccounts: canAdministerAccounts(roles),
  }
}

/** Requires a freshly loaded, verified ADMIN role for account and commerce operations. */
export async function requireFullAdminUser(input?: AdminAccessInput): Promise<AdminActor> {
  return requireAdminActor(input, "full")
}

/** Requires a freshly loaded anatomy-review capability for review-only work. */
export async function requireAnatomyReviewerUser(input?: AdminAccessInput): Promise<AdminActor> {
  return requireAdminActor(input, "review")
}

/** Requires a freshly loaded anatomy-editor capability for content mutations. */
export async function requireAnatomyEditorUser(input?: AdminAccessInput): Promise<AdminActor> {
  return requireAdminActor(input, "edit")
}

async function requireAdminActor(input: AdminAccessInput | undefined, capability: "full" | "review" | "edit"): Promise<AdminActor> {
  const resolved = await resolveAdminAccessInput(input)
  const actor = await loadAdminActor(resolved)
  const allowed = capability === "full"
    ? actor?.canAdministerAccounts
    : capability === "review"
      ? actor?.canReviewAnatomy
      : actor?.canEditAnatomy

  if (allowed && actor) return actor

  if (input) {
    throw new Error(`${capability === "full" ? "Full administration" : "Anatomy administration"} requires verified database authority.`)
  }

  const { redirect } = await import("next/navigation")
  redirect(resolved.sessionUserId ? "/account" : "/login")
  throw new Error("Redirect did not interrupt administrative authorization.")
}

async function resolveAdminAccessInput(input?: AdminAccessInput): Promise<Required<AdminAccessInput>> {
  if (input?.prismaClient) {
    return {
      prismaClient: input.prismaClient,
      sessionUserId: input.sessionUserId ?? null,
    }
  }

  const [{ prisma }, { getCurrentSession }] = await Promise.all([
    import("../prisma.ts"),
    import("../../auth.ts"),
  ])
  const session = input ? null : await getCurrentSession()

  return {
    prismaClient: prisma,
    sessionUserId: input?.sessionUserId ?? session?.user?.id ?? null,
  }
}

/** Keeps the UI actor label short and database-owned without exposing email separately. */
function accountLabelFor(user: { id: string; name: string | null; email: string | null }) {
  return (user.name?.trim() || user.email?.trim() || `Account ${user.id}`).slice(0, 120)
}
