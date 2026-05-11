export const SUPPORT_CONTACT_EMAIL = "contactmassagelab@gmail.com"

function cleanField(value) {
  return typeof value === "string" ? value.trim() : ""
}

export function buildSupportMailtoUrl(input = {}) {
  const name = cleanField(input.name)
  const contact = cleanField(input.contact)
  const topic = cleanField(input.topic)
  const message = cleanField(input.message)
  const subject = topic ? `MassageLab support: ${topic}` : "MassageLab support request"
  const body = [
    `Name: ${name}`,
    `Contact: ${contact}`,
    "",
    `Topic: ${topic}`,
    "",
    `Message:\n${message}`,
  ].join("\n")

  return `mailto:${SUPPORT_CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
