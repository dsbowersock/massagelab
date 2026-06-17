import Link from "next/link"
import { FileText, ShieldCheck } from "lucide-react"
import {
  LEGAL_BUSINESS_IDENTITY,
  LEGAL_DOCUMENTS,
  LEGAL_DOCUMENT_VERSION,
} from "@/lib/legal-documents"
import { AppActionLink, AppInset, AppPageShell, AppSurface } from "@/components/ui/app-surface"

export const metadata = {
  title: "Legal | MassageLab",
  description: "MassageLab legal and trust documents.",
}

export default function LegalIndexPage() {
  return (
    <AppPageShell width="standard" contentClassName="gap-5">
      <AppSurface
        title="Legal and trust documents"
        description={`${LEGAL_BUSINESS_IDENTITY}. Current document version ${LEGAL_DOCUMENT_VERSION}.`}
        icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
      >
        <div className="grid gap-3">
          {LEGAL_DOCUMENTS.map((document) => (
            <AppActionLink
              key={document.key}
              href={document.route}
              icon={<FileText className="h-4 w-4" aria-hidden="true" />}
              title={document.label}
              description={document.summary}
              badge={document.effectiveDate}
            />
          ))}
        </div>
        <AppInset className="p-3 text-sm text-muted-foreground">
          MassageLab is in private alpha. These documents describe the current product posture and should be reviewed by a licensed attorney before broader public reliance.
        </AppInset>
      </AppSurface>

      <div className="text-sm text-muted-foreground">
        Need help? <Link href="/support" className="text-brand-orange underline-offset-4 hover:underline">Contact support</Link>.
      </div>
    </AppPageShell>
  )
}
