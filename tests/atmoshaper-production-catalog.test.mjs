import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { readFile } from "node:fs/promises"

import {
  selectAtmoShaperProductionAudioUrl,
  validateAtmoShaperProductionCatalog,
} from "../lib/atmoshaper/production-catalog.js"
import {
  atmoShaperProductionAudioObjectKey,
  atmoShaperProductionCatalogObjectKey,
  collectUniqueAtmoShaperProductionPayloads,
} from "../lib/atmoshaper/production-release-builder.js"

const SHA_A = "a".repeat(64)
const SHA_B = "b".repeat(64)
const SHA_C = "c".repeat(64)
const SHA_D = "d".repeat(64)

function format(id, sha256, extension, contentType) {
  return {
    id,
    publicUrl: `https://media.massagelab.app/atmosphere/atmoshaper/v1/audio/${SHA_A}/${extension}`,
    contentType,
    sha256,
    byteSize: 100,
  }
}

function catalog() {
  return {
    version: 1,
    catalogKind: "atmoshaper-production-audio",
    catalogRevision: SHA_B,
    publishedBaseUrl: "https://media.massagelab.app",
    rights: {
      source: "Signature Sounds",
      license: "CC0",
      evidence: "Creator statement",
    },
    summary: { conceptCount: 1, sourceReferenceCount: 1, uniquePayloadCount: 1 },
    concepts: [{
      id: "moodist-waves",
      batchId: "batch-23-waves",
      groupId: "moodist:waves",
      label: "Waves",
      description: "Reviewed waves.",
      category: "nature",
      origin: "moodist",
      reviewFingerprint: SHA_C,
      playbackConfiguration: {
        strategyId: "adaptive-whole-source-sequence",
        previewSettings: { transitionMode: "crossfade", transitionSeconds: 6 },
        constructionPolicy: null,
      },
      runtimePolicy: null,
      sourceSelection: null,
      playbackMode: null,
      sources: [{
        sourceId: SHA_D,
        label: "Wave 1",
        relativePath: "waves/Wave 1.wav",
        payloadSha256: SHA_A,
        durationSeconds: 30,
        formats: [
          format("opus", SHA_A, "opus.ogg", "audio/ogg; codecs=opus"),
          format("aac", SHA_B, "aac.m4a", "audio/mp4; codecs=mp4a.40.2"),
          format("mp3", SHA_C, "mp3.mp3", "audio/mpeg"),
          format("source", SHA_D, "source.wav", "audio/wav"),
        ],
      }],
    }],
  }
}

describe("AtmoShaper production audio catalog", () => {
  it("validates the checksum-bound catalog and rejects incomplete browser formats", () => {
    const validated = validateAtmoShaperProductionCatalog(catalog())
    assert.equal(validated.concepts.length, 1)
    const incomplete = structuredClone(catalog())
    incomplete.concepts[0].sources[0].formats = incomplete.concepts[0].sources[0].formats.slice(0, 2)
    assert.throws(() => validateAtmoShaperProductionCatalog(incomplete), /three compressed/i)
  })

  it("prefers Opus, then AAC, then MP3, then the source according to browser support", () => {
    const source = catalog().concepts[0].sources[0]
    assert.match(selectAtmoShaperProductionAudioUrl(source, (type) => (
      type.startsWith("audio/mp4") ? "probably" : ""
    )), /aac\.m4a$/)
    assert.match(selectAtmoShaperProductionAudioUrl(source, (type) => (
      type === "audio/mpeg" ? "maybe" : ""
    )), /mp3\.mp3$/)
  })

  it("deduplicates equal payload bytes while retaining separate reviewed source identities", () => {
    const shared = {
      sourceId: SHA_A,
      localPath: "C:/audio/a.wav",
      payloadSha256: SHA_C,
      payloadByteSize: 42,
    }
    const payloads = collectUniqueAtmoShaperProductionPayloads([
      { sources: [shared] },
      { sources: [{ ...shared, sourceId: SHA_B, localPath: "C:/audio/duplicate.wav" }] },
    ])
    assert.equal(payloads.length, 1)
  })

  it("uses immutable content-addressed audio and catalog keys", () => {
    assert.equal(
      atmoShaperProductionAudioObjectKey(SHA_A, "opus.ogg"),
      `atmosphere/atmoshaper/v1/audio/${SHA_A}/opus.ogg`,
    )
    assert.equal(
      atmoShaperProductionCatalogObjectKey(SHA_B),
      `atmosphere/atmoshaper/v1/catalogs/${SHA_B}.json`,
    )
  })

  it("commits the exact 51-concept release with every public rendition", async () => {
    const raw = JSON.parse(await readFile(
      new URL("../data/atmoshaper/production-audio-catalog.json", import.meta.url),
      "utf8",
    ))
    const release = validateAtmoShaperProductionCatalog(raw)
    assert.equal(release.catalogRevision, "df8cb2ceffa9148194c0e60e8d10b6c0d83ad944e3968bd671f97a72301b65fa")
    assert.deepEqual(release.summary, {
      conceptCount: 51,
      sourceReferenceCount: 450,
      uniquePayloadCount: 410,
    })
    assert.equal(release.concepts.length, 51)
    assert.equal(release.concepts.flatMap(({ sources }) => sources).length, 450)
    assert.ok(release.concepts.every(({ sources }) => sources.every(({ formats }) => (
      ["opus", "aac", "mp3", "source"].every((id) => formats.some((format) => format.id === id))
    ))))
  })

  it("wires reviewed ambient concepts into the production library and runtime", async () => {
    const library = await readFile(new URL("../components/atmoshaper/sound-library.tsx", import.meta.url), "utf8")
    const runtime = await readFile(new URL("../lib/atmoshaper/runtime.ts", import.meta.url), "utf8")
    const adapter = await readFile(new URL("../lib/atmoshaper/ambient-audio-runtime.ts", import.meta.url), "utf8")
    assert.match(library, /ATMOSHAPER_PRODUCTION_CATALOG/)
    assert.match(library, /Search ambient sounds/)
    assert.doesNotMatch(library, /Ambient sound library is being prepared/)
    assert.match(runtime, /createAmbientAtmoShaperAdapter/)
    assert.match(adapter, /createVoiceOutput/)
    assert.match(adapter, /prebaked-intro-loop/)
  })
})
