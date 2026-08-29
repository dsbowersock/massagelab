import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)

describe("account action outcome mapping", () => {
  it("returns only the allowlisted success path after operational success", async () => {
    const source = await readFile(new URL("../lib/account-action-outcome.ts", import.meta.url), "utf8")
    const { settleAccountAction } = loadCompiledModule(source, "lib/account-action-outcome.test.ts")
    let ran = false
    const result = await settleAccountAction({
      run: async () => { ran = true },
      successPath: "/account?tab=profile&profile=saved",
      failurePath: "/account?tab=profile&profile=save-failed",
    })
    assert.equal(ran, true)
    assert.equal(result, "/account?tab=profile&profile=saved")
  })

  it("maps a thrown operational failure without leaking its message", async () => {
    const source = await readFile(new URL("../lib/account-action-outcome.ts", import.meta.url), "utf8")
    const { settleAccountAction } = loadCompiledModule(source, "lib/account-action-outcome.test.ts")
    const secretMessage = "provider ORM credential value must stay private"
    const result = await settleAccountAction({
      run: async () => { throw new Error(secretMessage) },
      successPath: "/account?tab=credentials&credential=submitted",
      failurePath: "/account?tab=credentials&credential=submit-failed",
    })
    assert.equal(result, "/account?tab=credentials&credential=submit-failed")
    assert.equal(result.includes(secretMessage), false)
  })

  it("keeps final redirects outside operational settlement in account actions", async () => {
    const actions = await readFile(new URL("../app/account/actions.ts", import.meta.url), "utf8")
    assert.match(actions, /settleAccountAction\(\{[\s\S]*successPath: "\/account\?tab=profile&profile=saved"[\s\S]*failurePath: "\/account\?tab=profile&profile=save-failed"/)
    assert.match(actions, /settleAccountAction\(\{[\s\S]*successPath: "\/account\?tab=credentials&credential=submitted"[\s\S]*failurePath: "\/account\?tab=credentials&credential=submit-failed"/)
    assert.match(actions, /const destination = await settleAccountAction\([\s\S]*\)\s*redirect\(destination\)/)
    assert.equal((actions.match(/\}\)\s*\n\s*redirect\(destination\)/g) ?? []).length, 2)
  })
})
