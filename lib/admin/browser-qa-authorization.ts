import { isBrowserQaDatabaseTargetAuthorized } from "../../scripts/assert-browser-qa-database-target.mjs"

export const BROWSER_QA_DATABASE_OPT_IN = "MASSAGELAB_BROWSER_QA_DATABASE"

type QaEnvironment = Record<string, string | undefined>

/**
 * Delegates every Admin-fixture decision to the canonical disposable-target
 * fingerprint gate. A connection string and opt-in alone are never sufficient.
 */
export function hasBrowserAdminFixtureQaAuthorization(environment: QaEnvironment = process.env) {
  return isBrowserQaDatabaseTargetAuthorized(environment)
}

/** Fails closed before a browser fixture can delete or create any account record. */
export function requireBrowserAdminFixtureQaAuthorization(environment: QaEnvironment = process.env) {
  if (hasBrowserAdminFixtureQaAuthorization(environment)) return
  throw new Error("Admin user operations browser fixture requires the complete approved disposable Browser-QA database target before it may mutate deterministic QA identities.")
}
