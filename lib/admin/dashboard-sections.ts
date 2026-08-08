import {
  canAdministerAccounts,
  canEditAnatomyContent,
  canReviewAnatomyContent,
} from "../account-permissions.js"

export type AdminDashboardSection = "users" | "commerce" | "anatomy" | "anatomy-review"

/**
 * Resolves dashboard presentation from current database roles. Linked routes
 * still enforce their own fresh authorization and do not trust this result.
 */
export function dashboardSections(actor: { roles: string[] }): AdminDashboardSection[] {
  if (canAdministerAccounts(actor.roles)) {
    return ["users", "commerce", "anatomy", "anatomy-review"]
  }

  const sections: AdminDashboardSection[] = []
  if (canEditAnatomyContent(actor.roles)) sections.push("anatomy")
  if (canReviewAnatomyContent(actor.roles)) sections.push("anatomy-review")
  return sections
}
