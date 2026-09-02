import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const source = await readFile(new URL("../lib/auth-request.ts", import.meta.url), "utf8").catch(() => "")
const consumerPaths = [
  "../auth.ts",
  "../app/api/auth/google/intent/route.ts",
  "../app/api/account/email-verification/request/route.ts",
  "../app/api/account/password-reset/request/route.ts",
  "../app/api/account/register/route.ts",
  "../app/api/account/security/google/unlink/route.ts",
  "../app/api/account/security/password/route.ts",
]
const consumerSources = await Promise.all(consumerPaths.map((path) => readFile(new URL(path, import.meta.url), "utf8")))

describe("shared authentication request boundaries", () => {
  it("uses Vercel's trusted address before forwarded fallbacks and one unknown bucket", () => {
    assert.match(source, /export function authRequestNetworkIdentifier/)
    const { authRequestNetworkIdentifier } = loadCompiledModule(source, "auth-request.test.ts")

    assert.equal(authRequestNetworkIdentifier(request({
      "x-vercel-forwarded-for": "198.51.100.7",
      "x-forwarded-for": "203.0.113.9, 10.0.0.4",
      "x-real-ip": "192.0.2.5",
    })), "198.51.100.7")
    assert.equal(authRequestNetworkIdentifier(request({
      "x-vercel-forwarded-for": "",
      "x-forwarded-for": "203.0.113.9, 10.0.0.4",
    })), "203.0.113.9")
    assert.equal(authRequestNetworkIdentifier(request({
      "x-forwarded-for": "",
      "x-real-ip": " 192.0.2.5 ",
    })), "192.0.2.5")
    assert.equal(authRequestNetworkIdentifier(request({})), "unknown")
  })

  it("accepts only normalized public account emails within the shared bound", () => {
    assert.match(source, /export function isPublicAccountEmail/)
    const { isPublicAccountEmail } = loadCompiledModule(source, "auth-request-email.test.ts")
    const suffix = "@example.com"
    const longest = `${"a".repeat(254 - suffix.length)}${suffix}`
    const tooLong = `${"a".repeat(255 - suffix.length)}${suffix}`

    assert.equal(isPublicAccountEmail("person@example.com"), true)
    assert.equal(isPublicAccountEmail(longest), true)
    assert.equal(isPublicAccountEmail(tooLong), false)
    assert.equal(isPublicAccountEmail(" PERSON@example.com "), false)
    assert.equal(isPublicAccountEmail("person@example"), false)
  })

  it("wires every authentication rate-limit consumer to the shared owner", () => {
    for (const [index, consumerSource] of consumerSources.entries()) {
      assert.match(consumerSource, /authRequestNetworkIdentifier\(request\)/, consumerPaths[index])
      assert.doesNotMatch(consumerSource, /function requestIp/, consumerPaths[index])
    }
    const emailValidationPaths = [
      "../app/api/account/email-verification/request/route.ts",
      "../app/api/account/password-reset/request/route.ts",
      "../app/api/account/register/route.ts",
    ]
    for (const consumerPath of emailValidationPaths) {
      const index = consumerPaths.indexOf(consumerPath)
      assert.notEqual(index, -1, `${consumerPath} must remain a registered auth consumer`)
      assert.match(consumerSources[index], /isPublicAccountEmail\(email\)/, consumerPath)
      assert.doesNotMatch(consumerSources[index], /function validPublicEmail/, consumerPath)
    }
  })
})

function request(headers) {
  return new Request("https://massagelab.app/login", { headers })
}
