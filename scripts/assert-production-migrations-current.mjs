import { spawnSync } from "node:child_process"
import { dirname, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const prismaCliPath = resolve(repoRoot, "node_modules", "prisma", "build", "index.js")

/** Returns whether this build is the Vercel Production promotion boundary. */
export function shouldCheckProductionMigrations(env = process.env) {
  return env.VERCEL_ENV === "production"
}

/**
 * Requires the direct Neon maintenance connection used by Prisma Migrate while
 * keeping the pooled runtime URL out of schema administration.
 */
export function requireDirectProductionMigrationUrl(env = process.env) {
  const directUrl = env.DIRECT_URL?.trim() || env.DATABASE_URL_UNPOOLED?.trim()

  if (!directUrl) {
    throw new Error(
      "Production migration status requires DIRECT_URL or DATABASE_URL_UNPOOLED; refusing to promote without a direct maintenance connection.",
    )
  }

  return directUrl
}

/**
 * Fails a Vercel Production build unless Prisma confirms every committed
 * migration is applied. This is read-only and never applies or resolves a
 * migration; live writes remain a separately authorized operator action.
 */
export function runProductionMigrationGate({
  env = process.env,
  spawnSyncImpl = spawnSync,
  log = console.log,
} = {}) {
  if (!shouldCheckProductionMigrations(env)) {
    log("Production migration gate skipped outside Vercel Production.")
    return { checked: false }
  }

  const directUrl = requireDirectProductionMigrationUrl(env)
  const migrationEnv = {
    ...env,
    DIRECT_URL: directUrl,
  }
  const result = spawnSyncImpl(process.execPath, [prismaCliPath, "migrate", "status"], {
    env: migrationEnv,
    stdio: "inherit",
  })

  if (result.error) {
    throw new Error(`Production migration status could not start: ${result.error.message}`, {
      cause: result.error,
    })
  }
  if (result.status !== 0) {
    throw new Error(
      "Production migration gate failed: committed migrations are pending or status could not be verified. Apply the reviewed migrations through the separately authorized Production maintenance path, then redeploy.",
    )
  }

  log("Production migration gate passed: all committed migrations are applied.")
  return { checked: true }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null

if (invokedPath === import.meta.url) {
  try {
    runProductionMigrationGate()
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Production migration status failed.")
    process.exitCode = 1
  }
}
