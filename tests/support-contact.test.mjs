import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildSupportMailtoUrl,
  normalizeSupportOrderReference,
  PURCHASE_SUPPORT_TOPIC,
  SUPPORT_CONTACT_EMAIL,
} from "../lib/support-contact.js"
import { readFile } from "node:fs/promises"

describe("Support contact mailto helper", () => {
  it("resynchronizes the route-derived topic during soft navigation", async () => {
    const source = await readFile(new URL("../app/support/support-contact-form.tsx", import.meta.url), "utf8")
    assert.match(source, /React\.useEffect\(\(\) => \{[\s\S]*setTopic\(initialTopic\)[\s\S]*\}, \[initialTopic\]\)/)
  })

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

  it("adds a diagnostic report id when provided", () => {
    const url = buildSupportMailtoUrl({
      topic: "Problem report",
      diagnosticId: "1234567890abcdef1234567890abcdef",
      message: "Diagnostic follow-up.",
    })

    assert.equal(url.includes("Diagnostic%20report%20ID%3A%201234567890abcdef1234567890abcdef"), true)
    assert.equal(url.includes("Message%3A%0ADiagnostic%20follow-up."), true)
  })

  it("adds only a sanitized internal purchase reference", () => {
    const url = buildSupportMailtoUrl({
      topic: PURCHASE_SUPPORT_TOPIC,
      orderReference: "order_safe-123",
      paymentIntentId: "pi_must_not_leak",
      message: "Background access needs review.",
    })

    assert.equal(url.includes("Purchase%20or%20background%20access"), true)
    assert.equal(url.includes("Order%20reference%3A%20order_safe-123"), true)
    assert.equal(url.includes("pi_must_not_leak"), false)
    assert.equal(normalizeSupportOrderReference("https://unsafe.example"), "")
    assert.equal(normalizeSupportOrderReference("order_safe-123"), "order_safe-123")
  })
})
