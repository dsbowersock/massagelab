import {
  createSignatureSoundConstructionQa,
  renderSignatureSoundConstructionQaJson,
  validateSignatureSoundConstructionQa,
} from "./signature-sound-construction-qa.js"

/**
 * Loads valid saved QA, or creates an exportable in-memory record when browser
 * storage itself is unavailable. Invalid saved data still throws for recovery.
 */
export function loadSignatureSoundConstructionQa(getStorage, storageKey, rawAudition, createdAt) {
  let raw
  try {
    raw = getStorage().getItem(storageKey)
  } catch {
    return {
      qa: createSignatureSoundConstructionQa(rawAudition, createdAt),
      persistenceAvailable: false,
    }
  }
  return {
    qa: raw === null
      ? createSignatureSoundConstructionQa(rawAudition, createdAt)
      : validateSignatureSoundConstructionQa(JSON.parse(raw), rawAudition),
    persistenceAvailable: true,
  }
}

/**
 * Attempts one browser-local write without letting unavailable storage discard
 * or invalidate the caller's in-memory, exportable QA record.
 */
export function persistSignatureSoundConstructionQa(getStorage, storageKey, rawQa, rawAudition) {
  const json = renderSignatureSoundConstructionQaJson(rawQa, rawAudition)
  try {
    getStorage().setItem(storageKey, json)
    return true
  } catch {
    return false
  }
}

/** Parses an exported record through the same closed validator used by storage. */
export function parseSignatureSoundConstructionQaJson(rawJson, rawAudition) {
  if (typeof rawJson !== "string") {
    throw new Error("Signature construction QA import must be JSON text")
  }
  return validateSignatureSoundConstructionQa(JSON.parse(rawJson), rawAudition)
}
