export const BROWSER_QA_DATABASE_OPT_IN = "MASSAGELAB_BROWSER_QA_DATABASE"

type QaEnvironment = Record<string, string | undefined>

/**
 * Returns whether an operator explicitly authorized destructive browser-fixture
 * writes against the configured disposable QA database. A connection string by
 * itself is never sufficient because it could point at Production.
 */
export function hasBrowserAdminFixtureQaAuthorization(environment: QaEnvironment = process.env) {
  return Boolean(environment.DATABASE_URL?.trim()) && environment[BROWSER_QA_DATABASE_OPT_IN] === "1"
}

/** Fails closed before a browser fixture can delete or create any account record. */
export function requireBrowserAdminFixtureQaAuthorization(environment: QaEnvironment = process.env) {
  if (hasBrowserAdminFixtureQaAuthorization(environment)) return
  throw new Error("Admin user operations browser fixture requires DATABASE_URL and MASSAGELAB_BROWSER_QA_DATABASE=1 before it may mutate deterministic QA identities.")
}
