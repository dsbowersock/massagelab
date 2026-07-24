import { NextResponse } from "next/server"
import { getCurrentSession } from "@/auth"
import { getSiteUrl } from "@/lib/auth-env"
import {
  hasSubscriptionBlockingNewCheckout,
  isPublicSupporterCheckoutSelection,
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
import { createMembershipCheckoutPostHandler } from "@/lib/membership-checkout"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

/**
 * Pins membership Checkout to the deployment's fail-closed recurring-tax
 * attestations instead of allowing request input to influence tax posture.
 */
const createConfiguredStripeCheckoutSession = (
  options: Parameters<typeof createStripeCheckoutSession>[0],
) => createStripeCheckoutSession({ ...options, env: process.env })

/** Uses production dependencies for the testable public membership Checkout handler. */
export const POST = createMembershipCheckoutPostHandler({
  NextResponse,
  getCurrentSession,
  getSiteUrl,
  isPublicSupporterCheckoutSelection,
  resolveStripePriceId,
  createStripeCheckoutSession: createConfiguredStripeCheckoutSession,
  ensureStripeCustomerForUser,
  acceptedDocumentIdsFromInput,
  hasAcceptedCurrentDocuments,
  legalRequestMetadata,
  missingRequiredLegalDocuments,
  recordLegalAcceptances,
  requiredLegalDocumentsForEvent,
  hasSubscriptionBlockingNewCheckout,
  prisma,
})
