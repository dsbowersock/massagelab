import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const [actionsSource, messagesSource, loginSource, registerSource] = await Promise.all([
  readFile(new URL("../lib/auth-entry-actions.ts", import.meta.url), "utf8").catch(() => ""),
  readFile(new URL("../lib/auth-entry-messages.ts", import.meta.url), "utf8").catch(() => ""),
  readFile(new URL("../app/login/login-form.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/register/register-form.tsx", import.meta.url), "utf8"),
])

describe("shared account-entry client behavior", () => {
  it("owns one synchronous lock for email and Google entry actions", () => {
    assert.match(actionsSource, /export function useEntryAction/)
    const updates = []
    const lock = { current: false }
    const { useEntryAction } = loadActions({
      useRef: () => lock,
      useState: () => ["idle", (value) => updates.push(value)],
    })
    const entry = useEntryAction()

    assert.equal(entry.beginEntryAction("google"), true)
    assert.equal(entry.beginEntryAction("email"), false)
    entry.finishEntryAction()
    assert.equal(entry.beginEntryAction("email"), true)
    assert.deepEqual(updates, ["google", "idle", "email"])
  })

  it("returns an explicit navigating outcome only after Google sign-in starts", async () => {
    assert.match(actionsSource, /export async function startGoogleAuthMethodIntent/)
    const calls = []
    let href = "/register"
    const { startGoogleAuthMethodIntent } = loadActions()
    const result = await startGoogleAuthMethodIntent("/onboarding", {
      fetchImpl: async (url, init) => {
        calls.push(["fetch", url, JSON.parse(init.body)])
        return Response.json({ ok: true, callbackUrl: "/legal/accept?callbackUrl=%2Fonboarding" })
      },
      signInImpl: async (...args) => {
        calls.push(["signIn", ...args])
        href = "https://accounts.google.com/o/oauth2/v2/auth"
      },
      currentHref: () => href,
    })

    assert.equal(result, "navigating")
    assert.deepEqual(calls, [
      ["fetch", "/api/auth/google/intent", { purpose: "SIGN_IN_OR_LINK", callbackUrl: "/onboarding" }],
      ["signIn", "google", { redirectTo: "/legal/accept?callbackUrl=%2Fonboarding" }],
    ])
  })

  it("rejects a resolved sign-in without navigation so shared entry state is released", async () => {
    assert.match(actionsSource, /export async function startGoogleAuthMethodIntent/)
    const calls = []
    const updates = []
    const lock = { current: false }
    const { startGoogleAuthMethodIntent, useEntryAction } = loadActions({
      useRef: () => lock,
      useState: () => ["idle", (value) => updates.push(value)],
    })
    const entry = useEntryAction()
    let navigating = false

    assert.equal(entry.beginEntryAction("google"), true)
    try {
      await assert.rejects(
        async () => {
          navigating = await startGoogleAuthMethodIntent("/onboarding", {
            fetchImpl: async () => Response.json({ ok: true, callbackUrl: "/legal/accept?callbackUrl=%2Fonboarding" }),
            signInImpl: async (...args) => calls.push(args),
            currentHref: () => "/register",
          }) === "navigating"
        },
        /Google navigation did not start/,
      )
    } finally {
      if (!navigating) entry.finishEntryAction()
    }

    assert.equal(entry.beginEntryAction("email"), true)
    assert.deepEqual(updates, ["google", "idle", "email"])
    assert.deepEqual(calls, [["google", { redirectTo: "/legal/accept?callbackUrl=%2Fonboarding" }]])
  })

  it("rejects failed intent starts before Google sign-in", async () => {
    assert.match(actionsSource, /export async function startGoogleAuthMethodIntent/)
    const calls = []
    const { startGoogleAuthMethodIntent } = loadActions()
    await assert.rejects(
      startGoogleAuthMethodIntent("/onboarding", {
        fetchImpl: async () => Response.json({ ok: false }, { status: 503 }),
        signInImpl: async (...args) => calls.push(args),
      }),
      /Google intent unavailable/,
    )
    assert.deepEqual(calls, [])
  })

  it("keeps client-safe entry ownership out of server registration services", () => {
    assert.match(messagesSource, /export const PUBLIC_ACCOUNT_ENTRY_MESSAGE/)
    for (const source of [loginSource, registerSource]) {
      assert.match(source, /useEntryAction/)
      assert.match(source, /startGoogleAuthMethodIntent/)
      assert.match(source, /let navigating = false/)
      assert.match(source, /navigating = await startGoogleAuthMethodIntent/)
      assert.match(source, /if \(!navigating\) finishEntryAction\(\)/)
      assert.doesNotMatch(source, /entryActionLock|useRef/)
    }
    assert.match(registerSource, /@\/lib\/auth-entry-messages/)
    assert.doesNotMatch(registerSource, /@\/lib\/auth-registration-service/)
  })
})

function loadActions(react = { useRef: () => ({ current: false }), useState: (value) => [value, () => {}] }) {
  return loadCompiledModule(actionsSource, "auth-entry-actions.test.ts", {
    react,
    "next-auth/react": { signIn: async () => undefined },
  })
}
