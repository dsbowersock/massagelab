// @ts-check

const PROHIBITED_INTEGRATION_NAMES = new Set([
  "BrowserSession",
  "CaptureConsole",
  "Replay",
  "ReplayCanvas",
])

/**
 * Returns a fresh deny-by-default SDK collection policy. Every current
 * `@sentry/nextjs` 10.59 data category is explicit so a permissive SDK default
 * cannot silently widen MassageLab telemetry.
 *
 * @returns {import("@sentry/core").DataCollection}
 */
export function getAnonymousSentryDataCollection() {
  return {
    userInfo: false,
    cookies: false,
    httpHeaders: { request: false, response: false },
    httpBodies: [],
    queryParams: false,
    genAI: { inputs: false, outputs: false },
    stackFrameVariables: false,
    frameContextLines: 3,
  }
}

/**
 * Removes SDK integrations that create session/adoption history, replay data,
 * or console capture. Error handlers and tracing remain available.
 *
 * @param {import("@sentry/core").Integration[]} integrations
 * @returns {import("@sentry/core").Integration[]}
 */
export function filterAnonymousSentryIntegrations(integrations) {
  return integrations.filter((integration) => {
    const name = integration && typeof integration === "object" && "name" in integration
      ? integration.name
      : undefined
    return typeof name !== "string" || !PROHIBITED_INTEGRATION_NAMES.has(name)
  })
}
