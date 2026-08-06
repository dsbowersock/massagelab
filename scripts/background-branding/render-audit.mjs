import { mkdir, readFile, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { resolve } from "node:path"
import { backgroundRegistry } from "../../components/backgrounds/backgroundRegistry.ts"
import {
  findRecommendedNameCollisions,
  validateAuditCoverage,
  validateAuditEntry,
} from "./audit-model.mjs"
import { BACKGROUND_BRANDING_AUDIT_BATCHES } from "./audit-batches.mjs"

const AUDIT_DATA_URL = new URL("../../data/background-branding-audit.json", import.meta.url)
const AUDIT_OUTPUT_URL = new URL("../../docs/background-branding-audit/", import.meta.url)

/**
 * Renders one stable, review-oriented Markdown file from a batch whose
 * registry rows and audited proposals have already passed CLI validation.
 *
 * @param {{ batch: { title: string, ids: string[] }, entriesById: Map<string, Record<string, unknown>>, backgroundsById: Map<string, Record<string, unknown>> }} options Rendering inputs keyed by immutable background ID.
 * @returns {string} Deterministic Markdown for exactly the batch's ordered IDs.
 */
export function renderAuditBatch({ batch, entriesById, backgroundsById }) {
  const sections = batch.ids.map((id) => {
    const background = backgroundsById.get(id)
    const entry = entriesById.get(id)
    return [
      `## ${entry.recommendedName}`,
      `- **ID:** \`${id}\``,
      `- **Current name:** ${background.label}`,
      `- **Decision:** ${entry.decision}`,
      `- **Alternatives:** ${entry.alternatives.join("; ")}`,
      `- **Visual descriptor:** ${entry.visualDescriptor}`,
      `- **Signature original eligible:** ${entry.signatureOriginalEligible ? "Yes" : "No"}`,
      `- **Rationale:** ${entry.rationale}`,
      `- **Collision notes:** ${entry.collisionNotes}`,
    ].join("\n")
  })
  return `# Background Branding Audit: ${batch.title}\n\n${sections.join("\n\n")}\n`
}

/**
 * Renders the fixed seven-batch review entry point without deriving visible
 * copy from unapproved recommendations or mutable catalog fields.
 *
 * @param {{ batches: Array<{ slug: string, title: string, ids: string[] }> }} options Frozen audit batch inventory.
 * @returns {string} Deterministic Markdown index linking every generated batch.
 */
export function renderAuditIndex({ batches }) {
  const links = batches.map((batch) => (
    `- [${batch.title}](batch-${batch.slug}.md) — ${batch.ids.length} backgrounds`
  ))
  return [
    "# Background Branding Audit",
    "",
    "Generated review artifact. Recommendations are not user-facing catalog changes until approved.",
    "",
    ...links,
    "",
  ].join("\n")
}

/**
 * Validates all available audit records before rendering so an incomplete or
 * conflicting proposal cannot overwrite any generated review Markdown.
 *
 * @param {{ backgrounds: Array<Record<string, unknown>>, entries: Array<Record<string, unknown>>, batches: Array<{ ids: string[] }> }} audit Candidate audit inputs.
 * @returns {string[]} All display-ready validation and collision errors in stable order.
 */
function collectAuditErrors({ backgrounds, entries, batches }) {
  const backgroundsById = new Map(backgrounds.map((background) => [background.id, background]))
  const errors = []

  entries.forEach((entry, index) => {
    const hasValidId = typeof entry.id === "string" && entry.id.trim().length > 0
    const background = backgroundsById.get(entry.id) ?? {
      id: hasValidId ? entry.id : `audit entry ${index + 1}`,
      sourceUrl: undefined,
    }
    errors.push(...validateAuditEntry(entry, background))
  })

  const entriesWithValidIds = entries.filter((entry) => (
    typeof entry.id === "string" && entry.id.trim().length > 0
  ))
  errors.push(...validateAuditCoverage({
    backgrounds,
    entries: entriesWithValidIds,
    batches,
  }))
  for (const collision of findRecommendedNameCollisions(entriesWithValidIds)) {
    errors.push(`recommended name collision \"${collision.normalized}\": ${collision.ids.join(", ")}`)
  }
  return errors
}

function validateAuditDocument(audit) {
  const isObject = Boolean(audit) && typeof audit === "object" && !Array.isArray(audit)
  const root = isObject ? audit : {}
  const errors = []

  if (!isObject) errors.push("audit data: root must be an object")
  if (root.schemaVersion !== 1) errors.push("audit data: schemaVersion must be 1")
  if (root.voice !== "restorative-laboratory-wellness-leaning") {
    errors.push("audit data: voice must be restorative-laboratory-wellness-leaning")
  }
  if (!Array.isArray(root.entries)) {
    errors.push("audit data: entries must be an array")
    return { entries: [], errors }
  }

  const entries = []
  root.entries.forEach((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      errors.push(`audit data: entry ${index + 1} must be an object`)
      return
    }
    entries.push(entry)
  })
  return { entries, errors }
}

/**
 * Validates a raw audit document, renders the complete deterministic output
 * set, and invokes the injected writer only after every detectable error has
 * been aggregated. This is the fail-closed boundary shared by tests and CLI.
 *
 * @param {{ audit: unknown, backgrounds: Array<Record<string, unknown>>, batches: Array<{ slug: string, title: string, ids: string[] }>, writeOutputs: (outputs: Array<[string, string]>) => Promise<void> }} options Raw audit inputs and an all-at-once output writer.
 * @returns {Promise<{ errors: string[], outputs: Array<[string, string]> }>} Stable errors with no outputs, or the complete written output set.
 */
export async function generateAuditFiles({ audit, backgrounds, batches, writeOutputs }) {
  const { entries, errors: dataErrors } = validateAuditDocument(audit)
  const errors = [
    ...dataErrors,
    ...collectAuditErrors({ backgrounds, entries, batches }),
  ]

  if (errors.length) {
    return { errors, outputs: [] }
  }

  const backgroundsById = new Map(backgrounds.map((background) => [background.id, background]))
  const entriesById = new Map(entries.map((entry) => [entry.id, entry]))
  const outputs = [
    ["index.md", renderAuditIndex({ batches })],
    ...batches.map((batch) => [
      `batch-${batch.slug}.md`,
      renderAuditBatch({ batch, entriesById, backgroundsById }),
    ]),
  ]

  await writeOutputs(outputs)
  return { errors: [], outputs }
}

async function writeAuditOutputs(outputs) {
  await mkdir(AUDIT_OUTPUT_URL, { recursive: true })
  await Promise.all(outputs.map(([filename, markdown]) => (
    writeFile(new URL(filename, AUDIT_OUTPUT_URL), markdown, "utf8")
  )))
}

async function main() {
  let audit
  try {
    audit = JSON.parse(await readFile(AUDIT_DATA_URL, "utf8"))
  } catch (error) {
    console.error(["Background branding audit validation failed:", `- audit data: ${error.message}`].join("\n"))
    process.exitCode = 1
    return
  }

  const result = await generateAuditFiles({
    audit,
    backgrounds: backgroundRegistry.filter(({ enabled }) => enabled),
    batches: BACKGROUND_BRANDING_AUDIT_BATCHES,
    writeOutputs: writeAuditOutputs,
  })

  if (result.errors.length) {
    console.error([
      "Background branding audit validation failed:",
      ...result.errors.map((error) => `- ${error}`),
    ].join("\n"))
    process.exitCode = 1
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
