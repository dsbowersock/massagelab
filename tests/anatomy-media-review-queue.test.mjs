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
      "/admin/anatomy/media-review?preset=upper-limb&reason=bad_view&sort=oldest&offset=4",
    )
    assert.equal(
      mediaReviewQueueHref(filters, { reason: "bad_match", offset: 0 }),
      "/admin/anatomy/media-review?preset=upper-limb&reason=bad_match&sort=oldest",
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
