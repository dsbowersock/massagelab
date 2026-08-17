// @ts-check

import {
  classifyPrivacySafeRoute,
  normalizePrivacySafePath,
} from "./privacy-route.js"

export {
  classifyPrivacySafeRoute as classifyProblemReportRoute,
  normalizePrivacySafePath as normalizeProblemReportPath,
} from "./privacy-route.js"

/**
 * @typedef {{ id: string, label: string }} ProblemReportCategory
 * @typedef {{ id: string, label: string, area: string, safePath: string, privacyLevel: string }} ProblemReportArea
 */

export const PROBLEM_REPORT_CATEGORIES = /** @type {readonly ProblemReportCategory[]} */ (Object.freeze([
  { id: "action-failed", label: "Button or action failed" },
  { id: "page-error", label: "Page crashed or would not load" },
  { id: "data-display", label: "Data looked wrong" },
  { id: "layout-display", label: "Layout or display problem" },
  { id: "audio-playback", label: "Audio or playback problem" },
  { id: "account-access", label: "Account or access problem" },
  { id: "other", label: "Other problem" },
]))

export const PROBLEM_REPORT_AREAS = /** @type {readonly ProblemReportArea[]} */ (Object.freeze([
  {
    id: "not-sure",
    label: "Not sure",
    area: "unknown",
    safePath: "/[unknown]",
    privacyLevel: "unknown",
  },
  {
    id: "notes-professional-records",
    label: "Notes, intake, journal, or ROM",
    area: "professional-records",
    safePath: "/notes/[local-first]",
    privacyLevel: "local-first-phi-capable",
  },
  {
    id: "wellness",
    label: "Wellness tools",
    area: "wellness",
    safePath: "/wellness/[self-tracking]",
    privacyLevel: "consumer-health",
  },
  {
    id: "calendar-booking",
    label: "Calendar or booking",
    area: "calendar-booking",
    safePath: "/calendar-or-booking",
    privacyLevel: "scheduling-contact",
  },
  {
    id: "account-billing",
    label: "Account, billing, or login",
    area: "account-billing",
    safePath: "/account-or-billing",
    privacyLevel: "account-private",
  },
  {
    id: "education",
    label: "Education or flashcards",
    area: "education",
    safePath: "/education/[study]",
    privacyLevel: "public-study",
  },
  {
    id: "anatomime",
    label: "Anatomime",
    area: "anatomime",
    safePath: "/anatomime/[game]",
    privacyLevel: "public-study",
  },
  {
    id: "chimer-clock",
    label: "Chimer or clock",
    area: "timer",
    safePath: "/timer",
    privacyLevel: "public-tool",
  },
  {
    id: "music",
    label: "Music",
    area: "music",
    safePath: "/music",
    privacyLevel: "public-tool",
  },
  {
    id: "admin-anatomy",
    label: "Admin anatomy tools",
    area: "admin-anatomy",
    safePath: "/admin/anatomy/[admin]",
    privacyLevel: "admin-private",
  },
  {
    id: "public-page",
    label: "Public page",
    area: "public-page",
    safePath: "/public-page",
    privacyLevel: "public",
  },
]))

const DEFAULT_CATEGORY = PROBLEM_REPORT_CATEGORIES[0]
const DEFAULT_AREA = PROBLEM_REPORT_AREAS[0]
const EVENT_ID_PATTERN = /^[a-f0-9]{32}$/i

/**
 * @template {{ id: string }} T
 * @param {unknown} value
 * @param {readonly T[]} options
 * @param {T} fallback
 * @returns {T}
 */
function optionById(value, options, fallback) {
  if (typeof value !== "string") {
    return fallback
  }

  return options.find((option) => option.id === value) ?? fallback
}

/**
 * @param {unknown} value
 */
export function problemReportCategoryById(value) {
  return optionById(value, PROBLEM_REPORT_CATEGORIES, DEFAULT_CATEGORY)
}

/**
 * @param {unknown} value
 */
export function problemReportAreaById(value) {
  return optionById(value, PROBLEM_REPORT_AREAS, DEFAULT_AREA)
}

/**
 * @param {unknown} value
 */
export function normalizeLinkedSentryEventId(value) {
  return typeof value === "string" && EVENT_ID_PATTERN.test(value.trim())
    ? value.trim().toLowerCase()
    : undefined
}

/**
 * @param {unknown} userAgent
 */
export function getSafeBrowserHint(userAgent) {
  const source = typeof userAgent === "string" ? userAgent : ""

  if (/Edg\//.test(source)) return "edge"
  if (/Firefox\//.test(source)) return "firefox"
  if (/CriOS\//.test(source)) return "chrome-ios"
  if (/Chrome\//.test(source)) return "chrome"
  if (/Safari\//.test(source)) return "safari"

  return "unknown"
}

/**
 * @param {unknown} width
 */
function viewportBucket(width) {
  const parsed = typeof width === "number" ? width : Number(width)

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return "unknown"
  }

  if (parsed < 640) return "small"
  if (parsed < 1024) return "medium"
  return "large"
}

/**
 * @param {unknown} value
 * @param {readonly string[]} allowed
 * @param {string} fallback
 */
function enumValue(value, allowed, fallback) {
  return typeof value === "string" && allowed.includes(value) ? value : fallback
}

/**
 * @param {unknown} value
 */
export function normalizeProblemReportClientContext(value) {
  const input = /** @type {Record<string, unknown>} */ (
    value && typeof value === "object" && !Array.isArray(value) ? value : {}
  )

  return {
    displayMode: enumValue(input.displayMode, ["browser", "standalone", "fullscreen", "minimal-ui"], "unknown"),
    network: input.online === true ? "online" : input.online === false ? "offline" : "unknown",
    viewport: viewportBucket(input.viewportWidth),
  }
}

/**
 * Builds the only Sentry payload allowed for user-initiated problem reports.
 * Do not add freeform user text, screenshots, form values, vault data, or full
 * URLs here; the endpoint intentionally reports only known enums and coarse
 * operational context.
 *
 * @param {object} input
 * @param {unknown} [input.category]
 * @param {unknown} [input.area]
 * @param {unknown} [input.route]
 * @param {unknown} [input.linkedEventId]
 * @param {unknown} [input.clientContext]
 * @param {unknown} [input.userAgent]
 */
export function buildProblemReportSentryPayload(input = {}) {
  const category = problemReportCategoryById(input.category)
  const selectedArea = problemReportAreaById(input.area)
  const route = selectedArea.id === "not-sure"
    ? classifyPrivacySafeRoute(input.route)
    : {
        area: selectedArea.area,
        safePath: selectedArea.safePath,
        privacyLevel: selectedArea.privacyLevel,
      }
  const linkedEventId = normalizeLinkedSentryEventId(input.linkedEventId)
  const clientContext = normalizeProblemReportClientContext(input.clientContext)

  return {
    message: "MassageLab privacy-safe problem report",
    level: "warning",
    tags: {
      "ml.report": "privacy-safe-problem-report",
      "ml.report.category": category.id,
      "ml.report.area": route.area,
      "ml.report.privacy": route.privacyLevel,
    },
    contexts: {
      problemReport: {
        category: category.id,
        selectedArea: selectedArea.id,
        area: route.area,
        safePath: route.safePath,
        privacyLevel: route.privacyLevel,
        browser: getSafeBrowserHint(input.userAgent),
        displayMode: clientContext.displayMode,
        network: clientContext.network,
        viewport: clientContext.viewport,
        ...(linkedEventId ? { linkedEventId } : {}),
      },
    },
  }
}
