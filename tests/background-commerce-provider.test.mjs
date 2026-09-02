import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { after, before, describe, it } from "node:test"
import ts from "typescript"

const providerPath = new URL("../components/backgrounds/BackgroundCommerceProvider.tsx", import.meta.url)
const layoutPath = new URL("../components/layout-wrapper.tsx", import.meta.url)
const carouselPath = new URL("../components/backgrounds/background-carousel.tsx", import.meta.url)
const chimerPath = new URL("../app/chimer/page.tsx", import.meta.url)
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const require = createRequire(import.meta.url)

async function source(fileUrl) {
  return readFile(fileUrl, "utf8")
}

/** Returns one named useCallback arrow body so source contracts cannot match neighboring callbacks. */
function callbackArrowBody(sourceText, callbackName) {
  const sourceFile = ts.createSourceFile(
    "BackgroundCommerceProvider.tsx",
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
  const matches = []

  function visit(node) {
    if (
      ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
      && node.name.text === callbackName
    ) {
      const initializer = node.initializer
      const firstArgument = initializer && ts.isCallExpression(initializer)
        ? initializer.arguments[0]
        : undefined
      if (
        initializer
        && ts.isCallExpression(initializer)
        && ts.isIdentifier(initializer.expression)
        && initializer.expression.text === "useCallback"
        && firstArgument
        && ts.isArrowFunction(firstArgument)
      ) {
        matches.push(firstArgument.body)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)

  assert.equal(matches.length, 1, `expected exactly one ${callbackName} useCallback arrow`)
  return sourceText.slice(matches[0].getStart(sourceFile), matches[0].getEnd())
}

let providerHarnessBundlePromise

/** Bundles the real provider with only its data-shape dependencies replaced by deterministic doubles. */
function providerHarnessBundle() {
  if (providerHarnessBundlePromise) return providerHarnessBundlePromise

  const buildPromise = (async () => {
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
        import React, { StrictMode, useEffect, useState } from "react";
        import { createRoot } from "react-dom/client";
        import { BackgroundCommerceProvider, useBackgroundCommerce } from ${JSON.stringify(providerModulePath)};

        const harness = window.__commerceProviderHarness = {
          calls: [],
          owner: null,
          stateFetchMode: window.__commerceProviderInitialStateFetchMode || "success",
          stateFetchModes: [],
          stateFetchAborts: 0,
          pendingStateFetches: 0,
          mutationMode: "success",
          mutationSettled: true,
          checkoutError: null,
          checkoutSettled: false,
          errors: [],
        };
        const nativeAddEventListener = window.addEventListener.bind(window);
        const nativeRemoveEventListener = window.removeEventListener.bind(window);
        const refreshListeners = new Map([
          ["focus", new Map()],
          ["online", new Map()],
        ]);
        window.addEventListener = (type, listener, options) => {
          refreshListeners.get(type)?.set(listener, harness.owner);
          return nativeAddEventListener(type, listener, options);
        };
        window.removeEventListener = (type, listener, options) => {
          refreshListeners.get(type)?.delete(listener);
          return nativeRemoveEventListener(type, listener, options);
        };
        window.addEventListener("error", (event) => harness.errors.push(String(event.error || event.message)));
        window.addEventListener("unhandledrejection", (event) => harness.errors.push(String(event.reason)));
        let latestCommerce = null;
        let updateOwner = null;
        let checkoutResolve = null;
        let mutationResolve = null;
        const pendingStateRequests = new Set();
        const jsonResponse = (value, status = 200) => new Response(JSON.stringify(value), {
          status,
          headers: { "content-type": "application/json" },
        });
        // Pending reads expose whether the real provider shares one request across demand paths.
        const pendingStateResponse = (signal) => new Promise((resolve, reject) => {
          const syncPendingCount = () => { harness.pendingStateFetches = pendingStateRequests.size; };
          const request = {
            resolve: () => {
              if (!pendingStateRequests.delete(request)) return;
              signal?.removeEventListener("abort", request.abort);
              syncPendingCount();
              resolve(jsonResponse({ creditBalance: 2, ownedBackgroundIds: [], cart: { items: [] } }));
            },
            abort: () => {
              if (!pendingStateRequests.delete(request)) return;
              harness.stateFetchAborts += 1;
              syncPendingCount();
              reject(new DOMException("Aborted", "AbortError"));
            },
          };
          pendingStateRequests.add(request);
          syncPendingCount();
          if (signal?.aborted) request.abort();
          else signal?.addEventListener("abort", request.abort, { once: true });
        });

        window.fetch = (input, init = {}) => {
          const pathname = new URL(String(input), "https://massagelab.test").pathname;
          const method = init.method || "GET";
          harness.calls.push(method + " " + pathname);
          if (pathname === "/api/background-commerce/state") {
            const stateFetchMode = harness.stateFetchModes.shift() || harness.stateFetchMode;
            if (stateFetchMode === "pending") return pendingStateResponse(init.signal);
            return Promise.resolve(stateFetchMode === "fail"
              ? jsonResponse({ error: "UNKNOWN" }, 503)
              : jsonResponse({ creditBalance: 2, ownedBackgroundIds: [], cart: { items: [] } }));
          }
          if (pathname === "/api/background-commerce/checkout") {
            return new Promise((resolve) => { checkoutResolve = resolve; });
          }
          if (pathname === "/api/background-commerce/cart") {
            if (harness.mutationMode === "pending") {
              return new Promise((resolve) => { mutationResolve = resolve; });
            }
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
          useEffect(() => {
            if (window.__commerceProviderAutomaticDemand) void latestCommerce.ensureSnapshot();
          }, [latestCommerce.ensureSnapshot]);
          return React.createElement("div", { id: "probe", "data-owner": owner, "data-status": latestCommerce.state.status });
        }
        function App() {
          const [owner, setOwner] = useState("owner-a");
          updateOwner = setOwner;
          return React.createElement(BackgroundCommerceProvider, { ownerKey: owner }, React.createElement(Probe, { owner }));
        }

        harness.setOwner = (owner) => updateOwner(owner);
        harness.ensureSnapshot = () => latestCommerce.ensureSnapshot();
        harness.refresh = () => latestCommerce.refresh();
        harness.failAddToCart = () => latestCommerce.addToCart("static-gradient").catch(() => undefined);
        harness.startAddToCart = () => {
          harness.mutationSettled = false;
          harness.addToCartPromise = latestCommerce.addToCart("static-gradient")
            .catch(() => undefined)
            .finally(() => { harness.mutationSettled = true; });
        };
        harness.resolveMutation = () => mutationResolve(jsonResponse({ ok: true }));
        harness.startCheckout = () => {
          harness.checkoutError = null;
          harness.checkoutSettled = false;
          latestCommerce.startCheckout({
            acceptedLegalDocuments: ["terms"],
            combinedConsentAccepted: true,
            purchaseCountry: "US",
          }).catch((error) => { harness.checkoutError = String(error); }).finally(() => { harness.checkoutSettled = true; });
        };
        harness.resolveCheckout = (body = { url: "https://checkout.stripe.com/c/pay/cs_test_stale" }) => checkoutResolve(jsonResponse(body));
        harness.resolveStateFetches = () => {
          for (const request of [...pendingStateRequests]) request.resolve();
        };
        harness.dispatchFocus = () => window.dispatchEvent(new Event("focus"));
        harness.dispatchOnline = () => window.dispatchEvent(new Event("online"));
        harness.refreshListenersReady = (owner) => ["focus", "online"].every((type) => (
          [...refreshListeners.get(type).values()].includes(owner)
        ));
        harness.read = () => ({ owner: harness.owner, state: latestCommerce.state, calls: [...harness.calls] });

        createRoot(document.getElementById("root")).render(
          React.createElement(StrictMode, null, React.createElement(App)),
        );
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
  providerHarnessBundlePromise = buildPromise
  void buildPromise.catch(() => {
    if (providerHarnessBundlePromise === buildPromise) providerHarnessBundlePromise = undefined
  })

  return providerHarnessBundlePromise
}

async function openProviderHarness(browser, {
  automaticDemand = false,
  stateFetchMode = "success",
} = {}) {
  const page = await browser.newPage()
  await page.route("https://massagelab.test/fixture", (route) => route.fulfill({
    status: 200,
    contentType: "text/html",
    body: '<div id="root"></div>',
  }))
  await page.goto("https://massagelab.test/fixture")
  await page.evaluate(({ automaticDemand, stateFetchMode }) => {
    window.__commerceProviderAutomaticDemand = automaticDemand
    window.__commerceProviderInitialStateFetchMode = stateFetchMode
  }, { automaticDemand, stateFetchMode })
  await page.addScriptTag({ content: await providerHarnessBundle() })
  await page.waitForFunction(() => window.__commerceProviderHarness?.owner === "owner-a")
  return page
}

describe("BackgroundCommerceProvider owner behavior", { concurrency: false }, () => {
  let browser = null

  before(async () => {
    const { chromium } = require("playwright")
    const bundle = providerHarnessBundle()
    try {
      browser = await chromium.launch({ headless: true })
      await bundle
    } catch (error) {
      await bundle.catch(() => undefined)
      if (browser) await browser.close().catch(() => undefined)
      browser = null
      throw error
    }
  })

  after(async () => {
    await browser?.close()
  })

  it("replaces an aborted automatic mount read when Strict Mode replays the consumer", { timeout: 45_000 }, async () => {
    let page = null
    try {
      page = await openProviderHarness(browser, {
        automaticDemand: true,
        stateFetchMode: "pending",
      })
      await page.waitForFunction(() => (
        window.__commerceProviderHarness.stateFetchAborts === 1
        && window.__commerceProviderHarness.pendingStateFetches === 1
        && window.__commerceProviderHarness.read().calls
          .filter((call) => call === "GET /api/background-commerce/state").length === 2
      ))

      const replay = await page.evaluate(() => ({
        ...window.__commerceProviderHarness.read(),
        pendingStateFetches: window.__commerceProviderHarness.pendingStateFetches,
        stateFetchAborts: window.__commerceProviderHarness.stateFetchAborts,
      }))
      assert.equal(
        replay.calls.filter((call) => call === "GET /api/background-commerce/state").length,
        2,
        JSON.stringify(replay),
      )
      assert.equal(replay.pendingStateFetches, 1, JSON.stringify(replay))

      await page.evaluate(() => window.__commerceProviderHarness.resolveStateFetches())
      await page.waitForFunction(() => window.__commerceProviderHarness.read().state.status === "ready")
    } finally {
      await page?.close()
    }
  })

  it("restores the current owner after Strict Mode replays layout effects", { timeout: 45_000 }, async () => {
    let page = null
    try {
      page = await openProviderHarness(browser)

      await page.evaluate(() => window.__commerceProviderHarness.ensureSnapshot())
      await page.waitForFunction(() => (
        window.__commerceProviderHarness.read().state.status === "ready"
        && window.__commerceProviderHarness.read().calls
          .filter((call) => call === "GET /api/background-commerce/state").length === 1
      ))

      const current = await page.evaluate(() => window.__commerceProviderHarness.read())
      assert.equal(
        current.calls.filter((call) => call === "GET /api/background-commerce/state").length,
        1,
        JSON.stringify(current),
      )
      assert.equal(current.state.status, "ready", JSON.stringify(current))
    } finally {
      await page?.close()
    }
  })

  it("does not enqueue a guest-cart merge when the signed-in owner has no pending IDs", { timeout: 45_000 }, async () => {
    let page = null
    try {
      page = await openProviderHarness(browser)
      await page.waitForFunction(() => (
        window.__commerceProviderHarness.refreshListenersReady("owner-a")
      ))

      const current = await page.evaluate(() => ({
        ...window.__commerceProviderHarness.read(),
        errors: window.__commerceProviderHarness.errors,
      }))
      assert.equal(
        current.calls.filter((call) => call === "POST /api/background-commerce/cart").length,
        0,
        JSON.stringify(current),
      )
      assert.equal(current.state.status, "idle", JSON.stringify(current))
      assert.deepEqual(current.errors, [])
    } finally {
      await page?.close()
    }
  })

  it("does not redirect or commit state when an old owner's delayed checkout succeeds", { timeout: 45_000 }, async () => {
    let page = null
    try {
      page = await openProviderHarness(browser)
      const fixtureUrl = page.url()
      await page.route("https://checkout.stripe.com/**", (route) => route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "stale checkout redirect",
      }))

      await page.evaluate(() => window.__commerceProviderHarness.startCheckout())
      await page.waitForFunction(() => (
        window.__commerceProviderHarness.read().calls.includes("POST /api/background-commerce/checkout")
      ))
      const checkoutStart = await page.evaluate(() => ({
        current: window.__commerceProviderHarness.read(),
        errors: window.__commerceProviderHarness.errors,
      }))
      assert.ok(
        checkoutStart.current.calls.includes("POST /api/background-commerce/checkout"),
        JSON.stringify(checkoutStart),
      )
      assert.deepEqual(checkoutStart.errors, [])
      await page.evaluate(() => window.__commerceProviderHarness.setOwner("owner-b"))
      await page.waitForFunction(() => {
        const value = window.__commerceProviderHarness.read()
        return value.owner === "owner-b" && value.state.status === "idle"
      })

      await page.evaluate(() => window.__commerceProviderHarness.resolveCheckout())
      await page.waitForFunction(() => window.__commerceProviderHarness.checkoutSettled === true)

      assert.equal(page.url(), fixtureUrl)
      const { current, checkoutError } = await page.evaluate(() => ({
        current: window.__commerceProviderHarness.read(),
        checkoutError: window.__commerceProviderHarness.checkoutError,
      }))
      assert.equal(checkoutError, null)
      assert.equal(current.owner, "owner-b")
      assert.equal(current.state.status, "idle")
      assert.equal(current.state.pendingAction, null)
    } finally {
      await page?.close()
    }
  })

  it("invalidates pre-checkout hydration so queued demand refreshes after checkout failure", { timeout: 45_000 }, async () => {
    let page = null
    try {
      page = await openProviderHarness(browser)
      await page.evaluate(() => window.__commerceProviderHarness.refresh())
      await page.waitForFunction(() => (
        window.__commerceProviderHarness.read().state.status === "ready"
        && window.__commerceProviderHarness.read().calls
          .filter((call) => call === "GET /api/background-commerce/state").length === 1
      ))

      await page.evaluate(() => window.__commerceProviderHarness.startCheckout())
      await page.waitForFunction(() => (
        window.__commerceProviderHarness.read().state.status === "redirecting"
        && window.__commerceProviderHarness.read().calls.includes("POST /api/background-commerce/checkout")
      ))
      await page.evaluate(() => {
        const harness = window.__commerceProviderHarness
        harness.queuedEnsureSettled = false
        harness.queuedEnsure = harness.ensureSnapshot()
          .finally(() => { harness.queuedEnsureSettled = true })
        harness.resolveCheckout({})
      })
      await page.waitForFunction(() => (
        window.__commerceProviderHarness.checkoutSettled === true
        && window.__commerceProviderHarness.queuedEnsureSettled === true
      ))

      const current = await page.evaluate(() => ({
        ...window.__commerceProviderHarness.read(),
        checkoutError: window.__commerceProviderHarness.checkoutError,
        errors: window.__commerceProviderHarness.errors,
      }))
      assert.equal(current.state.status, "ready", JSON.stringify(current))
      assert.equal(
        current.calls.filter((call) => call === "GET /api/background-commerce/state").length,
        2,
        JSON.stringify(current),
      )
      assert.match(current.checkoutError, /BackgroundCommerceClientError/)
      assert.deepEqual(current.errors, [])
    } finally {
      await page?.close()
    }
  })

  it("does not commit an old owner's delayed cart mutation after the owner changes", { timeout: 45_000 }, async () => {
    let page = null
    try {
      page = await openProviderHarness(browser)
      await page.evaluate(() => {
        window.__commerceProviderHarness.mutationMode = "pending"
        window.__commerceProviderHarness.startAddToCart()
      })
      await page.waitForFunction(() => (
        window.__commerceProviderHarness.read().state.status === "mutating"
        && window.__commerceProviderHarness.read().calls.includes("POST /api/background-commerce/cart")
      ))

      await page.evaluate(() => window.__commerceProviderHarness.setOwner("owner-b"))
      await page.waitForFunction(() => {
        const current = window.__commerceProviderHarness.read()
        return current.owner === "owner-b" && current.state.status === "idle"
      })
      await page.evaluate(() => window.__commerceProviderHarness.resolveMutation())
      await page.waitForFunction(() => window.__commerceProviderHarness.mutationSettled === true)

      const current = await page.evaluate(() => ({
        ...window.__commerceProviderHarness.read(),
        errors: window.__commerceProviderHarness.errors,
      }))
      assert.equal(current.owner, "owner-b", JSON.stringify(current))
      assert.equal(current.state.status, "idle", JSON.stringify(current))
      assert.equal(current.state.pendingAction, null, JSON.stringify(current))
      assert.equal(
        current.calls.filter((call) => call === "GET /api/background-commerce/state").length,
        0,
        JSON.stringify(current),
      )
      assert.deepEqual(current.errors, [])
    } finally {
      await page?.close()
    }
  })

  it("retries only the current owner's failed demanded hydration on focus or reconnect", { timeout: 45_000 }, async () => {
    let page = null
    try {
      page = await openProviderHarness(browser)
      await page.evaluate(async () => {
        window.__commerceProviderHarness.stateFetchMode = "fail"
        await window.__commerceProviderHarness.ensureSnapshot()
      })
      await page.waitForFunction(() => window.__commerceProviderHarness.read().state.status === "error")
      const failedHydration = await page.evaluate(() => ({
        current: window.__commerceProviderHarness.read(),
        errors: window.__commerceProviderHarness.errors,
      }))
      assert.equal(failedHydration.current.state.status, "error", JSON.stringify(failedHydration))
      assert.deepEqual(failedHydration.errors, [])

      await page.evaluate(() => window.__commerceProviderHarness.setOwner("owner-b"))
      await page.waitForFunction(() => {
        const value = window.__commerceProviderHarness.read()
        return value.owner === "owner-b" && value.state.status === "idle"
      })
      await page.waitForFunction(() => (
        window.__commerceProviderHarness.refreshListenersReady("owner-b")
      ))
      let current = await page.evaluate(() => {
        window.__commerceProviderHarness.stateFetchMode = "success"
        window.__commerceProviderHarness.dispatchFocus()
        window.__commerceProviderHarness.dispatchOnline()
        return window.__commerceProviderHarness.read()
      })
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
      await page.waitForFunction(() => (
        window.__commerceProviderHarness.read().state.status === "ready"
        && window.__commerceProviderHarness.read().calls
          .filter((call) => call === "GET /api/background-commerce/state").length === 3
      ))
      current = await page.evaluate(() => window.__commerceProviderHarness.read())
      assert.equal(current.owner, "owner-b")
      assert.equal(current.state.status, "ready", JSON.stringify(current))
      assert.equal(
        current.calls.filter((call) => call === "GET /api/background-commerce/state").length,
        3,
      )
    } finally {
      await page?.close()
    }
  })

  it("shares a demanded focus retry with concurrent consumer hydration", { timeout: 45_000 }, async () => {
    let page = null
    try {
      page = await openProviderHarness(browser)
      await page.evaluate(async () => {
        window.__commerceProviderHarness.stateFetchMode = "fail"
        await window.__commerceProviderHarness.ensureSnapshot()
      })
      await page.waitForFunction(() => window.__commerceProviderHarness.read().state.status === "error")

      await page.evaluate(() => {
        window.__commerceProviderHarness.stateFetchMode = "pending"
        window.__commerceProviderHarness.dispatchFocus()
      })
      await page.waitForFunction(() => (
        window.__commerceProviderHarness.pendingStateFetches === 1
        && window.__commerceProviderHarness.read().calls
          .filter((call) => call === "GET /api/background-commerce/state").length === 2
      ))
      await page.evaluate(() => {
        window.__commerceProviderHarness.concurrentEnsureSettled = false
        window.__commerceProviderHarness.concurrentEnsure = window.__commerceProviderHarness
          .ensureSnapshot()
          .finally(() => { window.__commerceProviderHarness.concurrentEnsureSettled = true })
      })
      await page.waitForFunction(() => (
        Boolean(window.__commerceProviderHarness.concurrentEnsure)
        && window.__commerceProviderHarness.concurrentEnsureSettled === false
        && window.__commerceProviderHarness.pendingStateFetches === 1
      ))

      const overlap = await page.evaluate(() => ({
        current: window.__commerceProviderHarness.read(),
        stateFetchAborts: window.__commerceProviderHarness.stateFetchAborts,
        pendingStateFetches: window.__commerceProviderHarness.pendingStateFetches,
      }))
      assert.equal(
        overlap.current.calls.filter((call) => call === "GET /api/background-commerce/state").length,
        2,
        JSON.stringify(overlap),
      )
      assert.equal(overlap.stateFetchAborts, 0, JSON.stringify(overlap))
      assert.equal(overlap.pendingStateFetches, 1, JSON.stringify(overlap))

      await page.evaluate(async () => {
        window.__commerceProviderHarness.resolveStateFetches()
        await window.__commerceProviderHarness.concurrentEnsure
      })
      await page.waitForFunction(() => window.__commerceProviderHarness.read().state.status === "ready")
      const settled = await page.evaluate(() => ({
        current: window.__commerceProviderHarness.read(),
        concurrentEnsureSettled: window.__commerceProviderHarness.concurrentEnsureSettled,
        errors: window.__commerceProviderHarness.errors,
      }))
      assert.equal(settled.concurrentEnsureSettled, true, JSON.stringify(settled))
      assert.deepEqual(settled.errors, [])
    } finally {
      await page?.close()
    }
  })

  it("refreshes a successfully hydrated current owner once on focus or reconnect", { timeout: 45_000 }, async () => {
    let page = null
    try {
      page = await openProviderHarness(browser)
      await page.evaluate(() => window.__commerceProviderHarness.refresh())
      await page.waitForFunction(() => (
        window.__commerceProviderHarness.read().state.status === "ready"
        && window.__commerceProviderHarness.read().calls
          .filter((call) => call === "GET /api/background-commerce/state").length === 1
        && window.__commerceProviderHarness.refreshListenersReady("owner-a")
      ))

      await page.evaluate(() => {
        window.__commerceProviderHarness.stateFetchMode = "pending"
        window.__commerceProviderHarness.dispatchFocus()
        window.__commerceProviderHarness.dispatchOnline()
      })
      await page.waitForFunction(() => (
        window.__commerceProviderHarness.pendingStateFetches === 1
        && window.__commerceProviderHarness.read().state.status === "loading"
        && window.__commerceProviderHarness.read().calls
          .filter((call) => call === "GET /api/background-commerce/state").length === 2
      ))
      await page.evaluate(() => window.__commerceProviderHarness.resolveStateFetches())
      await page.waitForFunction(() => (
        window.__commerceProviderHarness.pendingStateFetches === 0
        && window.__commerceProviderHarness.read().state.status === "ready"
      ))

      const hydrated = await page.evaluate(() => ({
        current: window.__commerceProviderHarness.read(),
        errors: window.__commerceProviderHarness.errors,
      }))
      assert.equal(
        hydrated.current.calls.filter((call) => call === "GET /api/background-commerce/state").length,
        2,
        JSON.stringify(hydrated),
      )
      assert.deepEqual(hydrated.errors, [])
    } finally {
      await page?.close()
    }
  })

  it("keeps mutation-started owners eligible for a single focus or reconnect refresh", { timeout: 45_000 }, async () => {
    let page = null
    try {
      page = await openProviderHarness(browser)
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
      await page?.close()
    }
  })

  it("invalidates pre-mutation hydration so queued demand retries a failed follow-up read", { timeout: 45_000 }, async () => {
    let page = null
    try {
      page = await openProviderHarness(browser)
      await page.evaluate(() => window.__commerceProviderHarness.ensureSnapshot())
      await page.waitForFunction(() => window.__commerceProviderHarness.read().state.status === "ready")
      await page.evaluate(() => {
        window.__commerceProviderHarness.mutationMode = "pending"
        window.__commerceProviderHarness.stateFetchModes = ["fail", "success"]
        window.__commerceProviderHarness.startAddToCart()
      })
      await page.waitForFunction(() => (
        window.__commerceProviderHarness.read().state.status === "mutating"
        && window.__commerceProviderHarness.read().calls.includes("POST /api/background-commerce/cart")
      ))
      await page.evaluate(() => {
        window.__commerceProviderHarness.queuedEnsureSettled = false
        window.__commerceProviderHarness.queuedEnsure = window.__commerceProviderHarness
          .ensureSnapshot()
          .finally(() => { window.__commerceProviderHarness.queuedEnsureSettled = true })
        window.__commerceProviderHarness.resolveMutation()
      })
      await page.waitForFunction(() => (
        window.__commerceProviderHarness.mutationSettled === true
        && window.__commerceProviderHarness.queuedEnsureSettled === true
        && window.__commerceProviderHarness.read().state.status === "ready"
      ))

      const current = await page.evaluate(() => window.__commerceProviderHarness.read())
      assert.equal(
        current.calls.filter((call) => call === "GET /api/background-commerce/state").length,
        3,
        JSON.stringify(current),
      )
    } finally {
      await page?.close()
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

  it("keeps guest snapshots and focus or reconnect listener wiring", async () => {
    const value = await source(providerPath)
    const refreshBody = callbackArrowBody(value, "refresh")
    assert.match(refreshBody, /if \(!ownerKey\) \{[\s\S]*readGuestBackgroundCartIds/)
    assert.match(value, /createGuestBackgroundCommerceSnapshot/)
    assert.match(value, /addEventListener\("focus"/)
    assert.match(value, /addEventListener\("online"/)
  })

  it("merges guest intent through the authenticated cart API and keeps failed IDs local", async () => {
    const value = await source(providerPath)
    assert.match(value, /"\/api\/background-commerce\/cart"/)
    assert.match(value, /enqueueMutation\("merge-guest-cart"/)
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
    const captureBody = callbackArrowBody(value, "captureOwnershipReconciliationRevision")
    const reconcileBody = callbackArrowBody(value, "reconcileOwnedBackgroundIds")
    const refreshBody = callbackArrowBody(value, "refresh")
    const mutationBody = callbackArrowBody(value, "enqueueMutation")
    assert.match(
      captureBody,
      /commerceRevisionRef\.current/,
    )
    assert.match(
      reconcileBody,
      /shouldApplyPreferenceOwnershipProof\([\s\S]*requestRevision,[\s\S]*commerceRevisionRef\.current[\s\S]*type: "ownership-reconcile"[\s\S]*await refresh\(\)/,
    )
    assert.match(mutationBody, /commerceRevisionRef\.current \+= 1[\s\S]*type: "mutation-begin"/)
    assert.match(refreshBody, /await fetchSnapshot\(controller\.signal\)[\s\S]*commerceRevisionRef\.current \+= 1[\s\S]*type: "fetch-success"/)
    assert.match(mutationBody, /await fetchSnapshot\(controller\.signal\)[\s\S]*commerceRevisionRef\.current \+= 1[\s\S]*type: "mutation-success"/)
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
