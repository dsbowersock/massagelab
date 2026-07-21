import type { Prisma, PrismaClient } from "@prisma/client"
import { backgroundRegistry } from "../../../../components/backgrounds/backgroundRegistry.ts"
import { buildDigitalPurchaseConsent } from "../../../../lib/legal-acceptance.js"
import {
  assertBackgroundCommercePurchasingReady,
  createBackgroundPurchaseCheckoutSession,
  ensureStripeCustomerForUser,
  expireBackgroundPurchaseCheckoutSession,
  getBackgroundPurchaseCheckoutSessionEvidence,
  isIndeterminateBackgroundCheckoutError,
  retrieveBackgroundPurchaseCheckoutSession,
} from "../../../../lib/stripe-billing.js"
import { prepareBackgroundOrder } from "../../../../lib/commerce/order-service.ts"
import { runCommerceTransaction } from "../../../../lib/commerce/transactions.ts"
import {
  COMMERCE_ERROR_CODES,
  CommerceError,
  asPublicCommerceError,
} from "../../../../lib/commerce/errors.ts"

export const runtime = "nodejs"

type CheckoutUser = {
  id: string
  email: string | null
  name: string | null
  emailVerified: Date | null
  [key: string]: unknown
}

export type CheckoutOrder = {
  id: string
  userId: string
  status: string
  stripeCheckoutSessionId: string | null
}

type PreparedOrder = Awaited<ReturnType<typeof prepareBackgroundOrder>>

type CheckoutSessionLike = {
  id: string
  url?: string | null
  expires_at?: number
  status?: string | null
  payment_status?: string | null
  customer_details?: { address?: { country?: string | null } | null } | null
}

export type BackgroundCheckoutDependencies = {
  env: NodeJS.ProcessEnv
  now: () => Date
  siteUrl?: string
  getSiteUrl?: () => Promise<string>
  catalogReady: boolean
  getSessionUserId: () => Promise<string | null>
  loadUser: (userId: string) => Promise<CheckoutUser | null>
  prepareOrder: (input: {
    userId: string
    purchaseCountry: string
    legalAcceptance: unknown
    returnPath?: unknown
    now: Date
  }) => Promise<PreparedOrder>
  ensureCustomer: (user: CheckoutUser) => Promise<{ stripeCustomerId: string }>
  createCheckoutSession: (input: {
    orderId: string
    userId: string
    checkoutAttempt: number
    customerId: string
    items: PreparedOrder["items"]
    legalConsent: unknown
    purchaseCountry: string
    successUrl: string
    cancelUrl: string
    reservationExpiresAt: Date
    env: NodeJS.ProcessEnv
  }) => Promise<CheckoutSessionLike>
  persistCheckoutSession: (input: {
    userId: string
    orderId: string
    sessionId: string
    expiresAt: Date
  }) => Promise<boolean>
  markCheckoutFailure: (input: {
    userId: string
    orderId: string
    reasonCode: string
  }) => Promise<boolean>
  markCheckoutIndeterminate: (input: {
    userId: string
    orderId: string
    sessionId?: string | null
    reasonCode: string
  }) => Promise<boolean>
  loadOrder: (orderId: string) => Promise<CheckoutOrder | null>
  retrieveCheckoutSession: (sessionId: string) => Promise<CheckoutSessionLike>
  expireCheckoutSession: (sessionId: string) => Promise<CheckoutSessionLike>
  releaseUnpaidOrder: (input: {
    userId: string
    orderId: string
    expectedSessionId: string | null
    allowedStatuses: string[]
    processorStatus: string
    paymentStatus: string
    terminalStatus: "CANCELED" | "PAYMENT_FAILED"
    reasonCode: string
  }) => Promise<boolean>
  markReviewRequired: (input: {
    userId: string
    orderId: string
    expectedSessionId: string | null
    processorSessionId: string
    reasonCode: string
  }) => Promise<boolean>
}

async function appPrisma(): Promise<PrismaClient> {
  return (await import("../../../../lib/prisma.ts")).prisma
}

function orderEventData(input: {
  userId: string
  orderId: string
  eventType: string
  fromState: string
  toState: string
  reasonCode?: string
}) {
  return {
    userId: input.userId,
    orderId: input.orderId,
    eventType: input.eventType,
    source: "background-checkout-route",
    reasonCode: input.reasonCode ?? null,
    aggregateType: "CommerceOrder",
    aggregateId: input.orderId,
    fromState: input.fromState,
    toState: input.toState,
    payload: {} as Prisma.InputJsonValue,
  }
}

/** Associates one processor Session with a new or indeterminate active order. */
export async function persistBackgroundCheckoutSession(
  prismaClient: PrismaClient,
  input: {
    userId: string
    orderId: string
    sessionId: string
    expiresAt: Date
  },
): Promise<boolean> {
  return runCommerceTransaction(prismaClient, async (tx) => {
    const current = await tx.commerceOrder.findUnique({
      where: { id: input.orderId },
      select: {
        userId: true,
        status: true,
        stripeCheckoutSessionId: true,
      },
    })
    if (
      !current
      || current.userId !== input.userId
      || (current.status !== "PREPARING" && current.status !== "AWAITING_PAYMENT")
      || current.stripeCheckoutSessionId !== null
    ) {
      return false
    }
    const transition = await tx.commerceOrder.updateMany({
      where: {
        id: input.orderId,
        userId: input.userId,
        status: current.status,
        stripeCheckoutSessionId: null,
      },
      data: {
        status: "AWAITING_PAYMENT",
        stripeCheckoutSessionId: input.sessionId,
        reservationExpiresAt: input.expiresAt,
        failureCode: null,
      },
    })
    if (transition.count !== 1) return false
    await tx.commerceEvent.create({
      data: orderEventData({
        userId: input.userId,
        orderId: input.orderId,
        eventType: current.status === "PREPARING"
          ? "CHECKOUT_SESSION_CREATED"
          : "CHECKOUT_SESSION_RECOVERED",
        fromState: current.status,
        toState: "AWAITING_PAYMENT",
      }),
    })
    return true
  })
}

/**
 * Keeps an inconclusive processor outcome active so webhook/reconciliation can
 * resolve it. A known Session ID is bound monotonically when available.
 */
export async function markBackgroundCheckoutIndeterminate(
  prismaClient: PrismaClient,
  input: {
    userId: string
    orderId: string
    sessionId?: string | null
    reasonCode: string
  },
): Promise<boolean> {
  return runCommerceTransaction(prismaClient, async (tx) => {
    const current = await tx.commerceOrder.findUnique({
      where: { id: input.orderId },
      select: {
        userId: true,
        status: true,
        stripeCheckoutSessionId: true,
      },
    })
    const sessionId = input.sessionId ?? null
    if (
      !current
      || current.userId !== input.userId
      || (current.status !== "PREPARING" && current.status !== "AWAITING_PAYMENT")
      || (current.stripeCheckoutSessionId !== null && current.stripeCheckoutSessionId !== sessionId)
    ) {
      return false
    }
    if (
      current.status === "AWAITING_PAYMENT"
      && current.stripeCheckoutSessionId === sessionId
    ) {
      return true
    }
    const transition = await tx.commerceOrder.updateMany({
      where: {
        id: input.orderId,
        userId: input.userId,
        status: current.status,
        stripeCheckoutSessionId: current.stripeCheckoutSessionId,
      },
      data: {
        status: "AWAITING_PAYMENT",
        stripeCheckoutSessionId: sessionId,
        failureCode: input.reasonCode,
      },
    })
    if (transition.count !== 1) return false
    await tx.commerceEvent.create({
      data: orderEventData({
        userId: input.userId,
        orderId: input.orderId,
        eventType: "CHECKOUT_RECONCILIATION_REQUIRED",
        fromState: current.status,
        toState: "AWAITING_PAYMENT",
        reasonCode: input.reasonCode,
      }),
    })
    return true
  })
}

/** Releases a processor-free PREPARING order after customer/session creation fails. */
export async function markBackgroundCheckoutFailure(
  prismaClient: PrismaClient,
  input: { userId: string; orderId: string; reasonCode: string },
): Promise<boolean> {
  return runCommerceTransaction(prismaClient, async (tx) => {
    const transition = await tx.commerceOrder.updateMany({
      where: {
        id: input.orderId,
        userId: input.userId,
        status: "PREPARING",
        stripeCheckoutSessionId: null,
      },
      data: {
        status: "PAYMENT_FAILED",
        reservationExpiresAt: null,
        failureCode: input.reasonCode,
      },
    })
    if (transition.count !== 1) return false
    await tx.commerceEvent.create({
      data: orderEventData({
        userId: input.userId,
        orderId: input.orderId,
        eventType: "CHECKOUT_CREATION_FAILED",
        fromState: "PREPARING",
        toState: "PAYMENT_FAILED",
        reasonCode: input.reasonCode,
      }),
    })
    return true
  })
}

/**
 * Releases a reservation only after processor evidence proves the Session is
 * unpaid and no longer open. The matching session/status predicates keep the
 * transition monotonic against payment and fulfillment.
 */
export async function releaseBackgroundCheckoutOrder(
  prismaClient: PrismaClient,
  input: {
    userId: string
    orderId: string
    expectedSessionId: string | null
    allowedStatuses: string[]
    processorStatus: string
    paymentStatus: string
    terminalStatus: "CANCELED" | "PAYMENT_FAILED"
    reasonCode: string
  },
): Promise<boolean> {
  if (input.processorStatus === "open" || input.paymentStatus === "paid") {
    return false
  }

  return runCommerceTransaction(prismaClient, async (tx) => {
    const current = await tx.commerceOrder.findUnique({
      where: { id: input.orderId },
      select: {
        userId: true,
        status: true,
        stripeCheckoutSessionId: true,
      },
    })
    if (
      !current
      || current.userId !== input.userId
      || !input.allowedStatuses.includes(current.status)
      || current.stripeCheckoutSessionId !== input.expectedSessionId
    ) {
      return false
    }
    const transition = await tx.commerceOrder.updateMany({
      where: {
        id: input.orderId,
        userId: input.userId,
        status: current.status,
        stripeCheckoutSessionId: input.expectedSessionId,
      },
      data: {
        status: input.terminalStatus,
        reservationExpiresAt: null,
        failureCode: input.reasonCode,
      },
    })
    if (transition.count !== 1) return false
    await tx.commerceEvent.create({
      data: orderEventData({
        userId: input.userId,
        orderId: input.orderId,
        eventType: input.terminalStatus === "CANCELED" ? "ORDER_CANCELED" : "CHECKOUT_RACE_RELEASED",
        fromState: current.status,
        toState: input.terminalStatus,
        reasonCode: input.reasonCode,
      }),
    })
    return true
  })
}

/** Stops automatic fulfillment when paid processor country evidence is invalid. */
export async function markBackgroundCheckoutReviewRequired(
  prismaClient: PrismaClient,
  input: {
    userId: string
    orderId: string
    expectedSessionId: string | null
    processorSessionId: string
    reasonCode: string
  },
): Promise<boolean> {
  return runCommerceTransaction(prismaClient, async (tx) => {
    const current = await tx.commerceOrder.findUnique({
      where: { id: input.orderId },
      select: {
        userId: true,
        status: true,
        stripeCheckoutSessionId: true,
      },
    })
    if (
      !current
      || current.userId !== input.userId
      || (current.status !== "PREPARING" && current.status !== "AWAITING_PAYMENT")
      || current.stripeCheckoutSessionId !== input.expectedSessionId
    ) {
      return false
    }
    const transition = await tx.commerceOrder.updateMany({
      where: {
        id: input.orderId,
        userId: input.userId,
        status: current.status,
        stripeCheckoutSessionId: input.expectedSessionId,
      },
      data: {
        status: "REVIEW_REQUIRED",
        stripeCheckoutSessionId: input.processorSessionId,
        reservationExpiresAt: null,
        failureCode: input.reasonCode,
      },
    })
    if (transition.count !== 1) return false
    await tx.commerceEvent.create({
      data: orderEventData({
        userId: input.userId,
        orderId: input.orderId,
        eventType: "ORDER_REVIEW_REQUIRED",
        fromState: current.status,
        toState: "REVIEW_REQUIRED",
        reasonCode: input.reasonCode,
      }),
    })
    return true
  })
}

export function defaultBackgroundCheckoutDependencies(): BackgroundCheckoutDependencies {
  return {
    env: process.env,
    now: () => new Date(),
    getSiteUrl: async () => (await import("../../../../lib/auth-env.ts")).getSiteUrl(),
    catalogReady: backgroundRegistry.some((entry) => entry.enabled && entry.requiresSubscription),
    getSessionUserId: async () => {
      const session = await (await import("../../../../auth.ts")).getCurrentSession()
      return session?.user?.id ?? null
    },
    loadUser: async (userId) => (await appPrisma()).user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, emailVerified: true },
    }),
    prepareOrder: async (input) => prepareBackgroundOrder({
      prismaClient: await appPrisma(),
      ...input,
    }),
    ensureCustomer: async (user) => ensureStripeCustomerForUser(await appPrisma(), user),
    createCheckoutSession: createBackgroundPurchaseCheckoutSession,
    persistCheckoutSession: async (input) => persistBackgroundCheckoutSession(await appPrisma(), input),
    markCheckoutFailure: async (input) => markBackgroundCheckoutFailure(await appPrisma(), input),
    markCheckoutIndeterminate: async (input) => markBackgroundCheckoutIndeterminate(
      await appPrisma(),
      input,
    ),
    loadOrder: async (orderId) => (await appPrisma()).commerceOrder.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        status: true,
        stripeCheckoutSessionId: true,
      },
    }),
    retrieveCheckoutSession: async (sessionId) => retrieveBackgroundPurchaseCheckoutSession(sessionId),
    expireCheckoutSession: async (sessionId) => expireBackgroundPurchaseCheckoutSession(sessionId),
    releaseUnpaidOrder: async (input) => releaseBackgroundCheckoutOrder(await appPrisma(), input),
    markReviewRequired: async (input) => markBackgroundCheckoutReviewRequired(await appPrisma(), input),
  }
}

export function commerceErrorResponse(error: unknown): Response {
  const safe = asPublicCommerceError(error)
  return Response.json(
    { error: safe.code, message: safe.message },
    { status: safe.status, headers: { "Cache-Control": "private, no-store" } },
  )
}

function purchaseCountryFromInput(value: unknown): "US" {
  const country = typeof value === "string" ? value.trim().toUpperCase() : ""
  if (country !== "US") {
    throw new CommerceError({ code: COMMERCE_ERROR_CODES.COUNTRY_UNAVAILABLE })
  }
  return country
}

function checkoutReturnUrl(siteUrl: string, status: "success" | "cancelled", orderId: string): string {
  const url = new URL("/account", siteUrl)
  url.searchParams.set("backgroundPurchase", status)
  url.searchParams.set("orderId", orderId)
  return url.toString()
}

async function jsonBody(request: Request): Promise<Record<string, unknown>> {
  const value = await request.json().catch(() => null)
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

async function resolveUnassociatedSession(
  deps: BackgroundCheckoutDependencies,
  input: {
    userId: string
    orderId: string
    session: CheckoutSessionLike
    protectIndeterminate?: boolean
  },
): Promise<Response> {
  const localOrder = await deps.loadOrder(input.orderId)
  const protectedAssociation = input.protectIndeterminate === true
    ? await deps.markCheckoutIndeterminate({
        userId: input.userId,
        orderId: input.orderId,
        sessionId: input.session.id,
        reasonCode: "CHECKOUT_RESPONSE_INDETERMINATE",
      })
    : false
  let processorSession = await deps.retrieveCheckoutSession(input.session.id)
  let evidence = getBackgroundPurchaseCheckoutSessionEvidence(processorSession)
  const associated = processorSession.id === input.session.id
    && (
      protectedAssociation
      || (
        localOrder?.userId === input.userId
        && localOrder.stripeCheckoutSessionId === input.session.id
      )
    )
  const associatedUrl = processorSession.url ?? input.session.url
  if (associated && evidence.status === "open" && !evidence.paid && associatedUrl) {
    return Response.json(
      { url: associatedUrl, orderId: input.orderId },
      { headers: { "Cache-Control": "private, no-store" } },
    )
  }

  if (evidence.paid) {
    if (evidence.reviewRequired) {
      await deps.markReviewRequired({
        userId: input.userId,
        orderId: input.orderId,
        expectedSessionId: associated
          ? input.session.id
          : localOrder?.stripeCheckoutSessionId ?? null,
        processorSessionId: input.session.id,
        reasonCode: "PROCESSOR_COUNTRY_REVIEW",
      })
      return Response.json(
        { orderId: input.orderId, status: "REVIEW_REQUIRED" },
        { status: 202, headers: { "Cache-Control": "private, no-store" } },
      )
    }
    await deps.markCheckoutIndeterminate({
      userId: input.userId,
      orderId: input.orderId,
      sessionId: input.session.id,
      reasonCode: "CHECKOUT_PAYMENT_PENDING",
    })
    return commerceErrorResponse(new CommerceError({ code: COMMERCE_ERROR_CODES.PAYMENT_PENDING }))
  }

  if (evidence.status === "open") {
    try {
      await deps.expireCheckoutSession(input.session.id)
    } catch {
      // Completion can win between retrieve and expire; final retrieval below
      // decides whether the reservation remains protected.
    }
    processorSession = await deps.retrieveCheckoutSession(input.session.id)
    evidence = getBackgroundPurchaseCheckoutSessionEvidence(processorSession)
  }
  if (evidence.paid) {
    if (evidence.reviewRequired) {
      await deps.markReviewRequired({
        userId: input.userId,
        orderId: input.orderId,
        expectedSessionId: associated
          ? input.session.id
          : localOrder?.stripeCheckoutSessionId ?? null,
        processorSessionId: input.session.id,
        reasonCode: "PROCESSOR_COUNTRY_REVIEW",
      })
      return Response.json(
        { orderId: input.orderId, status: "REVIEW_REQUIRED" },
        { status: 202, headers: { "Cache-Control": "private, no-store" } },
      )
    }
    await deps.markCheckoutIndeterminate({
      userId: input.userId,
      orderId: input.orderId,
      sessionId: input.session.id,
      reasonCode: "CHECKOUT_PAYMENT_PENDING",
    })
    return commerceErrorResponse(new CommerceError({ code: COMMERCE_ERROR_CODES.PAYMENT_PENDING }))
  }
  if (evidence.status === "expired" && !evidence.paid) {
    await deps.releaseUnpaidOrder({
      userId: input.userId,
      orderId: input.orderId,
      expectedSessionId: associated ? input.session.id : null,
      allowedStatuses: associated ? ["PREPARING", "AWAITING_PAYMENT"] : ["PREPARING"],
      processorStatus: evidence.status,
      paymentStatus: evidence.paymentStatus,
      terminalStatus: "PAYMENT_FAILED",
      reasonCode: "CHECKOUT_ASSOCIATION_RACE",
    })
    return commerceErrorResponse(new CommerceError({ code: COMMERCE_ERROR_CODES.STALE_CONCURRENCY }))
  }
  await deps.markCheckoutIndeterminate({
    userId: input.userId,
    orderId: input.orderId,
    sessionId: input.session.id,
    reasonCode: "CHECKOUT_PAYMENT_PENDING",
  })
  return commerceErrorResponse(new CommerceError({ code: COMMERCE_ERROR_CODES.PAYMENT_PENDING }))
}

export function createBackgroundCheckoutPostHandler(
  overrides: Partial<BackgroundCheckoutDependencies> = {},
): (request: Request) => Promise<Response> {
  const deps = { ...defaultBackgroundCheckoutDependencies(), ...overrides }

  return async (request: Request) => {
    let preparedOrder: PreparedOrder | null = null
    let user: CheckoutUser | null = null

    try {
      const body = await jsonBody(request)
      const sessionUserId = await deps.getSessionUserId()
      if (!sessionUserId) {
        throw new CommerceError({ code: COMMERCE_ERROR_CODES.AUTHENTICATION_REQUIRED })
      }
      user = await deps.loadUser(sessionUserId)
      if (!user) {
        throw new CommerceError({ code: COMMERCE_ERROR_CODES.AUTHENTICATION_REQUIRED })
      }
      if (!user.emailVerified) {
        throw new CommerceError({ code: COMMERCE_ERROR_CODES.EMAIL_VERIFICATION_REQUIRED })
      }

      const purchaseCountry = purchaseCountryFromInput(body.purchaseCountry)
      let legalConsent
      try {
        legalConsent = buildDigitalPurchaseConsent({
          acceptedDocumentIds: body.acceptedLegalDocuments,
          combinedConsentAccepted: body.combinedConsentAccepted,
          now: deps.now(),
        })
      } catch {
        throw new CommerceError({ code: COMMERCE_ERROR_CODES.LEGAL_CONSENT_REQUIRED })
      }
      assertBackgroundCommercePurchasingReady({
        env: deps.env,
        purchaseCountry,
        legalConsent,
        catalogReady: deps.catalogReady,
      })

      preparedOrder = await deps.prepareOrder({
        userId: user.id,
        purchaseCountry,
        legalAcceptance: legalConsent,
        returnPath: body.returnPath,
        now: deps.now(),
      })

      let customer
      try {
        customer = await deps.ensureCustomer(user)
      } catch {
        await deps.markCheckoutFailure({
          userId: user.id,
          orderId: preparedOrder.orderId,
          reasonCode: "CHECKOUT_CUSTOMER_FAILED",
        })
        throw new CommerceError({ code: COMMERCE_ERROR_CODES.UNKNOWN })
      }

      const siteUrl = deps.siteUrl ?? await deps.getSiteUrl?.()
      if (!siteUrl) {
        await deps.markCheckoutFailure({
          userId: user.id,
          orderId: preparedOrder.orderId,
          reasonCode: "CHECKOUT_CONFIGURATION_FAILED",
        })
        throw new CommerceError({ code: COMMERCE_ERROR_CODES.UNKNOWN })
      }
      let checkoutSession: CheckoutSessionLike
      try {
        checkoutSession = await deps.createCheckoutSession({
          orderId: preparedOrder.orderId,
          userId: user.id,
          checkoutAttempt: 1,
          customerId: customer.stripeCustomerId,
          items: preparedOrder.items,
          legalConsent,
          purchaseCountry,
          successUrl: checkoutReturnUrl(siteUrl, "success", preparedOrder.orderId),
          cancelUrl: checkoutReturnUrl(siteUrl, "cancelled", preparedOrder.orderId),
          reservationExpiresAt: new Date(preparedOrder.expiresAt),
          env: deps.env,
        })
      } catch (error) {
        if (isIndeterminateBackgroundCheckoutError(error)) {
          await deps.markCheckoutIndeterminate({
            userId: user.id,
            orderId: preparedOrder.orderId,
            reasonCode: "CHECKOUT_OUTCOME_INDETERMINATE",
          })
          throw new CommerceError({ code: COMMERCE_ERROR_CODES.PAYMENT_PENDING })
        }
        await deps.markCheckoutFailure({
          userId: user.id,
          orderId: preparedOrder.orderId,
          reasonCode: "CHECKOUT_CREATION_FAILED",
        })
        throw new CommerceError({ code: COMMERCE_ERROR_CODES.UNKNOWN })
      }

      if (!checkoutSession.id) {
        await deps.markCheckoutFailure({
          userId: user.id,
          orderId: preparedOrder.orderId,
          reasonCode: "CHECKOUT_RESPONSE_INVALID",
        })
        throw new CommerceError({ code: COMMERCE_ERROR_CODES.UNKNOWN })
      }
      if (!checkoutSession.url || !checkoutSession.expires_at) {
        return resolveUnassociatedSession(deps, {
          userId: user.id,
          orderId: preparedOrder.orderId,
          session: checkoutSession,
          protectIndeterminate: true,
        })
      }

      const persisted = await deps.persistCheckoutSession({
        userId: user.id,
        orderId: preparedOrder.orderId,
        sessionId: checkoutSession.id,
        expiresAt: new Date(checkoutSession.expires_at * 1000),
      })
      if (!persisted) {
        return resolveUnassociatedSession(deps, {
          userId: user.id,
          orderId: preparedOrder.orderId,
          session: checkoutSession,
        })
      }

      return Response.json(
        { url: checkoutSession.url, orderId: preparedOrder.orderId },
        { headers: { "Cache-Control": "private, no-store" } },
      )
    } catch (error) {
      return commerceErrorResponse(error)
    }
  }
}

export const POST = createBackgroundCheckoutPostHandler()
