// @ts-check

const FILTERED_VALUE = "[Filtered]"
const MAX_SANITIZE_DEPTH = 5
const SENSITIVE_KEY_PATTERN =
  /(authorization|cookie|set-cookie|token|secret|password|passwd|session|totp|backup|email|mail|phone|address|license|credential|client|patient|soap|note|intake|journal|transcript|pain|rom|diagnosis|assessment|treatment|birth|dob|formdata|requestbody|responsebody)/i
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
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
    .replace(SECRET_ASSIGNMENT_PATTERN, "$1=[Filtered]")
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
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        return [key, FILTERED_VALUE]
      }

      if (/^(url|href|referrer|referer|path|pathname|request_path)$/i.test(key) && typeof entryValue === "string") {
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

  if (typeof event.transaction === "string") {
    event.transaction = stripUrlSensitiveParts(event.transaction)
  }

  if (isRecord(event.extra)) {
    event.extra = sanitizeUnknown(event.extra)
  }

  const contexts = event.contexts
  if (isRecord(contexts) && isRecord(contexts.nextjs)) {
    contexts.nextjs = sanitizeUnknown(contexts.nextjs)
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
