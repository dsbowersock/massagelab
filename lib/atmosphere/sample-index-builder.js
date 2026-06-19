// @ts-check

/**
 * @typedef {{ instrumentName: string, noteName: string | null, collectionType?: "notes" | "array", publicUrl: string }} SampleIndexAsset
 * @typedef {Record<string, string> | string[]} InstrumentSampleIndexEntry
 * @typedef {Record<string, InstrumentSampleIndexEntry>} InstrumentSampleIndex
 */

/**
 * Builds the Generative.fm-compatible sample index used by both WAV and
 * browser-optimized sidecar uploads. Each instrument must stay either a
 * note-name map or an ordered array so package adapters do not receive mixed
 * sample shapes for the same instrument.
 *
 * @param {SampleIndexAsset[]} assets
 * @returns {InstrumentSampleIndex}
 */
export function buildInstrumentSampleIndex(assets) {
  /** @type {InstrumentSampleIndex} */
  const sampleIndex = {}

  for (const asset of assets) {
    const currentSamples = sampleIndex[asset.instrumentName]

    if (asset.collectionType === "array") {
      if (currentSamples && !Array.isArray(currentSamples)) {
        throw new Error(`Cannot mix array and note-map samples for ${asset.instrumentName}.`)
      }

      const arraySamples = Array.isArray(currentSamples) ? currentSamples : []
      arraySamples.push(asset.publicUrl)
      sampleIndex[asset.instrumentName] = arraySamples
      continue
    }

    if (!asset.noteName) {
      throw new Error(`Note-map sample ${asset.instrumentName} is missing a noteName.`)
    }

    if (Array.isArray(currentSamples)) {
      throw new Error(`Cannot mix note-map and array samples for ${asset.instrumentName}.`)
    }

    const noteSamples = currentSamples ?? {}
    noteSamples[asset.noteName] = asset.publicUrl
    sampleIndex[asset.instrumentName] = noteSamples
  }

  return sampleIndex
}
