import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

async function readProjectJson(path) {
  return JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), "utf8"))
}

/**
 * Compares the stable and beta versions used by the patched Next.js/Auth.js
 * dependency set without relying on a transitive semver package.
 */
function assertVersionAtLeast(actualValue, minimum, label) {
  const parse = (value) => {
    const normalized = String(value).replace(/^[~^]/, "")
    const match = normalized.match(/^(\d+)\.(\d+)\.(\d+)(?:-beta\.(\d+))?$/)

    assert.ok(match, `Expected a comparable ${label} version, received ${value}`)
    return [
      Number(match[1]),
      Number(match[2]),
      Number(match[3]),
      match[4] === undefined ? Number.POSITIVE_INFINITY : Number(match[4]),
    ]
  }

  const actual = parse(actualValue)
  const required = parse(minimum)
  const firstDifference = actual.findIndex((part, index) => part !== required[index])

  assert.ok(
    firstDifference === -1 || actual[firstDifference] > required[firstDifference],
    `Expected ${label} ${actualValue} to be at least ${minimum}`,
  )
}

test("framework and authentication dependencies stay above the patched security floor", async () => {
  const [packageJson, lock] = await Promise.all([
    readProjectJson("package.json"),
    readProjectJson("package-lock.json"),
  ])

  assertVersionAtLeast(packageJson.dependencies.next, "16.2.11", "next")
  assertVersionAtLeast(packageJson.dependencies["next-auth"], "5.0.0-beta.32", "next-auth")
  assertVersionAtLeast(packageJson.dependencies["@auth/prisma-adapter"], "2.11.3", "@auth/prisma-adapter")
  assert.equal(packageJson.devDependencies["eslint-config-next"], packageJson.dependencies.next)

  assertVersionAtLeast(lock.packages["node_modules/next"].version, "16.2.11", "resolved next")
  assertVersionAtLeast(lock.packages["node_modules/next-auth"].version, "5.0.0-beta.32", "resolved next-auth")
  assertVersionAtLeast(lock.packages["node_modules/@auth/prisma-adapter"].version, "2.11.3", "resolved @auth/prisma-adapter")

  const authCoreCopies = Object.entries(lock.packages)
    .filter(([path]) => path.endsWith("node_modules/@auth/core"))
    .map(([, entry]) => entry.version)

  assert.ok(authCoreCopies.length > 0, "Expected package-lock.json to resolve @auth/core")
  for (const version of authCoreCopies) {
    assertVersionAtLeast(version, "0.41.3", "resolved @auth/core")
  }
})
