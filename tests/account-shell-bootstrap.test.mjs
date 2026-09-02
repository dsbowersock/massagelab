import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { projectAccountShellAppSettings } from "../lib/account-shell-bootstrap.js"

describe("account shell bootstrap", () => {
  it("projects only app-layout and Music visualizer fields", () => {
    const projected = projectAccountShellAppSettings({
      appBarPosition: "top",
      sidebarPosition: "right",
      themeMode: "system",
      musicVisualizer: {
        defaultBackgroundId: "aurora",
        showClock: true,
        token: "must-not-cross",
      },
      onboarding: { primaryRole: "therapist" },
      supporterRoadmapInterests: ["voice"],
      planner: { revenueGoal: "must-not-cross" },
      soapDraft: "must-not-cross",
      unknown: "must-not-cross",
    })

    assert.deepEqual(projected.app, {
      appBarPosition: "top",
      sidebarPosition: "right",
      sidebarTriggerPosition: "top",
      ambientMotionMode: "system",
      themeMode: "system",
      hapticFeedbackEnabled: true,
    })
    assert.deepEqual(projected.musicVisualizer, {
      defaultBackgroundId: "aurora",
      showClock: true,
    })
    assert.doesNotMatch(
      JSON.stringify(projected),
      /soap|onboarding|supporter|planner|unknown|token/i,
    )
  })

  it("normalizes malformed input to safe shell defaults", () => {
    const projected = projectAccountShellAppSettings(["not", "an", "object"])

    assert.deepEqual(projected, {
      app: {
        appBarPosition: "bottom",
        sidebarPosition: "left",
        sidebarTriggerPosition: "bottom",
        ambientMotionMode: "system",
        themeMode: "dark",
        hapticFeedbackEnabled: true,
      },
      musicVisualizer: {
        defaultBackgroundId: null,
        showClock: false,
      },
    })
  })
})
