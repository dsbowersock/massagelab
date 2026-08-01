/** Parses Chromium's computed 2D transform while rejecting malformed numeric serialization. */
export function parseComputedMatrix(transform: string) {
  const matrix2d = /^matrix\(([^)]+)\)$/.exec(transform)
  const matrix3d = /^matrix3d\(([^)]+)\)$/.exec(transform)
  const match = matrix2d ?? matrix3d
  if (!match) {
    throw new Error(`Expected a computed 2D or 3D matrix, received: ${transform}`)
  }
  const rawValues = match[1].split(",").map((value) => value.trim())
  const values = rawValues.map((value) => Number(value))
  const expectedLength = matrix2d ? 6 : 16
  if (
    rawValues.length !== expectedLength
    || rawValues.some((value) => value === "")
    || values.some((value) => !Number.isFinite(value))
  ) {
    throw new Error(`Expected ${expectedLength} finite computed matrix values, received: ${transform}`)
  }
  return values
}
