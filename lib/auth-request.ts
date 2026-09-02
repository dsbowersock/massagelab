const UNKNOWN_NETWORK_IDENTIFIER = "unknown"

/**
 * Returns one stable network bucket from the Vercel-owned address header.
 * Production fails closed when that header is absent; local and test servers
 * retain conventional proxy fallbacks because no Vercel edge owns the request.
 */
export function authRequestNetworkIdentifier(request: Pick<Request, "headers">): string {
  const vercelAddress = firstForwardedAddress(request.headers.get("x-vercel-forwarded-for"))
  if (process.env.VERCEL === "1") {
    return vercelAddress || UNKNOWN_NETWORK_IDENTIFIER
  }
  if (process.env.NODE_ENV === "production") return UNKNOWN_NETWORK_IDENTIFIER
  return firstForwardedAddress(request.headers.get("x-forwarded-for"))
    || firstForwardedAddress(request.headers.get("x-real-ip"))
    || UNKNOWN_NETWORK_IDENTIFIER
}

/** Accepts only already-normalized public account emails within the RFC mailbox bound. */
export function isPublicAccountEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function firstForwardedAddress(value: string | null): string {
  return value?.split(",", 1)[0]?.trim() || ""
}
