import type { BrowserContext } from "@playwright/test"

import { prisma } from "@/lib/prisma"
import {
  createBrowserUserFixtureIdentity,
  createBrowserUserFixtureRecord,
  removeBrowserUserFixtureRecord,
} from "../../lib/auth/browser-user-fixture"
import { isBrowserQaDatabaseTargetAuthorized } from "../../scripts/assert-browser-qa-database-target.mjs"
import { installSignedInSessionCookie } from "./signed-in-session-cookie"

/**
 * Installs a project/owner-qualified signed-in identity. Authorized connected
 * runs persist the matching User; database-free runs retain the existing JWT
 * fallback without opening Prisma or mutating an unapproved target.
 */
export async function installSignedInUserFixture(input: {
  context: BrowserContext
  baseURL: string
  projectName: string
  owner: string
}) {
  const identity = createBrowserUserFixtureIdentity(input.projectName, input.owner)
  if (isBrowserQaDatabaseTargetAuthorized(process.env)) {
    await removeBrowserUserFixtureRecord({ prismaClient: prisma, identity })
    const user = await createBrowserUserFixtureRecord({ prismaClient: prisma, identity })
    try {
      await installSignedInSessionCookie(input.context, input.baseURL, {
        ...user,
        name: user.name ?? identity.user.name,
        email: user.email ?? identity.user.email,
      })
    } catch (error) {
      await removeBrowserUserFixtureRecord({ prismaClient: prisma, identity })
      throw error
    }
    return identity
  }
  await installSignedInSessionCookie(input.context, input.baseURL, identity.user)
  return identity
}

/** Cleanup is a no-op unless the same complete disposable-target gate passes. */
export async function removeSignedInUserFixture(projectName: string, owner: string) {
  if (!isBrowserQaDatabaseTargetAuthorized(process.env)) return
  const identity = createBrowserUserFixtureIdentity(projectName, owner)
  await removeBrowserUserFixtureRecord({ prismaClient: prisma, identity })
}
