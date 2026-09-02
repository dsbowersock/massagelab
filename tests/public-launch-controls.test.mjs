import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  getPublicLaunchControls,
  REGISTRATION_PAUSED_MESSAGE,
  SUPPORTER_CHECKOUT_PAUSED_MESSAGE,
} from "../lib/public-launch-controls.js"

describe("public launch controls", () => {
  it("defaults both public paths open and pauses them independently", () => {
    assert.deepEqual(getPublicLaunchControls({}), {
      registrationOpen: true,
      supporterCheckoutOpen: true,
    })
    assert.deepEqual(getPublicLaunchControls({ MASSAGELAB_PUBLIC_REGISTRATION_PAUSED: "true" }), {
      registrationOpen: false,
      supporterCheckoutOpen: true,
    })
    assert.deepEqual(getPublicLaunchControls({ MASSAGELAB_SUPPORTER_CHECKOUT_PAUSED: "true" }), {
      registrationOpen: true,
      supporterCheckoutOpen: false,
    })
    assert.deepEqual(getPublicLaunchControls({
      MASSAGELAB_PUBLIC_REGISTRATION_PAUSED: "true",
      MASSAGELAB_SUPPORTER_CHECKOUT_PAUSED: "true",
    }), {
      registrationOpen: false,
      supporterCheckoutOpen: false,
    })
  })

  it("intentionally fails open for non-exact operator values instead of trimming or case-normalizing them", () => {
    for (const [flagName, resultName] of [
      ["MASSAGELAB_PUBLIC_REGISTRATION_PAUSED", "registrationOpen"],
      ["MASSAGELAB_SUPPORTER_CHECKOUT_PAUSED", "supporterCheckoutOpen"],
    ]) {
      for (const value of ["TRUE", "True", " true "]) {
        assert.equal(getPublicLaunchControls({ [flagName]: value })[resultName], true)
      }
    }
  })

  it("uses neutral copy that preserves existing-account paths", () => {
    assert.match(REGISTRATION_PAUSED_MESSAGE, /temporarily paused/i)
    assert.match(REGISTRATION_PAUSED_MESSAGE, /sign in|existing account/i)
    assert.match(SUPPORTER_CHECKOUT_PAUSED_MESSAGE, /temporarily paused/i)
    assert.match(SUPPORTER_CHECKOUT_PAUSED_MESSAGE, /billing portal|existing membership/i)
  })
})
