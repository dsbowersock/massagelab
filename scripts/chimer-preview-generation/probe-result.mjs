import path from "node:path"

/**
 * Rejects FFprobe process failures before parsing dimensions so generator errors retain
 * the spawn error or decoder diagnostic that explains the underlying failure.
 */
export function parseProbeDimensions(result, filePath) {
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

  const output = result.stdout?.trim() ?? ""
  const [width, height] = output.split("x").map(Number)
  if (!output || !Number.isFinite(width) || !Number.isFinite(height)) {
    throw new Error(`FFprobe returned invalid dimensions for ${filename}: ${output || "<empty output>"}.`)
  }

  return { width, height }
}
