"use client"

import { useEffect, useId, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  GRID_MOTION_MANTRA_CHARACTER_LIMIT,
  GRID_MOTION_MANTRA_LIMIT,
  GRID_MOTION_MANTRA_WORD_LIMIT,
  normalizeGridMotionMantra,
} from "@/lib/grid-motion-mantras"

import styles from "./grid-motion-mantra-editor.module.css"

type GridMotionMantraEditorProps = {
  value: string[]
  onChange(value: string[]): void
}

/**
 * Bounds an in-focus draft without collapsing the whitespace a person needs
 * while typing. Canonical whitespace is applied only to values published to
 * the parent and when the field settles on blur.
 */
function limitGridMotionMantraDraft(value: string) {
  const characterLimited = Array.from(value)
    .slice(0, GRID_MOTION_MANTRA_CHARACTER_LIMIT)
    .join("")
  const words = [...characterLimited.matchAll(/\S+/gu)]

  if (words.length <= GRID_MOTION_MANTRA_WORD_LIMIT) {
    return characterLimited
  }

  return characterLimited.slice(0, words[GRID_MOTION_MANTRA_WORD_LIMIT].index)
}

/** Shared local-only editor for Grid Motion phrases in setup and running Visual controls. */
export function GridMotionMantraEditor({ value, onChange }: GridMotionMantraEditorProps) {
  const headingId = useId()
  const helperId = useId()
  const focusedIndexRef = useRef<number | null>(null)
  const [drafts, setDrafts] = useState(() => [...value])

  useEffect(() => {
    setDrafts((previous) => value.map((entry, index) => (
      focusedIndexRef.current === index ? (previous[index] ?? entry) : entry
    )))
  }, [value])

  const setDraftAtIndex = (index: number, nextDraft: string) => {
    setDrafts((previous) => previous.map((entry, entryIndex) => (
      entryIndex === index ? nextDraft : entry
    )))
  }

  const publishAtIndex = (index: number, normalized: string) => {
    if (normalized === value[index]) {
      return
    }

    const next = [...value]
    next[index] = normalized
    onChange(next)
  }

  const updateDraft = (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const nextDraft = limitGridMotionMantraDraft(event.target.value)
    setDraftAtIndex(index, nextDraft)
    const normalized = normalizeGridMotionMantra(nextDraft)

    if (normalized) {
      publishAtIndex(index, normalized)
    }
  }

  const settleDraft = (index: number) => {
    focusedIndexRef.current = null
    const normalized = normalizeGridMotionMantra(drafts[index])
    const settledValue = normalized || value[index] || "I am calm"
    setDraftAtIndex(index, settledValue)
    publishAtIndex(index, settledValue)
  }

  const addMantra = () => {
    if (value.length >= GRID_MOTION_MANTRA_LIMIT) {
      return
    }

    const next = [...value, "I am calm"]
    setDrafts(next)
    onChange(next)
  }

  const removeMantra = (index: number) => {
    if (value.length === 1) {
      return
    }

    const next = value.filter((_, entryIndex) => entryIndex !== index)
    focusedIndexRef.current = null
    setDrafts(next)
    onChange(next)
  }

  return (
    <section
      className={styles.editor}
      role="group"
      aria-labelledby={headingId}
      aria-describedby={helperId}
    >
      <div className={styles.headingRow}>
        <div className={styles.copy}>
          <h3 id={headingId} className={styles.heading}>Mantras</h3>
          <p id={helperId} className={styles.helper}>
            Up to 10 phrases. Each can use 3 words and 28 characters.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="compact"
          onClick={addMantra}
          disabled={value.length >= GRID_MOTION_MANTRA_LIMIT}
        >Add mantra</Button>
      </div>

      <div className={styles.list}>
        {value.map((mantra, index) => (
          <div className={styles.row} key={index}>
            <input
              className={styles.input}
              type="text"
              value={drafts[index] ?? mantra}
              aria-label={`Mantra ${index + 1}`}
              onFocus={() => {
                focusedIndexRef.current = index
              }}
              onChange={(event) => updateDraft(index, event)}
              onBlur={() => settleDraft(index)}
            />
            <Button
              type="button"
              variant="ghost"
              size="compact"
              className={styles.removeButton}
              aria-label={`Remove mantra ${index + 1}: ${mantra}`}
              onClick={() => removeMantra(index)}
              disabled={value.length === 1}
            >Remove mantra</Button>
          </div>
        ))}
      </div>
    </section>
  )
}
