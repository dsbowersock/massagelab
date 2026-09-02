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

it("loads practice roles for an exact authenticated sidebar owner id", async () => {
  let practiceRoleQuery
  const database = {
    practiceMembership: {
      async findMany(query) {
        practiceRoleQuery = query
        return [{ practiceId: "practice-1", role: "OWNER" }]
      },
    },
  }
  const { getSidebarNavigationContext } = loadSidebar(database)

  const context = await getSidebarNavigationContext({ id: "user-1", featureKeys: [] }, database)

  assert.deepEqual(context, {
    authState: "signed-in",
    accountRoles: ["USER"],
    roleAssignments: [],
    featureKeys: [],
    capabilities: {},
    practiceRoles: [{ practiceId: "practice-1", role: "OWNER" }],
  })
  assert.deepEqual(practiceRoleQuery, {
    where: { userId: "user-1" },
    select: { practiceId: true, role: true },
    orderBy: { createdAt: "asc" },
  })
})

it("fails closed for every rejected sidebar owner id shape", async () => {
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

  const rejectedOwnerIds = [
    { label: "empty", value: "" },
    { label: "whitespace", value: "   " },
    { label: "whitespace-padded canonical id", value: " user-1 " },
    { label: "null", value: null },
    { label: "undefined", value: undefined },
    { label: "non-string", value: 42 },
  ]
  for (const { label, value } of rejectedOwnerIds) {
    const context = await getSidebarNavigationContext({ id: value, featureKeys: [] }, database)
    assert.deepEqual(context, { authState: "anonymous" }, label)
  }
  assert.equal(calls.practiceRoleReads, 0)
})
