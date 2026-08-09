import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { changeAnatomyRole } from "../lib/admin/role-service.ts"

const ACTOR_ID = "admin-1"
const TARGET_ID = "user-1"

function changeInput(overrides = {}) {
  return {
    prismaClient: overrides.prismaClient,
    actorUserId: ACTOR_ID,
    targetUserId: TARGET_ID,
    role: "ANATOMY_REVIEWER",
    operation: "ASSIGN",
    expectedStatus: "ABSENT",
    reasonCode: "ROLE_ASSIGNMENT",
    internalNote: "Approved anatomy review access.",
    idempotencyKey: "role-change-1",
    ...overrides,
  }
}

describe("delegated anatomy role changes", () => {
  it("assigns a reviewer, revokes target sessions, and writes one evidence bundle", async () => {
    const database = createRoleDatabase()
    database.sessions.push({ id: "session-1", userId: TARGET_ID }, { id: "session-2", userId: TARGET_ID })

    const result = await changeAnatomyRole(changeInput({ prismaClient: database }))

    assert.deepEqual(result.beforeRoles, ["USER"])
    assert.deepEqual(result.afterRoles, ["ANATOMY_REVIEWER", "USER"])
    assert.equal(result.revokedSessionCount, 2)
    assert.equal(result.emailIntentId, "intent-1")
    assert.equal(result.replayed, false)
    const reviewerAssignment = database.roles.find((assignment) => assignment.userId === TARGET_ID && assignment.role === "ANATOMY_REVIEWER")
    assert.ok(reviewerAssignment.verifiedAt instanceof Date)
    assert.deepEqual({ ...reviewerAssignment, verifiedAt: "recorded" }, {
      id: "role-2",
      userId: TARGET_ID,
      role: "ANATOMY_REVIEWER",
      status: "VERIFIED",
      source: "admin",
      metadata: {},
      verifiedAt: "recorded",
      expiresAt: null,
      revokedAt: null,
      grantedById: ACTOR_ID,
    })
    assert.equal(database.sessions.length, 0)
    assert.equal(database.actions.length, 1)
    assert.equal(database.activities.length, 1)
    assert.equal(database.intents.length, 1)
    assert.deepEqual(database.actions[0].beforeState.roles, ["USER"])
    assert.deepEqual(database.actions[0].afterState.roles, ["ANATOMY_REVIEWER", "USER"])
  })

  it("revokes a verified editor without creating or changing a reviewer assignment", async () => {
    const database = createRoleDatabase({
      targetRoles: [
        verifiedRole("USER", "role-user"),
        verifiedRole("ANATOMY_REVIEWER", "role-reviewer"),
        verifiedRole("ANATOMY_EDITOR", "role-editor"),
      ],
    })

    const result = await changeAnatomyRole(changeInput({
      prismaClient: database,
      role: "ANATOMY_EDITOR",
      operation: "REVOKE",
      expectedStatus: "VERIFIED",
      reasonCode: "ROLE_REVOCATION",
      idempotencyKey: "role-revoke-1",
    }))

    assert.deepEqual(result.beforeRoles, ["ANATOMY_EDITOR", "ANATOMY_REVIEWER", "USER"])
    assert.deepEqual(result.afterRoles, ["ANATOMY_REVIEWER", "USER"])
    assert.equal(database.roles.find((assignment) => assignment.id === "role-editor").status, "REVOKED")
    assert.equal(database.roles.find((assignment) => assignment.id === "role-reviewer").status, "VERIFIED")
    assert.equal(database.roles.filter((assignment) => assignment.role === "ANATOMY_REVIEWER").length, 1)
  })

  it("requires fresh verified full-Admin authority instead of session claims", async () => {
    for (const [label, actor] of [
      ["ordinary", user(ACTOR_ID, [verifiedRole("USER", "actor-user")])],
      ["pending", user(ACTOR_ID, [{ ...verifiedRole("ADMIN", "actor-admin"), status: "PENDING" }])],
      ["revoked", user(ACTOR_ID, [{ ...verifiedRole("ADMIN", "actor-admin"), status: "REVOKED" }])],
      ["unverified email", { ...user(ACTOR_ID, [verifiedRole("ADMIN", "actor-admin")]), emailVerified: null }],
    ]) {
      const database = createRoleDatabase({ actor })
      await assert.rejects(
        () => changeAnatomyRole(changeInput({ prismaClient: database })),
        /requires verified database authority/,
        label,
      )
      assert.equal(database.actions.length, 0)
      assert.equal(database.roles.length, 2)
    }
  })

  it("rejects a missing target and actor self-targeting", async () => {
    const missing = createRoleDatabase({ includeTarget: false })
    await assert.rejects(() => changeAnatomyRole(changeInput({ prismaClient: missing })), /Target account was not found/)

    const self = createRoleDatabase()
    await assert.rejects(
      () => changeAnatomyRole(changeInput({ prismaClient: self, targetUserId: ACTOR_ID })),
      /cannot change your own delegated anatomy role/,
    )
  })

  it("rejects ADMIN, retired anatomy-admin, generic editor, and malformed mutations", async () => {
    for (const role of ["ADMIN", "ANATOMY_ADMIN", "EDITOR"]) {
      const database = createRoleDatabase()
      await assert.rejects(
        () => changeAnatomyRole(changeInput({ prismaClient: database, role })),
        /Only delegated anatomy roles can be changed/,
      )
      assert.equal(database.actions.length, 0)
    }

    await assert.rejects(
      () => changeAnatomyRole(changeInput({ prismaClient: createRoleDatabase(), operation: "DELETE" })),
      /Select a valid anatomy role operation/,
    )
  })

  it("fails closed on stale expected state and invalid transition expectations", async () => {
    const stale = createRoleDatabase({ targetRoles: [verifiedRole("USER", "role-user"), verifiedRole("ANATOMY_REVIEWER", "role-reviewer")] })
    await assert.rejects(
      () => changeAnatomyRole(changeInput({ prismaClient: stale })),
      /role changed since this operation was prepared/,
    )

    const alreadyAssigned = createRoleDatabase({ targetRoles: [verifiedRole("USER", "role-user"), verifiedRole("ANATOMY_REVIEWER", "role-reviewer")] })
    await assert.rejects(
      () => changeAnatomyRole(changeInput({ prismaClient: alreadyAssigned, expectedStatus: "VERIFIED" })),
      /already assigned/,
    )
    await assert.rejects(
      () => changeAnatomyRole(changeInput({ prismaClient: createRoleDatabase(), operation: "REVOKE", expectedStatus: "ABSENT", reasonCode: "ROLE_REVOCATION" })),
      /not currently assigned/,
    )
  })

  it("replays the exact operation without re-mutating or duplicating evidence", async () => {
    const database = createRoleDatabase()
    database.sessions.push({ id: "session-1", userId: TARGET_ID })
    const input = changeInput({ prismaClient: database })

    const first = await changeAnatomyRole(input)
    database.sessions.push({ id: "new-session", userId: TARGET_ID })
    const replay = await changeAnatomyRole(input)

    assert.deepEqual(replay, { ...first, replayed: true })
    assert.equal(database.sessions.length, 1)
    assert.equal(database.actions.length, 1)
    assert.equal(database.activities.length, 1)
    assert.equal(database.intents.length, 1)
  })

  it("serializes concurrent exact duplicate submissions before role mutation", async () => {
    const database = createRoleDatabase()
    database.sessions.push({ id: "session-1", userId: TARGET_ID })
    const input = changeInput({ prismaClient: database })

    const results = await Promise.all([changeAnatomyRole(input), changeAnatomyRole(input)])

    assert.deepEqual(results.map((result) => result.replayed).sort(), [false, true])
    assert.deepEqual(results.map((result) => result.revokedSessionCount), [1, 1])
    assert.equal(database.roles.filter((assignment) => assignment.userId === TARGET_ID && assignment.role === "ANATOMY_REVIEWER").length, 1)
    assert.equal(database.actions.length, 1)
    assert.equal(database.activities.length, 1)
    assert.equal(database.intents.length, 1)
  })

  it("rejects a duplicate key whose immutable role payload differs", async () => {
    const database = createRoleDatabase()
    const input = changeInput({ prismaClient: database })
    await changeAnatomyRole(input)

    await assert.rejects(
      () => changeAnatomyRole({ ...input, role: "ANATOMY_EDITOR" }),
      /operation key is already in use/,
    )
    await assert.rejects(
      () => changeAnatomyRole({ ...input, expectedStatus: "REVOKED" }),
      /operation key is already in use/,
    )
    assert.equal(database.roles.filter((assignment) => assignment.status === "VERIFIED").length, 3)
  })

  it("rolls back the role, session revocation, and partial evidence together", async () => {
    const database = createRoleDatabase()
    database.sessions.push({ id: "session-1", userId: TARGET_ID })
    database.failIntentCreate = true

    await assert.rejects(
      () => changeAnatomyRole(changeInput({ prismaClient: database })),
      /intent create failed/,
    )

    assert.deepEqual(database.roles.map(({ userId, role, status }) => ({ userId, role, status })), [
      { userId: ACTOR_ID, role: "ADMIN", status: "VERIFIED" },
      { userId: TARGET_ID, role: "USER", status: "VERIFIED" },
    ])
    assert.equal(database.sessions.length, 1)
    assert.equal(database.actions.length, 0)
    assert.equal(database.activities.length, 0)
    assert.equal(database.intents.length, 0)
  })
})

function verifiedRole(role, id) {
  return {
    id,
    role,
    status: "VERIFIED",
    source: "system",
    metadata: {},
    verifiedAt: new Date("2026-08-01T12:00:00.000Z"),
    expiresAt: null,
    revokedAt: null,
    grantedById: null,
  }
}

function user(id, roles, overrides = {}) {
  return {
    id,
    name: id === ACTOR_ID ? "Administrator" : "Member",
    email: id === ACTOR_ID ? "admin@example.test" : "member@example.test",
    emailVerified: new Date("2026-08-01T12:00:00.000Z"),
    roles,
    ...overrides,
  }
}

function createRoleDatabase({
  actor = user(ACTOR_ID, [verifiedRole("ADMIN", "actor-admin")]),
  includeTarget = true,
  targetRoles = [verifiedRole("USER", "role-user")],
} = {}) {
  const root = {
    state: {
      users: [actor, ...(includeTarget ? [user(TARGET_ID, targetRoles)] : [])],
      roles: [
        ...actor.roles.map((assignment) => ({ ...assignment, userId: actor.id })),
        ...(includeTarget ? targetRoles.map((assignment) => ({ ...assignment, userId: TARGET_ID })) : []),
      ],
      sessions: [],
      actions: [],
      activities: [],
      intents: [],
    },
    failIntentCreate: false,
    transactionOptions: [],
    lockOwners: new Map(),
    lockWaiters: new Map(),
  }
  return makeClient(root)
}

/** Prisma-shaped transactional fake that commits one isolated snapshot only on success. */
function makeClient(root, transaction = null) {
  const state = () => transaction?.state ?? root.state
  const client = {}
  for (const field of ["roles", "sessions", "actions", "activities", "intents"]) {
    Object.defineProperty(client, field, { get: () => state()[field], set: (value) => { state()[field] = value } })
  }
  Object.defineProperty(client, "failIntentCreate", { get: () => root.failIntentCreate, set: (value) => { root.failIntentCreate = value } })
  Object.defineProperty(client, "transactionOptions", { get: () => root.transactionOptions })

  const project = (record, select) => record == null || !select
    ? record
    : Object.fromEntries(Object.keys(select).filter((key) => select[key]).map((key) => [key, record[key]]))
  const rolesFor = (userId) => state().roles.filter((assignment) => assignment.userId === userId)

  client.user = {
    findUnique: async ({ where }) => {
      const record = state().users.find((candidate) => candidate.id === where.id)
      return record ? structuredClone({ ...record, roles: rolesFor(record.id) }) : null
    },
  }
  client.userRole = {
    findUnique: async ({ where }) => structuredClone(state().roles.find((assignment) => (
      assignment.userId === where.userId_role.userId && assignment.role === where.userId_role.role
    )) ?? null),
    upsert: async ({ where, create, update }) => {
      const existing = state().roles.find((assignment) => assignment.userId === where.userId_role.userId && assignment.role === where.userId_role.role)
      if (existing) {
        Object.assign(existing, update)
        return structuredClone(existing)
      }
      const created = { id: `role-${state().roles.length}`, ...create }
      state().roles.push(created)
      return structuredClone(created)
    },
    update: async ({ where, data }) => {
      const existing = state().roles.find((assignment) => assignment.userId === where.userId_role.userId && assignment.role === where.userId_role.role)
      if (!existing) throw new Error("Role assignment was not found.")
      Object.assign(existing, data)
      return structuredClone(existing)
    },
  }
  client.session = {
    deleteMany: async ({ where }) => {
      const before = state().sessions.length
      state().sessions = state().sessions.filter((session) => session.userId !== where.userId)
      return { count: before - state().sessions.length }
    },
  }
  client.adminAction = {
    findUnique: async ({ where, include }) => {
      const action = state().actions.find((candidate) => candidate.idempotencyKey === where.idempotencyKey)
      if (!action) return null
      return structuredClone(include ? {
        ...action,
        activity: state().activities.find((activity) => activity.adminActionId === action.id) ?? null,
        emailIntent: state().intents.find((intent) => intent.adminActionId === action.id) ?? null,
      } : action)
    },
    create: async ({ data, select }) => {
      const action = { id: `action-${state().actions.length + 1}`, ...data }
      state().actions.push(action)
      return project(action, select)
    },
  }
  client.userAccountActivity = {
    create: async ({ data }) => {
      const activity = { id: `activity-${state().activities.length + 1}`, ...data }
      state().activities.push(activity)
      return structuredClone(activity)
    },
  }
  client.adminEmailIntent = {
    create: async ({ data, select }) => {
      if (root.failIntentCreate) throw new Error("intent create failed")
      const intent = {
        id: `intent-${state().intents.length + 1}`,
        ...data,
        attemptCount: 0,
        lastAttemptAt: null,
        deliveredAt: null,
      }
      state().intents.push(intent)
      return project(intent, select)
    },
  }
  client.$executeRaw = async (query) => {
    if (!transaction) throw new Error("Advisory locks require a transaction.")
    const key = query.values?.[0]
    if (typeof key !== "string") throw new Error("Expected an advisory lock key.")
    await acquireLock(root, transaction, key)
    return 1
  }

  if (!transaction) {
    client.$transaction = async (callback, options) => {
      root.transactionOptions.push(options)
      const snapshot = { state: structuredClone(root.state), heldLocks: new Set() }
      try {
        const result = await callback(makeClient(root, snapshot))
        root.state = snapshot.state
        return result
      } finally {
        for (const key of snapshot.heldLocks) releaseLock(root, snapshot, key)
      }
    }
  }

  return client
}

/** Minimal re-entrant transaction advisory lock for duplicate-submit coverage. */
async function acquireLock(root, transaction, key) {
  if (root.lockOwners.get(key) === transaction) return
  while (root.lockOwners.has(key)) {
    await new Promise((resolve) => {
      const waiters = root.lockWaiters.get(key) ?? []
      waiters.push(resolve)
      root.lockWaiters.set(key, waiters)
    })
  }
  root.lockOwners.set(key, transaction)
  transaction.heldLocks.add(key)
  // A waiter began with an older transaction snapshot; refresh it at lock entry.
  transaction.state = structuredClone(root.state)
}

function releaseLock(root, transaction, key) {
  if (root.lockOwners.get(key) !== transaction) return
  root.lockOwners.delete(key)
  root.lockWaiters.get(key)?.shift()?.()
}
