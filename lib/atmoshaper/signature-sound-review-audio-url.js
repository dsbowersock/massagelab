// @ts-check

const SHA256 = /^[a-f0-9]{64}$/
const SPEECH_REQUIREMENT_KINDS = new Set(["remove-discernible-speech", "duck-voices"])

/** True for either a pending request or an exact processed speech binding. */
/** @param {unknown} entry */
export function signatureSoundConceptRequiresSpeechReduction(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false
  const normalizedEntry = /** @type {Record<string, any>} */ (entry)
  if (Array.isArray(normalizedEntry.sources) && normalizedEntry.sources.some((source) => (
    source && typeof source === "object" && typeof source.audioUrl === "string" &&
    source.audioUrl.startsWith("/api/dev/atmoshaper-candidates/speech-reduction/")
  ))) return true
  const processingRequirements = normalizedEntry.processingRequirements
  if (!Array.isArray(processingRequirements)) return false
  return processingRequirements.some((/** @type {unknown} */ requirement) => (
    requirement && typeof requirement === "object" &&
    SPEECH_REQUIREMENT_KINDS.has(/** @type {Record<string, any>} */ (requirement).kind)
  ))
}

/**
 * Separates audition availability from final processing state. A complete,
 * manifest-bound speech treatment can be reviewed while later dynamics or
 * level work remains pending; untreated processing-required concepts stay
 * closed instead of falling back to raw audio.
 * @param {unknown} entry
 */
export function signatureSoundConceptHasAuditionableSources(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false
  const normalizedEntry = /** @type {Record<string, any>} */ (entry)
  if (!Array.isArray(normalizedEntry.sources) || normalizedEntry.sources.length === 0) return false
  if (signatureSoundConceptRequiresSpeechReduction(normalizedEntry)) {
    return normalizedEntry.sources.every((/** @type {unknown} */ rawSource) => {
      const source = rawSource && typeof rawSource === "object" && !Array.isArray(rawSource)
        ? /** @type {Record<string, any>} */ (rawSource)
        : null
      return typeof source?.audioUrl === "string" &&
        source.audioUrl.startsWith("/api/dev/atmoshaper-candidates/speech-reduction/")
    })
  }
  return normalizedEntry.reviewState !== "processing-required"
}

/**
 * Returns the concept-scoped processed URL, or the raw source URL only for
 * concepts that never requested speech reduction.
 * @param {unknown} rawSource
 * @param {{requiresSpeechReduction:boolean}} options
 */
export function resolveSignatureSoundWholeConceptAudioUrl(rawSource, { requiresSpeechReduction }) {
  if (!rawSource || typeof rawSource !== "object" || Array.isArray(rawSource)) {
    throw new Error("Whole-concept audio source must be an object")
  }
  const source = /** @type {Record<string, any>} */ (rawSource)
  if (typeof source.sourceId !== "string" || !SHA256.test(source.sourceId)) {
    throw new Error("Whole-concept audio source id is invalid")
  }
  if (requiresSpeechReduction) {
    if (typeof source.audioUrl !== "string" || !source.audioUrl.startsWith("/api/dev/atmoshaper-candidates/speech-reduction/")) {
      throw new Error("Speech-reduced concept source is missing its processed URL")
    }
    return source.audioUrl
  }
  if (source.audioUrl !== undefined) throw new Error("Raw concept source cannot carry a processed URL")
  return `/api/dev/atmoshaper-candidates/audio/${encodeURIComponent(source.sourceId)}`
}
