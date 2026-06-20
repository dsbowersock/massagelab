"use client"

import { Target, Trophy } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import type { FlashcardProgressPayload } from "./flashcard-api-client"

type FlashcardProgressDashboardProps = {
  progressDashboard: FlashcardProgressPayload | null
  isLoading: boolean
  isStartingNextRound: boolean
  onStartNextMasteryRound: () => void
}

function formatDuration(durationMs: number | null) {
  if (!durationMs) return "Not yet"
  const totalSeconds = Math.max(1, Math.round(durationMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
}

function titleFromSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export function FlashcardProgressDashboard({
  progressDashboard,
  isLoading,
  isStartingNextRound,
  onStartNextMasteryRound,
}: FlashcardProgressDashboardProps) {
  const progressRoundTarget = progressDashboard ? Math.max(progressDashboard.progress.targetPromptCount, progressDashboard.progress.trackedPromptCount) : 0
  const progressRoundPercent = progressDashboard ? Math.max(0, Math.min(100, progressDashboard.progress.roundCompletionPercent)) : 0
  const progressRemainingCount = progressDashboard ? Math.max(0, progressRoundTarget - progressDashboard.progress.masteredPromptCount) : 0
  const promptTypeDashboardRows = progressDashboard?.promptTypeProgress.slice(0, 5) ?? []
  const regionDashboardRows = progressDashboard?.regionProgress.slice(0, 5) ?? []

  return (
    <aside className="space-y-3 rounded-md border border-border/80 bg-background/70 p-4 xl:sticky xl:top-4 xl:self-start">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" aria-hidden="true" />
          <h2 className="text-lg font-semibold">Your Progress</h2>
        </div>
        {isLoading ? <Badge variant="outline">Updating</Badge> : null}
      </div>
      {progressDashboard ? (
        <>
          <div className="space-y-3 rounded-md border border-border/80 bg-card/60 p-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <div>
                <div className="font-medium">Round {progressDashboard.progress.currentRound}</div>
                <div className="text-xs text-muted-foreground">
                  {progressDashboard.progress.masteredPromptCount}/{progressRoundTarget} current prompts mastered
                </div>
              </div>
              <Badge variant={progressDashboard.progress.canStartNextRound ? "default" : "outline"}>
                {progressRoundPercent}%
              </Badge>
            </div>
            <Progress value={progressRoundPercent} className="h-2 bg-neutral-800 [&>div]:bg-primary" />
            {progressDashboard.progress.canStartNextRound || isStartingNextRound ? (
              <Button type="button" className="w-full" onClick={onStartNextMasteryRound} disabled={isStartingNextRound || isLoading}>
                <Trophy className="mr-2 h-4 w-4" aria-hidden="true" />
                {isStartingNextRound ? "Starting..." : "Claim round and start next"}
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">
                {progressRemainingCount} prompts remain before your next completion badge.
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-md border border-border/80 p-2">
              <div className="text-muted-foreground">Remaining</div>
              <div className="font-semibold">{progressRemainingCount}</div>
            </div>
            <div className="rounded-md border border-border/80 p-2">
              <div className="text-muted-foreground">Strict Accuracy</div>
              <div className="font-semibold">{progressDashboard.progress.accuracyPercent}%</div>
            </div>
            <div className="rounded-md border border-border/80 p-2">
              <div className="text-muted-foreground">Lifetime Correct</div>
              <div className="font-semibold">{progressDashboard.progress.totalCorrect}</div>
            </div>
            <div className="rounded-md border border-border/80 p-2">
              <div className="text-muted-foreground">Best Time</div>
              <div className="font-semibold">{formatDuration(progressDashboard.progress.bestDurationMs)}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">{progressDashboard.progress.completedSessionCount} sessions</Badge>
            <Badge variant="outline">{progressDashboard.progress.completedRoundCount} round badges</Badge>
            <Badge variant="outline">{progressDashboard.progress.achievementCount} total badges</Badge>
          </div>
          {promptTypeDashboardRows.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-xs font-medium uppercase text-muted-foreground">Prompt Type Progress</h3>
              {promptTypeDashboardRows.map((item) => (
                <div key={item.key} className="space-y-1 rounded-md border border-border/80 px-2 py-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate font-medium">{item.label}</span>
                    <span className="shrink-0 text-muted-foreground">{item.masteredCount}/{item.totalCount}</span>
                  </div>
                  <Progress value={item.completionPercent} className="h-1.5 bg-neutral-800 [&>div]:bg-primary" />
                  <div className="text-muted-foreground">{item.remainingCount} remaining</div>
                </div>
              ))}
            </div>
          ) : null}
          {regionDashboardRows.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-xs font-medium uppercase text-muted-foreground">Regions To Finish</h3>
              <div className="flex flex-wrap gap-2">
                {regionDashboardRows.map((item) => (
                  <Badge key={item.key} variant="outline" className="justify-between gap-2">
                    <span>{item.label}</span>
                    <span>{item.masteredCount}/{item.totalCount}</span>
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
          {progressDashboard.recentProgress.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-xs font-medium uppercase text-muted-foreground">Recent prompts</h3>
              {progressDashboard.recentProgress.slice(0, 3).map((item) => (
                <div key={item.promptId} className="rounded-md border border-border/80 px-2 py-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate font-medium">{item.name || titleFromSlug(item.entitySlug)}</span>
                    {item.correctCount >= item.masteryThreshold ? (
                      <Trophy className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                    ) : null}
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2 text-muted-foreground">
                    <span className="truncate">{item.promptTypeLabel || item.promptType}</span>
                    <span>{item.correctCount}/{item.masteryThreshold}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2 text-muted-foreground">
                    <span>Round {item.masteryRound}</span>
                    <span>{item.lifetimeCorrectCount} lifetime correct</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Complete a signed-in session to start tracking mastered prompts.</p>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Complete a signed-in session to start tracking mastered prompts.</p>
      )}
    </aside>
  )
}
