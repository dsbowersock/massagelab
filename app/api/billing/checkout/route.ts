import { NextResponse } from "next/server"
import { getCurrentSession } from "@/auth"
import { getSiteUrl } from "@/lib/auth-env"
import {
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

/** Uses production dependencies for the testable public membership Checkout handler. */
export const POST = createMembershipCheckoutPostHandler({
  NextResponse,
  getCurrentSession,
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
  prisma,
})
