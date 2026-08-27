import Link from "next/link"

import { AppPageShell, AppSurface } from "@/components/ui/app-surface"

export default function AtmoShaperCandidatePage() {
  return (
    <AppPageShell width="full" contentClassName="gap-8 pb-24">
      <header className="space-y-3">
        <p className="text-sm font-medium text-primary">Local development · listening review</p>
        <h1 className="text-3xl font-semibold sm:text-4xl">AtmoShaper sound candidates</h1>
        <p className="max-w-4xl text-sm leading-6 text-muted-foreground">
          Recording review and concept construction now share one preserved local workspace. Work on either page,
          then export one complete handoff without changing the production player.
        </p>
      </header>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <ReviewLink
          href="/dev/candidates/recordings"
          title="Review recordings"
          description="Listen individually, preserve overall notes, and include or remove each recording for any existing or new concept."
        />
        <ReviewLink
          href="/dev/candidates/concepts"
          title="Review concepts"
          description="Tune dynamic playback, review exact ingredients, leave concept-specific notes, and approve what you heard."
        />
        <ReviewLink
          href="/dev/candidates/construction"
          title="Audition rebuilt construction"
          description="Hear repeat, timing, cadence, transition, and overlap fixes; record exact playback or complete-construction QA."
        />
        <ReviewLink
          href="/dev/candidates/processing"
          title="Review processed audio"
          description="Compare exact source and derived artifacts, then record checksum-bound processing QA."
        />
        <ReviewLink
          href="/dev/candidates/prepared"
          title="Prepared concepts"
          description="See every completed AtmoShaper handoff and the Moodist concepts that still need recordings."
        />
      </section>
      <AppSurface title="One shared review" description="Both review pages update the same browser-local draft." variant="inset">
        <p className="text-sm leading-6 text-muted-foreground">
          Your earlier recording and group work migrates automatically when either review page opens. Export the complete handoff from either page.
        </p>
      </AppSurface>
    </AppPageShell>
  )
}

function ReviewLink({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link className="rounded-2xl border bg-card p-5 transition-colors hover:border-primary" href={href}>
      <strong className="text-lg">{title}</strong>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </Link>
  )
}
