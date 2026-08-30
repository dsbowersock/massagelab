const UNKNOWN_NETWORK_IDENTIFIER = "unknown"

/**
 * Returns one stable network bucket from Vercel-owned request headers.
 * Vercel overwrites these headers at its edge; deployments behind another
 * proxy must preserve that trust boundary rather than forwarding client input.
 */
export function authRequestNetworkIdentifier(request: Pick<Request, "headers">): string {
  return firstForwardedAddress(request.headers.get("x-vercel-forwarded-for"))
    || firstForwardedAddress(request.headers.get("x-forwarded-for"))
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
