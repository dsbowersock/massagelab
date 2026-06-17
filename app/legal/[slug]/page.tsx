import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, FileText } from "lucide-react"
import {
  LEGAL_DOCUMENTS,
  getLegalDocumentBySlug,
} from "@/lib/legal-documents"
import { AppInset, AppPageShell, AppSurface } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"

export function generateStaticParams() {
  return LEGAL_DOCUMENTS.map((document) => ({ slug: document.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  try {
    const document = getLegalDocumentBySlug(slug)
    return {
      title: `${document.label} | MassageLab`,
      description: document.summary,
    }
  } catch {
    return {
      title: "Legal Document | MassageLab",
    }
  }
}

export default async function LegalDocumentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  let document

  try {
    document = getLegalDocumentBySlug(slug)
  } catch {
    notFound()
  }

  return (
    <AppPageShell width="prose" contentClassName="gap-5">
      <div>
        <Button asChild variant="ghost" className="px-0">
          <Link href="/legal">
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            Legal documents
          </Link>
        </Button>
      </div>

      <AppSurface
        title={document.label}
        description={document.summary}
        icon={<FileText className="h-5 w-5" aria-hidden="true" />}
        badge={document.effectiveDate}
        contentClassName="gap-6"
      >
        <AppInset className="grid gap-2 p-3 text-sm text-muted-foreground sm:grid-cols-2">
          <p>
            <span className="font-medium text-foreground">Version:</span> {document.version}
          </p>
          <p>
            <span className="font-medium text-foreground">Effective date:</span> {document.effectiveDate}
          </p>
        </AppInset>

        <div className="space-y-6">
          {document.sections.map((section) => (
            <section key={section.title} className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground">{section.title}</h2>
              <div className="space-y-3 text-sm leading-6 text-muted-foreground">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </AppSurface>
    </AppPageShell>
  )
}
