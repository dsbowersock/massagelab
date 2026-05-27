export type AnatomyAdminSourceUsageScope =
  | "OPEN_REUSE"
  | "INTERNAL_REFERENCE"
  | "COMMERCIAL_LICENSED"
  | "REVIEW_ONLY"

export type AnatomyAdminSourceInput = {
  slug: string
  label: string
  url: string | null
  license: string | null
  licenseUrl: string | null
  usageScope: AnatomyAdminSourceUsageScope
  accessedAt: Date | null
  notes: string | null
  attribution: string
}

const SOURCE_USAGE_SCOPES = new Set<AnatomyAdminSourceUsageScope>([
  "OPEN_REUSE",
  "INTERNAL_REFERENCE",
  "COMMERCIAL_LICENSED",
  "REVIEW_ONLY",
])

function formString(formData: Pick<FormData, "get">, key: string) {
  const value = formData.get(key)

  return typeof value === "string" ? value.trim() : ""
}

export function slugifyAnatomySource(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function nullableString(value: string) {
  return value || null
}

function usageScope(value: string): AnatomyAdminSourceUsageScope {
  const normalized = value.trim().replace(/-/g, "_").toUpperCase()

  return SOURCE_USAGE_SCOPES.has(normalized as AnatomyAdminSourceUsageScope)
    ? normalized as AnatomyAdminSourceUsageScope
    : "REVIEW_ONLY"
}

function accessedAt(value: string) {
  if (!value) {
    return null
  }

  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value
  const date = new Date(normalized)

  return Number.isNaN(date.getTime()) ? null : date
}

export function parseAnatomyAdminSourceInput(formData: Pick<FormData, "get">): AnatomyAdminSourceInput | null {
  const label = formString(formData, "label")
  const slug = slugifyAnatomySource(formString(formData, "slug") || label)
  const attribution = formString(formData, "attribution")

  if (!label || !slug || !attribution) {
    return null
  }

  return {
    slug,
    label,
    url: nullableString(formString(formData, "url")),
    license: nullableString(formString(formData, "license")),
    licenseUrl: nullableString(formString(formData, "license_url")),
    usageScope: usageScope(formString(formData, "usage_scope")),
    accessedAt: accessedAt(formString(formData, "accessed_at")),
    notes: nullableString(formString(formData, "notes")),
    attribution,
  }
}
