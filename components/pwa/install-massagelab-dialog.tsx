"use client"

import Link from "next/link"
import { Download, Share2, SquarePlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function InstallMassageLabDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download aria-hidden="true" />
            Install MassageLab
          </DialogTitle>
          <DialogDescription>On iPhone or iPad, Safari installs MassageLab from the Share menu.</DialogDescription>
        </DialogHeader>
        <ol className="space-y-3 text-sm">
          <li className="flex gap-3">
            <Share2 aria-hidden="true" />
            Open Safari&apos;s Share menu.
          </li>
          <li className="flex gap-3">
            <SquarePlus aria-hidden="true" />
            Choose Add to Home Screen.
          </li>
          <li className="flex gap-3">
            <Download aria-hidden="true" />
            Confirm Add.
          </li>
        </ol>
        <Button asChild variant="secondary">
          <Link href="/help#installing" onClick={() => onOpenChange(false)}>
            Read installation help
          </Link>
        </Button>
      </DialogContent>
    </Dialog>
  )
}
