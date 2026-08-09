import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import { decideAuthSessionVersion } from "../lib/auth-session-version.ts"

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8")

describe("JWT session-version decisions", () => {
  it("adopts the current non-negative database version on sign-in", () => {
    assert.deepEqual(decideAuthSessionVersion({ currentVersion: 4, tokenVersion: undefined, isSignIn: true }), {
      accepted: true,
      version: 4,
    })
    assert.deepEqual(decideAuthSessionVersion({ currentVersion: 4, tokenVersion: "client-value", isSignIn: true }), {
      accepted: true,
      version: 4,
    })
  })

  it("accepts exact current versions and upgrades only legacy version-zero tokens", () => {
    assert.deepEqual(decideAuthSessionVersion({ currentVersion: 2, tokenVersion: 2, isSignIn: false }), {
      accepted: true,
      version: 2,
    })
    assert.deepEqual(decideAuthSessionVersion({ currentVersion: 0, tokenVersion: undefined, isSignIn: false }), {
      accepted: true,
      version: 0,
    })
  })

  it("rejects legacy, stale, newer, malformed, negative, and fractional versions", () => {
    for (const [label, currentVersion, tokenVersion] of [
      ["legacy after increment", 1, undefined],
      ["stale", 3, 2],
      ["newer", 2, 3],
      ["null", 0, null],
      ["string", 0, "0"],
      ["negative", 0, -1],
      ["fractional", 0, 0.5],
      ["unsafe integer", 0, Number.MAX_SAFE_INTEGER + 1],
    ]) {
      assert.deepEqual(
        decideAuthSessionVersion({ currentVersion, tokenVersion, isSignIn: false }),
        { accepted: false },
        label,
      )
    }
  })

  it("fails closed when the database version is not a non-negative safe integer", () => {
    for (const currentVersion of [undefined, null, "0", -1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
      assert.deepEqual(
        decideAuthSessionVersion({ currentVersion, tokenVersion: 0, isSignIn: true }),
        { accepted: false },
      )
    }
  })
})

describe("JWT session-version integration contract", () => {
  it("declares the additive schema, migration, and server-only JWT field", async () => {
    const [schema, migration, authTypes] = await Promise.all([
      read("prisma/schema.prisma"),
      read("prisma/migrations/20260808093000_admin_jwt_session_version/migration.sql"),
      read("types/next-auth.d.ts"),
    ])

    assert.match(schema, /authSessionVersion\s+Int\s+@default\(0\)/)
    assert.match(migration, /ALTER TABLE "User"[\s\S]*ADD COLUMN "authSessionVersion" INTEGER NOT NULL DEFAULT 0;/)
    assert.match(authTypes, /interface JWT \{[\s\S]*authSessionVersion\?: number/)
    const sessionDeclaration = authTypes.match(/interface Session \{[\s\S]*?^  \}/m)?.[0] ?? ""
    assert.doesNotMatch(sessionDeclaration, /authSessionVersion/)
  })

  it("loads the database version and rejects stale JWTs before refreshing privileges", async () => {
    const [authSource, authUsersSource] = await Promise.all([
      read("auth.ts"),
      read("lib/auth-users.ts"),
    ])
    const stateLoad = authSource.indexOf("const state = await getUserAuthState(userId)")
    const decision = authSource.indexOf("const versionDecision = decideAuthSessionVersion")
    const rejection = authSource.indexOf("if (!versionDecision.accepted) return null")
    const versionWrite = authSource.indexOf("token.authSessionVersion = versionDecision.version")
    const privilegeWrite = authSource.indexOf("token.role = state.role")

    assert.ok(stateLoad >= 0)
    assert.ok(stateLoad < decision)
    assert.ok(decision < rejection)
    assert.ok(rejection < versionWrite)
    assert.ok(versionWrite < privilegeWrite)
    assert.match(authUsersSource, /select:\s*\{[\s\S]*authSessionVersion: true/)
    assert.match(authUsersSource, /return \{\s*authSessionVersion: user\?\.authSessionVersion,/)
    assert.doesNotMatch(authUsersSource, /authSessionVersion: user\?\.authSessionVersion\s*\?\?\s*0/)
    assert.doesNotMatch(authSource, /token\.authSessionVersion\s*=\s*(?:user|account)\./)
  })
})
