import type { BrowserContext } from "@playwright/test"
import { prisma } from "@/lib/prisma"
import { requireBrowserAdminFixtureQaAuthorization } from "../../lib/admin/browser-qa-authorization"
import { createBrowserAdminFixtureIdentity } from "../../lib/admin/browser-fixture-identity"
import { installSignedInSessionCookie } from "./signed-in-session-cookie"

/**
 * Installs one project's JWT-authenticated, database-verified Admin fixture.
 * Project-qualified IDs keep parallel browser projects from sharing cleanup.
 */
export async function installAdminUserOperationsFixture(context: BrowserContext, baseURL: string, projectName: string) {
  requireBrowserAdminFixtureQaAuthorization()
  const identity = createBrowserAdminFixtureIdentity(projectName)
  await removeBrowserAdminFixture(projectName)
  await prisma.user.create({
    data: {
      ...identity.operator,
      emailVerified: new Date("2026-08-09T00:00:00.000Z"),
      roles: { create: [{ role: "ADMIN", status: "VERIFIED", source: "browser-admin-fixture", verifiedAt: new Date("2026-08-09T00:00:00.000Z") }] },
    },
  })
  await prisma.user.create({
    data: {
      ...identity.target,
      emailVerified: new Date("2026-08-09T00:00:00.000Z"),
      roles: { create: [{ role: "USER", status: "VERIFIED", source: "browser-admin-fixture", verifiedAt: new Date("2026-08-09T00:00:00.000Z") }] },
    },
  })
  await installSignedInSessionCookie(context, baseURL, identity.operator)
}

/** Removes only the calling project's deterministic fixture Users and cascading test-only roles. */
export async function removeBrowserAdminFixture(projectName: string) {
  requireBrowserAdminFixtureQaAuthorization()
  const identity = createBrowserAdminFixtureIdentity(projectName)
  await prisma.user.deleteMany({ where: { id: { in: [identity.operator.id, identity.target.id] } } })
}
