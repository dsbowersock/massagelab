import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

describe("AtmoShaper Batch 04 edit-concept review UI", () => {
  it("selects every registered immutable batch through server-owned catalog roots", async () => {
    const page = await readFile(
      new URL("../app/dev/candidates/processing/page.tsx", import.meta.url),
      "utf8",
    )
    const shell = await readFile(
      new URL("../app/dev/candidates/processing/processing-review-shell.tsx", import.meta.url),
      "utf8",
    )

    assert.match(page, /searchParams:\s*Promise<\{\s*batch\?:\s*string\s*\|\s*string\[\]/)
    assert.match(page, /await searchParams/)
    assert.match(page, /signature-sound-derived-audio-batch-registry\.json/)
    assert.match(page, /validateSignatureSoundDerivedAudioBatchRegistry/)
    assert.match(page, /selectSignatureSoundDerivedAudioBatchEntry/)
    assert.match(page, /loadDevSignatureDerivedCatalogBatch/)
    assert.match(page, /ATMOSHAPER_SIGNATURE_DERIVED_CATALOG_ROOT/)
    assert.match(page, /ATMOSHAPER_SIGNATURE_DERIVED_ROOT/)
    assert.match(page, /TERMINAL_CATALOG_REVIEW_STATES/)
    assert.match(page, /audible-qa-complete-dry-selected/)
    assert.match(page, /manifestAnchors\.entries\.find\(\(entry\) => !TERMINAL_CATALOG_REVIEW_STATES\.has\(entry\.state\)\)/)
    assert.match(page, /firstPendingWholeConcept = wholeConceptCatalog\.entries\.find/)
    assert.match(page, /defaultCatalogBatchId = pendingCatalogEntry[\s\S]*firstPendingWholeConcept/)
    assert.match(page, /if \(!catalogRoot && rawBatch === undefined\)/)
    assert.match(shell, /activeProcessedBatches\.map/)
    assert.match(shell, /RETIRED_PROCESSED_BATCH_IDS/)
    assert.match(shell, /\/dev\/candidates\/processing\?batch=/)
    assert.match(page, /batch-03-sci-fi-whistles-treatment-audition-v2/)
    assert.match(page, /batch-04-boiling-water-edit-audition-v2/)
  })

  it("dispatches Batch 04 through its exact edit manifest and committed 8-second selection", async () => {
    const page = await readFile(
      new URL("../app/dev/candidates/processing/page.tsx", import.meta.url),
      "utf8",
    )
    const shell = await readFile(
      new URL("../app/dev/candidates/processing/processing-review-shell.tsx", import.meta.url),
      "utf8",
    )

    assert.match(page, /signature-sound-derived-audio-batch-04-boiling-water-edit-audition\.json/)
    assert.match(page, /validateSignatureSoundEditAuditionBatch/)
    assert.match(page, /validateSignatureSoundEditAuditionManifest/)
    assert.match(page, /createSignatureSoundEditConceptQaDraft/)
    assert.match(page, /signature-sound-edit-concept-qa-batch-04-boiling-water\.json/)
    assert.match(page, /applySignatureSoundEditConceptQaSelection/)
    assert.match(shell, /EditConceptReview/)
  })

  it("plays the complete concept once from zero and then repeats only the declared loop region", async () => {
    const client = await readFile(
      new URL("../app/dev/candidates/processing/edit-concept-review.tsx", import.meta.url),
      "utf8",
    )

    assert.match(client, /^"use client"/)
    assert.match(client, /recordSignatureSoundEditConceptQaAudition/)
    assert.match(client, /recordSignatureSoundEditConceptQaSeamCrossing/)
    assert.match(client, /updateSignatureSoundEditConceptQaVariant/)
    assert.match(client, /validateSignatureSoundEditConceptQa/)
    assert.match(client, /exportSignatureSoundEditConceptQa/)
    assert.match(client, /localStorage\.getItem\(storageKey\)/)
    assert.match(client, /localStorage\.setItem\(storageKey/)
    assert.match(client, /applySignatureSoundEditConceptQaSelection\(\s*restored,\s*initialQa\.directSelection,\s*context\s*,?\s*\)/s)
    assert.match(client, /manifest\.batchId.*manifest\.batchDeclarationSha256.*manifestSha256/s)
    assert.match(client, /\/api\/dev\/atmoshaper-candidates\/audio\/\$\{sourceId\}/)
    assert.match(client, /\/api\/dev\/atmoshaper-candidates\/derived\/\$\{manifest\.batchId\}\/\$\{variant\.outputIdentity\}/)
    assert.match(client, /AudioContext/)
    assert.match(client, /decodeAudioData/)
    assert.match(client, /source\.loopStart\s*=\s*firstLoopOffsetSeconds/)
    assert.match(client, /source\.loopEnd\s*=\s*buffer\.duration/)
    assert.match(client, /Start complete-concept audition/)
    assert.match(client, /0:00 through 1:30 once/)
    assert.match(client, /0:15–1:30/)
    assert.match(client, /Loop transitions heard/)
    assert.match(client, /endToStartSeamCrossings\.length\s*>=\s*2/)
    assert.match(client, /decision:\s*"pass"/)
    assert.match(client, /decision:\s*"change"/)
    assert.match(client, /decision:\s*"reject"/)
    assert.match(client, /Boolean\(variant\.note\.trim\(\)\)/)
    assert.match(client, /directSelection/)
    assert.match(client, /Direct reviewer selection recorded/)
    assert.doesNotMatch(client, /createSignatureSoundPreviewPlayer/)
    assert.doesNotMatch(client, /construction-audition|ConstructionAudition/i)
  })
})
