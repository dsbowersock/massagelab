// @ts-check

/** @typedef {"prompt" | "instructions" | "installed" | "unsupported"} PwaInstallStatus */

/**
 * Resolves only observable installation capability. Unknown browsers remain
 * unsupported so the UI never guesses at platform-specific instructions.
 *
 * @param {{ isStandalone?: boolean, hasPrompt?: boolean, isIosSafari?: boolean }} input
 * @returns {PwaInstallStatus}
 */
export function resolvePwaInstallStatus(input = {}) {
  if (input.isStandalone) return "installed"
  if (input.hasPrompt) return "prompt"
  if (input.isIosSafari) return "instructions"
  return "unsupported"
}

/**
 * Detects Safari on iOS/iPadOS, including iPadOS desktop-class user agents,
 * while excluding alternate iOS browser identifiers.
 *
 * @param {{ userAgent?: unknown, platform?: unknown, maxTouchPoints?: unknown }} input
 */
export function isIosSafariNavigator(input = {}) {
  const userAgent = String(input.userAgent ?? "")
  const platform = String(input.platform ?? "")
  const maxTouchPoints = Number(input.maxTouchPoints ?? 0)
  const isIosDevice = /iPad|iPhone|iPod/.test(userAgent)
    || (platform === "MacIntel" && maxTouchPoints > 1)
  const isSafari = /AppleWebKit\/[\d.]+.*Version\/[\d.]+.*Safari\/[\d.]+/.test(userAgent)
    && !/(CriOS|FxiOS|EdgiOS|OPiOS)/.test(userAgent)

  return isIosDevice && isSafari
}
