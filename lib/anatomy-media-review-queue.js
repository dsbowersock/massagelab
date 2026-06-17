export const MEDIA_REVIEW_QUEUE_DEFAULT_STATUS = "needs-review"

export const MEDIA_REVIEW_QUEUE_STATUS_OPTIONS = [
  { key: "needs-review", label: "Needs Review", reviewStatus: "NEEDS_REVIEW" },
  { key: "rejected", label: "Rejected", reviewStatus: "REJECTED" },
  { key: "approved", label: "Approved", reviewStatus: "APPROVED" },
  { key: "all", label: "All", reviewStatus: null },
]

export const MEDIA_REVIEW_QUEUE_ENTITY_TYPES = [
  { key: "MUSCLE", label: "Muscles", categories: ["muscle"] },
  { key: "BONE", label: "Bones", categories: ["bone"] },
  { key: "JOINT", label: "Joints", categories: ["joint"] },
  { key: "LIGAMENT", label: "Ligaments", categories: ["ligament"] },
  { key: "ANATOMY_STRUCTURE", label: "Structures", categories: ["anatomy_structure"] },
  { key: "ANATOMY_CONCEPT", label: "Concepts", categories: ["anatomy_concept"] },
]

export const MEDIA_REVIEW_QUEUE_REASONS = [
  { key: "bad_match", label: "Bad match" },
  { key: "bad_view", label: "Bad view" },
  { key: "too_tight", label: "Too tight" },
  { key: "too_broad", label: "Too broad" },
  { key: "too_unclear", label: "Too unclear" },
  { key: "duplicate", label: "Duplicate" },
  { key: "other", label: "Other" },
]

export const MEDIA_REVIEW_QUEUE_VIEWS = [
  { key: "anterior", label: "Anterior" },
  { key: "posterior", label: "Posterior" },
  { key: "left-lateral", label: "Left lateral" },
  { key: "right-lateral", label: "Right lateral" },
  { key: "superior", label: "Superior" },
  { key: "inferior", label: "Inferior" },
  { key: "transverse", label: "Transverse" },
  { key: "custom", label: "Custom" },
]

export const MEDIA_REVIEW_QUEUE_REQUESTS = [
  { key: "open", label: "Open requests" },
]

export const MEDIA_REVIEW_QUEUE_SORTS = [
  { key: "priority", label: "Priority" },
  { key: "newest", label: "Newest" },
  { key: "oldest", label: "Oldest" },
  { key: "entity", label: "Entity name" },
]

export const MEDIA_REVIEW_QUEUE_PRESETS = [
  { key: "upper-limb", label: "Upper limb", group: "anatomy", filters: { regions: ["upper-extremity"] } },
  { key: "lower-limb", label: "Lower limb", group: "anatomy", filters: { regions: ["lower-extremity"] } },
  { key: "trunk", label: "Trunk", group: "anatomy", filters: { regions: ["spine", "thorax", "abdomen", "pelvis"] } },
  { key: "head-neck", label: "Head/neck", group: "anatomy", filters: { regions: ["head"] } },
  { key: "muscles", label: "Muscles", group: "anatomy", filters: { entityTypes: ["MUSCLE"], categories: ["muscle"] } },
  { key: "bones-joints", label: "Bones/joints", group: "anatomy", filters: { entityTypes: ["BONE", "BONE_LANDMARK", "JOINT", "JOINT_MOVEMENT", "RANGE_OF_MOTION", "LIGAMENT"], categories: ["bone", "bone_landmark", "joint", "joint_movement", "range_of_motion", "ligament"] } },
  { key: "body-systems", label: "Body systems", group: "anatomy", filters: { entityTypes: ["ANATOMY_CONCEPT"], categories: ["anatomy_concept"], q: "system" } },
  { key: "open-requests", label: "Open requests", group: "cleanup", filters: { request: "open" } },
  { key: "bad-match", label: "Bad match", group: "cleanup", filters: { reason: "bad_match" } },
  { key: "bad-view", label: "Bad view", group: "cleanup", filters: { reason: "bad_view" } },
  { key: "too-tight", label: "Too tight", group: "cleanup", filters: { reason: "too_tight" } },
  { key: "rejected", label: "Rejected", group: "cleanup", filters: { status: "rejected" } },
]

const STATUS_KEYS = new Set(MEDIA_REVIEW_QUEUE_STATUS_OPTIONS.map((option) => option.key))
const ENTITY_TYPE_KEYS = new Set(MEDIA_REVIEW_QUEUE_ENTITY_TYPES.map((option) => option.key))
const REASON_KEYS = new Set(MEDIA_REVIEW_QUEUE_REASONS.map((option) => option.key))
const VIEW_KEYS = new Set(MEDIA_REVIEW_QUEUE_VIEWS.map((option) => option.key))
const REQUEST_KEYS = new Set(MEDIA_REVIEW_QUEUE_REQUESTS.map((option) => option.key))
const SORT_KEYS = new Set(MEDIA_REVIEW_QUEUE_SORTS.map((option) => option.key))
const PRESET_BY_KEY = new Map(MEDIA_REVIEW_QUEUE_PRESETS.map((preset) => [preset.key, preset]))

export const MEDIA_REVIEW_QUEUE_FORM_FIELDS = [
  ["status", "queue_status"],
  ["preset", "queue_preset"],
  ["entityType", "queue_entity_type"],
  ["reason", "queue_reason"],
  ["view", "queue_view"],
  ["request", "queue_request"],
  ["sort", "queue_sort"],
  ["q", "queue_q"],
  ["offset", "queue_offset"],
]

/**
 * Normalizes anatomy media review queue state from URL params, plain objects,
 * or FormData-like inputs into the contract shared by the queue page and
 * server action redirects.
 *
 * Presets are applied before explicit refinements. A valid `preset` key can
 * provide default status, regions, entity types, categories, reason, view,
 * request, sort, and search text; explicit URL/form values override those
 * defaults for scalar fields. When `entityType` is explicit it becomes the
 * only active entity type. Otherwise preset entity types are used. Categories
 * are the unique combination of preset categories plus categories implied by
 * the active entity types. `reviewStatus` is derived from the normalized
 * queue `status` and is `null` for the all-status queue.
 *
 * @param {object|FormData|URLSearchParams} input Queue state with optional
 * `status`, `preset`, `entityType`, `reason`, `view`, `request`, `sort`, `q`,
 * and `offset` fields. Object values may be strings or string arrays; only
 * the first array value is considered.
 * @returns {{
 *   status: string,
 *   reviewStatus: string | null,
 *   preset: string,
 *   presetLabel: string,
 *   presetGroup: string,
 *   regions: string[],
 *   categories: string[],
 *   entityType: string,
 *   entityTypes: string[],
 *   reason: string,
 *   view: string,
 *   request: string,
 *   sort: string,
 *   q: string,
 *   offset: number,
 * }} Normalized filters. Unknown options fall back to safe defaults, search
 * text is whitespace-collapsed and capped at 80 characters, and negative or
 * non-numeric offsets become zero.
 */
export function parseMediaReviewQueueFilters(input = {}) {
  const rawPreset = inputValue(input, "preset").toLowerCase()
  const preset = PRESET_BY_KEY.get(rawPreset)
  const presetFilters = preset?.filters ?? {}
  const status = normalizedOption(inputValue(input, "status") || presetFilters.status, STATUS_KEYS, MEDIA_REVIEW_QUEUE_DEFAULT_STATUS)
  const entityType = normalizedEntityType(inputValue(input, "entityType"))
  const entityTypes = entityType
    ? [entityType]
    : uniqueArray(presetFilters.entityTypes ?? [])
  const categories = uniqueArray([
    ...(presetFilters.categories ?? []),
    ...entityTypes.flatMap((type) => MEDIA_REVIEW_QUEUE_ENTITY_TYPES.find((option) => option.key === type)?.categories ?? []),
  ])

  return {
    status,
    reviewStatus: MEDIA_REVIEW_QUEUE_STATUS_OPTIONS.find((option) => option.key === status)?.reviewStatus ?? null,
    preset: preset?.key ?? "",
    presetLabel: preset?.label ?? "",
    presetGroup: preset?.group ?? "",
    regions: uniqueArray(presetFilters.regions ?? []),
    categories,
    entityType,
    entityTypes,
    reason: normalizedOption(inputValue(input, "reason") || presetFilters.reason, REASON_KEYS, ""),
    view: normalizedOption(inputValue(input, "view") || presetFilters.view, VIEW_KEYS, ""),
    request: normalizedOption(inputValue(input, "request") || presetFilters.request, REQUEST_KEYS, ""),
    sort: normalizedOption(inputValue(input, "sort") || presetFilters.sort, SORT_KEYS, "priority"),
    q: normalizeSearch(inputValue(input, "q") || presetFilters.q),
    offset: normalizeOffset(inputValue(input, "offset")),
  }
}

export function mediaReviewQueueHref(filters, overrides = {}) {
  const nextFilters = parseMediaReviewQueueFilters({ ...filters, ...overrides })
  const params = new URLSearchParams()

  setParam(params, "status", nextFilters.status, MEDIA_REVIEW_QUEUE_DEFAULT_STATUS)
  setParam(params, "preset", nextFilters.preset)
  setParam(params, "entityType", nextFilters.entityType)
  setParam(params, "reason", nextFilters.reason)
  setParam(params, "view", nextFilters.view)
  setParam(params, "request", nextFilters.request)
  setParam(params, "sort", nextFilters.sort, "priority")
  setParam(params, "q", nextFilters.q)
  if (nextFilters.offset > 0) params.set("offset", String(nextFilters.offset))

  const query = params.toString()
  return query ? `/admin/anatomy/media-review?${query}` : "/admin/anatomy/media-review"
}

export function mediaReviewQueueFormFields(filters) {
  const normalized = parseMediaReviewQueueFilters(filters)
  const values = {
    status: normalized.status,
    preset: normalized.preset,
    entityType: normalized.entityType,
    reason: normalized.reason,
    view: normalized.view,
    request: normalized.request,
    sort: normalized.sort,
    q: normalized.q,
    offset: String(normalized.offset),
  }

  return MEDIA_REVIEW_QUEUE_FORM_FIELDS.map(([paramName, fieldName]) => [fieldName, values[paramName] ?? ""])
}

export function mediaReviewQueueFiltersFromForm(formData) {
  const params = {}

  for (const [paramName, fieldName] of MEDIA_REVIEW_QUEUE_FORM_FIELDS) {
    params[paramName] = inputValue(formData, fieldName)
  }

  return parseMediaReviewQueueFilters(params)
}

export function mediaReviewQueueRedirectPathFromForm(formData) {
  return mediaReviewQueueHref(mediaReviewQueueFiltersFromForm(formData))
}

export function mediaReviewQueueOffsetAfterDecision(filters, nextReviewStatus, nextReviewReason) {
  const normalized = parseMediaReviewQueueFilters(filters)
  const nextStatusKey = queueStatusForReviewStatus(nextReviewStatus)
  const statusStillMatches = normalized.status === "all" || normalized.status === nextStatusKey
  const reasonStillMatches = !normalized.reason || normalized.reason === String(nextReviewReason ?? "")

  return statusStillMatches && reasonStillMatches ? normalized.offset + 1 : normalized.offset
}

export function activeMediaReviewQueueChips(filters) {
  const normalized = parseMediaReviewQueueFilters(filters)
  const chips = []

  if (normalized.preset) chips.push({ key: "preset", label: normalized.presetLabel })
  if (normalized.status !== MEDIA_REVIEW_QUEUE_DEFAULT_STATUS) chips.push({ key: "status", label: optionLabel(MEDIA_REVIEW_QUEUE_STATUS_OPTIONS, normalized.status) })
  if (normalized.entityType) chips.push({ key: "entityType", label: optionLabel(MEDIA_REVIEW_QUEUE_ENTITY_TYPES, normalized.entityType) })
  if (normalized.reason) chips.push({ key: "reason", label: optionLabel(MEDIA_REVIEW_QUEUE_REASONS, normalized.reason) })
  if (normalized.view) chips.push({ key: "view", label: optionLabel(MEDIA_REVIEW_QUEUE_VIEWS, normalized.view) })
  if (normalized.request) chips.push({ key: "request", label: optionLabel(MEDIA_REVIEW_QUEUE_REQUESTS, normalized.request) })
  if (normalized.q) chips.push({ key: "q", label: `Search: ${normalized.q}` })
  if (normalized.sort !== "priority") chips.push({ key: "sort", label: `Sort: ${optionLabel(MEDIA_REVIEW_QUEUE_SORTS, normalized.sort)}` })

  return chips
}

function inputValue(input, key) {
  if (!input) return ""
  if (typeof input.get === "function") {
    const value = input.get(key)
    return typeof value === "string" ? value.trim() : ""
  }

  const value = input[key]
  if (Array.isArray(value)) return String(value[0] ?? "").trim()
  return value === null || value === undefined ? "" : String(value).trim()
}

function normalizedOption(value, validKeys, fallback) {
  const normalized = String(value ?? "").trim().toLowerCase()
  return validKeys.has(normalized) ? normalized : fallback
}

function normalizedEntityType(value) {
  const normalized = String(value ?? "").trim().toUpperCase()
  return ENTITY_TYPE_KEYS.has(normalized) ? normalized : ""
}

function normalizeOffset(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0
}

function normalizeSearch(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, 80)
}

function setParam(params, key, value, defaultValue = "") {
  if (value && value !== defaultValue) params.set(key, String(value))
}

function uniqueArray(values) {
  return [...new Set(values.map(String).filter(Boolean))]
}

function queueStatusForReviewStatus(value) {
  switch (value) {
    case "APPROVED":
      return "approved"
    case "REJECTED":
      return "rejected"
    case "NEEDS_REVIEW":
    default:
      return "needs-review"
  }
}

function optionLabel(options, key) {
  return options.find((option) => option.key === key)?.label ?? key
}
