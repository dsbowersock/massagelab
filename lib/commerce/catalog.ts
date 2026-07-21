import { backgroundRegistry } from "../../components/backgrounds/backgroundRegistry.ts"
import { COMMERCE_PRODUCT_BACKGROUND, COMMERCE_CURRENCY, BACKGROUND_UNIT_AMOUNT, COMMERCE_MAX_CART_ITEM_QUANTITY } from "./constants.js"
import { COMMERCE_ERROR_CODES, CommerceError } from "./errors.ts"

type CommerceProductType = typeof COMMERCE_PRODUCT_BACKGROUND

type CommerceReturnPath = string

export type CommerceProduct = {
  productType: CommerceProductType
  productKey: string
  displayName: string
  unitAmount: number
  currency: typeof COMMERCE_CURRENCY
  availableForPurchase: boolean
}

type CommerceTaxMode = "disabled" | "stripe"
type CommerceTaxReadiness = {
  mode: CommerceTaxMode
  ready: boolean
  taxCode: string | null
}

const TAX_MODE_ENV = "BACKGROUND_COMMERCE_TAX_MODE"
const TAX_CODE_ENV = "BACKGROUND_COMMERCE_TAX_PRODUCT_CODE"

const SAFE_RETURN_PATH_MAX_LEN = 64

function normalizePathInput(value: unknown): string {
  if (typeof value !== "string") return "/"

  const trimmed = value.trim()
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)) {
    return "/"
  }

  return trimmed
    .replace(/^\s+|\s+$/g, "")
}

export function getCommerceTaxReadiness(env: NodeJS.ProcessEnv = process.env): CommerceTaxReadiness {
  const taxMode = String(env[TAX_MODE_ENV] ?? "").toLowerCase()
  const mode: CommerceTaxMode = taxMode === "stripe" ? "stripe" : "disabled"
  const taxCode = String(env[TAX_CODE_ENV] ?? "").trim() || null
  const ready = mode === "disabled" ? true : Boolean(taxCode && taxCode.length > 0)

  return {
    mode,
    ready,
    taxCode: taxMode === "stripe" ? taxCode : null,
  }
}

export function resolveCommerceProduct(productType: string, productKey: string): CommerceProduct {
  if (productType !== COMMERCE_PRODUCT_BACKGROUND) {
    throw new CommerceError({
      code: COMMERCE_ERROR_CODES.CATALOG_UNAVAILABLE,
      message: "The selected product is not available in commerce.",
      status: 404,
    })
  }

  const trimmedKey = typeof productKey === "string" ? productKey.trim() : ""
  const entry = backgroundRegistry.find((candidate) => candidate.id === trimmedKey)

  if (!entry?.requiresSubscription || !entry.enabled) {
    throw new CommerceError({
      code: COMMERCE_ERROR_CODES.CATALOG_UNAVAILABLE,
      message: "This background is not available for purchase.",
      status: 404,
    })
  }

  return {
    productType: COMMERCE_PRODUCT_BACKGROUND,
    productKey: entry.id,
    displayName: entry.label,
    unitAmount: BACKGROUND_UNIT_AMOUNT,
    currency: COMMERCE_CURRENCY,
    availableForPurchase: entry.enabled && entry.requiresSubscription,
  }
}

export function assertCommerceCartQuantity(quantity: unknown): void {
  const parsedQuantity = Number(quantity)

  if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1 || parsedQuantity > COMMERCE_MAX_CART_ITEM_QUANTITY) {
    throw new CommerceError({
      code: COMMERCE_ERROR_CODES.CATALOG_UNAVAILABLE,
      message: "Invalid cart quantity.",
      status: 400,
    })
  }
}

export function normalizeCommerceReturnPath(value: unknown): CommerceReturnPath {
  const cleaned = normalizePathInput(value)
  const noQuery = cleaned.split("?")[0].split("#")[0]
  const path = noQuery
    .split("/")
    .filter((segment) => segment.length > 0 && segment !== ".." && segment !== ".")
    .join("/")

  if (!noQuery || !noQuery.startsWith("/")) {
    if (!noQuery) {
      return "/"
    }

    return path.length > 0 ? `/${path}` : "/"
  }

  const normalized = `/${path}`.replace(/\/\/+/g, "/")
  if (noQuery === "/" || normalized === "//") {
    return "/"
  }

  return normalized.replace(/\/{2,}/g, "/").slice(0, SAFE_RETURN_PATH_MAX_LEN) || "/"
}
