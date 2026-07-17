"use client"

import { useEffect, useMemo, useState } from "react"
import { ListChecks, RotateCcw } from "lucide-react"
import { AppInset, AppPageShell, AppSurface, appCalloutClassName } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { BUSINESS_LAUNCH_CHECKLIST_SECTIONS } from "@/lib/business-plan-template-tools"

type ChecklistState = Record<string, boolean>

const STORAGE_KEY = "massagelab-business-planner-launch-checklist-v1"

export function LaunchChecklistClient() {
  const [checkedItems, setCheckedItems] = useState<ChecklistState>({})
  const [storageReady, setStorageReady] = useState(false)
  const allKeys = useMemo(() => BUSINESS_LAUNCH_CHECKLIST_SECTIONS.flatMap((section) => (
    section.items.map((item) => checklistKey(section.id, item))
  )), [])
  const completedCount = allKeys.filter((key) => checkedItems[key]).length
  const progressPercent = allKeys.length > 0 ? Math.round((completedCount / allKeys.length) * 100) : 0

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        setCheckedItems(normalizeChecklistState(JSON.parse(stored), allKeys))
      } catch {
        window.localStorage.removeItem(STORAGE_KEY)
      }
    }
    setStorageReady(true)
  }, [allKeys])

  useEffect(() => {
    if (!storageReady) return

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(checkedItems))
  }, [checkedItems, storageReady])

  function setItemChecked(key: string, checked: boolean) {
    setCheckedItems((current) => ({
      ...current,
      [key]: checked,
    }))
  }

  function resetChecklist() {
    setCheckedItems({})
  }

  return (
    <AppPageShell width="full" contentClassName="gap-6">
      <AppSurface
        title="Practice Launch Checklist"
        description="Turn the business plan template into concrete launch tasks for legal structure, licenses, location, management, client policies, and presentation."
        icon={<ListChecks className="h-5 w-5" aria-hidden="true" />}
        badge="Browser checklist"
        className={appCalloutClassName}
      >
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
          <AppInset className="p-3">
            <p className="text-xs uppercase tracking-normal text-muted-foreground">Progress</p>
            <p className="mt-1 text-lg font-semibold">{completedCount} of {allKeys.length} tasks complete</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${progressPercent}%` }} />
            </div>
          </AppInset>
          <Button type="button" variant="secondary" onClick={resetChecklist}>
            <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
            Reset checklist
          </Button>
        </div>
      </AppSurface>

      <div className="grid gap-4 lg:grid-cols-2">
        {BUSINESS_LAUNCH_CHECKLIST_SECTIONS.map((section) => (
          <AppSurface key={section.id} title={section.title} description={`${section.items.length} template tasks`}>
            <div className="space-y-3">
              {section.items.map((item) => {
                const key = checklistKey(section.id, item)
                return (
                  <div key={key} className="flex items-start gap-3 rounded-md border border-border/80 bg-background/70 p-3">
                    <Checkbox
                      id={key}
                      checked={Boolean(checkedItems[key])}
                      onCheckedChange={(value) => setItemChecked(key, value === true)}
                    />
                    <Label htmlFor={key} className="cursor-pointer text-sm leading-5">
                      {item}
                    </Label>
                  </div>
                )
              })}
            </div>
          </AppSurface>
        ))}
      </div>
    </AppPageShell>
  )
}

function checklistKey(sectionId: string, item: string) {
  return `${sectionId}:${item}`
}

function normalizeChecklistState(value: unknown, allowedKeys: string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}

  const source = value as Record<string, unknown>
  return Object.fromEntries(allowedKeys.map((key) => [key, source[key] === true]))
}
