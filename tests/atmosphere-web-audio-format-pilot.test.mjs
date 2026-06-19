import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  AAC_WEB_AUDIO_FORMAT,
  MP3_WEB_AUDIO_FORMAT,
  OPUS_WEB_AUDIO_FORMAT,
  getWebAudioSidecarFormat,
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

  it("builds AAC and MP3 sidecar object layouts for browser fallbacks", () => {
    const sourceObject = {
      instrumentName: "vsco2-piano-mf",
      noteName: "C4",
      outputFileName: "piano-c4.wav",
      objectKey: "atmosphere/generative-fm/aisatsana/samples/piano-c4.wav",
      sizeBytes: 1_024_000,
    }

    const aacVariant = createWebAudioVariantSampleObject({
      sourceObject,
      objectPrefix: "atmosphere/generative-fm/aisatsana",
      publicBaseUrl: "https://media.massagelab.app",
      encodedBody: new Uint8Array(96_000),
      format: AAC_WEB_AUDIO_FORMAT,
    })
    const mp3Variant = createWebAudioVariantSampleObject({
      sourceObject,
      objectPrefix: "atmosphere/generative-fm/aisatsana",
      publicBaseUrl: "https://media.massagelab.app",
      encodedBody: new Uint8Array(128_000),
      format: MP3_WEB_AUDIO_FORMAT,
    })

    assert.equal(aacVariant.objectKey, "atmosphere/generative-fm/aisatsana/web/aac/samples/piano-c4.m4a")
    assert.equal(aacVariant.contentType, "audio/mp4; codecs=mp4a.40.2")
    assert.equal(AAC_WEB_AUDIO_FORMAT.canPlayType, 'audio/mp4; codecs="mp4a.40.2"')
    assert.equal(mp3Variant.objectKey, "atmosphere/generative-fm/aisatsana/web/mp3/samples/piano-c4.mp3")
    assert.equal(mp3Variant.contentType, "audio/mpeg")
    assert.equal(MP3_WEB_AUDIO_FORMAT.canPlayType, "audio/mpeg")

    const aacPlan = createWebAudioFormatPlan({
      objectPrefix: "atmosphere/generative-fm/aisatsana",
      publicBaseUrl: "https://media.massagelab.app",
      sourceSampleIndexObjectKey: "atmosphere/generative-fm/aisatsana/sample-index.json",
      sourceManifestObjectKey: "atmosphere/generative-fm/aisatsana/manifest.json",
      sourcePayloadBytes: sourceObject.sizeBytes,
      variantSampleObjects: [aacVariant],
      format: AAC_WEB_AUDIO_FORMAT,
    })

    assert.equal(aacPlan.sampleIndexObjectKey, "atmosphere/generative-fm/aisatsana/sample-index.aac.json")
    assert.equal(aacPlan.manifestObjectKey, "atmosphere/generative-fm/aisatsana/manifest.aac.json")
    assert.equal(aacPlan.manifest.format.id, "aac")
  })

  it("selects sidecar format definitions by id", () => {
    assert.equal(getWebAudioSidecarFormat("opus"), OPUS_WEB_AUDIO_FORMAT)
    assert.equal(getWebAudioSidecarFormat("aac"), AAC_WEB_AUDIO_FORMAT)
    assert.equal(getWebAudioSidecarFormat("mp3"), MP3_WEB_AUDIO_FORMAT)
    assert.throws(() => getWebAudioSidecarFormat("flac"), /Unsupported web audio sidecar format/)
  })
})
