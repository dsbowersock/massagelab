import Link from "next/link"
import { Mail, Map, ShieldCheck } from "lucide-react"
import { getCurrentSession } from "@/auth"
import { prisma } from "@/lib/prisma"
import { AppPageShell, AppSurface, appCalloutClassName } from "@/components/ui/app-surface"
import { SocialLinksSurface } from "@/components/social-links"
import { normalizeLinkedSentryEventId } from "@/lib/problem-report"
import { SupportContactForm } from "@/app/support/support-contact-form"
import { SupportDiagnosticReport } from "@/app/support/support-diagnostic-report"
import { createPublicPageMetadata } from "@/lib/seo"
import {
  PURCHASE_SUPPORT_TOPIC,
  normalizeSupportOrderReference,
} from "@/lib/support-contact"

export const metadata = createPublicPageMetadata("/support")

async function getSupportDefaults() {
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    return {
      name: "",
      contact: "",
    }
  }

  const profile = await prisma.userProfile.findUnique({
    where: { userId: session.user.id },
    select: { displayName: true, therapistName: true },
  }).catch(() => null)

  return {
    name: profile?.displayName || profile?.therapistName || session.user.name || "",
    contact: session.user.email || "",
  }
}

type SupportPageProps = {
  searchParams?: Promise<{
    eventId?: string
    topic?: string
    orderReference?: string
  }>
}

export default async function SupportPage({ searchParams }: SupportPageProps) {
  const defaults = await getSupportDefaults()
  const params = await searchParams
  const linkedEventId = normalizeLinkedSentryEventId(params?.eventId) ?? ""
  // Include an order reference only for explicit background-checkout support
  // links; general support topics cannot attach purchase context.
  const purchaseSupport = params?.topic === "purchase-background-access"
  const orderReference = purchaseSupport
    ? normalizeSupportOrderReference(params?.orderReference)
    : ""

  return (
    <AppPageShell title="User Support" width="standard">
        <AppSurface
          title="Get help with MassageLab"
          description={
            <>
                Send a support request to contactmassagelab@gmail.com. Please avoid sending client PHI or sensitive clinical details.
            </>
          }
          icon={<Mail className="h-5 w-5" aria-hidden="true" />}
        />

        <SupportContactForm
          initialName={defaults.name}
          initialContact={defaults.contact}
          initialTopic={purchaseSupport ? PURCHASE_SUPPORT_TOPIC : ""}
          orderReference={orderReference}
        />

        <SupportDiagnosticReport linkedEventId={linkedEventId} />

        <SocialLinksSurface
          title="Social updates"
          description="Follow MassageLab for public updates and videos outside the support inbox."
        />

        <div className="grid gap-4 md:grid-cols-3">
          <Link href="/roadmap">
            <AppSurface
              title="Roadmap"
              description="See planned product work, compliance milestones, and funding-dependent features."
              icon={<Map className="h-5 w-5" aria-hidden="true" />}
              className="h-full transition-colors hover:bg-accent"
            />
          </Link>

          <Link href="/legal">
            <AppSurface
              title="Legal and trust documents"
              description="Read MassageLab's current terms, privacy, billing, cookie, and local-first health data notices."
              icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
              className="h-full transition-colors hover:bg-accent"
            />
          </Link>

          <AppSurface
            title="Privacy note"
            description={
              <>
                Support messages are sent through your email client. MassageLab does not upload this form content from the browser.
              </>
            }
            icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
            className={appCalloutClassName}
          />
        </div>
    </AppPageShell>
  )
}
