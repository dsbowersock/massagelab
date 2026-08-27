"use client"

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

import { Button } from "@/components/ui/button"
import {
  createSignatureSoundReviewProjection,
  createSignatureSoundReviewWorkspaceStorageKey,
  migrateSignatureSoundReviewWorkspaceSafely,
  renderSignatureSoundReviewWorkspaceJson,
  validateSignatureSoundReviewWorkspace,
} from "@/lib/atmoshaper/signature-sound-review-workspace"

type ReviewWorkspace = {
  version: 3
  fingerprints: { discoveryReviewSha256: string; curationSha256: string }
  updatedAt: string
  customConcepts: Record<string, { label: string }>
  recordings: Record<string, {
    decision?: "keep" | "maybe" | "reject"
    note?: string
    concepts: Record<string, { decision: "include" | "remove"; note: string }>
  }>
  groups: Record<string, {
    decision?: "approve" | "change"
    strategyId: string
    previewSettings: Record<string, string | number>
    auditionedAt?: string
    auditionKey?: string
    note: string
  }>
}

type ReviewProjection = {
  concepts: readonly Record<string, unknown>[]
  recordings: readonly Record<string, unknown>[]
  groups: readonly Record<string, unknown>[]
}

type ReviewBaselines = {
  discoveryReview: Record<string, unknown>
  curatedReview: Record<string, unknown>
}

type WorkspaceContextValue = {
  baselines: ReviewBaselines
  workspace: ReviewWorkspace | null
  projection: ReviewProjection | null
  loaded: boolean
  warning: string | null
  updateWorkspace: (update: (draft: ReviewWorkspace) => ReviewWorkspace | void) => void
  exportWorkspace: () => void
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

/** Owns migration, validation, persistence, synchronization, and export for both review pages. */
export function SignatureSoundReviewWorkspaceProvider({
  discoveryReview,
  curatedReview,
  children,
}: ReviewBaselines & { children: ReactNode }) {
  const baselines = useMemo(() => ({ discoveryReview, curatedReview }), [curatedReview, discoveryReview])
  const storageKey = useMemo(() => createSignatureSoundReviewWorkspaceStorageKey(baselines), [baselines])
  const discoveryFingerprint = String(
    (discoveryReview.fingerprints as Record<string, unknown>).reviewSha256,
  )
  const curationFingerprint = String(
    (curatedReview.fingerprints as Record<string, unknown>).curationSha256,
  )
  const legacyRecordingKey = `atmoshaper-signature-candidates:${discoveryFingerprint}`
  const legacyGroupKey = `atmoshaper-signature-group-review-v2:${curationFingerprint}`
  const [workspace, setWorkspace] = useState<ReviewWorkspace | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [warning, setWarning] = useState<string | null>(null)

  useEffect(() => {
    try {
      const currentRaw = localStorage.getItem(storageKey)
      if (currentRaw) {
        setWorkspace(validateSignatureSoundReviewWorkspace(JSON.parse(currentRaw), baselines) as ReviewWorkspace)
        return
      }
      const parseWarnings: string[] = []
      const legacyRecordingReview = parseLegacyJson(localStorage.getItem(legacyRecordingKey), "recording", parseWarnings)
      const legacyGroupReview = parseLegacyJson(localStorage.getItem(legacyGroupKey), "group", parseWarnings)
      const migrated = migrateSignatureSoundReviewWorkspaceSafely({
        ...baselines,
        legacyRecordingReview,
        legacyGroupReview,
        updatedAt: new Date().toISOString(),
      }) as { workspace: ReviewWorkspace; warnings: string[] }
      const migrationWarnings = [...parseWarnings, ...migrated.warnings]
      setWorkspace(migrated.workspace)
      localStorage.setItem(storageKey, renderSignatureSoundReviewWorkspaceJson(migrated.workspace, baselines))
      if (migrationWarnings.length > 0) {
        setWarning("Some older review data could not be migrated. The original browser records were left untouched.")
      }
    } catch {
      setWarning("The current shared review could not be validated. It was left untouched for recovery.")
    } finally {
      setLoaded(true)
    }
  }, [baselines, legacyGroupKey, legacyRecordingKey, storageKey])

  useEffect(() => {
    if (!loaded || !workspace) return
    localStorage.setItem(storageKey, renderSignatureSoundReviewWorkspaceJson(workspace, baselines))
  }, [baselines, loaded, storageKey, workspace])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== storageKey || !event.newValue) return
      try {
        setWorkspace(validateSignatureSoundReviewWorkspace(JSON.parse(event.newValue), baselines) as ReviewWorkspace)
        setWarning(null)
      } catch {
        setWarning("Another tab wrote an invalid shared review. This tab kept its last valid state.")
      }
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [baselines, storageKey])

  const updateWorkspace = useCallback((update: (draft: ReviewWorkspace) => ReviewWorkspace | void) => {
    setWorkspace((current) => {
      if (!current) return current
      try {
        const draft = structuredClone(current)
        const candidate = update(draft) ?? draft
        candidate.updatedAt = new Date().toISOString()
        const normalized = validateSignatureSoundReviewWorkspace(candidate, baselines) as ReviewWorkspace
        setWarning(null)
        return normalized
      } catch {
        setWarning("That review change was not valid and was not saved.")
        return current
      }
    })
  }, [baselines])

  const projection = useMemo(() => (
    workspace ? createSignatureSoundReviewProjection(workspace, baselines) as ReviewProjection : null
  ), [baselines, workspace])

  const exportWorkspace = useCallback(() => {
    if (!workspace) return
    const json = renderSignatureSoundReviewWorkspaceJson(workspace, baselines)
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }))
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `atmoshaper-signature-complete-review-${discoveryFingerprint.slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }, [baselines, discoveryFingerprint, workspace])

  const value = useMemo<WorkspaceContextValue>(() => ({
    baselines,
    workspace,
    projection,
    loaded,
    warning,
    updateWorkspace,
    exportWorkspace,
  }), [baselines, exportWorkspace, loaded, projection, updateWorkspace, warning, workspace])

  return (
    <WorkspaceContext.Provider value={value}>
      {warning ? <p role="alert">{warning}</p> : null}
      {children}
    </WorkspaceContext.Provider>
  )
}

/** Returns the sole shared review state; callers cannot create page-local persistence. */
export function useSignatureSoundReviewWorkspace() {
  const value = useContext(WorkspaceContext)
  if (!value) throw new Error("Signature sound review workspace provider is missing")
  return value
}

/** Renders the single complete export action anywhere inside the shared segment. */
export function ReviewWorkspaceExportButton() {
  const { exportWorkspace, workspace } = useSignatureSoundReviewWorkspace()
  return (
    <Button type="button" variant="outline" disabled={!workspace} onClick={exportWorkspace}>
      Export complete review
    </Button>
  )
}

function parseLegacyJson(raw: string | null, label: string, warnings: string[]) {
  if (!raw) return undefined
  try {
    return JSON.parse(raw) as unknown
  } catch {
    warnings.push(`legacy-${label}-json`)
    return undefined
  }
}
