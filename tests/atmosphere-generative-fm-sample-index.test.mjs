import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  assertGenerativeFmSampleIndex,
  fetchGenerativeFmSampleIndex,
  normalizeSampleGroups,
} from "../lib/atmosphere/generative-fm-sample-index.js"

const observableStreamsSampleGroups = [
  ["observable-streams__vsco2-piano-mf", "vsco2-piano-mf"],
  ["observable-streams__vsco2-violin-arcvib", "vsco2-violin-arcvib"],
  ["observable-streams__sso-cor-anglais", "sso-cor-anglais"],
]

describe("Generative.fm sample-index helpers", () => {
  it("accepts the hosted Observable Streams source-key sample index", () => {
    const sampleIndex = assertGenerativeFmSampleIndex({
      "vsco2-piano-mf": {
        C2: "https://media.massagelab.app/piano-c2.wav",
      },
      "vsco2-violin-arcvib": {
        G4: "https://media.massagelab.app/violin-g4.wav",
      },
      "sso-cor-anglais": {
        C4: "https://media.massagelab.app/oboe-c4.wav",
      },
    }, observableStreamsSampleGroups)

    assert.equal(sampleIndex["sso-cor-anglais"].C4, "https://media.massagelab.app/oboe-c4.wav")
  })

  it("accepts rendered instrument names when a cached rendered index is supplied", () => {
    const sampleIndex = assertGenerativeFmSampleIndex({
      "observable-streams__vsco2-piano-mf": ["cached-piano-render.wav"],
      "observable-streams__vsco2-violin-arcvib": ["cached-violin-render.wav"],
      "observable-streams__sso-cor-anglais": ["cached-oboe-render.wav"],
    }, observableStreamsSampleGroups)

    assert.deepEqual(sampleIndex["observable-streams__vsco2-piano-mf"], ["cached-piano-render.wav"])
  })

  it("rejects missing required package sample groups", () => {
    assert.throws(
      () => assertGenerativeFmSampleIndex({
        "vsco2-piano-mf": { C2: "piano.wav" },
        "vsco2-violin-arcvib": { G4: "violin.wav" },
      }, observableStreamsSampleGroups),
      /observable-streams__sso-cor-anglais or sso-cor-anglais/,
    )
  })

  it("loads JSON with no-cache semantics before validating required instruments", async () => {
    const requests = []
    const sampleIndex = await fetchGenerativeFmSampleIndex({
      sampleIndexUrl: "https://media.massagelab.app/sample-index.json",
      sampleGroups: observableStreamsSampleGroups,
      fetchImpl: async (url, init) => {
        requests.push({ url, init })
        return Response.json({
          "vsco2-piano-mf": { C2: "piano.wav" },
          "vsco2-violin-arcvib": { G4: "violin.wav" },
          "sso-cor-anglais": { C4: "oboe.wav" },
        })
      },
    })

    assert.equal(sampleIndex["sso-cor-anglais"].C4, "oboe.wav")
    assert.equal(requests[0].url, "https://media.massagelab.app/sample-index.json")
    assert.equal(requests[0].init.cache, "no-cache")
    assert.equal(requests[0].init.headers.Accept, "application/json")
  })

  it("surfaces hosted sample-index HTTP failures", async () => {
    await assert.rejects(
      () => fetchGenerativeFmSampleIndex({
        sampleIndexUrl: "https://media.massagelab.app/sample-index.json",
        sampleGroups: observableStreamsSampleGroups,
        fetchImpl: async () => new Response("not found", { status: 404 }),
      }),
      /HTTP 404/,
    )
  })

  it("normalizes string and fallback-array sample group declarations", () => {
    assert.deepEqual(normalizeSampleGroups([
      "solo-instrument",
      ["rendered", "source", ""],
      [],
    ]), [
      ["solo-instrument"],
      ["rendered", "source"],
    ])
  })
})
