import type { BrowserContext } from "@playwright/test"

import { prisma } from "@/lib/prisma"
import { createBrowserIdentityMethodFixtureIdentity } from "../../lib/auth/browser-fixture-identity"
import {
  createBrowserIdentityMethodFixtureRecords,
  removeBrowserIdentityMethodFixtureRecords,
  requireBrowserIdentityMethodFixtureAuthorization,
  type BrowserIdentityMethodFixtureScenario,
} from "../../lib/auth/browser-fixture-records"
import { installSignedInSessionCookie } from "./signed-in-session-cookie"

/** Installs only one project-qualified identity-method scenario in the approved disposable database. */
export async function installIdentityMethodSafetyFixture(input: {
  context: BrowserContext
  baseURL: string
  projectName: string
  scenario: BrowserIdentityMethodFixtureScenario
  signedIn?: boolean
}) {
  requireBrowserIdentityMethodFixtureAuthorization()
  const identity = createBrowserIdentityMethodFixtureIdentity(input.projectName, input.scenario)
  await removeBrowserIdentityMethodFixtureRecords({ prismaClient: prisma, identity })
  const created = await createBrowserIdentityMethodFixtureRecords({ prismaClient: prisma, identity })
  if (input.signedIn !== false) {
    await installSignedInSessionCookie(input.context, input.baseURL, identity.user)
  }
  if (created.bindingCookie) {
    await input.context.addCookies([{
      name: "ml-auth-method-binding",
      value: created.bindingCookie,
      url: input.baseURL,
      httpOnly: true,
      sameSite: "Lax",
      secure: new URL(input.baseURL).protocol === "https:",
    }])
  }
  return { identity, ...created }
}
/** Removes the exact current project's rows; no shared or wildcard identity is touched. */
export async function removeIdentityMethodSafetyFixture(projectName: string, scenario: BrowserIdentityMethodFixtureScenario) {
  requireBrowserIdentityMethodFixtureAuthorization()
  const identity = createBrowserIdentityMethodFixtureIdentity(projectName, scenario)
  await removeBrowserIdentityMethodFixtureRecords({ prismaClient: prisma, identity })
}
