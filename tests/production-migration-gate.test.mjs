import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"

import {
  requireDirectProductionMigrationUrl,
  runProductionMigrationGate,
  shouldCheckProductionMigrations,
} from "../scripts/assert-production-migrations-current.mjs"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")

describe("Production migration deployment gate", () => {
  it("skips every environment except Vercel Production", () => {
    assert.equal(shouldCheckProductionMigrations({}), false)
    assert.equal(shouldCheckProductionMigrations({ VERCEL_ENV: "preview" }), false)
    assert.equal(shouldCheckProductionMigrations({ VERCEL_ENV: "development" }), false)
    assert.equal(shouldCheckProductionMigrations({ VERCEL_ENV: "production" }), true)
  })

  it("requires a direct maintenance URL in Production", () => {
    assert.throws(
      () => requireDirectProductionMigrationUrl({ DATABASE_URL: "postgresql://pooled.example/database" }),
      /DIRECT_URL|DATABASE_URL_UNPOOLED/,
    )
    assert.equal(
      requireDirectProductionMigrationUrl({ DIRECT_URL: " postgresql://direct.example/database " }),
      "postgresql://direct.example/database",
    )
    assert.equal(
      requireDirectProductionMigrationUrl({ DATABASE_URL_UNPOOLED: "postgresql://unpooled.example/database" }),
      "postgresql://unpooled.example/database",
    )
  })

  it("does not spawn Prisma outside Production", () => {
    let spawnCount = 0
    const messages = []
    const result = runProductionMigrationGate({
      env: { VERCEL_ENV: "preview" },
      spawnSyncImpl: () => {
        spawnCount += 1
        return { status: 0 }
      },
      log: (message) => messages.push(message),
    })

    assert.deepEqual(result, { checked: false })
    assert.equal(spawnCount, 0)
    assert.match(messages.join("\n"), /skipped/i)
  })

  it("passes only after Prisma confirms migration status", () => {
    const env = {
      VERCEL_ENV: "production",
      DIRECT_URL: "postgresql://direct.example/database",
    }
    let invocation
    const result = runProductionMigrationGate({
      env,
      spawnSyncImpl: (command, args, options) => {
        invocation = { command, args, options }
        return { status: 0 }
      },
      log: () => {},
    })

    assert.deepEqual(result, { checked: true })
    assert.equal(invocation.command, process.execPath)
    assert.deepEqual(invocation.args.slice(-2), ["migrate", "status"])
    assert.deepEqual(invocation.options.env, env)
    assert.equal(invocation.options.stdio, "inherit")
  })

  it("passes the unpooled fallback to Prisma when DIRECT_URL is blank", () => {
    const env = {
      VERCEL_ENV: "production",
      DIRECT_URL: "   ",
      DATABASE_URL_UNPOOLED: "postgresql://unpooled.example/database",
    }
    let childEnv

    runProductionMigrationGate({
      env,
      spawnSyncImpl: (_command, _args, options) => {
        childEnv = options.env
        return { status: 0 }
      },
      log: () => {},
    })

    assert.equal(childEnv.DIRECT_URL, env.DATABASE_URL_UNPOOLED)
    assert.equal(env.DIRECT_URL, "   ")
  })

  it("fails closed when Prisma cannot run or reports pending migrations", () => {
    const env = {
      VERCEL_ENV: "production",
      DATABASE_URL_UNPOOLED: "postgresql://direct.example/database",
    }

    assert.throws(
      () => runProductionMigrationGate({
        env,
        spawnSyncImpl: () => ({ error: new Error("spawn failed"), status: null }),
        log: () => {},
      }),
      /spawn failed/,
    )
    assert.throws(
      () => runProductionMigrationGate({
        env,
        spawnSyncImpl: () => ({ status: 1 }),
        log: () => {},
      }),
      /pending|could not be verified/i,
    )
  })

  it("is wired before Prisma generation in every build", async () => {
    const packageJson = JSON.parse(await readFile(resolve(repoRoot, "package.json"), "utf8"))

    assert.equal(
      packageJson.scripts["production:migrations:check"],
      "node scripts/assert-production-migrations-current.mjs",
    )
    assert.match(
      packageJson.scripts.prebuild,
      /^npm run production:migrations:check && prisma generate$/,
    )
  })
})
