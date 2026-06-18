import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { describe, it } from "node:test"
import {
  createObservableStreamsRenderedSampleObjects,
  decodeWav,
  encodePcm16Wav,
  noteNameToMidi,
  OBSERVABLE_STREAMS_RENDERED_SAMPLE_TARGETS,
  renderPitchShiftedSample,
  selectClosestSourceAsset,
} from "../lib/atmosphere/prerendered-samples.js"

describe("Atmosphere prerendered Observable Streams samples", () => {
  it("keeps the package-rendered note contract explicit", () => {
    assert.deepEqual(OBSERVABLE_STREAMS_RENDERED_SAMPLE_TARGETS.map((target) => ({
      sourceInstrumentName: target.sourceInstrumentName,
      renderedInstrumentName: target.renderedInstrumentName,
      noteCount: target.notes.length,
    })), [
      {
        sourceInstrumentName: "vsco2-piano-mf",
        renderedInstrumentName: "observable-streams__vsco2-piano-mf",
        noteCount: 16,
      },
      {
        sourceInstrumentName: "vsco2-violin-arcvib",
        renderedInstrumentName: "observable-streams__vsco2-violin-arcvib",
        noteCount: 8,
      },
      {
        sourceInstrumentName: "sso-cor-anglais",
        renderedInstrumentName: "observable-streams__sso-cor-anglais",
        noteCount: 6,
      },
    ])
    assert.equal(noteNameToMidi("C4"), 60)
    assert.equal(noteNameToMidi("A#3"), 58)
  })

  it("chooses the closest curated source note and matches the package tie-breaker", () => {
    const closest = selectClosestSourceAsset([
      { noteName: "C#2", sourceRelativePath: "piano-c-sharp2.wav" },
      { noteName: "F2", sourceRelativePath: "piano-f2.wav" },
      { noteName: "A2", sourceRelativePath: "piano-a2.wav" },
    ], "G2")

    assert.equal(closest.noteName, "A2")
  })

  it("renders pitch-shifted PCM WAV samples with optional tail, fade, and reverb", () => {
    const source = {
      sampleRate: 8,
      channels: [Float32Array.from([0, 0.25, 0.5, 0.75, 1, 0.75, 0.5, 0.25])],
    }
    const octaveUp = renderPitchShiftedSample({
      source,
      sourceNoteName: "C4",
      targetNoteName: "C5",
      additionalRenderLengthSeconds: 0.25,
    })

    assert.equal(octaveUp.channels[0].length, 6)
    assert.deepEqual(Array.from(octaveUp.channels[0].slice(0, 4)), [0, 0.5, 1, 0.5])
    assert.deepEqual(Array.from(octaveUp.channels[0].slice(4)), [0, 0])

    const faded = renderPitchShiftedSample({
      source: { sampleRate: 8, channels: [Float32Array.from(Array(8).fill(1))] },
      sourceNoteName: "C4",
      targetNoteName: "C4",
      fadeOutSeconds: 0.5,
    })

    assert.deepEqual(Array.from(faded.channels[0].slice(4)), [0.75, 0.5, 0.25, 0])

    const reverbed = renderPitchShiftedSample({
      source: { sampleRate: 8000, channels: [Float32Array.from([1, ...Array(799).fill(0)])] },
      sourceNoteName: "C4",
      targetNoteName: "C4",
      additionalRenderLengthSeconds: 0.25,
      reverb: { roomSize: 0.9, wet: 1 },
    })

    assert.ok(Array.from(reverbed.channels[0].slice(800)).some((value) => Math.abs(value) > 0.0001))
  })

  it("round-trips generated PCM WAV files", () => {
    const encoded = encodePcm16Wav({
      sampleRate: 8000,
      channels: [
        Float32Array.from([-1, -0.5, 0, 0.5, 1]),
        Float32Array.from([1, 0.5, 0, -0.5, -1]),
      ],
    })
    const decoded = decodeWav(encoded)

    assert.equal(decoded.sampleRate, 8000)
    assert.equal(decoded.channels.length, 2)
    assert.equal(decoded.channels[0].length, 5)
    assert.ok(Math.abs(decoded.channels[0][1] - -0.5) < 0.0001)
    assert.ok(Math.abs(decoded.channels[1][3] - -0.5) < 0.0001)
  })

  it("rejects malformed WAV sample widths and non-frame-aligned data", () => {
    const zeroBitWav = Buffer.from(encodePcm16Wav({
      sampleRate: 8000,
      channels: [Float32Array.from([0])],
    }))
    zeroBitWav.writeUInt16LE(0, 34)
    assert.throws(() => decodeWav(zeroBitWav), /0-bit samples/)

    const unalignedWav = Buffer.concat([
      Buffer.from(encodePcm16Wav({
        sampleRate: 8000,
        channels: [Float32Array.from([0])],
      })),
      Buffer.from([0]),
    ])
    unalignedWav.writeUInt32LE(3, 40)
    assert.throws(() => decodeWav(unalignedWav), /data chunk is not frame-aligned/)
  })

  it("keeps rendered source reads contained inside the audio root", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "massagelab-atmosphere-"))
    try {
      await assert.rejects(
        () => createObservableStreamsRenderedSampleObjects({
          audioRoot: tempDir,
          publicBaseUrl: "https://media.massagelab.app",
          assetPlan: {
            selectedAssets: [
              { instrumentName: "vsco2-piano-mf", noteName: "C4", sourceRelativePath: "../outside.wav" },
            ],
          },
        }),
        /outside audioRoot/,
      )
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })

  it("creates rendered R2 sample objects without committing audio", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "massagelab-atmosphere-"))
    try {
      const sourceBody = encodePcm16Wav({
        sampleRate: 8000,
        channels: [Float32Array.from(Array(800).fill(0.25))],
      })
      await fs.writeFile(path.join(tempDir, "piano.wav"), sourceBody)
      await fs.writeFile(path.join(tempDir, "violin.wav"), sourceBody)
      await fs.writeFile(path.join(tempDir, "oboe.wav"), sourceBody)

      const renderedObjects = await createObservableStreamsRenderedSampleObjects({
        audioRoot: tempDir,
        publicBaseUrl: "https://media.massagelab.app",
        assetPlan: {
          selectedAssets: [
            { instrumentName: "vsco2-piano-mf", noteName: "C4", sourceRelativePath: "piano.wav" },
            { instrumentName: "vsco2-violin-arcvib", noteName: "C4", sourceRelativePath: "violin.wav" },
            { instrumentName: "sso-cor-anglais", noteName: "A#3", sourceRelativePath: "oboe.wav" },
          ],
        },
      })

      assert.equal(renderedObjects.length, 30)
      assert.equal(renderedObjects[0].instrumentName, "observable-streams__vsco2-piano-mf")
      assert.equal(renderedObjects[0].noteName, "C4")
      assert.match(
        renderedObjects[0].objectKey,
        /^atmosphere\/observable-streams-vsco-adaptation\/rendered\/observable-streams__vsco2-piano-mf\/rendered-piano-c4\.wav$/,
      )
      assert.equal(renderedObjects[0].contentType, "audio/wav")
      assert.equal(decodeWav(renderedObjects[0].body).channels.length, 1)
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })
})
