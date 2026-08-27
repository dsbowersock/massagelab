import assert from "node:assert/strict"
import { describe, it } from "node:test"

async function loadPlayer() {
  try {
    return await import("../lib/atmoshaper/signature-sound-preview-player.js")
  } catch (error) {
    assert.fail(`Signature preview player must load: ${error?.message ?? error}`)
  }
}

describe("AtmoShaper Signature preview audio URL seam", () => {
  it("keeps a complete processed treatment auditionable while later processing remains pending", async () => {
    const { signatureSoundConceptHasAuditionableSources } = await import(
      "../lib/atmoshaper/signature-sound-review-audio-url.js"
    )
    const processedUrl = `/api/dev/atmoshaper-candidates/speech-reduction/batch-45-stadium-crowd/${"b".repeat(64)}`

    assert.equal(signatureSoundConceptHasAuditionableSources({
      reviewState: "processing-required",
      processingRequirements: [
        { kind: "dynamic-range-control", detail: "Reduce cheer spikes." },
        { kind: "level-match", detail: "Level the treated pool." },
      ],
      sources: [{ sourceId: "a".repeat(64), audioUrl: processedUrl }],
    }), true)
    assert.equal(signatureSoundConceptHasAuditionableSources({
      reviewState: "processing-required",
      processingRequirements: [{ kind: "remove-discernible-speech", detail: "Reduce speech." }],
      sources: [{ sourceId: "a".repeat(64) }],
    }), false)
  })

  it("plays a manifest-closed derived URL while retaining source identity for scheduling", async () => {
    const { createSignatureSoundPreviewPlayer } = await loadPlayer()
    const created = []
    const player = createSignatureSoundPreviewPlayer({
      resolveAudioUrl(source) { return source.audioUrl },
      createAudio(url) {
        const audio = {
          url,
          currentTime: 0,
          duration: 1,
          volume: 1,
          onended: null,
          onloadedmetadata: null,
          ontimeupdate: null,
          play() { return Promise.resolve() },
          pause() {},
        }
        created.push(audio)
        return audio
      },
      random: () => 0,
    })
    const sourceId = "a".repeat(64)
    const outputIdentity = "b".repeat(64)

    await player.start({
      groupId: "signature-extra:sci-fi-whistles:short-delay",
      strategyId: "spaced-event-sequence",
      previewSettings: { minimumGapSeconds: 0, maximumGapSeconds: 8 },
      sources: [{
        sourceId,
        relativePath: "Sci-Fi Whistles/one.wav",
        audioUrl: `/api/dev/atmoshaper-candidates/derived/${outputIdentity}`,
      }],
    })

    assert.equal(created.length, 1)
    assert.equal(created[0].url, `/api/dev/atmoshaper-candidates/derived/${outputIdentity}`)
    player.stop()
  })
})
