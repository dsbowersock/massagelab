import { NextResponse } from "next/server"
import { getCurrentSession } from "@/auth"
import { getSiteUrl } from "@/lib/auth-env"
import {
  getCheckoutDiscountCouponId,
  isEarlyAccessDiscountEnabled,
  isPaidMembershipLevel,
  isStudentTherapistUpgradeEligible,
  resolveStripePriceId,
} from "@/lib/membership"
import {
  createStripeCheckoutSession,
  ensureStripeCustomerForUser,
} from "@/lib/stripe-billing"
import {
  acceptedDocumentIdsFromInput,
  hasAcceptedCurrentDocuments,
  legalRequestMetadata,
  missingRequiredLegalDocuments,
  recordLegalAcceptances,
} from "@/lib/legal-acceptance"
import { requiredLegalDocumentsForEvent } from "@/lib/legal-documents"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

async function checkoutRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? ""

  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const formData = await request.formData()
    return {
      isForm: true,
      membershipLevel: String(formData.get("membershipLevel") ?? "").toUpperCase(),
      interval: String(formData.get("interval") ?? "month"),
      acceptedLegalDocuments: formData.getAll("acceptedLegalDocuments"),
      billingTermsAccepted: formData.get("billingTermsAccepted") === "true",
    }
  }

  const body = await request.json().catch(() => ({}))
  return {
    isForm: false,
    membershipLevel: String(body.membershipLevel ?? "").toUpperCase(),
    interval: String(body.interval ?? "month"),
    acceptedLegalDocuments: body.acceptedLegalDocuments,
    billingTermsAccepted: body.billingTermsAccepted === true,
  }
}

function accountRedirect(code: string) {
  return NextResponse.redirect(`${getSiteUrl()}/account?billing=${encodeURIComponent(code)}`, 303)
}

export async function POST(request: Request) {
  const input = await checkoutRequest(request)
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    return input.isForm
      ? NextResponse.redirect(`${getSiteUrl()}/login`, 303)
      : NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!isPaidMembershipLevel(input.membershipLevel)) {
    return input.isForm
      ? accountRedirect("unsupported-plan")
      : NextResponse.json({ error: "Unsupported membership level" }, { status: 400 })
  }

  const priceId = resolveStripePriceId({
    membershipLevel: input.membershipLevel,
    interval: input.interval,
  })

  if (!priceId) {
    return input.isForm
      ? accountRedirect("price-not-configured")
      : NextResponse.json({ error: "Stripe price is not configured" }, { status: 400 })
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

  try {
    if (!alreadyAccepted) {
      await recordLegalAcceptances({
        prismaClient: prisma,
        userId: user.id,
        documents: requiredDocuments,
        metadata: legalRequestMetadata(request),
      })
    }

    const [customer, studentAccess] = await Promise.all([
      ensureStripeCustomerForUser(prisma, user),
      prisma.studentAccess.findUnique({ where: { userId: user.id } }),
    ])
    const couponId = getCheckoutDiscountCouponId({
      membershipLevel: input.membershipLevel,
      isStudentTherapistUpgrade:
        input.membershipLevel === "THERAPIST" && isStudentTherapistUpgradeEligible(studentAccess),
      earlyAccessEnabled: isEarlyAccessDiscountEnabled(),
    })
    const checkoutSession = await createStripeCheckoutSession({
      customerId: customer.stripeCustomerId,
      priceId,
      userId: user.id,
      membershipLevel: input.membershipLevel,
      successUrl: `${getSiteUrl()}/account?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${getSiteUrl()}/account?checkout=cancelled`,
      couponId,
    })

    if (!checkoutSession.url) {
      throw new Error("Stripe did not return a Checkout URL.")
    }

    return input.isForm
      ? NextResponse.redirect(checkoutSession.url, 303)
      : NextResponse.json({ url: checkoutSession.url })
  } catch (error) {
    console.error("Unable to start membership checkout", error)
    return input.isForm
      ? accountRedirect("checkout-error")
      : NextResponse.json({ error: "Unable to start checkout." }, { status: 500 })
  }
}
