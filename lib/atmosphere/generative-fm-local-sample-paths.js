// @ts-check

export const SIGNATURE_SAMPLES_ROOT_MARKER = "signature samples"
export const SIGNATURE_SOUNDS_BEACH_ROOT_MARKER =
  `${SIGNATURE_SAMPLES_ROOT_MARKER}/ss_beach_ambience_recordings_cc0/ss_beach_ambience_recordings_cc0`
export const SIGNATURE_SOUNDS_CHOIR_TEASER_ROOT_MARKER =
  `${SIGNATURE_SAMPLES_ROOT_MARKER}/ss_choirs_vocals_sfx_teaser_cc0/ss_choirs_vocals_sfx_teaser_cc0`
export const SIGNATURE_SOUNDS_SERBIAN_CHOIR_ROOT_MARKER =
  `${SIGNATURE_SAMPLES_ROOT_MARKER}/ss_serbian_orthodox_choirs_original_recordings_cc0/ss_serbian_orthodox_choirs_original_recordings_cc0`
export const SIGNATURE_SOUNDS_BELL_ONE_ROOT_MARKER =
  `${SIGNATURE_SAMPLES_ROOT_MARKER}/ss_bell_one_kit_key_cc0/ss_bell_one_kit_key_cc0`
export const SIGNATURE_SOUNDS_BURIAL_PADS_ROOT_MARKER =
  `${SIGNATURE_SAMPLES_ROOT_MARKER}/ss_burial_pads_cc0/ss_burial_pads_cc0`
export const SIGNATURE_SOUNDS_SPIRITUAL_ACOUSTICS_ROOT_MARKER =
  `${SIGNATURE_SAMPLES_ROOT_MARKER}/spiritual+acoustics+cc0+signaturesounds.org/spiritual acoustics cc0 signaturesounds.org`
export const SIGNATURE_SOUNDS_UNDERWATER_ROOT_MARKER =
  `${SIGNATURE_SAMPLES_ROOT_MARKER}/underwater+one+shots+2/underwater one shots`
export const SIGNATURE_SOUNDS_SPANISH_GUITAR_ROOT_MARKER =
  `${SIGNATURE_SAMPLES_ROOT_MARKER}/spanish+guitar/spanish guitar`
export const SIGNATURE_SOUNDS_CUTLERY_ROOT_MARKER =
  `${SIGNATURE_SAMPLES_ROOT_MARKER}/ss_cutlery_percussion_foley_cc0/ss_cutlery_percussion_foley_cc0`
export const SIGNATURE_SOUNDS_VHS_DRUM_ROOT_MARKER =
  `${SIGNATURE_SAMPLES_ROOT_MARKER}/vhs-drumkit+cc0+2/vhs-drumkit cc0`
export const SIGNATURE_SOUNDS_LONDON_UNDERGROUND_ROOT_MARKER =
  `${SIGNATURE_SAMPLES_ROOT_MARKER}/london+underground+rcordings/london underground rcordings`
export const SIGNATURE_SOUNDS_KOTOR_ROOT_MARKER =
  `${SIGNATURE_SAMPLES_ROOT_MARKER}/kotor,+montenegro+-signaturesounds.org/kotor, montenegro -signaturesounds.org`
export const SIGNATURE_SOUNDS_FIREWORKS_ROOT_MARKER =
  `${SIGNATURE_SAMPLES_ROOT_MARKER}/distant+fireworks/distant fireworks`
export const SIGNATURE_SOUNDS_LOOPS_AMBIENCE_ROOT_MARKER =
  `${SIGNATURE_SAMPLES_ROOT_MARKER}/loops+of+ambience/loops of ambience`
export const SIGNATURE_SOUNDS_BEACH_ROCKS_ROOT_MARKER =
  `${SIGNATURE_SAMPLES_ROOT_MARKER}/ss_beach-rocks_textures_cc0/ss_beach-rocks_textures_cc0`
export const SIGNATURE_SOUNDS_CYMBAL_CRASHES_ROOT_MARKER =
  `${SIGNATURE_SAMPLES_ROOT_MARKER}/cymbal+crashes+-+signaturesounds.org/cymbal crashes - signaturesounds.org`
export const SIGNATURE_SOUNDS_WHITE_NOISE_ROOT_MARKER =
  `${SIGNATURE_SAMPLES_ROOT_MARKER}/white+noise/white noise`

/**
 * Excludes archive sidecar files from local sample scans so downloaded pack
 * metadata cannot be mistaken for package-ready audio or license evidence.
 *
 * @param {string} normalizedPath
 */
export function isIgnoredSampleInventoryPath(normalizedPath) {
  return normalizedPath.includes("/__macosx/") || basename(normalizedPath).startsWith("._")
}

/**
 * @param {string} filePath
 */
function basename(filePath) {
  return filePath.split("/").at(-1) ?? filePath
}
