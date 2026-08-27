import assert from "node:assert/strict"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, it } from "node:test"

async function loadAudioModule() {
  try {
    return await import("../lib/atmoshaper/dev-candidate-audio.js")
  } catch (error) {
    assert.fail(`Dev candidate audio owner must load: ${error?.message ?? error}`)
  }
}

describe("AtmoShaper dev candidate review", () => {
  it("resolves only manifest-listed audio under the server-owned root", async (t) => {
    const { resolveDevCandidateAudioSource } = await loadAudioModule()
    const rootPath = await mkdtemp(join(tmpdir(), "ml-dev-candidate-audio-"))
    t.after(() => rm(rootPath, { recursive: true, force: true }))
    await mkdir(join(rootPath, "Snow Pack"))
    await writeFile(join(rootPath, "Snow Pack", "step.wav"), "snow-step")
    const sourceId = "a".repeat(64)
    const manifest = {
      sources: [{
        sourceId,
        relativePath: "Snow Pack/step.wav",
        byteSize: 9,
        extension: ".wav",
        sha256: "a27bd0598dd34ae86689d2ca99ac153bc05b0ab1263e826efb1251fbec8d6b90",
      }],
    }

    const resolved = await resolveDevCandidateAudioSource({
      sourceId,
      manifest,
      sourceRoot: rootPath,
      nodeEnv: "development",
    })
    assert.equal(resolved.byteSize, 9)
    assert.equal(resolved.mimeType, "audio/wav")
    assert.deepEqual(resolved.bytes, Buffer.from("snow-step"))
    assert.equal("absolutePath" in resolved, false)

    await assert.rejects(() => resolveDevCandidateAudioSource({
      sourceId,
      manifest,
      sourceRoot: rootPath,
      nodeEnv: "production",
    }), /development|production|disabled/i)
    await assert.rejects(() => resolveDevCandidateAudioSource({
      sourceId: "b".repeat(64),
      manifest,
      sourceRoot: rootPath,
      nodeEnv: "development",
    }), /manifest|source|unknown/i)
    await assert.rejects(() => resolveDevCandidateAudioSource({
      sourceId,
      manifest: { sources: [{ ...manifest.sources[0], relativePath: "../outside.wav" }] },
      sourceRoot: rootPath,
      nodeEnv: "development",
    }), /relative|outside|path/i)
    await assert.rejects(() => resolveDevCandidateAudioSource({
      sourceId,
      manifest: { sources: [{ ...manifest.sources[0], byteSize: 10 }] },
      sourceRoot: rootPath,
      nodeEnv: "development",
    }), /size|changed|inventory/i)
  })

  it("parses single HTTP byte ranges and rejects unsafe or unsatisfiable ranges", async () => {
    const { parseDevCandidateByteRange } = await loadAudioModule()
    assert.deepEqual(parseDevCandidateByteRange(undefined, 10), { start: 0, end: 9, status: 200 })
    assert.deepEqual(parseDevCandidateByteRange("bytes=2-5", 10), { start: 2, end: 5, status: 206 })
    assert.deepEqual(parseDevCandidateByteRange("bytes=7-", 10), { start: 7, end: 9, status: 206 })
    assert.deepEqual(parseDevCandidateByteRange("bytes=-3", 10), { start: 7, end: 9, status: 206 })
    for (const invalid of ["items=0-1", "bytes=", "bytes=1-2,4-5", "bytes=10-11", "bytes=5-2"]) {
      assert.throws(() => parseDevCandidateByteRange(invalid, 10), RangeError)
    }
  })

  it("keeps the page and audio route development-only with local review export", async () => {
    const layout = await readFile(new URL("../app/dev/candidates/layout.tsx", import.meta.url), "utf8")
    const page = await readFile(new URL("../app/dev/candidates/page.tsx", import.meta.url), "utf8")
    const recordingsPage = await readFile(new URL("../app/dev/candidates/recordings/page.tsx", import.meta.url), "utf8")
    const conceptsPage = await readFile(new URL("../app/dev/candidates/concepts/page.tsx", import.meta.url), "utf8")
    const client = await readFile(new URL("../app/dev/candidates/candidate-review.tsx", import.meta.url), "utf8")
    const route = await readFile(
      new URL("../app/api/dev/atmoshaper-candidates/audio/[sourceId]/route.ts", import.meta.url),
      "utf8",
    )
    assert.match(layout, /NODE_ENV\s*===\s*["']production["']/)
    assert.match(layout, /notFound\s*\(/)
    assert.doesNotMatch(layout, /signature-sound-review\.json/)
    assert.doesNotMatch(layout, /SignatureSoundReviewWorkspaceProvider/)
    assert.doesNotMatch(page, /useSignatureSoundReviewWorkspace/)
    assert.match(recordingsPage, /SignatureSoundReviewWorkspaceProvider/)
    assert.match(conceptsPage, /SignatureSoundReviewWorkspaceProvider/)
    assert.match(page, /href=["']\/dev\/candidates\/recordings["']/)
    assert.match(page, /href=["']\/dev\/candidates\/concepts["']/)
    assert.match(client, /useSignatureSoundReviewWorkspace/)
    assert.doesNotMatch(client, /localStorage/)
    assert.match(client, /Keep/)
    assert.match(client, /Maybe/)
    assert.match(client, /Reject/)
    assert.match(route, /NODE_ENV\s*===\s*["']production["']/)
    assert.match(route, /ATMOSHAPER_SIGNATURE_SOUNDS_ROOT/)
    assert.doesNotMatch(route, /searchParams\.get\(["']root["']\)/)
    assert.match(route, /Accept-Ranges/)
    assert.doesNotMatch(route, /createReadStream|absolutePath/)
    assert.match(route, /source\.bytes\.subarray\(byteRange\.start,\s*byteRange\.end\s*\+\s*1\)/)
  })

  it("projects imported source decisions without replacing the local recording draft", async () => {
    const page = await readFile(new URL("../app/dev/candidates/recordings/page.tsx", import.meta.url), "utf8")
    const client = await readFile(new URL("../app/dev/candidates/candidate-review.tsx", import.meta.url), "utf8")
    assert.match(page, /CandidateReview/)
    assert.match(client, /Recording review/)
    assert.doesNotMatch(client, /Committed curation/)
    assert.match(client, /Include for concept/)
    assert.match(client, /Remove from concept/)
    assert.match(client, /Add concept/)
    assert.match(client, /addSignatureSoundCustomConcept/)
    assert.match(client, /updateSignatureSoundConceptAssignment/)
  })

  it("provides a separate fingerprinted group strategy approval and change workflow", async () => {
    const page = await readFile(new URL("../app/dev/candidates/concepts/page.tsx", import.meta.url), "utf8")
    const groupReview = await readFile(
      new URL("../app/dev/candidates/group-strategy-review.tsx", import.meta.url),
      "utf8",
    )
    const ingredients = await readFile(
      new URL("../app/dev/candidates/concept-ingredient-review.tsx", import.meta.url),
      "utf8",
    )
    assert.match(page, /GroupStrategyReview/)
    assert.match(groupReview, /Review group strategies/)
    assert.match(groupReview, /Approve heard setup/)
    assert.match(groupReview, /Needs changes/)
    assert.match(groupReview, /sourceCounts/)
    assert.match(groupReview, /strategyId/)
    assert.match(groupReview, /useSignatureSoundReviewWorkspace/)
    assert.match(groupReview, /createSignatureSoundExactPreviewAuditionKey/)
    assert.match(groupReview, /ConceptIngredientReview/)
    assert.doesNotMatch(groupReview, /localStorage/)
    assert.doesNotMatch(groupReview, /sourcePool/)
    assert.match(ingredients, /Include/)
    assert.match(ingredients, /Remove/)
    assert.match(ingredients, /Play this in setup/)
    assert.match(ingredients, /playing/i)
    assert.match(ingredients, /textarea/)
  })

  it("requires an audible current-configuration preview and retains the page for future concepts", async () => {
    const page = await readFile(new URL("../app/dev/candidates/concepts/page.tsx", import.meta.url), "utf8")
    const groupReview = await readFile(
      new URL("../app/dev/candidates/group-strategy-review.tsx", import.meta.url),
      "utf8",
    )
    const preview = await readFile(
      new URL("../app/dev/candidates/group-strategy-preview.tsx", import.meta.url),
      "utf8",
    )
    const player = await readFile(
      new URL("../lib/atmoshaper/signature-sound-preview-player.js", import.meta.url),
      "utf8",
    )

    assert.match(page, /GroupStrategyReview/)
    assert.match(groupReview, /GroupStrategyPreview/)
    assert.match(groupReview, /auditionKey/)
    assert.match(groupReview, /auditionedAt/)
    assert.match(groupReview, /disabled=.*audition/i)
    assert.match(groupReview, /const heardAuditionKey\s*=\s*exactAuditionKey\(group\)/)
    assert.match(groupReview, /auditionKey:\s*heardAuditionKey/)
    assert.match(groupReview, /createSignatureSoundExactPreviewAuditionKey/)
    assert.match(preview, /Start preview/)
    assert.match(preview, /Stop preview/)
    assert.match(preview, /Next (transition|event)/)
    assert.doesNotMatch(preview, /Keep \+ Maybe/)
    assert.doesNotMatch(preview, /Keep only/)
    assert.doesNotMatch(preview, /sourcePool/)
    assert.match(preview, /steps per minute/i)
    assert.match(preview, /crossfade/i)
    assert.match(preview, /minimum gap/i)
    assert.match(player, /createSignatureSoundPreviewPlayer/)
    assert.match(player, /\/api\/dev\/atmoshaper-candidates\/audio\//)
  })

  it("keeps active zero-ingredient concepts visible without creating an impossible audition identity", async () => {
    const groupReview = await readFile(
      new URL("../app/dev/candidates/group-strategy-review.tsx", import.meta.url),
      "utf8",
    )
    assert.match(
      groupReview,
      /group\.includedSourceIds\.length\s*>\s*0\s*\?\s*exactAuditionKey\(group\)\s*:\s*null/,
    )
    assert.match(groupReview, /currentAuditionKey\s*!==\s*null\s*&&/)
    assert.match(groupReview, /Needs included sources/)
  })

  it("uses one validated v3 provider for legacy-safe persistence, cross-tab updates, and complete export", async () => {
    const provider = await readFile(
      new URL("../app/dev/candidates/review-workspace-provider.tsx", import.meta.url),
      "utf8",
    )
    assert.match(provider, /SignatureSoundReviewWorkspaceProvider/)
    assert.match(provider, /migrateSignatureSoundReviewWorkspaceSafely/)
    assert.match(provider, /validateSignatureSoundReviewWorkspace/)
    assert.match(provider, /renderSignatureSoundReviewWorkspaceJson/)
    assert.match(provider, /atmoshaper-signature-candidates:/)
    assert.match(provider, /atmoshaper-signature-group-review-v2:/)
    assert.match(provider, /addEventListener\("storage"/)
    assert.match(provider, /Export complete review/)
    assert.doesNotMatch(provider, /removeItem\(legacy/)
    assert.doesNotMatch(provider, /setItem\(legacy/)
  })

  it("retains a separate exact construction audition and QA page", async () => {
    const hub = await readFile(new URL("../app/dev/candidates/page.tsx", import.meta.url), "utf8")
    const page = await readFile(
      new URL("../app/dev/candidates/construction/page.tsx", import.meta.url),
      "utf8",
    )
    const client = await readFile(
      new URL("../app/dev/candidates/construction/construction-audition-review.tsx", import.meta.url),
      "utf8",
    )

    assert.match(hub, /href=["']\/dev\/candidates\/construction["']/)
    assert.match(hub, /Audition rebuilt construction/)
    assert.match(page, /signature-sound-construction-audition\.json/)
    assert.doesNotMatch(page, /createSignatureSoundConstructionAudition/)
    assert.match(page, /ConstructionAuditionReview/)
    assert.match(page, /discoveryReview\.sources/)
    assert.match(client, /createSignatureSoundPreviewPlayer/)
    assert.match(client, /constructionPolicy/)
    assert.match(client, /createSignatureSoundConstructionQaStorageKey/)
    assert.match(client, /loadSignatureSoundConstructionQa/)
    assert.match(client, /validateSignatureSoundConstructionQa/)
    assert.match(client, /recordSignatureSoundConstructionQaAudition/)
    assert.match(client, /persistSignatureSoundConstructionQa/)
    assert.match(client, /updateSignatureSoundConstructionQaDecision/)
    assert.match(client, /renderSignatureSoundConstructionQaJson/)
    assert.match(client, /Start construction preview/)
    assert.match(client, /Confirm current setup heard/)
    assert.match(client, /Stop preview/)
    assert.match(client, /Next (transition|event)/)
    assert.match(client, /Playback only/)
    assert.match(client, /Complete construction/)
    assert.match(client, /group\.allowedQaScopes\.length === 1/)
    assert.match(client, /QA scope is fixed to Playback only/i)
    assert.match(client, /Construction decision/)
    assert.match(client, /This exact setup is confirmed/i)
    assert.match(client, /Needs rebuild/)
    assert.match(client, /Reject/)
    assert.match(client, /group\.blockers/)
    assert.match(client, /group\.processingIntentIds/)
    assert.match(client, /Crossfade/)
    assert.match(client, /Overlap/)
    assert.match(client, /Export construction QA/)
    assert.match(client, /Import construction QA/)
    assert.match(client, /parseSignatureSoundConstructionQaJson/)
    assert.match(client, /accept=["']application\/json["']/)
    assert.match(client, /Pass requires a confirmed setup/i)
    assert.match(client, /Needs rebuild or Reject.*note/i)
    const startPreviewStart = client.indexOf("async function startPreview")
    const confirmAuditionStart = client.indexOf("function confirmAudition", startPreviewStart)
    const confirmAuditionEnd = client.indexOf("function updateNote", confirmAuditionStart)
    assert.ok(startPreviewStart >= 0 && confirmAuditionStart > startPreviewStart)
    assert.doesNotMatch(
      client.slice(startPreviewStart, confirmAuditionStart),
      /recordSignatureSoundConstructionQaAudition/,
      "starting playback must not fabricate heard evidence",
    )
    const confirmAudition = client.slice(confirmAuditionStart, confirmAuditionEnd)
    assert.match(confirmAudition, /activeAudition\.auditionKey\s*!==\s*currentKey/)
    assert.match(confirmAudition, /configuration:\s*activeAudition\.configuration/)
    assert.match(confirmAudition, /recordSignatureSoundConstructionQaAudition/)
    assert.match(client, /activeAuditionRef/)
    assert.match(client, /disabled=\{!active\}[\s\S]*Confirm current setup heard/)
    assert.match(client, /label="Pass heard setup"[\s\S]*disabled=\{!heardCurrent\}/)
    assert.match(client, /noteBackedNegativeAllowed/)
    assert.match(client, /disabled=\{!heardCurrent && !noteBackedNegativeAllowed\}/)
    assert.match(client, /setPersistenceWarning\(persisted \? null :/)
    assert.match(client, /not persisted/i)
    assert.match(client, /addEventListener\("storage"/)
    const storageHandlerStart = client.indexOf("const onStorage")
    const storageHandlerEnd = client.indexOf("window.addEventListener", storageHandlerStart)
    const storageHandler = client.slice(storageHandlerStart, storageHandlerEnd)
    assert.ok(storageHandler.indexOf("stopPreview()") >= 0)
    assert.ok(storageHandler.indexOf("stopPreview()") < storageHandler.indexOf("restoreSelections("))
    assert.doesNotMatch(client, /removeItem\(/)
    assert.doesNotMatch(client, /atmoshaper-signature-candidates:/)
    assert.doesNotMatch(client, /atmoshaper-signature-group-review-v2:/)
  })

  it("retains a development-only source-versus-derived processing review", async () => {
    const hub = await readFile(new URL("../app/dev/candidates/page.tsx", import.meta.url), "utf8")
    const layout = await readFile(new URL("../app/dev/candidates/layout.tsx", import.meta.url), "utf8")
    const page = await readFile(new URL("../app/dev/candidates/processing/page.tsx", import.meta.url), "utf8")
    const shell = await readFile(new URL("../app/dev/candidates/processing/processing-review-shell.tsx", import.meta.url), "utf8")
    const client = await readFile(new URL("../app/dev/candidates/processing/derived-audio-review.tsx", import.meta.url), "utf8")
    const treatmentClient = await readFile(
      new URL("../app/dev/candidates/processing/treatment-audition-review.tsx", import.meta.url),
      "utf8",
    ).catch((error) => assert.fail(`Treatment review client must exist: ${error.message}`))
    const treatmentConceptClient = await readFile(
      new URL("../app/dev/candidates/processing/treatment-concept-review.tsx", import.meta.url),
      "utf8",
    ).catch((error) => assert.fail(`Treatment concept review client must exist: ${error.message}`))
    const route = await readFile(new URL("../app/api/dev/atmoshaper-candidates/derived/[batchOrOutputIdentity]/route.ts", import.meta.url), "utf8")

    assert.match(hub, /href=["']\/dev\/candidates\/processing["']/)
    assert.match(layout, /href=["']\/dev\/candidates\/processing["']/)
    assert.match(page, /ATMOSHAPER_SIGNATURE_DERIVED_ROOT/)
    assert.match(page, /validateSignatureSoundDerivedManifest/)
    assert.match(page, /signature-sound-derived-audio-batch-02-air-traffic-control\.json/)
    assert.match(page, /signature-sound-derived-audio-batch-03-sci-fi-whistles-treatment-audition\.json/)
    assert.match(page, /signature-sound-treatment-concept-qa-batch-03-sci-fi-whistles\.json/)
    assert.match(page, /applySignatureSoundTreatmentConceptQaSelection/)
    assert.match(page, /loadDevSignatureDerivedManifestSnapshot/)
    assert.match(page, /validateSignatureSoundTreatmentAuditionManifest/)
    assert.match(shell, /TreatmentAuditionReview/)
    assert.doesNotMatch(page, /Compare source and processed Campfire audio/)
    assert.match(client, /Source recording/)
    assert.match(client, /Processed recording/)
    assert.match(client, /Pass/)
    assert.match(client, /Needs rebuild/)
    assert.match(client, /Reject/)
    assert.match(client, /Export artifact QA/)
    assert.match(client, /heardSource/)
    assert.match(client, /heardDerived/)
    assert.doesNotMatch(client, /title=\{`Campfire recording/)
    assert.match(route, /NODE_ENV\s*===\s*["']production["']/)
    assert.match(route, /ATMOSHAPER_SIGNATURE_DERIVED_ROOT/)
    assert.match(route, /resolveDevSignatureDerivedAudio/)
    assert.match(route, /validateSignatureSoundTreatmentAuditionManifest/)
    assert.doesNotMatch(route, /searchParams\.get\(["']root["']\)/)
    assert.match(route, /Accept-Ranges/)
    assert.match(treatmentClient, /variantLabel/)
    assert.match(treatmentClient, /Dry source/)
    assert.match(treatmentClient, /Effect variant/)
    assert.match(treatmentClient, /delaysMs/)
    assert.match(treatmentClient, /Export treatment QA/)
    assert.match(treatmentClient, /Pass/)
    assert.match(treatmentClient, /Needs rebuild/)
    assert.match(treatmentClient, /Reject/)
    assert.match(treatmentClient, /sourceHeardAt/)
    assert.match(treatmentClient, /derivedHeardAt/)
    assert.match(treatmentClient, /TreatmentConceptReview/)
    assert.match(treatmentClient, /Individual recording diagnostics/)
    assert.match(treatmentClient, /<details/)
    assert.match(treatmentConceptClient, /Complete concept comparison/)
    assert.match(treatmentConceptClient, /Start concept/)
    assert.match(treatmentConceptClient, /Stop concept/)
    assert.match(treatmentConceptClient, /Next event/)
    assert.match(treatmentConceptClient, /Confirm .* concept heard/)
    assert.match(treatmentConceptClient, /createSignatureSoundPreviewPlayer/)
    assert.match(treatmentConceptClient, /minimumGapSeconds/)
    assert.match(treatmentConceptClient, /maximumGapSeconds/)
    assert.match(treatmentConceptClient, /Export concept QA/)
  })
})
