import "server-only"

import {
  requireAnatomyEditorUser as requireSharedAnatomyEditorUser,
  requireAnatomyReviewerUser as requireSharedAnatomyReviewerUser,
} from "@/lib/admin/access"

export { canEditAnatomyContent, canReviewAnatomyContent } from "@/lib/admin/access"

/**
 * Retains the legacy function name while enforcing current Anatomy Editor access
 * for server-rendered admin routes and server actions.
 * The shared account-permission helpers stay pure so they remain safe for navigation/client imports.
 * @deprecated Use `requireAnatomyEditorUser` for new editor-only callers.
 */
export async function requireAnatomyAdminUser() {
  return requireSharedAnatomyEditorUser()
}

/** Requires fresh reviewer capability for image and correction decisions. */
export async function requireAnatomyReviewerUser() {
  return requireSharedAnatomyReviewerUser()
}

/** Requires editor capability for anatomy content and import mutations. */
export async function requireAnatomyEditorUser() {
  return requireSharedAnatomyEditorUser()
}
