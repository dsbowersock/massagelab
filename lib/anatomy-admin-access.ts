import "server-only"

import {
  requireAnatomyEditorUser as requireSharedAnatomyEditorUser,
  requireAnatomyReviewerUser as requireSharedAnatomyReviewerUser,
} from "@/lib/admin/access"

export { canEditAnatomyContent, canReviewAnatomyContent } from "@/lib/admin/access"

/**
 * Enforces Anatomy Admin access for server-rendered admin routes and server actions.
 * The shared account-permission helpers stay pure so they remain safe for navigation/client imports.
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
