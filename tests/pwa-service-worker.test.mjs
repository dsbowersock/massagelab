import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

test("service worker provides an offline navigation fallback", async () => {
  const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8")

  assert.match(source, /CACHE_NAME/)
  assert.match(source, /\/offline\.html/)
  assert.match(source, /request\.mode === "navigate"/)
})

test("service worker avoids caching sensitive application requests", async () => {
  const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8")

  assert.match(source, /request\.method !== "GET"/)
  assert.match(source, /pathname\.startsWith\("\/api\/"\)/)
  assert.match(source, /pathname\.startsWith\("\/account"\)/)
  assert.match(source, /pathname\.startsWith\("\/api\/clinical\/sync"\)/)
  assert.match(source, /pathname\.startsWith\("\/api\/billing\/"\)/)
})

test("service worker does not cache versionless brand or icon assets", async () => {
  const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8")

  assert.doesNotMatch(source, /"\/brand\//)
  assert.doesNotMatch(source, /"\/icons\//)
  assert.doesNotMatch(source, /pathname\.startsWith\("\/brand\/"\)/)
  assert.doesNotMatch(source, /pathname\.startsWith\("\/icons\/"\)/)
})
