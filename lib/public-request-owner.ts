import "server-only"

import { createHash } from "node:crypto"
import { normalizePublicRequestId, type PublicRequestNamespace } from "./public-request-id.ts"

const PUBLIC_REQUEST_DIGEST_DOMAIN = "massagelab:public-request-owner:v1"
const PUBLIC_REQUEST_NAMESPACES = new Set<PublicRequestNamespace>([
  "public-booking-v1",
  "public-waitlist-v1",
])
const MAX_SELECTION_COMPONENTS = 64
const MAX_SELECTION_COMPONENT_BYTES = 2_048
const PROHIBITED_SELECTION_LABELS = new Set([
  "email",
  "guestEmail",
  "contactEmail",
  "accountId",
  "userId",
  "practiceClientId",
  "name",
  "guestName",
  "phone",
  "guestPhone",
  "notes",
  "note",
  "freeText",
])

export type PublicBookingSelectionLabel =
  | "serviceVariantId"
  | "addOnVariantId"
  | "pressure"
  | "requestedStart"
  | "preferredProviderId"

export type PublicWaitlistSelectionLabel =
  | "serviceVariantId"
  | "addOnVariantId"
  | "pressure"
  | "preferredStart"
  | "preferredProviderId"

export type PublicRequestSelectionLabel =
  | PublicBookingSelectionLabel
  | PublicWaitlistSelectionLabel

export type PublicBookingSelectionComponent = Readonly<{
  label: PublicBookingSelectionLabel
  value: string
}>

export type PublicWaitlistSelectionComponent = Readonly<{
  label: PublicWaitlistSelectionLabel
  value: string
}>

export type PublicRequestSelectionComponent =
  | PublicBookingSelectionComponent
  | PublicWaitlistSelectionComponent

type PublicRequestSelection =
  | Readonly<{
      namespace: "public-booking-v1"
      selectionComponents: readonly PublicBookingSelectionComponent[]
    }>
  | Readonly<{
      namespace: "public-waitlist-v1"
      selectionComponents: readonly PublicWaitlistSelectionComponent[]
    }>

export type PublicRequestOwner = Readonly<{
  prefix: string
  selectionDigest: string
  id: string
}>

/**
 * Creates a non-identifying durable row owner from an operation UUID and an
 * explicitly allowlisted immutable selection. Every UTF-8 tuple member is
 * length-framed before hashing so adjacent label/value boundaries cannot
 * produce the same digest by concatenation.
 */
export function publicRequestOwner(input: PublicRequestSelection & {
  requestId: string
}): PublicRequestOwner {
  if (!input || !PUBLIC_REQUEST_NAMESPACES.has(input.namespace)) {
    throw new Error("Provide a supported public request namespace.")
  }
  const requestId = normalizePublicRequestId(input.requestId)
  if (!requestId) {
    throw new Error("Provide a canonical public request ID.")
  }
  if (!Array.isArray(input.selectionComponents)
    || input.selectionComponents.length < 4
    || input.selectionComponents.length > MAX_SELECTION_COMPONENTS) {
    throw new Error("Provide canonical public request selection components.")
  }
  assertCanonicalSelectionComponents(input.namespace, input.selectionComponents)

  const hash = createHash("sha256")
  updateFramedText(hash, PUBLIC_REQUEST_DIGEST_DOMAIN)
  updateFramedText(hash, input.namespace)
  for (const component of input.selectionComponents) {
    updateFramedText(hash, component.label)
    updateFramedText(hash, component.value)
  }

  const selectionDigest = hash.digest("hex")
  const prefix = `${input.namespace}:${requestId}:`
  return Object.freeze({
    prefix,
    selectionDigest,
    id: `${prefix}${selectionDigest}`,
  })
}

/**
 * Validates the complete namespace-bound tuple before SHA-256 construction.
 * Add-ons are the sole repeated segment and must already be sorted and unique;
 * all singleton, cross-namespace, PII, free-text, and extension labels fail closed.
 */
function assertCanonicalSelectionComponents(
  namespace: PublicRequestNamespace,
  components: readonly PublicRequestSelectionComponent[],
): void {
  for (const component of components) {
    if (!component
      || typeof component.label !== "string"
      || typeof component.value !== "string"
      || Buffer.byteLength(component.value, "utf8") > MAX_SELECTION_COMPONENT_BYTES) {
      throw new Error("Provide canonical public request selection components.")
    }
    if (PROHIBITED_SELECTION_LABELS.has(component.label)) {
      throw new Error("Provide canonical public request selection components without PII or free-text labels.")
    }
  }

  const startLabel = namespace === "public-booking-v1" ? "requestedStart" : "preferredStart"
  let index = 0
  if (components[index]?.label !== "serviceVariantId") {
    throw new Error("Provide canonical public request selection components.")
  }
  index += 1

  let previousAddOnVariantId: string | null = null
  while (components[index]?.label === "addOnVariantId") {
    const addOnVariantId = components[index].value
    if (previousAddOnVariantId !== null && addOnVariantId <= previousAddOnVariantId) {
      throw new Error("Provide canonical public request selection components.")
    }
    previousAddOnVariantId = addOnVariantId
    index += 1
  }

  if (components[index]?.label !== "pressure"
    || components[index + 1]?.label !== startLabel
    || components[index + 2]?.label !== "preferredProviderId"
    || index + 3 !== components.length) {
    throw new Error("Provide canonical public request selection components.")
  }
}

function updateFramedText(hash: ReturnType<typeof createHash>, value: string): void {
  const bytes = Buffer.from(value, "utf8")
  if (bytes.length > MAX_SELECTION_COMPONENT_BYTES) {
    throw new Error("Public request selection components must be bounded.")
  }
  const length = Buffer.allocUnsafe(4)
  length.writeUInt32BE(bytes.length)
  hash.update(length).update(bytes)
}
