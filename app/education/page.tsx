import Link from "next/link"
import { Brain, Layers3, ShieldCheck } from "lucide-react"
import { AppPageShell, AppSurface } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { createPublicPageMetadata } from "@/lib/seo"

export const metadata = createPublicPageMetadata("/education")

export default function EducationPage() {
  return (
    <AppPageShell title="Education" contentClassName="gap-6">
      <div className="grid gap-4 md:grid-cols-2">
        <AppSurface
          icon={<Layers3 className="h-5 w-5" aria-hidden="true" />}
          title="Flashcards"
          description="Build a sourced anatomy deck and start a self-study session."
          badge="New"
        >
          <Button asChild className="w-full">
            <Link href="/education/flashcards">Open flashcards</Link>
          </Button>
        </AppSurface>
        <AppSurface
          icon={<Brain className="h-5 w-5" aria-hidden="true" />}
          title="Anatomime"
          description="Use the classroom anatomy game backed by the same reviewed study adapter."
        >
          <Button asChild variant="secondary" className="w-full">
            <Link href="/anatomime">Open Anatomime</Link>
          </Button>
        </AppSurface>
      </div>

      <AppSurface
        title="Source Boundary"
        description="Public education content is generated from reviewed foundation records backed by open-reuse or commercial-safe sources."
        icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
      />
    </AppPageShell>
  )
}
