import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  generativeFmPieceImporters,
  loadGenerativeFmPieceModule,
  prepareGenerativeFmPlayback,
} from "../lib/atmosphere/generative-fm-piece-loader.js"

const expectedPieceIds = [
  "420hz-gamma-waves-for-big-brain",
  "a-viable-system",
  "above-the-rain",
  "agua-ravine",
  "aisatsana",
  "animalia-chordata",
  "apoapsis",
  "at-sunrise",
  "awash",
  "beneath-waves",
  "bhairav",
  "buttafingers",
  "day-dream",
  "didgeridoobeats",
  "documentary-films",
  "drones",
  "drones-2",
  "eno-machine",
  "enough",
  "expand-collapse",
  "eyes-closed",
  "homage",
  "impact",
  "last-transit",
  "lemniscate",
  "little-bells",
  "lullaby",
  "meditation",
  "moment",
  "nakaii",
  "neuroplasticity",
  "no-refrain",
  "observable-streams",
  "otherness",
  "oxalis-1",
  "peace",
  "pinwheels",
  "pulse-code-modulation",
  "remembering",
  "return-to-form",
  "ritual",
  "sevenths",
  "skyline",
  "soundtrack",
  "splash",
  "spring-again",
  "stratospheric",
  "stream-of-consciousness",
  "substrate",
  "timbral-oscillations",
  "townsend",
  "transmission",
  "trees",
  "uun",
  "western-medicine",
  "yesterday",
  "zed",
]

describe("Generative.fm piece loader", () => {
  it("exposes exactly one lazy importer for every supported piece id", () => {
    assert.deepEqual(Object.keys(generativeFmPieceImporters).sort(), expectedPieceIds.sort())
  })

  it("loads only the selected piece and resolves its default export", async () => {
    const calls = []
    const expectedPiece = () => "trees"
    const fakeImporters = {
      trees: async () => {
        calls.push("trees")
        return { default: expectedPiece }
      },
      uun: async () => {
        calls.push("uun")
        return { default: () => "uun" }
      },
    }

    assert.equal(calls.length, 0)
    const piece = await loadGenerativeFmPieceModule("trees", fakeImporters)

    assert.equal(piece, expectedPiece)
    assert.deepEqual(calls, ["trees"])
  })

  it("rejects unknown piece ids before attempting an import", async () => {
    let importAttempted = false
    const fakeImporters = {
      trees: async () => {
        importAttempted = true
        return { default: () => "trees" }
      },
    }

    await assert.rejects(
      () => loadGenerativeFmPieceModule("missing", fakeImporters),
      /Unknown Generative\.fm piece id: missing/,
    )
    assert.equal(importAttempted, false)
  })

  it("rejects prototype-property ids that are not registered importers", async () => {
    await assert.rejects(
      () => loadGenerativeFmPieceModule("toString", { trees: async () => ({ default: () => "trees" }) }),
      /Unknown Generative\.fm piece id: toString/,
    )
  })

  it("requests Tone activation while sample and piece preparation is still pending", async () => {
    const events = []
    let finishPreparation
    const preparedRuntime = { pieceId: "trees" }
    const preparation = new Promise((resolve) => {
      finishPreparation = () => resolve(preparedRuntime)
    })

    const preparedPromise = prepareGenerativeFmPlayback({
      loadRuntimeModules: async () => {
        events.push("load-runtime-modules")
        return {
          Tone: {
            start: async () => {
              events.push("tone-start")
            },
          },
        }
      },
      prepareRuntime: async () => {
        await preparation
        events.push("activate-piece")
        return preparedRuntime
      },
    })
    await new Promise((resolve) => setImmediate(resolve))

    assert.deepEqual(events.slice(0, 2), ["load-runtime-modules", "tone-start"])
    assert.equal(events.includes("activate-piece"), false)

    finishPreparation()
    assert.equal((await preparedPromise).prepared, preparedRuntime)
    assert.deepEqual(events, ["load-runtime-modules", "tone-start", "activate-piece"])
  })

  it("records preparation and Tone completion at their independent phase boundaries", async () => {
    let clock = 0
    let finishPreparation
    let finishToneActivation
    const preparedRuntime = { pieceId: "trees" }
    const preparation = new Promise((resolve) => {
      finishPreparation = resolve
    })
    const toneActivation = new Promise((resolve) => {
      finishToneActivation = resolve
    })

    const playback = prepareGenerativeFmPlayback({
      loadRuntimeModules: async () => ({
        Tone: {
          start: async () => toneActivation,
        },
      }),
      prepareRuntime: async () => {
        await preparation
        return preparedRuntime
      },
      now: () => clock,
    })
    await new Promise((resolve) => setImmediate(resolve))

    clock = 41
    finishPreparation()
    await new Promise((resolve) => setImmediate(resolve))
    clock = 173
    finishToneActivation()

    assert.deepEqual(await playback, {
      prepared: preparedRuntime,
      preparedAt: 41,
      toneStartedAt: 173,
    })
  })
})
