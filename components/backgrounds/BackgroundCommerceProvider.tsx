"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react"
import {
  EMPTY_BACKGROUND_COMMERCE_STATE,
  backgroundCommerceReducer,
  normalizeBackgroundCommerceSnapshot,
} from "@/lib/background-commerce-client.js"

type PublicCommerceError = {
  code: string
  message: string
}

export type BackgroundCommerceClientState = {
  status: "idle" | "loading" | "ready" | "mutating" | "redirecting" | "error"
  snapshot: ReturnType<typeof normalizeBackgroundCommerceSnapshot> | null
  pendingAction: { type: string; requestId: string; action?: string } | null
  error: PublicCommerceError | null
}

export type PurchaseConsentInput = {
  acceptedLegalDocuments: string[]
  combinedConsentAccepted: boolean
  purchaseCountry: "US"
  returnPath?: "clock" | "chimer" | "music-visualizer"
}

export type BackgroundCommerceContextValue = {
  state: BackgroundCommerceClientState
  refresh(): Promise<void>
  addToCart(backgroundId: string): Promise<void>
  removeFromCart(backgroundId: string): Promise<void>
  redeemCredit(backgroundId: string, idempotencyKey: string): Promise<void>
  startCheckout(consent: PurchaseConsentInput): Promise<void>
  cancelReservation(orderId: string): Promise<void>
  cartOpen: boolean
  openCart(): void
  closeCart(): void
}

const PUBLIC_ERROR_MESSAGES: Record<string, string> = {
  AUTH_REQUIRED: "Sign in to continue.",
  EMAIL_VERIFICATION_REQUIRED: "Verify your email to continue.",
  CATALOG_UNAVAILABLE: "This item is not available for purchase.",
  ALREADY_OWNED: "You already own this item.",
  NO_CREDITS_REMAINING: "No purchase credits remain.",
  ITEM_RESERVED: "This item is temporarily reserved.",
  EMPTY_CART: "Your cart is empty.",
  LEGAL_CONSENT_REQUIRED: "Accept the required terms to continue.",
  COUNTRY_UNAVAILABLE: "Purchases are not available in your country.",
  TAX_NOT_READY: "Purchases are temporarily unavailable.",
  STALE_CONCURRENCY: "Your cart changed. Please try again.",
  PAYMENT_PENDING: "Your payment is still processing.",
  UNKNOWN: "Unexpected commerce processing error.",
  NETWORK_ERROR: "We could not reach the purchase service. Try again.",
  INVALID_CHECKOUT_URL: "Checkout could not be opened safely. Try again.",
}

class BackgroundCommerceClientError extends Error {
  readonly code: string

  constructor(error: PublicCommerceError) {
    super(error.message)
    this.name = "BackgroundCommerceClientError"
    this.code = error.code
  }
}

const BackgroundCommerceContext = createContext<BackgroundCommerceContextValue | null>(null)

function requestId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

function publicError(value: unknown, status?: number): PublicCommerceError {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
  const responseCode = typeof record?.error === "string" ? record.error : ""
  const statusCode = status === 401
    ? "AUTH_REQUIRED"
    : status === 403
      ? "EMAIL_VERIFICATION_REQUIRED"
      : "UNKNOWN"
  const code = Object.hasOwn(PUBLIC_ERROR_MESSAGES, responseCode) ? responseCode : statusCode
  return { code, message: PUBLIC_ERROR_MESSAGES[code] ?? PUBLIC_ERROR_MESSAGES.UNKNOWN }
}

async function responseJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null)
}

/** Fetches only the public account snapshot and never trusts response error text. */
async function fetchSnapshot(signal: AbortSignal) {
  const response = await fetch("/api/background-commerce/state", {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
    signal,
    headers: { Accept: "application/json" },
  })
  const body = await responseJson(response)
  if (!response.ok) throw new BackgroundCommerceClientError(publicError(body, response.status))
  return normalizeBackgroundCommerceSnapshot(body)
}

async function mutate(
  path: string,
  method: "POST" | "DELETE",
  body: Record<string, unknown>,
  signal: AbortSignal,
) {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    signal,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
  const value = await responseJson(response)
  if (!response.ok) throw new BackgroundCommerceClientError(publicError(value, response.status))
  return value
}

function asClientError(error: unknown): PublicCommerceError {
  if (error instanceof BackgroundCommerceClientError) {
    return { code: error.code, message: error.message }
  }
  return { code: "NETWORK_ERROR", message: PUBLIC_ERROR_MESSAGES.NETWORK_ERROR }
}

function validCheckoutUrl(value: unknown): string | null {
  if (typeof value !== "string") return null
  try {
    const url = new URL(value)
    return url.protocol === "https:" && url.hostname === "checkout.stripe.com"
      ? url.toString()
      : null
  } catch {
    return null
  }
}

export function BackgroundCommerceProvider({
  children,
  enabled,
}: {
  children: ReactNode
  enabled: boolean
}) {
  const [state, dispatch] = useReducer(
    backgroundCommerceReducer,
    EMPTY_BACKGROUND_COMMERCE_STATE,
  ) as [BackgroundCommerceClientState, React.Dispatch<Record<string, unknown>>]
  const readControllerRef = useRef<AbortController | null>(null)
  const mutationControllersRef = useRef(new Set<AbortController>())
  const mutationQueueRef = useRef<Promise<void>>(Promise.resolve())
  const mutationActiveRef = useRef(false)
  const [cartOpen, setCartOpen] = useState(false)

  const refresh = useCallback(async () => {
    if (!enabled) return
    if (mutationActiveRef.current) {
      await mutationQueueRef.current
      return
    }

    readControllerRef.current?.abort()
    const controller = new AbortController()
    readControllerRef.current = controller
    const id = requestId("fetch")
    dispatch({ type: "fetch-begin", requestId: id })
    try {
      const snapshot = await fetchSnapshot(controller.signal)
      dispatch({ type: "fetch-success", requestId: id, snapshot })
    } catch (error) {
      if (controller.signal.aborted) return
      dispatch({ type: "fetch-failure", requestId: id, error: asClientError(error) })
    } finally {
      if (readControllerRef.current === controller) readControllerRef.current = null
    }
  }, [enabled])

  const enqueueMutation = useCallback((
    action: string,
    operation: (signal: AbortSignal) => Promise<void>,
  ) => {
    const run = async () => {
      readControllerRef.current?.abort()
      mutationActiveRef.current = true
      const controller = new AbortController()
      mutationControllersRef.current.add(controller)
      const id = requestId(action)
      dispatch({ type: "mutation-begin", requestId: id, action })
      try {
        await operation(controller.signal)
        const snapshot = await fetchSnapshot(controller.signal)
        dispatch({ type: "mutation-success", requestId: id, snapshot })
      } catch (error) {
        if (controller.signal.aborted) return
        const safeError = asClientError(error)
        dispatch({ type: "mutation-failure", requestId: id, error: safeError })
        throw new BackgroundCommerceClientError(safeError)
      } finally {
        mutationActiveRef.current = false
        mutationControllersRef.current.delete(controller)
      }
    }
    const queued = mutationQueueRef.current.then(run, run)
    mutationQueueRef.current = queued.catch(() => undefined)
    return queued
  }, [])

  const addToCart = useCallback((backgroundId: string) => (
    enqueueMutation("add-to-cart", async (signal) => {
      await mutate(
        "/api/background-commerce/cart",
        "POST",
        { backgroundId },
        signal,
      )
    })
  ), [enqueueMutation])

  const removeFromCart = useCallback((backgroundId: string) => (
    enqueueMutation("remove-from-cart", async (signal) => {
      await mutate(
        "/api/background-commerce/cart",
        "DELETE",
        { backgroundId },
        signal,
      )
    })
  ), [enqueueMutation])

  const redeemCredit = useCallback((backgroundId: string, idempotencyKey: string) => (
    enqueueMutation("redeem-credit", async (signal) => {
      await mutate(
        "/api/background-commerce/credits/redeem",
        "POST",
        { backgroundId, confirmationAccepted: true, idempotencyKey },
        signal,
      )
    })
  ), [enqueueMutation])

  const cancelReservation = useCallback((orderId: string) => (
    enqueueMutation("cancel-reservation", async (signal) => {
      await mutate(
        "/api/background-commerce/checkout/cancel",
        "POST",
        { orderId },
        signal,
      )
    })
  ), [enqueueMutation])

  const startCheckout = useCallback(async (consent: PurchaseConsentInput) => {
    if (!enabled) {
      throw new BackgroundCommerceClientError({
        code: "AUTH_REQUIRED",
        message: PUBLIC_ERROR_MESSAGES.AUTH_REQUIRED,
      })
    }
    const id = requestId("checkout")
    dispatch({ type: "checkout-redirect-begin", requestId: id })
    const controller = new AbortController()
    mutationControllersRef.current.add(controller)
    try {
      const response = await mutate(
        "/api/background-commerce/checkout",
        "POST",
        consent,
        controller.signal,
      )
      const record = response && typeof response === "object" && !Array.isArray(response)
        ? response as Record<string, unknown>
        : {}
      const url = validCheckoutUrl(record.url)
      if (!url) {
        throw new BackgroundCommerceClientError({
          code: "INVALID_CHECKOUT_URL",
          message: PUBLIC_ERROR_MESSAGES.INVALID_CHECKOUT_URL,
        })
      }
      window.location.assign(url)
    } catch (error) {
      if (controller.signal.aborted) return
      const safeError = asClientError(error)
      dispatch({ type: "checkout-redirect-failure", requestId: id, error: safeError })
      throw new BackgroundCommerceClientError(safeError)
    } finally {
      mutationControllersRef.current.delete(controller)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    void refresh()
    const handleRefresh = () => { void refresh() }
    window.addEventListener("focus", handleRefresh)
    window.addEventListener("online", handleRefresh)
    return () => {
      window.removeEventListener("focus", handleRefresh)
      window.removeEventListener("online", handleRefresh)
      readControllerRef.current?.abort()
    }
  }, [enabled, refresh])

  useEffect(() => () => {
    readControllerRef.current?.abort()
    for (const controller of mutationControllersRef.current) controller.abort()
  }, [])

  const openCart = useCallback(() => setCartOpen(true), [])
  const closeCart = useCallback(() => setCartOpen(false), [])

  const value = useMemo<BackgroundCommerceContextValue>(() => ({
    state,
    refresh,
    addToCart,
    removeFromCart,
    redeemCredit,
    startCheckout,
    cancelReservation,
    cartOpen,
    openCart,
    closeCart,
  }), [
    state,
    refresh,
    addToCart,
    removeFromCart,
    redeemCredit,
    startCheckout,
    cancelReservation,
    cartOpen,
    openCart,
    closeCart,
  ])

  return (
    <BackgroundCommerceContext.Provider value={value}>
      {children}
    </BackgroundCommerceContext.Provider>
  )
}

export function useBackgroundCommerce() {
  const context = useContext(BackgroundCommerceContext)
  if (!context) {
    throw new Error("useBackgroundCommerce must be used within BackgroundCommerceProvider")
  }
  return context
}
