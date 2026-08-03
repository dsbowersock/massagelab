# Background Branding Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a complete, validated, review-ready branding audit for all 83 enabled backgrounds without changing any user-facing catalog copy before batch approval.

**Architecture:** A small pure audit domain validates machine-readable proposals against the enabled registry and an explicit seven-batch inventory. A deterministic renderer turns the validated JSON into one index and seven Markdown review files. The audit is the approval artifact; canonical catalog fields and copy rollout belong to a later plan after the user approves the proposed names.

**Tech Stack:** Node.js ESM, TypeScript-stripped registry imports, JSON, Markdown, `node:test`, existing npm scripts.

## Global Constraints

- Audit every enabled/selectable background; the verified starting count is exactly 83.
- Rename selectively. A valid audit decision is `keep` or `rename`.
- Voice: restorative laboratory with a wellness-first lean; calm, sensory, restorative, lightly experimental, pronounceable, and free of medical claims.
- Every entry has one recommended name, two or three alternatives, and one literal three-to-eight-word visual descriptor.
- `MassageLab` may appear in a recommended name only when the visual is internally conceived, not merely adapted or ported.
- Preserve every current `BackgroundId`; this plan must not edit IDs, ownership, settings, commerce, entitlements, or preview paths.
- Keep current and former labels searchable in later work, but do not add `formerly` copy to ordinary UI.
- Review in curated batches of 10-15 backgrounds. No user-facing copy changes occur in this plan.
- Do not infer that `provider: "MassageLab"` proves internal conception; use `sourceUrl === "internal"` plus the source documentation and renderer history.
- Add focused JSDoc explaining validation intent and schema constraints.

---

## File Structure

- Create `scripts/background-branding/audit-model.mjs`: pure schema, normalization, validation, collision, and coverage helpers.
- Create `scripts/background-branding/audit-batches.mjs`: authoritative seven-batch ID inventory.
- Create `scripts/background-branding/render-audit.mjs`: validates registry + JSON and renders deterministic Markdown.
- Create `data/background-branding-audit.json`: complete human-authored audit proposals.
- Create `docs/background-branding-audit/index.md`: generated review index.
- Create `docs/background-branding-audit/batch-01-foundations.md` through `batch-07-fields-and-celestial.md`: generated curated review batches.
- Create `tests/background-branding-audit.test.mjs`: pure-domain, coverage, schema, collision, and renderer tests.
- Modify `package.json`: add `backgrounds:branding:audit`.
- Modify `docs/project-log.md`: record the completed audit artifact only after validation; do not claim name rollout.

### Task 1: Build the pure audit validator

**Files:**
- Create: `scripts/background-branding/audit-model.mjs`
- Create: `tests/background-branding-audit.test.mjs`

**Interfaces:**
- Consumes: plain registry rows `{ id, label, provider, sourceUrl, enabled }` and plain audit entries.
- Produces: `normalizeBrandName(value): string`, `validateAuditEntry(entry, background): string[]`, `findRecommendedNameCollisions(entries): Array<{ normalized: string, ids: string[] }>`, and `validateAuditCoverage({ backgrounds, entries, batches }): string[]`.

- [ ] **Step 1: Write failing normalization and entry-schema tests**

```js
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  findRecommendedNameCollisions,
  normalizeBrandName,
  validateAuditCoverage,
  validateAuditEntry,
} from "../scripts/background-branding/audit-model.mjs"

describe("background branding audit", () => {
  it("normalizes names for case and punctuation collision checks", () => {
    assert.equal(normalizeBrandName(" Quiet-Current! "), "quiet current")
  })

  it("requires a decision, recommendation, alternatives, descriptor, and rationale", () => {
    const errors = validateAuditEntry({ id: "one" }, {
      id: "one", label: "Old", provider: "MassageLab", sourceUrl: "internal", enabled: true,
    })
    assert.deepEqual(errors, [
      "one: decision must be keep or rename",
      "one: recommendedName is required",
      "one: two or three unique alternatives are required",
      "one: visualDescriptor must contain 3-8 words",
      "one: rationale is required",
      "one: collisionNotes is required",
      "one: signatureOriginalEligible must be boolean",
    ])
  })
})
```

- [ ] **Step 2: Run the focused test and verify the missing module failure**

Run: `node --test tests/background-branding-audit.test.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `audit-model.mjs`.

- [ ] **Step 3: Implement normalization and entry validation**

```js
const DECISIONS = new Set(["keep", "rename"])

/** Normalizes visible names without conflating distinct words. */
export function normalizeBrandName(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

export function validateAuditEntry(entry, background) {
  const errors = []
  const prefix = `${background.id}:`
  if (!DECISIONS.has(entry?.decision)) errors.push(`${prefix} decision must be keep or rename`)
  if (!String(entry?.recommendedName ?? "").trim()) errors.push(`${prefix} recommendedName is required`)
  const alternatives = Array.isArray(entry?.alternatives) ? entry.alternatives : []
  const uniqueAlternatives = new Set(alternatives.map(normalizeBrandName).filter(Boolean))
  if (alternatives.length < 2 || alternatives.length > 3 || uniqueAlternatives.size !== alternatives.length) {
    errors.push(`${prefix} two or three unique alternatives are required`)
  }
  const descriptorWords = String(entry?.visualDescriptor ?? "").trim().split(/\s+/).filter(Boolean)
  if (descriptorWords.length < 3 || descriptorWords.length > 8) {
    errors.push(`${prefix} visualDescriptor must contain 3-8 words`)
  }
  if (!String(entry?.rationale ?? "").trim()) errors.push(`${prefix} rationale is required`)
  if (!String(entry?.collisionNotes ?? "").trim()) errors.push(`${prefix} collisionNotes is required`)
  if (typeof entry?.signatureOriginalEligible !== "boolean") {
    errors.push(`${prefix} signatureOriginalEligible must be boolean`)
  }
  if (entry?.signatureOriginalEligible && background.sourceUrl !== "internal") {
    errors.push(`${prefix} only internally conceived sources may be signature originals`)
  }
  return errors
}
```

- [ ] **Step 4: Add coverage and collision implementations**

```js
export function findRecommendedNameCollisions(entries) {
  const idsByName = new Map()
  for (const entry of entries) {
    const normalized = normalizeBrandName(entry.recommendedName)
    if (!normalized) continue
    idsByName.set(normalized, [...(idsByName.get(normalized) ?? []), entry.id])
  }
  return [...idsByName.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([normalized, ids]) => ({ normalized, ids }))
}

export function validateAuditCoverage({ backgrounds, entries, batches }) {
  const errors = []
  const enabledIds = backgrounds.filter(({ enabled }) => enabled).map(({ id }) => id)
  const entryIds = entries.map(({ id }) => id)
  const batchIds = batches.flatMap(({ ids }) => ids)
  for (const [label, ids] of [["entries", entryIds], ["batches", batchIds]]) {
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index)
    if (duplicates.length) errors.push(`${label}: duplicate ids ${[...new Set(duplicates)].join(", ")}`)
    const missing = enabledIds.filter((id) => !ids.includes(id))
    const extra = ids.filter((id) => !enabledIds.includes(id))
    if (missing.length) errors.push(`${label}: missing ids ${missing.join(", ")}`)
    if (extra.length) errors.push(`${label}: unknown or disabled ids ${extra.join(", ")}`)
  }
  return errors
}
```

- [ ] **Step 5: Run the focused tests**

Run: `node --test tests/background-branding-audit.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit the validator**

```bash
git add scripts/background-branding/audit-model.mjs tests/background-branding-audit.test.mjs
git commit -m "Add background branding audit validation"
```

### Task 2: Lock the seven curated audit batches

**Files:**
- Create: `scripts/background-branding/audit-batches.mjs`
- Modify: `tests/background-branding-audit.test.mjs`

**Interfaces:**
- Consumes: the current immutable `BackgroundId` strings.
- Produces: `BACKGROUND_BRANDING_AUDIT_BATCHES`, an ordered frozen array of `{ slug, title, ids }`.

- [ ] **Step 1: Add a failing exact-coverage test**

```js
import { backgroundRegistry } from "../components/backgrounds/backgroundRegistry.ts"
import { BACKGROUND_BRANDING_AUDIT_BATCHES } from "../scripts/background-branding/audit-batches.mjs"

it("covers all 83 enabled backgrounds exactly once in review-sized batches", () => {
  const enabled = backgroundRegistry.filter(({ enabled }) => enabled)
  assert.equal(enabled.length, 83)
  assert.deepEqual(
    validateAuditCoverage({ backgrounds: enabled, entries: enabled.map(({ id }) => ({ id })), batches: BACKGROUND_BRANDING_AUDIT_BATCHES }),
    [],
  )
  for (const batch of BACKGROUND_BRANDING_AUDIT_BATCHES) {
    assert.ok(batch.ids.length >= 10 && batch.ids.length <= 15)
  }
})
```

- [ ] **Step 2: Run the test and verify the missing export failure**

Run: `node --experimental-strip-types --test tests/background-branding-audit.test.mjs`
Expected: FAIL because `audit-batches.mjs` does not exist.

- [ ] **Step 3: Create the exact batch inventory**

```js
export const BACKGROUND_BRANDING_AUDIT_BATCHES = Object.freeze([
  { slug: "01-foundations", title: "Foundations and signature forms", ids: [
    "massage-lab-moving-gradient", "static-gradient", "massage-lab-retro-grid", "massage-lab-aerial-rays",
    "massage-lab-dna", "massage-lab-twisted-cubes", "massage-lab-tile-grid", "massage-lab-hex-grid",
    "massage-lab-gradient", "massage-lab-lamp-effect", "massage-lab-spotlight", "massage-lab-reveal-dots",
  ] },
  { slug: "02-flow-and-liquid", title: "Flow and liquid motion", ids: [
    "massage-lab-wave-current", "massage-lab-waves", "massage-lab-wavy-background", "massage-lab-silk",
    "massage-lab-floating-lines", "massage-lab-line-waves", "massage-lab-threads", "massage-lab-color-bends",
    "massage-lab-liquid-ether", "massage-lab-liquid-chrome", "massage-lab-ferrofluid", "massage-lab-iridescence",
  ] },
  { slug: "03-light-and-rays", title: "Light, rays, and beams", ids: [
    "massage-lab-light-speed", "massage-lab-lightfall", "massage-lab-light-pillar", "massage-lab-side-rays",
    "massage-lab-light-rays", "massage-lab-beams", "massage-lab-background-beams", "massage-lab-collision-beams",
    "massage-lab-background-lines", "massage-lab-photon-beam", "massage-lab-prismatic-burst", "massage-lab-prism",
  ] },
  { slug: "04-grids-and-pixels", title: "Grids, pixels, and geometry", ids: [
    "massage-lab-grid-bloom", "massage-lab-pixel-blast", "massage-lab-gradient-blinds", "massage-lab-grid-scan",
    "massage-lab-pixel-snow", "massage-lab-dither", "massage-lab-ripple-grid", "massage-lab-dot-field",
    "massage-lab-dot-grid", "massage-lab-grid-distortion", "massage-lab-grid-motion", "massage-lab-shape-grid",
  ] },
  { slug: "05-atmosphere-and-cosmos", title: "Atmosphere and cosmos", ids: [
    "massage-lab-electric-mist", "massage-lab-astral-flow", "massage-lab-deep-space-nebula", "massage-lab-dark-veil",
    "massage-lab-soft-aurora", "massage-lab-plasma", "massage-lab-plasma-wave", "massage-lab-particles",
    "massage-lab-galaxy", "massage-lab-aurora", "massage-lab-dotted-glow", "massage-lab-sparkles",
  ] },
  { slug: "06-digital-energy", title: "Digital and high-energy effects", ids: [
    "massage-lab-chrome-flow", "massage-lab-evil-eye", "massage-lab-radar", "massage-lab-synthesis",
    "massage-lab-lightning", "massage-lab-faulty-terminal", "massage-lab-letter-glitch", "massage-lab-balatro",
    "massage-lab-novatrix", "massage-lab-matrix-rain", "massage-lab-pixel-liquid", "massage-lab-vortex",
  ] },
  { slug: "07-fields-and-celestial", title: "Fields and celestial motion", ids: [
    "massage-lab-grainient", "massage-lab-orb", "massage-lab-gradient-animation", "massage-lab-glowing-stars",
    "massage-lab-meteors", "massage-lab-shooting-stars", "massage-lab-3d-globe", "massage-lab-aurora-bars",
    "massage-lab-bubble", "massage-lab-stars", "massage-lab-hole",
  ] },
].map((batch) => Object.freeze({ ...batch, ids: Object.freeze(batch.ids) })))
```

- [ ] **Step 4: Run the coverage test**

Run: `node --experimental-strip-types --test tests/background-branding-audit.test.mjs`
Expected: PASS with all 83 enabled IDs covered once.

- [ ] **Step 5: Commit the batch contract**

```bash
git add scripts/background-branding/audit-batches.mjs tests/background-branding-audit.test.mjs
git commit -m "Define curated background branding batches"
```

### Task 3: Add deterministic audit rendering

**Files:**
- Create: `scripts/background-branding/render-audit.mjs`
- Modify: `tests/background-branding-audit.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `backgroundRegistry`, `BACKGROUND_BRANDING_AUDIT_BATCHES`, and `data/background-branding-audit.json`.
- Produces: `renderAuditBatch({ batch, entriesById, backgroundsById }): string`, `renderAuditIndex(...)`, and the `npm run backgrounds:branding:audit` command.

- [ ] **Step 1: Add a failing renderer test with one complete entry**

```js
import { renderAuditBatch } from "../scripts/background-branding/render-audit.mjs"

it("renders the current name, decision, recommendation, alternatives, descriptor, and rationale", () => {
  const markdown = renderAuditBatch({
    batch: { slug: "sample", title: "Sample", ids: ["one"] },
    backgroundsById: new Map([["one", { id: "one", label: "Old Name" }]]),
    entriesById: new Map([["one", {
      id: "one", decision: "rename", recommendedName: "Quiet Current",
      alternatives: ["Restful Current", "Gentle Flow"],
      visualDescriptor: "Layered lines drifting in soft waves",
      rationale: "Fits the restorative voice while describing the motion.",
      collisionNotes: "Distinct from all current recommendations.",
      signatureOriginalEligible: true,
    }]]),
  })
  assert.match(markdown, /## Quiet Current/)
  assert.match(markdown, /Current name:\*\* Old Name/)
  assert.match(markdown, /Restful Current.*Gentle Flow/s)
  assert.match(markdown, /Layered lines drifting in soft waves/)
})
```

- [ ] **Step 2: Run the test and verify the missing renderer failure**

Run: `node --experimental-strip-types --test tests/background-branding-audit.test.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `render-audit.mjs`.

- [ ] **Step 3: Implement deterministic rendering and fail-closed validation**

```js
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
```

The CLI must collect every `validateAuditEntry`, `validateAuditCoverage`, and `findRecommendedNameCollisions` error, print them together, exit nonzero without writing partial Markdown, and otherwise write all eight Markdown files in one run.

- [ ] **Step 4: Add the npm command**

```json
"backgrounds:branding:audit": "node --experimental-strip-types scripts/background-branding/render-audit.mjs"
```

- [ ] **Step 5: Run the focused tests**

Run: `node --experimental-strip-types --test tests/background-branding-audit.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit the renderer**

```bash
git add package.json scripts/background-branding/render-audit.mjs tests/background-branding-audit.test.mjs
git commit -m "Add background branding audit renderer"
```

### Task 4: Author the complete 83-background audit dataset

**Files:**
- Create: `data/background-branding-audit.json`

**Interfaces:**
- Consumes: the seven exact batches, current live/default passive visuals, `docs/background-sources.md`, and the approved naming rubric.
- Produces: one validated object per enabled ID with the exact schema consumed by Task 3.

- [ ] **Step 1: Create the JSON root and entry shape**

```json
{
  "schemaVersion": 1,
  "voice": "restorative-laboratory-wellness-leaning",
  "entries": [
    {
      "id": "massage-lab-moving-gradient",
      "decision": "keep",
      "recommendedName": "MassageLaba Lamp",
      "alternatives": ["Ambient Lamp", "Restorative Glow"],
      "visualDescriptor": "Soft color fields drifting across the screen",
      "rationale": "The recommendation records whether the established signature name should remain after visual and source review.",
      "collisionNotes": "Compare directly with Lamp Glow and Gradient field before approval.",
      "signatureOriginalEligible": true
    }
  ]
}
```

The shown row demonstrates the schema, not automatic approval of its recommendation. During this task, inspect every passive default and replace every row's content with a considered recommendation. Do not reuse generic alternatives across entries.

- [ ] **Step 2: Complete Batches 1-3**

For each of the 36 IDs in `01-foundations`, `02-flow-and-liquid`, and `03-light-and-rays`, record a keep/rename decision, one recommendation, two or three unique alternatives, one three-to-eight-word descriptor, rationale, collision notes, and signature eligibility based on source evidence.

- [ ] **Step 3: Complete Batches 4-5**

Apply the same complete schema to all 24 IDs in `04-grids-and-pixels` and `05-atmosphere-and-cosmos`.

- [ ] **Step 4: Complete Batches 6-7**

Apply the same complete schema to all 23 IDs in `06-digital-energy` and `07-fields-and-celestial`.

- [ ] **Step 5: Run the audit validator and renderer**

Run: `npm run backgrounds:branding:audit`
Expected: exit 0, exactly 83 valid entries, no normalized recommendation collisions, and eight generated Markdown files.

- [ ] **Step 6: Inspect the generated diff for leaked placeholders or repeated boilerplate**

Run: `rg -n "TBD|TODO|same as|fill in|placeholder" data/background-branding-audit.json docs/background-branding-audit`
Expected: no matches.

- [ ] **Step 7: Commit the complete audit proposal**

```bash
git add data/background-branding-audit.json docs/background-branding-audit
git commit -m "Draft complete background branding audit"
```

### Task 5: Validate the audit package and stop for curated review

**Files:**
- Modify: `docs/project-log.md`

**Interfaces:**
- Consumes: the committed machine-readable audit and generated review files.
- Produces: validated review evidence and an explicit user-review gate; no catalog copy mutation.

- [ ] **Step 1: Run the focused and registry tests**

Run: `node --experimental-strip-types --test tests/background-branding-audit.test.mjs tests/background-options.test.mjs tests/background-catalog.test.mjs`
Expected: PASS.

- [ ] **Step 2: Run static validation**

Run: `npm run typecheck`
Expected: PASS.

Run: `npm run lint`
Expected: PASS.

Run: `git diff --check`
Expected: PASS.

- [ ] **Step 3: Record audit readiness without claiming rollout**

Add a dated `docs/project-log.md` entry stating that all 83 enabled backgrounds have complete proposals in seven batches, validation passes, no product labels changed, and Batch 1 is the next user-review gate.

- [ ] **Step 4: Commit the readiness record**

```bash
git add docs/project-log.md
git commit -m "Record background branding audit readiness"
```

- [ ] **Step 5: Present only Batch 1 for user review and stop**

Provide a link to `docs/background-branding-audit/batch-01-foundations.md`. Do not apply Batch 1 or present Batch 2 as approved. User revisions update the JSON, regenerate all Markdown, rerun validation, and receive a focused follow-up commit before any later copy-rollout plan is written.
