import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  OPUS_WEB_AUDIO_FORMAT,
  createWebAudioFormatPlan,
  createWebAudioVariantSampleObject,
} from "../lib/atmosphere/web-audio-format-pilot.js"

describe("Atmosphere web-audio format pilot", () => {
  it("builds an Opus sidecar sample index without changing the WAV object layout", () => {
    const variant = createWebAudioVariantSampleObject({
      sourceObject: {
        instrumentName: "observable-streams__vsco2-piano-mf",
        noteName: "C4",
        outputFileName: "rendered-piano-c4.wav",
        objectKey:
          "atmosphere/observable-streams-vsco-adaptation/rendered/observable-streams__vsco2-piano-mf/rendered-piano-c4.wav",
        sizeBytes: 1_024_000,
      },
      objectPrefix: "atmosphere/observable-streams-vsco-adaptation",
      publicBaseUrl: "https://media.massagelab.app",
      encodedBody: new Uint8Array(64_000),
    })
    const plan = createWebAudioFormatPlan({
      objectPrefix: "atmosphere/observable-streams-vsco-adaptation",
      publicBaseUrl: "https://media.massagelab.app",
      sourceSampleIndexObjectKey: "atmosphere/observable-streams-vsco-adaptation/sample-index.json",
      sourceManifestObjectKey: "atmosphere/observable-streams-vsco-adaptation/manifest.json",
      sourcePayloadBytes: 1_024_000,
      variantSampleObjects: [variant],
      metadataCacheControl: "public, max-age=300, must-revalidate",
    })

    assert.equal(OPUS_WEB_AUDIO_FORMAT.id, "opus")
    assert.equal(
      variant.objectKey,
      "atmosphere/observable-streams-vsco-adaptation/web/opus/rendered/observable-streams__vsco2-piano-mf/rendered-piano-c4.opus.ogg",
    )
    assert.equal(variant.contentType, "audio/ogg; codecs=opus")
    assert.equal(
      plan.sampleIndex["observable-streams__vsco2-piano-mf"].C4,
      "https://media.massagelab.app/atmosphere/observable-streams-vsco-adaptation/web/opus/rendered/observable-streams__vsco2-piano-mf/rendered-piano-c4.opus.ogg",
    )
    assert.equal(plan.sampleIndexObjectKey, "atmosphere/observable-streams-vsco-adaptation/sample-index.opus.json")
    assert.equal(plan.manifestObjectKey, "atmosphere/observable-streams-vsco-adaptation/manifest.opus.json")
    assert.equal(plan.metadataObjects.length, 2)
    assert.equal(plan.metadataObjects[0].cacheControl, "public, max-age=300, must-revalidate")
    assert.equal(plan.manifest.compressionRatio, 0.0625)
    assert.equal(plan.manifest.sourceSampleIndexObjectKey, "atmosphere/observable-streams-vsco-adaptation/sample-index.json")
  })

  it("rejects source objects outside the pilot object prefix", () => {
    assert.throws(
      () => createWebAudioVariantSampleObject({
        sourceObject: {
          instrumentName: "vsco2-piano-mf",
          noteName: "C4",
          outputFileName: "piano-c4.wav",
          objectKey: "atmosphere/other/samples/piano-c4.wav",
        },
        objectPrefix: "atmosphere/observable-streams-vsco-adaptation",
        publicBaseUrl: "https://media.massagelab.app",
        encodedBody: new Uint8Array([1]),
      }),
      /outside object prefix/,
    )
  })
})
