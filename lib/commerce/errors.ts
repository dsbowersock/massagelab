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

export interface CommerceErrorOptions {
  code: CommerceErrorCode
  message: string
  status?: number
  cause?: unknown
}

export class CommerceError extends Error {
  readonly status: number
  readonly code: CommerceErrorCode
  readonly cause: unknown

  constructor({ code, message, status = 400, cause }: CommerceErrorOptions) {
    super(message)
    this.name = "CommerceError"
    this.code = code
    this.status = status
    this.cause = cause
  }
}

export function asPublicCommerceError(error: unknown): CommerceError {
  if (error instanceof CommerceError) {
    return error
  }

  return new CommerceError({
    code: COMMERCE_ERROR_CODES.UNKNOWN,
    message: "Unexpected commerce processing error.",
    status: 500,
    cause: error,
  })
}
