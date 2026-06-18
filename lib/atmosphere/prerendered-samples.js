// @ts-check

import fs from "node:fs/promises"
import path from "node:path"
import { OBSERVABLE_STREAMS_R2_OBJECT_PREFIX } from "./observable-streams-adaptation.js"
import { publicUrlForR2Object } from "./r2-sample-hosting.js"

const SAMPLE_RENDER_BITS_PER_SAMPLE = 16
const SAMPLE_RENDER_FORMAT_PCM = 1
const SAMPLE_RENDER_FORMAT_FLOAT = 3
const NOTE_PITCH_CLASSES = Object.freeze({
  C: 0,
  "C#": 1,
  D: 2,
  "D#": 3,
  E: 4,
  F: 5,
  "F#": 6,
  G: 7,
  "G#": 8,
  A: 9,
  "A#": 10,
  B: 11,
})

/**
 * These note lists mirror @generative-music/piece-observable-streams v5.2.0.
 * The package requests rendered names first, then source names as fallback.
 */
export const OBSERVABLE_STREAMS_RENDERED_SAMPLE_TARGETS = Object.freeze([
  Object.freeze({
    sourceInstrumentName: "vsco2-piano-mf",
    renderedInstrumentName: "observable-streams__vsco2-piano-mf",
    outputFilePrefix: "rendered-piano",
    additionalRenderLengthSeconds: 3,
    fadeOutSeconds: 0,
    reverb: Object.freeze({ roomSize: 0.5, wet: 0.6 }),
    notes: Object.freeze([
      "C4",
      "E4",
      "G4",
      "B4",
      "C5",
      "C3",
      "C2",
      "E5",
      "E3",
      "E2",
      "G5",
      "G3",
      "G2",
      "B5",
      "B3",
      "B2",
    ]),
  }),
  Object.freeze({
    sourceInstrumentName: "vsco2-violin-arcvib",
    renderedInstrumentName: "observable-streams__vsco2-violin-arcvib",
    outputFilePrefix: "rendered-violin-arcvib",
    additionalRenderLengthSeconds: 0,
    fadeOutSeconds: 4,
    reverb: Object.freeze({ roomSize: 0.9, wet: 1 }),
    notes: Object.freeze(["C4", "E4", "G4", "B4", "C5", "E5", "G5", "B5"]),
  }),
  Object.freeze({
    sourceInstrumentName: "sso-cor-anglais",
    renderedInstrumentName: "observable-streams__sso-cor-anglais",
    outputFilePrefix: "rendered-oboe-sus",
    additionalRenderLengthSeconds: 3,
    fadeOutSeconds: 0,
    reverb: Object.freeze({ roomSize: 0.9, wet: 1 }),
    notes: Object.freeze(["C4", "E4", "G4", "C5", "E5", "G5"]),
  }),
])

/**
 * Renders package-compatible hosted buffers for Observable Streams. The browser
 * package will use these rendered instrument keys directly and skip its slow
 * first-play prerender pass.
 *
 * @param {{
 *   assetPlan: { selectedAssets: Array<{ instrumentName: string, noteName: string, sourceRelativePath: string }> },
 *   audioRoot: string,
 *   publicBaseUrl: string,
 *   objectPrefix?: string,
 *   cacheControl?: string,
 * }} params
 */
export async function createObservableStreamsRenderedSampleObjects({
  assetPlan,
  audioRoot,
  publicBaseUrl,
  objectPrefix = OBSERVABLE_STREAMS_R2_OBJECT_PREFIX,
  cacheControl,
}) {
  if (!audioRoot) throw new Error("audioRoot is required to render Observable Streams sample objects.")

  const normalizedPrefix = normalizeR2ObjectPrefix(objectPrefix)
  const resolvedAudioRoot = path.resolve(audioRoot)
  const selectedAssetsByInstrument = groupSelectedAssetsByInstrument(assetPlan.selectedAssets)
  const decodedSourceCache = new Map()
  const renderedSampleObjects = []

  for (const target of OBSERVABLE_STREAMS_RENDERED_SAMPLE_TARGETS) {
    const sourceAssets = selectedAssetsByInstrument.get(target.sourceInstrumentName)
    if (!sourceAssets?.length) {
      throw new Error(`Cannot render ${target.renderedInstrumentName}; missing ${target.sourceInstrumentName} source assets.`)
    }

    for (const noteName of target.notes) {
      const sourceAsset = selectClosestSourceAsset(sourceAssets, noteName)
      const sourcePath = resolveContainedSourcePath(resolvedAudioRoot, sourceAsset.sourceRelativePath)
      const decodedSource = await readDecodedWavFromCache(decodedSourceCache, sourcePath)
      const renderedWav = renderPitchShiftedSample({
        source: decodedSource,
        sourceNoteName: sourceAsset.noteName,
        targetNoteName: noteName,
        additionalRenderLengthSeconds: target.additionalRenderLengthSeconds,
        fadeOutSeconds: target.fadeOutSeconds,
        reverb: target.reverb,
      })
      const body = encodePcm16Wav(renderedWav)
      const outputFileName = `${target.outputFilePrefix}-${noteNameToSlug(noteName)}.wav`
      const objectKey = `${normalizedPrefix}/rendered/${target.renderedInstrumentName}/${outputFileName}`

      renderedSampleObjects.push({
        kind: "rendered-sample",
        instrumentName: target.renderedInstrumentName,
        noteName,
        sourceInstrumentName: target.sourceInstrumentName,
        sourceNoteName: sourceAsset.noteName,
        sourceRelativePath: sourceAsset.sourceRelativePath,
        outputFileName,
        objectKey,
        publicUrl: publicUrlForR2Object(publicBaseUrl, objectKey),
        contentType: "audio/wav",
        cacheControl,
        body,
        sizeBytes: body.byteLength,
        render: {
          additionalRenderLengthSeconds: target.additionalRenderLengthSeconds,
          fadeOutSeconds: target.fadeOutSeconds,
          reverb: target.reverb,
        },
      })
    }
  }

  return renderedSampleObjects
}

/**
 * @param {Array<{ instrumentName: string, noteName: string, sourceRelativePath: string }>} assets
 */
export function groupSelectedAssetsByInstrument(assets) {
  return assets.reduce((groups, asset) => {
    const existing = groups.get(asset.instrumentName) ?? []
    existing.push(asset)
    groups.set(asset.instrumentName, existing)
    return groups
  }, new Map())
}

/**
 * Mirrors the package's closest-note source selection: choose the sampled MIDI
 * note with the smallest distance. Equal-distance ties intentionally prefer the
 * higher MIDI note to match the package sampler behavior.
 *
 * @param {Array<{ noteName: string, sourceRelativePath: string }>} sourceAssets
 * @param {string} targetNoteName
 */
export function selectClosestSourceAsset(sourceAssets, targetNoteName) {
  if (sourceAssets.length === 0) throw new Error("At least one source asset is required.")

  const targetMidi = noteNameToMidi(targetNoteName)
  return sourceAssets.reduce((closest, asset) => {
    const midi = noteNameToMidi(asset.noteName)
    const distance = Math.abs(midi - targetMidi)
    if (distance < closest.distance || (distance === closest.distance && midi > closest.midi)) {
      return { asset, distance, midi }
    }
    return closest
  }, {
    asset: sourceAssets[0],
    distance: Math.abs(noteNameToMidi(sourceAssets[0].noteName) - targetMidi),
    midi: noteNameToMidi(sourceAssets[0].noteName),
  }).asset
}

/**
 * @param {{
 *   source: { sampleRate: number, channels: Float32Array[] },
 *   sourceNoteName: string,
 *   targetNoteName: string,
 *   additionalRenderLengthSeconds?: number,
 *   fadeOutSeconds?: number,
 *   reverb?: { roomSize: number, wet: number } | null,
 * }} params
 */
export function renderPitchShiftedSample({
  source,
  sourceNoteName,
  targetNoteName,
  additionalRenderLengthSeconds = 0,
  fadeOutSeconds = 0,
  reverb = null,
}) {
  const sourceFrameCount = source.channels[0]?.length ?? 0
  if (sourceFrameCount === 0) throw new Error("Cannot render an empty WAV sample.")

  const playbackRate = 2 ** ((noteNameToMidi(targetNoteName) - noteNameToMidi(sourceNoteName)) / 12)
  const renderedFrameCount = Math.ceil(sourceFrameCount / playbackRate)
  const tailFrameCount = Math.max(0, Math.round(source.sampleRate * additionalRenderLengthSeconds))
  const outputFrameCount = renderedFrameCount + tailFrameCount
  const fadeFrameCount = Math.min(renderedFrameCount, Math.max(0, Math.round(source.sampleRate * fadeOutSeconds)))
  const dryChannels = source.channels.map((sourceChannel) => {
    const output = new Float32Array(outputFrameCount)

    for (let frame = 0; frame < renderedFrameCount; frame += 1) {
      const sourcePosition = frame * playbackRate
      const value = interpolateSample(sourceChannel, sourcePosition)
      output[frame] = fadeFrameCount > 0 ? value * fadeOutGain(frame, renderedFrameCount, fadeFrameCount) : value
    }

    return output
  })

  return {
    sampleRate: source.sampleRate,
    channels: applyRenderedReverb(dryChannels, source.sampleRate, reverb),
  }
}

/**
 * @param {Uint8Array | Buffer} bytes
 */
export function decodeWav(bytes) {
  const buffer = Buffer.from(bytes)
  if (buffer.length < 44 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("Unsupported WAV file: missing RIFF/WAVE header.")
  }

  let format = null
  let dataOffset = -1
  let dataSize = 0

  for (let offset = 12; offset + 8 <= buffer.length;) {
    const chunkId = buffer.toString("ascii", offset, offset + 4)
    const chunkSize = buffer.readUInt32LE(offset + 4)
    const chunkDataOffset = offset + 8

    if (chunkDataOffset + chunkSize > buffer.length) {
      throw new Error(`Unsupported WAV file: invalid ${chunkId} chunk size.`)
    }

    if (chunkId === "fmt ") {
      if (chunkSize < 16) throw new Error("Unsupported WAV file: short fmt chunk.")
      format = {
        audioFormat: buffer.readUInt16LE(chunkDataOffset),
        channelCount: buffer.readUInt16LE(chunkDataOffset + 2),
        sampleRate: buffer.readUInt32LE(chunkDataOffset + 4),
        bitsPerSample: buffer.readUInt16LE(chunkDataOffset + 14),
      }
    } else if (chunkId === "data") {
      dataOffset = chunkDataOffset
      dataSize = chunkSize
    }

    offset = chunkDataOffset + chunkSize + (chunkSize % 2)
  }

  if (!format) throw new Error("Unsupported WAV file: missing fmt chunk.")
  if (dataOffset === -1) throw new Error("Unsupported WAV file: missing data chunk.")
  if (![SAMPLE_RENDER_FORMAT_PCM, SAMPLE_RENDER_FORMAT_FLOAT].includes(format.audioFormat)) {
    throw new Error(`Unsupported WAV file: audio format ${format.audioFormat}.`)
  }
  if (format.channelCount < 1) throw new Error("Unsupported WAV file: channel count must be positive.")

  const bytesPerSample = format.bitsPerSample / 8
  if (!Number.isInteger(bytesPerSample) || bytesPerSample <= 0) {
    throw new Error(`Unsupported WAV file: ${format.bitsPerSample}-bit samples.`)
  }

  const bytesPerFrame = format.channelCount * bytesPerSample
  if (dataSize % bytesPerFrame !== 0) {
    throw new Error("Unsupported WAV file: data chunk is not frame-aligned.")
  }
  const frameCount = dataSize / bytesPerFrame
  const channels = Array.from({ length: format.channelCount }, () => new Float32Array(frameCount))

  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let channel = 0; channel < format.channelCount; channel += 1) {
      const sampleOffset = dataOffset + ((frame * format.channelCount + channel) * bytesPerSample)
      channels[channel][frame] = readWavSample(buffer, sampleOffset, format.audioFormat, format.bitsPerSample)
    }
  }

  return {
    sampleRate: format.sampleRate,
    channels,
  }
}

/**
 * @param {{ sampleRate: number, channels: Float32Array[] }} wav
 */
export function encodePcm16Wav(wav) {
  const channelCount = wav.channels.length
  const frameCount = wav.channels[0]?.length ?? 0
  if (channelCount < 1) throw new Error("Cannot encode WAV without channels.")
  if (wav.channels.some((channel) => channel.length !== frameCount)) {
    throw new Error("Cannot encode WAV with uneven channel lengths.")
  }

  const blockAlign = channelCount * (SAMPLE_RENDER_BITS_PER_SAMPLE / 8)
  const byteRate = wav.sampleRate * blockAlign
  const dataSize = frameCount * blockAlign
  const buffer = Buffer.alloc(44 + dataSize)

  buffer.write("RIFF", 0, "ascii")
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write("WAVE", 8, "ascii")
  buffer.write("fmt ", 12, "ascii")
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(SAMPLE_RENDER_FORMAT_PCM, 20)
  buffer.writeUInt16LE(channelCount, 22)
  buffer.writeUInt32LE(wav.sampleRate, 24)
  buffer.writeUInt32LE(byteRate, 28)
  buffer.writeUInt16LE(blockAlign, 32)
  buffer.writeUInt16LE(SAMPLE_RENDER_BITS_PER_SAMPLE, 34)
  buffer.write("data", 36, "ascii")
  buffer.writeUInt32LE(dataSize, 40)

  let offset = 44
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      const value = Math.max(-1, Math.min(1, wav.channels[channel][frame] ?? 0))
      buffer.writeInt16LE(value < 0 ? Math.round(value * 0x8000) : Math.round(value * 0x7fff), offset)
      offset += 2
    }
  }

  return new Uint8Array(buffer)
}

/**
 * @param {string} noteName
 */
export function noteNameToMidi(noteName) {
  const match = /^([A-G])(#?)(-?\d+)$/.exec(noteName)
  if (!match) throw new Error(`Invalid scientific pitch note: ${noteName}`)

  const pitchClass = `${match[1]}${match[2]}`
  const pitchClassMidi = NOTE_PITCH_CLASSES[pitchClass]
  if (typeof pitchClassMidi !== "number") throw new Error(`Unsupported pitch class: ${pitchClass}`)

  return (Number.parseInt(match[3], 10) + 1) * 12 + pitchClassMidi
}

/**
 * @param {Map<string, { sampleRate: number, channels: Float32Array[] }>} cache
 * @param {string} sourcePath
 */
async function readDecodedWavFromCache(cache, sourcePath) {
  const cached = cache.get(sourcePath)
  if (cached) return cached

  const decoded = decodeWav(await fs.readFile(sourcePath))
  cache.set(sourcePath, decoded)
  return decoded
}

/**
 * The Generative.fm package prerenders these buffers through Tone Freeverb.
 * This small deterministic Schroeder-style stage preserves the wet tails in the
 * hosted buffers without adding a browser prerender dependency to the CLI.
 *
 * @param {Float32Array[]} dryChannels
 * @param {number} sampleRate
 * @param {{ roomSize: number, wet: number } | null} reverb
 */
function applyRenderedReverb(dryChannels, sampleRate, reverb) {
  if (!reverb || reverb.wet <= 0) return dryChannels

  const roomSize = Math.max(0, Math.min(1, reverb.roomSize))
  const wet = Math.max(0, Math.min(1, reverb.wet))
  const feedback = 0.42 + (roomSize * 0.42)
  const combDelaysSeconds = [0.0297, 0.0371, 0.0411, 0.0437]
  const wetGain = 0.22

  return dryChannels.map((dryChannel, channelIndex) => {
    const wetChannel = new Float32Array(dryChannel.length)

    for (let delayIndex = 0; delayIndex < combDelaysSeconds.length; delayIndex += 1) {
      const delayFrames = Math.max(
        1,
        Math.round(sampleRate * (combDelaysSeconds[delayIndex] + (channelIndex * 0.0007))),
      )
      const comb = new Float32Array(dryChannel.length)

      for (let frame = 0; frame < dryChannel.length; frame += 1) {
        const delayed = frame >= delayFrames ? comb[frame - delayFrames] * feedback : 0
        comb[frame] = dryChannel[frame] + delayed
        wetChannel[frame] += comb[frame] * wetGain
      }
    }

    const mixed = new Float32Array(dryChannel.length)
    for (let frame = 0; frame < dryChannel.length; frame += 1) {
      mixed[frame] = softLimit((dryChannel[frame] * (1 - wet)) + (wetChannel[frame] * wet))
    }
    return mixed
  })
}

/**
 * @param {string} resolvedAudioRoot
 * @param {string} sourceRelativePath
 */
function resolveContainedSourcePath(resolvedAudioRoot, sourceRelativePath) {
  const sourcePath = path.resolve(resolvedAudioRoot, sourceRelativePath)
  const sourcePathFromRoot = path.relative(resolvedAudioRoot, sourcePath)
  if (sourcePathFromRoot.startsWith("..") || path.isAbsolute(sourcePathFromRoot)) {
    throw new Error(`Invalid sourceRelativePath outside audioRoot: ${sourceRelativePath}`)
  }
  return sourcePath
}

/**
 * @param {Float32Array} sourceChannel
 * @param {number} sourcePosition
 */
function interpolateSample(sourceChannel, sourcePosition) {
  const lowerIndex = Math.floor(sourcePosition)
  if (lowerIndex >= sourceChannel.length - 1) return sourceChannel[sourceChannel.length - 1] ?? 0

  const upperIndex = lowerIndex + 1
  const ratio = sourcePosition - lowerIndex
  return (sourceChannel[lowerIndex] * (1 - ratio)) + (sourceChannel[upperIndex] * ratio)
}

/**
 * @param {number} frame
 * @param {number} renderedFrameCount
 * @param {number} fadeFrameCount
 */
function fadeOutGain(frame, renderedFrameCount, fadeFrameCount) {
  const fadeStart = renderedFrameCount - fadeFrameCount
  if (frame < fadeStart) return 1
  return Math.max(0, (renderedFrameCount - frame - 1) / fadeFrameCount)
}

/**
 * @param {number} value
 */
function softLimit(value) {
  return Math.tanh(value)
}

/**
 * @param {Buffer} buffer
 * @param {number} offset
 * @param {number} audioFormat
 * @param {number} bitsPerSample
 */
function readWavSample(buffer, offset, audioFormat, bitsPerSample) {
  if (audioFormat === SAMPLE_RENDER_FORMAT_FLOAT && bitsPerSample === 32) return buffer.readFloatLE(offset)
  if (audioFormat !== SAMPLE_RENDER_FORMAT_PCM) {
    throw new Error(`Unsupported WAV file: audio format ${audioFormat} with ${bitsPerSample}-bit samples.`)
  }

  if (bitsPerSample === 8) return (buffer.readUInt8(offset) - 128) / 128
  if (bitsPerSample === 16) return buffer.readInt16LE(offset) / 0x8000
  if (bitsPerSample === 24) return readInt24LE(buffer, offset) / 0x800000
  if (bitsPerSample === 32) return buffer.readInt32LE(offset) / 0x80000000

  throw new Error(`Unsupported WAV file: ${bitsPerSample}-bit PCM samples.`)
}

/**
 * @param {Buffer} buffer
 * @param {number} offset
 */
function readInt24LE(buffer, offset) {
  const value = buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16)
  return value & 0x800000 ? value | 0xff000000 : value
}

/**
 * @param {string} value
 */
function normalizeR2ObjectPrefix(value) {
  const normalized = value.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").replace(/\/+/g, "/")
  if (!normalized || normalized.split("/").some((part) => part === "." || part === "..")) {
    throw new Error(`Invalid R2 object prefix: ${value}`)
  }
  return normalized
}

/**
 * @param {string} noteName
 */
function noteNameToSlug(noteName) {
  return noteName.toLowerCase().replace("#", "-sharp")
}
