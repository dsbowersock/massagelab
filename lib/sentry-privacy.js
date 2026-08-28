// @ts-check

import { classifyPrivacySafeRoute } from "./privacy-route.js"

const FILTERED_VALUE = "[Filtered]"
const MAX_SANITIZE_DEPTH = 7
const SENSITIVE_KEY_PATTERN =
  /(authorization|cookie|set-cookie|token|secret|password|passwd|session|totp|backup|email|mail|phone|address|license|credential|client|patient|soap|note|intake|journal|transcript|pain|rom|diagnosis|assessment|treatment|birth|dob|formdata|requestbody|responsebody|vars|locals|abs_path)/i
const SENSITIVE_TELEMETRY_KEY_PATTERN =
  /(header|next_router_state_tree|router_state|rsc|baggage|sentry-trace|traceparent)/i
const URL_KEY_PATTERN = /^(url|href|referrer|referer|path|pathname|request_path|target|http\.url|http\.target|http\.request\.url|next\.url)$/i
const SENSITIVE_IDENTITY_KEY_PATTERN =
  /^(?:user|userId|user_id|account|accountId|account_id|visitor|visitorId|visitor_id|session|sessionId|session_id|ip|ipAddress|ip_address|deviceId|device_id)$/i
const ALLOWED_EVENT_TAGS = new Set([
  "ml.report",
  "ml.report.area",
  "ml.report.category",
  "ml.report.privacy",
  "ml.component",
  "ml.failure_code",
])
const SAFE_OPERATIONAL_CODE_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/i
const HTTP_OPERATION_PATTERN = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(.+)$/i
const SAFE_HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"])
const SAFE_CONTEXT_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9 ._-]{0,31}$/
const SAFE_TRACE_ID_PATTERN = /^[a-f0-9]{32}$/i
const SAFE_SPAN_ID_PATTERN = /^[a-f0-9]{16}$/i
const ALLOWED_SENTRY_OPERATIONS = new Set([
  "db",
  "function.server_action",
  "http.client",
  "http.client.stream",
  "http.server",
  "http.server.middleware",
  "navigation",
  "navigation.redirect",
  "pageload",
])
const ALLOWED_SENTRY_ORIGINS = new Set([
  "auto.db.otel.prisma",
  "auto.function.nextjs.server_action",
  "auto.function.nextjs.wrap_api_handler",
  "auto.function.nextjs.wrap_middleware",
  "auto.http.browser",
  "auto.http.browser.stream",
  "auto.http.nextjs",
  "auto.http.otel.http",
  "auto.http.otel.node_fetch",
  "auto.navigation.browser",
  "auto.navigation.nextjs.app_router_instrumentation",
  "auto.navigation.nextjs.pages_router_instrumentation",
  "auto.pageload.browser",
  "auto.pageload.nextjs.app_router_instrumentation",
  "auto.pageload.nextjs.pages_router_instrumentation",
  "manual",
])
const SAFE_TRACE_STATUSES = new Set([
  "ok",
  "deadline_exceeded",
  "unauthenticated",
  "permission_denied",
  "not_found",
  "resource_exhausted",
  "invalid_argument",
  "unimplemented",
  "unavailable",
  "internal_error",
  "unknown_error",
  "cancelled",
  "already_exists",
  "failed_precondition",
  "aborted",
  "out_of_range",
  "data_loss",
])
const ALLOWED_TRACE_DATA_KEYS = new Set([
  "http.request.method",
  "http.response.status_code",
  "http.status_code",
  "http.target",
])
const ALLOWED_SPAN_DATA_KEYS = new Set([
  "http.request.method",
  "http.response.status_code",
  "http.status_code",
  "sentry.op",
  "sentry.origin",
])
const ALLOWED_PROBLEM_REPORT_CONTEXT_VALUES = new Map([
  ["area", new Set([
    "unknown", "home", "professional-records", "wellness", "booking", "calendar",
    "calendar-booking", "account-billing", "api", "admin-anatomy", "admin",
    "anatomime", "education", "timer", "music", "public-page",
  ])],
  ["browser", new Set(["edge", "firefox", "chrome-ios", "chrome", "safari", "unknown"])],
  ["category", new Set([
    "action-failed", "page-error", "data-display", "layout-display",
    "audio-playback", "account-access", "other",
  ])],
  ["displayMode", new Set(["browser", "standalone", "fullscreen", "minimal-ui", "unknown"])],
  ["network", new Set(["online", "offline", "unknown"])],
  ["privacyLevel", new Set([
    "unknown", "public", "local-first-phi-capable", "consumer-health",
    "scheduling-contact", "account-private", "server-route", "admin-private",
    "public-study", "public-tool",
  ])],
  ["selectedArea", new Set([
    "not-sure", "notes-professional-records", "wellness", "calendar-booking",
    "account-billing", "education", "anatomime", "chimer-clock", "music",
    "admin-anatomy", "public-page",
  ])],
  ["viewport", new Set(["small", "medium", "large", "unknown"])],
])
const ALLOWED_PROBLEM_REPORT_SAFE_PATHS = new Set([
  "/[unknown]",
  "/",
  "/notes/[local-first]",
  "/wellness/[self-tracking]",
  "/book/[practice]",
  "/calendar/[workspace]",
  "/calendar-or-booking",
  "/account-or-auth",
  "/account-or-billing",
  "/api/[route]",
  "/admin/anatomy/[admin]",
  "/admin/[route]",
  "/anatomime/play/[code]",
  "/anatomime/[game]",
  "/education/flashcards/decks/[slug]",
  "/education/[study]",
  "/timer",
  "/music",
  "/public/[route]",
  "/public-page",
  "/about",
  "/about/[route]",
  "/breathe",
  "/breathe/[route]",
  "/legal",
  "/legal/[route]",
  "/pricing",
  "/pricing/[route]",
  "/roadmap",
  "/roadmap/[route]",
  "/support",
  "/support/[route]",
  "/tools",
  "/tools/[route]",
])
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
 * Retains only an exact current Sentry/Next.js operational enum. The caller
 * supplies the field-specific domain so op and origin values cannot mix.
 *
 * @param {unknown} value
 * @param {Set<string>} allowedValues
 */
function sanitizeOperationalCode(value, allowedValues) {
  return typeof value === "string" && allowedValues.has(value) ? value : undefined
}

/**
 * @param {unknown} value
 */
function sanitizeHttpStatus(value) {
  return typeof value === "number"
    && Number.isInteger(value)
    && value >= 100
    && value <= 599
    ? value
    : undefined
}

/**
 * Reconstructs only valid event-scoped trace identifiers and bounded SDK
 * operation metadata. Human-readable status messages are never retained.
 *
 * @param {unknown} value
 */
function sanitizeTraceFields(value) {
  if (!isRecord(value)) return undefined

  const traceId = typeof value.trace_id === "string" && SAFE_TRACE_ID_PATTERN.test(value.trace_id)
    ? value.trace_id.toLowerCase()
    : undefined
  const spanId = typeof value.span_id === "string" && SAFE_SPAN_ID_PATTERN.test(value.span_id)
    ? value.span_id.toLowerCase()
    : undefined
  const parentSpanId = typeof value.parent_span_id === "string" && SAFE_SPAN_ID_PATTERN.test(value.parent_span_id)
    ? value.parent_span_id.toLowerCase()
    : undefined
  const op = sanitizeOperationalCode(value.op, ALLOWED_SENTRY_OPERATIONS)
  const status = typeof value.status === "string" && SAFE_TRACE_STATUSES.has(value.status)
    ? value.status
    : undefined
  const origin = sanitizeOperationalCode(value.origin, ALLOWED_SENTRY_ORIGINS)

  return {
    ...(traceId ? { trace_id: traceId } : {}),
    ...(spanId ? { span_id: spanId } : {}),
    ...(parentSpanId ? { parent_span_id: parentSpanId } : {}),
    ...(op ? { op } : {}),
    ...(status ? { status } : {}),
    ...(origin ? { origin } : {}),
  }
}

/**
 * Retains only bounded primitive attributes from a caller-specific allowlist.
 * Route targets are classified before they can enter an event or trace.
 *
 * @param {unknown} value
 * @param {Set<string>} allowedKeys
 */
function sanitizePrimitiveEntries(value, allowedKeys) {
  if (!isRecord(value)) return undefined
  /** @type {Record<string, string | number>} */
  const safe = {}

  for (const [key, entryValue] of Object.entries(value)) {
    if (!allowedKeys.has(key)) continue

    if (key === "http.request.method" && typeof entryValue === "string") {
      const method = entryValue.trim().toUpperCase()
      if (SAFE_HTTP_METHODS.has(method)) safe[key] = method
      continue
    }
    if (key === "http.response.status_code" || key === "http.status_code") {
      const status = sanitizeHttpStatus(entryValue)
      if (status !== undefined) safe[key] = status
      continue
    }
    if (key === "http.target" && typeof entryValue === "string"
      && /^(https?:\/\/|\/)/i.test(entryValue.trim())) {
      safe[key] = classifyPrivacySafeRoute(entryValue).safePath
      continue
    }
    if (key === "sentry.op" || key === "sentry.origin") {
      const allowedValues = key === "sentry.op" ? ALLOWED_SENTRY_OPERATIONS : ALLOWED_SENTRY_ORIGINS
      const code = sanitizeOperationalCode(entryValue, allowedValues)
      if (code) safe[key] = code
    }
  }

  return safe
}

/**
 * Reconstructs the enum-only problem-report context used for operational
 * grouping and validates its optional event-correlation identifier.
 *
 * @param {unknown} value
 */
function sanitizeProblemReportContext(value) {
  if (!isRecord(value)) return undefined
  const safe = Object.fromEntries(
    Object.entries(value).flatMap(([key, entryValue]) => {
      if (key === "safePath" && typeof entryValue === "string"
        && ALLOWED_PROBLEM_REPORT_SAFE_PATHS.has(entryValue)) {
        return [[key, entryValue]]
      }
      if (key === "linkedEventId" && typeof entryValue === "string" && SAFE_TRACE_ID_PATTERN.test(entryValue)) {
        return [[key, entryValue.toLowerCase()]]
      }
      if (typeof entryValue === "string" && ALLOWED_PROBLEM_REPORT_CONTEXT_VALUES.get(key)?.has(entryValue)) {
        return [[key, entryValue]]
      }
      return []
    }),
  )
  return Object.keys(safe).length ? safe : undefined
}

/**
 * Coarsens URL-like operation names while retaining bounded SDK operation
 * codes that cannot carry request-specific values.
 *
 * @param {unknown} value
 */
export function sanitizeSentryOperation(value) {
  if (typeof value !== "string" || !value.trim()) return "[unknown]"
  const source = value.trim()
  const match = source.match(HTTP_OPERATION_PATTERN)
  if (match) return `${match[1].toUpperCase()} ${classifyPrivacySafeRoute(match[2]).safePath}`
  if (/^(https?:\/\/|\/)/i.test(source)) return classifyPrivacySafeRoute(source).safePath
  return sanitizeOperationalCode(source, ALLOWED_SENTRY_OPERATIONS) ?? FILTERED_VALUE
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
    Object.entries(value).flatMap(([key, entryValue]) => {
      if (SENSITIVE_IDENTITY_KEY_PATTERN.test(key)) return []

      if (SENSITIVE_KEY_PATTERN.test(key) || SENSITIVE_TELEMETRY_KEY_PATTERN.test(key)) {
        return [[key, FILTERED_VALUE]]
      }

      if (URL_KEY_PATTERN.test(key) && typeof entryValue === "string") {
        return [[key, redactInlineSensitiveValues(stripUrlSensitiveParts(entryValue))]]
      }

      return [[key, sanitizeUnknown(entryValue, depth + 1)]]
    }),
  )
}

/**
 * Removes every supplied user value while explicitly disabling Sentry's
 * server-side IP inference. The null marker carries no identity data and is
 * discarded during ingestion instead of becoming a stored user record.
 *
 * @param {Record<string, unknown>} event
 */
function scrubUser(event) {
  event.user = { ip_address: null }
}

/**
 * Retains only fixed operational codes that cannot carry arbitrary telemetry.
 *
 * @param {Record<string, unknown>} event
 */
function scrubTags(event) {
  if (!isRecord(event.tags)) {
    delete event.tags
    return
  }

  event.tags = Object.fromEntries(
    Object.entries(event.tags).filter(([key, value]) => (
      ALLOWED_EVENT_TAGS.has(key)
      && typeof value === "string"
      && SAFE_OPERATIONAL_CODE_PATTERN.test(value)
    )),
  )
}

/**
 * @param {Record<string, unknown>} event
 */
function scrubRequest(event) {
  if (!isRecord(event.request)) {
    delete event.request
    return
  }

  const candidateMethod = typeof event.request.method === "string"
    ? event.request.method.toUpperCase()
    : ""
  const method = SAFE_HTTP_METHODS.has(candidateMethod) ? candidateMethod : undefined
  const url = typeof event.request.url === "string"
    ? classifyPrivacySafeRoute(event.request.url).safePath
    : undefined

  event.request = {
    ...(method ? { method } : {}),
    ...(url ? { url } : {}),
  }
}

/**
 * Reconstructs Sentry contexts from the narrow operational families needed
 * for trace correlation and privacy-safe problem reports.
 *
 * @param {Record<string, unknown>} event
 */
function scrubContexts(event) {
  if (!isRecord(event.contexts)) {
    delete event.contexts
    return
  }

  const contexts = event.contexts
  /** @type {Record<string, unknown>} */
  const safe = {}

  if (isRecord(contexts.trace)) {
    const trace = contexts.trace
    const traceData = sanitizePrimitiveEntries(trace.data, ALLOWED_TRACE_DATA_KEYS)
    safe.trace = {
      ...sanitizeTraceFields(trace),
      ...(traceData && Object.keys(traceData).length ? { data: traceData } : {}),
    }
  }

  if (isRecord(contexts.browser)
    && typeof contexts.browser.name === "string"
    && SAFE_CONTEXT_NAME_PATTERN.test(contexts.browser.name)) {
    safe.browser = { name: contexts.browser.name }
  }

  if (isRecord(contexts.runtime)
    && typeof contexts.runtime.name === "string"
    && SAFE_CONTEXT_NAME_PATTERN.test(contexts.runtime.name)) {
    safe.runtime = { name: contexts.runtime.name }
  }

  if (isRecord(contexts.os)
    && typeof contexts.os.name === "string"
    && SAFE_CONTEXT_NAME_PATTERN.test(contexts.os.name)) {
    safe.os = { name: contexts.os.name }
  }

  const problemReport = sanitizeProblemReportContext(contexts.problemReport)
  if (problemReport) safe.problemReport = problemReport

  event.contexts = safe
}

/**
 * MassageLab does not retain automatic breadcrumb history. Operational
 * context belongs in bounded event fields instead of a behavioral trail.
 *
 * @param {unknown} _breadcrumb
 * @returns {null}
 */
export function sanitizeSentryBreadcrumb(_breadcrumb) {
  void _breadcrumb
  return null
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
  scrubTags(event)
  scrubRequest(event)
  scrubContexts(event)
  scrubBreadcrumbs(event)

  if (isRecord(event.exception)) {
    event.exception = sanitizeUnknown(event.exception)
  }

  if (isRecord(event.logentry)) {
    event.logentry = sanitizeUnknown(event.logentry)
  }

  scrubDiagnosticMessages(event)

  if (typeof event.transaction === "string") {
    event.transaction = sanitizeSentryOperation(event.transaction)
  }

  delete event.extra

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
  if (!isRecord(span)) return span

  const traceFields = sanitizeTraceFields(span)
  for (const key of ["trace_id", "span_id", "parent_span_id", "op", "status", "origin"]) {
    delete span[key]
  }
  Object.assign(span, traceFields)

  if ("description" in span) span.description = sanitizeSentryOperation(span.description)
  if ("name" in span) span.name = sanitizeSentryOperation(span.name)

  const data = sanitizePrimitiveEntries(span.data, ALLOWED_SPAN_DATA_KEYS)
  const attributes = sanitizePrimitiveEntries(span.attributes, ALLOWED_SPAN_DATA_KEYS)

  if (data && Object.keys(data).length) span.data = data
  else delete span.data
  if (attributes && Object.keys(attributes).length) span.attributes = attributes
  else delete span.attributes

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
