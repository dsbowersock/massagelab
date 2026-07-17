"use client"

import * as React from "react"
import {
  ArrowRight,
  CreditCard,
  Minus,
  Plus,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react"

import { AppSurface } from "@/components/ui/app-surface"
import { AcceleratingStepButton } from "@/components/ui/accelerating-step-button"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { MetalAttentionButton, MetalAttentionRing } from "@/components/ui/metal-attention-button"
import { Notice } from "@/components/ui/notice"
import { RouteControlGallery } from "./route-control-gallery"

function clampDurationPart(value: number, max: number) {
  return Math.min(max, Math.max(0, value))
}

export function ProtectedRouteGallery() {
  const [hours, setHours] = React.useState(1)
  const [minutes, setMinutes] = React.useState(30)
  const [activePart, setActivePart] = React.useState<"hours" | "minutes">("minutes")
  const [termsAccepted, setTermsAccepted] = React.useState(false)

  return (
    <div className="space-y-8">
      <section className="space-y-4" aria-labelledby="protected-heading">
        <div>
          <h2 id="protected-heading" className="text-2xl font-semibold">Protected route proofs</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            These specimens verify approved route visuals remain reproducible through shared families while preserving route-specific intent.
          </p>
        </div>

        <AppSurface
          title="Chimer duration entry"
          description="Approved direction: keep the timer selectable, add concise guidance, and replace eight quick presets with hour/minute decrement and increment controls."
          variant="route"
        >
          <Notice
            tone="info"
            title="Select hours or minutes to set the session length"
            description="The highlighted value is adjusted by the controls beneath it."
          />
          <div className="mx-auto grid w-full max-w-md gap-5 rounded-2xl border border-[#4AAAAA]/35 bg-background/75 p-5 shadow-inner">
            <div className="flex items-center justify-center gap-2 font-mono text-5xl font-semibold sm:text-6xl" role="group" aria-label={`${hours} hours ${minutes} minutes`}>
              <button
                type="button"
                className="rounded-lg px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4AAAAA]"
                data-selected={activePart === "hours"}
                aria-pressed={activePart === "hours"}
                onClick={() => setActivePart("hours")}
              >
                {String(hours).padStart(2, "0")}
              </button>
              <span aria-hidden="true">:</span>
              <button
                type="button"
                className="rounded-lg px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4AAAAA]"
                data-selected={activePart === "minutes"}
                aria-pressed={activePart === "minutes"}
                onClick={() => setActivePart("minutes")}
              >
                {String(minutes).padStart(2, "0")}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div className="grid gap-2">
                <p className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hours</p>
                <div className="flex justify-center gap-2">
                  <Button
                    size="compact"
                    tone="setup"
                    aria-label="Decrease hours"
                    onClick={() => setHours((value) => clampDurationPart(value - 1, 23))}
                  >
                    <Minus aria-hidden="true" />
                  </Button>
                  <Button
                    size="compact"
                    tone="setup"
                    aria-label="Increase hours"
                    onClick={() => setHours((value) => clampDurationPart(value + 1, 23))}
                  >
                    <Plus aria-hidden="true" />
                  </Button>
                </div>
              </div>

              <div className="grid gap-2">
                <p className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Minutes</p>
                <div className="flex justify-center gap-2">
                  <AcceleratingStepButton
                    size="compact"
                    tone="setup"
                    step={-1}
                    doubleStep={-5}
                    aria-label="Decrease minutes"
                    onStep={(amount) => setMinutes((value) => clampDurationPart(value + amount, 59))}
                  >
                    <Minus aria-hidden="true" />
                  </AcceleratingStepButton>
                  <AcceleratingStepButton
                    size="compact"
                    tone="setup"
                    step={1}
                    doubleStep={5}
                    aria-label="Increase minutes"
                    onStep={(amount) => setMinutes((value) => clampDurationPart(value + amount, 59))}
                  >
                    <Plus aria-hidden="true" />
                  </AcceleratingStepButton>
                </div>
              </div>
            </div>
          </div>
        </AppSurface>

        <div className="grid gap-4 lg:grid-cols-2">
          <AppSurface title="Chimer protected actions" description="Continue keeps its orange face and always-on metal ring; setup uses #4AAAAA.">
            <div className="flex flex-wrap items-center gap-3">
              <MetalAttentionRing metalMode="always">
                <Button variant="default">
                  Continue
                  <ArrowRight aria-hidden="true" />
                </Button>
              </MetalAttentionRing>
              <Button tone="setup">Setup action</Button>
              <Button tone="setup" size="compact">Compact setup</Button>
            </div>
          </AppSurface>

          <AppSurface title="Anatomime protected actions" description="Action tone and icon inset treatment sit on shared Button and card mechanics.">
            <div className="flex flex-wrap items-center gap-3">
              <Button tone="anatomime">
                <UsersRound aria-hidden="true" />
                Start game
              </Button>
              <Button variant="outline" tone="anatomime">
                <ShieldCheck aria-hidden="true" />
                Preview round
              </Button>
              <Button variant="destructive">Reset</Button>
            </div>
          </AppSurface>
        </div>

        <AppSurface title="Pricing and account controls" description="Membership, donation, legal acceptance, and account entry actions use shared families.">
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="flex flex-wrap items-center gap-3">
              <MetalAttentionButton>
                <Sparkles aria-hidden="true" />
                Membership CTA
              </MetalAttentionButton>
              <MetalAttentionButton>
                Get Started
                <ArrowRight aria-hidden="true" />
              </MetalAttentionButton>
              <Button variant="glow" tone="pricing" effect="glowFlicker">
                <CreditCard aria-hidden="true" />
                Donation glow flicker
              </Button>
            </div>

            <div className="grid gap-3">
              <label className="flex items-start gap-3 rounded-lg border border-border/70 bg-background/60 p-3 text-sm">
                <Checkbox
                  checked={termsAccepted}
                  onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                  aria-label="Accept membership terms"
                />
                <span>
                  <span className="font-semibold">Terms checkbox row</span>
                  <span className="mt-1 block text-muted-foreground">I agree to the membership and cancellation terms.</span>
                </span>
              </label>
              <div className="flex flex-wrap gap-2">
                <Button>Open account</Button>
                <Button variant="secondary">Manage membership</Button>
              </div>
            </div>
          </div>
        </AppSurface>
      </section>

      <RouteControlGallery />
    </div>
  )
}
