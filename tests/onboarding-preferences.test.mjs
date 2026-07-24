import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  ONBOARDING_VERSION,
  buildOnboardingPreference,
  normalizeSupporterRoadmapInterests,
  resolveExplicitOnboardingHomeToolKeys,
  resolveExplicitOnboardingQuickActionKeys,
  resolveOnboardingHomeToolKeys,
  resolveOnboardingQuickActionKeys,
  getOnboardingRecommendedPath,
} from "../lib/onboarding-preferences.js"

describe("Onboarding preference helpers", () => {
  it("keeps only approved supporter roadmap interests", () => {
    assert.deepEqual(normalizeSupporterRoadmapInterests([
      "personal_wellness",
      "backgrounds_and_sound",
      "personal_wellness",
      "unknown_interest",
      "clientName",
      42,
      { interest: "therapist_tools" },
      "therapist_tools",
      "practice_management",
      "anatomy_and_education",
      "professional_documentation",
    ]), [
      "personal_wellness",
      "backgrounds_and_sound",
      "therapist_tools",
      "practice_management",
      "anatomy_and_education",
      "professional_documentation",
    ])
  })

  it("builds a constrained therapist onboarding payload", () => {
    const payload = buildOnboardingPreference({
      primaryRole: "therapist",
      useCases: ["manage_practice", "run_sessions", "clientName"],
      jurisdiction: "ohio",
    })

    assert.equal(payload.version, ONBOARDING_VERSION)
    assert.equal(payload.primaryRole, "therapist")
    assert.deepEqual(payload.useCases, ["manage_practice", "run_sessions"])
    assert.equal(payload.jurisdiction, "OH")
    assert.equal(payload.recommendedPath, "/account?tab=credentials")
    assert.equal("notes" in payload, false)
  })

  it("falls back to public wellness for unknown roles", () => {
    const payload = buildOnboardingPreference({
      primaryRole: "unexpected",
      useCases: ["learn_anatomy"],
      jurisdiction: "CA",
    })

    assert.equal(payload.primaryRole, "public_wellness")
    assert.equal(payload.jurisdiction, "")
    assert.equal(payload.recommendedPath, "/education")
  })

  it("returns a stable recommended path for known and unknown roles", () => {
    assert.equal(getOnboardingRecommendedPath("student"), "/education/flashcards")
    assert.equal(getOnboardingRecommendedPath("unknown"), "/account")
  })

  it("keeps explicit home shortcut selections when valid", () => {
    const payload = buildOnboardingPreference({
      primaryRole: "student",
      useCases: ["learn_anatomy", "track_progress"],
      jurisdiction: "TX",
      homeShortcuts: ["calendar_booking", "chimer", "anatomime", "education_flashcards", "calendar_booking"],
    })

    assert.deepEqual(payload.homeShortcuts, ["calendar_booking", "chimer", "anatomime", "education_flashcards"])
  })

  it("falls back to role/use-case defaults when home shortcut selection is empty", () => {
    const payload = buildOnboardingPreference({
      primaryRole: "therapist",
      useCases: ["manage_practice", "book_care"],
      jurisdiction: "OH",
      homeShortcuts: [],
    })

    assert.equal(payload.homeShortcuts.length, 6)
    assert.equal(payload.homeShortcuts[0], "business_income_planner")
    assert.equal(payload.homeShortcuts[1], "calendar_booking")
    assert.equal(payload.homeShortcuts[2], "account_memberships")
  })

  it("prepopulates role-aware quick actions without treating computed defaults as explicit picks", () => {
    const therapistPayload = buildOnboardingPreference({
      primaryRole: "therapist",
      useCases: ["manage_practice", "run_sessions"],
      jurisdiction: "OH",
    })

    assert.deepEqual(therapistPayload.quickActions.slice(0, 4), [
      "create_calendar_item",
      "start_chimer",
      "start_public_music",
      "customize_quick_actions",
    ])
    assert.deepEqual(resolveExplicitOnboardingQuickActionKeys(therapistPayload), therapistPayload.quickActions)
    assert.deepEqual(resolveExplicitOnboardingQuickActionKeys({ primaryRole: "therapist" }), [])
    assert.deepEqual(resolveOnboardingQuickActionKeys({
      primaryRole: "student",
      useCases: ["learn_anatomy"],
      quickActions: [],
    }).slice(0, 3), ["start_flashcards", "play_anatomime", "start_chimer"])
  })

  it("promotes the business income planner for practice planning", () => {
    const therapistPayload = buildOnboardingPreference({
      primaryRole: "therapist",
      useCases: ["manage_practice"],
      jurisdiction: "OH",
    })
    const studentTools = resolveOnboardingHomeToolKeys({
      primaryRole: "student",
      useCases: ["manage_practice", "run_sessions"],
    })

    assert.equal(therapistPayload.homeShortcuts[0], "business_income_planner")
    assert.equal(studentTools[0], "business_income_planner")
    assert.ok(studentTools.includes("chimer"))
  })

  it("resolves personalized tool order for persisted onboarding payloads", () => {
    const payload = resolveOnboardingHomeToolKeys({
      primaryRole: "student",
      useCases: ["learn_anatomy", "track_progress", "manage_practice"],
      homeShortcuts: ["roadmap_support", "education_flashcards", "anatomime", "chimer", "roadmap_support"],
    })

    assert.deepEqual(payload, ["roadmap_support", "education_flashcards", "anatomime", "chimer"])
  })

  it("falls back to saved role/use-case values when only unknown home shortcuts are persisted", () => {
    const payload = resolveOnboardingHomeToolKeys({
      primaryRole: "client",
      useCases: ["book_care"],
      homeShortcuts: ["unknown_tool_key"],
    })

    assert.equal(payload[0], "calendar_booking")
    assert.equal(payload[1], "local_notes")
    assert.equal(payload[2], "chimer")
  })

  it("returns only persisted shortcut keys when explicit shortcuts are available", () => {
    const payload = {
      primaryRole: "student",
      useCases: ["run_sessions", "learn_anatomy", "track_progress"],
      homeShortcuts: ["calendar_booking", "chimer", "education_flashcards", "calendar_booking"],
    }
    const persisted = resolveExplicitOnboardingHomeToolKeys(payload)

    assert.deepEqual(persisted, ["calendar_booking", "chimer", "education_flashcards"])
  })
})
