// @ts-check

/**
 * Returns the independent left/right tones for a centered binaural carrier.
 *
 * @param {number} carrierHz Center frequency in hertz.
 * @param {number} beatHz Difference between the two channels in hertz.
 * @returns {{ leftHz: number, rightHz: number }} Channel frequencies in hertz.
 */
export function binauralChannelFrequencies(carrierHz, beatHz) {
  return {
    leftHz: carrierHz - beatHz / 2,
    rightHz: carrierHz + beatHz / 2,
  }
}

/**
 * Keeps live Web Audio parameter changes click-free without feeling sluggish.
 *
 * @param {number} [value=0.08] Requested ramp duration in seconds.
 * @returns {number} A duration clamped to the safe 0.03–0.25 second range.
 */
export function rampSeconds(value = 0.08) {
  return Math.min(0.25, Math.max(0.03, value))
}
