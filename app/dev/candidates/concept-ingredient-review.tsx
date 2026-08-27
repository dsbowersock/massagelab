"use client"

import { Button } from "@/components/ui/button"
import styles from "./concept-ingredient-review.module.css"

export type ConceptIngredient = {
  sourceId: string
  relativePath: string
  overallDecision: "keep" | "maybe" | "reject" | null
  overallNote: string
  decision: "include" | "remove"
  note: string
}

/** Edits one recording only inside the current concept while keeping removed recordings visible. */
export function ConceptIngredientReview({
  groupLabel,
  ingredients,
  playingSourceId,
  onDecisionChange,
  onNoteChange,
  onPlayInSetup,
}: {
  groupLabel: string
  ingredients: readonly ConceptIngredient[]
  playingSourceId?: string
  onDecisionChange: (ingredient: ConceptIngredient, decision: ConceptIngredient["decision"]) => void
  onNoteChange: (ingredient: ConceptIngredient, note: string) => void
  onPlayInSetup: (sourceId: string) => void
}) {
  const includeCount = ingredients.filter(({ decision }) => decision === "include").length
  const removeCount = ingredients.length - includeCount
  return (
    <details className={styles.ingredients}>
      <summary>
        <span>Review individual recordings</span>
        <small>{includeCount} included · {removeCount} removed</small>
      </summary>
      <p className={styles.help}>
        Inclusion and notes here apply only to {groupLabel}. Removed recordings stay visible and can be restored.
      </p>
      <div className={styles.list}>
        {ingredients.map((ingredient) => {
          const playing = playingSourceId === ingredient.sourceId
          return (
            <article
              className={styles.row}
              data-playing={playing ? "true" : undefined}
              data-decision={ingredient.decision}
              key={ingredient.sourceId}
            >
              <header>
                <div>
                  <strong>{fileName(ingredient.relativePath)}</strong>
                  <p>{ingredient.relativePath}</p>
                </div>
                <div className={styles.badges}>
                  {playing ? <span>Playing in setup</span> : null}
                  {ingredient.overallDecision ? <span>overall {ingredient.overallDecision}</span> : null}
                </div>
              </header>
              {ingredient.overallNote ? (
                <p className={styles.overallNote}><strong>Overall recording note:</strong> {ingredient.overallNote}</p>
              ) : null}
              <div className={styles.actions} role="group" aria-label={`Use ${ingredient.relativePath} in ${groupLabel}`}>
                <button
                  type="button"
                  aria-pressed={ingredient.decision === "include"}
                  onClick={() => onDecisionChange(ingredient, "include")}
                >
                  Include
                </button>
                <button
                  type="button"
                  aria-pressed={ingredient.decision === "remove"}
                  onClick={() => onDecisionChange(ingredient, "remove")}
                >
                  Remove
                </button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={ingredient.decision !== "include"}
                  onClick={() => onPlayInSetup(ingredient.sourceId)}
                >
                  Play this in setup
                </Button>
              </div>
              <label>
                <span>Note for this recording in {groupLabel}</span>
                <textarea
                  value={ingredient.note}
                  onChange={(event) => onNoteChange(ingredient, event.target.value)}
                  placeholder="Why this recording belongs here, where it should enter, or what should change…"
                />
              </label>
            </article>
          )
        })}
      </div>
    </details>
  )
}

function fileName(relativePath: string) {
  return relativePath.split(/[\\/]/).at(-1) ?? relativePath
}
