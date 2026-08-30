"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
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
  shouldApplyPreferenceOwnershipProof,
} from "@/lib/background-commerce-client.js"
import {
  createGuestBackgroundCommerceSnapshot,
  readGuestBackgroundCartIds,
  resolveGuestBackgroundCartItem,
  writeGuestBackgroundCartIds,
} from "@/lib/guest-background-cart"

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
  returnPath?: string
}

export type BackgroundCommerceContextValue = {
  state: BackgroundCommerceClientState
  signedIn: boolean
  ensureSnapshot(): Promise<void>
  refresh(): Promise<void>
  captureOwnershipReconciliationRevision(): number
  reconcileOwnedBackgroundIds(
    ownedBackgroundIds: readonly string[],
    requestRevision: number,
  ): Promise<void>
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
  ownerKey,
}: {
  children: ReactNode
  ownerKey: string | null
}) {
  // A keyed owner boundary resets reducer/cart state synchronously. The old
  // instance cleanup aborts its generation before the new owner can hydrate.
  return (
    <OwnerScopedBackgroundCommerceProvider key={ownerKey ?? "guest"} ownerKey={ownerKey}>
      {children}
    </OwnerScopedBackgroundCommerceProvider>
  )
}

function OwnerScopedBackgroundCommerceProvider({
  children,
  ownerKey,
}: {
  children: ReactNode
  ownerKey: string | null
}) {
  const signedIn = Boolean(ownerKey)
  const [state, dispatch] = useReducer(
    backgroundCommerceReducer,
    EMPTY_BACKGROUND_COMMERCE_STATE,
  ) as [BackgroundCommerceClientState, React.Dispatch<Record<string, unknown>>]
  const readControllerRef = useRef<AbortController | null>(null)
  const snapshotPromiseRef = useRef<Promise<void> | null>(null)
  const mutationControllersRef = useRef(new Set<AbortController>())
  const mutationQueueRef = useRef<Promise<void>>(Promise.resolve())
  const mutationActiveRef = useRef(false)
  const commerceRevisionRef = useRef(0)
  const hydratedOwnerRef = useRef<string | null>(null)
  const mutationStartedOwnerRef = useRef<string | null>(null)
  const activeOwnerKeyRef = useRef(ownerKey)
  const ownerGenerationRef = useRef(0)
  const [cartOpen, setCartOpen] = useState(false)
  const [guestCartIds, setGuestCartIds] = useState<string[]>([])
  const guestState = useMemo<BackgroundCommerceClientState>(() => ({
    status: "ready",
    snapshot: normalizeBackgroundCommerceSnapshot(createGuestBackgroundCommerceSnapshot(guestCartIds)),
    pendingAction: null,
    error: null,
  }), [guestCartIds])
  const exposedState = signedIn ? state : guestState

  const updateGuestCart = useCallback((update: (current: string[]) => string[]) => {
    setGuestCartIds((current) => {
      const next = update(current)
      return writeGuestBackgroundCartIds(window.localStorage, next)
    })
  }, [])

  const refresh = useCallback(async () => {
    if (!ownerKey) {
      setGuestCartIds(readGuestBackgroundCartIds(window.localStorage))
      return
    }
    if (activeOwnerKeyRef.current !== ownerKey) return
    if (mutationActiveRef.current) {
      await mutationQueueRef.current
      return
    }

    const requestOwnerKey = ownerKey
    const requestGeneration = ownerGenerationRef.current
    readControllerRef.current?.abort()
    const controller = new AbortController()
    readControllerRef.current = controller
    const id = requestId("fetch")
    dispatch({ type: "fetch-begin", requestId: id })
    try {
      const snapshot = await fetchSnapshot(controller.signal)
      if (
        controller.signal.aborted
        || readControllerRef.current !== controller
        || requestGeneration !== ownerGenerationRef.current
        || requestOwnerKey !== activeOwnerKeyRef.current
      ) return
      commerceRevisionRef.current += 1
      hydratedOwnerRef.current = requestOwnerKey
      dispatch({ type: "fetch-success", requestId: id, snapshot })
    } catch (error) {
      if (
        controller.signal.aborted
        || requestGeneration !== ownerGenerationRef.current
        || requestOwnerKey !== activeOwnerKeyRef.current
      ) return
      dispatch({ type: "fetch-failure", requestId: id, error: asClientError(error) })
    } finally {
      if (readControllerRef.current === controller) readControllerRef.current = null
    }
  }, [ownerKey])

  /** Coalesces current-owner demand without retaining a user snapshot beyond this provider. */
  const ensureSnapshot = useCallback((): Promise<void> => {
    if (!ownerKey) {
      setGuestCartIds(readGuestBackgroundCartIds(window.localStorage))
      return Promise.resolve()
    }
    if (activeOwnerKeyRef.current !== ownerKey) return Promise.resolve()
    if (hydratedOwnerRef.current === ownerKey) return Promise.resolve()
    if (snapshotPromiseRef.current) return snapshotPromiseRef.current

    const operation = refresh()
    const request = operation.finally(() => {
      if (snapshotPromiseRef.current === request) snapshotPromiseRef.current = null
    })
    snapshotPromiseRef.current = request
    return request
  }, [ownerKey, refresh])

  /** Captures the commerce generation against which a preference write starts. */
  const captureOwnershipReconciliationRevision = useCallback(
    () => commerceRevisionRef.current,
    [],
  )

  /**
   * Applies ownership proven by a preference response only if no newer
   * commerce snapshot committed or mutation started, then refreshes fully.
   */
  const reconcileOwnedBackgroundIds = useCallback(async (
    ownedBackgroundIds: readonly string[],
    requestRevision: number,
  ) => {
    if (!ownerKey || activeOwnerKeyRef.current !== ownerKey) return
    readControllerRef.current?.abort()
    if (shouldApplyPreferenceOwnershipProof(
      requestRevision,
      commerceRevisionRef.current,
    )) {
      dispatch({ type: "ownership-reconcile", ownedBackgroundIds })
    }
    await refresh()
  }, [ownerKey, refresh])

  /** Serializes cart, credit, reservation, and checkout writes through one queue. */
  const enqueueSerializedOperation = useCallback((operation: () => Promise<void>) => {
    const queued = mutationQueueRef.current.then(operation, operation)
    mutationQueueRef.current = queued.catch(() => undefined)
    return queued
  }, [])

  const enqueueMutation = useCallback((
    action: string,
    operation: (signal: AbortSignal) => Promise<void>,
    externalSignal?: AbortSignal,
  ) => {
    const requestGeneration = ownerGenerationRef.current
    const requestOwnerKey = ownerKey
    return enqueueSerializedOperation(async () => {
      if (
        !requestOwnerKey
        || requestGeneration !== ownerGenerationRef.current
        || requestOwnerKey !== activeOwnerKeyRef.current
      ) return
      const controller = new AbortController()
      const abortFromExternal = () => controller.abort()
      if (externalSignal?.aborted) {
        controller.abort()
      } else {
        externalSignal?.addEventListener("abort", abortFromExternal, { once: true })
      }
      if (controller.signal.aborted) return

      commerceRevisionRef.current += 1
      mutationStartedOwnerRef.current = requestOwnerKey
      readControllerRef.current?.abort()
      mutationActiveRef.current = true
      mutationControllersRef.current.add(controller)
      const id = requestId(action)
      dispatch({ type: "mutation-begin", requestId: id, action })
      try {
        try {
          await operation(controller.signal)
        } catch (error) {
          if (
            controller.signal.aborted
            || requestGeneration !== ownerGenerationRef.current
            || requestOwnerKey !== activeOwnerKeyRef.current
          ) return
          const safeError = asClientError(error)
          dispatch({ type: "mutation-failure", requestId: id, error: safeError })
          throw new BackgroundCommerceClientError(safeError)
        }

        if (
          controller.signal.aborted
          || requestGeneration !== ownerGenerationRef.current
          || requestOwnerKey !== activeOwnerKeyRef.current
        ) return
        try {
          const snapshot = await fetchSnapshot(controller.signal)
          if (
            controller.signal.aborted
            || requestGeneration !== ownerGenerationRef.current
            || requestOwnerKey !== activeOwnerKeyRef.current
          ) return
          commerceRevisionRef.current += 1
          hydratedOwnerRef.current = requestOwnerKey
          dispatch({ type: "mutation-success", requestId: id, snapshot })
        } catch (error) {
          if (
            controller.signal.aborted
            || requestGeneration !== ownerGenerationRef.current
            || requestOwnerKey !== activeOwnerKeyRef.current
          ) return
          // The authoritative write succeeded. Preserve caller success and the
          // last snapshot while exposing only the follow-up refresh problem.
          dispatch({
            type: "mutation-refresh-failure",
            requestId: id,
            error: asClientError(error),
          })
        }
      } finally {
        mutationActiveRef.current = false
        externalSignal?.removeEventListener("abort", abortFromExternal)
        mutationControllersRef.current.delete(controller)
      }
    })
  }, [enqueueSerializedOperation, ownerKey])

  const addToCart = useCallback(async (backgroundId: string) => {
    if (!signedIn) {
      const item = resolveGuestBackgroundCartItem(backgroundId)
      if (!item) {
        throw new BackgroundCommerceClientError({
          code: "CATALOG_UNAVAILABLE",
          message: PUBLIC_ERROR_MESSAGES.CATALOG_UNAVAILABLE,
        })
      }
      updateGuestCart((current) => (
        current.includes(item.productKey) ? current : [...current, item.productKey]
      ))
      return
    }
    await enqueueMutation("add-to-cart", async (signal) => {
      await mutate(
        "/api/background-commerce/cart",
        "POST",
        { backgroundId },
        signal,
      )
    })
  }, [signedIn, enqueueMutation, updateGuestCart])

  const removeFromCart = useCallback(async (backgroundId: string) => {
    if (!signedIn) {
      updateGuestCart((current) => {
        const matchIndex = current.indexOf(backgroundId)
        if (matchIndex < 0) return current
        return current.filter((_, index) => index !== matchIndex)
      })
      return
    }
    await enqueueMutation("remove-from-cart", async (signal) => {
      await mutate(
        "/api/background-commerce/cart",
        "DELETE",
        { backgroundId },
        signal,
      )
    })
  }, [signedIn, enqueueMutation, updateGuestCart])

  const redeemCredit = useCallback(async (backgroundId: string, idempotencyKey: string) => {
    if (!signedIn) {
      throw new BackgroundCommerceClientError({ code: "AUTH_REQUIRED", message: PUBLIC_ERROR_MESSAGES.AUTH_REQUIRED })
    }
    await enqueueMutation("redeem-credit", async (signal) => {
      await mutate(
        "/api/background-commerce/credits/redeem",
        "POST",
        { backgroundId, confirmationAccepted: true, idempotencyKey },
        signal,
      )
    })
  }, [signedIn, enqueueMutation])

  const cancelReservation = useCallback(async (orderId: string) => {
    if (!signedIn) {
      throw new BackgroundCommerceClientError({
        code: "AUTH_REQUIRED",
        message: PUBLIC_ERROR_MESSAGES.AUTH_REQUIRED,
      })
    }
    await enqueueMutation("cancel-reservation", async (signal) => {
      await mutate(
        "/api/background-commerce/checkout/cancel",
        "POST",
        { orderId },
        signal,
      )
    })
  }, [signedIn, enqueueMutation])

  const startCheckout = useCallback(async (consent: PurchaseConsentInput) => {
    if (!signedIn) {
      throw new BackgroundCommerceClientError({
        code: "AUTH_REQUIRED",
        message: PUBLIC_ERROR_MESSAGES.AUTH_REQUIRED,
      })
    }
    const requestGeneration = ownerGenerationRef.current
    const requestOwnerKey = ownerKey
    await enqueueSerializedOperation(async () => {
      if (
        !requestOwnerKey
        || requestGeneration !== ownerGenerationRef.current
        || requestOwnerKey !== activeOwnerKeyRef.current
      ) return
      commerceRevisionRef.current += 1
      mutationStartedOwnerRef.current = requestOwnerKey
      readControllerRef.current?.abort()
      mutationActiveRef.current = true
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
        if (
          controller.signal.aborted
          || requestGeneration !== ownerGenerationRef.current
          || requestOwnerKey !== activeOwnerKeyRef.current
        ) return
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
        if (
          controller.signal.aborted
          || requestGeneration !== ownerGenerationRef.current
          || requestOwnerKey !== activeOwnerKeyRef.current
        ) return
        const safeError = asClientError(error)
        dispatch({ type: "checkout-redirect-failure", requestId: id, error: safeError })
        throw new BackgroundCommerceClientError(safeError)
      } finally {
        mutationActiveRef.current = false
        mutationControllersRef.current.delete(controller)
      }
    })
  }, [signedIn, enqueueSerializedOperation, ownerKey])

  useEffect(() => {
    if (!signedIn) {
      setGuestCartIds(readGuestBackgroundCartIds(window.localStorage))
      return
    }
    const mergeController = new AbortController()
    const pendingIds = readGuestBackgroundCartIds(window.localStorage)
    if (pendingIds.length > 0) {
      void enqueueMutation("merge-guest-cart", async (signal) => {
        const remainingIds: string[] = []
        for (const backgroundId of pendingIds) {
          try {
            await mutate(
              "/api/background-commerce/cart",
              "POST",
              { backgroundId },
              signal,
            )
          } catch (error) {
            // These terminal outcomes cannot succeed on retry; transient failures stay local.
            if (
              !(error instanceof BackgroundCommerceClientError)
              || !["ALREADY_OWNED", "CATALOG_UNAVAILABLE", "ITEM_RESERVED"].includes(error.code)
            ) {
              remainingIds.push(backgroundId)
            }
          }
        }
        if (signal.aborted) return
        setGuestCartIds(writeGuestBackgroundCartIds(window.localStorage, remainingIds))
      }, mergeController.signal).catch(() => undefined)
    }
    return () => mergeController.abort()
  }, [enqueueMutation, signedIn])

  useEffect(() => {
    if (!signedIn) return
    const handleRefresh = () => {
      if (
        (
          hydratedOwnerRef.current !== ownerKey
          && mutationStartedOwnerRef.current !== ownerKey
        )
        || readControllerRef.current
        || mutationActiveRef.current
      ) return
      void refresh()
    }
    window.addEventListener("focus", handleRefresh)
    window.addEventListener("online", handleRefresh)
    return () => {
      window.removeEventListener("focus", handleRefresh)
      window.removeEventListener("online", handleRefresh)
    }
  }, [ownerKey, refresh, signedIn])

  useLayoutEffect(() => () => {
    ownerGenerationRef.current += 1
    activeOwnerKeyRef.current = null
    readControllerRef.current?.abort()
    for (const controller of mutationControllersRef.current) controller.abort()
  }, [])

  const openCart = useCallback(() => {
    void ensureSnapshot()
    setCartOpen(true)
  }, [ensureSnapshot])
  const closeCart = useCallback(() => setCartOpen(false), [])

  const value = useMemo<BackgroundCommerceContextValue>(() => ({
    state: exposedState,
    signedIn,
    ensureSnapshot,
    refresh,
    captureOwnershipReconciliationRevision,
    reconcileOwnedBackgroundIds,
    addToCart,
    removeFromCart,
    redeemCredit,
    startCheckout,
    cancelReservation,
    cartOpen,
    openCart,
    closeCart,
  }), [
    exposedState,
    signedIn,
    ensureSnapshot,
    refresh,
    captureOwnershipReconciliationRevision,
    reconcileOwnedBackgroundIds,
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

/** Derives the shared accessible credit summary used by all background pickers. */
export function useBackgroundCreditStatus() {
  const { state } = useBackgroundCommerce()
  const creditBalance = state.snapshot?.creditBalance
  if (typeof creditBalance === "number") {
    return `${creditBalance} ${creditBalance === 1 ? "credit" : "credits"}`
  }
  if (state.status === "loading") return "Loading credits..."
  return null
}
