/** Recognizes only Playwright route cancellations that held-fixture teardown can cause. */
export function isHeldRouteTeardownCancellation(error: unknown) {
  if (!(error instanceof Error)) return false
  if (error.message === "Route is already handled!") return true
  return /^route\.(?:abort|continue|fallback|fetch|fulfill):/.test(error.message)
    && /(?:Route is already handled!|Target page, context or browser has been closed|Request context disposed)/.test(error.message)
}
