import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"
import ts from "typescript"

const providerPath = new URL("../components/backgrounds/BackgroundCommerceProvider.tsx", import.meta.url)
const layoutPath = new URL("../components/layout-wrapper.tsx", import.meta.url)
const carouselPath = new URL("../components/backgrounds/background-carousel.tsx", import.meta.url)
const chimerPath = new URL("../app/chimer/page.tsx", import.meta.url)
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const require = createRequire(import.meta.url)

async function source(path) {
  return readFile(path, "utf8")
}

let providerHarnessBundlePromise

/** Bundles the real provider with only its data-shape dependencies replaced by deterministic doubles. */
function providerHarnessBundle() {
  if (providerHarnessBundlePromise) return providerHarnessBundlePromise

  providerHarnessBundlePromise = (async () => {
    const fixtureRoot = mkdtempSync(path.join(tmpdir(), "massagelab-commerce-provider-"))
    try {
      const outputRoot = path.join(fixtureRoot, "dist")
      const providerModulePath = path.join(fixtureRoot, "background-commerce-provider.js")
      const supportModulePath = path.join(fixtureRoot, "commerce-support.js")
      const entryPath = path.join(fixtureRoot, "entry.js")
      const transpiledProvider = ts.transpileModule(await source(providerPath), {
        compilerOptions: {
          jsx: ts.JsxEmit.ReactJSX,
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2020,
        },
      }).outputText
      writeFileSync(providerModulePath, transpiledProvider)
      writeFileSync(supportModulePath, `
        export const EMPTY_BACKGROUND_COMMERCE_STATE = {
          status: "idle", snapshot: null, pendingAction: null, error: null,
        };
        export function normalizeBackgroundCommerceSnapshot(value) { return value; }
        export function shouldApplyPreferenceOwnershipProof(left, right) { return left === right; }
        export function backgroundCommerceReducer(state, action) {
          if (action.type === "fetch-begin") return { ...state, status: "loading", pendingAction: action };
          if (action.type === "fetch-success") return { status: "ready", snapshot: action.snapshot, pendingAction: null, error: null };
          if (action.type === "fetch-failure") return { ...state, status: "error", pendingAction: null, error: action.error };
          if (action.type === "mutation-begin") return { ...state, status: "mutating", pendingAction: action, error: null };
          if (action.type === "mutation-failure") return { ...state, status: "error", pendingAction: null, error: action.error };
          if (action.type === "mutation-success") return { status: "ready", snapshot: action.snapshot, pendingAction: null, error: null };
          if (action.type === "mutation-refresh-failure") return { ...state, status: "ready", pendingAction: null, error: action.error };
          if (action.type === "checkout-redirect-begin") return { ...state, status: "redirecting", pendingAction: action, error: null };
          if (action.type === "checkout-redirect-failure") return { ...state, status: "error", pendingAction: null, error: action.error };
          return state;
        }
        export function createGuestBackgroundCommerceSnapshot() { return { creditBalance: 0, ownedBackgroundIds: [], cart: { items: [] } }; }
        export function readGuestBackgroundCartIds() { return []; }
        export function resolveGuestBackgroundCartItem() { return null; }
        export function writeGuestBackgroundCartIds(_storage, ids) { return ids; }
      `)
      writeFileSync(entryPath, `
        import React, { useState } from "react";
        import { createRoot } from "react-dom/client";
        import { BackgroundCommerceProvider, useBackgroundCommerce } from ${JSON.stringify(providerModulePath)};

        const harness = window.__commerceProviderHarness = {
          calls: [],
          owner: null,
          stateFetchMode: "success",
          mutationMode: "success",
          checkoutSettled: false,
          errors: [],
        };
        window.addEventListener("error", (event) => harness.errors.push(String(event.error || event.message)));
        window.addEventListener("unhandledrejection", (event) => harness.errors.push(String(event.reason)));
        let latestCommerce = null;
        let updateOwner = null;
        let checkoutResolve = null;
        const jsonResponse = (value, status = 200) => new Response(JSON.stringify(value), {
          status,
          headers: { "content-type": "application/json" },
        });

        window.fetch = (input, init = {}) => {
          const pathname = new URL(String(input), "https://massagelab.test").pathname;
          const method = init.method || "GET";
          harness.calls.push(method + " " + pathname);
          if (pathname === "/api/background-commerce/state") {
            return Promise.resolve(harness.stateFetchMode === "fail"
              ? jsonResponse({ error: "UNKNOWN" }, 503)
              : jsonResponse({ creditBalance: 2, ownedBackgroundIds: [], cart: { items: [] } }));
          }
          if (pathname === "/api/background-commerce/checkout") {
            return new Promise((resolve) => { checkoutResolve = resolve; });
          }
          if (pathname === "/api/background-commerce/cart") {
            return Promise.resolve(harness.mutationMode === "fail"
              ? jsonResponse({ error: "UNKNOWN" }, 503)
              : jsonResponse({ ok: true }));
          }
          return Promise.resolve(jsonResponse({ ok: true }));
        };

        function Probe({ owner }) {
          latestCommerce = useBackgroundCommerce();
          harness.owner = owner;
          harness.state = latestCommerce.state;
          return React.createElement("div", { id: "probe", "data-owner": owner, "data-status": latestCommerce.state.status });
        }
        function App() {
          const [owner, setOwner] = useState("owner-a");
          updateOwner = setOwner;
          return React.createElement(BackgroundCommerceProvider, { ownerKey: owner }, React.createElement(Probe, { owner }));
        }

        harness.setOwner = (owner) => updateOwner(owner);
        harness.ensureSnapshot = () => latestCommerce.ensureSnapshot();
        harness.failAddToCart = () => latestCommerce.addToCart("static-gradient").catch(() => undefined);
        harness.startCheckout = () => {
          harness.checkoutSettled = false;
          latestCommerce.startCheckout({
            acceptedLegalDocuments: ["terms"],
            combinedConsentAccepted: true,
            purchaseCountry: "US",
          }).finally(() => { harness.checkoutSettled = true; });
        };
        harness.resolveCheckout = () => checkoutResolve(jsonResponse({ url: "https://checkout.stripe.com/c/pay/cs_test_stale" }));
        harness.dispatchFocus = () => window.dispatchEvent(new Event("focus"));
        harness.dispatchOnline = () => window.dispatchEvent(new Event("online"));
        harness.read = () => ({ owner: harness.owner, state: latestCommerce.state, calls: [...harness.calls] });

        createRoot(document.getElementById("root")).render(React.createElement(App));
      `)

      const webpackModule = require("next/dist/compiled/webpack/webpack")
      const webpack = webpackModule.webpack
      await new Promise((resolve, reject) => {
        webpack({
          mode: "development",
          context: projectRoot,
          entry: entryPath,
          output: { path: outputRoot, filename: "fixture.js" },
          resolve: {
            extensions: [".js"],
            alias: {
              "@/lib/background-commerce-client.js": supportModulePath,
              "@/lib/guest-background-cart": supportModulePath,
            },
            modules: [path.join(projectRoot, "node_modules"), "node_modules"],
          },
        }, (error, stats) => {
          if (error) return reject(error)
          if (stats?.hasErrors()) return reject(new Error(stats.toString({ errors: true, warnings: false })))
          resolve()
        })
      })
      return readFileSync(path.join(outputRoot, "fixture.js"), "utf8")
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true })
    }
  })()

  return providerHarnessBundlePromise
}

async function openProviderHarness(browser) {
  const page = await browser.newPage()
  await page.route("https://massagelab.test/fixture", (route) => route.fulfill({
    status: 200,
    contentType: "text/html",
    body: '<div id="root"></div>',
  }))
  await page.goto("https://massagelab.test/fixture")
  await page.addScriptTag({ content: await providerHarnessBundle() })
  await page.waitForFunction(() => window.__commerceProviderHarness?.owner === "owner-a")
  return page
}

describe("BackgroundCommerceProvider owner behavior", () => {
  it("does not redirect or commit state when an old owner's delayed checkout succeeds", { timeout: 45_000 }, async () => {
    const { chromium } = require("playwright")
    const browser = await chromium.launch({ headless: true })
    try {
      const page = await openProviderHarness(browser)
      const fixtureUrl = page.url()
      await page.route("https://checkout.stripe.com/**", (route) => route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "stale checkout redirect",
      }))

      await page.evaluate(() => window.__commerceProviderHarness.startCheckout())
      await page.waitForTimeout(100)
      const checkoutStart = await page.evaluate(() => ({
        current: window.__commerceProviderHarness.read(),
        errors: window.__commerceProviderHarness.errors,
      }))
      assert.ok(
        checkoutStart.current.calls.includes("POST /api/background-commerce/checkout"),
        JSON.stringify(checkoutStart),
      )
      await page.evaluate(() => window.__commerceProviderHarness.setOwner("owner-b"))
      await page.waitForFunction(() => {
        const value = window.__commerceProviderHarness.read()
        return value.owner === "owner-b" && value.state.status === "idle"
      })

      await page.evaluate(() => window.__commerceProviderHarness.resolveCheckout())
      await page.waitForTimeout(250)

      assert.equal(page.url(), fixtureUrl)
      const current = await page.evaluate(() => window.__commerceProviderHarness.read())
      assert.equal(current.owner, "owner-b")
      assert.equal(current.state.status, "idle")
      assert.equal(current.state.pendingAction, null)
    } finally {
      await browser.close()
    }
  })

  it("retries only the current owner's failed demanded hydration on focus or reconnect", { timeout: 45_000 }, async () => {
    const { chromium } = require("playwright")
    const browser = await chromium.launch({ headless: true })
    try {
      const page = await openProviderHarness(browser)
      await page.evaluate(async () => {
        window.__commerceProviderHarness.stateFetchMode = "fail"
        await window.__commerceProviderHarness.ensureSnapshot()
      })
      await page.waitForTimeout(100)
      const failedHydration = await page.evaluate(() => ({
        current: window.__commerceProviderHarness.read(),
        errors: window.__commerceProviderHarness.errors,
      }))
      assert.equal(failedHydration.current.state.status, "error", JSON.stringify(failedHydration))

      await page.evaluate(() => window.__commerceProviderHarness.setOwner("owner-b"))
      await page.waitForFunction(() => {
        const value = window.__commerceProviderHarness.read()
        return value.owner === "owner-b" && value.state.status === "idle"
      })
      await page.evaluate(() => {
        window.__commerceProviderHarness.stateFetchMode = "success"
        window.__commerceProviderHarness.dispatchFocus()
        window.__commerceProviderHarness.dispatchOnline()
      })
      await page.waitForTimeout(100)
      let current = await page.evaluate(() => window.__commerceProviderHarness.read())
      assert.equal(
        current.calls.filter((call) => call === "GET /api/background-commerce/state").length,
        1,
      )

      await page.evaluate(async () => {
        window.__commerceProviderHarness.stateFetchMode = "fail"
        await window.__commerceProviderHarness.ensureSnapshot()
        window.__commerceProviderHarness.stateFetchMode = "success"
        window.__commerceProviderHarness.dispatchFocus()
        window.__commerceProviderHarness.dispatchOnline()
      })
      await page.waitForTimeout(100)
      current = await page.evaluate(() => window.__commerceProviderHarness.read())
      assert.equal(current.owner, "owner-b")
      assert.equal(current.state.status, "ready", JSON.stringify(current))
      assert.equal(
        current.calls.filter((call) => call === "GET /api/background-commerce/state").length,
        3,
      )
    } finally {
      await browser.close()
    }
  })

  it("keeps mutation-started owners eligible for a single focus or reconnect refresh", { timeout: 45_000 }, async () => {
    const { chromium } = require("playwright")
    const browser = await chromium.launch({ headless: true })
    try {
      const page = await openProviderHarness(browser)
      await page.evaluate(async () => {
        window.__commerceProviderHarness.mutationMode = "fail"
        await window.__commerceProviderHarness.failAddToCart()
        window.__commerceProviderHarness.dispatchFocus()
        window.__commerceProviderHarness.dispatchOnline()
      })
      await page.waitForFunction(() => window.__commerceProviderHarness.read().state.status === "ready")
      const current = await page.evaluate(() => window.__commerceProviderHarness.read())
      assert.equal(
        current.calls.filter((call) => call === "GET /api/background-commerce/state").length,
        1,
      )
    } finally {
      await browser.close()
    }
  })
})

describe("BackgroundCommerceProvider contract", () => {
  it("owns one no-store authenticated state fetch and cancels it on cleanup", async () => {
    const value = await source(providerPath)
    assert.match(value, /\/api\/background-commerce\/state/)
    assert.match(value, /credentials:\s*"same-origin"/)
    assert.match(value, /cache:\s*"no-store"/)
    assert.match(value, /new AbortController\(\)/)
    assert.match(value, /controller\.abort\(\)/)
  })

  it("refreshes only demanded, successfully hydrated, or mutation-started owners on focus", async () => {
    const value = await source(providerPath)
    assert.match(value, /if \(!ownerKey\) \{[\s\S]*readGuestBackgroundCartIds/)
    assert.match(value, /createGuestBackgroundCommerceSnapshot/)
    assert.match(value, /demandedOwnerRef\.current !== ownerKey/)
    assert.match(value, /hydratedOwnerRef\.current !== ownerKey/)
    assert.match(value, /mutationStartedOwnerRef\.current !== ownerKey/)
    assert.match(value, /addEventListener\("focus"/)
    assert.match(value, /addEventListener\("online"/)
  })

  it("merges guest intent through the authenticated cart API and keeps failed IDs local", async () => {
    const value = await source(providerPath)
    assert.match(value, /pendingIds = readGuestBackgroundCartIds/)
    assert.match(value, /for \(const backgroundId of pendingIds\)/)
    assert.match(value, /"\/api\/background-commerce\/cart"/)
    assert.match(value, /enqueueMutation\("merge-guest-cart"/)
    assert.match(value, /pendingIds\.length > 0/)
    assert.doesNotMatch(value, /Account state must load even when there is no guest intent/)
    assert.match(value, /remainingIds\.push\(backgroundId\)/)
    assert.match(value, /writeGuestBackgroundCartIds\(window\.localStorage, remainingIds\)/)
    assert.match(value, /ITEM_RESERVED/)
  })

  it("serializes mutations and refreshes the full authoritative snapshot", async () => {
    const value = await source(providerPath)
    assert.match(value, /mutationQueueRef/)
    assert.match(value, /enqueueSerializedOperation/)
    assert.match(value, /mutationQueueRef\.current\.then\(operation, operation\)/)
    assert.match(value, /await enqueueSerializedOperation\(async \(\) => \{[\s\S]*checkout-redirect-begin/)
    assert.match(value, /normalizeBackgroundCommerceSnapshot/)
    assert.match(value, /if \(controller\.signal\.aborted\) return[\s\S]*dispatch\(\{ type: "mutation-begin"/)
    assert.match(value, /type: "mutation-refresh-failure"/)
    assert.doesNotMatch(value, /creditBalance\s*[+\-]=|ownedBackgroundIds\.push/)
  })

  it("reconciles preference ownership only when commerce did not advance", async () => {
    const value = await source(providerPath)
    assert.match(
      value,
      /const captureOwnershipReconciliationRevision[\s\S]*commerceRevisionRef\.current/,
    )
    assert.match(
      value,
      /const reconcileOwnedBackgroundIds[\s\S]*shouldApplyPreferenceOwnershipProof\([\s\S]*requestRevision,[\s\S]*commerceRevisionRef\.current[\s\S]*type: "ownership-reconcile"[\s\S]*await refresh\(\)/,
    )
    assert.match(value, /commerceRevisionRef\.current \+= 1[\s\S]*type: "mutation-begin"/)
    assert.match(value, /await fetchSnapshot\(controller\.signal\)[\s\S]*commerceRevisionRef\.current \+= 1[\s\S]*type: "fetch-success"/)
    assert.match(value, /await fetchSnapshot\(controller\.signal\)[\s\S]*commerceRevisionRef\.current \+= 1[\s\S]*type: "mutation-success"/)
  })

  it("keeps guest cart identities unique and removes one matching line", async () => {
    const value = await source(providerPath)
    assert.match(value, /current\.includes\(item\.productKey\) \? current/)
    assert.match(value, /const matchIndex = current\.indexOf\(backgroundId\)/)
    assert.match(value, /index !== matchIndex/)
  })

  it("uses stable public auth errors and validates Stripe redirects", async () => {
    const value = await source(providerPath)
    assert.match(value, /AUTH_REQUIRED/)
    assert.match(value, /EMAIL_VERIFICATION_REQUIRED/)
    assert.match(value, /checkout\.stripe\.com/)
    assert.match(value, /window\.location\.assign/)
    assert.match(value, /const cancelReservation[\s\S]*if \(!signedIn\)[\s\S]*AUTH_REQUIRED/)
  })

  it("exposes the shared API and retains caller-provided redemption idempotency keys", async () => {
    const value = await source(providerPath)
    for (const member of ["ensureSnapshot", "refresh", "addToCart", "removeFromCart", "redeemCredit", "startCheckout"]) {
      assert.match(value, new RegExp(`\\b${member}\\b`))
    }
    assert.match(value, /idempotencyKey/)
    assert.match(value, /confirmationAccepted:\s*true/)
  })

  it("mounts exactly once at the shared layout boundary", async () => {
    const value = await source(layoutPath)
    assert.equal((value.match(/<BackgroundCommerceProvider\b/g) ?? []).length, 1)
    assert.match(value, /ownerKey=\{ownerKey\}/)
  })

  it("hydrates from actual carousel and Chimer consumers without a shell mount read", async () => {
    const [provider, carousel, chimer] = await Promise.all([
      source(providerPath),
      source(carouselPath),
      source(chimerPath),
    ])
    assert.match(provider, /snapshotPromiseRef/)
    assert.match(provider, /if \(snapshotPromiseRef\.current\) return snapshotPromiseRef\.current/)
    assert.match(carousel, /void ensureSnapshot\(\)/)
    assert.match(chimer, /void ensureBackgroundCommerceSnapshot\(\)/)
  })
})
