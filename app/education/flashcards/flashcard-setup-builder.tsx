"use client"

import { useMemo, type ReactNode, type RefObject } from "react"
import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { Activity, Bone, BookOpen, Boxes, Brain, ChevronDown, CircleHelp, Dumbbell, Eye, Image, Keyboard, Landmark, Layers3, MapPin, Save, Shuffle, Target, Trophy } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import type {
  AnatomyStudyDifficulty,
  FlashcardAnswerMode,
  FlashcardPromptType,
} from "@/lib/anatomy-study"
import type { NormalizedFlashcardDeckConfig } from "@/lib/flashcard-community"
import { difficultyLabels } from "./flashcard-runner"
import type { PromptSummary, PromptTypeCount } from "./flashcard-api-client"

export type FlashcardSetupOption = {
  id: string
  label: string
  termCount?: number
}

export type BuilderSection = "category" | "region" | "promptTypes"

type FlashcardCategoryId = NormalizedFlashcardDeckConfig["categories"][number]
type FlashcardRegionId = NormalizedFlashcardDeckConfig["regions"][number]

type FlashcardSetupBuilderProps = {
  builderRef: RefObject<HTMLDivElement | null>
  categories: FlashcardSetupOption[]
  regions: FlashcardSetupOption[]
  selectedCategories: NormalizedFlashcardDeckConfig["categories"]
  selectedRegions: NormalizedFlashcardDeckConfig["regions"]
  difficulty: AnatomyStudyDifficulty
  promptTypes: FlashcardPromptType[]
  answerMode: FlashcardAnswerMode
  deckSize: number
  selectedPromptIds: string[]
  deckTitle: string
  deckDescription: string
  visibility: "PUBLIC" | "PRIVATE"
  expandedPromptType: FlashcardPromptType | null
  expandedBuilderSections: Record<BuilderSection, boolean>
  promptTypeCounts: PromptTypeCount[]
  promptSummaries: PromptSummary[]
  selectedUsablePromptIds: string[]
  allCategoriesSelected: boolean
  allRegionsSelected: boolean
  eligiblePromptCount: number
  canPersistProgress: boolean
  masteryThreshold: number
  skipMasteredPrompts: boolean
  isStartingDeck: boolean
  isLoadingPromptCounts: boolean
  saveMessage: string
  onSelectAllCategories: () => void
  onToggleCategory: (id: FlashcardCategoryId) => void
  onSelectAllRegions: () => void
  onToggleRegion: (id: FlashcardRegionId) => void
  onDifficultyChange: (difficulty: AnatomyStudyDifficulty) => void
  onDeckSizeChange: (deckSize: number) => void
  onToggleBuilderSection: (section: BuilderSection) => void
  onTogglePromptType: (type: FlashcardPromptType) => void
  onExpandedPromptTypeChange: (type: FlashcardPromptType | null) => void
  onActivateExactPromptSelection: () => void
  onClearExactPromptSelection: () => void
  onTogglePromptId: (promptId: string) => void
  onSkipMasteredPromptsChange: (skipMastered: boolean) => void
  onAnswerModeChange: (mode: FlashcardAnswerMode) => void
  onDeckTitleChange: (title: string) => void
  onDeckDescriptionChange: (description: string) => void
  onVisibilityChange: (visibility: "PUBLIC" | "PRIVATE") => void
  onStartDeck: () => void
  onSaveDeck: () => void | Promise<void>
  onPersistDraftAndPromptSignIn: () => void
  onResetStudyFilters: () => void
}

const answerModeLabels: Record<FlashcardAnswerMode, string> = {
  typed: "Type Answers",
  review: "Flip & Self-Grade",
}

const answerModeDescriptions: Record<FlashcardAnswerMode, string> = {
  typed: "Spelling + progress",
  review: "Practice only",
}

const categoryIconById: Record<string, LucideIcon> = {
  bone: Bone,
  bone_landmark: Landmark,
  muscle: Dumbbell,
  anatomy_structure: Boxes,
  anatomy_concept: Brain,
}

const regionIconById: Record<string, LucideIcon> = {
  head: Brain,
  "upper-extremity": Dumbbell,
  spine: Activity,
  thorax: Boxes,
  abdomen: CircleHelp,
  pelvis: CircleHelp,
  "lower-extremity": MapPin,
}

const promptTypeIconById: Record<FlashcardPromptType, LucideIcon> = {
  anatomime_name_recall: Target,
  identify_from_media: Image,
  name_to_summary: BookOpen,
  name_to_region: MapPin,
  name_to_category: Boxes,
  muscle_origin_insertion: Landmark,
  muscle_action: Activity,
  muscle_innervation: Brain,
}

function selectClassName() {
  return "h-10 rounded-md border border-border/80 bg-background/80 px-3 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
}

function selectionSummary(selectedIds: readonly string[], options: readonly FlashcardSetupOption[], allLabel: string) {
  if (selectedIds.length === options.length) return allLabel
  if (selectedIds.length === 0) return "No selections"

  const labelById = new Map(options.map((option) => [option.id, option.label]))
  const labels = selectedIds.map((id) => labelById.get(id) ?? id)

  return labels.length <= 2 ? labels.join(", ") : `${labels.slice(0, 2).join(", ")} +${labels.length - 2}`
}

function promptTypeSelectionSummary(selectedTypes: readonly FlashcardPromptType[], promptTypeCounts: readonly PromptTypeCount[]) {
  if (selectedTypes.length === promptTypeCounts.length) return "All prompt types"
  if (selectedTypes.length === 0) return "No prompt types"

  const labelById = new Map(promptTypeCounts.map((type) => [type.id, type.label]))
  const labels = selectedTypes.map((id) => labelById.get(id) ?? id)

  return labels.length <= 2 ? labels.join(", ") : `${labels.slice(0, 2).join(", ")} +${labels.length - 2}`
}

function SelectionButton({
  selected,
  icon: Icon,
  label,
  detail,
  onClick,
  disabled = false,
  className,
  compact = false,
}: {
  selected: boolean
  icon: LucideIcon
  label: string
  detail?: string
  onClick: () => void
  disabled?: boolean
  className?: string
  compact?: boolean
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex items-center rounded-md border border-border/80 bg-card/60 text-left text-sm transition",
        compact ? "min-h-11 justify-center gap-1 px-1.5 py-2 text-xs min-[420px]:gap-2 min-[420px]:px-2 min-[420px]:text-sm" : "min-h-12 gap-3 px-3 py-2",
        selected && "border-primary/70 bg-primary/10 text-foreground shadow-[0_0_0_1px_hsl(var(--primary)/0.25)]",
        disabled ? "cursor-not-allowed opacity-55" : "hover:border-primary/60",
        className,
      )}
    >
      <span className={cn(
        "flex shrink-0 items-center justify-center rounded-md border border-border/80 bg-background/70 text-muted-foreground",
        compact ? "h-6 w-6" : "h-8 w-8",
        selected && "border-primary/50 text-primary",
      )}>
        <Icon className={cn("h-4 w-4", compact && "h-3.5 w-3.5")} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block break-words font-medium leading-tight">{label}</span>
        {detail ? <span className="block break-words text-xs text-muted-foreground">{detail}</span> : null}
      </span>
    </button>
  )
}

function SetupDisclosure({
  title,
  summary,
  badge,
  expanded,
  onToggle,
  className,
  children,
}: {
  title: string
  summary: string
  badge: string
  expanded: boolean
  onToggle: () => void
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn("overflow-hidden rounded-md border border-border/80 bg-card/55", className)}>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition hover:border-primary/60 hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium">{title}</span>
          <span className="block truncate text-xs text-muted-foreground">{summary}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <Badge variant="outline">{badge}</Badge>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", expanded && "rotate-180")} aria-hidden="true" />
        </span>
      </button>
      <div
        aria-hidden={!expanded}
        inert={!expanded ? true : undefined}
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none",
          expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="border-t border-border/80 p-3">{children}</div>
        </div>
      </div>
    </div>
  )
}

export function FlashcardSetupBuilder({
  builderRef,
  categories,
  regions,
  selectedCategories,
  selectedRegions,
  difficulty,
  promptTypes,
  answerMode,
  deckSize,
  selectedPromptIds,
  deckTitle,
  deckDescription,
  visibility,
  expandedPromptType,
  expandedBuilderSections,
  promptTypeCounts,
  promptSummaries,
  selectedUsablePromptIds,
  allCategoriesSelected,
  allRegionsSelected,
  eligiblePromptCount,
  canPersistProgress,
  masteryThreshold,
  skipMasteredPrompts,
  isStartingDeck,
  isLoadingPromptCounts,
  saveMessage,
  onSelectAllCategories,
  onToggleCategory,
  onSelectAllRegions,
  onToggleRegion,
  onDifficultyChange,
  onDeckSizeChange,
  onToggleBuilderSection,
  onTogglePromptType,
  onExpandedPromptTypeChange,
  onActivateExactPromptSelection,
  onClearExactPromptSelection,
  onTogglePromptId,
  onSkipMasteredPromptsChange,
  onAnswerModeChange,
  onDeckTitleChange,
  onDeckDescriptionChange,
  onVisibilityChange,
  onStartDeck,
  onSaveDeck,
  onPersistDraftAndPromptSignIn,
  onResetStudyFilters,
}: FlashcardSetupBuilderProps) {
  const categorySummary = selectionSummary(selectedCategories, categories, "All categories")
  const regionSummary = selectionSummary(selectedRegions, regions, "All regions")
  const promptTypesSummary = promptTypeSelectionSummary(promptTypes, promptTypeCounts)
  const selectedPromptIdSet = useMemo(() => new Set(selectedUsablePromptIds), [selectedUsablePromptIds])
  const promptTypeByPromptId = useMemo(() => new Map(promptSummaries.map((prompt) => [prompt.id, prompt.type])), [promptSummaries])
  const exactPromptSelectionActive = selectedPromptIds.length > 0
  const displayedDeckSize = eligiblePromptCount > 0 ? Math.min(Math.max(1, deckSize), eligiblePromptCount) : 0
  const canStartOrSaveDeck = eligiblePromptCount > 0 && !isLoadingPromptCounts
  const startButtonLabel = isStartingDeck
    ? "Starting..."
    : isLoadingPromptCounts
      ? "Updating..."
      : displayedDeckSize > 0
        ? `Start ${displayedDeckSize}`
        : "No cards to start"

  return (
    <div ref={builderRef} className="scroll-mt-6 rounded-md border border-border/80 bg-background/70 p-4">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Layers3 className="h-5 w-5 text-primary" aria-hidden="true" />
          <h2 className="text-lg font-semibold">Build A Deck</h2>
        </div>
        <Badge variant="outline">{eligiblePromptCount} eligible</Badge>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <SetupDisclosure
          title="Category"
          summary={categorySummary}
          badge={`${selectedCategories.length}/${categories.length}`}
          expanded={expandedBuilderSections.category}
          onToggle={() => onToggleBuilderSection("category")}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <SelectionButton
              selected={allCategoriesSelected}
              icon={Layers3}
              label="All categories"
              detail={`${categories.length} groups`}
              onClick={onSelectAllCategories}
            />
            {categories.map((option) => {
              const Icon = categoryIconById[option.id] ?? CircleHelp
              return (
                <SelectionButton
                  key={option.id}
                  selected={selectedCategories.includes(option.id as FlashcardCategoryId)}
                  icon={Icon}
                  label={option.label}
                  detail={typeof option.termCount === "number" ? `${option.termCount} items` : undefined}
                  onClick={() => onToggleCategory(option.id as FlashcardCategoryId)}
                />
              )
            })}
          </div>
        </SetupDisclosure>

        <SetupDisclosure
          title="Region"
          summary={regionSummary}
          badge={`${selectedRegions.length}/${regions.length}`}
          expanded={expandedBuilderSections.region}
          onToggle={() => onToggleBuilderSection("region")}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <SelectionButton
              selected={allRegionsSelected}
              icon={MapPin}
              label="All regions"
              detail={`${regions.length} regions`}
              onClick={onSelectAllRegions}
            />
            {regions.map((option) => {
              const Icon = regionIconById[option.id] ?? CircleHelp
              return (
                <SelectionButton
                  key={option.id}
                  selected={selectedRegions.includes(option.id as FlashcardRegionId)}
                  icon={Icon}
                  label={option.label}
                  detail={typeof option.termCount === "number" ? `${option.termCount} items` : undefined}
                  onClick={() => onToggleRegion(option.id as FlashcardRegionId)}
                />
              )
            })}
          </div>
        </SetupDisclosure>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Study Detail</h3>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(difficultyLabels).map(([id, label]) => (
              <SelectionButton
                key={id}
                selected={difficulty === id}
                icon={id === "easy" ? Target : id === "medium" ? Layers3 : Trophy}
                label={label}
                compact
                onClick={() => onDifficultyChange(id as AnatomyStudyDifficulty)}
              />
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <Label htmlFor="flashcard-deck-size">Deck Size</Label>
          <div className="flex gap-2">
            <Input
              id="flashcard-deck-size"
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={deckSize}
              onChange={(event) => {
                const nextCount = Number(event.target.value)
                onDeckSizeChange(Number.isFinite(nextCount) ? Math.max(1, Math.trunc(nextCount)) : 1)
              }}
            />
            <Button type="button" variant="secondary" onClick={() => onDeckSizeChange(Math.max(1, eligiblePromptCount))} disabled={eligiblePromptCount === 0}>
              All
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {isLoadingPromptCounts
              ? "Refreshing eligible prompt counts before starting."
              : `${displayedDeckSize} will be used from ${eligiblePromptCount} eligible prompts.`}
          </p>
        </div>
      </div>

      <SetupDisclosure
        title="Prompt Types"
        summary={promptTypesSummary}
        badge={`${promptTypes.length}/${promptTypeCounts.length}`}
        expanded={expandedBuilderSections.promptTypes}
        onToggle={() => onToggleBuilderSection("promptTypes")}
        className="mt-5"
      >
        <div className="grid gap-3 md:grid-cols-2">
          {promptTypeCounts.map((type) => {
            const selected = promptTypes.includes(type.id)
            const disabled = !selected && type.promptCount === 0
            const Icon = promptTypeIconById[type.id] ?? CircleHelp
            const selectedInType = selectedUsablePromptIds.filter((promptId) => promptTypeByPromptId.get(promptId) === type.id).length
            const isExpanded = expandedPromptType === type.id
            const expandedPromptSummaries = isExpanded
              ? promptSummaries.filter((prompt) => prompt.type === type.id)
              : []
            const selectedExpandedPromptCount = expandedPromptSummaries.filter((prompt) => selectedPromptIdSet.has(prompt.id)).length
            const unavailableText = type.id === "identify_from_media"
              ? "No uploaded images available for these filters"
              : "No eligible prompts for these filters"

            return (
              <div key={type.id} className={cn(
                "rounded-md border border-border/80 bg-card/60 p-3 transition",
                selected && "border-primary/60 bg-primary/10",
                disabled && "opacity-55",
              )}>
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    aria-pressed={selected}
                    disabled={disabled}
                    onClick={() => onTogglePromptType(type.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-not-allowed"
                  >
                    <span className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/80 bg-background/70 text-muted-foreground",
                      selected && "border-primary/50 text-primary",
                    )}>
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block break-words text-sm font-medium">{type.label}</span>
                      {exactPromptSelectionActive && selected ? <span className="block text-xs text-muted-foreground">{selectedInType} selected</span> : null}
                      {type.promptCount === 0 ? <span className="block text-xs text-muted-foreground">{unavailableText}</span> : null}
                    </span>
                  </button>
                  <Badge variant="outline">{type.promptCount}</Badge>
                </div>
                {type.promptCount > 0 ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="mt-3 w-full"
                    aria-expanded={isExpanded}
                    onClick={() => onExpandedPromptTypeChange(isExpanded ? null : type.id)}
                  >
                    {isExpanded ? "Close items" : "Choose items"}
                  </Button>
                ) : null}

                {isExpanded ? (
                  <div className="mt-3 rounded-md border border-border/80 bg-background/70 p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-sm font-medium">{type.label}</h3>
                        <p className="text-xs text-muted-foreground">
                          {exactPromptSelectionActive
                            ? `${selectedExpandedPromptCount}/${expandedPromptSummaries.length} selected in this group`
                            : "All matching items are included"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant="secondary" onClick={onActivateExactPromptSelection} disabled={promptSummaries.length === 0}>
                          Select exact items
                        </Button>
                        {exactPromptSelectionActive ? (
                          <Button type="button" size="sm" variant="secondary" onClick={onClearExactPromptSelection}>
                            Use all eligible
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-3 grid max-h-72 gap-2 overflow-y-auto pr-1">
                      {expandedPromptSummaries.map((prompt) => {
                        const promptSelected = !exactPromptSelectionActive || selectedPromptIdSet.has(prompt.id)
                        return (
                          <button
                            key={prompt.id}
                            type="button"
                            aria-pressed={promptSelected}
                            onClick={() => onTogglePromptId(prompt.id)}
                            className={cn(
                              "rounded-md border border-border/80 bg-card/70 px-3 py-2 text-left text-sm transition hover:border-primary/60",
                              promptSelected && "border-primary/60 bg-primary/10",
                            )}
                          >
                            <span className="block truncate font-medium">{prompt.name}</span>
                            <span className="mt-1 block truncate text-xs text-muted-foreground">{prompt.categoryLabel} - {prompt.regionLabels.join(", ")} - {difficultyLabels[prompt.difficulty]}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </SetupDisclosure>

      {canPersistProgress ? (
        <label className="mt-4 flex items-start gap-3 rounded-md border border-border/80 bg-card/60 px-3 py-3 text-sm">
          <Checkbox checked={skipMasteredPrompts} onCheckedChange={(checked) => onSkipMasteredPromptsChange(checked === true)} />
          <span className="space-y-1">
            <span className="block font-medium">Skip mastered prompts</span>
            <span className="block text-muted-foreground">Hide prompts after {masteryThreshold} correct answers so new cards stay in rotation.</span>
          </span>
        </label>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto]">
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Answer Mode</h3>
          <div className="grid grid-cols-2 gap-2">
            <SelectionButton
              selected={answerMode === "typed"}
              icon={Keyboard}
              label={answerModeLabels.typed}
              detail={answerModeDescriptions.typed}
              compact
              onClick={() => onAnswerModeChange("typed")}
            />
            <SelectionButton
              selected={answerMode === "review"}
              icon={Eye}
              label={answerModeLabels.review}
              detail={answerModeDescriptions.review}
              compact
              onClick={() => onAnswerModeChange("review")}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="deck-title">Deck Title</Label>
          <Input id="deck-title" value={deckTitle} onChange={(event) => onDeckTitleChange(event.target.value)} />
        </div>
        <div className="flex items-end">
          <Button type="button" onClick={onStartDeck} disabled={!canStartOrSaveDeck || isStartingDeck} className="w-full md:w-auto">
            <Shuffle className="mr-2 h-4 w-4" aria-hidden="true" />
            {startButtonLabel}
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem_auto]">
        <div className="space-y-2">
          <Label htmlFor="deck-description">Deck Note</Label>
          <Input id="deck-description" value={deckDescription} onChange={(event) => onDeckDescriptionChange(event.target.value)} placeholder="Deck note" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="deck-visibility">Visibility</Label>
          <select id="deck-visibility" value={visibility} onChange={(event) => onVisibilityChange(event.target.value as "PUBLIC" | "PRIVATE")} className={cn(selectClassName(), "w-full")}>
            <option value="PUBLIC">Public</option>
            <option value="PRIVATE">Private</option>
          </select>
        </div>
        <div className="flex items-end">
          <Button type="button" variant="secondary" onClick={onSaveDeck} disabled={!canStartOrSaveDeck} className="w-full md:w-auto">
            <Save className="mr-2 h-4 w-4" aria-hidden="true" />
            Save
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-sm text-muted-foreground">
        <Badge variant="outline">{eligiblePromptCount} eligible prompts</Badge>
        {isLoadingPromptCounts ? <Badge variant="outline">Updating counts</Badge> : null}
        {!isLoadingPromptCounts && eligiblePromptCount === 0 ? (
          <span className="flex flex-wrap items-center gap-2 rounded-md border border-border/80 bg-card/60 px-3 py-2 text-sm text-muted-foreground">
            No eligible cards match these filters.
            <Button type="button" variant="link" className="h-auto p-0 text-sm" onClick={onResetStudyFilters}>
              Reset filters
            </Button>
          </span>
        ) : null}
        {!canPersistProgress ? (
          <Button asChild variant="link" className="h-auto p-0 text-sm">
            <Link href="/login?callbackUrl=/education/flashcards" onClick={onPersistDraftAndPromptSignIn}>Sign in to save progress</Link>
          </Button>
        ) : null}
        {saveMessage ? <span>{saveMessage}</span> : null}
      </div>
    </div>
  )
}
