const SHA256 = /^[a-f0-9]{64}$/
const DECISIONS = new Set(["pass", "needs-rework", "reject"])
const TOP_LEVEL_FIELDS = new Set(["version", "batchDeclarationSha256", "manifestSha256", "updatedAt", "outputs"])
const ENTRY_FIELDS = new Set(["note", "sourceHeardAt", "derivedHeardAt", "decision"])

/** Creates a complete-key, decision-empty QA baseline for one newly rendered exact manifest. */
export function createSignatureSoundDerivedAudioQaDraft({ manifest, manifestSha256 }) {
  return validateSignatureSoundDerivedAudioQa({
    version: 1,
    batchDeclarationSha256: manifest?.batchDeclarationSha256,
    manifestSha256,
    updatedAt: "1970-01-01T00:00:00.000Z",
    outputs: {},
  }, { manifest, manifestSha256 })
}

/**
 * Validates browser or committed QA against the exact derived manifest identity.
 * Drafts may omit decisions; committed evidence sets requireComplete so every
 * manifest output has an evidence-backed decision.
 */
export function validateSignatureSoundDerivedAudioQa(raw, { manifest, manifestSha256, requireComplete = false }) {
  const qa = requireRecord(raw, "Derived-audio QA")
  requireClosedFields(qa, TOP_LEVEL_FIELDS, "Derived-audio QA")
  if (qa.version !== 1) throw new Error("Derived-audio QA version is invalid")
  const batchSha = requireSha256(qa.batchDeclarationSha256, "Derived-audio QA batch checksum")
  const expectedBatchSha = requireSha256(manifest?.batchDeclarationSha256, "Derived manifest batch checksum")
  const qaManifestSha = requireSha256(qa.manifestSha256, "Derived-audio QA manifest checksum")
  const expectedManifestSha = requireSha256(manifestSha256, "Expected derived manifest checksum")
  if (batchSha !== expectedBatchSha || qaManifestSha !== expectedManifestSha) throw new Error("Derived-audio QA identity is stale")
  const updatedAt = requireTimestamp(qa.updatedAt, "Derived-audio QA updatedAt")

  if (!Array.isArray(manifest?.outputs) || manifest.outputs.length === 0) throw new Error("Derived manifest outputs are invalid")
  const identities = manifest.outputs.map((output, index) => requireSha256(output?.outputIdentity, `Derived manifest output ${index + 1}`))
  if (new Set(identities).size !== identities.length) throw new Error("Derived manifest output identity is duplicate")
  const rawOutputs = requireRecord(qa.outputs, "Derived-audio QA outputs")
  for (const identity of Object.keys(rawOutputs)) {
    if (!identities.includes(identity)) throw new Error(`Derived-audio QA output is unknown: ${identity}`)
  }

  const outputs = Object.fromEntries(identities.map((identity) => {
    const entry = normalizeEntry(rawOutputs[identity] ?? { note: "" }, identity)
    if (requireComplete && !entry.decision) throw new Error(`Derived-audio QA complete record needs a decision for ${identity}`)
    return [identity, entry]
  }))
  return { version: 1, batchDeclarationSha256: batchSha, manifestSha256: qaManifestSha, updatedAt, outputs }
}

function normalizeEntry(raw, identity) {
  const entry = requireRecord(raw, `Derived-audio QA entry ${identity}`)
  requireClosedFields(entry, ENTRY_FIELDS, `Derived-audio QA entry ${identity}`)
  if (typeof entry.note !== "string") throw new Error(`Derived-audio QA note is invalid for ${identity}`)
  const normalized = { note: entry.note }
  if (entry.sourceHeardAt !== undefined) normalized.sourceHeardAt = requireTimestamp(entry.sourceHeardAt, `Derived-audio QA source heard time for ${identity}`)
  if (entry.derivedHeardAt !== undefined) normalized.derivedHeardAt = requireTimestamp(entry.derivedHeardAt, `Derived-audio QA processed heard time for ${identity}`)
  if (entry.decision !== undefined) {
    if (!DECISIONS.has(entry.decision)) throw new Error(`Derived-audio QA decision is invalid for ${identity}`)
    const heardBoth = Boolean(normalized.sourceHeardAt && normalized.derivedHeardAt)
    if (entry.decision === "pass" && !heardBoth) throw new Error(`Derived-audio QA pass needs source and processed audio heard for ${identity}`)
    if (entry.decision !== "pass" && !heardBoth && !entry.note.trim()) {
      throw new Error(`Derived-audio QA negative decision needs a note or both recordings heard for ${identity}`)
    }
    normalized.decision = entry.decision
  }
  return normalized
}

function requireRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`)
  return value
}

function requireClosedFields(value, allowed, label) {
  const unknown = Object.keys(value).find((field) => !allowed.has(field))
  if (unknown) throw new Error(`${label} has unknown field: ${unknown}`)
}

function requireSha256(value, label) {
  if (typeof value !== "string" || !SHA256.test(value)) throw new Error(`${label} must be lowercase SHA-256`)
  return value
}

function requireTimestamp(value, label) {
  if (typeof value !== "string" || !value.trim() || !Number.isFinite(Date.parse(value))) throw new Error(`${label} must be an ISO timestamp`)
  return value
}
