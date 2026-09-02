import Stripe from "stripe"
import {
  DONATION_PURPOSE,
  ONE_TIME_SUPPORT_TAX_CODE,
} from "./donations.js"
import {
  getConfiguredMembershipOptions,
  hasSubscriptionBlockingNewCheckout,
  isPaidMembershipLevel,
  normalizeMembershipLevel,
  resolveStripePriceMembershipLevel,
} from "./membership.js"
import { getCommerceTaxReadiness } from "./commerce/catalog.ts"
import { COMMERCE_ERROR_CODES, CommerceError } from "./commerce/errors.ts"
import {
  DIGITAL_PURCHASES_REFUNDS_VERSION,
  legalDocumentAcceptanceId,
  requiredLegalDocumentsForEvent,
} from "./legal-documents.js"
import {
  SUPPORTER_MEMBERSHIP_CATALOG_VERSION,
  SUPPORTER_RECURRING_TAX_BEHAVIOR,
  SUPPORTER_RECURRING_TAX_CODE,
} from "./stripe-price-contract.js"
import {
  getOneTimeSupportTaxReadiness,
  getSupporterRecurringTaxReadiness,
} from "./stripe-readiness.js"
import { STRIPE_API_VERSION } from "./stripe-webhook-contract.js"

export { STRIPE_API_VERSION }
export const BACKGROUND_PURCHASE_PURPOSE = "background_purchase"
export const BACKGROUND_PURCHASE_SCHEMA_VERSION = "2"
const MEMBERSHIP_CHECKOUT_PURPOSE = "membership"
export const SUPPORTER_MEMBERSHIP_CHECKOUT_CONTRACT_VERSION = "supporter_membership_v1_checkout_v1"
const MAX_MEMBERSHIP_CHECKOUT_SESSION_PAGES = 10
const MAX_MEMBERSHIP_CHECKOUT_LINE_ITEM_PAGES = 10
const MAX_BACKGROUND_CHECKOUT_LINE_ITEM_PAGES = 10
const MAX_MEMBERSHIP_CHECKOUT_COMPATIBILITY_CONCURRENCY = 3
export const MEMBERSHIP_CHECKOUT_SUBSCRIPTION_AUTHORITY_CONCURRENCY = 3
export const MEMBERSHIP_CHECKOUT_SUBSCRIPTION_AUTHORITY_READ_BUDGET = 25
const MAX_MEMBERSHIP_CHECKOUT_EXPIRATIONS = 25
const MEMBERSHIP_CHECKOUT_RECONCILIATION_BUDGET_MS = 5_000
const MEMBERSHIP_CHECKOUT_RECONCILIATION_LIMIT_ERROR =
  "Stripe membership Checkout reconciliation exceeded the safe time limit."
const MEMBERSHIP_CHECKOUT_AUTHORITY_DEADLINE_ERROR =
  "Stripe completed membership Checkout subscription authority lookups exceeded the safe deadline."
const MEMBERSHIP_CHECKOUT_AUTHORITY_INVARIANT_ERROR =
  "Stripe completed membership Checkout subscription authority ordering was invalid."
const MEMBERSHIP_CHECKOUT_AUTHORITY_READ_BUDGET_ERROR =
  "Stripe completed membership Checkout subscription authority read budget was exceeded."
const MEMBERSHIP_CHECKOUT_EXPIRATION_LIMIT_ERROR =
  "Stripe membership Checkout Session expirations exceeded the safe limit."
// Classification can cover one reusable Session plus the full stale-expiration budget.
const MAX_MEMBERSHIP_CHECKOUT_OPEN_SESSION_OPERATIONS =
  MAX_MEMBERSHIP_CHECKOUT_EXPIRATIONS + 1
const MEMBERSHIP_CHECKOUT_RECONCILIATION_WINDOW_SECONDS = 7 * 24 * 60 * 60

/**
 * Gives all completed-subscription authority failures one catchable type while
 * preserving a non-sensitive internal code for the exact failure boundary.
 */
export class MembershipCheckoutAuthorityError extends Error {
  constructor(code, message) {
    super(message)
    this.name = "MembershipCheckoutAuthorityError"
    this.code = code
  }

  static deadline() {
    return new MembershipCheckoutAuthorityError(
      "membership_checkout_authority_deadline_exceeded",
      MEMBERSHIP_CHECKOUT_AUTHORITY_DEADLINE_ERROR,
    )
  }

  static invariant() {
    return new MembershipCheckoutAuthorityError(
      "membership_checkout_authority_invariant_failed",
      MEMBERSHIP_CHECKOUT_AUTHORITY_INVARIANT_ERROR,
    )
  }

  static readBudget() {
    return new MembershipCheckoutAuthorityError(
      "membership_checkout_authority_read_budget_exceeded",
      MEMBERSHIP_CHECKOUT_AUTHORITY_READ_BUDGET_ERROR,
    )
  }
}

export function stripeTimestampToDate(value) {
  return typeof value === "number" ? new Date(value * 1000) : null
}

function safeString(value) {
  return typeof value === "string" ? value : ""
}

function objectRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {}
}

function stripeId(value) {
  if (typeof value === "string") {
    return value
  }

  if (value && typeof value === "object" && typeof value.id === "string") {
    return value.id
  }

  return ""
}

/**
 * Orders Checkout Sessions newest-first, with descending IDs providing a
 * deterministic tie-breaker when Stripe timestamps are equal or absent.
 */
function newestStripeCheckoutSessionFirst(left, right) {
  const createdDelta = Number(right?.created ?? 0) - Number(left?.created ?? 0)
  return createdDelta || safeString(right?.id).localeCompare(safeString(left?.id))
}

/**
 * Uses a monotonic clock to prevent the flow from starting more Stripe work
 * after the reconciliation deadline. An already-started Stripe request may
 * finish after that boundary because abandoning a possibly committed write
 * would create an ambiguous Checkout result. Tests inject both the clock and
 * budget so operation-start boundaries remain deterministic without waits.
 * Read-only authority reconciliation also consumes the remaining duration to
 * install one absolute request-pool deadline. Limit callers may supply an
 * Error factory when they need a shared domain-specific catchable type.
 *
 * @param {{ reconciliationNowMs?: () => number, reconciliationBudgetMs?: number }} options
 */
function createMembershipCheckoutReconciliationBudget(options) {
  const nowMs = typeof options.reconciliationNowMs === "function"
    ? options.reconciliationNowMs
    : () => globalThis.performance.now()
  const budgetMs = Number.isFinite(options.reconciliationBudgetMs)
    ? options.reconciliationBudgetMs
    : MEMBERSHIP_CHECKOUT_RECONCILIATION_BUDGET_MS
  const startedAtMs = nowMs()

  /**
   * @param {string | (() => Error)} errorSource Zero-argument Error factory or
   * message string; callers must not pass an Error instance.
   */
  function remainingMs(errorSource) {
    const elapsedMs = nowMs() - startedAtMs
    if (
      !Number.isFinite(elapsedMs)
      || elapsedMs < 0
      || elapsedMs >= budgetMs
    ) {
      throw typeof errorSource === "function"
        ? errorSource()
        : new Error(errorSource)
    }
    return budgetMs - elapsedMs
  }

  return {
    assertWithinBudget(errorSource) {
      remainingMs(errorSource)
    },
    remainingMs,
  }
}

export function verifyStripeWebhookSignature(
  rawBody,
  signatureHeader,
  webhookSecret,
  { nowSeconds = Math.floor(Date.now() / 1000), toleranceSeconds = 300 } = {},
) {
  if (!rawBody || !signatureHeader || !webhookSecret) {
    return false
  }

  const stripe = getStripeClient("sk_test_webhook_verification")
  try {
    stripe.webhooks.constructEvent(rawBody, signatureHeader, webhookSecret, toleranceSeconds, undefined, nowSeconds * 1000)
    return true
  } catch {
    return false
  }
}

export function normalizeStripeSubscription(subscription, { env = process.env } = {}) {
  const metadata = objectRecord(subscription?.metadata)
  const firstItem = subscription?.items?.data?.[0] ?? {}
  const price = objectRecord(firstItem.price)
  const currentPeriodStart = subscription?.current_period_start ?? firstItem.current_period_start
  const currentPeriodEnd = subscription?.current_period_end ?? firstItem.current_period_end
  const membershipLevel = resolveStripePriceMembershipLevel({ priceId: safeString(price.id), env })

  if (!membershipLevel) {
    return null
  }

  return {
    stripeSubscriptionId: safeString(subscription?.id),
    stripeCustomerId: stripeId(subscription?.customer),
    status: safeString(subscription?.status),
    membershipLevel,
    stripePriceId: safeString(price.id),
    stripeProductId: stripeId(price.product),
    currentPeriodStart: stripeTimestampToDate(currentPeriodStart),
    currentPeriodEnd: stripeTimestampToDate(currentPeriodEnd),
    cancelAtPeriodEnd: Boolean(subscription?.cancel_at_period_end),
    canceledAt: stripeTimestampToDate(subscription?.canceled_at),
    couponId: safeString(subscription?.discount?.coupon?.id) || null,
    metadata,
  }
}

export function getStripeSecretKey(env = process.env) {
  return env.STRIPE_SECRET_KEY?.trim() || ""
}

export function getStripeWebhookSecret(env = process.env) {
  return env.STRIPE_WEBHOOK_SECRET?.trim() || ""
}

function assertStripeKey(apiKey) {
  if (!apiKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured.")
  }
}

export function getStripeClient(apiKey = getStripeSecretKey()) {
  assertStripeKey(apiKey)
  return new Stripe(apiKey, {
    apiVersion: STRIPE_API_VERSION,
  })
}

export async function createStripeCustomer({ email, name, userId, apiKey, stripeClient, idempotencyKey } = {}) {
  const stripe = stripeClient ?? getStripeClient(apiKey)
  const metadata = userId ? { userId } : undefined
  const requestOptions = idempotencyKey ? { idempotencyKey } : undefined

  return stripe.customers.create({
    ...(email ? { email } : {}),
    ...(name ? { name } : {}),
    ...(metadata ? { metadata } : {}),
  }, requestOptions)
}

/**
 * Stripe reports a missing Customer as StripeInvalidRequestError with
 * resource_missing on either code or raw.code; every other error should fail.
 */
function isMissingStripeResourceError(error) {
  return error?.type === "StripeInvalidRequestError"
    && (error?.code === "resource_missing" || error?.raw?.code === "resource_missing")
}

function stripeCustomerCreateIdempotencyKey(userId, existingStripeCustomerId = "") {
  return `massagelab-customer:${userId}:${existingStripeCustomerId || "new"}`
}

/**
 * Owns current and legacy MassageLab membership Sessions for reconciliation.
 * Empty purpose and client_reference_id values are accepted only because old
 * Sessions predate those markers; matching customer, user metadata, mode, and
 * paid membership level still make them safely ownable and expirable.
 */
function isMassageLabMembershipCheckoutSession(session, { customerId, userId }) {
  const metadata = objectRecord(session?.metadata)
  const purpose = safeString(metadata.purpose)
  const clientReferenceId = safeString(session?.client_reference_id)

  return session?.mode === "subscription"
    && stripeId(session?.customer) === customerId
    && safeString(metadata.userId) === userId
    && (!clientReferenceId || clientReferenceId === userId)
    && isPaidMembershipLevel(metadata.membershipLevel)
    && (!purpose || purpose === MEMBERSHIP_CHECKOUT_PURPOSE)
}

/**
 * Distinguishes an actionable-status history overflow from expired-history
 * saturation so callers can fail closed without conflating the two cases.
 */
class MembershipCheckoutSessionHistoryCapError extends Error {
  constructor(status) {
    super(`Stripe ${status} membership Checkout Session history exceeded the safe limit.`)
    this.name = "MembershipCheckoutSessionHistoryCapError"
    this.code = "membership_checkout_history_cap_exceeded"
  }
}

/**
 * Keeps mixed and status-filtered reconciliation scans on the same bounded
 * customer, creation-window, and cursor contract.
 */
function membershipCheckoutSessionListPayload({
  customerId,
  nowSeconds,
  startingAfter,
  status,
}) {
  return {
    customer: customerId,
    created: {
      // Stripe API 2026-02-25.clover explicitly supports this range filter;
      // keep reconciliation bounded instead of retrieving full history.
      gte: Math.max(
        0,
        Math.floor(nowSeconds) - MEMBERSHIP_CHECKOUT_RECONCILIATION_WINDOW_SECONDS,
      ),
    },
    limit: 100,
    ...(status ? { status } : {}),
    ...(startingAfter ? { starting_after: startingAfter } : {}),
  }
}

/**
 * Scans one actionable Stripe status after the mixed-history scan reaches its
 * cap. Expired history cannot consume this budget; an actionable status that
 * independently exceeds the cap remains a distinct fail-closed condition.
 */
async function listStripeMembershipCheckoutSessionsByStatus(
  stripe,
  { customerId, userId, nowSeconds },
  status,
  reconciliationBudget,
) {
  const sessions = []
  const seenCursors = new Set()
  let startingAfter

  for (let pageNumber = 0; pageNumber < MAX_MEMBERSHIP_CHECKOUT_SESSION_PAGES; pageNumber += 1) {
    reconciliationBudget.assertWithinBudget(
      MEMBERSHIP_CHECKOUT_RECONCILIATION_LIMIT_ERROR,
    )
    const page = await stripe.checkout.sessions.list(
      membershipCheckoutSessionListPayload({
        customerId,
        nowSeconds,
        startingAfter,
        status,
      }),
    )
    reconciliationBudget.assertWithinBudget(
      MEMBERSHIP_CHECKOUT_RECONCILIATION_LIMIT_ERROR,
    )
    if (!Array.isArray(page?.data) || typeof page?.has_more !== "boolean") {
      throw new Error("Stripe returned an invalid Checkout Session page.")
    }

    sessions.push(...page.data.filter((session) => (
      session?.status === status
      && isMassageLabMembershipCheckoutSession(session, { customerId, userId })
    )))
    if (!page.has_more) {
      return sessions
    }

    const nextCursor = safeString(page.data.at(-1)?.id)
    if (!nextCursor || seenCursors.has(nextCursor)) {
      throw new Error("Stripe Checkout Session pagination did not advance.")
    }
    seenCursors.add(nextCursor)
    startingAfter = nextCursor
  }

  throw new MembershipCheckoutSessionHistoryCapError(status)
}

/**
 * Lists every bounded page needed to find recent MassageLab-owned membership
 * Sessions. The seven-day window covers open Sessions and webhook reconciliation
 * races without scanning a customer's full Checkout history synchronously.
 * Malformed or non-advancing pagination fails closed.
 */
async function listStripeMembershipCheckoutSessions(
  stripe,
  { customerId, userId, nowSeconds = Math.floor(Date.now() / 1000) },
  reconciliationBudget,
) {
  const sessions = []
  const seenCursors = new Set()
  let startingAfter
  let latestExpiredSession = null

  for (let pageNumber = 0; pageNumber < MAX_MEMBERSHIP_CHECKOUT_SESSION_PAGES; pageNumber += 1) {
    reconciliationBudget.assertWithinBudget(
      MEMBERSHIP_CHECKOUT_RECONCILIATION_LIMIT_ERROR,
    )
    const page = await stripe.checkout.sessions.list(
      membershipCheckoutSessionListPayload({
        customerId,
        nowSeconds,
        startingAfter,
      }),
    )
    reconciliationBudget.assertWithinBudget(
      MEMBERSHIP_CHECKOUT_RECONCILIATION_LIMIT_ERROR,
    )
    if (!Array.isArray(page?.data) || typeof page?.has_more !== "boolean") {
      throw new Error("Stripe returned an invalid Checkout Session page.")
    }

    const matchingSessions = page.data.filter((session) => (
      isMassageLabMembershipCheckoutSession(session, { customerId, userId })
    ))
    sessions.push(...matchingSessions)
    for (const expiredSession of matchingSessions.filter(
      (session) => session?.status === "expired",
    )) {
      if (
        !latestExpiredSession
        || newestStripeCheckoutSessionFirst(expiredSession, latestExpiredSession) < 0
      ) {
        latestExpiredSession = expiredSession
      }
    }
    if (!page.has_more) {
      return sessions.sort(newestStripeCheckoutSessionFirst)
    }

    const nextCursor = safeString(page.data.at(-1)?.id)
    if (!nextCursor || seenCursors.has(nextCursor)) {
      throw new Error("Stripe Checkout Session pagination did not advance.")
    }
    seenCursors.add(nextCursor)
    startingAfter = nextCursor
  }

  const [openSessions, completeSessions] = await Promise.all([
    listStripeMembershipCheckoutSessionsByStatus(
      stripe,
      { customerId, userId, nowSeconds },
      "open",
      reconciliationBudget,
    ),
    listStripeMembershipCheckoutSessionsByStatus(
      stripe,
      { customerId, userId, nowSeconds },
      "complete",
      reconciliationBudget,
    ),
  ])
  return [
    ...openSessions,
    ...completeSessions,
    ...(latestExpiredSession ? [latestExpiredSession] : []),
  ].sort(newestStripeCheckoutSessionFirst)
}

/**
 * Projects a Stripe Checkout Session to the non-sensitive fields returned to
 * the membership route after reuse or completed-subscription detection.
 * @param {Record<string, unknown>} session
 * @returns {{ id: string, status: string, subscription: string | null, url: string | null }}
 */
function membershipCheckoutProjection(session) {
  return {
    id: safeString(session?.id),
    status: safeString(session?.status),
    subscription: stripeId(session?.subscription) || null,
    url: typeof session?.url === "string" ? session.url : null,
  }
}

/**
 * Reads every expanded line item needed to validate a reusable membership
 * Session. Invalid, stalled, or more than ten pages fail closed. Ten full
 * pages are already 1,000 items for a Checkout reusable only with one.
 * @param {Record<string, any>} stripe
 * @param {string} sessionId
 * @param {{ assertWithinBudget: (errorMessage: string) => void }} reconciliationBudget
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
async function listStripeMembershipCheckoutLineItems(
  stripe,
  sessionId,
  reconciliationBudget,
) {
  const lineItems = []
  const seenCursors = new Set()
  let startingAfter

  for (let pageNumber = 0; pageNumber < MAX_MEMBERSHIP_CHECKOUT_LINE_ITEM_PAGES; pageNumber += 1) {
    reconciliationBudget.assertWithinBudget(
      MEMBERSHIP_CHECKOUT_RECONCILIATION_LIMIT_ERROR,
    )
    const page = await stripe.checkout.sessions.listLineItems(sessionId, {
      limit: 100,
      expand: ["data.price.product"],
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    })
    reconciliationBudget.assertWithinBudget(
      MEMBERSHIP_CHECKOUT_RECONCILIATION_LIMIT_ERROR,
    )
    if (!Array.isArray(page?.data) || typeof page?.has_more !== "boolean") {
      throw new Error("Stripe returned an invalid membership Checkout line-item page.")
    }
    lineItems.push(...page.data)
    if (!page.has_more) {
      return lineItems
    }

    const nextCursor = safeString(page.data.at(-1)?.id)
    if (!nextCursor || seenCursors.has(nextCursor)) {
      throw new Error("Stripe membership Checkout line-item pagination did not advance.")
    }
    seenCursors.add(nextCursor)
    startingAfter = nextCursor
  }

  throw new Error("Stripe membership Checkout line-item pagination exceeded the safe limit.")
}

/**
 * Reuses only Sessions created by the current Supporter Checkout contract.
 * The version marker is necessary but not sufficient: Stripe's returned
 * tax/address state and the expanded configured Price/Product must also match.
 */
async function isCurrentSupporterMembershipCheckoutSession(
  stripe,
  session,
  { currentPriceIds, nowSeconds, reconciliationBudget, requestedPriceId },
) {
  const metadata = objectRecord(session?.metadata)
  if (
    safeString(metadata.purpose) !== MEMBERSHIP_CHECKOUT_PURPOSE
    || safeString(metadata.membershipLevel).toUpperCase() !== "SUPPORTER"
    || safeString(metadata.checkoutContractVersion)
      !== SUPPORTER_MEMBERSHIP_CHECKOUT_CONTRACT_VERSION
    || session?.automatic_tax?.enabled !== true
    || session?.billing_address_collection !== "required"
    || typeof session?.expires_at !== "number"
    || session.expires_at <= nowSeconds
  ) {
    return false
  }

  const lineItems = await listStripeMembershipCheckoutLineItems(
    stripe,
    session.id,
    reconciliationBudget,
  )
  if (lineItems.length !== 1 || lineItems[0]?.quantity !== 1) {
    return false
  }

  const price = objectRecord(lineItems[0]?.price)
  const priceId = safeString(price.id)
  const product = objectRecord(price.product)
  const productMetadata = objectRecord(product.metadata)

  return priceId === requestedPriceId
    && currentPriceIds.has(priceId)
    && price.active === true
    && price.tax_behavior === SUPPORTER_RECURRING_TAX_BEHAVIOR
    && product.active === true
    && product.tax_code === SUPPORTER_RECURRING_TAX_CODE
    && safeString(productMetadata.massagelab_catalog)
      === SUPPORTER_MEMBERSHIP_CATALOG_VERSION
}

/**
 * Checks open Sessions with a small fixed worker pool so Stripe line-item
 * reads do not form a serial latency chain or an unbounded request burst.
 * Results are written back by input index, keeping reconciliation order
 * authoritative even when later checks finish first.
 */
async function classifyOpenMembershipCheckoutSessions(
  stripe,
  openSessions,
  compatibilityOptions,
) {
  const classifications = new Array(openSessions.length)
  let nextIndex = 0

  async function classifyNextSession() {
    while (nextIndex < openSessions.length) {
      compatibilityOptions.reconciliationBudget.assertWithinBudget(
        MEMBERSHIP_CHECKOUT_RECONCILIATION_LIMIT_ERROR,
      )
      const index = nextIndex
      nextIndex += 1
      const session = openSessions[index]
      classifications[index] = {
        session,
        reusable: await isCurrentSupporterMembershipCheckoutSession(
          stripe,
          session,
          compatibilityOptions,
        ),
      }
    }
  }

  const workerCount = Math.min(
    MAX_MEMBERSHIP_CHECKOUT_COMPATIBILITY_CONCURRENCY,
    openSessions.length,
  )
  await Promise.all(
    Array.from({ length: workerCount }, () => classifyNextSession()),
  )
  return classifications
}

/**
 * Runs one completed Session through the same subscription authority used for
 * both initial reconciliation and completion-during-expiry races. The original
 * Session remains the private idempotency anchor; only its sanitized projection
 * may leave this module boundary.
 *
 * @param {number} requestTimeoutMs Remaining absolute authority window passed
 * to stripe-node as its per-request timeout in milliseconds.
 * @returns {Promise<{
 *   projection: ReturnType<typeof membershipCheckoutProjection>,
 *   sourceSession: Record<string, unknown>,
 * } | null>}
 */
async function blockingCompletedMembershipCheckoutProjection(
  stripe,
  completedSession,
  env,
  requestTimeoutMs,
) {
  const subscriptionId = stripeId(completedSession.subscription)
  const blockingAuthority = {
    projection: membershipCheckoutProjection(completedSession),
    sourceSession: completedSession,
  }
  if (!subscriptionId) {
    return blockingAuthority
  }
  const subscription = normalizeStripeSubscription(
    await stripe.subscriptions.retrieve(
      subscriptionId,
      {},
      { timeout: requestTimeoutMs },
    ),
    { env },
  )
  if (!subscription) {
    throw new Error("Stripe returned a completed membership Checkout with an unmapped subscription.")
  }
  return hasSubscriptionBlockingNewCheckout([subscription])
    ? blockingAuthority
    : null
}

/**
 * Installs one absolute completed-subscription authority deadline. Callers may
 * race any number of related reads against the same timer, then tie timer
 * cleanup to the promise that observes all in-flight work.
 */
function createMembershipCheckoutAuthorityDeadline(reconciliationBudget) {
  let deadlineTimer
  const timeoutMs = Math.ceil(reconciliationBudget.remainingMs(
    MembershipCheckoutAuthorityError.deadline,
  ))
  const deadlinePromise = new Promise((_, reject) => {
    deadlineTimer = setTimeout(
      () => reject(MembershipCheckoutAuthorityError.deadline()),
      timeoutMs,
    )
    deadlineTimer?.unref?.()
  })
  // Observe the original timer rejection even if a future caller constructs
  // the helper without racing or clearing it. Real callers still race the
  // unchanged original promise, so its deadline error continues to propagate.
  void deadlinePromise.catch(() => undefined)

  return {
    remainingTimeoutMs() {
      return Math.ceil(reconciliationBudget.remainingMs(
        MembershipCheckoutAuthorityError.deadline,
      ))
    },
    race(operationPromise) {
      return Promise.race([operationPromise, deadlinePromise])
    },
    clearWhenSettled(settlementPromise) {
      void Promise.race([
        Promise.resolve(settlementPromise),
        deadlinePromise,
      ]).then(
        () => clearTimeout(deadlineTimer),
        () => clearTimeout(deadlineTimer),
      )
    },
  }
}

/**
 * Deduplicates completed Sessions by their Stripe subscription authority.
 * Missing subscription IDs are themselves safe blocking authority. Once one
 * is found, later Sessions cannot change the newest-first blocking result.
 */
function uniqueCompletedMembershipCheckoutSessions(sessions) {
  const uniqueSessions = []
  const seenSubscriptionIds = new Set()

  for (const session of sessions) {
    if (session?.status !== "complete") {
      continue
    }

    const subscriptionId = stripeId(session.subscription)
    if (!subscriptionId) {
      uniqueSessions.push(session)
      break
    }
    if (seenSubscriptionIds.has(subscriptionId)) {
      continue
    }

    seenSubscriptionIds.add(subscriptionId)
    uniqueSessions.push(session)
  }

  return uniqueSessions
}

/**
 * Resolves completed-Session subscription authority with a fixed worker pool.
 * Workers capture results by newest-first input index, so a later completion
 * or failure can never override the blocking precedence of an earlier Session.
 * At most the existing number of Stripe subscription reads is claimed; a
 * missing-subscription blocking Session immediately after that cap requires no
 * request and remains observable. Workers stop claiming more work once a
 * blocking result or failure is observed. One absolute deadline bounds every
 * read and the coordinator, while indexed outcomes allow an authoritative
 * earlier blocker or error to settle without awaiting later speculative reads.
 */
async function firstBlockingCompletedMembershipCheckoutProjection(
  stripe,
  completedSessions,
  env,
  reconciliationBudget,
) {
  // uniqueCompletedMembershipCheckoutSessions stops after the first missing
  // subscription, guaranteeing at most one such zero-read blocker, always last;
  // the read-budget +1 calculation below relies on that invariant.
  let missingSubscriptionIndex = -1
  let missingSubscriptionCount = 0
  let subscriptionAuthorityCount = 0
  for (const [index, session] of completedSessions.entries()) {
    if (stripeId(session.subscription)) {
      subscriptionAuthorityCount += 1
      continue
    }
    if (missingSubscriptionIndex < 0) {
      missingSubscriptionIndex = index
    }
    missingSubscriptionCount += 1
  }
  if (
    missingSubscriptionCount > 1
    || (
      missingSubscriptionIndex >= 0
      && missingSubscriptionIndex !== completedSessions.length - 1
    )
  ) {
    throw MembershipCheckoutAuthorityError.invariant()
  }
  if (
    subscriptionAuthorityCount
    > MEMBERSHIP_CHECKOUT_SUBSCRIPTION_AUTHORITY_READ_BUDGET
  ) {
    throw MembershipCheckoutAuthorityError.readBudget()
  }
  const authoritySessionCount = Math.min(
    completedSessions.length,
    MEMBERSHIP_CHECKOUT_SUBSCRIPTION_AUTHORITY_READ_BUDGET
      + (missingSubscriptionIndex >= 0 ? 1 : 0),
  )
  if (authoritySessionCount === 0) {
    return null
  }

  const resolveOutcomes = new Array(authoritySessionCount)
  const outcomePromises = Array.from(
    { length: authoritySessionCount },
    (_, index) => new Promise((resolve) => {
      resolveOutcomes[index] = resolve
    }),
  )
  let nextIndex = 0
  let stopAfterIndex = authoritySessionCount
  const authorityDeadline =
    createMembershipCheckoutAuthorityDeadline(reconciliationBudget)

  function recordOutcome(index, outcome) {
    resolveOutcomes[index](outcome)
  }

  async function resolveNextAuthority() {
    while (nextIndex < stopAfterIndex) {
      const index = nextIndex
      nextIndex += 1
      try {
        reconciliationBudget.assertWithinBudget(
          MembershipCheckoutAuthorityError.deadline,
        )
        const requestTimeoutMs = authorityDeadline.remainingTimeoutMs()
        const blockingAuthority = await authorityDeadline.race(
          blockingCompletedMembershipCheckoutProjection(
            stripe,
            completedSessions[index],
            env,
            requestTimeoutMs,
          ),
        )
        reconciliationBudget.assertWithinBudget(
          MembershipCheckoutAuthorityError.deadline,
        )
        recordOutcome(index, { blockingAuthority })
        if (blockingAuthority) {
          stopAfterIndex = Math.min(stopAfterIndex, index + 1)
        }
      } catch (error) {
        recordOutcome(index, { error })
        stopAfterIndex = Math.min(stopAfterIndex, index + 1)
      }
    }
  }

  const workerCount = Math.min(
    MEMBERSHIP_CHECKOUT_SUBSCRIPTION_AUTHORITY_CONCURRENCY,
    authoritySessionCount,
  )
  const workersDone = Promise.all(Array.from(
    { length: workerCount },
    () => resolveNextAuthority(),
  ))

  try {
    // A worker records its claimed index before a blocker or error lowers
    // stopAfterIndex to index + 1. Outcomes at or beyond that reduced bound
    // may remain intentionally unresolved, so this ordered drain must return
    // or throw at the settled boundary and never continue into those slots.
    for (const outcomePromise of outcomePromises) {
      const outcome = await authorityDeadline.race(outcomePromise)
      if (outcome.error) {
        throw outcome.error
      }
      if (outcome.blockingAuthority) {
        return outcome.blockingAuthority
      }
    }

    await workersDone
    return null
  } finally {
    authorityDeadline.clearWhenSettled(workersDone)
  }
}

function membershipCheckoutExpirationIdempotencyKey(sessionId) {
  return `massagelab-membership-checkout-expire:${sessionId}`
}

/**
 * An expiration can commit even when its response is lost. Re-retrieval is the
 * authority: expired permits current Checkout to continue, while complete is
 * returned for subscription reconciliation. Every non-terminal state fails.
 */
async function expireAndConfirmLegacyMembershipCheckout(stripe, sessionId) {
  let expirationError
  try {
    await stripe.checkout.sessions.expire(
      sessionId,
      {},
      {
        idempotencyKey: membershipCheckoutExpirationIdempotencyKey(sessionId),
      },
    )
  } catch (error) {
    expirationError = error
    // An ambiguous POST may still have committed; confirmation below decides.
  }

  let confirmed
  try {
    confirmed = await stripe.checkout.sessions.retrieve(sessionId)
  } catch (error) {
    throw new Error("Unable to confirm legacy membership Checkout expiration.", {
      cause: error,
    })
  }
  if (confirmed?.status !== "expired" && confirmed?.status !== "complete") {
    throw new Error("Unable to confirm legacy membership Checkout expiration.", {
      ...(expirationError === undefined ? {} : { cause: expirationError }),
    })
  }
  return confirmed
}

/**
 * Emits aggregate-only reconciliation timing and Stripe throttle state.
 * Identifiers, error text, and request metadata are deliberately excluded, and
 * logging failures are isolated so observability cannot alter Checkout.
 *
 * @param {{ startedAtMs: number, outcome: "success" | "error", error?: unknown }} input
 */
function observeStripeMembershipCheckoutReconciliation({
  startedAtMs,
  outcome,
  error,
}) {
  const rawDurationMs = Date.now() - startedAtMs
  const observation = {
    durationMs: Number.isFinite(rawDurationMs)
      ? Math.max(0, Math.round(rawDurationMs))
      : 0,
    outcome,
    stripeRateLimited: stripeErrorStatus(error) === 429
      || stripeErrorType(error) === "StripeRateLimitError",
  }

  try {
    if (observation.stripeRateLimited) {
      console.warn("Stripe membership Checkout reconciliation", observation)
    } else {
      console.info("Stripe membership Checkout reconciliation", observation)
    }
  } catch {
    // Diagnostic output must never change reconciliation or Checkout behavior.
  }
}

/**
 * Reconciles recent Stripe membership Sessions for a customer and user.
 * @param {Record<string, any>} stripe
 * @param {{
 *   customerId: string,
 *   userId: string,
 *   priceId: string,
 *   env?: Record<string, string>,
 *   nowSeconds?: number,
 * }} options
 * @param {{ assertWithinBudget: (errorMessage: string) => void }} reconciliationBudget
 * @returns {Promise<{ session: ReturnType<typeof membershipCheckoutProjection> | null, latestSessionId: string }>}
 *
 * Completed blocking memberships take precedence. Compatible open Sessions are
 * reused; incompatible and duplicate open Sessions are expired in order.
 * Unsupported or invalid Stripe states fail closed, while latestSessionId
 * anchors Checkout rotation and idempotency.
 */
async function resolveExistingStripeMembershipCheckout(
  stripe,
  options,
  reconciliationBudget,
) {
  const startedAtMs = Date.now()
  let outcome = "success"
  let reconciliationError
  try {
    return await resolveExistingStripeMembershipCheckoutCore(
      stripe,
      options,
      reconciliationBudget,
    )
  } catch (error) {
    outcome = "error"
    reconciliationError = error
    throw error
  } finally {
    observeStripeMembershipCheckoutReconciliation({
      startedAtMs,
      outcome,
      error: reconciliationError,
    })
  }
}

async function resolveExistingStripeMembershipCheckoutCore(
  stripe,
  options,
  reconciliationBudget,
) {
  const nowSeconds = Number.isFinite(options.nowSeconds)
    ? Math.floor(options.nowSeconds)
    : Math.floor(Date.now() / 1000)
  const sessions = await listStripeMembershipCheckoutSessions(stripe, {
    ...options,
    nowSeconds,
  }, reconciliationBudget)
  reconciliationBudget.assertWithinBudget(
    MEMBERSHIP_CHECKOUT_RECONCILIATION_LIMIT_ERROR,
  )
  const uniqueCompletedSessions = uniqueCompletedMembershipCheckoutSessions(sessions)
  const blockingCompletedAuthority = await firstBlockingCompletedMembershipCheckoutProjection(
    stripe,
    uniqueCompletedSessions,
    options.env,
    reconciliationBudget,
  )
  if (blockingCompletedAuthority) {
    return {
      session: blockingCompletedAuthority.projection,
      latestSessionId: safeString(blockingCompletedAuthority.sourceSession.id),
    }
  }

  const currentPriceIds = new Set(
    getConfiguredMembershipOptions(options.env).map(({ priceId }) => priceId),
  )
  const openSessions = sessions.filter((session) => session?.status === "open")
  if (openSessions.length > MAX_MEMBERSHIP_CHECKOUT_OPEN_SESSION_OPERATIONS) {
    throw new Error(
      "Stripe open membership Checkout Session operations exceeded the safe limit.",
    )
  }
  const openSessionClassifications = await classifyOpenMembershipCheckoutSessions(
    stripe,
    openSessions,
    {
      currentPriceIds,
      nowSeconds,
      reconciliationBudget,
      requestedPriceId: options.priceId,
    },
  )
  reconciliationBudget.assertWithinBudget(
    MEMBERSHIP_CHECKOUT_RECONCILIATION_LIMIT_ERROR,
  )
  const reusableOpenSession = openSessionClassifications.find(
    ({ reusable }) => reusable,
  )?.session
  const sessionsToExpire = openSessionClassifications
    .filter(({ session }) => session !== reusableOpenSession)
    .map(({ session }) => session)
  for (const [index, sessionToExpire] of sessionsToExpire.entries()) {
    if (index >= MAX_MEMBERSHIP_CHECKOUT_EXPIRATIONS) {
      throw new Error(MEMBERSHIP_CHECKOUT_EXPIRATION_LIMIT_ERROR)
    }
    reconciliationBudget.assertWithinBudget(MEMBERSHIP_CHECKOUT_EXPIRATION_LIMIT_ERROR)
    const confirmed = await expireAndConfirmLegacyMembershipCheckout(
      stripe,
      sessionToExpire.id,
    )
    if (confirmed.status === "complete") {
      const blockingAuthority =
        await firstBlockingCompletedMembershipCheckoutProjection(
          stripe,
          [confirmed],
          options.env,
          reconciliationBudget,
        )
      if (blockingAuthority) {
        return {
          session: blockingAuthority.projection,
          latestSessionId: safeString(blockingAuthority.sourceSession.id),
        }
      }
    } else {
      reconciliationBudget.assertWithinBudget(MEMBERSHIP_CHECKOUT_EXPIRATION_LIMIT_ERROR)
    }
  }

  if (reusableOpenSession) {
    if (typeof reusableOpenSession.url !== "string" || !reusableOpenSession.url) {
      throw new Error("Stripe returned an open Checkout Session without a URL.")
    }
    return {
      session: membershipCheckoutProjection(reusableOpenSession),
      latestSessionId: safeString(sessions[0]?.id) || "initial",
    }
  }
  if (sessionsToExpire.length > 0) {
    return {
      session: null,
      latestSessionId: safeString(sessions[0]?.id) || "initial",
    }
  }

  const latestSession = sessions[0]
  if (!latestSession) {
    return { session: null, latestSessionId: "initial" }
  }
  if (latestSession.status === "expired" || latestSession.status === "complete") {
    return { session: null, latestSessionId: safeString(latestSession.id) }
  }
  throw new Error("Stripe returned an unsupported membership Checkout Session status.")
}

/**
 * Deliberately omits Price: concurrent different-price attempts must collide
 * on the user-and-anchor key so Stripe rejects the parameter mismatch. The
 * recovery path then expires the incompatible open Session before rotating to
 * a new anchor, preventing two parallel subscription Checkouts.
 */
function membershipCheckoutIdempotencyKey(userId, latestSessionId) {
  return `massagelab-membership-checkout:${userId}:after:${latestSessionId}`
}

/**
 * Resolves a new Checkout Price against both the runtime normalization map and
 * exactly one current public-catalog slot. Historical Price IDs remain valid
 * for webhook/subscription reads but can never authorize new Checkout.
 */
function resolveCurrentStripeMembershipCheckoutPrice(priceId, env) {
  const normalizedPriceId = safeString(priceId).trim()
  const resolvedMembershipLevel = resolveStripePriceMembershipLevel({
    priceId: normalizedPriceId,
    env,
  })
  const configuredMatches = getConfiguredMembershipOptions(env)
    .filter((option) => option.priceId === normalizedPriceId)

  if (configuredMatches.length > 1) {
    throw new Error("The selected membership Price is configured in multiple current catalog slots.")
  }

  if (
    !resolvedMembershipLevel
    || configuredMatches.length !== 1
    || configuredMatches[0].membershipLevel !== resolvedMembershipLevel
  ) {
    throw new Error("The selected membership Price is not in the current configured catalog.")
  }

  return {
    membershipLevel: resolvedMembershipLevel,
    priceId: normalizedPriceId,
  }
}

/**
 * Returns a safe Checkout projection while serializing membership attempts at
 * Stripe. Open Sessions are reused; terminal Sessions rotate the deterministic
 * user-scoped idempotency key; completed relevant subscriptions block until
 * webhook persistence catches up. If a concurrent different-price request
 * advances the latest Session during create recovery, one retry uses a key
 * anchored to that Session; no create path retries more than once. Retired
 * coupon inputs are rejected before reconciliation so reusable Sessions share
 * one discount-free Supporter contract.
 */
export async function createStripeCheckoutSession(options) {
  const configuredPrice = resolveCurrentStripeMembershipCheckoutPrice(
    options.priceId,
    options.env,
  )
  const membershipLevel = configuredPrice.membershipLevel
  if (normalizeMembershipLevel(options.membershipLevel) !== membershipLevel) {
    throw new Error("The selected membership Price does not match the requested membership level.")
  }
  if (membershipLevel !== "SUPPORTER") {
    throw new Error("Only Supporter membership Checkout is supported by the current catalog.")
  }
  if (options.couponId != null && String(options.couponId).trim()) {
    throw new Error("Membership coupons are not supported by the current Supporter catalog.")
  }
  const supporterTax = getSupporterRecurringTaxReadiness(options.env)
  if (!supporterTax.ready) {
    throw new Error("Supporter recurring tax readiness is not configured.")
  }
  const stripe = options.stripeClient ?? getStripeClient(options.apiKey)
  const session = {
    mode: "subscription",
    customer: options.customerId,
    client_reference_id: options.userId,
    // Current Supporter access is an electronically supplied service; the
    // readiness gate above requires Stripe Tax for this payload.
    automatic_tax: { enabled: true },
    billing_address_collection: "required",
    customer_update: { address: "auto" },
    success_url: options.successUrl,
    cancel_url: options.cancelUrl,
    line_items: [
      {
        price: configuredPrice.priceId,
        quantity: 1,
      },
    ],
    metadata: {
      purpose: MEMBERSHIP_CHECKOUT_PURPOSE,
      checkoutContractVersion: SUPPORTER_MEMBERSHIP_CHECKOUT_CONTRACT_VERSION,
      userId: options.userId,
      membershipLevel,
    },
    subscription_data: {
      metadata: {
        userId: options.userId,
        membershipLevel,
      },
    },
  }
  // Initial reconciliation and create recovery are one logical attempt, so
  // both must share the same absolute wall-clock deadline. The budget gates
  // starting each Stripe operation; an in-flight Session create is allowed to
  // finish because abandoning a request that Stripe may commit would turn a
  // successful Checkout into an ambiguous client failure.
  const reconciliationBudget =
    createMembershipCheckoutReconciliationBudget(options)

  const existing = await resolveExistingStripeMembershipCheckout(stripe, {
    customerId: options.customerId,
    env: options.env,
    nowSeconds: options.nowSeconds,
    priceId: configuredPrice.priceId,
    userId: options.userId,
  }, reconciliationBudget)
  if (existing.session) {
    return existing.session
  }

  const requestOptions = {
    idempotencyKey: membershipCheckoutIdempotencyKey(
      options.userId,
      existing.latestSessionId,
    ),
  }
  try {
    reconciliationBudget.assertWithinBudget(
      MEMBERSHIP_CHECKOUT_RECONCILIATION_LIMIT_ERROR,
    )
    return membershipCheckoutProjection(
      await stripe.checkout.sessions.create(session, requestOptions),
    )
  } catch (error) {
    if (
      stripeErrorStatus(error) === 429
      || stripeErrorType(error) === "StripeRateLimitError"
      || isStripeConnectionError(error)
    ) {
      throw error
    }

    let recovered
    try {
      recovered = await resolveExistingStripeMembershipCheckout(stripe, {
        customerId: options.customerId,
        env: options.env,
        nowSeconds: options.nowSeconds,
        priceId: configuredPrice.priceId,
        userId: options.userId,
      }, reconciliationBudget)
    } catch (recoveryError) {
      if (recoveryError instanceof Error) {
        recoveryError.cause ??= error
        throw recoveryError
      }
      throw new Error("Stripe membership Checkout reconciliation failed.", {
        cause: error,
      })
    }
    if (recovered.session) {
      return recovered.session
    }
    if (recovered.latestSessionId !== existing.latestSessionId) {
      try {
        reconciliationBudget.assertWithinBudget(
          MEMBERSHIP_CHECKOUT_RECONCILIATION_LIMIT_ERROR,
        )
        return membershipCheckoutProjection(
          await stripe.checkout.sessions.create(session, {
            idempotencyKey: membershipCheckoutIdempotencyKey(
              options.userId,
              recovered.latestSessionId,
            ),
          }),
        )
      } catch (retryError) {
        if (retryError instanceof Error) {
          if (retryError.cause === undefined) {
            retryError.cause = error
          }
          throw retryError
        }
        throw new Error("Stripe membership Checkout retry failed.", {
          cause: error,
        })
      }
    }
    throw error
  }
}

/**
 * @param {{
 *   amountCents: number
 *   currency?: string
 *   customerEmail?: string
 *   userId?: string
 *   successUrl: string
 *   cancelUrl: string
 *   apiKey?: string
 *   env?: Record<string, string | undefined>
 *   stripeClient?: {
 *     checkout: {
 *       sessions: {
 *         create: (payload: Record<string, unknown>) => Promise<unknown>
 *       }
 *     }
 *   }
 * }} input
 * @returns {Promise<{ url?: string | null } & Record<string, unknown>>}
 *
 * Production uses `process.env`; tests may inject `env` for deterministic
 * readiness checks. Checkout creation fails closed until all five independent
 * one-time-support tax gates are explicit.
 */
export async function createStripeDonationCheckoutSession({
  amountCents,
  currency = "usd",
  customerEmail = "",
  userId = "",
  successUrl,
  cancelUrl,
  apiKey,
  env = process.env,
  stripeClient,
} = {}) {
  const normalizedCurrency = String(currency).trim().toLowerCase()
  if (normalizedCurrency !== "usd") {
    throw new Error("One-time support is available in USD only.")
  }
  if (!Number.isInteger(amountCents) || amountCents < 100) {
    throw new Error("One-time support amount must be at least $1.00.")
  }

  // Checkout remains unavailable until every independent one-time-support tax
  // attestation is explicit; missing deployment configuration fails closed.
  const oneTimeSupportTax = getOneTimeSupportTaxReadiness(env)
  if (!oneTimeSupportTax.ready) {
    throw new Error("One-time support tax readiness is not configured.")
  }

  const stripe = stripeClient ?? getStripeClient(apiKey)
  const metadata = {
    purpose: DONATION_PURPOSE,
    ...(userId ? { userId } : {}),
  }
  const session = {
    mode: "payment",
    success_url: successUrl,
    cancel_url: cancelUrl,
    automatic_tax: { enabled: true },
    billing_address_collection: "required",
    line_items: [
      {
        price_data: {
          currency: normalizedCurrency,
          // Keep the fixed support amount as subtotal and calculate applicable
          // tax separately for clear customer-facing Checkout semantics.
          tax_behavior: "exclusive",
          product_data: {
            name: "MassageLab One-time support",
            description: "One-time support does not purchase goods or services, create a membership, or unlock features. It is not a charitable donation and is not tax-deductible.",
            tax_code: ONE_TIME_SUPPORT_TAX_CODE,
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
    metadata,
    payment_intent_data: {
      metadata,
    },
  }

  if (customerEmail) {
    session.customer_email = customerEmail
  }

  return stripe.checkout.sessions.create(session)
}

function explicitTrue(value) {
  return String(value ?? "").trim().toLowerCase() === "true"
}

function hasCurrentDigitalPurchaseConsent(value) {
  if (
    !value
    || typeof value !== "object"
    || value.combinedConsentAccepted !== true
    || !Array.isArray(value.documentIds)
    || !value.documentVersions
    || typeof value.documentVersions !== "object"
    || Array.isArray(value.documentVersions)
    || typeof value.acceptedAt !== "string"
    || !Number.isFinite(Date.parse(value.acceptedAt))
  ) {
    return false
  }

  const documents = requiredLegalDocumentsForEvent("digital-purchase")
  const expectedIds = documents.map((document) => legalDocumentAcceptanceId(document))
  return value.documentIds.length === expectedIds.length
    && expectedIds.every((documentId, index) => value.documentIds[index] === documentId)
    && documents.every((document) => value.documentVersions[document.key] === document.version)
    && Object.keys(value.documentVersions).length === documents.length
}

/**
 * One fail-closed gate shared by the background route and Stripe adapter.
 *
 * Paid background checkout requires Stripe Tax plus the kill switch, legal,
 * catalog, geography, webhook, and reconciliation signals.
 *
 * @param {{
 *   env?: NodeJS.ProcessEnv
 *   purchaseCountry?: string
 *   legalConsent?: unknown
 *   catalogReady?: boolean
 * }} input
 */
export function assertBackgroundCommercePurchasingReady({
  env = process.env,
  purchaseCountry,
  legalConsent,
  catalogReady,
} = {}) {
  const tax = getCommerceTaxReadiness(env)
  const purchaseCountries = String(env.BACKGROUND_COMMERCE_PURCHASE_COUNTRIES ?? "")
    .split(",")
    .map((country) => country.trim().toUpperCase())
    .filter(Boolean)
  const ready = explicitTrue(env.BACKGROUND_COMMERCE_PURCHASING_ENABLED)
    && String(env.BACKGROUND_COMMERCE_PRICE_CENTS ?? "").trim() === "100"
    && purchaseCountries.length === 1
    && purchaseCountries[0] === "US"
    && env.BACKGROUND_COMMERCE_DIGITAL_PURCHASE_DOCUMENT_VERSION === DIGITAL_PURCHASES_REFUNDS_VERSION
    && explicitTrue(env.BACKGROUND_COMMERCE_WEBHOOK_READY)
    && explicitTrue(env.BACKGROUND_COMMERCE_RECONCILIATION_READY)
    && Boolean(env.STRIPE_SECRET_KEY?.trim())
    && Boolean(env.STRIPE_WEBHOOK_SECRET?.trim())
    && purchaseCountry === "US"
    && catalogReady === true
    && tax.ready
    && hasCurrentDigitalPurchaseConsent(legalConsent)

  if (!ready) {
    throw new CommerceError({ code: COMMERCE_ERROR_CODES.TAX_NOT_READY })
  }

  return tax
}

function stripeErrorType(error) {
  return error && typeof error === "object" && typeof error.type === "string"
    ? error.type
    : ""
}

function stripeErrorStatus(error) {
  return error && typeof error === "object" && Number.isInteger(error.statusCode)
    ? error.statusCode
    : null
}

/**
 * Identifies outcomes where Stripe may have accepted Session creation even
 * though this process did not receive a conclusive response.
 */
export function isIndeterminateBackgroundCheckoutError(error) {
  const type = stripeErrorType(error)
  const status = stripeErrorStatus(error)
  return type === "StripeConnectionError"
    || type === "StripeAPIError"
    || type === "StripeIdempotencyError"
    || (status !== null && status >= 500)
}

function isStripeConnectionError(error) {
  return stripeErrorType(error) === "StripeConnectionError"
}

/**
 * Creates only one-time permanent-background Checkout Sessions.
 *
 * The immutable order snapshot is the price authority; line items cannot be
 * merged because each background must remain independently refundable later.
 */
export async function createBackgroundPurchaseCheckoutSession({
  orderId,
  userId,
  checkoutAttempt,
  customerId,
  items,
  legalConsent,
  purchaseCountry,
  successUrl,
  cancelUrl,
  now = () => new Date(),
  env = process.env,
  apiKey,
  stripeClient,
} = {}) {
  const distinctKeys = new Set()
  const validItems = Array.isArray(items)
    && items.length > 0
    && items.every((item) => {
      const valid = item?.productType === "background"
        && typeof item.productKey === "string"
        && item.productKey.length > 0
        && typeof item.displayName === "string"
        && item.displayName.length > 0
        && item.unitAmount === 100
        && item.quantity === 1
        && item.currency === "usd"
        && !distinctKeys.has(item.productKey)
      if (valid) distinctKeys.add(item.productKey)
      return valid
    })
  const tax = assertBackgroundCommercePurchasingReady({
    env,
    purchaseCountry,
    legalConsent,
    catalogReady: Boolean(validItems),
  })
  if (
    !orderId
    || !userId
    || !customerId
    || !Number.isInteger(checkoutAttempt)
    || checkoutAttempt < 1
    || !successUrl
    || !cancelUrl
  ) {
    throw new CommerceError({ code: COMMERCE_ERROR_CODES.TAX_NOT_READY })
  }

  const metadata = {
    purpose: BACKGROUND_PURCHASE_PURPOSE,
    orderId,
    userId,
    schemaVersion: BACKGROUND_PURCHASE_SCHEMA_VERSION,
    taxMode: "stripe",
    taxCode: tax.taxCode,
    taxBehavior: "exclusive",
  }
  const lineItems = items.map((item) => ({
    price_data: {
      currency: "usd",
      product_data: {
        name: item.displayName,
        metadata: {
          productType: item.productType,
          productKey: item.productKey,
          taxCode: tax.taxCode,
        },
        tax_code: tax.taxCode,
      },
      unit_amount: 100,
      tax_behavior: "exclusive",
    },
    quantity: 1,
  }))
  const stripe = stripeClient ?? getStripeClient(apiKey)
  const checkoutNow = typeof now === "function" ? now() : now
  const checkoutExpiresAt = Math.floor(checkoutNow.getTime() / 1000) + 30 * 60
  if (!Number.isFinite(checkoutExpiresAt)) {
    throw new CommerceError({ code: COMMERCE_ERROR_CODES.TAX_NOT_READY })
  }
  const payload = {
    mode: "payment",
    customer: customerId,
    billing_address_collection: "required",
    customer_update: { address: "auto" },
    success_url: successUrl,
    cancel_url: cancelUrl,
    // Sample the clock once immediately before the first create call, then reuse
    // this exact payload only for the immediate in-call connection retry.
    expires_at: checkoutExpiresAt,
    // Paid permanent-background access uses the catalog's confirmed digital
    // tax classification after the readiness gate above passes.
    automatic_tax: { enabled: true },
    line_items: lineItems,
    metadata,
    payment_intent_data: { metadata },
  }
  const requestOptions = {
    idempotencyKey: `background-purchase:${orderId}:attempt:${checkoutAttempt}`,
  }

  try {
    return await stripe.checkout.sessions.create(payload, requestOptions)
  } catch (error) {
    if (!isStripeConnectionError(error)) throw error
    // A connection error can occur after Stripe creates the Session. Reusing
    // both objects preserves the exact parameters and idempotency boundary.
    return stripe.checkout.sessions.create(payload, requestOptions)
  }
}

/**
 * Extracts processor-authoritative fulfillment evidence from a retrieved
 * Session. Browser country remains provisional and is never accepted here.
 */
export function getBackgroundPurchaseCheckoutSessionEvidence(session) {
  const status = safeString(session?.status)
  const paymentStatus = safeString(session?.payment_status)
  const rawCountry = safeString(session?.customer_details?.address?.country).toUpperCase()
  const paid = paymentStatus === "paid"
  const purchaseCountry = rawCountry === "US" ? "US" : null

  return {
    status,
    paymentStatus,
    purchaseCountry,
    paid,
    reviewRequired: paid && purchaseCountry !== "US",
  }
}

export async function retrieveBackgroundPurchaseCheckoutSession(
  sessionId,
  { apiKey, stripeClient } = {},
) {
  const stripe = stripeClient ?? getStripeClient(apiKey)
  return stripe.checkout.sessions.retrieve(sessionId)
}

/**
 * Retrieves the processor-owned fields required to reconcile an immutable order snapshot.
 *
 * This helper must be called before opening the commerce transaction.
 */
export async function retrieveBackgroundPurchaseCheckoutSessionForFulfillment(
  sessionId,
  { apiKey, stripeClient } = {},
) {
  const stripe = stripeClient ?? getStripeClient(apiKey)
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["payment_intent"],
  })
  const lineItems = []
  const seenCursors = new Set()
  let startingAfter

  for (
    let pageNumber = 0;
    pageNumber < MAX_BACKGROUND_CHECKOUT_LINE_ITEM_PAGES;
    pageNumber += 1
  ) {
    const lineItemList = await stripe.checkout.sessions.listLineItems(sessionId, {
      limit: 100,
      expand: ["data.price.product"],
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    })
    if (
      !Array.isArray(lineItemList?.data)
      || typeof lineItemList?.has_more !== "boolean"
    ) {
      throw new Error("Stripe returned an invalid Checkout line-item page.")
    }
    lineItems.push(...lineItemList.data)
    if (!lineItemList.has_more) {
      return {
        ...session,
        line_items: {
          ...lineItemList,
          data: lineItems,
          has_more: false,
        },
      }
    }

    const lastLineItemId = safeString(lineItemList.data.at(-1)?.id)
    if (!lastLineItemId || seenCursors.has(lastLineItemId)) {
      throw new Error("Stripe Checkout line-item pagination did not advance.")
    }
    seenCursors.add(lastLineItemId)
    startingAfter = lastLineItemId
  }

  throw new Error("Stripe Checkout line-item pagination exceeded the safe limit.")
}

export async function expireBackgroundPurchaseCheckoutSession(
  sessionId,
  { apiKey, stripeClient } = {},
) {
  const stripe = stripeClient ?? getStripeClient(apiKey)
  return stripe.checkout.sessions.expire(sessionId)
}

/**
 * Creates either the general Customer Portal homepage or Stripe's focused
 * subscription-price selection flow for one persisted subscription.
 *
 * @param {{
 *   customerId?: string,
 *   returnUrl?: string,
 *   subscriptionId?: string,
 *   apiKey?: string,
 *   stripeClient?: object,
 * }} [input]
 * @returns {Promise<import("stripe").BillingPortal.Session>} The created Stripe
 * Billing Portal session.
 */
export async function createStripeCustomerPortalSession({
  customerId,
  returnUrl,
  subscriptionId,
  apiKey,
  stripeClient,
} = {}) {
  const stripe = stripeClient ?? getStripeClient(apiKey)
  const payload = {
    customer: customerId,
    return_url: returnUrl,
  }

  if (subscriptionId) {
    // The caller must verify subscriptionId belongs to customerId; this focused
    // flow opens eligible subscription choices before returning to Portal home.
    payload.flow_data = {
      type: "subscription_update",
      subscription_update: {
        subscription: subscriptionId,
      },
      after_completion: {
        type: "portal_homepage",
      },
    }
  }

  return stripe.billingPortal.sessions.create(payload)
}

export async function retrieveStripeSubscription(subscriptionId, { apiKey, stripeClient } = {}) {
  if (!subscriptionId) {
    return null
  }

  const stripe = stripeClient ?? getStripeClient(apiKey)

  return stripe.subscriptions.retrieve(subscriptionId)
}

/**
 * Retrieves one public display Price while allowing the catalog owner to bound
 * this read through Stripe's supported per-request timeout and retry options.
 */
export async function retrieveStripePrice(
  priceId,
  { apiKey, stripeClient, requestOptions } = {},
) {
  if (!priceId) {
    return null
  }

  const stripe = stripeClient ?? getStripeClient(apiKey)

  return stripe.prices.retrieve(priceId, {}, requestOptions)
}

export async function ensureStripeCustomerForUser(prismaClient, user, apiKey = getStripeSecretKey(), stripeClient) {
  const stripe = stripeClient ?? getStripeClient(apiKey)
  const existing = await prismaClient.stripeCustomer.findUnique({
    where: { userId: user.id },
  })

  if (existing) {
    try {
      const customer = await stripe.customers.retrieve(existing.stripeCustomerId)
      if (!customer?.deleted) {
        return existing
      }
    } catch (error) {
      if (!isMissingStripeResourceError(error)) {
        throw error
      }
    }
    // A stored customer can become stale after switching Stripe modes; replace it
    // with a customer created in the active account before starting Checkout.
  }

  const customer = await createStripeCustomer({
    email: user.email,
    name: user.name,
    userId: user.id,
    idempotencyKey: stripeCustomerCreateIdempotencyKey(user.id, existing?.stripeCustomerId),
    stripeClient: stripe,
  })

  return prismaClient.stripeCustomer.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      stripeCustomerId: customer.id,
    },
    update: {
      stripeCustomerId: customer.id,
    },
  })
}

export function isDonationCheckoutSession(session) {
  return safeString(session?.metadata?.purpose) === DONATION_PURPOSE
}

/**
 * Keeps Checkout flows disjoint so an unknown explicit purpose can never fall
 * through to membership reconciliation.
 */
export function classifyStripeCheckoutSessionPurpose(session) {
  const purpose = safeString(session?.metadata?.purpose)
  if (purpose === BACKGROUND_PURCHASE_PURPOSE) return BACKGROUND_PURCHASE_PURPOSE
  if (purpose === DONATION_PURPOSE) return "donation"
  if (purpose === MEMBERSHIP_CHECKOUT_PURPOSE && session?.mode === "subscription") {
    return MEMBERSHIP_CHECKOUT_PURPOSE
  }
  if (purpose) return "unknown"
  return session?.mode === "payment" ? "unknown" : "membership"
}
