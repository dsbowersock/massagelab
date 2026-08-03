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

  for (const entry of entries) {
    const background = backgroundsById.get(entry.id)
    if (background) errors.push(...validateAuditEntry(entry, background))
  }

  errors.push(...validateAuditCoverage({ backgrounds, entries, batches }))
  for (const collision of findRecommendedNameCollisions(entries)) {
    errors.push(`recommended name collision \"${collision.normalized}\": ${collision.ids.join(", ")}`)
  }
  return errors
}

async function readAuditEntries() {
  try {
    const audit = JSON.parse(await readFile(AUDIT_DATA_URL, "utf8"))
    if (!Array.isArray(audit?.entries)) {
      return { entries: [], errors: ["audit data: entries must be an array"] }
    }
    if (audit.entries.some((entry) => !entry || typeof entry !== "object" || Array.isArray(entry))) {
      return {
        entries: audit.entries.map((entry) => (
          entry && typeof entry === "object" && !Array.isArray(entry) ? entry : {}
        )),
        errors: ["audit data: every entry must be an object"],
      }
    }
    return { entries: audit.entries, errors: [] }
  } catch (error) {
    return { entries: [], errors: [`audit data: ${error.message}`] }
  }
}

/**
 * Generates every review file only after the complete registry, proposal, and
 * batch set validates, preventing partial Markdown from failed audit input.
 *
 * @returns {Promise<void>} Resolves after all eight complete Markdown files are written.
 */
async function main() {
  const { entries, errors: dataErrors } = await readAuditEntries()
  const backgrounds = backgroundRegistry.filter(({ enabled }) => enabled)
  const errors = [
    ...dataErrors,
    ...collectAuditErrors({ backgrounds, entries, batches: BACKGROUND_BRANDING_AUDIT_BATCHES }),
  ]

  if (errors.length) {
    console.error(["Background branding audit validation failed:", ...errors.map((error) => `- ${error}`)].join("\n"))
    process.exitCode = 1
    return
  }

  const backgroundsById = new Map(backgrounds.map((background) => [background.id, background]))
  const entriesById = new Map(entries.map((entry) => [entry.id, entry]))
  const outputs = [
    ["index.md", renderAuditIndex({ batches: BACKGROUND_BRANDING_AUDIT_BATCHES })],
    ...BACKGROUND_BRANDING_AUDIT_BATCHES.map((batch) => [
      `batch-${batch.slug}.md`,
      renderAuditBatch({ batch, entriesById, backgroundsById }),
    ]),
  ]

  await mkdir(AUDIT_OUTPUT_URL, { recursive: true })
  await Promise.all(outputs.map(([filename, markdown]) => writeFile(new URL(filename, AUDIT_OUTPUT_URL), markdown, "utf8")))
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
