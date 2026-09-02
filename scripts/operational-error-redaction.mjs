const MAX_INPUT_LENGTH = 4_000
const MAX_OUTPUT_LENGTH = 500
const URL_PATTERN = /\b[a-z][a-z0-9+.-]*:\/\/\S+/gi
const EMAIL_PATTERN = /[^\s,;]*@[^\s,;]*/g
const AUTHORIZATION_PATTERN = /\b(?:authorization|proxy-authorization)\s*[:=]\s*(?:(?:bearer|basic)\s+)?[^\s,;]+/gi
const SENSITIVE_ASSIGNMENT_PATTERN = /[^\s,;]*\b(?:password|passwd|pwd|token|secret|api[_-]?key|authorization|cookie)\s*[:=]\s*(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;]+)/gi

/** Returns bounded diagnostic context while removing common secret-bearing forms. */
export function formatOperationalError(error) {
  const raw = error instanceof Error ? error.message : String(error ?? "Unknown error.")
  return raw
    .slice(0, MAX_INPUT_LENGTH)
    .replace(URL_PATTERN, "[redacted]")
    .replace(EMAIL_PATTERN, "[redacted]")
    .replace(AUTHORIZATION_PATTERN, "[redacted]")
    .replace(SENSITIVE_ASSIGNMENT_PATTERN, "[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_OUTPUT_LENGTH)
}
