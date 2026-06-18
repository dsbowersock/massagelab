// @ts-check

import { publicUrlForR2Object } from "./r2-sample-hosting.js"

export const OPUS_WEB_AUDIO_FORMAT = Object.freeze({
  id: "opus",
  extension: "opus.ogg",
  contentType: "audio/ogg; codecs=opus",
  canPlayType: 'audio/ogg; codecs="opus"',
  ffmpegOutputArgs: Object.freeze([
    "-vn",
    "-c:a",
    "libopus",
    "-b:a",
    "96k",
    "-vbr",
    "on",
    "-compression_level",
    "10",
  ]),
})

/**
 * Builds a sidecar web-audio sample index for an existing WAV-backed R2 plan.
 * The variant objects mirror source/rendered instrument names and notes while
 * writing encoded payloads under `<prefix>/web/<format>/...`, so the current
 * WAV sample index remains a stable fallback.
 *
 * @param {{
 *   objectPrefix: string,
 *   publicBaseUrl: string,
 *   sourceSampleIndexObjectKey: string,
 *   sourceManifestObjectKey: string,
 *   sourcePayloadBytes: number,
 *   variantSampleObjects: Array<{
 *     kind?: string,
 *     instrumentName: string,
 *     noteName: string,
 *     outputFileName: string,
 *     sourceObjectKey: string,
 *     objectKey: string,
 *     publicUrl: string,
 *     contentType: string,
 *     sizeBytes: number,
 *     sourceSizeBytes?: number | null,
 *   }>,
 *   format?: typeof OPUS_WEB_AUDIO_FORMAT,
 *   metadataCacheControl?: string,
 * }} params
 */
export function createWebAudioFormatPlan({
  objectPrefix,
  publicBaseUrl,
  sourceSampleIndexObjectKey,
  sourceManifestObjectKey,
  sourcePayloadBytes,
  variantSampleObjects,
  format = OPUS_WEB_AUDIO_FORMAT,
  metadataCacheControl,
}) {
  const normalizedPrefix = normalizeObjectPrefix(objectPrefix)
  const sampleIndexObjectKey = `${normalizedPrefix}/sample-index.${format.id}.json`
  const manifestObjectKey = `${normalizedPrefix}/manifest.${format.id}.json`
  const sampleIndex = buildSampleIndex(variantSampleObjects)
  const encodedPayloadBytes = variantSampleObjects.reduce((total, asset) => total + asset.sizeBytes, 0)
  const manifest = {
    format: {
      id: format.id,
      contentType: format.contentType,
      canPlayType: format.canPlayType,
    },
    objectPrefix: normalizedPrefix,
    sampleIndexObjectKey,
    sampleIndexPublicUrl: publicUrlForR2Object(publicBaseUrl, sampleIndexObjectKey),
    sourceSampleIndexObjectKey,
    sourceManifestObjectKey,
    sampleObjectCount: variantSampleObjects.length,
    sourcePayloadBytes,
    encodedPayloadBytes,
    compressionRatio: sourcePayloadBytes > 0 ? Number((encodedPayloadBytes / sourcePayloadBytes).toFixed(4)) : null,
    assets: variantSampleObjects.map((asset) => ({
      instrumentName: asset.instrumentName,
      noteName: asset.noteName,
      outputFileName: asset.outputFileName,
      sourceObjectKey: asset.sourceObjectKey,
      objectKey: asset.objectKey,
      publicUrl: asset.publicUrl,
      contentType: asset.contentType,
      sizeBytes: asset.sizeBytes,
      sourceSizeBytes: asset.sourceSizeBytes ?? null,
    })),
  }

  const metadataObjects = [
    createJsonUploadObject({
      kind: `sample-index-${format.id}`,
      objectKey: sampleIndexObjectKey,
      publicUrl: publicUrlForR2Object(publicBaseUrl, sampleIndexObjectKey),
      value: sampleIndex,
      cacheControl: metadataCacheControl,
    }),
    createJsonUploadObject({
      kind: `manifest-${format.id}`,
      objectKey: manifestObjectKey,
      publicUrl: publicUrlForR2Object(publicBaseUrl, manifestObjectKey),
      value: manifest,
      cacheControl: metadataCacheControl,
    }),
  ]

  return {
    format,
    objectPrefix: normalizedPrefix,
    sampleIndexObjectKey,
    sampleIndexPublicUrl: metadataObjects[0].publicUrl,
    manifestObjectKey,
    manifestPublicUrl: metadataObjects[1].publicUrl,
    sampleIndex,
    manifest,
    variantSampleObjects,
    metadataObjects,
    objectCount: variantSampleObjects.length + metadataObjects.length,
    sourcePayloadBytes,
    encodedPayloadBytes,
  }
}

/**
 * Creates one encoded-asset descriptor after a caller has converted the WAV
 * bytes. Keeping this pure lets tests verify R2 layout without invoking FFmpeg.
 *
 * @param {{
 *   sourceObject: {
 *     instrumentName: string,
 *     noteName: string,
 *     outputFileName: string,
 *     objectKey: string,
 *     sizeBytes?: number | null,
 *   },
 *   objectPrefix: string,
 *   publicBaseUrl: string,
 *   encodedBody: Uint8Array,
 *   format?: typeof OPUS_WEB_AUDIO_FORMAT,
 * }} params
 */
export function createWebAudioVariantSampleObject({
  sourceObject,
  objectPrefix,
  publicBaseUrl,
  encodedBody,
  format = OPUS_WEB_AUDIO_FORMAT,
}) {
  const normalizedPrefix = normalizeObjectPrefix(objectPrefix)
  const sourceObjectKey = normalizeObjectKey(sourceObject.objectKey)
  if (!sourceObjectKey.startsWith(`${normalizedPrefix}/`)) {
    throw new Error(`Source object ${sourceObject.objectKey} is outside object prefix ${normalizedPrefix}.`)
  }

  const sourceRelativeKey = sourceObjectKey.slice(normalizedPrefix.length + 1)
  const outputRelativeKey = replaceWavExtension(sourceRelativeKey, format.extension)
  const objectKey = `${normalizedPrefix}/web/${format.id}/${outputRelativeKey}`

  return {
    kind: `web-audio-sample-${format.id}`,
    instrumentName: sourceObject.instrumentName,
    noteName: sourceObject.noteName,
    outputFileName: outputRelativeKey.split("/").at(-1) ?? replaceWavExtension(sourceObject.outputFileName, format.extension),
    sourceObjectKey,
    objectKey,
    publicUrl: publicUrlForR2Object(publicBaseUrl, objectKey),
    contentType: format.contentType,
    body: encodedBody,
    sizeBytes: encodedBody.byteLength,
    sourceSizeBytes: sourceObject.sizeBytes ?? null,
  }
}

/**
 * @param {Array<{ instrumentName: string, noteName: string, publicUrl: string }>} assets
 */
export function buildSampleIndex(assets) {
  return assets.reduce((sampleIndex, asset) => {
    sampleIndex[asset.instrumentName] = sampleIndex[asset.instrumentName] ?? {}
    sampleIndex[asset.instrumentName][asset.noteName] = asset.publicUrl
    return sampleIndex
  }, {})
}

/**
 * @param {string} objectPrefix
 */
function normalizeObjectPrefix(objectPrefix) {
  const normalized = objectPrefix.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "")
  if (!normalized || normalized.includes("..")) {
    throw new Error(`Invalid R2 object prefix: ${objectPrefix}`)
  }
  return normalized
}

/**
 * @param {string} objectKey
 */
function normalizeObjectKey(objectKey) {
  const normalized = objectKey.replace(/\\/g, "/").replace(/^\/+/g, "")
  if (!normalized || normalized.includes("..")) {
    throw new Error(`Invalid R2 object key: ${objectKey}`)
  }
  return normalized
}

/**
 * @param {string} filePath
 * @param {string} extension
 */
function replaceWavExtension(filePath, extension) {
  if (!/\.wav$/i.test(filePath)) {
    throw new Error(`Only WAV source objects can be converted for this pilot: ${filePath}`)
  }
  return filePath.replace(/\.wav$/i, `.${extension}`)
}

/**
 * @param {{ kind: string, objectKey: string, publicUrl: string, value: unknown, cacheControl?: string }} params
 */
function createJsonUploadObject({ kind, objectKey, publicUrl, value, cacheControl }) {
  return {
    kind,
    objectKey,
    publicUrl,
    contentType: "application/json; charset=utf-8",
    cacheControl,
    body: `${JSON.stringify(value, null, 2)}\n`,
  }
}
