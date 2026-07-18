import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  QUICK_ACTION_MAX_VISIBLE,
  quickActionCatalog,
  resolveAnonymousQuickActionGroups,
  resolveExplicitQuickActionKeys,
  resolveQuickActionGroups,
  resolveQuickActionKeys,
} from "../lib/quick-actions.js"

describe("Quick action model", () => {
  it("exposes only the approved anonymous quick actions", () => {
    const groups = resolveAnonymousQuickActionGroups()

    assert.deepEqual(groups.map((group) => group.id), ["quick_actions"])
    assert.deepEqual(groups[0].actions.map(({ id, label, href }) => ({ id, label, href })), [
      { id: "login", label: "Log In", href: "/login" },
      { id: "create_account", label: "Create Account", href: "/register" },
      { id: "wellness_quick_log", label: "Quick Log", href: "/wellness#quick-log" },
      { id: "start_breathing", label: "Breathing Guide", href: "/wellness/breathing" },
    ])
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

  it("falls back safely when onboarding role names collide with inherited object properties", () => {
    assert.deepEqual(resolveQuickActionKeys({
      onboarding: { primaryRole: "__proto__", useCases: [] },
    }).slice(0, 3), [
      "start_public_music",
      "wellness_quick_log",
      "body_sensation_check_in",
    ])
  })

  it("uses signed-in quick-action groups and signed-in destinations", () => {
    const groups = resolveQuickActionGroups({
      signedIn: true,
      onboarding: { quickActions: ["create_calendar_item", "customize_quick_actions"] },
    })

    assert.deepEqual(groups.map((group) => group.id), ["quick_actions"])
    assert.deepEqual(groups[0].actions.map((action) => [action.id, action.href]), [
      ["create_calendar_item", "/calendar/new"],
      ["customize_quick_actions", "/account?tab=app-settings"],
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

  it("never mixes authentication actions into signed-in defaults", () => {
    const ids = resolveQuickActionKeys({
      signedIn: true,
      onboarding: { primaryRole: "therapist", useCases: ["manage_practice", "run_sessions"] },
    })

    assert.equal(ids.includes("login"), false)
    assert.equal(ids.includes("create_account"), false)
    assert.equal(ids.length <= QUICK_ACTION_MAX_VISIBLE, true)
  })
})
