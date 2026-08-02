import path from "node:path"

/** Returns trimmed FFprobe output after preserving spawn and decoder diagnostics. */
function parseProbeOutput(result, filePath) {
  const filename = path.basename(filePath)

  if (result.error) {
    throw new Error(`FFprobe could not inspect ${filename}: ${result.error.message}`, {
      cause: result.error,
    })
  }

  if (result.status !== 0) {
    const termination = result.signal
      ? `signal ${result.signal}`
      : `exit code ${result.status ?? "unknown"}`
    const diagnostic = result.stderr?.trim()
    throw new Error(
      `FFprobe failed for ${filename} with ${termination}${diagnostic ? `: ${diagnostic}` : "."}`,
    )
  }

  return result.stdout?.trim() ?? ""
}

/**
 * Rejects FFprobe process failures before parsing dimensions so generator errors retain
 * the spawn error or decoder diagnostic that explains the underlying failure.
 */
export function parseProbeDimensions(result, filePath) {
  const filename = path.basename(filePath)
  const output = parseProbeOutput(result, filePath)
  const [width, height] = output.split("x").map(Number)
  if (!output || !Number.isFinite(width) || !Number.isFinite(height)) {
    throw new Error(`FFprobe returned invalid dimensions for ${filename}: ${output || "<empty output>"}.`)
  }

  return { width, height }
}

/** Parses a positive video duration in seconds for bounded poster-frame seeking. */
export function parseProbeDurationSeconds(result, filePath) {
  const filename = path.basename(filePath)
  const output = parseProbeOutput(result, filePath)
  const durationSeconds = Number.parseFloat(output)
  if (!output || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error(`FFprobe returned invalid duration for ${filename}: ${output || "<empty output>"}.`)
  }
  return durationSeconds
}

/** Uses a positive fallback only when a successful duration probe has no usable output. */
export function resolveProbeDurationSeconds(result, filePath, fallbackDurationMs) {
  try {
    return parseProbeDurationSeconds(result, filePath)
  } catch (error) {
    const output = result.stdout?.trim() ?? ""
    const fallbackSeconds = Number(fallbackDurationMs) / 1000
    if (
      !result.error
      && result.status === 0
      && (!output || output === "N/A")
      && Number.isFinite(fallbackSeconds)
      && fallbackSeconds > 0
    ) {
      return fallbackSeconds
    }
    throw error
  }
}
