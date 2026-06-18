import assert from "node:assert/strict"
import fs from "node:fs/promises"
import { describe, it } from "node:test"
import {
  createObservableStreamsR2UploadPlan,
  DEFAULT_ATMOSPHERE_PUBLIC_MEDIA_BUCKET,
  DEFAULT_ATMOSPHERE_R2_METADATA_CACHE_CONTROL,
  isTransientR2UploadStatus,
  missingAtmosphereR2UploadEnv,
  publicUrlForR2Object,
  putAtmosphereObjectToR2,
  readAtmospherePublicMediaR2Env,
} from "../lib/atmosphere/r2-sample-hosting.js"

describe("Atmosphere R2 sample hosting", () => {
  it("builds public-media object keys and hosted sample-index URLs", () => {
    const plan = createObservableStreamsR2UploadPlan({
      publicBaseUrl: "https://media.massagelab.app/",
      assetPlan: {
        adaptationId: "observable-streams-vsco-adaptation",
        selectedAssets: [
          {
            instrumentName: "vsco2-piano-mf",
            noteName: "C#2",
            dynamicLayer: "2",
            sourceRelativePath: "VSCO/Keys/Upright Piano/Player_dyn2_rr1_008.wav",
            outputFileName: "piano-c-sharp2.wav",
            sizeBytes: 1024,
          },
          {
            instrumentName: "sso-cor-anglais",
            noteName: "A#3",
            dynamicLayer: "1",
            sourceRelativePath: "VSCO/Woodwinds/Oboe/Sus/Oboe_Sus_A#3_v1_Main.wav",
            outputFileName: "oboe-sus-a-sharp3.wav",
            sizeBytes: 2048,
          },
        ],
        missingNotes: [],
        excludedSources: [{ sourceName: "sso-cor-anglais", decision: "excluded" }],
      },
    })

    assert.equal(plan.bucket, DEFAULT_ATMOSPHERE_PUBLIC_MEDIA_BUCKET)
    assert.equal(plan.objectPrefix, "atmosphere/observable-streams-vsco-adaptation")
    assert.equal(plan.objectCount, 4)
    assert.equal(plan.samplePayloadBytes, 3072)
    assert.equal(
      plan.sampleIndexObjectKey,
      "atmosphere/observable-streams-vsco-adaptation/sample-index.json",
    )
    assert.equal(
      plan.sampleObjects[0].objectKey,
      "atmosphere/observable-streams-vsco-adaptation/samples/piano-c-sharp2.wav",
    )
    assert.equal(
      plan.sampleIndex["vsco2-piano-mf"]["C#2"],
      "https://media.massagelab.app/atmosphere/observable-streams-vsco-adaptation/samples/piano-c-sharp2.wav",
    )
    assert.equal(
      plan.sampleIndex["sso-cor-anglais"]["A#3"],
      "https://media.massagelab.app/atmosphere/observable-streams-vsco-adaptation/samples/oboe-sus-a-sharp3.wav",
    )
    assert.equal(plan.sampleObjects[0].cacheControl, "public, max-age=31536000, immutable")
    assert.equal(plan.metadataCacheControl, DEFAULT_ATMOSPHERE_R2_METADATA_CACHE_CONTROL)
    assert.equal(plan.metadataObjects[0].cacheControl, DEFAULT_ATMOSPHERE_R2_METADATA_CACHE_CONTROL)
    assert.equal(plan.metadataObjects[1].cacheControl, DEFAULT_ATMOSPHERE_R2_METADATA_CACHE_CONTROL)
    assert.match(plan.metadataObjects[0].body, /"vsco2-piano-mf"/)
    assert.match(plan.metadataObjects[1].body, /"sampleObjectCount": 2/)
  })

  it("supports custom prefixes while encoding public URL path segments", () => {
    const plan = createObservableStreamsR2UploadPlan({
      bucket: "custom-public-media",
      publicBaseUrl: "https://media.example.test",
      objectPrefix: "/atmosphere/custom observable/",
      assetPlan: {
        selectedAssets: [
          {
            instrumentName: "vsco2-piano-mf",
            noteName: "F2",
            sourceRelativePath: "Piano.wav",
            outputFileName: "piano f2.wav",
          },
        ],
      },
    })

    assert.equal(plan.bucket, "custom-public-media")
    assert.equal(plan.sampleIndexObjectKey, "atmosphere/custom observable/sample-index.json")
    assert.equal(
      plan.sampleObjects[0].publicUrl,
      "https://media.example.test/atmosphere/custom%20observable/samples/piano%20f2.wav",
    )
    assert.equal(
      publicUrlForR2Object("https://media.example.test/", "atmosphere/custom observable/sample-index.json"),
      "https://media.example.test/atmosphere/custom%20observable/sample-index.json",
    )
  })

  it("adds rendered sample objects to the hosted index and manifest", () => {
    const plan = createObservableStreamsR2UploadPlan({
      publicBaseUrl: "https://media.massagelab.app",
      assetPlan: {
        selectedAssets: [
          {
            instrumentName: "vsco2-piano-mf",
            noteName: "C#2",
            sourceRelativePath: "Piano.wav",
            outputFileName: "piano-c-sharp2.wav",
            sizeBytes: 1024,
          },
        ],
      },
      renderedSampleObjects: [
        {
          kind: "rendered-sample",
          instrumentName: "observable-streams__vsco2-piano-mf",
          noteName: "C2",
          sourceInstrumentName: "vsco2-piano-mf",
          sourceNoteName: "C#2",
          sourceRelativePath: "Piano.wav",
          outputFileName: "rendered-piano-c2.wav",
          objectKey: "atmosphere/observable-streams-vsco-adaptation/rendered/observable-streams__vsco2-piano-mf/rendered-piano-c2.wav",
          publicUrl:
            "https://media.massagelab.app/atmosphere/observable-streams-vsco-adaptation/rendered/observable-streams__vsco2-piano-mf/rendered-piano-c2.wav",
          contentType: "audio/wav",
          body: new Uint8Array([1, 2, 3]),
          sizeBytes: 3,
          render: { additionalRenderLengthSeconds: 3, fadeOutSeconds: 0 },
        },
      ],
    })

    assert.equal(plan.objectCount, 4)
    assert.equal(plan.samplePayloadBytes, 1027)
    assert.equal(plan.sampleObjects.length, 1)
    assert.equal(plan.renderedSampleObjects.length, 1)
    assert.equal(
      plan.sampleIndex["observable-streams__vsco2-piano-mf"].C2,
      "https://media.massagelab.app/atmosphere/observable-streams-vsco-adaptation/rendered/observable-streams__vsco2-piano-mf/rendered-piano-c2.wav",
    )
    assert.match(plan.metadataObjects[0].body, /"observable-streams__vsco2-piano-mf"/)
    assert.match(plan.metadataObjects[1].body, /"renderedAssets"/)
    assert.equal(plan.manifest.renderedAssets[0].sourceNoteName, "C#2")
  })

  it("keeps the public-media bucket explicit in environment readiness checks", () => {
    const ready = readAtmospherePublicMediaR2Env({
      CLOUDFLARE_ACCOUNT_ID: "account-id",
      R2_ACCESS_KEY_ID: "access-key",
      R2_SECRET_ACCESS_KEY: "secret-key",
      MASSAGELAB_PUBLIC_MEDIA_BUCKET: "massagelab-public-media",
      MASSAGELAB_PUBLIC_MEDIA_PUBLIC_BASE_URL: "https://media.massagelab.app/",
      MASSAGELAB_PUBLIC_MEDIA_OBJECT_PREFIX: "atmosphere/observable-streams-vsco-adaptation",
      MASSAGELAB_PUBLIC_MEDIA_METADATA_CACHE_CONTROL: "public, max-age=60, must-revalidate",
    })
    assert.deepEqual(missingAtmosphereR2UploadEnv(ready), [])
    assert.equal(ready.publicBaseUrl, "https://media.massagelab.app")
    assert.equal(ready.metadataCacheControl, "public, max-age=60, must-revalidate")

    const missing = missingAtmosphereR2UploadEnv(readAtmospherePublicMediaR2Env({}))
    assert.deepEqual(missing, [
      "CLOUDFLARE_ACCOUNT_ID or MASSAGELAB_PUBLIC_MEDIA_R2_ENDPOINT/MASSAGELAB_R2_ENDPOINT",
      "R2_ACCESS_KEY_ID",
      "R2_SECRET_ACCESS_KEY",
      "MASSAGELAB_PUBLIC_MEDIA_PUBLIC_BASE_URL",
    ])
  })

  it("rejects unsafe object keys", () => {
    assert.throws(
      () => publicUrlForR2Object("https://media.example.test", "atmosphere/../sample.wav"),
      /Invalid R2 object key/,
    )
  })

  it("classifies only 429 and 5xx upload responses as retryable", () => {
    assert.equal(isTransientR2UploadStatus(429), true)
    assert.equal(isTransientR2UploadStatus(500), true)
    assert.equal(isTransientR2UploadStatus(503), true)
    assert.equal(isTransientR2UploadStatus(408), false)
    assert.equal(isTransientR2UploadStatus(400), false)
    assert.equal(isTransientR2UploadStatus(200), false)
  })

  it("retries transient R2 upload responses before succeeding", async () => {
    const originalFetch = globalThis.fetch
    const originalWarn = console.warn
    const calls = []

    console.warn = () => undefined
    globalThis.fetch = async (url, init) => {
      calls.push({ url, init })
      if (calls.length === 1) {
        return new Response("temporarily unavailable", { status: 503 })
      }
      return new Response("", { status: 200 })
    }

    try {
      await putAtmosphereObjectToR2({
        accountId: "account-id",
        accessKeyId: "access-key",
        secretAccessKey: "secret-key",
        bucket: "massagelab-public-media",
        endpoint: "https://account-id.r2.cloudflarestorage.com",
        publicBaseUrl: "https://media.massagelab.app",
        cacheControl: "public, max-age=31536000, immutable",
        objectPrefix: "atmosphere/observable-streams-vsco-adaptation",
      }, {
        objectKey: "atmosphere/observable-streams-vsco-adaptation/sample-index.json",
        body: "{}\n",
        contentType: "application/json; charset=utf-8",
      })
    } finally {
      globalThis.fetch = originalFetch
      console.warn = originalWarn
    }

    assert.equal(calls.length, 2)
    assert.equal(
      calls[0].url,
      "https://account-id.r2.cloudflarestorage.com/massagelab-public-media/atmosphere/observable-streams-vsco-adaptation/sample-index.json",
    )
    assert.equal(calls[0].init.method, "PUT")
    assert.equal(calls[1].init.method, "PUT")
  })

  it("keeps the checked-in public media CORS policy limited to browser reads", async () => {
    const policyUrl = new URL("../docs/cloudflare/massagelab-public-media-cors.json", import.meta.url)
    const policy = JSON.parse(await fs.readFile(policyUrl, "utf8"))
    assert.deepEqual(policy.rules, [
      {
        id: "Public browser reads for Atmosphere audio",
        allowed: {
          methods: ["GET", "HEAD"],
          origins: ["*"],
          headers: ["Range"],
        },
        exposeHeaders: [
          "Accept-Ranges",
          "Cache-Control",
          "Content-Length",
          "Content-Range",
          "Content-Type",
          "ETag",
        ],
        maxAgeSeconds: 86400,
      },
    ])
  })
})
