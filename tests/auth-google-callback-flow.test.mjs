import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

describe("Google callback safety seam", () => {
  it("runs Auth.js signIn callback before adapter login/register handling", async () => {
    const callbackSource = await readFile(
      new URL("../node_modules/@auth/core/lib/actions/callback/index.js", import.meta.url),
      "utf8",
    )
    const oauthBranch = callbackSource.indexOf('provider.type === "oauth"')
    const authorizedCall = callbackSource.indexOf("const redirect = await handleAuthorized({", oauthBranch)
    const adapterCall = callbackSource.indexOf("await handleLoginOrRegister(", authorizedCall)
    const authorizedFunction = callbackSource.indexOf("async function handleAuthorized")
    const signInCall = callbackSource.indexOf("authorized = await signIn(params)", authorizedFunction)
    assert.ok(oauthBranch >= 0)
    assert.ok(authorizedCall > oauthBranch)
    assert.ok(adapterCall > authorizedCall)
    assert.ok(signInCall > authorizedFunction)
  })
})
