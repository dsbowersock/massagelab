import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  DONATION_OPTIONS,
  DONATION_PURPOSE,
  findDonationOption,
  normalizeDonationAmountCents,
} from "../lib/donations.js"

describe("one-time support options", () => {
  it("offers fixed one-time support amounts", () => {
    assert.deepEqual(
      DONATION_OPTIONS.map((option) => option.amountCents),
      [500, 1500, 3000, 7500],
    )
    assert.equal(DONATION_PURPOSE, "massagelab_project_support")
    assert.equal(DONATION_OPTIONS.every((option) => /support/i.test(option.description)), true)
    assert.equal(DONATION_OPTIONS.some((option) => /donation|donate/i.test(option.description)), false)
  })

  it("rejects arbitrary client-provided amounts", () => {
    assert.equal(normalizeDonationAmountCents("1500"), 1500)
    assert.equal(findDonationOption(3000)?.label, "$30")
    assert.equal(normalizeDonationAmountCents("1499"), null)
    assert.equal(normalizeDonationAmountCents("999999"), null)
    assert.equal(findDonationOption("free"), null)
  })
})
