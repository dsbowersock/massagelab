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

/**
 * Returns every package-lock version for a package, including nested copies.
 */
function getLockedVersions(lock, packageName) {
  const packagePathSuffix = `node_modules/${packageName}`

  return Object.entries(lock.packages)
    .filter(([path]) => path.endsWith(packagePathSuffix))
    .map(([, entry]) => entry.version)
}

/**
 * Requires at least one resolved copy and checks every copy against one floor.
 */
function assertLockedVersionsAtLeast(lock, packageName, minimum) {
  const versions = getLockedVersions(lock, packageName)

  assert.ok(versions.length > 0, `Expected package-lock.json to resolve ${packageName}`)
  for (const version of versions) {
    assertVersionAtLeast(version, minimum, `resolved ${packageName}`)
  }
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

  assertLockedVersionsAtLeast(lock, "@auth/core", "0.41.3")
})

test("reviewed dependency copies stay above their patched security floors", async () => {
  const [packageJson, lock] = await Promise.all([
    readProjectJson("package.json"),
    readProjectJson("package-lock.json"),
  ])

  assertVersionAtLeast(packageJson.dependencies.next, "16.2.12", "next")
  assert.equal(packageJson.dependencies["nodemailer-v9"], "npm:nodemailer@^9.0.3")
  assertVersionAtLeast(packageJson.dependencies["@prisma/adapter-neon"], "7.9.1", "@prisma/adapter-neon")
  assertVersionAtLeast(packageJson.dependencies["@prisma/client"], "7.9.1", "@prisma/client")
  assertVersionAtLeast(packageJson.devDependencies.postcss, "8.5.18", "postcss")
  assertVersionAtLeast(packageJson.devDependencies.prisma, "7.9.1", "prisma")
  assertVersionAtLeast(packageJson.devDependencies.shadcn, "4.16.1", "shadcn")
  assert.equal(packageJson.devDependencies["eslint-config-next"], packageJson.dependencies.next)

  const fixedVersionFloors = new Map([
    ["@babel/core", "7.29.6"],
    ["@hono/node-server", "2.0.10"],
    ["fast-uri", "3.1.4"],
    ["hono", "4.12.27"],
    ["nodemailer-v9", "9.0.1"],
    ["postcss", "8.5.18"],
    ["sharp", "0.35.3"],
  ])

  for (const [packageName, minimum] of fixedVersionFloors) {
    assertLockedVersionsAtLeast(lock, packageName, minimum)
  }

  assert.deepEqual(
    getLockedVersions(lock, "nodemailer"),
    [],
    "Auth.js must keep its unused optional Nodemailer peer absent",
  )

  const braceExpansionFloors = new Map([
    [1, "1.1.16"],
    [2, "2.1.3"],
    [5, "5.0.8"],
  ])

  const braceExpansionVersions = getLockedVersions(lock, "brace-expansion")
  assert.ok(braceExpansionVersions.length > 0, "Expected package-lock.json to resolve brace-expansion")

  for (const version of braceExpansionVersions) {
    const major = Number(version.split(".", 1)[0])
    const minimum = braceExpansionFloors.get(major)
    assert.ok(minimum, `Unexpected brace-expansion major ${version}; review its advisory floor`)
    assertVersionAtLeast(version, minimum, "resolved brace-expansion")
  }
})

test("the authentication mail boundary cannot enable raw, file, or URL message input", async () => {
  const source = await readFile(new URL("../lib/auth-mail.ts", import.meta.url), "utf8")
  const sendMailStart = source.indexOf("async function sendMail(")
  const sendMailEnd = source.indexOf("export function buildVerificationEmailLink", sendMailStart)

  assert.notEqual(sendMailStart, -1, "Expected the private sendMail boundary")
  assert.notEqual(sendMailEnd, -1, "Expected a stable end marker for the private sendMail boundary")

  const sendMailSource = source.slice(sendMailStart, sendMailEnd)
  assert.match(sendMailSource, /disableFileAccess:\s*true/)
  assert.match(sendMailSource, /disableUrlAccess:\s*true/)
  assert.match(sendMailSource, /dnsTimeout:\s*SMTP_DNS_TIMEOUT_MS/)
  assert.match(sendMailSource, /connectionTimeout:\s*SMTP_CONNECTION_TIMEOUT_MS/)
  assert.match(sendMailSource, /greetingTimeout:\s*SMTP_GREETING_TIMEOUT_MS/)
  assert.match(sendMailSource, /socketTimeout:\s*SMTP_SOCKET_TIMEOUT_MS/)
  assert.match(sendMailSource, /setTimeout\(\(\) => \{[\s\S]*transporter\.close\(\)[\s\S]*ACCOUNT_CHANGE_EMAIL_DELIVERY_BUDGET_MS/)
  assert.match(sendMailSource, /await Promise\.race\(\[delivery, deadline\]\)/)
  assert.match(sendMailSource, /finally \{[\s\S]*clearTimeout\(deliveryTimer\)/)
  assert.match(sendMailSource, /transporter\.sendMail\(\{[\s\S]*?from:[\s\S]*?to,[\s\S]*?subject,[\s\S]*?text,[\s\S]*?\}\)/)
  assert.doesNotMatch(sendMailSource, /\braw\s*:/)
  assert.doesNotMatch(sendMailSource, /\.\.\./)
})

test("the patched Nodemailer alias supports the fixed-field delivery contract", async () => {
  const { default: nodemailer } = await import("nodemailer-v9")
  const transporter = nodemailer.createTransport({
    streamTransport: true,
    buffer: true,
    disableFileAccess: true,
    disableUrlAccess: true,
  })
  const result = await transporter.sendMail({
    from: "noreply@example.test",
    to: "member@example.test",
    subject: "Security contract",
    text: "Fixed-field delivery remains available.",
  })
  const message = result.message.toString("utf8")

  assert.match(message, /Subject: Security contract/)
  assert.match(message, /Fixed-field delivery remains available\./)
})
