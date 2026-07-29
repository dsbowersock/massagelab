"use client"

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
  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && open) {
          onKeepEditing()
        }
      }}
    >
      <AlertDialogContent
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
          <AlertDialogCancel onClick={onKeepEditing}>Keep editing</AlertDialogCancel>
          <Button type="button" variant="ghost" onClick={onDiscard}>
            Discard changes
          </Button>
          <AlertDialogAction onClick={onApply}>Apply changes</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
