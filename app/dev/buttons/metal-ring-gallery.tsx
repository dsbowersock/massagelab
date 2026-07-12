"use client"

import * as React from "react"
import { ArrowRight, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  MetalAttentionButton,
  MetalAttentionRing,
  MetalRing,
} from "@/components/ui/metal-attention-button"

export function MetalRingGallery() {
  const siblingRef = React.useRef<HTMLDivElement>(null)

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="grid gap-3 rounded-lg border border-border/50 bg-card/35 p-4">
        <div>
          <h3 className="text-sm font-semibold">Static primitive</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Normal MetalFx wrapper with the upstream chromatic preset.
          </p>
        </div>
        <MetalRing metalStrength={0.6}>
          <Button variant="default">
            Static ring
            <Sparkles aria-hidden="true" />
          </Button>
        </MetalRing>
      </div>

      <div className="grid gap-3 rounded-lg border border-border/50 bg-card/35 p-4">
        <div>
          <h3 className="text-sm font-semibold">Attention timing</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Same ring, with MassageLab random play, settle, and pause behavior.
          </p>
        </div>
        <MetalAttentionButton metalStrength={0.6}>
          Attention
          <Sparkles aria-hidden="true" />
        </MetalAttentionButton>
      </div>

      <div className="grid gap-3 rounded-lg border border-border/50 bg-card/35 p-4">
        <div>
          <h3 className="text-sm font-semibold">Sibling reflection</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Reflection target passthrough for nearby emphasis surfaces.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div
            ref={siblingRef}
            className="rounded-lg border border-border/60 bg-muted/35 px-3 py-2 text-xs font-semibold text-muted-foreground"
          >
            Sibling target
          </div>
          <MetalRing metalReflectionTargets={[siblingRef]} metalStrength={0.6}>
            <Button variant="cta">
              Reflect
              <ArrowRight aria-hidden="true" />
            </Button>
          </MetalRing>
        </div>
      </div>

      <div className="grid gap-3 rounded-lg border border-border/50 bg-card/35 p-4 md:col-span-3">
        <div>
          <h3 className="text-sm font-semibold">Attention wrapper on arbitrary child</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            `MetalAttentionRing` is still available when the child is not `Button`.
          </p>
        </div>
        <MetalAttentionRing metalStrength={0.6}>
          <span className="inline-flex rounded-lg border border-border/60 bg-card px-4 py-3 text-sm font-semibold text-foreground">
            Any emphasized surface
          </span>
        </MetalAttentionRing>
      </div>
    </div>
  )
}
