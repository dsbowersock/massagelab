import type { PrismaClient } from "@prisma/client"

import { isBrowserQaDatabaseTargetAuthorized } from "../../scripts/assert-browser-qa-database-target.mjs"

type QaEnvironment = Record<string, string | undefined>
type FixtureClient = Pick<PrismaClient, "user">

export type BrowserUserFixtureIdentity = {
  projectName: string
  owner: string
  user: {
    id: string
    name: string
    email: string
    authSessionVersion: number
  }
}

const SAFE_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Creates one exact project-and-owner-qualified synthetic account identity. */
export function createBrowserUserFixtureIdentity(
  projectName: string,
  owner: string,
): BrowserUserFixtureIdentity {
  if (!SAFE_NAME.test(projectName) || !SAFE_NAME.test(owner)) {
    throw new Error("Browser user fixture requires safe project and owner names.")
  }
  const fixtureKey = `${projectName}--${owner}`
  const id = `browser-user-${fixtureKey}`
  const email = `${fixtureKey}@browser-user.massagelab.example.test`
  if (id.length > 191 || email.length > 320) {
    throw new Error("Browser user fixture identity exceeds persisted field limits.")
  }
  return {
    projectName,
    owner,
    user: {
      id,
      name: `Browser User ${projectName} ${owner}`,
      email,
      authSessionVersion: 0,
    },
  }
}

/** Refuses every fixture mutation unless the complete disposable-target gate passes. */
export function requireBrowserUserFixtureAuthorization(environment: QaEnvironment = process.env) {
  if (!isBrowserQaDatabaseTargetAuthorized(environment)) {
    throw new Error("Browser user fixture requires the approved disposable browser-QA database target.")
  }
}

/** Creates only the exact verified User needed for a database-backed JWT refresh. */
export async function createBrowserUserFixtureRecord(input: {
  prismaClient: FixtureClient
  identity: BrowserUserFixtureIdentity
  environment?: QaEnvironment
}) {
  requireBrowserUserFixtureAuthorization(input.environment)
  assertBrowserUserFixtureIdentity(input.identity)
  return input.prismaClient.user.create({
    data: {
      ...input.identity.user,
      emailVerified: new Date("2026-09-07T00:00:00.000Z"),
    },
    select: {
      id: true,
      name: true,
      email: true,
      authSessionVersion: true,
    },
  })
}

/** Removes only the exact id/email pair; a zero-count delete distinguishes absence from an ownership failure. */
export async function removeBrowserUserFixtureRecord(input: {
  prismaClient: FixtureClient
  identity: BrowserUserFixtureIdentity
  environment?: QaEnvironment
}) {
  requireBrowserUserFixtureAuthorization(input.environment)
  assertBrowserUserFixtureIdentity(input.identity)
  const removed = await input.prismaClient.user.deleteMany({
    where: {
      id: input.identity.user.id,
      email: input.identity.user.email,
    },
  })
  if (removed.count === 1) return
  if (removed.count !== 0) {
    throw new Error("Browser user fixture cleanup did not remove exactly one owned user.")
  }

  const existing = await input.prismaClient.user.findUnique({
    where: { id: input.identity.user.id },
    select: { email: true },
  })
  if (!existing) return
  if (existing.email !== input.identity.user.email) {
    throw new Error("Browser user fixture ownership mismatch.")
  }
  throw new Error("Browser user fixture cleanup did not remove exactly one owned user.")
}

function assertBrowserUserFixtureIdentity(identity: BrowserUserFixtureIdentity) {
  const expected = createBrowserUserFixtureIdentity(identity.projectName, identity.owner)
  if (identity.user.id !== expected.user.id
    || identity.user.name !== expected.user.name
    || identity.user.email !== expected.user.email
    || identity.user.authSessionVersion !== 0) {
    throw new Error("Browser user fixture refuses a non-owned identity.")
  }
}
