import type { Prisma, PrismaClient } from "@prisma/client"
import { normalizeRoleAssignments } from "../account-permissions.js"
import { runCommerceTransaction } from "../commerce/transactions.ts"
import { requireFullAdminUser } from "./access.ts"
import type { AdminReasonCode } from "./operation-contract.ts"
import {
  acquireAdminActionIdempotencyLock,
  recordAdminActionBundle,
  type RecordAdminActionInput,
} from "./operation-service.ts"

export type DelegatedAnatomyRole = "ANATOMY_REVIEWER" | "ANATOMY_EDITOR"
export type AnatomyRoleOperation = "ASSIGN" | "REVOKE"
export type ExpectedAnatomyRoleStatus = "ABSENT" | "VERIFIED" | "REVOKED"

export type ChangeAnatomyRoleInput = {
  prismaClient: PrismaClient
  actorUserId: string
  targetUserId: string
  role: DelegatedAnatomyRole
  operation: AnatomyRoleOperation
  expectedStatus: ExpectedAnatomyRoleStatus
  reasonCode: AdminReasonCode
  internalNote: string | null
  idempotencyKey: string
}

export type ChangeAnatomyRoleResult = {
  beforeRoles: string[]
  afterRoles: string[]
  revokedSessionCount: number
  emailIntentId: string
  replayed: boolean
}

const DELEGATED_ANATOMY_ROLES = new Set<DelegatedAnatomyRole>(["ANATOMY_REVIEWER", "ANATOMY_EDITOR"])
const ANATOMY_ROLE_OPERATIONS = new Set<AnatomyRoleOperation>(["ASSIGN", "REVOKE"])
const EXPECTED_ROLE_STATUSES = new Set<ExpectedAnatomyRoleStatus>(["ABSENT", "VERIFIED", "REVOKED"])

/**
 * Assigns or revokes one delegated anatomy role with fresh database authority.
 * The role write, session revocation, audit, target activity, and email intent
 * share one serializable transaction; email transport remains a post-commit concern.
 */
export async function changeAnatomyRole(input: ChangeAnatomyRoleInput): Promise<ChangeAnatomyRoleResult> {
  validateMutationContract(input)

  return runCommerceTransaction(input.prismaClient, async (tx) => {
    // This must be the transaction's first database operation. PostgreSQL's
    // serializable snapshot is fixed by the first query, so locking later could
    // make a waiter miss the winning request's committed evidence.
    await acquireAdminActionIdempotencyLock(tx, input.idempotencyKey)
    await requireFullAdminUser({ prismaClient: tx, sessionUserId: input.actorUserId })
    if (input.actorUserId === input.targetUserId) {
      throw new Error("You cannot change your own delegated anatomy role.")
    }

    const target = await tx.user.findUnique({
      where: { id: input.targetUserId },
      select: {
        id: true,
        email: true,
        authSessionVersion: true,
        roles: { select: { role: true, status: true } },
      },
    })
    if (!target) throw new Error("Target account was not found.")

    const existing = await tx.adminAction.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: { activity: true, emailIntent: true },
    })
    if (existing) return replayExistingChange(tx, input, existing)

    const assignment = await tx.userRole.findUnique({
      where: { userId_role: { userId: input.targetUserId, role: input.role } },
    })
    const actualStatus = assignment?.status ?? "ABSENT"
    if (actualStatus !== input.expectedStatus) {
      throw new Error("This role changed since this operation was prepared. Refresh the account and try again.")
    }
    validateStateTransition(input)

    const beforeRoles = verifiedRoleNames(target.roles)
    const now = new Date()
    if (input.operation === "ASSIGN") {
      await tx.userRole.upsert({
        where: { userId_role: { userId: input.targetUserId, role: input.role } },
        create: {
          userId: input.targetUserId,
          role: input.role,
          status: "VERIFIED",
          source: "admin",
          metadata: {},
          verifiedAt: now,
          expiresAt: null,
          revokedAt: null,
          grantedById: input.actorUserId,
        },
        update: {
          status: "VERIFIED",
          source: "admin",
          metadata: {},
          verifiedAt: now,
          expiresAt: null,
          revokedAt: null,
          grantedById: input.actorUserId,
        },
      })
    } else {
      await tx.userRole.update({
        where: { userId_role: { userId: input.targetUserId, role: input.role } },
        data: {
          status: "REVOKED",
          expiresAt: null,
          revokedAt: now,
          grantedById: input.actorUserId,
        },
      })
    }

    const afterRoles = rolesAfterChange(beforeRoles, input.role, input.operation)
    const updatedTarget = await tx.user.update({
      where: { id: input.targetUserId },
      data: { authSessionVersion: { increment: 1 } },
      select: { authSessionVersion: true },
    })
    const { count: revokedSessionCount } = await tx.session.deleteMany({ where: { userId: input.targetUserId } })
    const bundleInput = buildRoleBundle(input, {
      beforeRoles,
      afterRoles,
      beforeAuthSessionVersion: target.authSessionVersion,
      afterAuthSessionVersion: updatedTarget.authSessionVersion,
      revokedSessionCount,
      recipientEmail: target.email,
    })
    const bundle = await recordAdminActionBundle(tx, bundleInput)

    return {
      beforeRoles,
      afterRoles,
      revokedSessionCount,
      emailIntentId: bundle.emailIntentId,
      replayed: bundle.replayed,
    }
  })
}

function validateMutationContract(input: ChangeAnatomyRoleInput): void {
  for (const [value, label] of [[input.actorUserId, "actor"], [input.targetUserId, "target"], [input.idempotencyKey, "operation key"]] as const) {
    if (typeof value !== "string" || !value.trim() || value.length > 191 || /[\r\n]/.test(value)) {
      throw new Error(`Provide a valid ${label}.`)
    }
  }
  if (!DELEGATED_ANATOMY_ROLES.has(input.role)) {
    throw new Error("Only delegated anatomy roles can be changed.")
  }
  if (!ANATOMY_ROLE_OPERATIONS.has(input.operation)) {
    throw new Error("Select a valid anatomy role operation.")
  }
  if (!EXPECTED_ROLE_STATUSES.has(input.expectedStatus)) {
    throw new Error("Select a valid expected role status.")
  }
}

function validateStateTransition(input: ChangeAnatomyRoleInput): void {
  if (input.operation === "ASSIGN" && input.expectedStatus === "VERIFIED") {
    throw new Error("This delegated anatomy role is already assigned.")
  }
  if (input.operation === "REVOKE" && input.expectedStatus !== "VERIFIED") {
    throw new Error("This delegated anatomy role is not currently assigned.")
  }
}

function verifiedRoleNames(assignments: Array<{ role: string; status: string }>): string[] {
  return normalizeRoleAssignments(assignments)
    .filter((assignment) => assignment.status === "VERIFIED")
    .map((assignment) => assignment.role)
    .sort()
}

function rolesAfterChange(beforeRoles: string[], role: DelegatedAnatomyRole, operation: AnatomyRoleOperation): string[] {
  const roles = new Set(beforeRoles)
  if (operation === "ASSIGN") roles.add(role)
  else roles.delete(role)
  return [...roles].sort()
}

type BundleFacts = {
  beforeRoles: string[]
  afterRoles: string[]
  beforeAuthSessionVersion: number
  afterAuthSessionVersion: number
  revokedSessionCount: number
  recipientEmail: string | null
}

function buildRoleBundle(input: ChangeAnatomyRoleInput, facts: BundleFacts): RecordAdminActionInput {
  const assigning = input.operation === "ASSIGN"
  const roleLabel = input.role === "ANATOMY_EDITOR" ? "Anatomy Editor" : "Anatomy Reviewer"
  const stateVerb = assigning ? "assigned" : "revoked"

  return {
    actorUserId: input.actorUserId,
    targetUserId: input.targetUserId,
    actionKind: assigning ? "ANATOMY_ROLE_ASSIGNED" : "ANATOMY_ROLE_REVOKED",
    reasonCode: input.reasonCode,
    internalNote: input.internalNote,
    idempotencyKey: input.idempotencyKey,
    beforeState: {
      roles: facts.beforeRoles,
      delegatedRole: input.role,
      roleStatus: input.expectedStatus,
      authSessionVersion: facts.beforeAuthSessionVersion,
    },
    afterState: {
      roles: facts.afterRoles,
      delegatedRole: input.role,
      roleStatus: assigning ? "VERIFIED" : "REVOKED",
      authSessionVersion: facts.afterAuthSessionVersion,
      revokedSessionCount: facts.revokedSessionCount,
    },
    activity: {
      title: `${roleLabel} access ${stateVerb}`,
      explanation: `${roleLabel} access was ${stateVerb} for your Massage Lab account. Your active sessions were signed out for security.`,
      effectiveValue: assigning ? roleLabel : "Removed",
    },
    email: {
      kind: assigning ? "ANATOMY_ROLE_ASSIGNED" : "ANATOMY_ROLE_REVOKED",
      recipientEmail: facts.recipientEmail,
      subject: `Your Massage Lab anatomy access was ${stateVerb}`,
      message: `${roleLabel} access was ${stateVerb} for your Massage Lab account. Your active sessions were signed out. If you did not expect this change, contact Massage Lab support.`,
    },
  }
}

type ExistingRoleAction = Prisma.AdminActionGetPayload<{
  include: { activity: true; emailIntent: true }
}>

/** Revalidates the persisted immutable bundle through its canonical owner. */
async function replayExistingChange(
  tx: Prisma.TransactionClient,
  input: ChangeAnatomyRoleInput,
  existing: ExistingRoleAction,
): Promise<ChangeAnatomyRoleResult> {
  const before = readRoleSnapshot(existing.beforeState)
  const after = readRoleSnapshot(existing.afterState, true)
  const expectedNextStatus = input.operation === "ASSIGN" ? "VERIFIED" : "REVOKED"
  if (
    existing.actorUserId !== input.actorUserId
    || existing.targetUserId !== input.targetUserId
    || existing.actionKind !== (input.operation === "ASSIGN" ? "ANATOMY_ROLE_ASSIGNED" : "ANATOMY_ROLE_REVOKED")
    || existing.reasonCode !== input.reasonCode
    || existing.internalNote !== input.internalNote
    || before?.delegatedRole !== input.role
    || before.roleStatus !== input.expectedStatus
    || after?.delegatedRole !== input.role
    || after.roleStatus !== expectedNextStatus
    || after.authSessionVersion !== before.authSessionVersion + 1
    || after.revokedSessionCount === null
    || !existing.emailIntent
  ) {
    throw new Error("This administrative operation key is already in use.")
  }

  const bundle = await recordAdminActionBundle(tx, buildRoleBundle(input, {
    beforeRoles: before.roles,
    afterRoles: after.roles,
    beforeAuthSessionVersion: before.authSessionVersion,
    afterAuthSessionVersion: after.authSessionVersion,
    revokedSessionCount: after.revokedSessionCount,
    recipientEmail: existing.emailIntent.recipientEmail,
  }))
  return {
    beforeRoles: before.roles,
    afterRoles: after.roles,
    revokedSessionCount: after.revokedSessionCount,
    emailIntentId: bundle.emailIntentId,
    replayed: bundle.replayed,
  }
}

type RoleSnapshot = {
  roles: string[]
  delegatedRole: DelegatedAnatomyRole
  roleStatus: ExpectedAnatomyRoleStatus
  authSessionVersion: number
  revokedSessionCount: number | null
}

function readRoleSnapshot(value: Prisma.JsonValue, requireSessionCount = false): RoleSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const snapshot = value as Record<string, Prisma.JsonValue>
  if (
    !Array.isArray(snapshot.roles)
    || !snapshot.roles.every((role) => typeof role === "string")
    || !DELEGATED_ANATOMY_ROLES.has(snapshot.delegatedRole as DelegatedAnatomyRole)
    || !EXPECTED_ROLE_STATUSES.has(snapshot.roleStatus as ExpectedAnatomyRoleStatus)
  ) return null

  const authSessionVersion = snapshot.authSessionVersion
  const count = snapshot.revokedSessionCount
  if (!Number.isSafeInteger(authSessionVersion) || (authSessionVersion as number) < 0) return null
  if (requireSessionCount && (!Number.isSafeInteger(count) || (count as number) < 0)) return null
  return {
    roles: [...snapshot.roles] as string[],
    delegatedRole: snapshot.delegatedRole as DelegatedAnatomyRole,
    roleStatus: snapshot.roleStatus as ExpectedAnatomyRoleStatus,
    authSessionVersion: authSessionVersion as number,
    revokedSessionCount: typeof count === "number" ? count : null,
  }
}
