import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import {
  createCompiledModuleLoader,
  createElement,
  elementText,
  findElement,
  findElements,
  passThroughElement,
  renderFunctionComponents,
} from "./helpers/compiled-module.mjs"
import * as temporaryAccess from "../lib/admin/temporary-access.ts"
import * as temporaryAccessContract from "../lib/admin/temporary-access-contract.ts"
import { getUserEntitlementState } from "../lib/membership.js"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const temporaryActionSource = await readFile(
  new URL("../app/admin/users/[userId]/temporary-access-actions.ts", import.meta.url),
  "utf8",
).catch(() => "")
const temporaryFormSource = await readFile(
  new URL("../app/admin/users/[userId]/temporary-access-form.tsx", import.meta.url),
  "utf8",
).catch(() => "")
const adminDetailPageSource = await readFile(
  new URL("../app/admin/users/[userId]/page.tsx", import.meta.url),
  "utf8",
)
const temporaryAccessContractSource = await readFile(
  new URL("../lib/admin/temporary-access-contract.ts", import.meta.url),
  "utf8",
).catch(() => "")
const membershipSource = await readFile(new URL("../lib/membership.js", import.meta.url), "utf8")
const userDirectorySource = await readFile(new URL("../lib/admin/user-directory.ts", import.meta.url), "utf8")

const {
  ADMIN_GRANTABLE_FEATURE_KEYS,
  grantTemporaryFeatureAccess,
  listActiveTemporaryFeatureAccess,
  revokeTemporaryFeatureAccess,
} = temporaryAccess

const NOW = new Date("2026-08-10T12:00:00.000Z")
const DAY_MS = 24 * 60 * 60 * 1_000
const UI_OPERATION_ID = "42b90a0b-41d5-48f8-b798-b6da77178b67"
const UI_REVOKE_OPERATION_ID = "e58989e0-af25-44b4-837f-478b425de8cb"
const UI_IDLE_STATE = { status: "idle", message: "" }

function temporaryAccessUiHarness({ formPending = false } = {}) {
  return loadCompiledModule(
    temporaryFormSource,
    "app/admin/users/[userId]/temporary-access-form.test.tsx",
    {
      react: {
        useActionState: () => [UI_IDLE_STATE, () => {}, false],
        useId: () => "temporary-access-form",
        useState: (initialValue) => [initialValue, () => {}],
      },
      "react-dom": { useFormStatus: () => ({ pending: formPending }) },
      "react/jsx-runtime": { Fragment: "fragment", jsx: createElement, jsxs: createElement },
      "@/components/ui/button": { Button: passThroughElement("button") },
      "@/lib/admin/operation-contract": {
        ADMIN_REASON_CODES: ["ACCESS_REMEDIATION", "OTHER"],
      },
      "@/lib/admin/temporary-access-contract": temporaryAccessContract,
      "./temporary-access-actions": {
        grantTemporaryAccessAction() {},
        revokeTemporaryAccessAction() {},
      },
    },
  )
}

function user(id, {
  email = `${id}@example.com`,
  emailVerified = true,
  roles = [{ role: "USER", status: "VERIFIED" }],
} = {}) {
  return {
    id,
    name: id,
    email,
    emailVerified: emailVerified ? new Date("2026-08-01T12:00:00.000Z") : null,
    roles,
  }
}

function createDatabase({
  grants = [],
  revocations = [],
  failWrite = null,
  grantCreateErrors = [],
  revocationCreateErrors = [],
  competingAdminBundleAfterSnapshot = null,
} = {}) {
  const users = [
    user("actor-admin", { roles: [{ role: "ADMIN", status: "VERIFIED" }] }),
    user("actor-admin-two", { roles: [{ role: "ADMIN", status: "VERIFIED" }] }),
    user("actor-ordinary"),
    user("actor-reviewer", { roles: [{ role: "ANATOMY_REVIEWER", status: "VERIFIED" }] }),
    user("target-user"),
    user("target-two"),
    user("target-unverified", { emailVerified: false }),
    user("target-no-email", { email: null }),
    user("target-blank-email", { email: "   " }),
  ]
  const root = {
    state: {
      users: new Map(users.map((record) => [record.id, record])),
      grants: new Map(grants.map((grant) => [grant.id, structuredClone(grant)])),
      revocations: new Map(revocations.map((revocation) => [revocation.grantId, structuredClone(revocation)])),
      actions: new Map(),
      activities: new Map(),
      intents: new Map(),
    },
    failWrite,
    grantCreateErrors: [...grantCreateErrors],
    revocationCreateErrors: [...revocationCreateErrors],
    competingAdminBundleAfterSnapshot,
    competingAdminBundleCommitted: false,
    adminActionCommittedConflicts: 0,
    nextGrantId: grants.length + 1,
    nextRevocationId: revocations.length + 1,
    transactionAttempts: 0,
    advisoryOwners: new Map(),
    advisoryWaiters: new Map(),
    uniqueOwners: new Map(),
    uniqueWaiters: new Map(),
  }

  function relationGrant(state, grant) {
    if (!grant) return null
    return {
      ...structuredClone(grant),
      revocation: structuredClone(state.revocations.get(grant.id) ?? null),
    }
  }

  function relationAction(state, action) {
    if (!action) return null
    return {
      ...structuredClone(action),
      activity: structuredClone(state.activities.get(action.id) ?? null),
      emailIntent: structuredClone(state.intents.get(action.id) ?? null),
    }
  }

  function activeGrants(state, where) {
    const startsAt = where.startsAt?.lte
    const expiresAt = where.expiresAt?.gt
    const allowedKeys = where.featureKey?.in
    return [...state.grants.values()].filter((grant) => (
      (!where.userId || grant.userId === where.userId)
      && (!where.featureKey || (
        typeof where.featureKey === "string"
          ? grant.featureKey === where.featureKey
          : Array.isArray(allowedKeys) && allowedKeys.includes(grant.featureKey)
      ))
      && (!startsAt || grant.startsAt.getTime() <= startsAt.getTime())
      && (!expiresAt || grant.expiresAt.getTime() > expiresAt.getTime())
      && (where.revocation !== null || !state.revocations.has(grant.id))
    ))
  }

  function makeClient(transaction = null) {
    const state = () => transaction?.state ?? root.state
    return {
      async $executeRaw(query) {
        if (!transaction) throw new Error("Advisory locks require a transaction.")
        const key = query.values?.[0]
        if (typeof key !== "string") throw new Error("Expected an advisory lock key.")
        if (root.competingAdminBundleAfterSnapshot && !root.competingAdminBundleCommitted) {
          commitCompetingAdminBundle(root, root.competingAdminBundleAfterSnapshot)
          root.competingAdminBundleCommitted = true
        }
        await acquireNamedLock(root.advisoryOwners, root.advisoryWaiters, transaction, key, transaction.advisoryKeys)
        return 1
      },
      user: {
        async findUnique({ where }) {
          return structuredClone(state().users.get(where.id) ?? null)
        },
      },
      temporaryFeatureGrant: {
        async findUnique({ where }) {
          if (where.id) return relationGrant(state(), state().grants.get(where.id))
          const grant = [...state().grants.values()].find((candidate) => candidate.idempotencyKey === where.idempotencyKey)
          return relationGrant(state(), grant)
        },
        async findMany({ where, orderBy, take }) {
          assert.deepEqual(where.startsAt, { lte: where.startsAt.lte })
          assert.deepEqual(where.expiresAt, { gt: where.expiresAt.gt })
          assert.equal(where.revocation, null)
          const records = activeGrants(state(), where).sort((left, right) => {
            if (Array.isArray(orderBy) && orderBy[0]?.expiresAt) {
              const expiryDelta = left.expiresAt.getTime() - right.expiresAt.getTime()
              if (expiryDelta !== 0) return expiryDelta
            }
            return left.id.localeCompare(right.id)
          })
          return structuredClone(records.slice(0, take ?? records.length))
        },
        async create({ data }) {
          if (root.failWrite === "grant") throw new Error("grant write failed")
          if (root.grantCreateErrors.length > 0) throw root.grantCreateErrors.shift()
          await reserveUnique(root, transaction, `TemporaryFeatureGrant:idempotencyKey:${data.idempotencyKey}`)
          if ([...root.state.grants.values()].some((grant) => grant.idempotencyKey === data.idempotencyKey)) {
            throw uniqueConstraintError("TemporaryFeatureGrant", ["idempotencyKey"])
          }
          const grant = {
            id: `grant-${root.nextGrantId++}`,
            ...structuredClone(data),
            createdAt: new Date(NOW),
          }
          state().grants.set(grant.id, grant)
          return structuredClone(grant)
        },
      },
      temporaryFeatureGrantRevocation: {
        async findUnique({ where }) {
          if (where.grantId) return structuredClone(state().revocations.get(where.grantId) ?? null)
          return structuredClone([...state().revocations.values()].find((candidate) => (
            candidate.idempotencyKey === where.idempotencyKey
          )) ?? null)
        },
        async create({ data }) {
          if (root.failWrite === "revocation") throw new Error("revocation write failed")
          if (root.revocationCreateErrors.length > 0) throw root.revocationCreateErrors.shift()
          await reserveUnique(root, transaction, `TemporaryFeatureGrantRevocation:idempotencyKey:${data.idempotencyKey}`)
          await reserveUnique(root, transaction, `TemporaryFeatureGrantRevocation:grantId:${data.grantId}`)
          if ([...root.state.revocations.values()].some((row) => row.idempotencyKey === data.idempotencyKey)) {
            throw uniqueConstraintError("TemporaryFeatureGrantRevocation", ["idempotencyKey"])
          }
          if (root.state.revocations.has(data.grantId)) {
            throw uniqueConstraintError("TemporaryFeatureGrantRevocation", ["grantId"])
          }
          const revocation = { id: `revocation-${root.nextRevocationId++}`, ...structuredClone(data) }
          state().revocations.set(data.grantId, revocation)
          return structuredClone(revocation)
        },
      },
      adminAction: {
        async findUnique({ where }) {
          return relationAction(state(), state().actions.get(where.idempotencyKey))
        },
        async create({ data }) {
          if (root.failWrite === "action") throw new Error("action write failed")
          await reserveUnique(root, transaction, `AdminAction:idempotencyKey:${data.idempotencyKey}`)
          if (root.state.actions.has(data.idempotencyKey)) {
            root.adminActionCommittedConflicts += 1
            throw uniqueConstraintError("AdminAction", ["idempotencyKey"])
          }
          const action = {
            id: `action-${state().actions.size + 1}`,
            ...structuredClone(data),
            occurredAt: new Date(NOW),
            createdAt: new Date(NOW),
          }
          state().actions.set(data.idempotencyKey, action)
          return { id: action.id }
        },
      },
      userAccountActivity: {
        async create({ data }) {
          if (root.failWrite === "activity") throw new Error("activity write failed")
          const activity = { id: `activity-${state().activities.size + 1}`, ...structuredClone(data) }
          state().activities.set(data.adminActionId, activity)
          return structuredClone(activity)
        },
      },
      adminEmailIntent: {
        async create({ data }) {
          if (root.failWrite === "intent") throw new Error("intent write failed")
          const intent = {
            id: `intent-${state().intents.size + 1}`,
            ...structuredClone(data),
            attemptCount: 0,
            lastAttemptAt: null,
            deliveredAt: null,
          }
          state().intents.set(data.adminActionId, intent)
          return { id: intent.id }
        },
      },
    }
  }

  const database = {
    get state() { return root.state },
    get transactionAttempts() { return root.transactionAttempts },
    get adminActionCommittedConflicts() { return root.adminActionCommittedConflicts },
    async $transaction(callback, options) {
      root.transactionAttempts += 1
      assert.equal(options?.isolationLevel, "Serializable")
      const transaction = {
        state: structuredClone(root.state),
        advisoryKeys: new Set(),
        uniqueKeys: new Set(),
      }
      try {
        const result = await callback(makeClient(transaction))
        root.state = transaction.state
        return result
      } finally {
        for (const key of transaction.uniqueKeys) {
          releaseNamedLock(root.uniqueOwners, root.uniqueWaiters, transaction, key)
        }
        for (const key of transaction.advisoryKeys) {
          releaseNamedLock(root.advisoryOwners, root.advisoryWaiters, transaction, key)
        }
      }
    },
    temporaryFeatureGrant: makeClient().temporaryFeatureGrant,
  }

  return database
}

function uniqueConstraintError(modelName, target) {
  return Object.assign(new Error("Unique constraint failed"), {
    code: "P2002",
    meta: { modelName, target },
  })
}

/** Commits a coherent competing winner after the loser's snapshot is fixed. */
function commitCompetingAdminBundle(root, { idempotencyKey, actionKind }) {
  const action = {
    id: "competing-action-1",
    actorUserId: "actor-admin-two",
    targetUserId: "target-user",
    actionKind,
    reasonCode: "ADMIN_CORRECTION",
    internalNote: "A different operation won the shared key.",
    idempotencyKey,
    beforeState: { operation: "competing" },
    afterState: { operation: "committed" },
    outcome: "SUCCEEDED",
    failureCode: null,
    occurredAt: new Date(NOW),
    createdAt: new Date(NOW),
  }
  root.state.actions.set(idempotencyKey, action)
  root.state.activities.set(action.id, {
    id: "competing-activity-1",
    userId: action.targetUserId,
    adminActionId: action.id,
    title: "Competing operation committed",
    explanation: "A different administrative operation committed first.",
    effectiveValue: null,
  })
  root.state.intents.set(action.id, {
    id: "competing-intent-1",
    userId: action.targetUserId,
    adminActionId: action.id,
    kind: actionKind,
    recipientEmail: "target-user@example.com",
    subject: "Competing operation",
    message: "A different administrative operation committed first.",
    status: "PENDING",
    attemptCount: 0,
    lastAttemptAt: null,
    deliveredAt: null,
    failureCode: null,
  })
}

async function acquireNamedLock(owners, waitersByKey, transaction, key, heldKeys) {
  if (owners.get(key) === transaction) return
  while (owners.has(key)) {
    await new Promise((resolve) => {
      const waiters = waitersByKey.get(key) ?? []
      waiters.push(resolve)
      waitersByKey.set(key, waiters)
    })
  }
  owners.set(key, transaction)
  heldKeys.add(key)
}

async function reserveUnique(root, transaction, key) {
  if (!transaction) throw new Error("Unique writes require a transaction.")
  await acquireNamedLock(root.uniqueOwners, root.uniqueWaiters, transaction, key, transaction.uniqueKeys)
}

function releaseNamedLock(owners, waitersByKey, transaction, key) {
  if (owners.get(key) !== transaction) return
  owners.delete(key)
  waitersByKey.get(key)?.shift()?.()
}

function grant(database, overrides = {}) {
  return grantTemporaryFeatureAccess({
    prismaClient: database,
    actorUserId: "actor-admin",
    targetUserId: "target-user",
    featureKey: "premium_backgrounds",
    durationDays: 30,
    expectedActiveGrantIds: [],
    reasonCode: "ACCESS_REMEDIATION",
    internalNote: "Temporary access while support reviews the account.",
    idempotencyKey: "temporary-grant-operation-1",
    now: NOW,
    ...overrides,
  })
}

function revoke(database, grantId, overrides = {}) {
  return revokeTemporaryFeatureAccess({
    prismaClient: database,
    actorUserId: "actor-admin",
    targetUserId: "target-user",
    grantId,
    expectedActiveGrantIds: [grantId],
    reasonCode: "ACCESS_REMEDIATION",
    internalNote: "Temporary access is no longer needed.",
    idempotencyKey: `temporary-revoke-${grantId}`,
    now: NOW,
    ...overrides,
  })
}

function counts(state) {
  return {
    grants: state.grants.size,
    revocations: state.revocations.size,
    actions: state.actions.size,
    activities: state.activities.size,
    intents: state.intents.size,
  }
}

function seededGrant(id, featureKey = "premium_backgrounds", overrides = {}) {
  return {
    id,
    userId: "target-user",
    featureKey,
    startsAt: new Date(NOW),
    expiresAt: new Date(NOW.getTime() + DAY_MS),
    grantedById: "actor-admin",
    reasonCode: "ACCESS_REMEDIATION",
    internalNote: null,
    idempotencyKey: `seed-${id}`,
    createdAt: new Date(NOW),
    ...overrides,
  }
}

function rewriteRevocationEffectiveEvidence(database, operationKey, effective) {
  const action = database.state.actions.get(operationKey)
  action.afterState.effective = effective
  const activity = database.state.activities.get(action.id)
  const featureLabel = temporaryAccessContract.ADMIN_TEMPORARY_ACCESS_FEATURE_LABELS[action.afterState.featureKey]
  activity.explanation = effective
    ? `Massage Lab support revoked one temporary ${featureLabel} grant. Another temporary grant remains active.`
    : `Massage Lab support revoked temporary ${featureLabel} access.`
  activity.effectiveValue = effective ? `${featureLabel} remains active` : "Temporary access removed"
  database.state.intents.get(action.id).message = effective
    ? `Massage Lab support revoked one temporary ${featureLabel} grant, but another temporary grant remains active. If you did not expect this change, contact Massage Lab support.`
    : `Massage Lab support revoked temporary ${featureLabel} access. If you did not expect this change, contact Massage Lab support.`
}

describe("Admin temporary feature access", () => {
  it("owns the browser-safe temporary-access contract without server runtime dependencies", () => {
    assert.match(temporaryAccessContractSource, /export const ADMIN_GRANTABLE_FEATURE_KEYS/)
    assert.match(temporaryAccessContractSource, /export const ADMIN_TEMPORARY_ACCESS_FEATURE_LABELS/)
    assert.match(temporaryAccessContractSource, /TEMPORARY_ACCESS_MIN_DAYS\s*=\s*1/)
    assert.match(temporaryAccessContractSource, /TEMPORARY_ACCESS_MAX_DAYS\s*=\s*365/)
    assert.match(temporaryAccessContractSource, /PER_FEATURE_ACTIVE_LIMIT\s*=\s*100/)
    assert.match(temporaryAccessContractSource, /TOTAL_ACTIVE_LIMIT/)
    assert.match(temporaryAccessContractSource, /export function isGrantableFeature/)
    assert.match(temporaryAccessContractSource, /export function isSafeRecordId/)
    assert.doesNotMatch(temporaryAccessContractSource, /@prisma|node:|"use server"|server-only/)
    assert.match(temporaryFormSource, /@\/lib\/admin\/temporary-access-contract/)
    assert.doesNotMatch(temporaryFormSource, /@\/lib\/admin\/temporary-access["']/)
    assert.match(membershipSource, /\.\/admin\/temporary-access-contract\.ts/)
    assert.match(userDirectorySource, /\.\/temporary-access-contract\.ts/)
    assert.equal(
      temporaryAccessContract.formatTemporaryAccessUtc("2026-09-09T12:00:00.000Z"),
      "Sep 9, 2026, 12:00:00 PM UTC",
    )
  })

  it("exports the exact frozen low-risk feature allowlist", () => {
    assert.equal(Object.isFrozen(ADMIN_GRANTABLE_FEATURE_KEYS), true)
    assert.deepEqual(ADMIN_GRANTABLE_FEATURE_KEYS, [
      "premium_backgrounds",
      "therapist_documentation_tools",
      "calendar_basic_scheduling",
      "calendar_full_scheduling",
      "external_calendar_sync",
    ])
    assert.equal(ADMIN_GRANTABLE_FEATURE_KEYS.includes("chimer_custom_colors"), false)
    for (const highRisk of ["practice_management", "calendar_team_scheduling", "cloud_storage", "phi_storage_tools"]) {
      assert.equal(ADMIN_GRANTABLE_FEATURE_KEYS.includes(highRisk), false)
    }
    assert.equal(temporaryAccess.PER_FEATURE_ACTIVE_LIMIT, 100)
    assert.equal(temporaryAccess.TOTAL_ACTIVE_LIMIT, 500)
  })

  it("defines append-only grant and revocation models plus the exact indexes and Restrict relations", async () => {
    const schema = await readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8")
    const service = await readFile(new URL("../lib/admin/temporary-access.ts", import.meta.url), "utf8")
    const migration = await readFile(new URL(
      "../prisma/migrations/20260808100000_admin_temporary_feature_access/migration.sql",
      import.meta.url,
    ), "utf8")

    assert.match(schema, /model TemporaryFeatureGrant \{[\s\S]*?idempotencyKey\s+String\s+@unique[\s\S]*?@@index\(\[userId, featureKey, startsAt, expiresAt\]\)[\s\S]*?@@index\(\[expiresAt\]\)[\s\S]*?\n\}/)
    assert.match(schema, /model TemporaryFeatureGrantRevocation \{[\s\S]*?grantId\s+String\s+@unique[\s\S]*?idempotencyKey\s+String\s+@unique[\s\S]*?\n\}/)
    assert.match(schema, /TemporaryFeatureGrant[\s\S]*?onDelete: Restrict/)
    assert.match(schema, /TemporaryFeatureGrantRevocation[\s\S]*?onDelete: Restrict/)
    assert.match(migration, /CREATE TABLE "TemporaryFeatureGrant"/)
    assert.match(migration, /CREATE TABLE "TemporaryFeatureGrantRevocation"/)
    assert.match(migration, /ON DELETE RESTRICT/)
    assert.doesNotMatch(service, /temporaryFeatureGrant\.(?:update|updateMany|upsert|delete|deleteMany)/)
    assert.doesNotMatch(service, /temporaryFeatureGrantRevocation\.(?:update|updateMany|upsert|delete|deleteMany)/)
  })

  it("creates one immediately effective grant and the shared immutable evidence bundle atomically", async () => {
    const database = createDatabase()

    const result = await grant(database)

    assert.deepEqual(result, {
      kind: "grant",
      grantId: "grant-1",
      featureKey: "premium_backgrounds",
      expiresAt: "2026-09-09T12:00:00.000Z",
      replayed: false,
      emailIntentId: "intent-1",
    })
    const stored = database.state.grants.get(result.grantId)
    assert.equal(stored.startsAt.toISOString(), NOW.toISOString())
    assert.equal(stored.expiresAt.toISOString(), result.expiresAt)
    assert.equal(stored.grantedById, "actor-admin")
    assert.equal(stored.reasonCode, "ACCESS_REMEDIATION")
    const action = database.state.actions.get("temporary-grant-operation-1")
    assert.equal(action.actionKind, "TEMPORARY_FEATURE_ACCESS_GRANTED")
    assert.deepEqual(action.beforeState.expectedActiveGrantSnapshot.count, 0)
    assert.match(action.beforeState.expectedActiveGrantSnapshot.digest, /^[a-f0-9]{64}$/)
    assert.equal(action.afterState.grantId, result.grantId)
    assert.equal(action.afterState.expiresAt, "2026-09-09T12:00:00.000Z")
    assert.match(database.state.activities.get(action.id).explanation, /Premium backgrounds access through Sep 9, 2026, 12:00:00 PM UTC/)
    assert.doesNotMatch(database.state.activities.get(action.id).explanation, /premium_backgrounds|2026-09-09T12:00:00\.000Z/)
    assert.match(database.state.intents.get(action.id).message, /Premium backgrounds access through Sep 9, 2026, 12:00:00 PM UTC/)
    assert.equal(database.state.activities.get(action.id).userId, "target-user")
    assert.equal(database.state.intents.get(action.id).status, "PENDING")
  })

  it("reloads fresh full-Admin authority and a fresh target in the serializable transaction", async () => {
    for (const actorUserId of ["actor-ordinary", "actor-reviewer"]) {
      const database = createDatabase()
      await assert.rejects(() => grant(database, { actorUserId }), /Full administration requires verified database authority/)
      assert.deepEqual(counts(database.state), { grants: 0, revocations: 0, actions: 0, activities: 0, intents: 0 })
    }

    const database = createDatabase()
    await assert.rejects(() => grant(database, { targetUserId: "missing-target" }), /Target account was not found/)
    assert.deepEqual(counts(database.state), { grants: 0, revocations: 0, actions: 0, activities: 0, intents: 0 })
  })

  it("requires a fresh verified target with a usable normalized email before mutation or replay", async () => {
    for (const targetUserId of ["target-unverified", "target-no-email", "target-blank-email"]) {
      const database = createDatabase()
      await assert.rejects(
        () => grant(database, { targetUserId }),
        /verified target account with an email/i,
      )
      assert.deepEqual(counts(database.state), { grants: 0, revocations: 0, actions: 0, activities: 0, intents: 0 })
    }

    const replayDatabase = createDatabase()
    await grant(replayDatabase)
    replayDatabase.state.users.get("target-user").emailVerified = null
    const replayCounts = counts(replayDatabase.state)
    await assert.rejects(() => grant(replayDatabase), /verified target account with an email/i)
    assert.deepEqual(counts(replayDatabase.state), replayCounts)

    const revokeDatabase = createDatabase()
    const created = await grant(revokeDatabase)
    revokeDatabase.state.users.get("target-user").email = "   "
    const revokeCounts = counts(revokeDatabase.state)
    await assert.rejects(() => revoke(revokeDatabase, created.grantId), /verified target account with an email/i)
    assert.deepEqual(counts(revokeDatabase.state), revokeCounts)
  })

  it("rejects excluded keys, invalid days, and malformed snapshots before opening a transaction", async () => {
    for (const featureKey of ["chimer_custom_colors", "practice_management", "phi_storage_tools", "unknown"]) {
      const database = createDatabase()
      await assert.rejects(() => grant(database, { featureKey }), /temporary access feature/i)
      assert.equal(database.transactionAttempts, 0)
    }
    for (const durationDays of [0, 0.5, 366, Number.NaN]) {
      const database = createDatabase()
      await assert.rejects(() => grant(database, { durationDays }), /whole number of days from 1 through 365/i)
      assert.equal(database.transactionAttempts, 0)
    }
    for (const expectedActiveGrantIds of ["grant-1", [""], ["grant-1", "grant-1"]]) {
      const database = createDatabase()
      await assert.rejects(() => grant(database, { expectedActiveGrantIds }), /active grant snapshot/i)
      assert.equal(database.transactionAttempts, 0)
    }
  })

  it("accepts the inclusive one-day and 365-day grant bounds", async () => {
    for (const durationDays of [1, 365]) {
      const database = createDatabase()
      const result = await grant(database, { durationDays })
      assert.equal(result.expiresAt, new Date(NOW.getTime() + durationDays * DAY_MS).toISOString())
    }
  })

  it("allows the 100th active grant for one feature and rejects the 101st without writes", async () => {
    for (const activeCount of [99, 100]) {
      const grants = Array.from({ length: activeCount }, (_, index) => seededGrant(`seed-${String(index).padStart(3, "0")}`))
      const expectedActiveGrantIds = grants.map(({ id }) => id).sort()
      const database = createDatabase({ grants })
      const before = counts(database.state)
      if (activeCount === 99) {
        await grant(database, { expectedActiveGrantIds })
        assert.equal(database.state.grants.size, 100)
      } else {
        await assert.rejects(
          () => grant(database, { expectedActiveGrantIds }),
          (error) => error.code === "FEATURE_ACTIVE_GRANT_LIMIT"
            && error.message === "Temporary access has reached the active grant limit of 100 for this feature.",
        )
        assert.deepEqual(counts(database.state), before)
      }
    }
  })

  it("lists 100 active grants for every allowlisted feature and fails closed on per-feature or total overflow", async () => {
    const grants = ADMIN_GRANTABLE_FEATURE_KEYS.flatMap((featureKey) => (
      Array.from({ length: 100 }, (_, index) => seededGrant(`${featureKey}-${String(index).padStart(3, "0")}`, featureKey))
    ))
    const database = createDatabase({ grants })
    const active = await listActiveTemporaryFeatureAccess({ prismaClient: database, userId: "target-user", now: NOW })
    assert.equal(active.length, 500)
    for (const featureKey of ADMIN_GRANTABLE_FEATURE_KEYS) {
      assert.equal(active.filter((grant) => grant.featureKey === featureKey).length, 100)
    }

    const perFeatureOverflow = createDatabase({
      grants: Array.from({ length: 101 }, (_, index) => seededGrant(`premium-${String(index).padStart(3, "0")}`)),
    })
    await assert.rejects(
      () => listActiveTemporaryFeatureAccess({ prismaClient: perFeatureOverflow, userId: "target-user", now: NOW }),
      (error) => error.code === "TOO_MANY_ACTIVE_GRANTS"
        && /more than 100 active grants for one feature/i.test(error.message),
    )

    const overflow = createDatabase({ grants: [...grants, seededGrant("overflow")] })
    await assert.rejects(
      () => listActiveTemporaryFeatureAccess({ prismaClient: overflow, userId: "target-user", now: NOW }),
      (error) => error.code === "TOO_MANY_ACTIVE_GRANTS"
        && /more than 500 active grants/i.test(error.message),
    )
  })

  it("projects at most 100 privacy-safe temporary sources for one feature and fails closed on overflow", async () => {
    const rows = Array.from({ length: 100 }, (_, index) => ({
      id: `grant-${String(index).padStart(3, "0")}`,
      featureKey: "premium_backgrounds",
      startsAt: new Date(NOW),
      expiresAt: new Date(NOW.getTime() + (index + 1) * DAY_MS),
      grantedById: "privacy-actor-sentinel",
      internalNote: "privacy-note-sentinel",
      idempotencyKey: "privacy-operation-sentinel",
    }))
    const entitlementClient = {
      membershipSubscription: { findMany: async () => [] },
      studentAccess: { findUnique: async () => null },
      userRole: { findFirst: async () => null },
      temporaryFeatureGrant: { findMany: async () => rows },
    }
    const entitlementState = await getUserEntitlementState(entitlementClient, "target-user", NOW)
    const temporarySources = entitlementState.featureAccess
      .find(({ featureKey }) => featureKey === "premium_backgrounds")
      ?.sources.filter(({ source }) => source === "temporary")
    assert.equal(temporarySources?.length, 100)
    const serializedProjection = JSON.stringify(entitlementState.featureAccess)
    for (const sentinel of ["grant-000", "privacy-actor-sentinel", "privacy-note-sentinel", "privacy-operation-sentinel"]) {
      assert.doesNotMatch(serializedProjection, new RegExp(sentinel))
    }

    entitlementClient.temporaryFeatureGrant.findMany = async () => [
      ...rows,
      { ...rows[0], id: "grant-overflow", expiresAt: new Date(NOW.getTime() + 101 * DAY_MS) },
    ]
    await assert.rejects(
      () => getUserEntitlementState(entitlementClient, "target-user", NOW),
      (error) => error.message === "Temporary access has more than 100 active grants for one feature and cannot be resolved safely.",
    )
  })

  it("fails closed when the sorted active-grant snapshot is stale", async () => {
    const database = createDatabase()
    const first = await grant(database)
    const before = counts(database.state)

    await assert.rejects(
      () => grant(database, {
        idempotencyKey: "temporary-grant-operation-2",
        expectedActiveGrantIds: [],
      }),
      (error) => error.code === "STALE_ACTIVE_GRANT_SNAPSHOT"
        && error.message === "Temporary access changed since this operation was prepared. Refresh the account and try again.",
    )
    assert.deepEqual(counts(database.state), before)

    const second = await grant(database, {
      idempotencyKey: "temporary-grant-operation-2",
      expectedActiveGrantIds: [first.grantId],
      durationDays: 45,
    })
    assert.equal(second.grantId, "grant-2")
  })

  it("keeps overlapping grants independently visible in deterministic expiry/id order", async () => {
    const database = createDatabase()
    const first = await grant(database, { durationDays: 45 })
    const second = await grant(database, {
      idempotencyKey: "temporary-grant-operation-2",
      durationDays: 15,
      expectedActiveGrantIds: [first.grantId],
    })

    const active = await listActiveTemporaryFeatureAccess({
      prismaClient: database,
      userId: "target-user",
      now: NOW,
    })
    assert.deepEqual(active, [
      {
        grantId: second.grantId,
        featureKey: "premium_backgrounds",
        startsAt: NOW.toISOString(),
        expiresAt: second.expiresAt,
      },
      {
        grantId: first.grantId,
        featureKey: "premium_backgrounds",
        startsAt: NOW.toISOString(),
        expiresAt: first.expiresAt,
      },
    ])
  })

  it("uses startsAt <= now, expiresAt > now, and revocation null as the exact active predicate", async () => {
    const grants = [
      { id: "active", userId: "target-user", featureKey: "premium_backgrounds", startsAt: new Date(NOW), expiresAt: new Date(NOW.getTime() + DAY_MS), grantedById: "actor-admin", reasonCode: "ACCESS_REMEDIATION", internalNote: null, idempotencyKey: "seed-active", createdAt: new Date(NOW) },
      { id: "future", userId: "target-user", featureKey: "premium_backgrounds", startsAt: new Date(NOW.getTime() + 1), expiresAt: new Date(NOW.getTime() + DAY_MS), grantedById: "actor-admin", reasonCode: "ACCESS_REMEDIATION", internalNote: null, idempotencyKey: "seed-future", createdAt: new Date(NOW) },
      { id: "expired", userId: "target-user", featureKey: "premium_backgrounds", startsAt: new Date(NOW.getTime() - DAY_MS), expiresAt: new Date(NOW), grantedById: "actor-admin", reasonCode: "ACCESS_REMEDIATION", internalNote: null, idempotencyKey: "seed-expired", createdAt: new Date(NOW) },
      { id: "revoked", userId: "target-user", featureKey: "premium_backgrounds", startsAt: new Date(NOW.getTime() - DAY_MS), expiresAt: new Date(NOW.getTime() + DAY_MS), grantedById: "actor-admin", reasonCode: "ACCESS_REMEDIATION", internalNote: null, idempotencyKey: "seed-revoked", createdAt: new Date(NOW) },
    ]
    const database = createDatabase({ grants, revocations: [{ id: "revoke-1", grantId: "revoked", revokedById: "actor-admin", reasonCode: "ACCESS_REMEDIATION", internalNote: null, idempotencyKey: "seed-revocation", revokedAt: new Date(NOW) }] })

    const active = await listActiveTemporaryFeatureAccess({ prismaClient: database, userId: "target-user", now: NOW })
    assert.deepEqual(active.map((grant) => grant.grantId), ["active"])
  })

  it("appends a revocation without changing the grant and preserves effective overlap", async () => {
    const database = createDatabase()
    const first = await grant(database, { durationDays: 45 })
    const second = await grant(database, {
      idempotencyKey: "temporary-grant-operation-2",
      expectedActiveGrantIds: [first.grantId],
      durationDays: 15,
    })
    const storedBefore = structuredClone(database.state.grants.get(first.grantId))

    const result = await revoke(database, first.grantId, {
      expectedActiveGrantIds: [second.grantId, first.grantId],
    })

    assert.deepEqual(result, {
      kind: "revoke",
      grantId: first.grantId,
      featureKey: "premium_backgrounds",
      featureStillActive: true,
      expiresAt: first.expiresAt,
      replayed: false,
      emailIntentId: "intent-3",
    })
    assert.deepEqual(database.state.grants.get(first.grantId), storedBefore)
    assert.equal(database.state.revocations.get(first.grantId).revokedById, "actor-admin")
    const action = database.state.actions.get(`temporary-revoke-${first.grantId}`)
    assert.equal(action.afterState.effective, true)
    assert.match(database.state.activities.get(action.id).explanation, /Premium backgrounds/)
    assert.doesNotMatch(database.state.activities.get(action.id).explanation, /premium_backgrounds/)
    const active = await listActiveTemporaryFeatureAccess({ prismaClient: database, userId: "target-user", now: NOW })
    assert.deepEqual(active.map((grant) => grant.grantId), [second.grantId])
  })

  it("rejects future, expired, already-revoked, wrong-target, and stale revoke requests with exact safe outcomes", async () => {
    const grants = [
      { id: "future", userId: "target-user", featureKey: "premium_backgrounds", startsAt: new Date(NOW.getTime() + 1), expiresAt: new Date(NOW.getTime() + DAY_MS), grantedById: "actor-admin", reasonCode: "ACCESS_REMEDIATION", internalNote: null, idempotencyKey: "seed-future", createdAt: new Date(NOW) },
      { id: "expired", userId: "target-user", featureKey: "premium_backgrounds", startsAt: new Date(NOW.getTime() - DAY_MS), expiresAt: new Date(NOW), grantedById: "actor-admin", reasonCode: "ACCESS_REMEDIATION", internalNote: null, idempotencyKey: "seed-expired", createdAt: new Date(NOW) },
      { id: "other-target", userId: "target-two", featureKey: "premium_backgrounds", startsAt: new Date(NOW), expiresAt: new Date(NOW.getTime() + DAY_MS), grantedById: "actor-admin", reasonCode: "ACCESS_REMEDIATION", internalNote: null, idempotencyKey: "seed-other", createdAt: new Date(NOW) },
      { id: "revoked", userId: "target-user", featureKey: "premium_backgrounds", startsAt: new Date(NOW), expiresAt: new Date(NOW.getTime() + DAY_MS), grantedById: "actor-admin", reasonCode: "ACCESS_REMEDIATION", internalNote: null, idempotencyKey: "seed-revoked", createdAt: new Date(NOW) },
    ]
    for (const { grantId, expectedActiveGrantIds, code, message } of [
      { grantId: "future", expectedActiveGrantIds: ["future"], code: "STALE_ACTIVE_GRANT_SNAPSHOT", message: "Temporary access changed since this operation was prepared. Refresh the account and try again." },
      { grantId: "expired", expectedActiveGrantIds: ["expired"], code: "STALE_ACTIVE_GRANT_SNAPSHOT", message: "Temporary access changed since this operation was prepared. Refresh the account and try again." },
      { grantId: "other-target", expectedActiveGrantIds: ["other-target"], code: "WRONG_TARGET_GRANT", message: "The temporary feature grant does not belong to this target account." },
      { grantId: "revoked", expectedActiveGrantIds: ["revoked"], code: "STALE_ACTIVE_GRANT_SNAPSHOT", message: "Temporary access changed since this operation was prepared. Refresh the account and try again." },
    ]) {
      const selectedGrant = grants.find((grant) => grant.id === grantId)
      const revocations = grantId === "revoked" ? [{ id: "revoke-seed", grantId, revokedById: "actor-admin", reasonCode: "ACCESS_REMEDIATION", internalNote: null, idempotencyKey: "seed-revoke", revokedAt: new Date(NOW) }] : []
      const database = createDatabase({ grants: [selectedGrant], revocations })
      await assert.rejects(
        () => revoke(database, grantId, { expectedActiveGrantIds }),
        (error) => error.code === code && error.message === message,
      )
      assert.equal(database.state.actions.size, 0)
    }

    const database = createDatabase({ grants: [grants[0]] })
    await assert.rejects(
      () => revoke(database, "future", { expectedActiveGrantIds: ["future", "stale"] }),
      (error) => error.code === "STALE_ACTIVE_GRANT_SNAPSHOT"
        && error.message === "Temporary access changed since this operation was prepared. Refresh the account and try again.",
    )
  })

  it("assigns stable codes only to operator-safe mutation outcomes", async () => {
    const verified = createDatabase()
    await assert.rejects(
      () => grant(verified, { targetUserId: "target-unverified" }),
      (error) => error.code === "VERIFIED_TARGET_REQUIRED",
    )

    const stale = createDatabase()
    await grant(stale)
    await assert.rejects(
      () => grant(stale, { idempotencyKey: "another-operation", expectedActiveGrantIds: [] }),
      (error) => error.code === "STALE_ACTIVE_GRANT_SNAPSHOT",
    )

    const wrongTarget = createDatabase({ grants: [seededGrant("other", "premium_backgrounds", { userId: "target-two" })] })
    await assert.rejects(
      () => revoke(wrongTarget, "other"),
      (error) => error.code === "WRONG_TARGET_GRANT",
    )

  })

  it("replays only exact immutable grant and revoke inputs without new ledger or evidence rows", async () => {
    const database = createDatabase()
    const created = await grant(database)
    assert.deepEqual(await grant(database), { ...created, replayed: true })
    assert.deepEqual(counts(database.state), { grants: 1, revocations: 0, actions: 1, activities: 1, intents: 1 })

    for (const mismatch of [
      { actorUserId: "actor-admin-two" },
      { targetUserId: "target-two" },
      { featureKey: "calendar_basic_scheduling" },
      { durationDays: 31 },
      { expectedActiveGrantIds: [created.grantId] },
      { reasonCode: "ADMIN_CORRECTION" },
      { internalNote: "Different note." },
    ]) {
      await assert.rejects(() => grant(database, mismatch), /administrative operation key is already in use/i)
    }

    const revoked = await revoke(database, created.grantId)
    assert.deepEqual(await revoke(database, created.grantId), { ...revoked, replayed: true })
    assert.deepEqual(counts(database.state), { grants: 1, revocations: 1, actions: 2, activities: 2, intents: 2 })
    await assert.rejects(() => revoke(database, created.grantId, { internalNote: "Different note." }), /administrative operation key is already in use/i)
  })

  it("requires revoke snapshots to include the grant before opening a transaction", async () => {
    const database = createDatabase({ grants: [seededGrant("active")] })
    await assert.rejects(() => revoke(database, "active", { expectedActiveGrantIds: [] }), /snapshot.*grant.*revoked/i)
    assert.equal(database.transactionAttempts, 0)
    assert.deepEqual(counts(database.state), { grants: 1, revocations: 0, actions: 0, activities: 0, intents: 0 })
  })

  it("fails closed on coherently rewritten revocation effectiveness evidence", async () => {
    for (const overlap of [false, true]) {
      const database = createDatabase()
      const first = await grant(database)
      const expectedActiveGrantIds = [first.grantId]
      if (overlap) {
        const second = await grant(database, {
          idempotencyKey: "temporary-grant-operation-2",
          expectedActiveGrantIds,
        })
        expectedActiveGrantIds.push(second.grantId)
      }
      await revoke(database, first.grantId, { expectedActiveGrantIds })
      rewriteRevocationEffectiveEvidence(database, `temporary-revoke-${first.grantId}`, !overlap)
      const before = counts(database.state)
      await assert.rejects(
        () => revoke(database, first.grantId, { expectedActiveGrantIds }),
        /administrative operation key is already in use/i,
      )
      assert.deepEqual(counts(database.state), before)
    }
  })

  it("fails closed when replay evidence says revocation occurred outside the grant interval", async () => {
    for (const revokedAt of [new Date(NOW.getTime() - 1), new Date(NOW.getTime() + 30 * DAY_MS)]) {
      const database = createDatabase()
      const created = await grant(database)
      await revoke(database, created.grantId)
      const revocation = database.state.revocations.get(created.grantId)
      revocation.revokedAt = revokedAt
      database.state.actions.get(`temporary-revoke-${created.grantId}`).afterState.revokedAt = revokedAt.toISOString()
      await assert.rejects(() => revoke(database, created.grantId), /administrative operation key is already in use/i)
    }
  })

  it("serializes concurrent duplicate operation keys into one exact grant", async () => {
    const database = createDatabase()
    const [first, second] = await Promise.all([grant(database), grant(database)])

    assert.equal(first.grantId, second.grantId)
    assert.deepEqual([first.replayed, second.replayed].sort(), [false, true])
    assert.deepEqual(counts(database.state), { grants: 1, revocations: 0, actions: 1, activities: 1, intents: 1 })
  })

  it("serializes concurrent duplicate revocations into one append-only row", async () => {
    const database = createDatabase()
    const created = await grant(database)
    const [first, second] = await Promise.all([
      revoke(database, created.grantId),
      revoke(database, created.grantId),
    ])

    assert.equal(first.grantId, second.grantId)
    assert.deepEqual([first.replayed, second.replayed].sort(), [false, true])
    assert.deepEqual(counts(database.state), { grants: 1, revocations: 1, actions: 2, activities: 2, intents: 2 })
  })

  it("restarts a competing different-key revoke once, then fails on the fresh stale snapshot", async () => {
    const database = createDatabase()
    const created = await grant(database)
    const results = await Promise.allSettled([
      revoke(database, created.grantId, { idempotencyKey: "competing-revoke-a" }),
      revoke(database, created.grantId, { idempotencyKey: "competing-revoke-b" }),
    ])

    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1)
    const rejected = results.find((result) => result.status === "rejected")
    assert.match(rejected.reason.message, /temporary access changed since this operation was prepared/i)
    assert.deepEqual(counts(database.state), { grants: 1, revocations: 1, actions: 2, activities: 2, intents: 2 })
  })

  it("restarts after a committed AdminAction collision and rejects its mismatched winner evidence", async () => {
    const database = createDatabase({
      competingAdminBundleAfterSnapshot: {
        idempotencyKey: "temporary-grant-operation-1",
        actionKind: "COMPETING_ADMIN_OPERATION",
      },
    })

    await assert.rejects(() => grant(database), /administrative operation key is already in use/i)
    assert.equal(database.transactionAttempts, 2)
    assert.equal(database.adminActionCommittedConflicts, 1)
    assert.deepEqual(counts(database.state), { grants: 0, revocations: 0, actions: 1, activities: 1, intents: 1 })
    const winner = database.state.actions.get("temporary-grant-operation-1")
    assert.equal(winner.id, "competing-action-1")
    assert.equal(winner.actionKind, "COMPETING_ADMIN_OPERATION")
    assert.equal(database.state.activities.get(winner.id).title, "Competing operation committed")
    assert.equal(database.state.intents.get(winner.id).kind, "COMPETING_ADMIN_OPERATION")
  })

  it("rethrows a repeated exact race and never retries unrelated P2002 metadata", async () => {
    const repeated = createDatabase({
      grantCreateErrors: [
        uniqueConstraintError("TemporaryFeatureGrant", ["idempotencyKey"]),
        uniqueConstraintError("TemporaryFeatureGrant", ["idempotencyKey"]),
      ],
    })
    await assert.rejects(
      () => grant(repeated),
      (error) => error.code === "P2002" && error.meta?.modelName === "TemporaryFeatureGrant",
    )
    assert.equal(repeated.transactionAttempts, 2)
    assert.deepEqual(counts(repeated.state), { grants: 0, revocations: 0, actions: 0, activities: 0, intents: 0 })

    for (const error of [
      uniqueConstraintError("TemporaryFeatureGrant", ["id"]),
      uniqueConstraintError("UnrelatedModel", ["idempotencyKey"]),
    ]) {
      const unrelated = createDatabase({ grantCreateErrors: [error] })
      await assert.rejects(() => grant(unrelated), (actual) => actual === error)
      assert.equal(unrelated.transactionAttempts, 1)
      assert.deepEqual(counts(unrelated.state), { grants: 0, revocations: 0, actions: 0, activities: 0, intents: 0 })
    }
  })

  it("rolls back grant, revocation, action, activity, and email-intent failures", async () => {
    for (const failWrite of ["grant", "action", "activity", "intent"]) {
      const database = createDatabase({ failWrite })
      await assert.rejects(() => grant(database), new RegExp(`${failWrite} write failed`))
      assert.deepEqual(counts(database.state), { grants: 0, revocations: 0, actions: 0, activities: 0, intents: 0 })
    }

    for (const failWrite of ["revocation", "action", "activity", "intent"]) {
      const database = createDatabase()
      const created = await grant(database)
      database.state.actions = new Map()
      database.state.activities = new Map()
      database.state.intents = new Map()
      const failing = createDatabase({ grants: [...database.state.grants.values()], failWrite })
      const before = counts(failing.state)
      await assert.rejects(() => revoke(failing, created.grantId), new RegExp(`${failWrite} write failed`))
      assert.deepEqual(counts(failing.state), before)
    }
  })
})

function temporaryActionHarness({
  actorUserId = "admin-1",
  grantResult = {
    kind: "grant",
    grantId: "grant-1",
    featureKey: "premium_backgrounds",
    expiresAt: "2026-09-09T12:00:00.000Z",
    replayed: false,
    emailIntentId: "intent-grant",
  },
  revokeResult = {
    kind: "revoke",
    grantId: "grant-1",
    featureKey: "premium_backgrounds",
    featureStillActive: false,
    expiresAt: "2026-09-09T12:00:00.000Z",
    replayed: false,
    emailIntentId: "intent-revoke",
  },
  serviceError,
  deliveryResult = { status: "DELIVERED", attempted: true },
  deliveryError,
} = {}) {
  const calls = []
  const compiled = loadCompiledModule(
    temporaryActionSource,
    "app/admin/users/[userId]/temporary-access-actions.test.ts",
    {
      "next/cache": { revalidatePath(path) { calls.push(["revalidatePath", path]) } },
      "@/lib/admin/access": {
        async requireFullAdminUser() {
          calls.push(["requireFullAdminUser"])
          return { id: actorUserId }
        },
      },
      "@/lib/admin/email-intents": {
        async deliverAdminEmailIntent(input) {
          calls.push(["deliverAdminEmailIntent", input])
          if (deliveryError) throw deliveryError
          return deliveryResult
        },
      },
      "@/lib/admin/operation-contract": {
        ADMIN_REASON_CODES: ["ACCESS_REMEDIATION", "ADMIN_CORRECTION", "OTHER"],
        validateAdminReason(reasonCode, note) {
          calls.push(["validateAdminReason", reasonCode, note])
          if (!["ACCESS_REMEDIATION", "ADMIN_CORRECTION", "OTHER"].includes(reasonCode)) throw new Error("invalid reason")
          if (note?.length > 500 || (reasonCode === "OTHER" && !note?.trim())) throw new Error("invalid note")
        },
      },
      "@/lib/admin/temporary-access": {
        TEMPORARY_ACCESS_ERROR_CODES: temporaryAccess.TEMPORARY_ACCESS_ERROR_CODES,
        async grantTemporaryFeatureAccess(input) {
          calls.push(["grantTemporaryFeatureAccess", input])
          if (serviceError) throw serviceError
          return grantResult
        },
        async revokeTemporaryFeatureAccess(input) {
          calls.push(["revokeTemporaryFeatureAccess", input])
          if (serviceError) throw serviceError
          return revokeResult
        },
      },
      "@/lib/admin/temporary-access-contract": temporaryAccessContract,
      "@/lib/prisma": { prisma: { marker: "prisma" } },
      "@/lib/safe-error-code": {
        safeErrorCode() {
          calls.push(["safeErrorCode"])
          return "safe_failure"
        },
      },
    },
  )
  return {
    grantAction: compiled.grantTemporaryAccessAction,
    revokeAction: compiled.revokeTemporaryAccessAction,
    calls,
  }
}

function temporaryGrantForm(overrides = {}) {
  const { expectedActiveGrantIds = ["grant-a", "grant-b"], ...values } = overrides
  const formData = new FormData()
  for (const [key, value] of Object.entries({
    targetUserId: "user-1",
    operationId: UI_OPERATION_ID,
    featureKey: "premium_backgrounds",
    durationDays: "30",
    reasonCode: "ACCESS_REMEDIATION",
    internalNote: "Support access while the account is reviewed.",
    confirmation: "CONFIRM_TEMPORARY_ACCESS_GRANT",
    ...values,
  })) formData.set(key, value)
  for (const grantId of expectedActiveGrantIds) formData.append("expectedActiveGrantIds", grantId)
  return formData
}

function temporaryRevokeForm(overrides = {}) {
  const { expectedActiveGrantIds = ["grant-a", "grant-b"], ...values } = overrides
  const formData = new FormData()
  for (const [key, value] of Object.entries({
    targetUserId: "user-1",
    operationId: UI_REVOKE_OPERATION_ID,
    grantId: "grant-a",
    reasonCode: "ACCESS_REMEDIATION",
    internalNote: "The temporary support window has ended.",
    confirmation: "CONFIRM_TEMPORARY_ACCESS_REVOCATION",
    ...values,
  })) formData.set(key, value)
  for (const grantId of expectedActiveGrantIds) formData.append("expectedActiveGrantIds", grantId)
  return formData
}

describe("Admin temporary-access actions and controls", () => {
  it("authenticates before parsing and rejects route-target tampering without mutation", async () => {
    assert.match(temporaryActionSource, /^"use server"/)
    assert.doesNotMatch(temporaryActionSource, /randomUUID/)
    for (const [actionName, form] of [
      ["grantAction", temporaryGrantForm({ targetUserId: "user-2" })],
      ["revokeAction", temporaryRevokeForm({ targetUserId: "user-2" })],
    ]) {
      const harness = temporaryActionHarness()
      const result = await harness[actionName]("user-1", UI_IDLE_STATE, form)
      assert.equal(result.status, "error")
      assert.deepEqual(harness.calls, [["requireFullAdminUser"]])
    }
  })

  it("strictly parses UUID, feature, whole-day bounds, sorted snapshots, reason, note, and confirmation", async () => {
    const invalidGrantForms = [
      { operationId: "not-a-uuid" },
      { featureKey: "chimer_custom_colors" },
      { featureKey: "practice_management" },
      { durationDays: "0" },
      { durationDays: "366" },
      { durationDays: "1.5" },
      { durationDays: "1e2" },
      { expectedActiveGrantIds: ["grant-b", "grant-a"] },
      { expectedActiveGrantIds: ["grant-a", "grant-a"] },
      { expectedActiveGrantIds: [""] },
      { confirmation: "yes" },
      { reasonCode: "NOT_ALLOWED" },
      { reasonCode: "OTHER", internalNote: "" },
      { internalNote: "x".repeat(501) },
    ]
    for (const invalid of invalidGrantForms) {
      const harness = temporaryActionHarness()
      const result = await harness.grantAction("user-1", UI_IDLE_STATE, temporaryGrantForm(invalid))
      assert.equal(result.status, "error")
      assert.equal(harness.calls.some(([name]) => name === "grantTemporaryFeatureAccess"), false)
    }

    for (const invalid of [
      { operationId: "not-a-uuid" },
      { grantId: "" },
      { expectedActiveGrantIds: ["grant-b", "grant-a"] },
      { expectedActiveGrantIds: ["grant-a", "grant-a"] },
      { expectedActiveGrantIds: ["grant-b"] },
      { confirmation: "yes" },
      { reasonCode: "OTHER", internalNote: "" },
    ]) {
      const harness = temporaryActionHarness()
      const result = await harness.revokeAction("user-1", UI_IDLE_STATE, temporaryRevokeForm(invalid))
      assert.equal(result.status, "error")
      assert.equal(harness.calls.some(([name]) => name === "revokeTemporaryFeatureAccess"), false)
    }
  })

  it("maps only allowlisted service error codes to operator-safe display messages", async () => {
    const stale = temporaryActionHarness({
      serviceError: Object.assign(new Error("private stale detail"), { code: "STALE_ACTIVE_GRANT_SNAPSHOT" }),
    })
    const staleResult = await stale.grantAction("user-1", UI_IDLE_STATE, temporaryGrantForm())
    assert.deepEqual(staleResult, {
      status: "error",
      message: "Temporary access changed since this operation was prepared. Refresh the account and try again.",
    })

    const spoofed = temporaryActionHarness({
      serviceError: new Error("Temporary access changed since this operation was prepared. Refresh the account and try again."),
    })
    const spoofedResult = await spoofed.grantAction("user-1", UI_IDLE_STATE, temporaryGrantForm())
    assert.deepEqual(spoofedResult, {
      status: "error",
      message: "Temporary access could not be granted. Refresh the account and try again.",
    })
  })

  it("calls exactly one canonical mutation, then locked delivery and every affected revalidation", async () => {
    const grantHarness = temporaryActionHarness()
    const grantResult = await grantHarness.grantAction("user-1", UI_IDLE_STATE, temporaryGrantForm())
    assert.equal(grantResult.status, "success")
    assert.deepEqual(grantHarness.calls.slice(0, 4), [
      ["requireFullAdminUser"],
      ["validateAdminReason", "ACCESS_REMEDIATION", "Support access while the account is reviewed."],
      ["grantTemporaryFeatureAccess", {
        prismaClient: { marker: "prisma" },
        actorUserId: "admin-1",
        targetUserId: "user-1",
        featureKey: "premium_backgrounds",
        durationDays: 30,
        expectedActiveGrantIds: ["grant-a", "grant-b"],
        reasonCode: "ACCESS_REMEDIATION",
        internalNote: "Support access while the account is reviewed.",
        idempotencyKey: UI_OPERATION_ID,
      }],
      ["deliverAdminEmailIntent", { prismaClient: { marker: "prisma" }, intentId: "intent-grant" }],
    ])
    assert.equal(grantHarness.calls.filter(([name]) => name === "grantTemporaryFeatureAccess").length, 1)
    assert.equal(grantHarness.calls.filter(([name]) => name === "revokeTemporaryFeatureAccess").length, 0)
    assert.deepEqual(grantHarness.calls.slice(4), expectedTemporaryRevalidations())

    const revokeHarness = temporaryActionHarness()
    const revokeResult = await revokeHarness.revokeAction("user-1", UI_IDLE_STATE, temporaryRevokeForm())
    assert.equal(revokeResult.status, "success")
    assert.deepEqual(revokeHarness.calls.slice(0, 4), [
      ["requireFullAdminUser"],
      ["validateAdminReason", "ACCESS_REMEDIATION", "The temporary support window has ended."],
      ["revokeTemporaryFeatureAccess", {
        prismaClient: { marker: "prisma" },
        actorUserId: "admin-1",
        targetUserId: "user-1",
        grantId: "grant-a",
        expectedActiveGrantIds: ["grant-a", "grant-b"],
        reasonCode: "ACCESS_REMEDIATION",
        internalNote: "The temporary support window has ended.",
        idempotencyKey: UI_REVOKE_OPERATION_ID,
      }],
      ["deliverAdminEmailIntent", { prismaClient: { marker: "prisma" }, intentId: "intent-revoke" }],
    ])
    assert.equal(revokeHarness.calls.filter(([name]) => name === "revokeTemporaryFeatureAccess").length, 1)
    assert.equal(revokeHarness.calls.filter(([name]) => name === "grantTemporaryFeatureAccess").length, 0)
    assert.deepEqual(revokeHarness.calls.slice(4), expectedTemporaryRevalidations())
  })

  it("keeps mutation, replay, and locked email outcomes distinct without claiming global feature removal", async () => {
    const failedGrant = temporaryActionHarness({ deliveryResult: { status: "FAILED", attempted: true } })
    const failedGrantResult = await failedGrant.grantAction("user-1", UI_IDLE_STATE, temporaryGrantForm())
    assert.equal(failedGrantResult.status, "warning")
    assert.match(failedGrantResult.message, /temporary Premium backgrounds access was granted through/i)
    assert.match(failedGrantResult.message, /email notification failed/i)
    assert.match(failedGrantResult.message, /Retry it from Activity/i)

    const replayedGrant = temporaryActionHarness({
      grantResult: {
        kind: "grant", grantId: "grant-1", featureKey: "premium_backgrounds",
        expiresAt: "2026-09-09T12:00:00.000Z", replayed: true, emailIntentId: "intent-grant",
      },
      deliveryResult: { status: "DELIVERED", attempted: false },
    })
    const replayedGrantResult = await replayedGrant.grantAction("user-1", UI_IDLE_STATE, temporaryGrantForm())
    assert.match(replayedGrantResult.message, /already completed/i)
    assert.match(replayedGrantResult.message, /already delivered; this invocation made no new send attempt/i)
    assert.doesNotMatch(replayedGrantResult.message, /granted again|new grant/i)

    const revoked = temporaryActionHarness()
    const revokedResult = await revoked.revokeAction("user-1", UI_IDLE_STATE, temporaryRevokeForm())
    assert.match(revokedResult.message, /one temporary Premium backgrounds grant was revoked/i)
    assert.match(revokedResult.message, /membership or temporary sources may still keep this feature available/i)
    assert.doesNotMatch(revokedResult.message, /feature access (?:was|is) removed|no longer has/i)
  })

  it("never promises the hidden Activity retry control for a self-target delivery failure", async () => {
    for (const [replayed, attempted] of [[false, true], [true, false]]) {
      const harness = temporaryActionHarness({
        actorUserId: "user-1",
        grantResult: {
          kind: "grant", grantId: "grant-1", featureKey: "premium_backgrounds",
          expiresAt: "2026-09-09T12:00:00.000Z", replayed, emailIntentId: "intent-grant",
        },
        deliveryResult: { status: "FAILED", attempted },
      })
      const result = await harness.grantAction("user-1", UI_IDLE_STATE, temporaryGrantForm())
      assert.equal(result.status, "warning")
      assert.match(result.message, /Check Activity for the recorded notification status/i)
      assert.doesNotMatch(result.message, /retry/i)
    }
  })

  it("renders the exact low-risk labels, presets, custom bounds, one-time preview, and confirmation reset", () => {
    assert.match(adminDetailPageSource, /const requestNow = new Date\(\)/)
    assert.match(adminDetailPageSource, /now: requestNow/)
    assert.match(adminDetailPageSource, /temporaryGrant: randomUUID\(\)/)
    assert.match(adminDetailPageSource, /revokeOperationId: randomUUID\(\)/)
    assert.match(adminDetailPageSource, /preparedAt=\{requestNow\.toISOString\(\)\}/)
    for (const [key, label] of [
      ["premium_backgrounds", "Premium backgrounds"],
      ["therapist_documentation_tools", "Therapist documentation tools"],
      ["calendar_basic_scheduling", "Basic calendar scheduling"],
      ["calendar_full_scheduling", "Full calendar scheduling"],
      ["external_calendar_sync", "External calendar sync"],
    ]) {
      assert.equal(temporaryAccessContract.ADMIN_TEMPORARY_ACCESS_FEATURE_LABELS[key], label)
    }
    for (const days of [7, 30, 90]) assert.match(temporaryFormSource, new RegExp(`\\b${days}\\b`))
    assert.match(temporaryFormSource, /name="durationDays"[\s\S]*type="number"[\s\S]*min=\{TEMPORARY_ACCESS_MIN_DAYS\}[\s\S]*max=\{TEMPORARY_ACCESS_MAX_DAYS\}[\s\S]*step=\{1\}/)
    assert.match(temporaryFormSource, /preparedAt[\s\S]*startsAt[\s\S]*expiresAt/)
    assert.match(temporaryFormSource, /updateFeature[\s\S]*setConfirmed\(false\)/)
    assert.match(temporaryFormSource, /updateDuration[\s\S]*setConfirmed\(false\)/)
    assert.match(temporaryFormSource, /aria-live="polite"/)
    assert.match(temporaryFormSource, /aria-live="assertive"/)
    assert.doesNotMatch(temporaryFormSource, /chimer_custom_colors|practice_management|calendar_team_scheduling|cloud_storage|phi_storage_tools/)
  })

  it("shows bounded active grants independently while suppressing sensitive evidence and unsafe controls", () => {
    assert.match(adminDetailPageSource, /readTemporaryGrantEvidence/)
    assert.match(adminDetailPageSource, /detail\.emailVerified === true && isUsableEmail\(normalizedTargetEmail\)/)
    assert.match(adminDetailPageSource, /temporaryGrants\.truncated|evidence\.truncated/)
    assert.match(adminDetailPageSource, /complete active (?:grant )?snapshot/i)
    assert.match(adminDetailPageSource, /<TemporaryAccessControls/)
    assert.match(temporaryFormSource, /Active temporary grants/)
    assert.match(temporaryFormSource, /Showing \{grants\.length\} of \{totalGrantCount\}/)
    assert.match(temporaryFormSource, /append-only revocation/i)
    assert.doesNotMatch(temporaryFormSource, /grantedById|revokedById|idempotencyKey|actorUserId/)
    assert.match(adminDetailPageSource, /temporaryGrantMutationSnapshot/)
    assert.match(adminDetailPageSource, /complete:\s*true/)
    assert.doesNotMatch(adminDetailPageSource, /complete:\s*!truncated/)

    const { TemporaryAccessControls } = temporaryAccessUiHarness()
    const expectedActiveGrantIds = Object.fromEntries(
      ADMIN_GRANTABLE_FEATURE_KEYS.map((featureKey) => [featureKey, featureKey === "premium_backgrounds" ? ["grant-a"] : []]),
    )
    const tree = renderFunctionComponents(TemporaryAccessControls({
      userId: "user-1",
      targetLabel: "Target User",
      preparedAt: NOW.toISOString(),
      grantOperationId: UI_OPERATION_ID,
      expectedActiveGrantIds,
      grants: [{
        grantId: "grant-a",
        featureKey: "premium_backgrounds",
        startsAt: NOW.toISOString(),
        expiresAt: new Date(NOW.getTime() + DAY_MS).toISOString(),
        revokeOperationId: UI_REVOKE_OPERATION_ID,
      }],
      totalGrantCount: 30,
      truncated: true,
      controlsAvailable: true,
    }))
    const activeRows = findElements(tree, (element) => element.props["data-temporary-grant"] === "active")
    const featureOptions = findElements(
      tree,
      (element) => element.type === "option" && ADMIN_GRANTABLE_FEATURE_KEYS.includes(element.props.value),
    )
    assert.deepEqual(featureOptions.map((option) => [option.props.value, elementText(option)]), [
      ["premium_backgrounds", "Premium backgrounds"],
      ["therapist_documentation_tools", "Therapist documentation tools"],
      ["calendar_basic_scheduling", "Basic calendar scheduling"],
      ["calendar_full_scheduling", "Full calendar scheduling"],
      ["external_calendar_sync", "External calendar sync"],
    ])
    const presetButtons = findElements(tree, (element) => element.type === "button")
      .filter((button) => /^(7|30|90) days$/.test(elementText(button)))
    assert.deepEqual(presetButtons.map((button) => elementText(button)), ["7 days", "30 days", "90 days"])
    const durationInput = findElement(tree, (element) => element.type === "input" && element.props.name === "durationDays")
    assert.deepEqual(
      { min: durationInput?.props.min, max: durationInput?.props.max, step: durationInput?.props.step },
      { min: 1, max: 365, step: 1 },
    )
    assert.match(elementText(tree), /I confirm this exact temporary grant gives Premium backgrounds access for 7 days\./)
    const previewStarts = findElement(tree, (element) => element.props["data-temporary-preview"] === "starts")
    const previewExpires = findElement(tree, (element) => element.props["data-temporary-preview"] === "expires")
    assert.deepEqual(
      [previewStarts?.props.dateTime, elementText(previewStarts), previewExpires?.props.dateTime, elementText(previewExpires)],
      [NOW.toISOString(), "Aug 10, 2026, 12:00:00 PM UTC", "2026-08-17T12:00:00.000Z", "Aug 17, 2026, 12:00:00 PM UTC"],
    )
    const evidenceStarts = findElement(tree, (element) => element.props["data-temporary-evidence"] === "starts")
    const evidenceExpires = findElement(tree, (element) => element.props["data-temporary-evidence"] === "expires")
    assert.deepEqual(
      [evidenceStarts?.props.dateTime, elementText(evidenceStarts), evidenceExpires?.props.dateTime, elementText(evidenceExpires)],
      ["2026-08-10T12:00:00.000Z", "Aug 10, 2026, 12:00:00 PM UTC", "2026-08-11T12:00:00.000Z", "Aug 11, 2026, 12:00:00 PM UTC"],
    )
    assert.equal(activeRows.length, 1)
    assert.match(elementText(tree), /Showing 1 of 30 active temporary grants/)
    assert.doesNotMatch(elementText(tree), /actor|idempotency|granted by|revoked by/i)
  })

  it("renders stable UTC evidence hooks and labels only the submitted revoke form as pending", () => {
    assert.match(temporaryFormSource, /useFormStatus/)
    assert.match(temporaryFormSource, /data-temporary-evidence=\{evidence\}/)
    assert.match(temporaryFormSource, /data-temporary-starts-at=\{grant\.startsAt\}/)
    assert.match(temporaryFormSource, /data-temporary-expires-at=\{grant\.expiresAt\}/)
    assert.match(temporaryFormSource, /disabled=\{revokePending \|\| !canSubmit\}/)
    assert.match(temporaryFormSource, /pending \? "Revoking temporary grant…" : "Revoke this temporary grant"/)
    assert.match(temporaryFormSource, /timeZone:\s*"UTC"|formatTemporaryAccessUtc/)
    assert.doesNotMatch(temporaryFormSource, /\.toLocaleString\(\)/)

    const { TemporaryAccessControls } = temporaryAccessUiHarness({ formPending: true })
    const pendingTree = renderFunctionComponents(TemporaryAccessControls({
      userId: "user-1",
      targetLabel: "Target User",
      preparedAt: NOW.toISOString(),
      grantOperationId: UI_OPERATION_ID,
      expectedActiveGrantIds: Object.fromEntries(
        ADMIN_GRANTABLE_FEATURE_KEYS.map((featureKey) => [featureKey, featureKey === "premium_backgrounds" ? ["grant-a"] : []]),
      ),
      grants: [{
        grantId: "grant-a",
        featureKey: "premium_backgrounds",
        startsAt: NOW.toISOString(),
        expiresAt: "2026-08-11T12:00:00.000Z",
        revokeOperationId: UI_REVOKE_OPERATION_ID,
      }],
      totalGrantCount: 1,
      truncated: false,
      controlsAvailable: true,
    }))
    assert.match(elementText(pendingTree), /Revoking temporary grant…/)
    assert.doesNotMatch(elementText(pendingTree), /Revoke this temporary grant/)
  })

  it("remounts a surviving revoke form on its fresh server operation key after a sibling revoke", () => {
    const { TemporaryAccessControls } = temporaryAccessUiHarness()
    const expectedActiveGrantIds = {
      premium_backgrounds: ["grant-a", "grant-b"],
      therapist_documentation_tools: [],
      calendar_basic_scheduling: [],
      calendar_full_scheduling: [],
      external_calendar_sync: [],
    }
    const grant = (grantId, revokeOperationId) => ({
      grantId,
      featureKey: "premium_backgrounds",
      startsAt: "2026-08-10T12:00:00.000Z",
      expiresAt: "2026-08-24T12:00:00.000Z",
      revokeOperationId,
    })
    const props = {
      userId: "user-1",
      targetLabel: "Target User",
      preparedAt: "2026-08-10T12:00:00.000Z",
      grantOperationId: UI_OPERATION_ID,
      expectedActiveGrantIds,
      totalGrantCount: 2,
      truncated: false,
      controlsAvailable: true,
    }
    const before = TemporaryAccessControls({
      ...props,
      grants: [grant("grant-a", "revoke-operation-a-old"), grant("grant-b", "revoke-operation-b")],
    })
    const after = TemporaryAccessControls({
      ...props,
      expectedActiveGrantIds: { ...expectedActiveGrantIds, premium_backgrounds: ["grant-a"] },
      grants: [grant("grant-a", "revoke-operation-a-fresh")],
      totalGrantCount: 1,
    })
    const survivingForm = (tree) => findElement(
      tree,
      (element) => typeof element.type === "function"
        && element.type.name === "RevokeGrantForm"
        && element.props.grant.grantId === "grant-a",
    )

    assert.equal(survivingForm(before).key, "revoke-operation-a-old")
    assert.equal(survivingForm(after).key, "revoke-operation-a-fresh")
    assert.match(temporaryFormSource, /function RevokeGrantForm[\s\S]*const \[reasonCode, setReasonCode\] = useState\(""\)/)
    assert.match(temporaryFormSource, /function RevokeGrantForm[\s\S]*const \[internalNote, setInternalNote\] = useState\(""\)/)
    assert.match(temporaryFormSource, /function RevokeGrantForm[\s\S]*const \[confirmed, setConfirmed\] = useState\(false\)/)
  })
})

function expectedTemporaryRevalidations() {
  return [
    ["revalidatePath", "/admin/users/user-1"],
    ["revalidatePath", "/admin/users"],
    ["revalidatePath", "/admin"],
    ["revalidatePath", "/account"],
  ]
}
