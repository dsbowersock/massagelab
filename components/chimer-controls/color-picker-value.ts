const COMPLETE_HEX_COLOR_MATCH = /^#[0-9a-f]{6}$/i

/**
 * Returns a normalized color only after the user has entered a complete
 * six-digit value. Partial typing stays local so it cannot reset the caret.
 */
export function normalizeLiveColorPickerHex(value: string) {
  const trimmed = value.trim()
  return COMPLETE_HEX_COLOR_MATCH.test(trimmed) ? trimmed.toLowerCase() : null
}
