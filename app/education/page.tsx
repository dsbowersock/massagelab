import { BookOpen, Brain, Layers3, ShieldCheck } from "lucide-react"
import { AppActionLink, AppInset, AppPageShell, AppSurface, appCalloutClassName } from "@/components/ui/app-surface"
import { getAnatomyStudyCards, getAnatomyStudyCategories, getAnatomyStudySources } from "@/lib/anatomy-study"
import { createPublicPageMetadata } from "@/lib/seo"

export const metadata = createPublicPageMetadata("/education")

export default function EducationPage() {
  const cards = getAnatomyStudyCards()
  const categories = getAnatomyStudyCategories()
  const sources = getAnatomyStudySources()

  return (
    <AppPageShell title="Education" contentClassName="gap-6">
      <AppSurface
        title="Education"
        description="Public-alpha study tools built from the reviewed sourced anatomy foundation."
        icon={<BookOpen className="h-5 w-5" aria-hidden="true" />}
        badge="Public alpha"
        className={appCalloutClassName}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <AppInset className="p-3">
            <p className="text-xs uppercase tracking-normal text-muted-foreground">Study Cards</p>
            <p className="mt-1 text-lg font-semibold">{cards.length}</p>
          </AppInset>
          <AppInset className="p-3">
            <p className="text-xs uppercase tracking-normal text-muted-foreground">Categories</p>
            <p className="mt-1 text-lg font-semibold">{categories.length}</p>
          </AppInset>
          <AppInset className="p-3">
            <p className="text-xs uppercase tracking-normal text-muted-foreground">Reusable Sources</p>
            <p className="mt-1 text-lg font-semibold">{sources.length}</p>
          </AppInset>
        </div>
      </AppSurface>

      <div className="grid gap-4 md:grid-cols-2">
        <AppActionLink
          href="/education/flashcards"
          icon={<Layers3 className="h-5 w-5" aria-hidden="true" />}
          title="Flashcards"
          description="Self-study anatomy cards with sourced summaries, aliases, categories, regions, and attribution."
          badge="New"
        />
        <AppActionLink
          href="/anatomime"
          icon={<Brain className="h-5 w-5" aria-hidden="true" />}
          title="Anatomime"
          description="Classroom game prompts now use the same sourced bone and muscle study adapter."
        />
      </div>

      <AppSurface
        title="Source Boundary"
        description="Public education content is generated from reviewed foundation records backed by open-reuse or commercial-safe sources."
        icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
      />
    </AppPageShell>
  )
}
