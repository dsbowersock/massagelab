"use client"

import * as React from "react"
import { BookOpen, CalendarDays, CheckCircle2, GraduationCap, Sparkles, UserRound } from "lucide-react"

import { AppSurface } from "@/components/ui/app-surface"
import { Notice } from "@/components/ui/notice"
import { Progress } from "@/components/ui/progress"
import { SelectableCard } from "@/components/ui/selectable-card"
import { Skeleton } from "@/components/ui/skeleton"
import { LoaderGallery } from "./loader-gallery"
import { ReviewState, ReviewStateGrid } from "./review-state-grid"
import { WellnessRegionPreview } from "./wellness-region-preview"

export function CardStatusGallery() {
  const [selectedCard, setSelectedCard] = React.useState("booking")

  return (
    <div className="space-y-8">
      <section className="space-y-4" aria-labelledby="selectable-card-heading">
        <div>
          <h2 id="selectable-card-heading" className="text-2xl font-semibold">Selectable cards and control cards</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            Card-shaped choices keep card density and information hierarchy while sharing focus, selected, disabled, and tone mechanics.
          </p>
        </div>

        <ReviewStateGrid className="xl:grid-cols-2">
          <ReviewState label="Base">
            <SelectableCard
              title="Default control card"
              description="A card-shaped choice with shared interaction mechanics."
              icon={<Sparkles className="size-5" />}
              selected={selectedCard === "default"}
              onClick={() => setSelectedCard("default")}
            />
          </ReviewState>

          <ReviewState label="Selected">
            <SelectableCard
              title="Booking service choice"
              description="60-minute therapeutic massage"
              icon={<CalendarDays className="size-5" />}
              tone="orange"
              iconInset
              selected={selectedCard === "booking"}
              onClick={() => setSelectedCard("booking")}
            />
          </ReviewState>

          <ReviewState label="Disabled">
            <SelectableCard
              title="Unavailable provider"
              description="No openings in the selected window."
              icon={<UserRound className="size-5" />}
              disabled
            />
          </ReviewState>

          <ReviewState label="Compact">
            <SelectableCard
              title="Flashcard setup prompt"
              description="Name the highlighted structure."
              icon={<BookOpen className="size-5" />}
              density="compact"
              tone="quiet"
              selected={selectedCard === "flashcard"}
              onClick={() => setSelectedCard("flashcard")}
            />
          </ReviewState>

          <ReviewState label="Anatomime tone">
            <SelectableCard
              title="Massage anatomy"
              description="Foundational classroom prompt set."
              icon={<GraduationCap className="size-5" />}
              tone="anatomime"
              iconInset
              selected={selectedCard === "anatomime"}
              onClick={() => setSelectedCard("anatomime")}
            />
          </ReviewState>

          <ReviewState label="Quiet reviewed treatment">
            <SelectableCard
              title="Reviewed study adapter"
              description="Uses the same source set as flashcards."
              icon={<CheckCircle2 className="size-5" />}
              tone="quiet"
              selected={selectedCard === "reviewed"}
              onClick={() => setSelectedCard("reviewed")}
            />
          </ReviewState>
        </ReviewStateGrid>
      </section>

      <section className="space-y-4" aria-labelledby="notice-heading">
        <div>
          <h2 id="notice-heading" className="text-2xl font-semibold">Notices and status surfaces</h2>
          <p className="mt-1 text-sm text-muted-foreground">Status tone changes meaning without creating unrelated route banners.</p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <Notice tone="info" title="Information" description="Settings are saved in this browser." />
          <Notice tone="success" title="Success" description="Preferences synchronized." />
          <Notice tone="warning" title="Warning" description="Review this choice before continuing." />
          <Notice tone="error" title="Error" description="The change could not be saved." />
          <Notice tone="sync" title="Sync conflict" description="Choose which version to keep." />
          <Notice tone="loading" title="Loading" description="Preparing the review surface." />
          <Notice tone="empty" title="Empty state" description="No reviewed items match these filters." />
        </div>
      </section>

      <AppSurface title="Wellness anatomical map" description="Deferred review prototype. It is excluded from the production design rollout until its anatomy and region geometry receive separate approval.">
        <WellnessRegionPreview />
      </AppSurface>

      <section className="space-y-4" aria-labelledby="progress-heading">
        <div>
          <h2 id="progress-heading" className="text-2xl font-semibold">Loaders, progress, and skeletons</h2>
          <p className="mt-1 text-sm text-muted-foreground">Choose the loading treatment that communicates the most useful amount of progress.</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <AppSurface title="Determinate progress" description="Use when a meaningful completion value exists.">
            <div className="grid gap-4">
              <div className="grid gap-2 text-sm font-medium">
                Import progress
                <Progress value={64} aria-label="Import progress: 64 percent" />
                <span className="text-xs text-muted-foreground">64% complete</span>
              </div>
              <div className="grid gap-2 text-sm font-medium">
                Complete
                <Progress value={100} aria-label="Complete: 100 percent" />
              </div>
            </div>
          </AppSurface>

          <AppSurface title="Skeletons" description="Use when the incoming content layout is known.">
            <div className="grid gap-3">
              <div className="flex items-center gap-3">
                <Skeleton className="size-12 rounded-full" />
                <div className="grid flex-1 gap-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-9 w-28" />
            </div>
          </AppSurface>
        </div>
      </section>

      <LoaderGallery />
    </div>
  )
}
