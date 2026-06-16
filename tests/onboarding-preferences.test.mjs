import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  ONBOARDING_VERSION,
  buildOnboardingPreference,
  getOnboardingRecommendedPath,
} from "../lib/onboarding-preferences.js"

describe("Onboarding preference helpers", () => {
  it("builds a constrained therapist onboarding payload", () => {
    const payload = buildOnboardingPreference({
      primaryRole: "therapist",
      useCases: ["manage_practice", "run_sessions", "clientName"],
      jurisdiction: "ohio",
      notes: "Prefers credentials and calendar first.",
    })

    assert.equal(payload.version, ONBOARDING_VERSION)
    assert.equal(payload.primaryRole, "therapist")
    assert.deepEqual(payload.useCases, ["manage_practice", "run_sessions"])
    assert.equal(payload.jurisdiction, "OH")
    assert.equal(payload.recommendedPath, "/account?tab=credentials")
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
})
