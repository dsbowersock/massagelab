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

interface UnsavedVisualChangesDialogProps {
  open: boolean
  backgroundName: string
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
  onApply,
  onDiscard,
  onKeepEditing,
}: UnsavedVisualChangesDialogProps) {
  const restoreFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (open && document.activeElement instanceof HTMLElement) {
      restoreFocusRef.current = document.activeElement
    }
  }, [open])

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
          window.requestAnimationFrame(() => restoreFocusRef.current?.focus())
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
