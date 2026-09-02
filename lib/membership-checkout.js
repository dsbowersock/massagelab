import { safeErrorCode } from "./safe-error-code.js"
import {
  isBrowserFormRequest,
  isTrustedCheckoutFormOrigin,
} from "./trusted-form-origin.js"
import { SUPPORTER_CHECKOUT_PAUSED_MESSAGE } from "./public-launch-controls.js"

/**
 * Builds the public membership Checkout POST handler from explicit runtime
 * dependencies. Dependency injection keeps rejection paths testable without
 * invoking Stripe or production persistence.
 */
export function createMembershipCheckoutPostHandler({
  NextResponse,
  getCurrentSession,
  getPublicLaunchControls,
  getSiteUrl,
  isPublicSupporterCheckoutSelection,
  resolveStripePriceId,
  createStripeCheckoutSession,
  ensureStripeCustomerForUser,
  acceptedDocumentIdsFromInput,
  hasAcceptedCurrentDocuments,
  legalRequestMetadata,
  missingRequiredLegalDocuments,
  recordLegalAcceptances,
  requiredLegalDocumentsForEvent,
  hasSubscriptionBlockingNewCheckout,
  prisma,
}) {
  const accountRedirect = (code) => NextResponse.redirect(
    `${getSiteUrl()}/account?billing=${encodeURIComponent(code)}`,
    303,
  )
  const existingSubscriptionResponse = (isForm) => (
    isForm
      ? accountRedirect("existing-subscription")
      : NextResponse.json(
          { error: "Manage your existing subscription in the Customer Portal." },
          { status: 409 },
        )
  )

  return async function POST(request) {
    let input = emptyCheckoutRequestInput()

    try {
      const isForm = isBrowserFormRequest(request)
      input = emptyCheckoutRequestInput(isForm)

      if (!isTrustedCheckoutFormOrigin(request, getSiteUrl())) {
        return isForm
          ? accountRedirect("invalid-request")
          : NextResponse.json({ error: "Invalid request origin" }, { status: 403 })
      }

      input = await checkoutRequest(request, isForm)

      const session = await getCurrentSession()

      if (!session?.user?.id) {
        return input.isForm
          ? NextResponse.redirect(`${getSiteUrl()}/login`, 303)
          : NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      // Authenticate first, then fail closed before plan selection, legal,
      // customer, database, or Stripe work can spend resources while paused.
      if (!getPublicLaunchControls().supporterCheckoutOpen) {
        return input.isForm
          ? accountRedirect("checkout-paused")
          : NextResponse.json({ error: SUPPORTER_CHECKOUT_PAUSED_MESSAGE }, { status: 503 })
      }

      if (!isPublicSupporterCheckoutSelection(input)) {
        return input.isForm
          ? accountRedirect("unsupported-plan")
          : NextResponse.json({ error: "Unsupported membership level" }, { status: 400 })
      }

      const priceId = resolveStripePriceId({
        membershipLevel: input.membershipLevel,
        supporterAmountChoiceId: input.supporterAmountChoiceId,
        interval: input.interval,
      })

      if (!priceId) {
        return input.isForm
          ? accountRedirect("price-not-configured")
          : NextResponse.json({ error: "Stripe price is not configured" }, { status: 400 })
      }

      const existingSubscriptions = await prisma.membershipSubscription.findMany({
        where: { userId: session.user.id },
        select: {
          status: true,
          cancelAtPeriodEnd: true,
          membershipLevel: true,
        },
      })

      if (hasSubscriptionBlockingNewCheckout(existingSubscriptions)) {
        return existingSubscriptionResponse(input.isForm)
      }

      const requiredDocuments = requiredLegalDocumentsForEvent("checkout")
      const acceptedDocumentIds = acceptedDocumentIdsFromInput(
        input.billingTermsAccepted ? input.acceptedLegalDocuments : [],
      )
      const alreadyAccepted = await hasAcceptedCurrentDocuments({
        prismaClient: prisma,
        userId: session.user.id,
        documents: requiredDocuments,
      })
      const missingLegalDocuments = alreadyAccepted ? [] : missingRequiredLegalDocuments({
        acceptedDocumentIds,
        documents: requiredDocuments,
      })

      if (missingLegalDocuments.length > 0) {
        return input.isForm
          ? accountRedirect("billing-terms-required")
          : NextResponse.json({ error: "Accept the membership billing and refund terms before checkout." }, { status: 400 })
      }

      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, email: true, name: true },
      })

      if (!user) {
        return input.isForm
          ? accountRedirect("account-not-found")
          : NextResponse.json({ error: "Account not found" }, { status: 404 })
      }

      if (!alreadyAccepted) {
        await recordLegalAcceptances({
          prismaClient: prisma,
          userId: user.id,
          documents: requiredDocuments,
          metadata: legalRequestMetadata(request),
        })
      }

      const customer = await ensureStripeCustomerForUser(prisma, user)
      const checkoutSession = await createStripeCheckoutSession({
        customerId: customer.stripeCustomerId,
        priceId,
        userId: user.id,
        membershipLevel: input.membershipLevel,
        successUrl: `${getSiteUrl()}/account?tab=membership&checkout=success`,
        cancelUrl: `${getSiteUrl()}/account?tab=membership&checkout=cancelled`,
      })

      if (checkoutSession.status === "complete") {
        return existingSubscriptionResponse(input.isForm)
      }

      if (!checkoutSession.url) {
        throw new Error("Stripe did not return a Checkout URL.")
      }

      return input.isForm
        ? NextResponse.redirect(checkoutSession.url, 303)
        : NextResponse.json({ url: checkoutSession.url })
    } catch (error) {
      console.error("Unable to start membership checkout", {
        code: safeErrorCode(error),
      })
      return input.isForm
        ? accountRedirect("checkout-error")
        : NextResponse.json({ error: "Unable to start checkout." }, { status: 500 })
    }
  }
}

/**
 * Supplies response-safe defaults before request parsing completes. In
 * particular, detecting a form request before awaiting its body preserves form
 * redirects if parsing or normalization throws.
 * @param {boolean} [isForm]
 */
function emptyCheckoutRequestInput(isForm = false) {
  return {
    isForm,
    membershipLevel: "",
    supporterAmountChoiceId: "",
    interval: "month",
    acceptedLegalDocuments: isForm ? [] : undefined,
    billingTermsAccepted: false,
  }
}

/**
 * Parses a Checkout Request as form data or JSON from its content type.
 * Membership levels are upper-cased and missing intervals default to monthly.
 * @param {Request} request
 * @param {boolean} [isForm]
 * @returns {Promise<{
 *   isForm: boolean,
 *   membershipLevel: string,
 *   supporterAmountChoiceId: string,
 *   interval: string,
 *   acceptedLegalDocuments: unknown,
 *   billingTermsAccepted: boolean,
 * }>}
 */
async function checkoutRequest(request, isForm = isBrowserFormRequest(request)) {
  if (isForm) {
    let formData
    try {
      formData = await request.formData()
    } catch {
      // Retain form response semantics while an empty selection fails safely
      // through the existing unsupported-plan redirect before billing work.
      return emptyCheckoutRequestInput(true)
    }
    return {
      isForm: true,
      membershipLevel: String(formData.get("membershipLevel") ?? "").toUpperCase(),
      supporterAmountChoiceId: String(formData.get("supporterAmountChoiceId") ?? ""),
      interval: String(formData.get("interval") ?? "month"),
      acceptedLegalDocuments: formData.getAll("acceptedLegalDocuments"),
      billingTermsAccepted: formData.get("billingTermsAccepted") === "true",
    }
  }

  const parsedBody = await request.json().catch(() => null)
  const body = parsedBody
    && typeof parsedBody === "object"
    && !Array.isArray(parsedBody)
      ? parsedBody
      : {}
  return {
    isForm: false,
    membershipLevel: String(body.membershipLevel ?? "").toUpperCase(),
    supporterAmountChoiceId: String(body.supporterAmountChoiceId ?? ""),
    interval: String(body.interval ?? "month"),
    acceptedLegalDocuments: body.acceptedLegalDocuments,
    billingTermsAccepted: body.billingTermsAccepted === true,
  }
}
