import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

describe("AtmoShaper Batch 05 Dryer whole-concept review", () => {
  it("dispatches the immutable Dryer batch through the shared catalog", async () => {
    const page = await readFile(
      new URL("../app/dev/candidates/processing/page.tsx", import.meta.url),
      "utf8",
    )
    const shell = await readFile(
      new URL("../app/dev/candidates/processing/processing-review-shell.tsx", import.meta.url),
      "utf8",
    )
    const route = await readFile(
      new URL("../app/api/dev/atmoshaper-candidates/derived/[batchOrOutputIdentity]/[outputIdentity]/route.ts", import.meta.url),
      "utf8",
    )

    for (const source of [page, route]) {
      assert.match(source, /signature-sound-derived-audio-batch-05-dryer-trim-audition\.json/)
      assert.match(source, /batch-05-dryer-trim-audition/)
    }
    assert.match(shell, /DryerConceptReview/)
    assert.match(shell, /Batch 05 · Dryer boundary trim/)
    assert.match(page, /signature-sound-dryer-concept-selection\.json/)
    assert.match(page, /validateSignatureSoundDryerConceptSelection/)
  })

  it("presents dry and trimmed Dryer as complete dynamic concepts without a button-completion burden", async () => {
    const client = await readFile(
      new URL("../app/dev/candidates/processing/dryer-concept-review.tsx", import.meta.url),
      "utf8",
    )

    assert.match(client, /^"use client"/)
    assert.match(client, /createSignatureSoundPreviewPlayer/)
    assert.match(client, /adaptive-whole-source-sequence/)
    assert.match(client, /minimumSeconds:\s*3\.75/)
    assert.match(client, /maximumSeconds:\s*10/)
    assert.match(client, /\/api\/dev\/atmoshaper-candidates\/audio\/\$\{sourceId\}/)
    assert.match(client, /\/api\/dev\/atmoshaper-candidates\/derived\/\$\{manifest\.batchId\}\/\$\{output\.outputIdentity\}/)
    assert.match(client, /Dry concept/)
    assert.match(client, /Trimmed candidate/)
    assert.match(client, /1\.8–17\.7/)
    assert.match(client, /0\.15-second boundary fades/)
    assert.match(client, /Reply in chat with what works or what should change/)
    assert.match(client, /Direct reviewer selection recorded/)
    assert.match(client, /selection\.selectedTarget === "dry"/)
    assert.match(client, /selection\.selectedTarget === "trimmed"/)
    assert.doesNotMatch(client, /DecisionButton|Export.*QA|Needs rebuild/)
  })
})
