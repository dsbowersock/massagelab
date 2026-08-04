"use client"

import { useEffect, useRef } from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { getConnectedVisualFocusTarget } from "@/lib/visual-draft-navigation"

interface UnsavedVisualChangesDialogProps {
  open: boolean
  backgroundName: string
  restoreFocusTarget: HTMLElement | null
  onApply: () => void
  onDiscard: () => void
  onKeepEditing: () => void
}

/**
 * Presents the three explicit outcomes for a pending Visual-editor intent.
 * Radix supplies modal focus trapping; the captured element restores the exact
 * control that requested dismissal when the user keeps editing.
 */
export function UnsavedVisualChangesDialog({
  open,
  backgroundName,
  restoreFocusTarget,
  onApply,
  onDiscard,
  onKeepEditing,
}: UnsavedVisualChangesDialogProps) {
  const explicitOutcomeRef = useRef(false)

  useEffect(() => {
    if (!open) {
      // Controlled parents may close without Radix emitting onOpenChange (the
      // custom Discard button does this), so never carry an explicit outcome
      // into the next time the dialog opens.
      explicitOutcomeRef.current = false
    }
  }, [open])

  const resolveExplicitOutcome = (outcome: () => void) => {
    explicitOutcomeRef.current = true
    outcome()
  }

  useEffect(() => {
    if (!open) {
      return
    }

    // The confirmation owns Escape while the nonmodal Visual dock yields its
    // document listener, so Escape keeps the draft and restores its close control.
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      resolveExplicitOutcome(onKeepEditing)
      window.requestAnimationFrame(() => {
        getConnectedVisualFocusTarget(restoreFocusTarget)?.focus()
      })
    }

    window.addEventListener("keydown", handleEscape, true)
    return () => {
      window.removeEventListener("keydown", handleEscape, true)
    }
  }, [onKeepEditing, open, restoreFocusTarget])

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && open) {
          if (explicitOutcomeRef.current) {
            explicitOutcomeRef.current = false
          } else {
            onKeepEditing()
          }
        }
      }}
    >
      <AlertDialogContent
        className="z-[10060]"
        overlayClassName="z-[10060]"
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          window.requestAnimationFrame(() => {
            getConnectedVisualFocusTarget(restoreFocusTarget)?.focus()
          })
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Save Visual changes?</AlertDialogTitle>
          <AlertDialogDescription>
            {backgroundName} has unapplied color or visual changes. Choose what
            should happen before continuing.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => resolveExplicitOutcome(onKeepEditing)}>
            Keep editing
          </AlertDialogCancel>
          <Button type="button" variant="ghost" onClick={() => resolveExplicitOutcome(onDiscard)}>
            Discard changes
          </Button>
          <AlertDialogAction onClick={() => resolveExplicitOutcome(onApply)}>
            Apply changes
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
