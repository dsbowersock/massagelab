"use client"

import { useEffect, useMemo, useState } from "react"
import { NotebookPen, RotateCcw } from "lucide-react"
import { AppInset, AppPageShell, AppSurface, appCalloutClassName } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { BUSINESS_PLAN_OUTLINE_SECTIONS } from "@/lib/business-plan-template-tools"
import { TextAreaField } from "../_components/business-tool-fields"

type OutlineState = Record<string, string>

const STORAGE_KEY = "massagelab-business-planner-plan-outline-v1"

export function PlanOutlineClient() {
  const [outline, setOutline] = useState<OutlineState>(() => createEmptyOutline())
  const [storageReady, setStorageReady] = useState(false)
  const completedSections = useMemo(() => (
    BUSINESS_PLAN_OUTLINE_SECTIONS.filter((section) => outline[section.id]?.trim()).length
  ), [outline])
  const progressPercent = Math.round((completedSections / BUSINESS_PLAN_OUTLINE_SECTIONS.length) * 100)

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        setOutline(normalizeOutlineState(JSON.parse(stored)))
      } catch {
        window.localStorage.removeItem(STORAGE_KEY)
      }
    }
    setStorageReady(true)
  }, [])

  useEffect(() => {
    if (!storageReady) return

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(outline))
  }, [outline, storageReady])

  function updateSection(sectionId: string, value: string) {
    setOutline((current) => ({
      ...current,
      [sectionId]: value,
    }))
  }

  function resetOutline() {
    setOutline(createEmptyOutline())
  }

  return (
    <AppPageShell width="full" contentClassName="gap-6">
      <AppSurface
        title="Business Plan Outline"
        description="Draft the template's mission, purpose, operations, marketing, finances, professional profile, and resume notes in one browser-local worksheet."
        icon={<NotebookPen className="h-5 w-5" aria-hidden="true" />}
        badge="Browser outline"
        className={appCalloutClassName}
      >
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
          <AppInset className="p-3">
            <p className="text-xs uppercase tracking-normal text-muted-foreground">Sections drafted</p>
            <p className="mt-1 text-lg font-semibold">{completedSections} of {BUSINESS_PLAN_OUTLINE_SECTIONS.length}</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${progressPercent}%` }} />
            </div>
          </AppInset>
          <Button type="button" variant="secondary" onClick={resetOutline}>
            <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
            Reset outline
          </Button>
        </div>
      </AppSurface>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
        <div className="space-y-4">
          {BUSINESS_PLAN_OUTLINE_SECTIONS.map((section) => (
            <AppSurface key={section.id} title={section.title} description={section.prompt}>
              <TextAreaField
                id={`outline-${section.id}`}
                label={`${section.title} notes`}
                value={outline[section.id] ?? ""}
                placeholder={section.prompt}
                rows={5}
                onChange={(value) => updateSection(section.id, value)}
              />
            </AppSurface>
          ))}
        </div>

        <AppSurface
          title="Outline preview"
          description="Use this as a quick review of which template sections already have usable notes."
        >
          <div className="space-y-3">
            {BUSINESS_PLAN_OUTLINE_SECTIONS.map((section) => {
              const value = outline[section.id]?.trim()
              return (
                <AppInset key={section.id} className="p-3">
                  <p className="text-sm font-medium">{section.title}</p>
                  <p className="mt-1 whitespace-pre-line text-sm leading-6 text-muted-foreground">
                    {value || "No notes yet."}
                  </p>
                </AppInset>
              )
            })}
          </div>
        </AppSurface>
      </div>
    </AppPageShell>
  )
}

function createEmptyOutline(): OutlineState {
  return Object.fromEntries(BUSINESS_PLAN_OUTLINE_SECTIONS.map((section) => [section.id, ""])) as OutlineState
}

function normalizeOutlineState(value: unknown): OutlineState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return createEmptyOutline()

  const source = value as Record<string, unknown>
  return Object.fromEntries(BUSINESS_PLAN_OUTLINE_SECTIONS.map((section) => [
    section.id,
    typeof source[section.id] === "string" ? source[section.id] : "",
  ])) as OutlineState
}
