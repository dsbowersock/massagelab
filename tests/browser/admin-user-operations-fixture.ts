import type { BrowserContext } from "@playwright/test"
import { prisma } from "@/lib/prisma"
import { requireBrowserAdminFixtureQaAuthorization } from "../../lib/admin/browser-qa-authorization"
import { removeBrowserAdminFixtureRecords } from "../../lib/admin/browser-fixture-cleanup"
import { createBrowserAdminFixtureIdentity } from "../../lib/admin/browser-fixture-identity"
import { createBrowserAdminFixtureRecords } from "../../lib/admin/browser-fixture-provisioning"
import { installSignedInSessionCookie } from "./signed-in-session-cookie"

/**
 * Installs one project's JWT-authenticated, database-verified Admin fixture.
 * Project-qualified IDs keep parallel browser projects from sharing cleanup.
 */
export async function installAdminUserOperationsFixture(context: BrowserContext, baseURL: string, projectName: string) {
  requireBrowserAdminFixtureQaAuthorization()
  const identity = createBrowserAdminFixtureIdentity(projectName)
  await removeBrowserAdminFixture(projectName)
  await createBrowserAdminFixtureRecords({ prismaClient: prisma, identity })
  await installSignedInSessionCookie(context, baseURL, identity.operator)
}

/** Removes only the calling project's deterministic fixture Users and cascading test-only roles. */
export async function removeBrowserAdminFixture(projectName: string) {
  requireBrowserAdminFixtureQaAuthorization()
  await removeBrowserAdminFixtureRecords({ prismaClient: prisma, projectName })
}
