import { ANATOMY_ADMIN_QUICK_QUERIES, type AnatomyQuickQueryKey } from "@/lib/anatomy-queries"
import type {
  anatomyQueries,
} from "@/lib/anatomy-queries"

export type AnatomyFoundationCount = {
  label: string
  value: number
}

export type AnatomyQuickResult = {
  title: string
  description: string
  rows: AnatomyQuickResultRow[]
}

export type AnatomyQuickResultRow = {
  title: string
  subtitle?: string
  meta?: string
  detail?: string
}

export type AnatomyBrowserView =
  | "muscles"
  | "structures"
  | "concepts"
  | "joints"
  | "rom"
  | "ligaments"
  | "nerves"
  | "vessels"
  | "terms"
  | "pain"
  | "queries"
  | "sources"
  | "maintenance"
  | BodySystemBrowserView
  | TissueTypeBrowserView

export type BodySystemEntitySection = "muscles" | "bones" | "joints" | "ligaments" | "nerves" | "vessels"

export const BODY_SYSTEM_CONFIGS = [
  {
    view: "system-integumentary",
    label: "Integumentary",
    systemConceptSlugs: ["integumentary-system"],
    entitySections: [],
  },
  {
    view: "system-skeletal",
    label: "Skeletal",
    systemConceptSlugs: ["skeletal-system"],
    entitySections: ["bones", "joints", "ligaments"],
  },
  {
    view: "system-muscular",
    label: "Muscular",
    systemConceptSlugs: ["muscular-system"],
    entitySections: ["muscles"],
  },
  {
    view: "system-nervous",
    label: "Nervous",
    systemConceptSlugs: ["nervous-system"],
    entitySections: ["nerves"],
  },
  {
    view: "system-cardiovascular",
    label: "Cardiovascular",
    systemConceptSlugs: ["cardiovascular-system"],
    entitySections: ["vessels"],
  },
  {
    view: "system-lymphatic",
    label: "Lymphatic",
    systemConceptSlugs: ["lymphatic-system"],
    entitySections: [],
  },
  {
    view: "system-respiratory",
    label: "Respiratory",
    systemConceptSlugs: ["respiratory-system"],
    entitySections: [],
  },
  {
    view: "system-digestive",
    label: "Digestive",
    systemConceptSlugs: ["digestive-system"],
    entitySections: [],
  },
  {
    view: "system-endocrine",
    label: "Endocrine",
    systemConceptSlugs: ["endocrine-system"],
    entitySections: [],
  },
  {
    view: "system-urinary",
    label: "Urinary",
    systemConceptSlugs: ["urinary-system"],
    entitySections: [],
  },
  {
    view: "system-reproductive",
    label: "Reproductive",
    systemConceptSlugs: ["reproductive-system"],
    entitySections: [],
  },
] as const satisfies ReadonlyArray<{
  view: string
  label: string
  systemConceptSlugs: readonly string[]
  entitySections: readonly BodySystemEntitySection[]
}>

export type BodySystemBrowserView = (typeof BODY_SYSTEM_CONFIGS)[number]["view"]

export const TISSUE_TYPE_CONFIGS = [
  {
    view: "tissue-epithelial",
    label: "Epithelial",
    tissueTypeConceptSlugs: ["epithelial-tissue"],
  },
  {
    view: "tissue-connective",
    label: "Connective",
    tissueTypeConceptSlugs: ["connective-tissue"],
  },
  {
    view: "tissue-muscle",
    label: "Muscle tissue",
    tissueTypeConceptSlugs: ["muscle-tissue"],
  },
  {
    view: "tissue-nervous",
    label: "Nervous tissue",
    tissueTypeConceptSlugs: ["nervous-tissue"],
  },
] as const satisfies ReadonlyArray<{
  view: string
  label: string
  tissueTypeConceptSlugs: readonly string[]
}>

export type TissueTypeBrowserView = (typeof TISSUE_TYPE_CONFIGS)[number]["view"]

export type AnatomyBrowserData = {
  regions: Record<string, unknown>[]
  muscles: Record<string, unknown>[]
  structures: Record<string, unknown>[]
  concepts: Record<string, unknown>[]
  bones: Record<string, unknown>[]
  boneLandmarks: Record<string, unknown>[]
  joints: Record<string, unknown>[]
  jointMovements: Record<string, unknown>[]
  rangesOfMotion: Record<string, unknown>[]
  nerves: Record<string, unknown>[]
  ligaments: Record<string, unknown>[]
  bloodSupply: Record<string, unknown>[]
  painRegions: Record<string, unknown>[]
  clientTerms: Record<string, unknown>[]
  entityTerms: Record<string, unknown>[]
  sources: Record<string, unknown>[]
  relationships: Record<string, unknown>[]
  systemRelationships: Record<string, unknown>[]
  citations: Record<string, unknown>[]
  externalIdentifiers: Record<string, unknown>[]
  mediaAssets: Record<string, unknown>[]
  mediaViewRequests: Record<string, unknown>[]
  spatialModels: Record<string, unknown>[]
  spatialEntityMaps: Record<string, unknown>[]
  movementVisualizations: Record<string, unknown>[]
  entityNames: Record<string, string>
  entityOptions: Array<{ entityType: string; entitySlug: string; label: string }>
}

export type AnatomyBrowserDataLoadKey = Exclude<keyof AnatomyBrowserData, "entityNames" | "entityOptions">
export type AnatomyEntityNameIndex = Pick<AnatomyBrowserData, "entityNames" | "entityOptions">
export type AnatomyEntityDetailPayload = Awaited<ReturnType<typeof anatomyQueries.getAnatomyEntityDetail>> | null

export type BrowserViewOption = { key: AnatomyBrowserView; label: string }

export const ENTITY_BROWSER_VIEWS: BrowserViewOption[] = [
  { key: "structures", label: "Structures" },
  { key: "concepts", label: "Concepts" },
  { key: "joints", label: "Joints" },
  { key: "rom", label: "ROM" },
  { key: "terms", label: "Terms" },
  { key: "pain", label: "Pain" },
]

export const SYSTEM_REDUNDANT_ENTITY_BROWSER_VIEWS: BrowserViewOption[] = [
  { key: "muscles", label: "Muscles" },
  { key: "ligaments", label: "Ligaments" },
  { key: "nerves", label: "Nerves" },
  { key: "vessels", label: "Vessels" },
]

export const BODY_SYSTEM_BROWSER_VIEWS: BrowserViewOption[] = BODY_SYSTEM_CONFIGS.map((config) => ({
  key: config.view,
  label: config.label,
}))

export const TISSUE_TYPE_BROWSER_VIEWS: BrowserViewOption[] = TISSUE_TYPE_CONFIGS.map((config) => ({
  key: config.view,
  label: config.label,
}))

export const ADMIN_BROWSER_VIEWS: BrowserViewOption[] = [
  { key: "queries", label: "Queries" },
  { key: "sources", label: "Sources" },
  { key: "maintenance", label: "Maintenance" },
]

export const BROWSER_VIEWS: BrowserViewOption[] = [
  ...ENTITY_BROWSER_VIEWS,
  ...SYSTEM_REDUNDANT_ENTITY_BROWSER_VIEWS,
  ...BODY_SYSTEM_BROWSER_VIEWS,
  ...TISSUE_TYPE_BROWSER_VIEWS,
  ...ADMIN_BROWSER_VIEWS,
]

export const DEFAULT_BROWSER_VIEW: AnatomyBrowserView = "system-muscular"

export const LEGACY_BROWSER_VIEW_REDIRECTS = new Map<string, AnatomyBrowserView>([
  ["movement", "joints"],
  ["neurovascular", "nerves"],
  ["language", "terms"],
  ["system-lymphatic-immune", "system-lymphatic"],
  ["system-musculoskeletal", "system-muscular"],
  ["system-sensory", "system-nervous"],
])

export function browserViewFromParam(value: string | undefined, quickQueryKey?: AnatomyQuickQueryKey, searchQuery?: string): AnatomyBrowserView {
  const normalizedValue = value ? LEGACY_BROWSER_VIEW_REDIRECTS.get(value) ?? value : value

  if (BROWSER_VIEWS.some((view) => view.key === normalizedValue)) {
    return normalizedValue as AnatomyBrowserView
  }

  if (quickQueryKey) {
    return "queries"
  }

  if (searchQuery) {
    return DEFAULT_BROWSER_VIEW
  }

  return DEFAULT_BROWSER_VIEW
}

export function isBodySystemBrowserView(view: AnatomyBrowserView): view is BodySystemBrowserView {
  return BODY_SYSTEM_CONFIGS.some((config) => config.view === view)
}

export function isTissueTypeBrowserView(view: AnatomyBrowserView): view is TissueTypeBrowserView {
  return TISSUE_TYPE_CONFIGS.some((config) => config.view === view)
}

export function bodySystemConfigForView(view: BodySystemBrowserView) {
  return BODY_SYSTEM_CONFIGS.find((config) => config.view === view) ?? BODY_SYSTEM_CONFIGS[0]
}

export function tissueTypeConfigForView(view: TissueTypeBrowserView) {
  return TISSUE_TYPE_CONFIGS.find((config) => config.view === view) ?? TISSUE_TYPE_CONFIGS[0]
}

export function entityKey(entityType: string, entitySlug: string) {
  return `${entityType}:${entitySlug}`
}

export function quickQueryFromParam(value: string | undefined): AnatomyQuickQueryKey | undefined {
  return ANATOMY_ADMIN_QUICK_QUERIES.find((query) => query.key === value)?.key
}
