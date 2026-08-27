// @ts-check

const SHA256 = /^[a-f0-9]{64}$/
const BATCH_ID = /^batch-\d{2}-[a-z0-9-]+$/
const FORMAT_IDS = new Set(["opus", "aac", "mp3", "source"])
const ORIGINS = new Set(["moodist", "signature-only"])

/**
 * Validates the committed browser catalog produced by the checksum-bound
 * release builder. This intentionally validates plain data only so the same
 * boundary can run during Node tests and in the client bundle.
 *
 * @param {unknown} rawCatalog
 */
export function validateAtmoShaperProductionCatalog(rawCatalog) {
  const catalog = requireRecord(rawCatalog, "AtmoShaper production catalog")
  if (catalog.version !== 1 || catalog.catalogKind !== "atmoshaper-production-audio") {
    throw new Error("AtmoShaper production catalog identity is invalid")
  }
  const catalogRevision = requireSha256(catalog.catalogRevision, "AtmoShaper catalog revision")
  const concepts = requireArray(catalog.concepts, "AtmoShaper production concepts")
    .map(validateConcept)
  if (concepts.length === 0) throw new Error("AtmoShaper production catalog is empty")
  const seenConceptIds = new Set()
  const seenBatchIds = new Set()
  for (const concept of concepts) {
    if (seenConceptIds.has(concept.id)) throw new Error(`Duplicate AtmoShaper concept ${concept.id}`)
    if (seenBatchIds.has(concept.batchId)) throw new Error(`Duplicate AtmoShaper batch ${concept.batchId}`)
    seenConceptIds.add(concept.id)
    seenBatchIds.add(concept.batchId)
  }
  const summary = requireRecord(catalog.summary, "AtmoShaper production catalog summary")
  if (summary.conceptCount !== concepts.length) {
    throw new Error("AtmoShaper production concept count does not match its summary")
  }
  return {
    version: 1,
    catalogKind: "atmoshaper-production-audio",
    catalogRevision,
    publishedBaseUrl: requireHttpsUrl(catalog.publishedBaseUrl, "AtmoShaper published base URL"),
    rights: validateRights(catalog.rights),
    summary: {
      conceptCount: requirePositiveInteger(summary.conceptCount, "AtmoShaper concept count"),
      sourceReferenceCount: requirePositiveInteger(
        summary.sourceReferenceCount,
        "AtmoShaper source-reference count",
      ),
      uniquePayloadCount: requirePositiveInteger(
        summary.uniquePayloadCount,
        "AtmoShaper unique-payload count",
      ),
    },
    concepts,
  }
}

/** @param {unknown} rawConcept @param {number} index */
function validateConcept(rawConcept, index) {
  const concept = requireRecord(rawConcept, `AtmoShaper concept ${index}`)
  const id = requireString(concept.id, `AtmoShaper concept ${index} id`)
  const batchId = requireString(concept.batchId, `AtmoShaper concept ${id} batch id`)
  if (!BATCH_ID.test(batchId)) throw new Error(`AtmoShaper concept ${id} batch id is invalid`)
  const origin = requireString(concept.origin, `AtmoShaper concept ${id} origin`)
  if (!ORIGINS.has(origin)) throw new Error(`AtmoShaper concept ${id} origin is invalid`)
  const sources = requireArray(concept.sources, `AtmoShaper concept ${id} sources`)
    .map((source, sourceIndex) => validateSource(source, `${id} source ${sourceIndex}`))
  if (sources.length === 0) throw new Error(`AtmoShaper concept ${id} has no source`)
  const sourceIds = new Set(sources.map(({ sourceId }) => sourceId))
  if (sourceIds.size !== sources.length) throw new Error(`AtmoShaper concept ${id} repeats a source`)
  const sourceSelection = concept.sourceSelection === null
    ? null
    : clonePlainData(concept.sourceSelection, `AtmoShaper concept ${id} source selection`)
  if (sourceSelection?.kind === "single-source-loop") {
    if (!sourceIds.has(requireString(sourceSelection.defaultSourceId, `AtmoShaper concept ${id} default source`))) {
      throw new Error(`AtmoShaper concept ${id} default source is outside its pool`)
    }
  }
  return {
    id,
    batchId,
    groupId: requireString(concept.groupId, `AtmoShaper concept ${id} group id`),
    label: requireString(concept.label, `AtmoShaper concept ${id} label`),
    description: requireString(concept.description, `AtmoShaper concept ${id} description`),
    category: requireString(concept.category, `AtmoShaper concept ${id} category`),
    origin,
    reviewFingerprint: requireSha256(
      concept.reviewFingerprint,
      `AtmoShaper concept ${id} review fingerprint`,
    ),
    playbackConfiguration: clonePlainData(
      concept.playbackConfiguration,
      `AtmoShaper concept ${id} playback configuration`,
    ),
    runtimePolicy: concept.runtimePolicy === null
      ? null
      : clonePlainData(concept.runtimePolicy, `AtmoShaper concept ${id} runtime policy`),
    sourceSelection,
    playbackMode: concept.playbackMode === null
      ? null
      : clonePlainData(concept.playbackMode, `AtmoShaper concept ${id} playback mode`),
    sources,
  }
}

/** @param {unknown} rawSource @param {string} label */
function validateSource(rawSource, label) {
  const source = requireRecord(rawSource, label)
  const formats = requireArray(source.formats, `${label} formats`)
    .map((format, index) => validateFormat(format, `${label} format ${index}`))
  if (formats.length < 3) throw new Error(`${label} needs the three compressed browser formats`)
  const formatIds = new Set(formats.map(({ id }) => id))
  for (const required of ["opus", "aac", "mp3"]) {
    if (!formatIds.has(required)) throw new Error(`${label} is missing ${required}`)
  }
  if (formatIds.size !== formats.length) throw new Error(`${label} repeats a format`)
  return {
    sourceId: requireSha256(source.sourceId, `${label} source id`),
    label: requireString(source.label, `${label} display label`),
    relativePath: requireString(source.relativePath, `${label} relative path`),
    payloadSha256: requireSha256(source.payloadSha256, `${label} payload SHA-256`),
    durationSeconds: requirePositiveNumber(source.durationSeconds, `${label} duration`),
    ...(source.startSeconds === undefined ? {} : {
      startSeconds: requireNonNegativeNumber(source.startSeconds, `${label} start seconds`),
    }),
    ...(source.endSeconds === undefined ? {} : {
      endSeconds: requirePositiveNumber(source.endSeconds, `${label} end seconds`),
    }),
    ...(source.fadeInSeconds === undefined ? {} : {
      fadeInSeconds: requireNonNegativeNumber(source.fadeInSeconds, `${label} fade-in seconds`),
    }),
    ...(source.fadeOutSeconds === undefined ? {} : {
      fadeOutSeconds: requireNonNegativeNumber(source.fadeOutSeconds, `${label} fade-out seconds`),
    }),
    ...(source.gainDb === undefined ? {} : {
      gainDb: requireFiniteNumber(source.gainDb, `${label} gain`),
    }),
    formats,
  }
}

/** @param {unknown} rawFormat @param {string} label */
function validateFormat(rawFormat, label) {
  const format = requireRecord(rawFormat, label)
  const id = requireString(format.id, `${label} id`)
  if (!FORMAT_IDS.has(id)) throw new Error(`${label} id is invalid`)
  return {
    id,
    publicUrl: requireHttpsUrl(format.publicUrl, `${label} public URL`),
    contentType: requireString(format.contentType, `${label} content type`),
    sha256: requireSha256(format.sha256, `${label} SHA-256`),
    byteSize: requirePositiveInteger(format.byteSize, `${label} byte size`),
  }
}

/** @param {unknown} rawRights */
function validateRights(rawRights) {
  const rights = requireRecord(rawRights, "AtmoShaper production rights")
  return {
    source: requireString(rights.source, "AtmoShaper rights source"),
    license: requireString(rights.license, "AtmoShaper rights license"),
    evidence: requireString(rights.evidence, "AtmoShaper rights evidence"),
  }
}

/**
 * Picks one browser rendition in the established Atmosphere preference order.
 * @param {{formats:Array<{id:string,publicUrl:string,contentType:string}>}} source
 * @param {(contentType:string)=>string} canPlayType
 */
export function selectAtmoShaperProductionAudioUrl(source, canPlayType) {
  if (typeof canPlayType !== "function") throw new TypeError("Audio capability probe is required")
  for (const id of ["opus", "aac", "mp3", "source"]) {
    const format = source.formats.find((candidate) => candidate.id === id)
    if (format && canPlayType(format.contentType) !== "") return format.publicUrl
  }
  throw new Error("No supported AtmoShaper audio format is available")
}

/** @param {unknown} value @param {string} label @returns {any} */
function clonePlainData(value, label) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`${label} contains a non-finite number`)
    return value
  }
  if (Array.isArray(value)) return value.map((item) => clonePlainData(item, label))
  const record = requireRecord(value, label)
  return Object.fromEntries(Object.entries(record).map(([key, item]) => [key, clonePlainData(item, label)]))
}

/** @param {unknown} value @param {string} label */
function requireRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${label} must be an object`)
  return /** @type {Record<string, any>} */ (value)
}

/** @param {unknown} value @param {string} label */
function requireArray(value, label) {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array`)
  return value
}

/** @param {unknown} value @param {string} label */
function requireString(value, label) {
  if (typeof value !== "string" || value.trim() === "") throw new TypeError(`${label} must be a non-empty string`)
  return value
}

/** @param {unknown} value @param {string} label */
function requireSha256(value, label) {
  const normalized = requireString(value, label)
  if (!SHA256.test(normalized)) throw new Error(`${label} is invalid`)
  return normalized
}

/** @param {unknown} value @param {string} label */
function requireHttpsUrl(value, label) {
  const normalized = requireString(value, label)
  const url = new URL(normalized)
  if (url.protocol !== "https:") throw new Error(`${label} must use HTTPS`)
  return url.toString()
}

/** @param {unknown} value @param {string} label */
function requireFiniteNumber(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new TypeError(`${label} must be finite`)
  return value
}

/** @param {unknown} value @param {string} label */
function requirePositiveNumber(value, label) {
  const number = requireFiniteNumber(value, label)
  if (number <= 0) throw new TypeError(`${label} must be positive`)
  return number
}

/** @param {unknown} value @param {string} label */
function requireNonNegativeNumber(value, label) {
  const number = requireFiniteNumber(value, label)
  if (number < 0) throw new TypeError(`${label} must not be negative`)
  return number
}

/** @param {unknown} value @param {string} label */
function requirePositiveInteger(value, label) {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive integer`)
  }
  return value
}
