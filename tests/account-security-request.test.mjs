import assert from "node:assert/strict"
import { describe, it } from "node:test"

const requestModule = await import("../lib/account-security-request.ts")

const SITE_URL = "https://massagelab.app/account"
const ENDPOINT_URL = "https://massagelab.app/api/account/security/totp/setup"
const ALLOWED_KEYS = ["proofMethod", "confirmed"]

describe("trusted account-security JSON requests", () => {
  it("accepts only the configured request origin with exact browser provenance and JSON shape", async () => {
    assert.equal(typeof requestModule.parseTrustedAccountSecurityJson, "function")

    const result = await requestModule.parseTrustedAccountSecurityJson({
      request: trustedRequest({
        contentType: "Application/JSON ; Charset=UTF-8",
        body: JSON.stringify({ proofMethod: "PASSWORD", confirmed: true }),
      }),
      expectedSiteUrl: SITE_URL,
      allowedKeys: ALLOWED_KEYS,
    })

    assert.deepEqual(result, {
      ok: true,
      body: { proofMethod: "PASSWORD", confirmed: true },
    })
  })

  for (const [label, request, expectedSiteUrl = SITE_URL] of [
    ["a missing Origin", trustedRequest({ origin: null })],
    ["a contradictory Origin", trustedRequest({ origin: "https://attacker.example" })],
    ["an Origin with a path", trustedRequest({ origin: "https://massagelab.app/account" })],
    ["an apex/www mismatch", trustedRequest({ url: "https://www.massagelab.app/api/account/security/totp/setup", origin: "https://www.massagelab.app" })],
    ["a request URL origin mismatch", trustedRequest({ url: "https://attacker.example/api/account/security/totp/setup" })],
    ["a port mismatch", trustedRequest({ url: "https://massagelab.app:444/api/account/security/totp/setup", origin: "https://massagelab.app:444" })],
    ["a malformed configured URL", trustedRequest(), "not a URL"],
    ["a non-web configured URL", trustedRequest(), "file:///tmp/massagelab"],
    ["a malformed request URL", malformedUrlRequest()],
  ]) {
    it(`rejects ${label} as untrusted`, async () => {
      assert.equal(typeof requestModule.parseTrustedAccountSecurityJson, "function")
      assert.deepEqual(
        await requestModule.parseTrustedAccountSecurityJson({
          request,
          expectedSiteUrl,
          allowedKeys: ALLOWED_KEYS,
        }),
        { ok: false, code: "UNTRUSTED_REQUEST" },
      )
    })
  }

  for (const fetchSite of [null, "same-site", "cross-site", "none", "Same-Origin"]) {
    it(`rejects ${fetchSite ?? "missing"} Fetch Metadata`, async () => {
      assert.equal(typeof requestModule.parseTrustedAccountSecurityJson, "function")
      assert.deepEqual(
        await requestModule.parseTrustedAccountSecurityJson({
          request: trustedRequest({ fetchSite }),
          expectedSiteUrl: SITE_URL,
          allowedKeys: ALLOWED_KEYS,
        }),
        { ok: false, code: "UNTRUSTED_REQUEST" },
      )
    })
  }

  for (const contentType of [
    null,
    "text/plain",
    "application/x-www-form-urlencoded",
    "multipart/form-data; boundary=example",
    "application/json-patch+json",
  ]) {
    it(`rejects the ${contentType ?? "missing"} media type`, async () => {
      assert.equal(typeof requestModule.parseTrustedAccountSecurityJson, "function")
      assert.deepEqual(
        await requestModule.parseTrustedAccountSecurityJson({
          request: trustedRequest({ contentType }),
          expectedSiteUrl: SITE_URL,
          allowedKeys: ALLOWED_KEYS,
        }),
        { ok: false, code: "INVALID_REQUEST" },
      )
    })
  }

  for (const [label, body, allowedKeys = ALLOWED_KEYS] of [
    ["null", "null"],
    ["array", "[]"],
    ["primitive", "true"],
    ["malformed JSON", "{"],
    ["a missing key", JSON.stringify({ proofMethod: "PASSWORD" })],
    ["an unknown key", JSON.stringify({ proofMethod: "PASSWORD", confirmed: true, userId: "user-2" })],
    ["a case-variant semantic duplicate", JSON.stringify({ proofMethod: "PASSWORD", ProofMethod: "GOOGLE", confirmed: true })],
    ["a whitespace semantic duplicate", JSON.stringify({ proofMethod: "PASSWORD", "proofMethod ": "GOOGLE", confirmed: true })],
    ["a symbol-like prototype key", "{\"proofMethod\":\"PASSWORD\",\"confirmed\":true,\"__proto__\":{}}"],
    ["an invalid allowed-key declaration", JSON.stringify({ proofMethod: "PASSWORD", confirmed: true }), ["proofMethod", "proofMethod"]],
  ]) {
    it(`rejects ${label} before accepting a body`, async () => {
      assert.equal(typeof requestModule.parseTrustedAccountSecurityJson, "function")
      assert.deepEqual(
        await requestModule.parseTrustedAccountSecurityJson({
          request: trustedRequest({ body }),
          expectedSiteUrl: SITE_URL,
          allowedKeys,
        }),
        { ok: false, code: "INVALID_REQUEST" },
      )
    })
  }

  it("accepts an exact 4096-byte UTF-8 body and rejects the next byte", async () => {
    assert.equal(typeof requestModule.parseTrustedAccountSecurityJson, "function")
    const prefix = "{\"data\":\""
    const suffix = "\"}"
    const exactBody = `${prefix}${"x".repeat(4096 - Buffer.byteLength(prefix + suffix))}${suffix}`
    assert.equal(Buffer.byteLength(exactBody), 4096)

    const exact = await requestModule.parseTrustedAccountSecurityJson({
      request: trustedRequest({ body: exactBody }),
      expectedSiteUrl: SITE_URL,
      allowedKeys: ["data"],
    })
    const oversized = await requestModule.parseTrustedAccountSecurityJson({
      request: trustedRequest({ body: `${exactBody} ` }),
      expectedSiteUrl: SITE_URL,
      allowedKeys: ["data"],
    })

    assert.equal(exact.ok, true)
    assert.deepEqual(oversized, { ok: false, code: "INVALID_REQUEST" })
  })

  it("clamps a valid oversized maxBytes option to 4096 and rejects invalid limits", async () => {
    const prefix = "{\"data\":\""
    const suffix = "\"}"
    const exactBody = `${prefix}${"x".repeat(4096 - Buffer.byteLength(prefix + suffix))}${suffix}`

    const exact = await requestModule.parseBoundedAccountSecurityJson({
      request: trustedRequest({ body: exactBody }),
      maxBytes: 8192,
    })
    const oversized = await requestModule.parseBoundedAccountSecurityJson({
      request: trustedRequest({ body: `${exactBody} ` }),
      maxBytes: 8192,
    })

    assert.equal(exact.ok, true)
    assert.deepEqual(oversized, { ok: false, code: "INVALID_REQUEST" })
    for (const maxBytes of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      assert.deepEqual(
        await requestModule.parseBoundedAccountSecurityJson({
          request: trustedRequest(),
          maxBytes,
        }),
        { ok: false, code: "INVALID_REQUEST" },
        String(maxBytes),
      )
    }
  })

  it("rejects malformed UTF-8 rather than parsing a replacement character", async () => {
    assert.equal(typeof requestModule.parseTrustedAccountSecurityJson, "function")
    const request = trustedRequest({ body: new Uint8Array([0xc3, 0x28]) })

    assert.deepEqual(
      await requestModule.parseTrustedAccountSecurityJson({
        request,
        expectedSiteUrl: SITE_URL,
        allowedKeys: ALLOWED_KEYS,
      }),
      { ok: false, code: "INVALID_REQUEST" },
    )
  })

  it("rejects every invalid provenance, media, size, and shape case", async () => {
    assert.equal(typeof requestModule.parseTrustedAccountSecurityJson, "function")
    const rejectedRequests = [
      ["missing Origin", trustedRequest({ origin: null }), "UNTRUSTED_REQUEST"],
      ["missing Fetch Metadata", trustedRequest({ fetchSite: null }), "UNTRUSTED_REQUEST"],
      ["non-JSON media", trustedRequest({ contentType: "text/plain" }), "INVALID_REQUEST"],
      ["oversized body", trustedRequest({ body: `{"proofMethod":"PASSWORD","confirmed":true,"padding":"${"x".repeat(4096)}"}` }), "INVALID_REQUEST"],
      ["unknown body key", trustedRequest({ body: JSON.stringify({ proofMethod: "PASSWORD", confirmed: true, extra: true }) }), "INVALID_REQUEST"],
    ]

    for (const [label, request, code] of rejectedRequests) {
      const parsed = await requestModule.parseTrustedAccountSecurityJson({
        request,
        expectedSiteUrl: SITE_URL,
        allowedKeys: ALLOWED_KEYS,
      })
      assert.deepEqual(parsed, { ok: false, code }, label)
    }
  })

  it("returns the exact private no-store JSON headers", () => {
    assert.equal(typeof requestModule.noStoreJsonHeaders, "function")
    assert.deepEqual(requestModule.noStoreJsonHeaders(), {
      "Cache-Control": "private, no-store",
      Pragma: "no-cache",
    })
  })
})

function trustedRequest({
  body = JSON.stringify({ proofMethod: "PASSWORD", confirmed: true }),
  contentType = "application/json",
  fetchSite = "same-origin",
  origin = "https://massagelab.app",
  url = ENDPOINT_URL,
} = {}) {
  const headers = new Headers()
  if (contentType !== null) headers.set("content-type", contentType)
  if (fetchSite !== null) headers.set("sec-fetch-site", fetchSite)
  if (origin !== null) headers.set("origin", origin)
  return new Request(url, { method: "POST", headers, body })
}

function malformedUrlRequest() {
  const valid = trustedRequest()
  return {
    url: "not a URL",
    headers: valid.headers,
    body: valid.body,
  }
}
