export const COMMERCE_ERROR_CODES = {
  AUTHENTICATION_REQUIRED: "AUTH_REQUIRED",
  EMAIL_VERIFICATION_REQUIRED: "EMAIL_VERIFICATION_REQUIRED",
  CATALOG_UNAVAILABLE: "CATALOG_UNAVAILABLE",
  ALREADY_OWNED: "ALREADY_OWNED",
  NO_CREDITS_REMAINING: "NO_CREDITS_REMAINING",
  RESERVED_CART: "ITEM_RESERVED",
  EMPTY_CART: "EMPTY_CART",
  LEGAL_CONSENT_REQUIRED: "LEGAL_CONSENT_REQUIRED",
  COUNTRY_UNAVAILABLE: "COUNTRY_UNAVAILABLE",
  TAX_NOT_READY: "TAX_NOT_READY",
  STALE_CONCURRENCY: "STALE_CONCURRENCY",
  PAYMENT_PENDING: "PAYMENT_PENDING",
  UNKNOWN: "UNKNOWN",
} as const

export type CommerceErrorCode = (typeof COMMERCE_ERROR_CODES)[keyof typeof COMMERCE_ERROR_CODES]

const COMMERCE_PUBLIC_ERROR_DETAILS: Record<CommerceErrorCode, { message: string; status: number }> = {
  [COMMERCE_ERROR_CODES.AUTHENTICATION_REQUIRED]: { message: "Sign in to continue.", status: 401 },
  [COMMERCE_ERROR_CODES.EMAIL_VERIFICATION_REQUIRED]: { message: "Verify your email to continue.", status: 403 },
  [COMMERCE_ERROR_CODES.CATALOG_UNAVAILABLE]: { message: "This item is not available for purchase.", status: 404 },
  [COMMERCE_ERROR_CODES.ALREADY_OWNED]: { message: "You already own this item.", status: 409 },
  [COMMERCE_ERROR_CODES.NO_CREDITS_REMAINING]: { message: "No purchase credits remain.", status: 409 },
  [COMMERCE_ERROR_CODES.RESERVED_CART]: { message: "This item is temporarily reserved.", status: 409 },
  [COMMERCE_ERROR_CODES.EMPTY_CART]: { message: "Your cart is empty.", status: 400 },
  [COMMERCE_ERROR_CODES.LEGAL_CONSENT_REQUIRED]: { message: "Accept the required terms to continue.", status: 400 },
  [COMMERCE_ERROR_CODES.COUNTRY_UNAVAILABLE]: { message: "Purchases are not available in your country.", status: 403 },
  [COMMERCE_ERROR_CODES.TAX_NOT_READY]: { message: "Purchases are temporarily unavailable.", status: 503 },
  [COMMERCE_ERROR_CODES.STALE_CONCURRENCY]: { message: "Your cart changed. Please try again.", status: 409 },
  [COMMERCE_ERROR_CODES.PAYMENT_PENDING]: { message: "Your payment is still processing.", status: 409 },
  [COMMERCE_ERROR_CODES.UNKNOWN]: { message: "Unexpected commerce processing error.", status: 500 },
}

export interface CommerceErrorOptions {
  code: CommerceErrorCode
  /** Ignored so caller-provided database or Stripe details cannot become public. */
  message?: string
  status?: number
  cause?: unknown
}

export class CommerceError extends Error {
  readonly status: number
  readonly code: CommerceErrorCode

  constructor({ code }: CommerceErrorOptions) {
    const details = COMMERCE_PUBLIC_ERROR_DETAILS[code]
    super(details.message)
    this.name = "CommerceError"
    this.code = code
    this.status = details.status
  }
}

export function asPublicCommerceError(error: unknown): CommerceError {
  if (error instanceof CommerceError) {
    return new CommerceError({ code: error.code })
  }

  return new CommerceError({
    code: COMMERCE_ERROR_CODES.UNKNOWN,
  })
}
