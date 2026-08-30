import type { BrowserContext } from "@playwright/test"

import { prisma } from "@/lib/prisma"
import { isBrowserQaDatabaseTargetAuthorized } from "../../scripts/assert-browser-qa-database-target.mjs"
import { installSignedInSessionCookie } from "./signed-in-session-cookie"

const MEMBERSHIP_CONVERGENCE_MIGRATION = "20260828130000_membership_subscription_convergence"
const SAFE_PROJECT_NAME = /^[a-z0-9-]+$/

type FixtureStatus = "active" | "past_due" | "incomplete_expired"

/** Builds deterministic project-scoped ids so parallel workers never share fixture rows. */
function fixtureIdentity(projectName: string) {
  if (!SAFE_PROJECT_NAME.test(projectName)) {
    throw new Error("Membership return fixture requires a safe Playwright project name.")
  }
  return {
    user: {
      id: `browser-membership-return-${projectName}`,
      name: "Membership return QA",
      email: `browser-membership-return-${projectName}@browser-qa.example.test`,
    },
    customerId: `browser_customer_${projectName}`,
    subscriptionId: `browser_subscription_${projectName}`,
  }
}

/** Reuses Identity Task 6's exact target/fingerprint decision before any database operation. */
function requireMembershipReturnFixtureAuthorization() {
  if (!isBrowserQaDatabaseTargetAuthorized(process.env)) {
    throw new Error("Membership return fixture requires the approved disposable browser-QA database target.")
  }
}

/** Proves the additive membership migration completed before any Subscription fixture write. */
async function requireMembershipConvergenceMigration() {
  const rows = await prisma.$queryRaw<Array<{ migration_name: string }>>`
    SELECT "migration_name"
    FROM "_prisma_migrations"
    WHERE "migration_name" = ${MEMBERSHIP_CONVERGENCE_MIGRATION}
      AND "finished_at" IS NOT NULL
      AND "rolled_back_at" IS NULL
    LIMIT 1
  `
  if (rows.length !== 1) {
    throw new Error(`Membership return fixture requires applied ${MEMBERSHIP_CONVERGENCE_MIGRATION}.`)
  }
}

/** Maps the allowed fixture status to the minimal persisted subscription fields under test. */
function statusFields(status: FixtureStatus) {
  if (status === "active") {
    return {
      status,
      currentPeriodEnd: new Date("2099-01-01T00:00:00.000Z"),
    }
  }
  return {
    status,
    currentPeriodEnd: null,
  }
}

/** Installs one project-qualified account and persisted subscription on the approved target. */
export async function installMembershipReturnStatusFixture(input: {
  context: BrowserContext
  baseURL: string
  projectName: string
  status: FixtureStatus
}) {
  requireMembershipReturnFixtureAuthorization()
  await requireMembershipConvergenceMigration()
  const identity = fixtureIdentity(input.projectName)
  await removeMembershipReturnStatusFixture(input.projectName)
  await prisma.user.create({
    data: {
      ...identity.user,
      emailVerified: new Date("2026-08-29T00:00:00.000Z"),
    },
  })
  await prisma.stripeCustomer.create({
    data: {
      userId: identity.user.id,
      stripeCustomerId: identity.customerId,
    },
  })
  await prisma.membershipSubscription.create({
    data: {
      userId: identity.user.id,
      stripeCustomerId: identity.customerId,
      stripeSubscriptionId: identity.subscriptionId,
      membershipLevel: "SUPPORTER",
      cancelAtPeriodEnd: false,
      ...statusFields(input.status),
    },
  })
  await installSignedInSessionCookie(input.context, input.baseURL, identity.user)
  return identity
}

/** Changes only this project's persisted row so the endpoint exposes a new database revision. */
export async function updateMembershipReturnStatusFixture(input: {
  projectName: string
  status: FixtureStatus
}) {
  requireMembershipReturnFixtureAuthorization()
  await requireMembershipConvergenceMigration()
  const identity = fixtureIdentity(input.projectName)
  await prisma.membershipSubscription.update({
    where: { stripeSubscriptionId: identity.subscriptionId },
    data: {
      cancelAtPeriodEnd: false,
      ...statusFields(input.status),
    },
  })
}

/** Removes only the exact project-qualified fixture identity in FK-safe order. */
export async function removeMembershipReturnStatusFixture(projectName: string) {
  requireMembershipReturnFixtureAuthorization()
  await requireMembershipConvergenceMigration()
  const identity = fixtureIdentity(projectName)
  await prisma.membershipSubscription.deleteMany({
    where: { userId: identity.user.id },
  })
  await prisma.stripeCustomer.deleteMany({
    where: { userId: identity.user.id },
  })
  await prisma.user.deleteMany({
    where: {
      id: identity.user.id,
      email: identity.user.email,
    },
  })
}
