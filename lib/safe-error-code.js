/**
 * Reduces an unknown operational failure to the only processor-safe field
 * allowed in payment and pricing logs. Error names, messages, and stacks can
 * contain customer or provider data and must not cross this boundary.
 *
 * @param {unknown} error
 * @returns {string}
 */
export function safeErrorCode(error) {
  return (
    error
    && typeof error === "object"
    && "code" in error
    && typeof error.code === "string"
    && /^[a-z0-9_.-]{1,80}$/i.test(error.code)
  )
    ? error.code
    : "unexpected_error"
}
