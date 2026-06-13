import crypto from "node:crypto"

const ABLY_REST_BASE_URL = "https://rest.ably.io"
const ABLY_TOKEN_TTL_MS = 60 * 60 * 1000

function ablyKeyParts() {
  const apiKey = process.env.ABLY_API_KEY?.trim()
  if (!apiKey || !apiKey.includes(":")) return null
  const [keyName, keySecret] = apiKey.split(":")
  if (!keyName || !keySecret) return null

  return { apiKey, keyName, keySecret }
}

export function isAnatomimeRealtimeConfigured() {
  return Boolean(ablyKeyParts())
}

export function anatomimeRealtimeChannel(code: string) {
  return `anatomime:${code.trim().toUpperCase()}`
}

/**
 * Publishes a compact change event. Database state remains authoritative; the
 * event only tells connected clients to refresh the current session summary.
 */
export async function publishAnatomimeRealtimeEvent(code: string, eventName: string, data: Record<string, unknown> = {}) {
  const key = ablyKeyParts()
  if (!key) return { sent: false, reason: "not-configured" as const }

  const channel = anatomimeRealtimeChannel(code)
  const response = await fetch(`${ABLY_REST_BASE_URL}/channels/${encodeURIComponent(channel)}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(key.apiKey).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: eventName,
      data,
    }),
  })

  if (!response.ok) {
    return { sent: false, reason: "publish-failed" as const, status: response.status }
  }

  return { sent: true as const }
}

/**
 * Builds an Ably TokenRequest without the Ably SDK so the app can keep realtime
 * credentials server-only and avoid adding client package weight to local play.
 */
export function createAnatomimeRealtimeTokenRequest(code: string, clientId: string) {
  const key = ablyKeyParts()
  if (!key) return null

  const channel = anatomimeRealtimeChannel(code)
  const ttl = ABLY_TOKEN_TTL_MS
  const capability = JSON.stringify({
    [channel]: ["subscribe", "presence"],
  })
  const timestamp = Date.now()
  const nonce = crypto.randomBytes(16).toString("hex")
  const signText = [key.keyName, ttl, capability, clientId, timestamp, nonce].join("\n")
  const mac = crypto.createHmac("sha256", key.keySecret).update(signText).digest("base64")

  return {
    keyName: key.keyName,
    ttl,
    capability,
    clientId,
    timestamp,
    nonce,
    mac,
  }
}
