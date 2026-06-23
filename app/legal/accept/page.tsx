import Link from "next/link"
import { redirect } from "next/navigation"
import { ShieldCheck } from "lucide-react"
import { getCurrentSession } from "@/auth"
import { hasAcceptedCurrentDocuments } from "@/lib/legal-acceptance"
import {
  buildRegistrationLegalAcceptancePath,
  safePostLegalAcceptanceCallback,
} from "@/lib/legal-acceptance-gate"
import { legalDocumentAcceptanceId, requiredLegalDocumentsForEvent } from "@/lib/legal-documents"
import { prisma } from "@/lib/prisma"
import { createNoindexPageMetadata } from "@/lib/seo"
import { acceptRegistrationLegalDocumentsAction } from "./actions"
import { AppInset, AppPageShell, AppSurface } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"

export const dynamic = "force-dynamic"

export const metadata = createNoindexPageMetadata({
  title: "Review Account Terms | MassageLab",
  description: "Accept current MassageLab Terms and Privacy before continuing after account sign-in.",
})

export default async function RegistrationLegalAcceptancePage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; legal?: string }>
}) {
  const params = await searchParams
  const callbackUrl = safePostLegalAcceptanceCallback(params.callbackUrl)
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(buildRegistrationLegalAcceptancePath(callbackUrl))}`)
  }

  const documents = requiredLegalDocumentsForEvent("registration")
  const alreadyAccepted = await hasAcceptedCurrentDocuments({
    prismaClient: prisma,
    userId: session.user.id,
    documents,
  })

  if (alreadyAccepted) {
    redirect(callbackUrl)
  }

  const showMissingMessage = params.legal === "registration-required"

  return (
    <AppPageShell title="Review Account Terms" width="narrow">
      <AppSurface
        title="Review MassageLab account terms"
        description="Before continuing, acknowledge the current Terms and Privacy Policy for this account."
        icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
        contentClassName="gap-5"
      >
        {showMissingMessage ? (
          <AppInset className="p-3 text-sm text-muted-foreground">
            Accept the Terms and Privacy Policy before continuing.
          </AppInset>
        ) : null}

        <form action={acceptRegistrationLegalDocumentsAction} className="space-y-4">
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <div className="space-y-3">
            {documents.map((document) => (
              <label key={document.key} className="flex gap-3 rounded-md border border-border/80 bg-background/70 p-3 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  className="mt-1"
                  name="acceptedLegalDocuments"
                  value={legalDocumentAcceptanceId(document)}
                  required
                />
                <span>
                  I agree to the{" "}
                  <Link href={document.route} className="text-brand-orange underline-offset-4 hover:underline">
                    {document.label}
                  </Link>
                  .
                </span>
              </label>
            ))}
          </div>
          <Button type="submit" className="w-full bg-primary hover:bg-brand-orange-glow">
            Agree and continue
          </Button>
        </form>
      </AppSurface>
    </AppPageShell>
  )
}
