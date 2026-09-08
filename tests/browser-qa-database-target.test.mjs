import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

import * as targetGuard from "../scripts/assert-browser-qa-database-target.mjs"
import { createBrowserIdentityMethodFixtureIdentity } from "../lib/auth/browser-fixture-identity.ts"
import { removeBrowserIdentityMethodFixtureRecords } from "../lib/auth/browser-fixture-records.ts"
import {
  createBrowserUserFixtureIdentity,
  createBrowserUserFixtureRecord,
  removeBrowserUserFixtureRecord,
} from "../lib/auth/browser-user-fixture.ts"
import { decideAuthSessionVersion } from "../lib/auth-session-version.ts"
import { signedInSessionToken } from "./browser/signed-in-session-cookie.ts"

const {
  assertBrowserQaDatabaseTarget,
  fingerprintBrowserQaDatabaseTarget,
  parseBrowserQaDatabaseTuple,
  runBrowserQaDatabaseTargetCli,
} = targetGuard

const fixtureRecordsSource = await readFile(new URL("../lib/auth/browser-fixture-records.ts", import.meta.url), "utf8")
const browserSpecSource = await readFile(new URL("./browser/identity-method-safety.spec.ts", import.meta.url), "utf8")

const runtimeUrl = "postgresql://browser_user:runtime-secret@qa-runtime.example.test:5432/massagelab_identity_qa?sslmode=require"
const directUrl = "postgresql://browser_owner:direct-secret@qa-direct.example.test:5433/massagelab_identity_qa?sslmode=require"

function authorizedEnvironment(overrides = {}) {
  return {
    MASSAGELAB_BROWSER_QA_DATABASE: "1",
    MASSAGELAB_BROWSER_QA_DATABASE_URL: runtimeUrl,
    MASSAGELAB_BROWSER_QA_DIRECT_URL: directUrl,
    VERCEL_ENV: "preview",
    ...overrides,
  }
}

function completeAuthorizedEnvironment(overrides = {}) {
  return {
    ...authorizedEnvironment(),
    DATABASE_URL: runtimeUrl,
    DIRECT_URL: directUrl,
    MASSAGELAB_BROWSER_QA_DATABASE_FINGERPRINT: fingerprintBrowserQaDatabaseTarget(runtimeUrl, directUrl),
    ...overrides,
  }
}

describe("disposable browser-QA database target guard", () => {
  it("parses only the non-secret role, host, port, and database tuple", () => {
    assert.deepEqual(parseBrowserQaDatabaseTuple(runtimeUrl), {
      username: "browser_user",
      host: "qa-runtime.example.test",
      port: "5432",
      database: "massagelab_identity_qa",
    })
    assert.throws(() => parseBrowserQaDatabaseTuple("not-a-url"), /valid PostgreSQL URL/i)
    assert.throws(() => parseBrowserQaDatabaseTuple("https://qa.example.test/db"), /PostgreSQL/i)
  })

  it("project-qualifies only example.test fixture identities", () => {
    const desktop = createBrowserIdentityMethodFixtureIdentity("desktop-chromium", "MATCHING_LINK")
    const mobile = createBrowserIdentityMethodFixtureIdentity("mobile-chromium", "MATCHING_LINK")
    assert.notEqual(desktop.user.id, mobile.user.id)
    assert.notEqual(desktop.user.email, mobile.user.email)
    assert.equal(desktop.user.email.endsWith(".example.test"), true)
    assert.throws(() => createBrowserIdentityMethodFixtureIdentity("unsafe project", "MATCHING_LINK"), /safe Playwright project/i)
  })

  it("project-and-owner qualifies generic signed-in users and carries the persisted JWT version", () => {
    const first = createBrowserUserFixtureIdentity("desktop-chromium", "public-routes-owner-a")
    const second = createBrowserUserFixtureIdentity("desktop-chromium", "public-routes-owner-b")
    const mobile = createBrowserUserFixtureIdentity("mobile-chromium", "public-routes-owner-a")
    assert.notEqual(first.user.id, second.user.id)
    assert.notEqual(first.user.id, mobile.user.id)
    assert.equal(first.user.email.endsWith(".example.test"), true)
    assert.equal(signedInSessionToken(first.user).authSessionVersion, 0)
    assert.deepEqual(decideAuthSessionVersion({ currentVersion: 0, tokenVersion: 0, isSignIn: false }), {
      accepted: true,
      version: 0,
    })
    assert.deepEqual(decideAuthSessionVersion({ currentVersion: 1, tokenVersion: 0, isSignIn: false }), {
      accepted: false,
    })
    assert.deepEqual(decideAuthSessionVersion({ currentVersion: undefined, tokenVersion: 0, isSignIn: false }), {
      accepted: false,
    })
    assert.throws(() => createBrowserUserFixtureIdentity("unsafe project", "owner"), /safe project and owner/i)
    assert.throws(() => signedInSessionToken({ ...first.user, authSessionVersion: -1 }), /nonnegative integer/i)
  })

  it("keeps hyphenated project and owner pairs distinct through exact cleanup", async () => {
    const first = createBrowserUserFixtureIdentity("desktop-chromium", "a-b")
    const second = createBrowserUserFixtureIdentity("desktop-chromium-a", "b")
    assert.notEqual(first.user.id, second.user.id)
    assert.notEqual(first.user.email, second.user.email)

    const rows = new Map()
    const prismaClient = {
      user: {
        async create({ data }) {
          assert.equal(rows.has(data.id), false)
          rows.set(data.id, data)
          return data
        },
        async deleteMany({ where }) {
          const row = rows.get(where.id)
          if (row?.email !== where.email) return { count: 0 }
          rows.delete(where.id)
          return { count: 1 }
        },
        async findUnique({ where }) {
          return rows.get(where.id) ?? null
        },
      },
    }

    await createBrowserUserFixtureRecord({
      prismaClient,
      identity: first,
      environment: completeAuthorizedEnvironment(),
    })
    await createBrowserUserFixtureRecord({
      prismaClient,
      identity: second,
      environment: completeAuthorizedEnvironment(),
    })
    await removeBrowserUserFixtureRecord({
      prismaClient,
      identity: first,
      environment: completeAuthorizedEnvironment(),
    })

    assert.equal(rows.has(first.user.id), false)
    assert.equal(rows.get(second.user.id)?.email, second.user.email)
  })

  it("generic signed-in fixture refuses unauthorized mutation and creates an explicit version", async () => {
    const identity = createBrowserUserFixtureIdentity("desktop-chromium", "music-visualizer-defaults")
    let creates = 0
    await assert.rejects(
      createBrowserUserFixtureRecord({
        prismaClient: {
          user: { async create() { creates += 1 } },
        },
        identity,
        environment: {},
      }),
      /approved disposable browser-QA database target/i,
    )
    assert.equal(creates, 0)

    let createQuery
    const created = await createBrowserUserFixtureRecord({
      prismaClient: {
        user: {
          async create(query) {
            createQuery = query
            return { ...query.data }
          },
        },
      },
      identity,
      environment: completeAuthorizedEnvironment(),
    })
    assert.equal(createQuery.data.authSessionVersion, 0)
    assert.equal(createQuery.data.id, identity.user.id)
    assert.equal(createQuery.data.email, identity.user.email)
    assert.equal(created.authSessionVersion, 0)
  })

  it("generic signed-in cleanup verifies ownership and deletes only the exact id/email pair", async () => {
    const identity = createBrowserUserFixtureIdentity("mobile-chromium", "background-commerce")
    const calls = []
    await removeBrowserUserFixtureRecord({
      prismaClient: {
        user: {
          async deleteMany(query) {
            calls.push(["deleteMany", query])
            return { count: 1 }
          },
          async findUnique() {
            throw new Error("successful cleanup must not need a follow-up read")
          },
        },
      },
      identity,
      environment: completeAuthorizedEnvironment(),
    })
    assert.deepEqual(calls, [
      ["deleteMany", { where: { id: identity.user.id, email: identity.user.email } }],
    ])
  })

  it("keeps an already-absent generic signed-in fixture cleanup idempotent", async () => {
    const identity = createBrowserUserFixtureIdentity("mobile-chromium", "background-commerce")
    const calls = []
    await removeBrowserUserFixtureRecord({
      prismaClient: {
        user: {
          async deleteMany(query) {
            calls.push(["deleteMany", query])
            return { count: 0 }
          },
          async findUnique(query) {
            calls.push(["findUnique", query])
            return null
          },
        },
      },
      identity,
      environment: completeAuthorizedEnvironment(),
    })
    assert.deepEqual(calls, [
      ["deleteMany", { where: { id: identity.user.id, email: identity.user.email } }],
      ["findUnique", { where: { id: identity.user.id }, select: { email: true } }],
    ])
  })

  it("fails closed when zero-count generic cleanup finds a different owner", async () => {
    const identity = createBrowserUserFixtureIdentity("mobile-chromium", "background-commerce")
    await assert.rejects(removeBrowserUserFixtureRecord({
      prismaClient: {
        user: {
          async deleteMany() { return { count: 0 } },
          async findUnique() { return { email: "different@browser-user.massagelab.example.test" } },
        },
      },
      identity,
      environment: completeAuthorizedEnvironment(),
    }), { message: "Browser user fixture ownership mismatch." })
  })

  it("fails exactly when zero-count generic cleanup leaves the owned row present", async () => {
    const identity = createBrowserUserFixtureIdentity("mobile-chromium", "background-commerce")
    await assert.rejects(removeBrowserUserFixtureRecord({
      prismaClient: {
        user: {
          async deleteMany() { return { count: 0 } },
          async findUnique() { return { email: identity.user.email } },
        },
      },
      identity,
      environment: completeAuthorizedEnvironment(),
    }), { message: "Browser user fixture cleanup did not remove exactly one owned user." })
  })

  it("guards fixture creation and exact cleanup before any database call", () => {
    const authorizationCalls = fixtureRecordsSource.match(/requireBrowserIdentityMethodFixtureAuthorization\(/g) ?? []
    assert.ok(authorizationCalls.length >= 3)
    assert.match(fixtureRecordsSource, /DATABASE_URL[\s\S]*verified dedicated QA runtime target/)
    assert.match(fixtureRecordsSource, /DIRECT_URL[\s\S]*verified dedicated QA direct target/)
    assert.match(fixtureRecordsSource, /\.example\.test/)
    assert.match(fixtureRecordsSource, /user\.deleteMany\(\{[\s\S]*id:\s*input\.identity\.user\.id[\s\S]*email:\s*input\.identity\.user\.email/)
    assert.match(fixtureRecordsSource, /commerceEvent\.deleteMany\(\{\s*where:\s*\{\s*userId:\s*input\.identity\.user\.id/)
    assert.match(fixtureRecordsSource, /backgroundCreditEntry\.deleteMany\(\{\s*where:\s*\{\s*userId:\s*input\.identity\.user\.id/)
    assert.match(fixtureRecordsSource, /backgroundCreditWallet\.deleteMany\(\{\s*where:\s*\{\s*userId:\s*input\.identity\.user\.id/)
    assert.doesNotMatch(fixtureRecordsSource, /deleteMany\(\s*(?:\)|\{\s*\}\s*\))/)
    assert.match(browserSpecSource, /missing explicit disposable-database opt-in\/authorization/)
  })

  it("hashes both parsed tuples without depending on passwords or approved transport parameters", () => {
    const expected = fingerprintBrowserQaDatabaseTarget(runtimeUrl, directUrl)
    assert.match(expected, /^[a-f0-9]{64}$/)
    assert.equal(
      fingerprintBrowserQaDatabaseTarget(
        runtimeUrl.replace("runtime-secret", "different").replace("sslmode=require", "sslmode=disable"),
        directUrl.replace("direct-secret", "different").replace("sslmode=require", "sslmode=disable"),
      ),
      expected,
    )
    assert.notEqual(
      fingerprintBrowserQaDatabaseTarget(
        runtimeUrl.replace("browser_user", "different_role"),
        directUrl,
      ),
      expected,
    )
  })

  it("rejects duplicate, unknown, and target-altering connection parameters", () => {
    for (const suffix of [
      "&sslmode=verify-full",
      "&application_name=browser-qa",
      "&schema=private",
      "&options=-csearch_path%3Dprivate",
      "&search_path=private",
    ]) {
      assert.throws(
        () => fingerprintBrowserQaDatabaseTarget(`${runtimeUrl}${suffix}`, directUrl),
        /parameter|duplicate|allowed/i,
      )
    }
  })

  it("rejects an invalid target before fixture cleanup opens a transaction", async () => {
    const identity = createBrowserIdentityMethodFixtureIdentity("desktop-chromium", "GOOGLE_ONLY")
    let transactions = 0
    const invalidRuntimeUrl = `${runtimeUrl}&schema=private`
    await assert.rejects(
      removeBrowserIdentityMethodFixtureRecords({
        prismaClient: {
          async $transaction() {
            transactions += 1
            throw new Error("must not open a transaction")
          },
        },
        identity,
        environment: completeAuthorizedEnvironment({
          MASSAGELAB_BROWSER_QA_DATABASE_URL: invalidRuntimeUrl,
          DATABASE_URL: invalidRuntimeUrl,
          MASSAGELAB_BROWSER_QA_DATABASE_FINGERPRINT: fingerprintBrowserQaDatabaseTarget(runtimeUrl, directUrl),
        }),
      }),
      /target-altering.*parameter/i,
    )
    assert.equal(transactions, 0)
  })

  it("requires explicit opt-in, both dedicated variables, and a non-Production environment", () => {
    for (const [environment, pattern] of [
      [authorizedEnvironment({ MASSAGELAB_BROWSER_QA_DATABASE: undefined }), /MASSAGELAB_BROWSER_QA_DATABASE=1/],
      [authorizedEnvironment({ MASSAGELAB_BROWSER_QA_DATABASE_URL: undefined }), /MASSAGELAB_BROWSER_QA_DATABASE_URL/],
      [authorizedEnvironment({ MASSAGELAB_BROWSER_QA_DIRECT_URL: undefined }), /MASSAGELAB_BROWSER_QA_DIRECT_URL/],
      [authorizedEnvironment({ VERCEL_ENV: undefined }), /VERCEL_ENV/],
      [authorizedEnvironment({ VERCEL_ENV: "test" }), /VERCEL_ENV/],
      [authorizedEnvironment({ VERCEL_ENV: "production" }), /Production/],
      [authorizedEnvironment({ VERCEL_ENV: "PrOdUcTiOn" }), /Production/],
    ]) {
      assert.throws(() => assertBrowserQaDatabaseTarget({ environment, mode: "print" }), pattern)
    }
  })

  it("verifies deterministic user ownership before fixture cleanup mutates child rows", async () => {
    const identity = createBrowserIdentityMethodFixtureIdentity("desktop-chromium", "MATCHING_LINK")
    let transactions = 0
    let mutations = 0
    const mismatchedClient = {
      async $transaction(callback) {
        transactions += 1
        return callback({
          user: {
            async findUnique() {
              return { email: "someone-else.browser.example.test" }
            },
            async deleteMany() {
              mutations += 1
              return { count: 1 }
            },
          },
          commerceEvent: { async deleteMany() { mutations += 1; return { count: 0 } } },
          backgroundCreditEntry: { async deleteMany() { mutations += 1; return { count: 0 } } },
          backgroundCreditWallet: { async deleteMany() { mutations += 1; return { count: 0 } } },
        })
      },
    }

    await assert.rejects(
      removeBrowserIdentityMethodFixtureRecords({
        prismaClient: mismatchedClient,
        identity,
        environment: completeAuthorizedEnvironment(),
      }),
      /fixture.*email|ownership|mismatch/i,
    )
    assert.equal(transactions, 1)
    assert.equal(mutations, 0)
  })

  it("keeps missing fixture cleanup idempotent and bounds matching cleanup", async () => {
    const identity = createBrowserIdentityMethodFixtureIdentity("mobile-chromium", "BOTH_METHODS")
    const run = async (existingEmail) => {
      const calls = []
      await removeBrowserIdentityMethodFixtureRecords({
        prismaClient: {
          async $transaction(callback) {
            return callback({
              user: {
                async findUnique(query) {
                  calls.push(["user.findUnique", query])
                  return existingEmail === null ? null : { email: existingEmail }
                },
                async deleteMany(query) {
                  calls.push(["user.deleteMany", query])
                  return { count: 1 }
                },
              },
              commerceEvent: { async deleteMany(query) { calls.push(["commerceEvent.deleteMany", query]); return { count: 0 } } },
              backgroundCreditEntry: { async deleteMany(query) { calls.push(["backgroundCreditEntry.deleteMany", query]); return { count: 0 } } },
              backgroundCreditWallet: { async deleteMany(query) { calls.push(["backgroundCreditWallet.deleteMany", query]); return { count: 0 } } },
            })
          },
        },
        identity,
        environment: completeAuthorizedEnvironment(),
      })
      return calls
    }

    assert.deepEqual(await run(null), [[
      "user.findUnique",
      { where: { id: identity.user.id }, select: { email: true } },
    ]])
    assert.deepEqual((await run(identity.user.email)).map(([name]) => name), [
      "user.findUnique",
      "commerceEvent.deleteMany",
      "backgroundCreditEntry.deleteMany",
      "backgroundCreditWallet.deleteMany",
      "user.deleteMany",
    ])
  })

  it("hard-skips private rows unless the entire approved target environment matches", () => {
    assert.equal(typeof targetGuard.isBrowserQaDatabaseTargetAuthorized, "function")
    const isAuthorized = targetGuard.isBrowserQaDatabaseTargetAuthorized
    assert.equal(isAuthorized(completeAuthorizedEnvironment()), true)
    for (const environment of [
      completeAuthorizedEnvironment({ MASSAGELAB_BROWSER_QA_DATABASE: undefined }),
      completeAuthorizedEnvironment({ MASSAGELAB_BROWSER_QA_DATABASE_URL: undefined }),
      completeAuthorizedEnvironment({ MASSAGELAB_BROWSER_QA_DIRECT_URL: undefined }),
      completeAuthorizedEnvironment({ DATABASE_URL: undefined }),
      completeAuthorizedEnvironment({ DATABASE_URL: `${runtimeUrl}-other` }),
      completeAuthorizedEnvironment({ DATABASE_URL: `${runtimeUrl} ` }),
      completeAuthorizedEnvironment({ DIRECT_URL: undefined }),
      completeAuthorizedEnvironment({ DIRECT_URL: `${directUrl}-other` }),
      completeAuthorizedEnvironment({
        MASSAGELAB_BROWSER_QA_DATABASE_URL: `${runtimeUrl} `,
        DATABASE_URL: `${runtimeUrl} `,
      }),
      completeAuthorizedEnvironment({ VERCEL_ENV: "production" }),
      completeAuthorizedEnvironment({ MASSAGELAB_BROWSER_QA_DATABASE_FINGERPRINT: undefined }),
      completeAuthorizedEnvironment({ MASSAGELAB_BROWSER_QA_DATABASE_FINGERPRINT: "0".repeat(64) }),
      completeAuthorizedEnvironment({ MASSAGELAB_BROWSER_QA_DATABASE_FINGERPRINT: "A".repeat(64) }),
      completeAuthorizedEnvironment({
        MASSAGELAB_BROWSER_QA_DATABASE_FINGERPRINT: `${fingerprintBrowserQaDatabaseTarget(runtimeUrl, directUrl)} `,
      }),
    ]) {
      assert.equal(isAuthorized(environment), false)
    }
    assert.match(browserSpecSource, /isBrowserQaDatabaseTargetAuthorized\(process\.env\)/)
  })

  it("permits only fingerprint display or an exact lowercase approved fingerprint", () => {
    const environment = authorizedEnvironment()
    const fingerprint = fingerprintBrowserQaDatabaseTarget(runtimeUrl, directUrl)
    assert.deepEqual(assertBrowserQaDatabaseTarget({ environment, mode: "print" }), { fingerprint })
    assert.deepEqual(assertBrowserQaDatabaseTarget({ environment, mode: "expected", expectedFingerprint: fingerprint }), { fingerprint })
    assert.throws(
      () => assertBrowserQaDatabaseTarget({ environment, mode: "expected", expectedFingerprint: fingerprint.toUpperCase() }),
      /64 lowercase hexadecimal/i,
    )
    assert.throws(
      () => assertBrowserQaDatabaseTarget({ environment, mode: "expected", expectedFingerprint: "0".repeat(64) }),
      /does not match/i,
    )
  })

  it("CLI prints only a fingerprint and never either URL", () => {
    const lines = []
    const result = runBrowserQaDatabaseTargetCli({
      argv: ["--print-fingerprint"],
      environment: authorizedEnvironment(),
      log: (line) => lines.push(String(line)),
    })
    assert.equal(result.exitCode, 0)
    assert.equal(lines.length, 1)
    assert.match(lines[0], /^[a-f0-9]{64}$/)
    const output = lines.join("\n")
    assert.equal(output.includes(runtimeUrl), false)
    assert.equal(output.includes(directUrl), false)
    assert.equal(output.includes("runtime-secret"), false)
    assert.equal(output.includes("direct-secret"), false)
  })

  it("rejects missing, mixed, or unknown CLI modes without printing target material", () => {
    const fingerprint = fingerprintBrowserQaDatabaseTarget(runtimeUrl, directUrl)
    for (const argv of [
      [],
      ["--print-fingerprint", `--expected-fingerprint=${fingerprint}`],
      ["--unknown"],
    ]) {
      const lines = []
      const errors = []
      const result = runBrowserQaDatabaseTargetCli({
        argv,
        environment: authorizedEnvironment(),
        log: (line) => lines.push(String(line)),
        error: (line) => errors.push(String(line)),
      })
      assert.equal(result.exitCode, 1)
      assert.equal(lines.length, 0)
      assert.equal(errors.join("\n").includes(runtimeUrl), false)
      assert.equal(errors.join("\n").includes(directUrl), false)
    }
  })
})
