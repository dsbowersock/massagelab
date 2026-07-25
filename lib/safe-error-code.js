const SAFE_OPERATIONAL_ERROR_CODES = new Set([
  "P1001",
  "P1002",
  "P2002",
  "P2024",
  "P2037",
  "api_connection_error",
  "idempotency_key_in_use",
  "lock_timeout",
  "rate_limit",
  "resource_missing",
])

/**
 * Reduces an unknown operational failure to the only processor-safe field
 * allowed in payment and pricing logs. Error names, messages, and stacks can
 * contain customer or provider data and must not cross this boundary. The
 * finite allowlist prevents an arbitrary identifier-shaped provider value from
 * becoming log output, and guarded property access handles hostile proxies.
 *
 * @param {unknown} error
 * @returns {string}
 */
export function safeErrorCode(error) {
  if (!error || (typeof error !== "object" && typeof error !== "function")) {
    return "unexpected_error"
  }

  try {
    const code = Reflect.get(error, "code")
    return typeof code === "string" && SAFE_OPERATIONAL_ERROR_CODES.has(code)
      ? code
      : "unexpected_error"
  } catch {
    return "unexpected_error"
  }
}
