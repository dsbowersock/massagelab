import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { it } from "node:test"

import { canSyncAccountPreferences } from "../lib/account-preferences.js"
import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const sidebarSource = await readFile(
  new URL("../components/sidebar/sidebar.tsx", import.meta.url),
  "utf8",
)

function loadSidebar(database) {
  return loadCompiledModule(sidebarSource, "components/sidebar/sidebar.owner-validation.test.tsx", {
    "@/auth": { getCurrentSession: async () => null },
    "@/components/sidebar/app-sidebar-client": { AppSidebarClient: () => null },
    "@/lib/account-preferences": { canSyncAccountPreferences },
    "@/lib/account-shell-bootstrap": { projectAccountShellAppSettings: () => ({}) },
    "@/lib/rsc-session": { getCurrentRscSession: async () => null },
    "@/lib/membership": {
      FEATURE_KEYS: { therapistDocumentationTools: "therapist_documentation_tools" },
    },
    "@/lib/navigation": { resolveNavigation: (context) => context },
    "@/lib/prisma": { prisma: database },
  })
}

it("fails closed for a whitespace-padded sidebar owner id", async () => {
  const calls = { practiceRoleReads: 0 }
  const database = {
    practiceMembership: {
      async findMany() {
        calls.practiceRoleReads += 1
        return [{ practiceId: "practice-1", role: "OWNER" }]
      },
    },
  }
  const { getSidebarNavigationContext } = loadSidebar(database)

  const context = await getSidebarNavigationContext({ id: " user-1 " }, database)

  assert.deepEqual(context, { authState: "anonymous" })
  assert.equal(calls.practiceRoleReads, 0)
})
