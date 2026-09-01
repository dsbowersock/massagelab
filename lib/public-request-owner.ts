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

export type PublicRequestSelectionComponent = Readonly<{
  label: string
  value: string
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
export function publicRequestOwner(input: {
  namespace: PublicRequestNamespace
  requestId: string
  selectionComponents: readonly PublicRequestSelectionComponent[]
}): PublicRequestOwner {
  if (!input || !PUBLIC_REQUEST_NAMESPACES.has(input.namespace)) {
    throw new Error("Provide a supported public request namespace.")
  }
  const requestId = normalizePublicRequestId(input.requestId)
  if (!requestId) {
    throw new Error("Provide a canonical public request ID.")
  }
  if (!Array.isArray(input.selectionComponents)
    || input.selectionComponents.length === 0
    || input.selectionComponents.length > MAX_SELECTION_COMPONENTS) {
    throw new Error("Provide bounded public request selection components.")
  }

  const hash = createHash("sha256")
  updateFramedText(hash, PUBLIC_REQUEST_DIGEST_DOMAIN)
  updateFramedText(hash, input.namespace)
  for (const component of input.selectionComponents) {
    if (!component || typeof component.label !== "string" || !component.label) {
      throw new Error("Provide a labeled public request selection component.")
    }
    if (typeof component.value !== "string") {
      throw new Error("Provide a text public request selection value.")
    }
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

function updateFramedText(hash: ReturnType<typeof createHash>, value: string): void {
  const bytes = Buffer.from(value, "utf8")
  if (bytes.length > MAX_SELECTION_COMPONENT_BYTES) {
    throw new Error("Public request selection components must be bounded.")
  }
  const length = Buffer.allocUnsafe(4)
  length.writeUInt32BE(bytes.length)
  hash.update(length).update(bytes)
}
