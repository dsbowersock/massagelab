export const SUPPORT_CONTACT_EMAIL = "contactmassagelab@gmail.com"
export const PURCHASE_SUPPORT_TOPIC = "Purchase or background access"

/** Accepts server-shaped order references up to 80 safe identifier characters, or returns an empty string. */
export function normalizeSupportOrderReference(value) {
  const reference = cleanField(value)
  return /^[A-Za-z0-9_-]{1,80}$/.test(reference) ? reference : ""
}

function cleanField(value) {
  return typeof value === "string" ? value.trim() : ""
}

export function buildSupportMailtoUrl(input = {}) {
  const name = cleanField(input.name)
  const contact = cleanField(input.contact)
  const topic = cleanField(input.topic)
  const message = cleanField(input.message)
  const diagnosticId = cleanField(input.diagnosticId)
  const orderReference = normalizeSupportOrderReference(input.orderReference)
  const subject = topic ? `MassageLab support: ${topic}` : "MassageLab support request"
  const body = [
    `Name: ${name}`,
    `Contact: ${contact}`,
    "",
    `Topic: ${topic}`,
    "",
    ...(diagnosticId ? [`Diagnostic report ID: ${diagnosticId}`, ""] : []),
    ...(orderReference ? [`Order reference: ${orderReference}`, ""] : []),
    `Message:\n${message}`,
  ].join("\n")

  return `mailto:${SUPPORT_CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
