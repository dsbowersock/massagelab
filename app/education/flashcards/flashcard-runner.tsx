"use client"

import type { RefObject } from "react"
import Link from "next/link"
import { ArrowLeft, ArrowRight, CheckCircle2, ExternalLink, Flag, Lock, Sparkles, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import type {
  AnatomyStudyDifficulty,
  FlashcardPrompt,
  FlashcardPromptType,
} from "@/lib/anatomy-study"

export type PromptResult = {
  promptId: string
  correct: boolean
  score: number
}

export type ActiveDeckKind = "temporary" | "starter" | "community"

const activeDeckKindLabels: Record<ActiveDeckKind, string> = {
  temporary: "Temporary Deck",
  starter: "Starter Deck",
  community: "Community Deck",
}

export const difficultyLabels: Record<AnatomyStudyDifficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
}

function promptFrontInstruction(prompt: FlashcardPrompt, isReviewMode: boolean) {
  const reviewInstructions: Record<FlashcardPromptType, string> = {
    anatomime_name_recall: "Recall the anatomy item name.",
    identify_from_media: "Identify the anatomy item.",
    name_to_summary: "Recall the key facts for this anatomy item.",
    name_to_region: "Recall where this anatomy item is located.",
    name_to_category: "Recall what kind of anatomy item this is.",
    muscle_origin_insertion: "Recall the origin and insertion.",
    muscle_action: "Recall the action.",
    muscle_innervation: "Recall the innervation.",
  }
  const typedInstructions: Record<FlashcardPromptType, string> = {
    anatomime_name_recall: "Enter the anatomy item name.",
    identify_from_media: "Enter the anatomy item name.",
    name_to_summary: "Enter the key facts for this anatomy item.",
    name_to_region: "Enter where this anatomy item is located.",
    name_to_category: "Enter what kind of anatomy item this is.",
    muscle_origin_insertion: "Enter the origin and insertion.",
    muscle_action: "Enter the muscle action.",
    muscle_innervation: "Enter the innervation.",
  }

  return isReviewMode ? reviewInstructions[prompt.type] : typedInstructions[prompt.type]
}

function isEmbeddedInteractiveTarget(target: EventTarget | null) {
  const element = target instanceof HTMLElement ? target : null
  // Keep links, buttons, and form controls usable inside the card without also flipping it.
  return Boolean(element?.closest("a,button,input,select,textarea"))
}

export function PromptSourceLinks({ prompt }: { prompt: FlashcardPrompt }) {
  return (
    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
      {prompt.sources.map((source) => (
        source.url ? (
          <a key={source.id} href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-border/80 px-2 py-1 transition hover:text-foreground">
            {source.label}
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        ) : <span key={source.id} className="rounded-md border border-border/80 px-2 py-1">{source.label}</span>
      ))}
    </div>
  )
}

export function PromptBadges({ prompt }: { prompt: FlashcardPrompt }) {
  return (
    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
      <Badge variant="outline">{prompt.typeLabel}</Badge>
      <Badge variant="outline">{prompt.categoryLabel}</Badge>
      {prompt.regionLabels.map((label) => <Badge key={label} variant="outline">{label}</Badge>)}
      <Badge variant="outline">{difficultyLabels[prompt.difficulty]}</Badge>
    </div>
  )
}

export function PromptFront({ prompt, isReviewMode }: { prompt: FlashcardPrompt; isReviewMode: boolean }) {
  return (
    <div className="mx-0 grid h-full grid-rows-[auto_minmax(0,1fr)_auto] rounded-lg bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.12),transparent_34%),linear-gradient(145deg,hsl(var(--card)),hsl(var(--background)))] px-3 py-2 sm:mx-2 sm:px-4 sm:py-3">
      <div className="grid shrink-0 gap-y-1">
        <div className="flex items-center justify-between gap-3 text-xs font-medium uppercase text-muted-foreground">
          <span>Front</span>
          <span className="max-w-[62%] truncate rounded-full border border-border/80 bg-background/70 px-2 py-1 normal-case text-foreground">{prompt.typeLabel}</span>
        </div>
        <p className="line-clamp-2 text-xs leading-snug text-muted-foreground sm:text-sm">{promptFrontInstruction(prompt, isReviewMode)}</p>
      </div>

      <div className="mt-1 flex min-h-0 items-center justify-center sm:mt-2">
        {prompt.front.mode === "media" && prompt.front.media ? (
          <figure className="flex h-full w-full flex-col overflow-hidden rounded-none border border-border/80 bg-background/80 shadow-inner">
            <div className="flex min-h-0 flex-1 items-center justify-center p-2 sm:p-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- reviewed source media can come from multiple external hosts not configured for next/image. */}
              <img src={prompt.front.media.url} alt={prompt.front.media.title || `${prompt.name} anatomical view`} className="max-h-full max-w-full object-contain drop-shadow-sm" loading="lazy" referrerPolicy="no-referrer" />
            </div>
            <figcaption className="border-t border-border/80 px-3 py-1.5 text-xs text-muted-foreground">Reviewed BodyParts3D anatomy image</figcaption>
          </figure>
        ) : (
          <div className="grid max-h-full min-h-0 w-full place-items-center overflow-hidden rounded-none border border-border/80 bg-background/65 px-2 py-2 shadow-inner sm:px-3 sm:py-3 md:px-8 md:py-8">
            <h2 className="max-w-3xl break-words text-center text-lg font-semibold leading-tight tracking-normal min-[360px]:text-xl md:text-4xl">{prompt.front.title}</h2>
          </div>
        )}
      </div>

      <div className="mt-1 flex shrink-0 items-center justify-between gap-3 border-t border-border/70 pt-1 text-[11px] leading-tight text-muted-foreground sm:mt-3 sm:text-xs">
        <span>{isReviewMode ? "Tap the card or use Reveal Answer." : "Typed Check counts toward saved progress."}</span>
        <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      </div>
    </div>
  )
}

export function PromptBack({ prompt, result }: { prompt: FlashcardPrompt; result: PromptResult | null }) {
  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto rounded-lg bg-[radial-gradient(circle_at_bottom_right,hsl(var(--primary)/0.10),transparent_38%),linear-gradient(145deg,hsl(var(--background)),hsl(var(--card)))] p-4 sm:p-5">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 text-xs font-medium uppercase text-muted-foreground">
          <span>Sourced Answer</span>
          {result ? (
            <span className={cn("inline-flex items-center gap-1", result.correct ? "text-emerald-500" : "text-destructive")}>
              {result.correct ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : <XCircle className="h-3.5 w-3.5" aria-hidden="true" />}
              {result.correct ? "Correct" : "Review"}
            </span>
          ) : null}
        </div>
        <h2 className="break-words text-2xl font-semibold tracking-normal sm:text-4xl">{prompt.name}</h2>
        {prompt.aliases.length > 0 ? (
          <p className="text-sm text-muted-foreground">Also: {prompt.aliases.slice(0, 6).join(", ")}</p>
        ) : null}
      </div>

      <div className="grid gap-3">
        {prompt.answerFields.map((field) => (
          <div key={field.id} className="rounded-none border border-border/80 bg-background/75 p-4 shadow-inner">
            <div className="text-xs font-medium uppercase text-muted-foreground">{field.label}</div>
            <p className="mt-2 whitespace-pre-wrap break-words text-base leading-7 text-foreground">{field.answer}</p>
          </div>
        ))}
      </div>

      <div className="mt-auto space-y-2 border-t border-border/70 pt-3">
        <PromptBadges prompt={prompt} />
        <PromptSourceLinks prompt={prompt} />
      </div>
    </div>
  )
}

export function FlashcardSurface({
  prompt,
  isFlipped,
  isReviewMode,
  onFlip,
  result,
}: {
  prompt: FlashcardPrompt
  isFlipped: boolean
  isReviewMode: boolean
  onFlip: () => void
  result: PromptResult | null
}) {
  const canFlipCard = isReviewMode
  const shouldRenderBack = isFlipped || Boolean(result)

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="relative h-[clamp(11.5rem,calc(100dvh-17.5rem),30rem)] min-h-[11.5rem] [perspective:1800px] sm:h-[clamp(13rem,calc(100dvh-18rem),30rem)] sm:min-h-[13rem]">
        <div
          role={canFlipCard ? "button" : undefined}
          tabIndex={canFlipCard ? 0 : undefined}
          aria-label={canFlipCard ? (isFlipped ? "Flip flashcard to prompt" : "Flip flashcard to answer") : undefined}
          onClick={canFlipCard ? (event) => {
            if (isEmbeddedInteractiveTarget(event.target)) return
            onFlip()
          } : undefined}
          onKeyDown={(event) => {
            if (!canFlipCard) return
            if (isEmbeddedInteractiveTarget(event.target)) return
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault()
              onFlip()
            }
          }}
          className={cn(
            "absolute inset-0 rounded-none transition-transform duration-500 [transform-style:preserve-3d] motion-reduce:transition-none",
            isFlipped && "[transform:rotateY(180deg)]",
            canFlipCard && "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <article className="absolute inset-0 overflow-hidden border-0 p-1 shadow-[0_28px_90px_rgba(0,0,0,0.34),0_2px_0_hsl(var(--border))] ring-1 ring-white/5 [backface-visibility:hidden] sm:p-2">
            <PromptFront prompt={prompt} isReviewMode={isReviewMode} />
          </article>
          <article
            aria-hidden={!isFlipped}
            inert={!isFlipped ? true : undefined}
            tabIndex={isFlipped ? undefined : -1}
            className="absolute inset-0 overflow-hidden border-0 p-1 shadow-[0_28px_90px_rgba(0,0,0,0.34),0_2px_0_hsl(var(--primary)/0.35)] ring-1 ring-primary/15 [backface-visibility:hidden] [transform:rotateY(180deg)] sm:p-2"
          >
            {shouldRenderBack ? <PromptBack prompt={prompt} result={result} /> : null}
          </article>
        </div>
      </div>
    </div>
  )
}

export function FlashcardRunner({
  runnerTopRef,
  currentPrompt,
  currentIndex,
  deckLength,
  answeredCount,
  correctCount,
  runnerStatusLabel,
  activeDeckKind,
  canPersistProgress,
  progress,
  isCurrentCardFlipped,
  isReviewMode,
  onFlipCard,
  currentResult,
  canManageAnatomyContent,
  isFlaggingMedia,
  onFlagMedia,
  onPreviousPrompt,
  answers,
  onAnswerChange,
  onCheckAnswer,
  onCompleteStudy,
  onNextPrompt,
  showReviewMarkingActions,
  saveMessage,
  onResetStudy,
}: {
  runnerTopRef: RefObject<HTMLDivElement | null>
  currentPrompt: FlashcardPrompt
  currentIndex: number
  deckLength: number
  answeredCount: number
  correctCount: number
  runnerStatusLabel: string
  activeDeckKind: ActiveDeckKind
  canPersistProgress: boolean
  progress: number
  isCurrentCardFlipped: boolean
  isReviewMode: boolean
  onFlipCard: () => void
  currentResult: PromptResult | null
  canManageAnatomyContent: boolean
  isFlaggingMedia: boolean
  onFlagMedia: (reason: "bad_match" | "bad_view") => void
  onPreviousPrompt: () => void
  answers: Record<string, string>
  onAnswerChange: (fieldId: string, value: string) => void
  onCheckAnswer: (correctOverride?: boolean) => void
  onCompleteStudy: () => void
  onNextPrompt: () => void
  showReviewMarkingActions: boolean
  saveMessage: string
  onResetStudy: () => void
}) {
  return (
    <div ref={runnerTopRef} className="-m-4">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1 rounded-none border border-border/80 bg-background/70 px-2 py-1 sm:flex sm:justify-between">
        <Button type="button" variant="outline" size="sm" onClick={onResetStudy} className="h-8 shrink-0 rounded-lg px-2 text-xs leading-none [&_svg]:size-3.5">
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          Setup
        </Button>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-1.5 gap-y-1 text-[11px] leading-tight text-muted-foreground sm:gap-x-2 sm:text-xs" aria-live="polite">
          <span className="font-medium text-foreground">Card {currentIndex + 1} of {deckLength}</span>
          <span aria-hidden="true">/</span>
          <span>{answeredCount > 0 ? `${correctCount}/${answeredCount} correct` : "0 correct"}</span>
          <span aria-hidden="true">/</span>
          <span>{runnerStatusLabel}</span>
          <span aria-hidden="true">/</span>
          <span>{activeDeckKindLabels[activeDeckKind]}</span>
          {!canPersistProgress ? (
            <Button asChild variant="link" className="h-auto p-0 text-xs text-muted-foreground hover:text-primary">
              <Link href="/login?callbackUrl=/education/flashcards">
                <Lock className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                Sign in to save
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <Progress value={progress} className="h-1.5 bg-neutral-800 [&>div]:bg-primary" />

      <section className="space-y-2">
        <FlashcardSurface
          prompt={currentPrompt}
          isFlipped={isCurrentCardFlipped}
          isReviewMode={isReviewMode}
          onFlip={onFlipCard}
          result={currentResult}
        />

        {canManageAnatomyContent && currentPrompt.front.mode === "media" && currentPrompt.front.media ? (
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-2 rounded-md border border-border/80 bg-background/70 p-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <Flag className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <span className="break-words">Admin image review</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => onFlagMedia("bad_match")} disabled={isFlaggingMedia}>
                Bad match
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => onFlagMedia("bad_view")} disabled={isFlaggingMedia}>
                Bad view
              </Button>
              <Button asChild variant="link" size="sm" className="h-9 px-1">
                <Link href={`/admin/anatomy?entityType=${encodeURIComponent(currentPrompt.entityType)}&entitySlug=${encodeURIComponent(currentPrompt.entitySlug)}`}>
                  Review item
                </Link>
              </Button>
            </div>
          </div>
        ) : null}

        {!isReviewMode ? (
          <div className="mx-auto grid w-full max-w-4xl grid-cols-2 gap-2 rounded-lg border-0 bg-background/70 p-2 shadow-[0_18px_60px_rgba(0,0,0,0.22)] sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:items-center">
            <Button type="button" variant="outline" onClick={onPreviousPrompt} disabled={currentIndex === 0} className="order-2 w-full sm:order-none sm:w-auto">
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              Previous
            </Button>
            <div className={cn("order-1 col-span-2 grid min-w-0 gap-2 sm:order-none sm:col-span-1", currentPrompt.answerFields.length > 1 && "sm:grid-cols-2")}>
              {currentPrompt.answerFields.map((field) => (
                <div key={field.id} className="min-w-0">
                  <Label htmlFor={`answer-${field.id}`} className="sr-only">{field.label}</Label>
                  <Input
                    id={`answer-${field.id}`}
                    value={answers[field.id] ?? ""}
                    onChange={(event) => onAnswerChange(field.id, event.target.value)}
                    disabled={Boolean(currentResult)}
                    autoComplete="off"
                    placeholder={field.label}
                  />
                </div>
              ))}
            </div>
            <Button type="button" onClick={() => onCheckAnswer()} disabled={Boolean(currentResult)} className="order-4 col-span-2 w-full sm:order-none sm:col-span-1 sm:w-auto">
              {currentResult ? "Checked" : "Check Answer"}
            </Button>
            {currentIndex >= deckLength - 1 ? (
              <Button type="button" variant="outline" onClick={onCompleteStudy} className="order-3 w-full sm:order-none sm:w-auto">
                Save Results
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={onNextPrompt} className="order-3 w-full sm:order-none sm:w-auto">
                Next
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Button>
            )}
          </div>
        ) : (
          <div className={cn(
            "mx-auto grid w-full max-w-4xl items-center gap-2 rounded-lg border-0 bg-background/75 p-2 shadow-[0_18px_60px_rgba(0,0,0,0.22)]",
            showReviewMarkingActions
              ? "grid-cols-2 min-[560px]:grid-cols-[auto_minmax(0,1fr)_auto]"
              : "grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]",
          )}>
            <Button
              type="button"
              variant="outline"
              onClick={onPreviousPrompt}
              disabled={currentIndex === 0}
              aria-label="Previous card"
              className={cn(
                "w-full min-w-0 px-2 text-xs min-[360px]:px-3 min-[360px]:text-sm min-[560px]:w-auto",
                showReviewMarkingActions && "order-1 min-[560px]:order-none",
              )}
            >
              <ArrowLeft className="h-4 w-4 min-[360px]:mr-2" aria-hidden="true" />
              <span className="hidden min-[360px]:inline">Previous</span>
            </Button>
            <div className={cn(
              "min-w-0 gap-2",
              showReviewMarkingActions
                ? "order-3 col-span-2 grid grid-cols-3 min-[560px]:order-none min-[560px]:col-span-1 min-[560px]:flex min-[560px]:flex-wrap min-[560px]:justify-center"
                : "flex flex-wrap justify-center",
            )}>
              <Button type="button" onClick={onFlipCard} className="min-w-0 whitespace-normal px-2 text-xs min-[360px]:text-sm sm:px-4">
                {isCurrentCardFlipped ? "Show Prompt" : "Reveal Answer"}
              </Button>
              {isCurrentCardFlipped && !currentResult ? (
                <>
                  <Button type="button" variant="outline" onClick={() => onCheckAnswer(false)} className="min-w-0 px-2 text-xs min-[360px]:text-sm">Missed</Button>
                  <Button type="button" onClick={() => onCheckAnswer(true)} className="min-w-0 px-2 text-xs min-[360px]:text-sm">Correct</Button>
                </>
              ) : null}
              {currentResult ? (
                <Badge variant="outline">{currentResult.correct ? "Marked correct" : "Marked missed"}</Badge>
              ) : null}
            </div>
            {currentIndex >= deckLength - 1 ? (
              <Button type="button" variant="outline" onClick={onCompleteStudy} aria-label="Finish practice" className={cn(
                "w-full min-w-0 px-2 text-xs min-[420px]:px-3 min-[420px]:text-sm min-[560px]:w-auto",
                showReviewMarkingActions && "order-2 min-[560px]:order-none",
              )}>
                <CheckCircle2 className="h-4 w-4 min-[420px]:mr-2" aria-hidden="true" />
                <span className="hidden min-[420px]:inline">Finish Practice</span>
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={onNextPrompt} aria-label="Next card" className={cn(
                "w-full min-w-0 px-2 text-xs min-[360px]:px-3 min-[360px]:text-sm min-[560px]:w-auto",
                showReviewMarkingActions && "order-2 min-[560px]:order-none",
              )}>
                <span className="hidden min-[360px]:inline">Next</span>
                <ArrowRight className="h-4 w-4 min-[360px]:ml-2" aria-hidden="true" />
              </Button>
            )}
          </div>
        )}
        {saveMessage ? (
          <div className="mx-auto flex w-full max-w-4xl justify-end text-xs text-muted-foreground">
            <p className="text-sm text-muted-foreground">{saveMessage}</p>
          </div>
        ) : null}
      </section>
    </div>
  )
}
