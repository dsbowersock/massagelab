import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { spawn } from "node:child_process"
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, extname, join, parse, resolve } from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"
import * as plannerModule from "../lib/atmoshaper/sound-processing-plan.js"
import * as scannerModule from "../lib/atmoshaper/signature-sound-scan.js"
import * as cliModule from "../scripts/atmoshaper-sound-processing-plan.mjs"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const plannerPath = join(repoRoot, "lib/atmoshaper/sound-processing-plan.js")
const cliPath = join(repoRoot, "scripts/atmoshaper-sound-processing-plan.mjs")
const declarationPath = join(repoRoot, "data/atmoshaper/sound-processing-recipes.json")
const publicationBaselinePath = join(repoRoot, "data/atmoshaper/sound-publication-ledger-baseline.json")
const moodistPath = join(repoRoot, "data/atmoshaper/moodist-concepts.json")
const checkedInDeclaration = JSON.parse(await readFile(declarationPath, "utf8"))
const moodistConcepts = JSON.parse(await readFile(moodistPath, "utf8"))
const ALGORITHM_VERSION = "cyclic-crossfade-two-pass-v1"

function requireExport(module, name) {
  assert.equal(typeof module?.[name], "function", `${name} must be implemented`)
  const exported = module[name]
  if (module === plannerModule && name === "createSoundProcessingPlan") {
    return (input) => exported({ publicationBaseline: publicationBaseline(), ...input })
  }
  if (module === plannerModule && name === "validateSoundProcessingDeclaration") {
    return (declaration, audit, baseline = publicationBaseline()) => exported(declaration, audit, baseline)
  }
  return exported
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex")
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]))
  }
  return value
}

function fingerprintCanonicalJson(value) {
  return sha256(JSON.stringify(canonicalize(value)))
}

function processingProfile(overrides = {}) {
  const base = {
    id: "ambient-loop-v1",
    trim: { startSeconds: 0, targetDurationSeconds: 60 },
    loop: { crossfadeSeconds: 3 },
    audio: {
      channels: 2,
      sampleRateHz: 48000,
      integratedLoudnessTargetLufs: -20,
      truePeakCeilingDbtp: -1,
    },
    encodes: [
      { format: "webm-opus", extension: "webm", codec: "libopus", bitrateKbps: 128 },
      { format: "m4a-aac", extension: "m4a", codec: "aac", bitrateKbps: 160 },
    ],
  }
  return {
    ...base,
    ...overrides,
    trim: { ...base.trim, ...overrides.trim },
    loop: { ...base.loop, ...overrides.loop },
    audio: { ...base.audio, ...overrides.audio },
    encodes: overrides.encodes ?? base.encodes,
  }
}

function assignment(candidateId = "gentle-waves-signature-candidate", overrides = {}) {
  return {
    candidateId,
    profileId: "ambient-loop-v1",
    sourceSha256: sha256(`${candidateId}-audio`),
    outputVersion: 1,
    ...overrides,
  }
}

function sourceMeasurement(candidateId = "gentle-waves-signature-candidate", overrides = {}) {
  return {
    candidateId,
    sourceSha256: sha256(`${candidateId}-audio`),
    durationSeconds: 63,
    channels: 2,
    sampleRateHz: 48000,
    measurementMethodVersion: "ffprobe-stream-v1",
    ...overrides,
  }
}

function processingDeclaration(overrides = {}) {
  return {
    version: 1,
    plannerAlgorithmVersion: ALGORITHM_VERSION,
    profiles: [processingProfile()],
    sourceMeasurements: [sourceMeasurement()],
    assignments: [assignment()],
    publishedOutputs: [],
    ...overrides,
  }
}

function publicationBaseline(overrides = {}) {
  return {
    version: 1,
    revision: 0,
    entries: [],
    ...overrides,
  }
}

function auditCandidate(id = "gentle-waves-signature-candidate", overrides = {}) {
  return {
    id,
    conceptId: "waves",
    conceptName: "Waves",
    category: "nature",
    discoveryPath: "Nature Pack/Gentle Waves.wav",
    evidenceTier: "signature-sitewide-cc0",
    evidenceRef: "https://signaturesounds.org/about-",
    byteSize: 1234,
    sha256: sha256(`${id}-audio`),
    technicalState: "pass",
    listeningState: "pass",
    processingState: "pending",
    rejectionState: "active",
    rejectionReason: null,
    ...overrides,
  }
}

function extraCandidate(overrides = {}) {
  return auditCandidate("cave-room-tone-signature-candidate", {
    conceptId: "cave-room-tone",
    conceptName: "Cave Room Tone",
    category: null,
    discoveryPath: "Extra Pack/Cave Room Tone.wav",
    ...overrides,
  })
}

function isPlanningEligible(candidate) {
  return candidate.category !== null
    && ["embedded-cc0", "explicit-pack-cc0", "signature-sitewide-cc0"].includes(candidate.evidenceTier)
    && candidate.technicalState === "pass"
    && candidate.listeningState === "pass"
    && ["pending", "verified"].includes(candidate.processingState)
    && candidate.rejectionState === "active"
}

function syntheticAudit(options = {}) {
  const qualified = options.qualified ?? []
  const needs = options.needs ?? [auditCandidate()]
  const extras = options.extras ?? []
  const representedConceptIds = new Set([...qualified, ...needs].map(({ conceptId }) => conceptId))
  const gaps = options.gaps ?? moodistConcepts
    .filter(({ id, sourceStrategy }) => sourceStrategy === "signature-required" && !representedConceptIds.has(id))
    .map(({ id, label, category, upstreamAssetRef }) => ({ id, label, category, upstreamAssetRef }))
  const planning = options.planning ?? [...qualified, ...needs].filter(isPlanningEligible)
  const candidates = [...qualified, ...needs, ...extras]
  const audioFiles = candidates.map((candidate) => ({
    relativePath: candidate.discoveryPath,
    byteSize: candidate.byteSize,
    extension: extname(candidate.discoveryPath).toLowerCase(),
    sha256: candidate.sha256,
  })).sort((left, right) => left.relativePath.localeCompare(right.relativePath))
  const extensionCounts = {}
  for (const file of audioFiles) extensionCounts[file.extension] = (extensionCounts[file.extension] ?? 0) + 1
  const scan = {
    directoryPackCount: audioFiles.length === 0 ? 0 : 1,
    audioCount: audioFiles.length,
    totalBytes: audioFiles.reduce((total, file) => total + file.byteSize, 0),
    extensionCounts: Object.fromEntries(Object.entries(extensionCounts).sort()),
    duplicateGroups: [],
    audioFiles,
  }
  return {
    version: 1,
    fingerprints: {
      scanAudioInventorySha256: fingerprintCanonicalJson(audioFiles),
      moodistInventorySha256: "2".repeat(64),
      signatureDeclarationSha256: "3".repeat(64),
    },
    scan,
    machineMetadata: {
      processingPlanEligibleCandidates: structuredClone(planning),
    },
    outcomes: {
      qualifiedMoodistMatches: structuredClone(qualified),
      needsAuditionOrProcessing: structuredClone(needs),
      recordingOrSourceGaps: structuredClone(gaps),
      signatureOnlyConceptCandidates: structuredClone(extras),
    },
  }
}

function publishedOutputFromPlan(plan, source = plan.sources[0]) {
  return {
    candidateId: source.candidateId,
    profileId: source.profile.id,
    sourceSha256: source.source.sha256,
    profileSha256: source.profileSha256,
    algorithmVersion: plan.plannerAlgorithmVersion,
    outputVersion: source.outputVersion,
    objectKeys: source.recipe.encodes.map(({ objectKey }) => objectKey),
  }
}

async function createDirectoryFixture(t, prefix) {
  const root = await mkdtemp(join(tmpdir(), prefix))
  t.after(() => rm(root, { recursive: true, force: true }))
  return root
}

async function pathExists(path) {
  try {
    await lstat(path)
    return true
  } catch (error) {
    if (error?.code === "ENOENT") return false
    throw error
  }
}

async function listTree(root, prefix = "") {
  const entries = await readdir(root, { withFileTypes: true })
  const paths = []
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const relativePath = prefix === "" ? entry.name : `${prefix}/${entry.name}`
    paths.push(relativePath)
    if (entry.isDirectory()) paths.push(...await listTree(join(root, entry.name), relativePath))
  }
  return paths
}

async function runNode(args) {
  return await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, args, {
      cwd: repoRoot,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    })
    let stdout = ""
    let stderr = ""
    child.stdout.setEncoding("utf8")
    child.stderr.setEncoding("utf8")
    child.stdout.on("data", (chunk) => { stdout += chunk })
    child.stderr.on("data", (chunk) => { stderr += chunk })
    child.once("error", rejectPromise)
    child.once("close", (exitCode) => resolvePromise({ exitCode, stdout, stderr }))
  })
}

describe("AtmoShaper sound processing declaration", () => {
  it("checks in a separate closed genesis publication baseline", async () => {
    let checkedInBaseline
    try {
      checkedInBaseline = JSON.parse(await readFile(publicationBaselinePath, "utf8"))
    } catch {
      assert.fail("The separate publication baseline must be checked in")
    }
    assert.deepEqual(checkedInBaseline, publicationBaseline())
    const validateBaseline = requireExport(plannerModule, "validateSoundPublicationLedgerBaseline")
    assert.deepEqual(validateBaseline(checkedInBaseline, processingDeclaration()), checkedInBaseline)
    assert.throws(() => validateBaseline({ ...checkedInBaseline, extra: true }, processingDeclaration()), /unknown.*baseline/i)
  })

  it("checks in a conservative v1 profile with no assignments, measurements, or publication history", () => {
    const validate = requireExport(plannerModule, "validateSoundProcessingDeclaration")
    const emptyAudit = syntheticAudit({ needs: [], planning: [] })

    assert.deepEqual(Object.keys(checkedInDeclaration), [
      "version",
      "plannerAlgorithmVersion",
      "profiles",
      "sourceMeasurements",
      "assignments",
      "publishedOutputs",
    ])
    assert.equal(checkedInDeclaration.plannerAlgorithmVersion, ALGORITHM_VERSION)
    assert.deepEqual(checkedInDeclaration.sourceMeasurements, [])
    assert.deepEqual(checkedInDeclaration.assignments, [])
    assert.deepEqual(checkedInDeclaration.publishedOutputs, [])
    assert.deepEqual(validate(checkedInDeclaration, emptyAudit).profiles.map(({ id }) => id), ["ambient-loop-v1"])
  })

  it("uses closed schemas for profiles, measurements, assignments, and history", () => {
    const validate = requireExport(plannerModule, "validateSoundProcessingDeclaration")
    const historyStub = {
      candidateId: assignment().candidateId,
      profileId: "ambient-loop-v1",
      sourceSha256: assignment().sourceSha256,
      profileSha256: "4".repeat(64),
      algorithmVersion: ALGORITHM_VERSION,
      outputVersion: 1,
      objectKeys: ["safe.webm", "safe.m4a"],
    }
    const cases = [
      ["declaration", (value) => { value.extra = true }],
      ["profile", (value) => { value.profiles[0].extra = true }],
      ["trim", (value) => { value.profiles[0].trim.extra = true }],
      ["loop", (value) => { value.profiles[0].loop.fadeInSeconds = 1 }],
      ["audio", (value) => { value.profiles[0].audio.extra = true }],
      ["encode", (value) => { value.profiles[0].encodes[0].extra = true }],
      ["measurement", (value) => { value.sourceMeasurements[0].extra = true }],
      ["assignment", (value) => { value.assignments[0].extra = true }],
      ["published", (value) => { value.publishedOutputs = [{ ...historyStub, extra: true }] }],
    ]

    for (const [label, mutate] of cases) {
      const value = structuredClone(processingDeclaration())
      mutate(value)
      assert.throws(() => validate(value, syntheticAudit()), new RegExp(`unknown|${label}`, "i"), label)
    }
  })

  it("rejects unsupported ids and numeric recipe values outside conservative bounds", () => {
    const validate = requireExport(plannerModule, "validateSoundProcessingDeclaration")
    const cases = [
      ["algorithm", (value) => { value.plannerAlgorithmVersion = "unknown-v1" }],
      ["profile id", (value) => { value.profiles[0].id = "Ambient Loop" }],
      ["trim start", (value) => { value.profiles[0].trim.startSeconds = -1 }],
      ["target duration", (value) => { value.profiles[0].trim.targetDurationSeconds = 0 }],
      ["crossfade", (value) => { value.profiles[0].loop.crossfadeSeconds = 0 }],
      ["crossfade", (value) => { value.profiles[0].loop.crossfadeSeconds = 31 }],
      ["channels", (value) => { value.profiles[0].audio.channels = 3 }],
      ["sample rate", (value) => { value.profiles[0].audio.sampleRateHz = 32000 }],
      ["loudness", (value) => { value.profiles[0].audio.integratedLoudnessTargetLufs = -30.1 }],
      ["true peak", (value) => { value.profiles[0].audio.truePeakCeilingDbtp = -0.09 }],
      ["bitrate", (value) => { value.profiles[0].encodes[0].bitrateKbps = 513 }],
    ]
    for (const [label, mutate] of cases) {
      const value = structuredClone(processingDeclaration())
      mutate(value)
      assert.throws(() => validate(value, syntheticAudit()), new RegExp(label, "i"), label)
    }
  })

  it("requires exactly WebM/Opus plus one deterministic fallback", () => {
    const validate = requireExport(plannerModule, "validateSoundProcessingDeclaration")
    const webm = processingProfile().encodes[0]
    for (const encodes of [[], [webm], [webm, webm], [
      webm,
      { format: "wav", extension: "wav", codec: "pcm_s16le", bitrateKbps: 160 },
    ]]) {
      assert.throws(
        () => validate(processingDeclaration({ profiles: [processingProfile({ encodes })] }), syntheticAudit()),
        /encode|format|fallback|opus/i,
      )
    }
  })

  it("accepts processing-pending Moodist candidates but refuses every other eligibility state", () => {
    const validate = requireExport(plannerModule, "validateSoundProcessingDeclaration")
    assert.equal(validate(processingDeclaration(), syntheticAudit()).assignments.length, 1)

    const ineligible = [
      auditCandidate(undefined, { technicalState: "pending", listeningState: "pending" }),
      auditCandidate(undefined, { listeningState: "pending" }),
      auditCandidate(undefined, { processingState: "failed", rejectionState: "rejected", rejectionReason: "Failed" }),
    ]
    for (const candidate of ineligible) {
      assert.throws(
        () => validate(processingDeclaration(), syntheticAudit({ needs: [candidate], planning: [] })),
        /eligible|candidate/i,
      )
    }
    assert.throws(
      () => validate(processingDeclaration(), syntheticAudit({ needs: [], extras: [extraCandidate()], planning: [] })),
      /eligible|candidate/i,
    )

    const fabricated = auditCandidate(undefined, {
      conceptId: "fabricated-cave",
      conceptName: "Fabricated Cave",
      category: "nature",
    })
    assert.throws(
      () => validate(processingDeclaration(), syntheticAudit({ needs: [fabricated], planning: [fabricated] })),
      /canonical|Moodist|identity/i,
    )
  })

  it("requires a unique exact source measurement and enough non-repeated source duration", () => {
    const validate = requireExport(plannerModule, "validateSoundProcessingDeclaration")
    const cases = [
      ["measurement", processingDeclaration({ sourceMeasurements: [] })],
      ["duration", processingDeclaration({ sourceMeasurements: [sourceMeasurement(undefined, { durationSeconds: Number.NaN })] })],
      ["duration", processingDeclaration({ sourceMeasurements: [sourceMeasurement(undefined, { durationSeconds: 62.99 })] })],
      ["channels", processingDeclaration({ sourceMeasurements: [sourceMeasurement(undefined, { channels: 0 })] })],
      ["sample rate", processingDeclaration({ sourceMeasurements: [sourceMeasurement(undefined, { sampleRateHz: 0 })] })],
      ["method", processingDeclaration({ sourceMeasurements: [sourceMeasurement(undefined, { measurementMethodVersion: "Unstable Method" })] })],
      ["duplicate", processingDeclaration({ sourceMeasurements: [sourceMeasurement(), sourceMeasurement()] })],
      ["checksum", processingDeclaration({ sourceMeasurements: [sourceMeasurement(undefined, { sourceSha256: "f".repeat(64) })] })],
    ]
    for (const [label, value] of cases) {
      assert.throws(() => validate(value, syntheticAudit()), new RegExp(label, "i"), label)
    }

    assert.doesNotThrow(() => validate(processingDeclaration({
      profiles: [processingProfile({ trim: { startSeconds: 5 } })],
      sourceMeasurements: [sourceMeasurement(undefined, { durationSeconds: 68 })],
    }), syntheticAudit()))
  })
})

describe("AtmoShaper sound processing planner", () => {
  it("imports the strict Task 2 audit owner and fingerprints an honest normalized projection", async (t) => {
    const createPlan = requireExport(plannerModule, "createSoundProcessingPlan")
    requireExport(scannerModule, "validateSignatureSoundAudit")
    const source = await readFile(plannerPath, "utf8")
    assert.match(source, /validateSignatureSoundAudit[\s\S]*signature-sound-scan\.js/)
    const worktreeRoot = await createDirectoryFixture(t, "ml-processing-repo-")
    const outside = await createDirectoryFixture(t, "ml-processing-output-")
    const audit = syntheticAudit()
    const first = await createPlan({ audit, processingDeclaration: processingDeclaration(), repoRoot: worktreeRoot, outputRoot: outside })
    const second = await createPlan({ audit: structuredClone(audit), processingDeclaration: processingDeclaration(), repoRoot: worktreeRoot, outputRoot: outside })

    assert.deepEqual(first, second)
    assert.deepEqual(Object.keys(first.fingerprints), [
      "publicationLedgerBaselineRevision",
      "publicationLedgerBaselineSha256",
      "processingAuditProjectionSha256",
      "processingDeclarationSha256",
      "plannerAlgorithmProfilesSha256",
      "planInputsSha256",
    ])
    assert.equal(first.fingerprints.publicationLedgerBaselineRevision, 0)
    for (const [key, value] of Object.entries(first.fingerprints)) {
      if (key !== "publicationLedgerBaselineRevision") assert.match(value, /^[a-f0-9]{64}$/)
    }
    const malformed = structuredClone(audit)
    malformed.extra = true
    await assert.rejects(
      createPlan({ audit: malformed, processingDeclaration: processingDeclaration(), repoRoot: worktreeRoot, outputRoot: outside }),
      /unknown.*audit/i,
    )
  })

  it("builds a true T-second cyclic master from head, middle, and tail without endpoint fades or repetition", async (t) => {
    const createPlan = requireExport(plannerModule, "createSoundProcessingPlan")
    const worktreeRoot = await createDirectoryFixture(t, "ml-processing-repo-")
    const outside = await createDirectoryFixture(t, "ml-processing-output-")
    const plan = await createPlan({
      audit: syntheticAudit(),
      processingDeclaration: processingDeclaration(),
      repoRoot: worktreeRoot,
      outputRoot: outside,
    })
    const source = plan.sources[0]

    assert.equal(plan.plannerAlgorithmVersion, ALGORITHM_VERSION)
    assert.equal(source.processingVerification, "not-run")
    assert.equal(source.seamVerificationRequired, true)
    assert.equal(source.recipe.plannedDurationSeconds, 60)
    assert.deepEqual(source.recipe.cyclicMaster, {
      sourceWindow: { startSeconds: 0, endSeconds: 63, durationSeconds: 63 },
      head: { startSeconds: 0, endSeconds: 3, durationSeconds: 3 },
      middle: { startSeconds: 3, endSeconds: 60, durationSeconds: 57 },
      tail: { startSeconds: 60, endSeconds: 63, durationSeconds: 3 },
      seam: { tailThenHeadCrossfadeSeconds: 3, durationSeconds: 3 },
      concatenation: { parts: ["middle", "seam"], durationSeconds: 60 },
    })
    assert.deepEqual(source.recipe.operations.map(({ type }) => type), [
      "cyclic-master", "channels", "sample-rate", "loudness-two-pass",
    ])
    const commandText = JSON.stringify(source.recipe)
    assert.doesNotMatch(commandText, /afade|fadeIn|fadeOut|-stream_loop/)
    assert.match(commandText, /acrossfade=/)
    assert.match(commandText, /concat=/)
  })

  it("emits inert two-pass loudness analysis and encode argv templates only", async (t) => {
    const createPlan = requireExport(plannerModule, "createSoundProcessingPlan")
    const worktreeRoot = await createDirectoryFixture(t, "ml-processing-repo-")
    const outside = await createDirectoryFixture(t, "ml-processing-output-")
    const plan = await createPlan({ audit: syntheticAudit(), processingDeclaration: processingDeclaration(), repoRoot: worktreeRoot, outputRoot: outside })
    const recipe = plan.sources[0].recipe

    assert.equal(plan.state, "needs-toolchain")
    assert.equal(plan.processingVerification, "not-run")
    assert.equal(recipe.loudnessAnalysisRequired, true)
    assert.equal(recipe.loudnessMode, "two-pass")
    assert.ok(Array.isArray(recipe.analysis.argv))
    assert.equal(recipe.analysis.argv[0], "ffmpeg")
    assert.ok(recipe.analysis.argv.includes("-n"))
    assert.ok(recipe.analysis.argv.some((argument) => argument.includes("print_format=json")))
    assert.deepEqual(recipe.analysis.argv.slice(-2), ["null", "-"])
    const placeholders = ["measured_I", "measured_TP", "measured_LRA", "measured_thresh", "offset"]
    for (const encode of recipe.encodes) {
      assert.equal(encode.argv[0], "ffmpeg")
      assert.ok(encode.argv.includes("-n"))
      assert.ok(encode.argv.every((argument) => typeof argument === "string"))
      for (const placeholder of placeholders) {
        assert.ok(encode.argv.some((argument) => argument.includes(`{{loudnorm.${placeholder}}}`)))
      }
    }
    assert.doesNotMatch(JSON.stringify(recipe), /commandLine|shellCommand|processingVerified/i)
  })

  it("uses full source and profile-algorithm digests in immutable object keys", async (t) => {
    const createPlan = requireExport(plannerModule, "createSoundProcessingPlan")
    const worktreeRoot = await createDirectoryFixture(t, "ml-processing-repo-")
    const outside = await createDirectoryFixture(t, "ml-processing-output-")
    const audit = syntheticAudit()
    const planForProfile = async (profile) => await createPlan({
      audit,
      processingDeclaration: processingDeclaration({
        profiles: [profile],
        sourceMeasurements: [sourceMeasurement(undefined, { durationSeconds: 120 })],
        assignments: [assignment(undefined, { profileId: profile.id })],
      }),
      repoRoot: worktreeRoot,
      outputRoot: outside,
    })
    const baseline = await planForProfile(processingProfile())
    const baselineSource = baseline.sources[0]
    assert.match(baselineSource.profileSha256, /^[a-f0-9]{64}$/)
    for (const encode of baselineSource.recipe.encodes) {
      assert.match(encode.objectKey, new RegExp(
        `^atmoshaper/v1/${baselineSource.candidateId}/source-${baselineSource.source.sha256}/profile-${baselineSource.profile.id}-${baselineSource.profileSha256}/algorithm-${ALGORITHM_VERSION}/v1/${baselineSource.candidateId}\\.${encode.extension}$`,
      ))
    }

    const mutations = [
      processingProfile({ id: "ambient-loop-v2" }),
      processingProfile({ trim: { startSeconds: 1 } }),
      processingProfile({ trim: { targetDurationSeconds: 59 } }),
      processingProfile({ loop: { crossfadeSeconds: 2 } }),
      processingProfile({ audio: { channels: 1 } }),
      processingProfile({ audio: { sampleRateHz: 44100 } }),
      processingProfile({ audio: { integratedLoudnessTargetLufs: -21 } }),
      processingProfile({ audio: { truePeakCeilingDbtp: -1.5 } }),
      processingProfile({ encodes: [
        { ...processingProfile().encodes[0], bitrateKbps: 129 },
        processingProfile().encodes[1],
      ] }),
      processingProfile({ encodes: [
        processingProfile().encodes[0],
        { format: "mp3", extension: "mp3", codec: "libmp3lame", bitrateKbps: 160 },
      ] }),
    ]
    const baselineKeys = baselineSource.recipe.encodes.map(({ objectKey }) => objectKey)
    for (const profile of mutations) {
      const changed = (await planForProfile(profile)).sources[0]
      assert.notEqual(changed.profileSha256, baselineSource.profileSha256, profile.id)
      assert.notDeepEqual(changed.recipe.encodes.map(({ objectKey }) => objectKey), baselineKeys, profile.id)
    }
  })

  it("validates append-only publication history and requires a strictly newer output version", async (t) => {
    const createPlan = requireExport(plannerModule, "createSoundProcessingPlan")
    const worktreeRoot = await createDirectoryFixture(t, "ml-processing-repo-")
    const outside = await createDirectoryFixture(t, "ml-processing-output-")
    const first = await createPlan({ audit: syntheticAudit(), processingDeclaration: processingDeclaration(), repoRoot: worktreeRoot, outputRoot: outside })
    const history = publishedOutputFromPlan(first)
    const nextDeclaration = processingDeclaration({
      assignments: [assignment(undefined, { outputVersion: 2 })],
      publishedOutputs: [history],
    })
    const second = await createPlan({ audit: syntheticAudit(), processingDeclaration: nextDeclaration, repoRoot: worktreeRoot, outputRoot: outside })
    assert.equal(second.sources[0].outputVersion, 2)

    const invalid = [
      ["newer", processingDeclaration({ publishedOutputs: [history] })],
      ["duplicate", processingDeclaration({ assignments: [assignment(undefined, { outputVersion: 2 })], publishedOutputs: [history, history] })],
      ["object", processingDeclaration({ assignments: [assignment(undefined, { outputVersion: 2 })], publishedOutputs: [{ ...history, objectKeys: [...history.objectKeys].reverse() }] })],
      ["profile", processingDeclaration({ assignments: [assignment(undefined, { outputVersion: 2 })], publishedOutputs: [{ ...history, profileSha256: "f".repeat(64) }] })],
      ["algorithm", processingDeclaration({ assignments: [assignment(undefined, { outputVersion: 2 })], publishedOutputs: [{ ...history, algorithmVersion: "other-algorithm-v1" }] })],
    ]
    for (const [label, declaration] of invalid) {
      await assert.rejects(
        createPlan({ audit: syntheticAudit(), processingDeclaration: declaration, repoRoot: worktreeRoot, outputRoot: outside }),
        new RegExp(label, "i"),
        label,
      )
    }
  })

  it("anchors current publication history to an independent baseline ledger", async (t) => {
    const createPlan = requireExport(plannerModule, "createSoundProcessingPlan")
    const worktreeRoot = await createDirectoryFixture(t, "ml-processing-repo-")
    const outside = await createDirectoryFixture(t, "ml-processing-output-")
    const first = await createPlan({
      audit: syntheticAudit(),
      processingDeclaration: processingDeclaration(),
      publicationBaseline: publicationBaseline(),
      repoRoot: worktreeRoot,
      outputRoot: outside,
    })
    const publishedV1 = publishedOutputFromPlan(first)
    const anchored = publicationBaseline({ revision: 1, entries: [publishedV1] })

    await assert.rejects(
      createPlan({
        audit: syntheticAudit(),
        processingDeclaration: processingDeclaration({ publishedOutputs: [] }),
        publicationBaseline: anchored,
        repoRoot: worktreeRoot,
        outputRoot: outside,
      }),
      /baseline|anchor|superset|published/i,
    )
    const next = await createPlan({
      audit: syntheticAudit(),
      processingDeclaration: processingDeclaration({
        assignments: [assignment(undefined, { outputVersion: 2 })],
        publishedOutputs: [publishedV1],
      }),
      publicationBaseline: anchored,
      repoRoot: worktreeRoot,
      outputRoot: outside,
    })
    assert.equal(next.sources[0].outputVersion, 2)

    for (const invalidBaseline of [
      publicationBaseline({ revision: 1, entries: [publishedV1, publishedV1] }),
      publicationBaseline({ revision: 1, entries: [{ ...publishedV1, objectKeys: [...publishedV1.objectKeys].reverse() }] }),
      { ...anchored, extra: true },
    ]) {
      await assert.rejects(
        createPlan({
          audit: syntheticAudit(),
          processingDeclaration: processingDeclaration({
            assignments: [assignment(undefined, { outputVersion: 2 })],
            publishedOutputs: [publishedV1],
          }),
          publicationBaseline: invalidBaseline,
          repoRoot: worktreeRoot,
          outputRoot: outside,
        }),
        /baseline|duplicate|unknown|object/i,
      )
    }
  })

  it("fails closed for relative, repository-contained, aliased, and filesystem-root outputs", async (t) => {
    const createPlan = requireExport(plannerModule, "createSoundProcessingPlan")
    const worktreeRoot = await createDirectoryFixture(t, "ml-processing-repo-")
    const mainCheckoutRoot = await createDirectoryFixture(t, "ml-processing-main-")
    const outside = await createDirectoryFixture(t, "ml-processing-outside-")
    const base = { audit: syntheticAudit(), processingDeclaration: processingDeclaration(), repoRoot: worktreeRoot }

    const linkedGitDir = join(mainCheckoutRoot, ".git", "worktrees", "linked")
    await mkdir(linkedGitDir, { recursive: true })
    await writeFile(join(linkedGitDir, "commondir"), "../..\n")
    await writeFile(join(worktreeRoot, ".git"), `gitdir: ${linkedGitDir}\n`)

    await assert.rejects(createPlan(base), /output root.*required|explicit/i)
    await assert.rejects(createPlan({ ...base, outputRoot: "relative-output" }), /absolute/i)
    await assert.rejects(createPlan({ ...base, outputRoot: worktreeRoot }), /outside|repository|worktree/i)
    await assert.rejects(createPlan({ ...base, outputRoot: join(worktreeRoot, "outputs") }), /outside|repository|worktree/i)
    await assert.rejects(createPlan({ ...base, outputRoot: mainCheckoutRoot }), /outside|repository|worktree/i)
    await assert.rejects(createPlan({ ...base, outputRoot: join(mainCheckoutRoot, "outputs") }), /outside|repository|worktree/i)
    await assert.rejects(createPlan({ ...base, outputRoot: parse(outside).root }), /filesystem root/i)
    if (process.platform === "win32") {
      await assert.rejects(createPlan({ ...base, outputRoot: join(worktreeRoot.toUpperCase(), "CASE-ALIAS") }), /outside|repository|worktree/i)
    }

    const alias = join(outside, "repo-alias")
    try {
      await symlink(worktreeRoot, alias, process.platform === "win32" ? "junction" : "dir")
    } catch (error) {
      if (["EACCES", "EPERM", "ENOTSUP", "UNKNOWN"].includes(error?.code)) return
      throw error
    }
    await assert.rejects(createPlan({ ...base, outputRoot: join(alias, "planned") }), /outside|repository|worktree/i)
  })

  it("rejects an external lexical alias whose canonical destination is the filesystem root", async (t) => {
    const createPlan = requireExport(plannerModule, "createSoundProcessingPlan")
    const worktreeRoot = await createDirectoryFixture(t, "ml-processing-repo-")
    const outside = await createDirectoryFixture(t, "ml-processing-outside-")
    const alias = join(outside, "filesystem-root-alias")
    try {
      await symlink(parse(outside).root, alias, process.platform === "win32" ? "junction" : "dir")
    } catch (error) {
      if (["EACCES", "EPERM", "ENOTSUP", "UNKNOWN"].includes(error?.code)) {
        t.skip(`filesystem-root alias unavailable on this host: ${error.code}`)
        return
      }
      throw error
    }

    await assert.rejects(
      createPlan({
        audit: syntheticAudit(),
        processingDeclaration: processingDeclaration(),
        repoRoot: worktreeRoot,
        outputRoot: alias,
      }),
      /filesystem root/i,
    )
  })

  it("accepts a nonexistent external output without creating it", async (t) => {
    const createPlan = requireExport(plannerModule, "createSoundProcessingPlan")
    const worktreeRoot = await createDirectoryFixture(t, "ml-processing-repo-")
    const outside = await createDirectoryFixture(t, "ml-processing-outside-")
    const outputRoot = join(outside, "does-not-exist", "nested")
    const before = await listTree(outside)
    const plan = await createPlan({ audit: syntheticAudit(), processingDeclaration: processingDeclaration(), repoRoot: worktreeRoot, outputRoot })

    assert.equal(plan.sources.length, 1)
    assert.equal(await pathExists(outputRoot), false)
    assert.deepEqual(await listTree(outside), before)
  })
})

describe("AtmoShaper sound processing plan CLI", () => {
  it("runs a fresh zero-assignment audit, prints JSON only, and performs no writes", async (t) => {
    const runCli = requireExport(cliModule, "runSoundProcessingPlanCli")
    const signatureRoot = await createDirectoryFixture(t, "ml-processing-signature-")
    const outside = await createDirectoryFixture(t, "ml-processing-outside-")
    const outputRoot = join(outside, "planned-output")
    await mkdir(join(signatureRoot, "Pack"))
    await writeFile(join(signatureRoot, "Pack", "unassigned.wav"), "fixture-audio")
    const before = await listTree(signatureRoot)
    let stdout = ""

    assert.equal(await runCli({
      args: [signatureRoot, "--output-root", outputRoot],
      repoRoot,
      moodistConcepts,
      signatureDeclaration: { version: 1, candidates: [] },
      processingDeclaration: processingDeclaration({ sourceMeasurements: [], assignments: [], publishedOutputs: [] }),
      stdout: (value) => { stdout += value },
    }), 0)
    const plan = JSON.parse(stdout)
    assert.equal(plan.state, "no-qualified-assignments")
    assert.deepEqual(plan.sources, [])
    assert.equal(await pathExists(outputRoot), false)
    assert.deepEqual(await listTree(signatureRoot), before)
    assert.doesNotMatch(stdout, new RegExp(signatureRoot.replaceAll("\\", "\\\\"), "i"))
    assert.doesNotMatch(stdout, new RegExp(outputRoot.replaceAll("\\", "\\\\"), "i"))
    assert.match(await readFile(cliPath, "utf8"), /sound-publication-ledger-baseline\.json/)
  })

  it("requires exactly one Signature root and one explicit output-root option", async () => {
    const runCli = requireExport(cliModule, "runSoundProcessingPlanCli")
    for (const args of [
      [],
      ["signature-root"],
      ["signature-root", "--output-root"],
      ["one", "two", "--output-root", resolve(tmpdir(), "out")],
      ["signature-root", "--output-root", resolve(tmpdir(), "out"), "--unknown"],
    ]) {
      await assert.rejects(runCli({ args, repoRoot, stdout: () => {} }), /usage|exactly|unknown|requires/i)
    }
  })

  it("exits nonzero with a concise error through the executable entrypoint", async () => {
    const result = await runNode([cliPath])
    assert.notEqual(result.exitCode, 0)
    assert.equal(result.stdout, "")
    assert.match(result.stderr, /^AtmoShaper sound processing plan failed: /)
    assert.doesNotMatch(result.stderr, /\n\s+at\s/m)
  })
})
