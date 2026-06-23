import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  QUICK_ACTION_MAX_VISIBLE,
  quickActionCatalog,
  resolveAnonymousQuickActionGroups,
  resolveExplicitQuickActionKeys,
  resolveQuickActionKeys,
} from "../lib/quick-actions.js"

describe("Quick action model", () => {
  it("exposes the approved anonymous quick-action groups without membership clutter", () => {
    const groups = resolveAnonymousQuickActionGroups()

    assert.deepEqual(groups.map((group) => group.id), ["available_now", "sign_in_to_save"])
    assert.deepEqual(groups[0].actions.map((action) => action.id), [
      "start_chimer",
      "start_flashcards",
      "play_anatomime",
      "wellness_quick_log",
      "body_sensation_check_in",
      "start_breathing",
      "start_public_music",
    ])
    assert.deepEqual(groups[1].actions.map((action) => action.id), [
      "create_calendar_item",
      "save_wellness_history",
      "customize_home_shortcuts",
      "customize_quick_actions",
    ])
    assert.equal(groups.some((group) => /membership/i.test(group.label)), false)
  })

  it("keeps every quick action route-backed and icon-backed", () => {
    assert.equal(quickActionCatalog.every((action) => action.id && action.label && action.href && action.icon), true)
  })

  it("resolves role-aware signed-in defaults from onboarding values", () => {
    assert.deepEqual(resolveQuickActionKeys({
      signedIn: true,
      onboarding: { primaryRole: "student", useCases: ["learn_anatomy", "track_progress"] },
    }).slice(0, 5), [
      "start_flashcards",
      "play_anatomime",
      "start_chimer",
      "start_public_music",
      "customize_quick_actions",
    ])

    assert.deepEqual(resolveQuickActionKeys({
      signedIn: true,
      onboarding: { primaryRole: "client", useCases: ["book_care"] },
    }).slice(0, 5), [
      "wellness_quick_log",
      "body_sensation_check_in",
      "start_public_music",
      "create_calendar_item",
      "customize_quick_actions",
    ])
  })

  it("preserves explicit quick-action picks separately from computed defaults", () => {
    const onboarding = {
      primaryRole: "therapist",
      quickActions: ["start_public_music", "start_chimer", "unknown", "start_public_music"],
    }

    assert.deepEqual(resolveExplicitQuickActionKeys(onboarding), ["start_public_music", "start_chimer"])
    assert.deepEqual(resolveQuickActionKeys({ signedIn: true, onboarding }), ["start_public_music", "start_chimer"])
  })

  it("caps the visible quick-action defaults", () => {
    assert.equal(resolveQuickActionKeys({
      signedIn: true,
      onboarding: { primaryRole: "therapist", useCases: ["manage_practice", "run_sessions"] },
    }).length <= QUICK_ACTION_MAX_VISIBLE, true)
  })
})
