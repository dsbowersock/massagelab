import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  buildPosterArgs,
  buildRenditionEncodeArgs,
} from "../scripts/chimer-preview-generation/ffmpeg-plan.mjs"

describe("background preview encoding plans", () => {
  it("builds bounded VP9 output with Lanczos scaling", () => {
    const args = buildRenditionEncodeArgs({
      inputPath: "master.webm",
      outputPath: "high.webm",
      codec: "vp9",
      width: 540,
      height: 960,
      fps: 24,
      durationMs: 10000,
      loopStrategy: "natural",
      crossfadeMs: 0,
    })
    assert.deepEqual(args.slice(-12), [
      "-c:v", "libvpx-vp9", "-deadline", "good", "-cpu-used", "2",
      "-crf", "30", "-b:v", "0", "-an", "high.webm",
    ])
    assert.ok(args.includes("fps=24,scale=540:960:flags=lanczos,format=yuv420p"))
  })

  it("uses libx264 fast-start output for compatibility renditions", () => {
    const args = buildRenditionEncodeArgs({
      inputPath: "master.webm",
      outputPath: "standard.mp4",
      codec: "h264",
      width: 640,
      height: 360,
      fps: 24,
      durationMs: 10000,
      loopStrategy: "crossfade",
      crossfadeMs: 800,
    })
    assert.ok(args.includes("libx264"))
    assert.ok(args.includes("+faststart"))
    assert.match(args[args.indexOf("-filter_complex") + 1], /xfade=transition=fade:duration=0\.800:offset=9\.200/)
  })

  it("extracts one high-dimension WebP poster at the authored time", () => {
    const args = buildPosterArgs({
      inputPath: "master.webm",
      outputPath: "poster.webp",
      width: 960,
      height: 540,
      posterTimeMs: 4000,
      durationMs: 12000,
    })
    assert.deepEqual(args, [
      "-y", "-ss", "4.000", "-i", "master.webm",
      "-vf", "scale=960:540:flags=lanczos", "-frames:v", "1",
      "-c:v", "libwebp", "-quality", "84", "-an", "poster.webp",
    ])
    assert.throws(() => buildPosterArgs({
      inputPath: "master.webm",
      outputPath: "poster.webp",
      width: 960,
      height: 540,
      posterTimeMs: 12000,
      durationMs: 12000,
    }), /poster time must be within/)
  })
})

