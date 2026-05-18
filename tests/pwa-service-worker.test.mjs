import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

test("service worker provides an offline navigation fallback", async () => {
  const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8")

  assert.match(source, /CACHE_NAME/)
  assert.match(source, /\/offline\.html/)
  assert.match(source, /PUBLIC_OFFLINE_ROUTES/)
  assert.match(source, /request\.mode === "navigate"/)
})

test("service worker avoids caching sensitive application requests", async () => {
  const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8")

  assert.match(source, /request\.method !== "GET"/)
  assert.match(source, /SENSITIVE_PREFIXES/)
  assert.match(source, /"\/api\/"/)
  assert.match(source, /"\/account"/)
  assert.match(source, /"\/api\/billing\/"/)
  assert.match(source, /"\/api\/auth\/"/)
  assert.match(source, /"\/api\/clinical\/sync"/)
  assert.match(source, /"\/calendar"/)
  assert.match(source, /"\/book"/)
  assert.match(source, /"\/admin"/)
  assert.match(source, /"\/settings"/)
  assert.match(source, /"\/pricing"/)
  assert.doesNotMatch(source, /pathname\.startsWith\("\/api\/clinical\/sync"\)/)
  assert.doesNotMatch(source, /pathname\.startsWith\("\/api\/billing\/"\)/)
  assert.doesNotMatch(source, /pathname\.startsWith\("\/api\/auth\/"\)/)
  assert.doesNotMatch(source, /pathname\.startsWith\("\/api\/account\/"\)/)
  assert.doesNotMatch(source, /pathname\.startsWith\("\/api\/clients\/"\)/)
})

test("service worker does not cache versionless brand or icon assets", async () => {
  const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8")

  assert.doesNotMatch(source, /"\/brand\//)
  assert.doesNotMatch(source, /"\/icons\//)
  assert.doesNotMatch(source, /pathname\.startsWith\("\/brand\/"\)/)
  assert.doesNotMatch(source, /pathname\.startsWith\("\/icons\/"\)/)
})

test("service worker only warms anonymous public tool routes for offline navigation", async () => {
  const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8")
  const publicRoutesBlock = source.match(/const PUBLIC_OFFLINE_ROUTES = \[([\s\S]*?)\]/)?.[1] ?? ""

  for (const route of ["/", "/notes", "/notes/soap", "/notes/intake", "/notes/journal", "/notes/rom", "/chimer", "/anatomime"]) {
    assert.match(publicRoutesBlock, new RegExp(`"${route.replaceAll("/", "\\/")}"`))
  }

  for (const excludedRoute of ["/calendar", "/account", "/login", "/api/", "/book", "/pricing"]) {
    assert.doesNotMatch(publicRoutesBlock, new RegExp(`"${excludedRoute.replaceAll("/", "\\/")}"`))
  }

  assert.match(source, /credentials: "omit"/)
})

test("service worker does not blindly cache live navigation responses", async () => {
  const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8")

  assert.match(source, /warmPublicOfflineRoutes/)
  assert.doesNotMatch(source, /cache\.put\(request,\s*networkResponse\.clone\(\)\)/)
  assert.match(source, /publicOfflineCacheKey/)
})

test("service worker caches static shell assets only through successful lifecycle-bound writes", async () => {
  const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8")

  assert.match(source, /if \(!networkResponse\.ok\)/)
  assert.match(source, /const responseCopy = networkResponse\.clone\(\)/)
  assert.match(source, /event\.waitUntil\(/)
  assert.match(source, /cache\.put\(request, responseCopy\)/)
})
