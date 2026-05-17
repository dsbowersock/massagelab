// @ts-check

const FILTERED_VALUE = "[Filtered]"
const MAX_SANITIZE_DEPTH = 7
const SENSITIVE_KEY_PATTERN =
  /(authorization|cookie|set-cookie|token|secret|password|passwd|session|totp|backup|email|mail|phone|address|license|credential|client|patient|soap|note|intake|journal|transcript|pain|rom|diagnosis|assessment|treatment|birth|dob|formdata|requestbody|responsebody|vars|locals|abs_path)/i
const SENSITIVE_TELEMETRY_KEY_PATTERN =
  /(header|next_router_state_tree|router_state|rsc|baggage|sentry-trace|traceparent)/i
const URL_KEY_PATTERN = /^(url|href|referrer|referer|path|pathname|request_path|target|http\.url|http\.target|http\.request\.url|next\.url)$/i
const SAFE_RUNTIME_ERROR_TYPES = new Set(["EvalError", "RangeError", "ReferenceError", "SyntaxError", "TypeError", "URIError"])
const SAFE_RUNTIME_MESSAGE_PATTERN = /^(EvalError|RangeError|ReferenceError|SyntaxError|TypeError|URIError)\b/
const SENSITIVE_DIAGNOSTIC_TEXT_PATTERN =
  /\b(client|patient|soap|intake|journal|transcript|pain|rom|diagnosis|assessment|treatment|dob|birth|license|credential)\b/i
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
const AUTHORIZATION_HEADER_PATTERN = /\b(authorization)\s*:\s*(?:bearer\s+)?[^\s,;]+/gi
const COLON_TOKEN_PATTERN = /\b(token)\s*:\s*[^\s,;]+/gi
const SECRET_ASSIGNMENT_PATTERN =
  /\b(password|passwd|secret|token|authorization|auth|session|cookie)=([^&\s]+)/gi
const URL_PATTERN = /\bhttps?:\/\/[^\s"'<>]+/gi

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

/**
 * @param {string} value
 */
export function stripUrlSensitiveParts(value) {
  const hashIndex = value.indexOf("#")
  const withoutFragment = hashIndex >= 0 ? value.slice(0, hashIndex) : value
  const queryIndex = withoutFragment.indexOf("?")
  return queryIndex >= 0 ? withoutFragment.slice(0, queryIndex) : withoutFragment
}

/**
 * @param {string} value
 */
function redactInlineSensitiveValues(value) {
  return value
    .replace(URL_PATTERN, (url) => stripUrlSensitiveParts(url))
    .replace(EMAIL_PATTERN, FILTERED_VALUE)
    .replace(AUTHORIZATION_HEADER_PATTERN, "$1: [Filtered]")
    .replace(COLON_TOKEN_PATTERN, "$1: [Filtered]")
    .replace(SECRET_ASSIGNMENT_PATTERN, "$1=[Filtered]")
}

/**
 * @param {string} value
 * @param {string | undefined} [errorType]
 */
function sanitizeDiagnosticText(value, errorType) {
  const redacted = redactInlineSensitiveValues(value)
  const canKeepRuntimeText = errorType
    ? SAFE_RUNTIME_ERROR_TYPES.has(errorType)
    : SAFE_RUNTIME_MESSAGE_PATTERN.test(redacted)

  if (!canKeepRuntimeText || SENSITIVE_DIAGNOSTIC_TEXT_PATTERN.test(redacted)) {
    return FILTERED_VALUE
  }

  return redacted
}

/**
 * @param {unknown} value
 * @param {number} depth
 * @returns {unknown}
 */
function sanitizeUnknown(value, depth = 0) {
  if (depth > MAX_SANITIZE_DEPTH) {
    return FILTERED_VALUE
  }

  if (typeof value === "string") {
    return redactInlineSensitiveValues(value)
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeUnknown(item, depth + 1))
  }

  if (!isRecord(value)) {
    return value
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => {
      if (SENSITIVE_KEY_PATTERN.test(key) || SENSITIVE_TELEMETRY_KEY_PATTERN.test(key)) {
        return [key, FILTERED_VALUE]
      }

      if (URL_KEY_PATTERN.test(key) && typeof entryValue === "string") {
        return [key, redactInlineSensitiveValues(stripUrlSensitiveParts(entryValue))]
      }

      return [key, sanitizeUnknown(entryValue, depth + 1)]
    }),
  )
}

/**
 * @param {Record<string, unknown>} event
 */
function scrubUser(event) {
  const user = event.user
  if (!isRecord(user)) {
    return
  }

  event.user = typeof user.id === "string" && user.id ? { id: user.id } : undefined
}

/**
 * @param {Record<string, unknown>} event
 */
function scrubRequest(event) {
  const request = event.request
  if (!isRecord(request)) {
    return
  }

  if (typeof request.url === "string") {
    request.url = redactInlineSensitiveValues(stripUrlSensitiveParts(request.url))
  }

  delete request.headers
  delete request.cookies
  delete request.data
  delete request.env
  delete request.fragment
  delete request.query_string
}

/**
 * @param {unknown} breadcrumb
 * @returns {unknown | null}
 */
export function sanitizeSentryBreadcrumb(breadcrumb) {
  if (!isRecord(breadcrumb)) {
    return breadcrumb
  }

  const category = typeof breadcrumb.category === "string" ? breadcrumb.category : ""
  if (category === "console" || category.startsWith("console.")) {
    return null
  }

  if (typeof breadcrumb.message === "string") {
    breadcrumb.message = redactInlineSensitiveValues(breadcrumb.message)
  }

  if (isRecord(breadcrumb.data)) {
    breadcrumb.data = sanitizeUnknown(breadcrumb.data)
  }

  return breadcrumb
}

/**
 * @param {Record<string, unknown>} event
 */
function scrubBreadcrumbs(event) {
  if (!Array.isArray(event.breadcrumbs)) {
    return
  }

  event.breadcrumbs = event.breadcrumbs
    .map((breadcrumb) => sanitizeSentryBreadcrumb(breadcrumb))
    .filter(Boolean)
}

/**
 * @param {Record<string, unknown>} event
 */
function scrubDiagnosticMessages(event) {
  if (typeof event.message === "string") {
    event.message = sanitizeDiagnosticText(event.message)
  }

  const logentry = event.logentry
  if (isRecord(logentry)) {
    if (typeof logentry.message === "string") {
      logentry.message = sanitizeDiagnosticText(logentry.message)
    }

    if (typeof logentry.formatted === "string") {
      logentry.formatted = sanitizeDiagnosticText(logentry.formatted)
    }
  }

  const exception = event.exception
  if (!isRecord(exception) || !Array.isArray(exception.values)) {
    return
  }

  for (const exceptionValue of exception.values) {
    if (isRecord(exceptionValue) && typeof exceptionValue.value === "string") {
      const exceptionType = typeof exceptionValue.type === "string" ? exceptionValue.type : undefined
      exceptionValue.value = sanitizeDiagnosticText(exceptionValue.value, exceptionType)
    }
  }
}

/**
 * @param {unknown} event
 * @returns {unknown}
 */
export function sanitizeSentryEvent(event) {
  if (!isRecord(event)) {
    return event
  }

  scrubUser(event)
  scrubRequest(event)
  scrubBreadcrumbs(event)

  if (isRecord(event.exception)) {
    event.exception = sanitizeUnknown(event.exception)
  }

  if (isRecord(event.logentry)) {
    event.logentry = sanitizeUnknown(event.logentry)
  }

  scrubDiagnosticMessages(event)

  if (typeof event.transaction === "string") {
    event.transaction = redactInlineSensitiveValues(stripUrlSensitiveParts(event.transaction))
  }

  if (isRecord(event.extra)) {
    event.extra = sanitizeUnknown(event.extra)
  }

  const contexts = event.contexts
  if (isRecord(contexts)) {
    event.contexts = sanitizeUnknown(contexts)
  }

  return event
}

/**
 * @param {unknown} event
 * @returns {unknown}
 */
export function sanitizeSentryTransaction(event) {
  return sanitizeSentryEvent(event)
}

/**
 * @param {unknown} span
 * @returns {unknown}
 */
export function sanitizeSentrySpan(span) {
  if (!isRecord(span)) {
    return span
  }

  for (const key of ["description", "name"]) {
    if (typeof span[key] === "string") {
      span[key] = redactInlineSensitiveValues(stripUrlSensitiveParts(span[key]))
    }
  }

  if (isRecord(span.data)) {
    span.data = sanitizeUnknown(span.data)
  }

  if (isRecord(span.attributes)) {
    span.attributes = sanitizeUnknown(span.attributes)
  }

  return span
}

export function getSentryEnvironment() {
  return (
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ||
    process.env.SENTRY_ENVIRONMENT ||
    process.env.VERCEL_ENV ||
    process.env.NODE_ENV ||
    "development"
  )
}

export function getSentryTracesSampleRate() {
  return process.env.NODE_ENV === "development" ? 1.0 : 0.1
}
