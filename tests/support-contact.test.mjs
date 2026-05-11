import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildSupportMailtoUrl, SUPPORT_CONTACT_EMAIL } from "../lib/support-contact.js"

describe("Support contact mailto helper", () => {
  it("builds a mailto URL for MassageLab support requests", () => {
    const url = buildSupportMailtoUrl({
      name: "Dana Client",
      contact: "dana@example.com",
      topic: "Calendar help",
      message: "I need help with availability.",
    })

    assert.equal(url.startsWith(`mailto:${SUPPORT_CONTACT_EMAIL}?`), true)
    assert.equal(url.includes("subject=MassageLab%20support%3A%20Calendar%20help"), true)
    assert.equal(url.includes("Name%3A%20Dana%20Client"), true)
    assert.equal(url.includes("Contact%3A%20dana%40example.com"), true)
    assert.equal(url.includes("Message%3A%0AI%20need%20help%20with%20availability."), true)
  })

  it("uses a general subject and trims blank fields", () => {
    const url = buildSupportMailtoUrl({
      name: "  ",
      contact: " user@example.com ",
      topic: "",
      message: "  Hello  ",
    })

    assert.equal(url.includes("subject=MassageLab%20support%20request"), true)
    assert.equal(url.includes("Name%3A%20%0A"), true)
    assert.equal(url.includes("Contact%3A%20user%40example.com"), true)
    assert.equal(url.includes("Message%3A%0AHello"), true)
  })
})
