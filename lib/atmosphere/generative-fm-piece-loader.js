export const generativeFmPieceImporters = Object.freeze({
  "420hz-gamma-waves-for-big-brain": () => import("@generative-music/piece-420hz-gamma-waves-for-big-brain"),
  "a-viable-system": () => import("@generative-music/piece-a-viable-system"),
  "above-the-rain": () => import("@generative-music/piece-above-the-rain"),
  "agua-ravine": () => import("@generative-music/piece-agua-ravine"),
  aisatsana: () => import("@generative-music/piece-aisatsana"),
  "animalia-chordata": () => import("@generative-music/piece-animalia-chordata"),
  apoapsis: () => import("@generative-music/piece-apoapsis"),
  "at-sunrise": () => import("@generative-music/piece-at-sunrise"),
  awash: () => import("@generative-music/piece-awash"),
  "beneath-waves": () => import("@generative-music/piece-beneath-waves"),
  bhairav: () => import("@generative-music/piece-bhairav"),
  buttafingers: () => import("@generative-music/piece-buttafingers"),
  "day-dream": () => import("@generative-music/piece-day-dream"),
  didgeridoobeats: () => import("@generative-music/piece-didgeridoobeats"),
  "documentary-films": () => import("@generative-music/piece-documentary-films"),
  drones: () => import("@generative-music/piece-drones"),
  "drones-2": () => import("@generative-music/piece-drones-2"),
  "eno-machine": () => import("@generative-music/piece-eno-machine"),
  enough: () => import("@generative-music/piece-enough"),
  "expand-collapse": () => import("@generative-music/piece-expand-collapse"),
  "eyes-closed": () => import("@generative-music/piece-eyes-closed"),
  homage: () => import("@generative-music/piece-homage"),
  impact: () => import("@generative-music/piece-impact"),
  "last-transit": () => import("@generative-music/piece-last-transit"),
  lemniscate: () => import("@generative-music/piece-lemniscate"),
  "little-bells": () => import("@generative-music/piece-little-bells"),
  lullaby: () => import("@generative-music/piece-lullaby"),
  meditation: () => import("@generative-music/piece-meditation"),
  moment: () => import("@generative-music/piece-moment"),
  nakaii: () => import("@generative-music/piece-nakaii"),
  neuroplasticity: () => import("@generative-music/piece-neuroplasticity"),
  "no-refrain": () => import("@generative-music/piece-no-refrain"),
  "observable-streams": () => import("@generative-music/piece-observable-streams"),
  otherness: () => import("@generative-music/piece-otherness"),
  "oxalis-1": () => import("@generative-music/piece-oxalis-1"),
  peace: () => import("@generative-music/piece-peace"),
  pinwheels: () => import("@generative-music/piece-pinwheels"),
  "pulse-code-modulation": () => import("@generative-music/piece-pulse-code-modulation"),
  remembering: () => import("@generative-music/piece-remembering"),
  "return-to-form": () => import("@generative-music/piece-return-to-form"),
  ritual: () => import("@generative-music/piece-ritual"),
  sevenths: () => import("@generative-music/piece-sevenths"),
  skyline: () => import("@generative-music/piece-skyline"),
  soundtrack: () => import("@generative-music/piece-soundtrack"),
  splash: () => import("@generative-music/piece-splash"),
  "spring-again": () => import("@generative-music/piece-spring-again"),
  stratospheric: () => import("@generative-music/piece-stratospheric"),
  "stream-of-consciousness": () => import("@generative-music/piece-stream-of-consciousness"),
  substrate: () => import("@generative-music/piece-substrate"),
  "timbral-oscillations": () => import("@generative-music/piece-timbral-oscillations"),
  townsend: () => import("@generative-music/piece-townsend"),
  transmission: () => import("@generative-music/piece-transmission"),
  trees: () => import("@generative-music/piece-trees"),
  uun: () => import("@generative-music/piece-uun"),
  "western-medicine": () => import("@generative-music/piece-western-medicine"),
  yesterday: () => import("@generative-music/piece-yesterday"),
  zed: () => import("@generative-music/piece-zed"),
})

/**
 * Imports only the requested Generative.fm piece package and returns its
 * runtime-compatible default export.
 *
 * @param {string} pieceId Stable Generative.fm catalog id.
 * @param {Record<string, () => Promise<{ default: unknown }>>} importers Injectable importer table for behavioral tests.
 * @returns {Promise<unknown>} The selected package's default piece export.
 */
export async function loadGenerativeFmPieceModule(pieceId, importers = generativeFmPieceImporters) {
  if (!Object.hasOwn(importers, pieceId)) {
    throw new Error(`Unknown Generative.fm piece id: ${pieceId}`)
  }

  const importPiece = importers[pieceId]
  const { default: piece } = await importPiece()
  return piece
}

/**
 * Starts Tone activation in parallel with hosted sample-index and piece
 * preparation so a user gesture is consumed before slower network work ends.
 *
 * @param {{
 *   loadRuntimeModules: () => Promise<{ Tone: { start: () => Promise<unknown> | unknown } }>,
 *   prepareRuntime: () => Promise<unknown>,
 *   now?: () => number,
 * }} dependencies Runtime-loading seams used by the browser adapter.
 * @returns {Promise<{ prepared: unknown, preparedAt: number, toneStartedAt: number }>} Prepared runtime and phase completion times.
 */
export async function prepareGenerativeFmPlayback({
  loadRuntimeModules,
  prepareRuntime,
  now = () => performance.now(),
}) {
  const modulesPromise = loadRuntimeModules()
  const toneActivationPromise = modulesPromise
    .then(({ Tone }) => Tone.start())
    .then(() => now())
  const preparedPromise = prepareRuntime().then((prepared) => ({ prepared, preparedAt: now() }))
  const [{ prepared, preparedAt }, toneStartedAt] = await Promise.all([preparedPromise, toneActivationPromise])
  return { prepared, preparedAt, toneStartedAt }
}
