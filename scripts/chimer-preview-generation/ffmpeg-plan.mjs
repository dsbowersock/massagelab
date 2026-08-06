const CODEC_ARGS = Object.freeze({
  vp9: Object.freeze([
    "-c:v", "libvpx-vp9", "-deadline", "good", "-cpu-used", "2",
    "-crf", "30", "-b:v", "0",
  ]),
  h264: Object.freeze([
    "-c:v", "libx264", "-preset", "slow", "-crf", "21",
    "-profile:v", "high", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
  ]),
})

function seconds(milliseconds) {
  return (milliseconds / 1000).toFixed(3)
}

function validateVideoInput(input) {
  if (!input?.inputPath || !input?.outputPath) throw new Error("Preview input and output paths are required")
  if (!CODEC_ARGS[input.codec]) throw new Error(`Unsupported preview codec: ${input.codec}`)
  if (!Number.isInteger(input.width) || input.width <= 0 || !Number.isInteger(input.height) || input.height <= 0) {
    throw new Error("Preview dimensions must be positive integers")
  }
  if (![24, 30].includes(input.fps)) throw new Error("Preview fps must be 24 or 30")
  if (!Number.isInteger(input.durationMs) || input.durationMs <= 0) throw new Error("Preview duration must be positive")
}

function baseFilter({ fps, width, height }) {
  return `fps=${fps},scale=${width}:${height}:flags=lanczos,format=yuv420p`
}

function suffix(codec, outputPath) {
  return [...CODEC_ARGS[codec], "-an", outputPath]
}

/** Builds a deterministic encode that preserves an authored natural boundary. */
export function buildNaturalVideoArgs(input) {
  validateVideoInput(input)
  if (input.crossfadeMs !== 0) throw new Error("Natural loops require a zero crossfade")
  return [
    "-y", "-i", input.inputPath,
    "-t", seconds(input.durationMs),
    "-vf", baseFilter(input),
    ...suffix(input.codec, input.outputPath),
  ]
}

/**
 * Blends only the declared tail interval with the capture's beginning. The
 * output retains one authored duration and never reverses or synthesizes motion.
 */
export function buildCrossfadeVideoArgs(input) {
  validateVideoInput(input)
  if (!Number.isInteger(input.crossfadeMs) || input.crossfadeMs < 250
    || input.crossfadeMs > 2000 || input.crossfadeMs >= input.durationMs) {
    throw new Error("Crossfade loops require a 250-2000ms interval shorter than the duration")
  }
  const duration = seconds(input.durationMs)
  const fade = seconds(input.crossfadeMs)
  const offset = seconds(input.durationMs - input.crossfadeMs)
  const filter = [
    `[0:v]${baseFilter(input)},split=2[bodySource][headSource]`,
    `[bodySource]trim=start=0:end=${duration},setpts=PTS-STARTPTS[body]`,
    `[headSource]trim=start=0:end=${fade},setpts=PTS-STARTPTS[head]`,
    `[body][head]xfade=transition=fade:duration=${fade}:offset=${offset}[outv]`,
  ].join(";")
  return [
    "-y", "-i", input.inputPath,
    "-filter_complex", filter,
    "-map", "[outv]",
    "-t", duration,
    ...suffix(input.codec, input.outputPath),
  ]
}

export function buildRenditionEncodeArgs(input) {
  if (input.loopStrategy === "natural") return buildNaturalVideoArgs(input)
  if (input.loopStrategy === "crossfade") return buildCrossfadeVideoArgs(input)
  throw new Error(`Unsupported loop strategy: ${input.loopStrategy}`)
}

/** Extracts exactly one poster frame from the high-quality aspect master. */
export function buildPosterArgs(input) {
  if (!input?.inputPath || !input?.outputPath) throw new Error("Poster input and output paths are required")
  if (!Number.isInteger(input.width) || input.width <= 0 || !Number.isInteger(input.height) || input.height <= 0) {
    throw new Error("Poster dimensions must be positive integers")
  }
  if (!Number.isInteger(input.durationMs) || !Number.isInteger(input.posterTimeMs)
    || input.posterTimeMs < 0 || input.posterTimeMs >= input.durationMs) {
    throw new Error("poster time must be within the authored duration")
  }
  return [
    "-y", "-ss", seconds(input.posterTimeMs), "-i", input.inputPath,
    "-vf", `scale=${input.width}:${input.height}:flags=lanczos`,
    "-frames:v", "1", "-c:v", "libwebp", "-quality", "84", "-an", input.outputPath,
  ]
}
