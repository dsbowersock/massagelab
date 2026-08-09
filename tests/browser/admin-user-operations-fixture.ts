import type { BrowserContext } from "@playwright/test"
import { prisma } from "@/lib/prisma"
import { requireBrowserAdminFixtureQaAuthorization } from "../../lib/admin/browser-qa-authorization"
import { installSignedInSessionCookie } from "./signed-in-session-cookie"

const FIXTURE_IDS = ["browser-admin-operator", "browser-admin-target"] as const

export const BROWSER_ADMIN_TARGET = {
  id: "browser-admin-target",
  name: "Browser Admin Target",
  email: "browser-admin-target@example.test",
}

const BROWSER_ADMIN_OPERATOR = {
  id: "browser-admin-operator",
  name: "Browser Admin Operator",
  email: "browser-admin-operator@example.test",
}

/**
 * Installs a JWT-authenticated, database-verified Admin fixture. Cleanup is
 * ID-bounded so browser QA cannot sweep accounts outside these two identities.
 */
export async function installAdminUserOperationsFixture(context: BrowserContext, baseURL: string) {
  requireBrowserAdminFixtureQaAuthorization()
  await removeBrowserAdminFixture()
  await prisma.user.create({
    data: {
      ...BROWSER_ADMIN_OPERATOR,
      emailVerified: new Date("2026-08-09T00:00:00.000Z"),
      roles: { create: [{ role: "ADMIN", status: "VERIFIED", source: "browser-admin-fixture", verifiedAt: new Date("2026-08-09T00:00:00.000Z") }] },
    },
  })
  await prisma.user.create({
    data: {
      ...BROWSER_ADMIN_TARGET,
      emailVerified: new Date("2026-08-09T00:00:00.000Z"),
      roles: { create: [{ role: "USER", status: "VERIFIED", source: "browser-admin-fixture", verifiedAt: new Date("2026-08-09T00:00:00.000Z") }] },
    },
  })
  await installSignedInSessionCookie(context, baseURL, BROWSER_ADMIN_OPERATOR)
}

/** Removes only the deterministic fixture Users; their test-only roles cascade with the User rows. */
export async function removeBrowserAdminFixture() {
  requireBrowserAdminFixtureQaAuthorization()
  await prisma.user.deleteMany({ where: { id: { in: [...FIXTURE_IDS] } } })
}
