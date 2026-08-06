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

  const restoreVisualFocus = () => {
    window.requestAnimationFrame(() => {
      getConnectedVisualFocusTarget(restoreFocusTarget)?.focus()
    })
  }

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
        onEscapeKeyDown={(event) => {
          event.preventDefault()
          resolveExplicitOutcome(onKeepEditing)
          restoreVisualFocus()
        }}
        onKeyDownCapture={(event) => {
          if (event.key !== "Escape" || explicitOutcomeRef.current) {
            return
          }

          event.preventDefault()
          event.stopPropagation()
          resolveExplicitOutcome(onKeepEditing)
          restoreVisualFocus()
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          restoreVisualFocus()
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
