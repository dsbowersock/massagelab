import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  filterAnonymousSentryIntegrations,
  getAnonymousSentryDataCollection,
} from "../lib/sentry-options.js"

describe("anonymous Sentry options", () => {
  it("explicitly disables every SDK data-collection category that can carry user input", () => {
    assert.deepEqual(getAnonymousSentryDataCollection(), {
      userInfo: false,
      cookies: false,
      httpHeaders: { request: false, response: false },
      httpBodies: [],
      queryParams: false,
      genAI: { inputs: false, outputs: false },
      stackFrameVariables: false,
      frameContextLines: 3,
    })
  })

  it("removes session, replay, and console-capture integrations", () => {
    const integrations = [
      { name: "BrowserSession" },
      { name: "Replay" },
      { name: "ReplayCanvas" },
      { name: "CaptureConsole" },
      { name: "GlobalHandlers" },
    ]

    assert.deepEqual(
      filterAnonymousSentryIntegrations(integrations).map(({ name }) => name),
      ["GlobalHandlers"],
    )
  })
})
