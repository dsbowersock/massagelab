import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  buildPosterArgs,
  buildRenditionEncodeArgs,
} from "../scripts/chimer-preview-generation/ffmpeg-plan.mjs"
import {
  calculateFrameVariation,
  parseMediaProbe,
  validateAnimatedFrameVariation,
  validateLoopSeam,
  validatePilotManifest,
  validateRenditionMetadata,
} from "../scripts/chimer-preview-generation/media-validation.mjs"

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
    const filter = args[args.indexOf("-filter_complex") + 1]
    assert.match(filter, /xfade=transition=fade:duration=0\.800:offset=9\.200/)
    assert.match(filter, /format=yuv420p\[outv\]$/)
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

describe("background preview media validation", () => {
  it("rejects animated captures whose sampled decoded frames are identical", () => {
    assert.equal(calculateFrameVariation(["a", "a", "a", "a"]), 0)
    assert.deepEqual(validateAnimatedFrameVariation({
      backgroundId: "animated",
      motionIntensity: "medium",
      frameHashes: ["a", "a", "a", "a"],
    }), ["animated: decoded samples did not prove animation"])
    assert.deepEqual(validateAnimatedFrameVariation({
      backgroundId: "animated",
      motionIntensity: "medium",
      frameHashes: ["a", "b", "c", "d", "e"],
    }), [])
  })

  it("applies different seam limits to natural and crossfade loops", () => {
    assert.deepEqual(validateLoopSeam({ strategy: "natural", normalizedDifference: 0.02 }), [])
    assert.deepEqual(validateLoopSeam({ strategy: "natural", normalizedDifference: 0.25 }), [
      "natural loop seam difference 0.250 exceeds 0.080",
    ])
    assert.deepEqual(validateLoopSeam({ strategy: "crossfade", normalizedDifference: 0.09 }), [])
    assert.deepEqual(validateLoopSeam({ strategy: "crossfade", normalizedDifference: 0.13 }), [
      "crossfade loop seam difference 0.130 exceeds 0.120",
    ])
  })

  it("parses fail-closed FFprobe metadata", () => {
    const actual = parseMediaProbe({ stdout: JSON.stringify({
      streams: [{
        codec_type: "video",
        codec_name: "vp9",
        pix_fmt: "yuv420p",
        width: 540,
        height: 960,
        avg_frame_rate: "24/1",
      }],
      format: { duration: "10.000" },
    }) }, "high.webm")
    assert.deepEqual(validateRenditionMetadata(actual, {
      codec: "vp9", pixelFormat: "yuv420p", width: 540, height: 960,
      fps: 24, durationMs: 10000,
    }), [])
    assert.throws(() => parseMediaProbe({ stdout: "{}" }, "missing.webm"), /exactly one video stream/)
  })

  it("requires a complete hashed v2 pilot manifest", () => {
    const backgroundId = "massage-lab-silk"
    const recipeRevision = "recipe-1"
    const renditions = ["landscape", "square", "vertical"].flatMap((aspect) =>
      ["low", "standard", "high"].flatMap((quality) => [
        { codec: "vp9", extension: "webm", mimeType: "video/webm; codecs=vp9" },
        { codec: "h264", extension: "mp4", mimeType: "video/mp4; codecs=avc1.42E01E" },
      ].map(({ codec, extension, mimeType }) => ({
        aspect,
        quality,
        codec,
        url: `${backgroundId}/${recipeRevision}/${aspect}/${quality}.${extension}`,
        mimeType,
        width: 1,
        height: 1,
        durationMs: 9200,
        fps: 24,
        bytes: 1,
        sha256: "a".repeat(64),
      }))),
    )
    const posters = Object.fromEntries(["landscape", "square", "vertical"].map((aspect) => [aspect, {
      url: `${backgroundId}/${recipeRevision}/${aspect}/poster.webp`,
      width: 1,
      height: 1,
      bytes: 1,
      sha256: "b".repeat(64),
    }]))
    const entry = { backgroundId, recipeRevision, loopStrategy: "crossfade", loopBoundaryMs: 9200, renditions, posters }
    assert.deepEqual(validatePilotManifest([entry]), [])
    assert.match(validatePilotManifest([{ ...entry, renditions: renditions.slice(1) }]).join("\n"), /exactly 18 renditions/)
    assert.match(validatePilotManifest([{ ...entry, renditions: renditions.map((item, index) => index === 0
      ? { ...item, sha256: "bad", bytes: 0 }
      : item) }]).join("\n"), /positive bytes/)
  })
})
