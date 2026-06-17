# Anatomy Media Review Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add URL-driven presets and filters to `/admin/anatomy/media-review` so anatomy admins can clear image review batches by anatomy area and image-problem type while staying in the active queue after each decision.

**Architecture:** Add one pure JavaScript queue-filter helper for parsing, preset mapping, URL generation, hidden form fields, and post-decision offset rules. Wire that helper into the existing server-rendered Next.js admin queue and the existing server action redirect path. Resolve anatomy-area presets from the existing anatomy study adapter so queue batches match the public education taxonomy without adding database schema.

**Tech Stack:** Next.js App Router, React Server Components, Prisma, Node `node:test`, existing MassageLab anatomy study/media helpers.

---

## File Structure

- Create: `lib/anatomy-media-review-queue.js`
  - Owns queue filter constants, preset definitions, parser, URL builder, hidden form field mapper, and post-decision offset rules.
  - Pure JavaScript so `node --test` can import it directly.
- Create: `tests/anatomy-media-review-queue.test.mjs`
  - Unit coverage for parsing, preset mapping, URL generation, hidden fields, and offset behavior.
- Modify: `app/admin/anatomy/actions.ts`
  - Replace the local queue redirect query builder with helper-backed redirect state preservation.
- Modify: `app/admin/anatomy/media-review/page.tsx`
  - Parse all queue filters from `searchParams`.
  - Resolve anatomy-area/entity batches.
  - Build filtered Prisma `where` clauses and sort order.
  - Render preset rows, active chips, advanced filter form, and preserved queue hidden fields.
- Modify: `tests/anatomy-admin-browser-ui.test.mjs`
  - Extend source-style assertions for presets, advanced controls, chips, and hidden queue fields.
- Modify: `docs/project-state.md`
  - Update the current snapshot and open priorities after implementation lands.
- Modify: `docs/project-log.md`
  - Add the completed branch entry after implementation and validation.

## Task 1: Add Queue Filter Helper

**Files:**
- Create: `tests/anatomy-media-review-queue.test.mjs`
- Create: `lib/anatomy-media-review-queue.js`

- [ ] **Step 1: Write the failing queue helper tests**

Create `tests/anatomy-media-review-queue.test.mjs` with:

```js
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  MEDIA_REVIEW_QUEUE_PRESETS,
  activeMediaReviewQueueChips,
  mediaReviewQueueFormFields,
  mediaReviewQueueHref,
  mediaReviewQueueOffsetAfterDecision,
  mediaReviewQueueRedirectPathFromForm,
  parseMediaReviewQueueFilters,
} from "../lib/anatomy-media-review-queue.js"

describe("Anatomy media review queue filters", () => {
  it("normalizes status, preset, refinements, sort, search, and offset", () => {
    const filters = parseMediaReviewQueueFilters({
      status: "approved",
      preset: "upper-limb",
      entityType: "muscle",
      reason: "bad_view",
      view: "posterior",
      request: "open",
      sort: "entity",
      q: " Biceps ",
      offset: "3",
    })

    assert.equal(filters.status, "approved")
    assert.equal(filters.preset, "upper-limb")
    assert.deepEqual(filters.regions, ["upper-extremity"])
    assert.deepEqual(filters.entityTypes, ["MUSCLE"])
    assert.equal(filters.reason, "bad_view")
    assert.equal(filters.view, "posterior")
    assert.equal(filters.request, "open")
    assert.equal(filters.sort, "entity")
    assert.equal(filters.q, "Biceps")
    assert.equal(filters.offset, 3)
  })

  it("falls back to the needs-review priority queue for unknown params", () => {
    const filters = parseMediaReviewQueueFilters({
      status: "bad",
      preset: "missing",
      entityType: "not-real",
      reason: "not-real",
      view: "not-real",
      request: "closed",
      sort: "random",
      offset: "-10",
    })

    assert.equal(filters.status, "needs-review")
    assert.equal(filters.preset, "")
    assert.deepEqual(filters.regions, [])
    assert.deepEqual(filters.entityTypes, [])
    assert.equal(filters.reason, "")
    assert.equal(filters.view, "")
    assert.equal(filters.request, "")
    assert.equal(filters.sort, "priority")
    assert.equal(filters.offset, 0)
  })

  it("defines primary anatomy presets and secondary cleanup presets", () => {
    const presetKeys = MEDIA_REVIEW_QUEUE_PRESETS.map((preset) => preset.key)
    const upperLimb = MEDIA_REVIEW_QUEUE_PRESETS.find((preset) => preset.key === "upper-limb")
    const badView = MEDIA_REVIEW_QUEUE_PRESETS.find((preset) => preset.key === "bad-view")

    assert.ok(presetKeys.includes("upper-limb"))
    assert.ok(presetKeys.includes("lower-limb"))
    assert.ok(presetKeys.includes("head-neck"))
    assert.ok(presetKeys.includes("muscles"))
    assert.ok(presetKeys.includes("open-requests"))
    assert.ok(presetKeys.includes("bad-match"))
    assert.equal(upperLimb?.group, "anatomy")
    assert.deepEqual(upperLimb?.filters.regions, ["upper-extremity"])
    assert.equal(badView?.group, "cleanup")
    assert.equal(badView?.filters.reason, "bad_view")
  })

  it("builds stable shareable URLs and resets offset when filters change", () => {
    const filters = parseMediaReviewQueueFilters({
      status: "needs-review",
      preset: "upper-limb",
      reason: "bad_view",
      sort: "oldest",
      offset: "4",
    })

    assert.equal(
      mediaReviewQueueHref(filters),
      "/admin/anatomy/media-review?status=needs-review&preset=upper-limb&reason=bad_view&sort=oldest&offset=4",
    )
    assert.equal(
      mediaReviewQueueHref(filters, { reason: "bad_match", offset: 0 }),
      "/admin/anatomy/media-review?status=needs-review&preset=upper-limb&reason=bad_match&sort=oldest",
    )
  })

  it("serializes hidden form fields for decision redirects", () => {
    const fields = mediaReviewQueueFormFields(parseMediaReviewQueueFilters({
      status: "all",
      preset: "muscles",
      view: "anterior",
      q: "scapula",
      sort: "newest",
      offset: "2",
    }))

    assert.deepEqual(fields, [
      ["queue_status", "all"],
      ["queue_preset", "muscles"],
      ["queue_entity_type", ""],
      ["queue_reason", ""],
      ["queue_view", "anterior"],
      ["queue_request", ""],
      ["queue_sort", "newest"],
      ["queue_q", "scapula"],
      ["queue_offset", "2"],
    ])
  })

  it("preserves filters when redirecting from queue decisions", () => {
    const formData = new FormData()
    formData.set("queue_status", "all")
    formData.set("queue_preset", "upper-limb")
    formData.set("queue_reason", "bad_view")
    formData.set("queue_sort", "oldest")
    formData.set("queue_offset", "5")

    assert.equal(
      mediaReviewQueueRedirectPathFromForm(formData),
      "/admin/anatomy/media-review?status=all&preset=upper-limb&reason=bad_view&sort=oldest&offset=5",
    )
  })

  it("advances only when the reviewed row remains in the active queue", () => {
    const allBadView = parseMediaReviewQueueFilters({ status: "all", reason: "bad_view", offset: "4" })
    const needsReviewBadView = parseMediaReviewQueueFilters({ status: "needs-review", reason: "bad_view", offset: "4" })

    assert.equal(mediaReviewQueueOffsetAfterDecision(allBadView, "REJECTED", "bad_view"), 5)
    assert.equal(mediaReviewQueueOffsetAfterDecision(needsReviewBadView, "APPROVED", ""), 4)
    assert.equal(mediaReviewQueueOffsetAfterDecision(needsReviewBadView, "NEEDS_REVIEW", "bad_view"), 5)
    assert.equal(mediaReviewQueueOffsetAfterDecision(needsReviewBadView, "NEEDS_REVIEW", "bad_match"), 4)
  })

  it("labels active chips without duplicating defaults", () => {
    const chips = activeMediaReviewQueueChips(parseMediaReviewQueueFilters({
      status: "needs-review",
      preset: "upper-limb",
      reason: "bad_view",
      sort: "priority",
    }))

    assert.deepEqual(chips.map((chip) => chip.label), ["Upper limb", "Bad view"])
  })
})
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```powershell
node --test tests/anatomy-media-review-queue.test.mjs
```

Expected: FAIL because `../lib/anatomy-media-review-queue.js` does not exist.

- [ ] **Step 3: Implement the queue helper**

Create `lib/anatomy-media-review-queue.js`:

```js
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
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run:

```powershell
node --test tests/anatomy-media-review-queue.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

Run:

```powershell
git add lib/anatomy-media-review-queue.js tests/anatomy-media-review-queue.test.mjs
git commit -m "Add anatomy media queue filter helpers"
```

Expected: Commit succeeds.

## Task 2: Preserve Queue Filters In Server Action Redirects

**Files:**
- Modify: `app/admin/anatomy/actions.ts`
- Test: `tests/anatomy-media-review-queue.test.mjs`

- [ ] **Step 1: Extend the helper test for decision offsets from FormData**

Add this test to `tests/anatomy-media-review-queue.test.mjs`:

```js
it("computes the next queue offset from FormData decision fields", () => {
  const formData = new FormData()
  formData.set("queue_status", "needs-review")
  formData.set("queue_preset", "upper-limb")
  formData.set("queue_reason", "bad_view")
  formData.set("queue_offset", "6")

  const filters = parseMediaReviewQueueFilters({
    status: formData.get("queue_status"),
    preset: formData.get("queue_preset"),
    reason: formData.get("queue_reason"),
    offset: formData.get("queue_offset"),
  })

  assert.equal(mediaReviewQueueOffsetAfterDecision(filters, "NEEDS_REVIEW", "bad_view"), 7)
  assert.equal(mediaReviewQueueOffsetAfterDecision(filters, "APPROVED", ""), 6)
})
```

- [ ] **Step 2: Run the helper test**

Run:

```powershell
node --test tests/anatomy-media-review-queue.test.mjs
```

Expected: PASS. This confirms the helper behavior before the server action is rewired.

- [ ] **Step 3: Import the redirect helper in `actions.ts`**

Modify the imports in `app/admin/anatomy/actions.ts`:

```ts
import {
  mediaReviewQueueFiltersFromForm,
  mediaReviewQueueHref,
  mediaReviewQueueOffsetAfterDecision,
  mediaReviewQueueRedirectPathFromForm,
} from "@/lib/anatomy-media-review-queue"
```

- [ ] **Step 4: Remove the local status set and replace the redirect helper**

Delete:

```ts
const MEDIA_REVIEW_QUEUE_STATUSES = new Set(["needs-review", "rejected", "approved", "all"])
```

Replace `mediaReviewQueueRedirectPath` with:

```ts
function mediaReviewQueueRedirectPath(formData: FormData) {
  return mediaReviewQueueRedirectPathFromForm(formData)
}
```

- [ ] **Step 5: Compute queue offset after the decision knows the next state**

In `reviewAnatomyMediaQueueDecisionAction`, after `reviewReason` is computed and before `redirect(...)`, compute the preserved queue filters and set the next offset:

```ts
  const queueFilters = mediaReviewQueueFiltersFromForm(formData)
  const nextOffset = mediaReviewQueueOffsetAfterDecision(queueFilters, reviewStatus, reviewReason ?? "")
  const redirectHref = mediaReviewQueueHref(queueFilters, { offset: nextOffset })
```

Then replace the final redirect:

```ts
  redirect(redirectHref)
```

Keep the early missing-id redirect as:

```ts
  if (!id) {
    redirect(mediaReviewQueueRedirectPath(formData))
  }
```

- [ ] **Step 6: Run focused validation**

Run:

```powershell
npm run typecheck
node --test tests/anatomy-media-review-queue.test.mjs
```

Expected: `npm run typecheck` passes and the helper test passes.

- [ ] **Step 7: Commit Task 2**

Run:

```powershell
git add app/admin/anatomy/actions.ts tests/anatomy-media-review-queue.test.mjs
git commit -m "Preserve media review queue filters in actions"
```

Expected: Commit succeeds.

## Task 3: Build Filtered Queue Data

**Files:**
- Modify: `app/admin/anatomy/media-review/page.tsx`
- Test: `tests/anatomy-admin-browser-ui.test.mjs`

- [ ] **Step 1: Add source assertions for the filtered data flow**

In `tests/anatomy-admin-browser-ui.test.mjs`, extend the `"adds a mobile-first image review queue backed by link review state"` test with:

```js
    assert.match(queueSource, /parseMediaReviewQueueFilters/)
    assert.match(queueSource, /getAnatomyStudyCards/)
    assert.match(queueSource, /function entityFiltersForQueueFilters/)
    assert.match(queueSource, /function mediaReviewQueueWhere/)
    assert.match(queueSource, /function mediaReviewQueueOrderBy/)
    assert.match(queueSource, /metadata: \{[\s\S]*path: \["bodyparts3dView"\]/)
    assert.match(queueSource, /anatomyMediaViewRequest\.findMany/)
    assert.match(queueSource, /filteredTotal/)
```

- [ ] **Step 2: Run the source test to verify it fails**

Run:

```powershell
node --test tests/anatomy-admin-browser-ui.test.mjs
```

Expected: FAIL on the new assertions because the page has not been wired to the queue helper yet.

- [ ] **Step 3: Import helper and study adapter into the queue page**

Add imports to `app/admin/anatomy/media-review/page.tsx`:

```ts
import {
  MEDIA_REVIEW_QUEUE_ENTITY_TYPES,
  MEDIA_REVIEW_QUEUE_PRESETS,
  MEDIA_REVIEW_QUEUE_REASONS,
  MEDIA_REVIEW_QUEUE_REQUESTS,
  MEDIA_REVIEW_QUEUE_SORTS,
  MEDIA_REVIEW_QUEUE_STATUS_OPTIONS,
  MEDIA_REVIEW_QUEUE_VIEWS,
  activeMediaReviewQueueChips,
  mediaReviewQueueFormFields,
  mediaReviewQueueHref,
  mediaReviewQueueOffsetAfterDecision,
  parseMediaReviewQueueFilters,
} from "@/lib/anatomy-media-review-queue"
import { getAnatomyStudyCards } from "@/lib/anatomy-study"
```

- [ ] **Step 4: Expand search param typing and queue data types**

Replace `AnatomyMediaReviewQueuePageProps` search params with:

```ts
type AnatomyMediaReviewQueuePageProps = {
  searchParams?: Promise<{
    status?: string
    preset?: string
    entityType?: string
    reason?: string
    view?: string
    request?: string
    sort?: string
    q?: string
    offset?: string
  }>
}
```

Add to `QueueData`:

```ts
  filteredTotal: number
```

- [ ] **Step 5: Parse filters in the page component**

Replace:

```ts
  const selectedStatus = queueStatusFromParam(params?.status)
  const offset = queueOffsetFromParam(params?.offset)
  const data = await getMediaReviewQueueData(selectedStatus, offset)
```

with:

```ts
  const filters = parseMediaReviewQueueFilters(params ?? {})
  const selectedStatus = MEDIA_REVIEW_QUEUE_STATUS_OPTIONS.find((status) => status.key === filters.status) ?? MEDIA_REVIEW_QUEUE_STATUS_OPTIONS[0]
  const data = await getMediaReviewQueueData(filters)
```

Replace the redirect guard with:

```ts
  if (data.rows.length === 0 && data.filteredTotal > 0 && filters.offset > 0) {
    redirect(mediaReviewQueueHref(filters, { offset: 0 }))
  }
```

- [ ] **Step 6: Add study-category to Prisma entity mapping**

Add near queue helpers in `page.tsx`:

```ts
const STUDY_CATEGORY_TO_ENTITY_TYPE: Record<string, AnatomyEntityType> = {
  bone: "BONE",
  bone_landmark: "BONE_LANDMARK",
  joint: "JOINT",
  joint_movement: "JOINT_MOVEMENT",
  range_of_motion: "RANGE_OF_MOTION",
  muscle: "MUSCLE",
  muscle_attachment: "MUSCLE_ATTACHMENT",
  muscle_action: "MUSCLE_ACTION",
  nerve: "NERVE",
  muscle_innervation: "MUSCLE_INNERVATION",
  ligament: "LIGAMENT",
  anatomy_structure: "ANATOMY_STRUCTURE",
  anatomy_concept: "ANATOMY_CONCEPT",
  pain_map_region: "PAIN_MAP_REGION",
}
```

- [ ] **Step 7: Add entity resolution for filters**

Add:

```ts
function entityFiltersForQueueFilters(filters: ReturnType<typeof parseMediaReviewQueueFilters>): Prisma.AnatomyMediaEntityWhereInput[] {
  const cards = getAnatomyStudyCards({
    categories: filters.categories,
    regions: filters.regions,
    difficulty: "hard",
  })
  const entityFilters = new Map<string, Prisma.AnatomyMediaEntityWhereInput>()

  for (const card of cards) {
    const entityType = STUDY_CATEGORY_TO_ENTITY_TYPE[card.entityType]
    if (!entityType) continue
    const key = `${entityType}:${card.entitySlug}`
    entityFilters.set(key, { entityType, entitySlug: card.entitySlug })
  }

  for (const entityType of filters.entityTypes) {
    entityFilters.set(`type:${entityType}`, { entityType: entityType as AnatomyEntityType })
  }

  return [...entityFilters.values()]
}
```

- [ ] **Step 8: Add request resolution for open replacement batches**

Add:

```ts
async function openRequestEntityFilters() {
  const rows = await prisma.anatomyMediaViewRequest.findMany({
    where: { status: "OPEN" },
    select: {
      entityType: true,
      entitySlug: true,
    },
    orderBy: { createdAt: "asc" },
    take: 500,
  })

  return rows.map((row) => ({
    entityType: row.entityType,
    entitySlug: row.entitySlug,
  }))
}
```

- [ ] **Step 9: Add `where` and `orderBy` builders**

Add:

```ts
async function mediaReviewQueueWhere(filters: ReturnType<typeof parseMediaReviewQueueFilters>) {
  const andFilters: Prisma.AnatomyMediaEntityWhereInput[] = [
    { asset: { mediaType: { in: IMAGE_REVIEW_MEDIA_TYPES } } },
  ]

  if (filters.reviewStatus) andFilters.push({ reviewStatus: filters.reviewStatus })
  if (filters.reason) andFilters.push({ reviewReason: filters.reason })
  if (filters.view) {
    andFilters.push({
      asset: {
        metadata: {
          path: ["bodyparts3dView"],
          equals: filters.view,
        },
      },
    })
  }
  if (filters.q) {
    andFilters.push({
      OR: [
        { entitySlug: { contains: filters.q, mode: "insensitive" } },
        { asset: { title: { contains: filters.q, mode: "insensitive" } } },
        { asset: { slug: { contains: filters.q, mode: "insensitive" } } },
        { asset: { source: { label: { contains: filters.q, mode: "insensitive" } } } },
        { asset: { source: { slug: { contains: filters.q, mode: "insensitive" } } } },
      ],
    })
  }

  const entityFilters = entityFiltersForQueueFilters(filters)
  if (filters.request === "open") {
    const requestEntityFilters = await openRequestEntityFilters()
    if (requestEntityFilters.length === 0) andFilters.push({ id: "__no-open-request-media-review-rows__" })
    else andFilters.push({ OR: requestEntityFilters })
  }
  if (entityFilters.length > 0) {
    andFilters.push({ OR: entityFilters })
  }

  return { AND: andFilters } satisfies Prisma.AnatomyMediaEntityWhereInput
}

function mediaReviewQueueOrderBy(filters: ReturnType<typeof parseMediaReviewQueueFilters>): Prisma.AnatomyMediaEntityOrderByWithRelationInput[] {
  switch (filters.sort) {
    case "newest":
      return [{ createdAt: "desc" }]
    case "oldest":
      return [{ createdAt: "asc" }]
    case "entity":
      return [{ entitySlug: "asc" }, { displayPriority: "asc" }, { createdAt: "asc" }]
    case "priority":
    default:
      return [{ reviewStatus: "asc" }, { displayPriority: "asc" }, { createdAt: "asc" }]
  }
}
```

- [ ] **Step 10: Update `getMediaReviewQueueData`**

Change the signature:

```ts
async function getMediaReviewQueueData(filters: ReturnType<typeof parseMediaReviewQueueFilters>): Promise<QueueData> {
```

At the top:

```ts
  const where = await mediaReviewQueueWhere(filters)
```

Use:

```ts
      orderBy: mediaReviewQueueOrderBy(filters),
      skip: filters.offset,
```

Set `filteredTotal` in the returned object:

```ts
    filteredTotal: total,
```

- [ ] **Step 11: Run focused validation**

Run:

```powershell
node --test tests/anatomy-admin-browser-ui.test.mjs
npm run typecheck
```

Expected: source test passes and typecheck passes.

- [ ] **Step 12: Commit Task 3**

Run:

```powershell
git add app/admin/anatomy/media-review/page.tsx tests/anatomy-admin-browser-ui.test.mjs
git commit -m "Filter anatomy media review queue data"
```

Expected: Commit succeeds.

## Task 4: Render Presets, Active Chips, And Advanced Filters

**Files:**
- Modify: `app/admin/anatomy/media-review/page.tsx`
- Test: `tests/anatomy-admin-browser-ui.test.mjs`

- [ ] **Step 1: Add UI source assertions**

Extend the queue source test in `tests/anatomy-admin-browser-ui.test.mjs` with:

```js
    assert.match(queueSource, /function QueuePresetLinks/)
    assert.match(queueSource, /Anatomy batches/)
    assert.match(queueSource, /Image problem batches/)
    assert.match(queueSource, /function QueueActiveFilters/)
    assert.match(queueSource, /Clear filters/)
    assert.match(queueSource, /function QueueAdvancedFilters/)
    assert.match(queueSource, /name="entityType"/)
    assert.match(queueSource, /name="reason"/)
    assert.match(queueSource, /name="view"/)
    assert.match(queueSource, /name="request"/)
    assert.match(queueSource, /name="sort"/)
    assert.match(queueSource, /name="q"/)
    assert.match(queueSource, /mediaReviewQueueFormFields/)
    assert.match(queueSource, /name=\{name\} value=\{value\}/)
```

- [ ] **Step 2: Run the source test to verify it fails**

Run:

```powershell
node --test tests/anatomy-admin-browser-ui.test.mjs
```

Expected: FAIL on the new UI assertions.

- [ ] **Step 3: Add preset and active-filter sections to the sticky header**

Below `<QueueStatusTabs ... />`, render:

```tsx
        <QueuePresetLinks filters={filters} />
        <QueueActiveFilters filters={filters} />
        <QueueAdvancedFilters filters={filters} />
```

Pass `filters` to `ImageReviewCard`:

```tsx
          <ImageReviewCard row={currentRow} filters={filters} selectedStatus={selectedStatus} upcomingRows={upcomingRows} />
```

- [ ] **Step 4: Add `QueuePresetLinks`**

Add:

```tsx
function QueuePresetLinks({ filters }: { filters: ReturnType<typeof parseMediaReviewQueueFilters> }) {
  const anatomyPresets = MEDIA_REVIEW_QUEUE_PRESETS.filter((preset) => preset.group === "anatomy")
  const cleanupPresets = MEDIA_REVIEW_QUEUE_PRESETS.filter((preset) => preset.group === "cleanup")

  return (
    <div className="mt-3 space-y-2">
      <PresetGroup label="Anatomy batches" presets={anatomyPresets} filters={filters} />
      <PresetGroup label="Image problem batches" presets={cleanupPresets} filters={filters} />
    </div>
  )
}

function PresetGroup({
  label,
  presets,
  filters,
}: {
  label: string
  presets: typeof MEDIA_REVIEW_QUEUE_PRESETS
  filters: ReturnType<typeof parseMediaReviewQueueFilters>
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-normal text-muted-foreground">{label}</p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {presets.map((preset) => (
          <Button key={preset.key} asChild size="sm" variant={filters.preset === preset.key ? "default" : "outline"} className="shrink-0">
            <Link href={mediaReviewQueueHref(filters, { preset: preset.key, offset: 0 })}>{preset.label}</Link>
          </Button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Add `QueueActiveFilters`**

Add:

```tsx
function QueueActiveFilters({ filters }: { filters: ReturnType<typeof parseMediaReviewQueueFilters> }) {
  const chips = activeMediaReviewQueueChips(filters)
  if (chips.length === 0) return null

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <span key={chip.key} className="rounded-md border border-border/80 bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
          {chip.label}
        </span>
      ))}
      <Button asChild size="sm" variant="ghost">
        <Link href="/admin/anatomy/media-review">Clear filters</Link>
      </Button>
    </div>
  )
}
```

- [ ] **Step 6: Add `QueueAdvancedFilters`**

Add:

```tsx
function QueueAdvancedFilters({ filters }: { filters: ReturnType<typeof parseMediaReviewQueueFilters> }) {
  return (
    <details className="mt-3 rounded-md border border-border/80 bg-muted/20 p-3">
      <summary className="cursor-pointer text-sm font-medium">Advanced filters</summary>
      <form action="/admin/anatomy/media-review" className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <input type="hidden" name="status" value={filters.status} />
        <SelectField id="queue-entity-type" name="entityType" label="Entity type" values={["", ...MEDIA_REVIEW_QUEUE_ENTITY_TYPES.map((option) => option.key)]} defaultValue={filters.entityType} />
        <SelectField id="queue-reason" name="reason" label="Review reason" values={["", ...MEDIA_REVIEW_QUEUE_REASONS.map((option) => option.key)]} defaultValue={filters.reason} />
        <SelectField id="queue-view" name="view" label="BodyParts3D view" values={["", ...MEDIA_REVIEW_QUEUE_VIEWS.map((option) => option.key)]} defaultValue={filters.view} />
        <SelectField id="queue-request" name="request" label="Request state" values={["", ...MEDIA_REVIEW_QUEUE_REQUESTS.map((option) => option.key)]} defaultValue={filters.request} />
        <SelectField id="queue-sort" name="sort" label="Sort" values={MEDIA_REVIEW_QUEUE_SORTS.map((option) => option.key)} defaultValue={filters.sort} />
        <div className="space-y-2">
          <Label htmlFor="queue-search">Search</Label>
          <input id="queue-search" name="q" defaultValue={filters.q} className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </div>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
          <Button type="submit" size="sm">Apply filters</Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/anatomy/media-review">Reset</Link>
          </Button>
        </div>
      </form>
    </details>
  )
}
```

Update `SelectField` so blank values render a readable label:

```tsx
            {value ? formatLabel(value) : "Any"}
```

- [ ] **Step 7: Preserve filters in links and hidden fields**

Update `ImageReviewCard` props to accept `filters` and remove the direct `offset` prop:

```tsx
  filters,
}: {
  row: MediaQueueRow
  filters: ReturnType<typeof parseMediaReviewQueueFilters>
  selectedStatus: QueueStatusOption
  upcomingRows: MediaQueueRow[]
}) {
```

Replace skip and upcoming links:

```tsx
  const skipHref = mediaReviewQueueHref(filters, { offset: filters.offset + 1 })
```

```tsx
<Link key={upcomingRow.id} href={mediaReviewQueueHref(filters, { offset: filters.offset + index + 1 })} className="block rounded-md border border-border/70 p-2 text-sm transition hover:border-primary/60 hover:bg-accent">
```

Update decision forms to receive `filters` and use:

```tsx
      <BaseDecisionFields row={row} filters={filters} offset={mediaReviewQueueOffsetAfterDecision(filters, "APPROVED", "")} reviewStatus="APPROVED" />
```

For needs-better-view and reject forms, pass the expected default reason:

```tsx
      <BaseDecisionFields row={row} filters={filters} offset={mediaReviewQueueOffsetAfterDecision(filters, "NEEDS_REVIEW", row.reviewReason || "too_tight")} reviewStatus="NEEDS_REVIEW" />
```

```tsx
      <BaseDecisionFields row={row} filters={filters} offset={mediaReviewQueueOffsetAfterDecision(filters, "REJECTED", row.reviewReason || "bad_match")} reviewStatus="REJECTED" />
```

Replace `BaseDecisionFields` with helper-backed hidden fields:

```tsx
function BaseDecisionFields({
  row,
  filters,
  offset,
  reviewStatus,
}: {
  row: MediaQueueRow
  filters: ReturnType<typeof parseMediaReviewQueueFilters>
  offset: number
  reviewStatus: AnatomyMediaReviewStatus
}) {
  const queueFields = mediaReviewQueueFormFields({ ...filters, offset })

  return (
    <>
      <input type="hidden" name="id" value={row.id} />
      <input type="hidden" name="review_status" value={reviewStatus} />
      <input type="hidden" name="display_priority" value={String(row.displayPriority)} />
      <input type="hidden" name="notes" value={row.notes ?? ""} />
      {queueFields.map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {reviewStatus === "APPROVED" ? <input type="hidden" name="review_note" value="" /> : null}
    </>
  )
}
```

Delete the old local `queueOffsetAfterDecision`, `queueStatusFromParam`, `queueOffsetFromParam`, and `mediaReviewQueueHref` functions from `page.tsx`.

- [ ] **Step 8: Show filtered total in header copy**

Change the header count copy to:

```tsx
<p className="text-xs text-muted-foreground">
  {data.filteredTotal.toLocaleString()} in this batch / {data.total.toLocaleString()} in {selectedStatus.label.toLowerCase()} queue
</p>
```

- [ ] **Step 9: Run focused validation**

Run:

```powershell
node --test tests/anatomy-admin-browser-ui.test.mjs
npm run typecheck
```

Expected: source test passes and typecheck passes.

- [ ] **Step 10: Commit Task 4**

Run:

```powershell
git add app/admin/anatomy/media-review/page.tsx tests/anatomy-admin-browser-ui.test.mjs
git commit -m "Add anatomy media review queue controls"
```

Expected: Commit succeeds.

## Task 5: Update Project Docs

**Files:**
- Modify: `docs/project-state.md`
- Modify: `docs/project-log.md`

- [ ] **Step 1: Update current state after implementation**

In `docs/project-state.md`, update the current focus paragraph to mention:

```markdown
The dedicated anatomy media review queue now supports URL-driven status, anatomy-area, problem, view, request, sort, and search filters with built-in anatomy and cleanup presets that preserve the active batch through approve/reject/request decisions.
```

- [ ] **Step 2: Update open priorities**

In `docs/project-state.md`, revise the P2 visible product work bullet so `media review queue filters` no longer appears as a next candidate after the branch lands. Keep shared Anatomime classroom-session polish and flashcard UX hardening as remaining visible-product candidates.

- [ ] **Step 3: Add project-log branch entry**

In `docs/project-log.md`, add under the current 2026-06-17 entries:

```markdown
- Added the [Anatomy Media Review Filters implementation plan](superpowers/plans/2026-06-17-anatomy-media-review-filters.md) and implemented URL-driven anatomy media review batches: status tabs, anatomy-area presets, cleanup/problem presets, advanced filters, active chips, and decision redirects that keep admins inside the current filtered batch.
```

- [ ] **Step 4: Run doc diff review**

Run:

```powershell
git diff -- docs/project-state.md docs/project-log.md
```

Expected: Diff only documents the completed media-review filters branch and does not change unrelated priorities.

- [ ] **Step 5: Commit Task 5**

Run:

```powershell
git add docs/project-state.md docs/project-log.md
git commit -m "Document anatomy media review filters"
```

Expected: Commit succeeds.

## Task 6: Final Validation And Branch Review

**Files:**
- Review all changed files.

- [ ] **Step 1: Run focused helper and UI tests**

Run:

```powershell
node --test tests/anatomy-media-review-queue.test.mjs
node --test tests/anatomy-admin-browser-ui.test.mjs
```

Expected: Both focused test files pass.

- [ ] **Step 2: Run core validation**

Run:

```powershell
npm run typecheck
npm run lint
npm run test
npm run build
```

Expected: All commands pass.

- [ ] **Step 3: Check diff stat and whitespace**

Run:

```powershell
git diff --stat
git diff --check
```

Expected: Diff is limited to the queue helper, tests, queue page, server action redirect preservation, and docs. `git diff --check` emits no whitespace errors.

- [ ] **Step 4: Manual review checklist**

Review the final diff for these conditions:

- The queue still reviews one linked image at a time.
- No Prisma migration was added.
- No user-created saved filter storage was added.
- Preset and filter URLs are shareable.
- Decision forms preserve all queue filter params.
- The page does not duplicate the full anatomy browser.
- Public flashcard filtering behavior was not changed directly.

- [ ] **Step 5: Confirm final implementation status**

Run:

```powershell
git status --short
```

Expected: No unstaged implementation changes remain after the task-specific commits. Any remaining implementation diff belongs in the task that owns the affected file, followed by that task's validation command and commit step.
