import { readFile, writeFile } from "node:fs/promises"

const AUDIT_URL = new URL("../../data/background-branding-audit.json", import.meta.url)
const CATALOG_URL = new URL("../../data/background-branding-catalog.json", import.meta.url)

function normalizeLabel(value) {
  return String(value ?? "").normalize("NFKC").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

async function readJson(url, fallback = null) {
  try {
    return JSON.parse(await readFile(url, "utf8"))
  } catch (error) {
    if (error?.code === "ENOENT") return fallback
    throw error
  }
}

/**
 * Produces the compact runtime branding catalog from the reviewed audit while
 * retaining prior public labels as search-only aliases. The one-time seed flag
 * captures labels from the pre-branding registry; later runs evolve aliases
 * solely from the committed compact catalog and never rename stable IDs.
 */
async function main() {
  const audit = await readJson(AUDIT_URL)
  if (!audit || !Array.isArray(audit.entries)) {
    throw new Error("Background branding audit entries are required")
  }

  const existing = await readJson(CATALOG_URL, { schemaVersion: 1, entries: [] })
  const existingById = new Map((existing.entries ?? []).map((entry) => [entry.id, entry]))
  const seedFromRegistry = process.argv.includes("--seed-current-labels")
  const currentById = seedFromRegistry
    ? new Map((await import("../../components/backgrounds/backgroundRegistry.ts")).backgroundRegistry.map((entry) => [entry.id, entry]))
    : new Map()

  const entries = audit.entries.map((entry) => {
    const prior = existingById.get(entry.id)
    const currentLabel = currentById.get(entry.id)?.label ?? prior?.label ?? entry.recommendedName
    const aliases = new Map()
    for (const label of prior?.legacyLabels ?? []) aliases.set(normalizeLabel(label), label)
    if (normalizeLabel(currentLabel) !== normalizeLabel(entry.recommendedName)) {
      aliases.set(normalizeLabel(currentLabel), currentLabel)
    }
    aliases.delete(normalizeLabel(entry.recommendedName))

    return {
      id: entry.id,
      label: entry.recommendedName,
      visualDescriptor: entry.visualDescriptor,
      legacyLabels: [...aliases.values()],
      signatureOriginal: Boolean(entry.signatureOriginalEligible),
    }
  })

  const ids = entries.map(({ id }) => id)
  if (new Set(ids).size !== ids.length) throw new Error("Background branding catalog IDs must be unique")
  const labels = entries.map(({ label }) => normalizeLabel(label))
  if (new Set(labels).size !== labels.length) throw new Error("Background branding catalog labels must be unique")

  await writeFile(CATALOG_URL, `${JSON.stringify({ schemaVersion: 1, entries }, null, 2)}\n`, "utf8")
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
