import { createRequire } from "node:module"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"

const require = createRequire(import.meta.url)
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const therapistProviderPath = path.join(
  projectRoot,
  "components/providers/therapist-settings-provider.tsx",
)
const calendarProviderPath = path.join(
  projectRoot,
  "components/sidebar/sidebar-calendar-provider.tsx",
)

const supportedSpecializedProviderImports = new Set([
  "@/components/providers/account-shell-bootstrap-provider",
  "@/lib/client-fetch",
  "@/lib/sidebar-calendar-context",
  "react",
])

/** Fails on authored provider imports before transpilation can elide a dependency the fixture cannot supply. */
export function assertSpecializedProviderImportSurface(source, providerLabel) {
  const importedFiles = ts.preProcessFile(source, true, true).importedFiles
  for (const importedFile of importedFiles) {
    if (!supportedSpecializedProviderImports.has(importedFile.fileName)) {
      throw new Error(
        `Unsupported specialized provider import in ${providerLabel}: ${importedFile.fileName}`,
      )
    }
  }
}

/** Caches one successful build while allowing a failed current build to be retried. */
export function createSpecializedProviderBundleLoader(buildBundle) {
  let currentBuild

  return function loadBundle() {
    if (currentBuild) return currentBuild

    const build = Promise.resolve().then(buildBundle)
    currentBuild = build
    void build.catch(() => {
      if (currentBuild === build) currentBuild = undefined
    })
    return build
  }
}

/**
 * Bundles the real specialized shell providers with only owner-bootstrap and fetch adapters
 * replaced by inert browser doubles. No application route, account, or provider is contacted.
 */
const specializedProviderBundle = createSpecializedProviderBundleLoader(async () => {
    const fixtureRoot = mkdtempSync(path.join(tmpdir(), "massagelab-specialized-providers-"))
    try {
      const outputRoot = path.join(fixtureRoot, "dist")
      const therapistModulePath = path.join(fixtureRoot, "therapist-settings-provider.js")
      const calendarModulePath = path.join(fixtureRoot, "sidebar-calendar-provider.js")
      const supportModulePath = path.join(fixtureRoot, "specialized-provider-support.js")
      const entryPath = path.join(fixtureRoot, "entry.js")
      const compilerOptions = {
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2020,
      }

      const therapistAuthoredSource = await readFile(therapistProviderPath, "utf8")
      const calendarAuthoredSource = await readFile(calendarProviderPath, "utf8")
      assertSpecializedProviderImportSurface(therapistAuthoredSource, "therapist settings provider")
      assertSpecializedProviderImportSurface(calendarAuthoredSource, "sidebar calendar provider")
      const therapistModuleSource = ts.transpileModule(
        therapistAuthoredSource,
        { compilerOptions },
      ).outputText
      const calendarModuleSource = ts.transpileModule(
        calendarAuthoredSource,
        { compilerOptions },
      ).outputText
      writeFileSync(therapistModulePath, therapistModuleSource)
      writeFileSync(calendarModulePath, calendarModuleSource)
      writeFileSync(supportModulePath, `
        export const emptySidebarCalendarContext = Object.freeze({
          practice: null,
          therapists: Object.freeze([]),
          canManageAvailability: false,
          pendingAppointmentRequestCount: 0,
          openWaitlistEntryCount: 0,
        });
        export function useAccountShellBootstrap() {
          return window.__specializedProviderBootstrap;
        }
        export async function fetchJsonWithTimeout(input, init, timeoutMs) {
          const pathname = new URL(String(input), "https://massagelab-specialized.test").pathname;
          const harness = window.__specializedProviderHarness;
          if (pathname === "/api/account/profile") harness.profileTimeouts.push(timeoutMs);
          if (pathname === "/api/calendar/sidebar-context") harness.calendarTimeouts.push(timeoutMs);
          const response = await fetch(input, init);
          return { response, json: response.ok ? await response.json() : undefined };
        }
        export function fetchWithTimeout(input, init) {
          return fetch(input, init);
        }
      `)
      writeFileSync(entryPath, `
        import React, { useEffect, useState } from "react";
        import { createRoot } from "react-dom/client";
        import {
          TherapistSettingsProvider,
          useTherapistSettings,
        } from ${JSON.stringify(therapistModulePath)};
        import {
          SidebarCalendarProvider,
          useSidebarCalendarContext,
        } from ${JSON.stringify(calendarModulePath)};

        const harness = window.__specializedProviderHarness = {
          profileGets: 0,
          calendarGets: 0,
          profileTimeouts: [],
          calendarTimeouts: [],
          consumerCount: 0,
          passiveConsumerCount: null,
          practiceEnabled: false,
          practiceId: null,
          errors: [],
        };
        window.__specializedProviderBootstrap = {
          ownerKey: "inert-owner",
          syncEnabled: true,
        };
        window.addEventListener("error", (event) => {
          harness.errors.push(String(event.error || event.message));
        });
        window.addEventListener("unhandledrejection", (event) => {
          harness.errors.push(String(event.reason));
        });

        let setConsumerCount;
        let setPracticeEnabled;
        let resolveProfile;
        const jsonResponse = (value) => new Response(JSON.stringify(value), {
          status: 200,
          headers: { "content-type": "application/json" },
        });

        window.fetch = (input, init = {}) => {
          const pathname = new URL(String(input), "https://massagelab-specialized.test").pathname;
          const method = init.method || "GET";
          if (pathname === "/api/account/profile" && method === "GET") {
            harness.profileGets += 1;
            if (resolveProfile) {
              const message = "Duplicate synthetic profile request started before the pending request settled.";
              harness.errors.push(message);
              return Promise.reject(new Error(message));
            }
            return new Promise((resolve) => {
              resolveProfile = () => resolve(jsonResponse({
                therapistName: "Synthetic Therapist",
                therapistLocation: "Test Location",
                licenseNumber: "T-1",
                licenseOrganization: "Test Board",
                npiNumber: "1",
              }));
            });
          }
          if (pathname === "/api/calendar/sidebar-context" && method === "GET") {
            harness.calendarGets += 1;
            return Promise.resolve(jsonResponse({
              practice: { id: "practice-inert", name: "Inert Practice" },
              therapists: [],
              canManageAvailability: true,
              pendingAppointmentRequestCount: 0,
              openWaitlistEntryCount: 0,
            }));
          }
          const message = \`Unexpected synthetic request: \${method} \${pathname}\`;
          harness.errors.push(message);
          return Promise.reject(new Error(message));
        };

        function TherapistConsumer({ index }) {
          const { settings } = useTherapistSettings();
          return React.createElement("span", {
            "data-consumer": String(index),
            "data-name": settings.name,
          });
        }

        function CalendarProbe() {
          const { calendarContext } = useSidebarCalendarContext();
          harness.practiceId = calendarContext.practice?.id ?? null;
          return React.createElement("span", {
            "data-practice-id": harness.practiceId ?? "",
          });
        }

        function App() {
          const [consumerCount, updateConsumerCount] = useState(0);
          const [practiceEnabled, updatePracticeEnabled] = useState(false);
          setConsumerCount = updateConsumerCount;
          setPracticeEnabled = updatePracticeEnabled;
          harness.consumerCount = consumerCount;
          harness.practiceEnabled = practiceEnabled;
          // A parent passive effect runs after the provider subtree's passive effects,
          // giving the test an observable barrier for each consumer-count commit.
          useEffect(() => {
            harness.passiveConsumerCount = consumerCount;
          }, [consumerCount]);
          return React.createElement(
            TherapistSettingsProvider,
            null,
            React.createElement(
              SidebarCalendarProvider,
              { ownerKey: "inert-owner", enabled: practiceEnabled },
              ...Array.from({ length: consumerCount }, (_, index) => React.createElement(
                TherapistConsumer,
                { key: index, index },
              )),
              React.createElement(CalendarProbe),
            ),
          );
        }

        harness.setConsumerCount = (count) => setConsumerCount(count);
        harness.setPracticeEnabled = (enabled) => setPracticeEnabled(enabled);
        harness.resolveProfile = () => {
          if (!resolveProfile) throw new Error("The synthetic profile request has not started.");
          const pendingProfile = resolveProfile;
          resolveProfile = null;
          pendingProfile();
        };
        harness.read = () => ({
          profileGets: harness.profileGets,
          calendarGets: harness.calendarGets,
          profileTimeouts: [...harness.profileTimeouts],
          calendarTimeouts: [...harness.calendarTimeouts],
          consumerCount: harness.consumerCount,
          passiveConsumerCount: harness.passiveConsumerCount,
          practiceEnabled: harness.practiceEnabled,
          practiceId: harness.practiceId,
          consumerNames: Array.from(document.querySelectorAll("[data-consumer]"))
            .map((element) => element.dataset.name),
          errors: [...harness.errors],
        });

        createRoot(document.getElementById("root")).render(React.createElement(App));
      `)

      const webpack = require("next/dist/compiled/webpack/webpack").webpack
      await new Promise((resolve, reject) => {
        webpack({
          mode: "development",
          context: projectRoot,
          entry: entryPath,
          output: { path: outputRoot, filename: "fixture.js" },
          resolve: {
            extensions: [".js"],
            alias: {
              "@/components/providers/account-shell-bootstrap-provider": supportModulePath,
              "@/lib/client-fetch": supportModulePath,
              "@/lib/sidebar-calendar-context": supportModulePath,
            },
            modules: [path.join(projectRoot, "node_modules"), "node_modules"],
          },
        }, (error, stats) => {
          if (error) return reject(error)
          if (stats?.hasErrors()) {
            return reject(new Error(stats.toString({ errors: true, warnings: false })))
          }
          resolve()
        })
      })
      return readFileSync(path.join(outputRoot, "fixture.js"), "utf8")
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true })
    }
  })

/** Records every page error until disposal while exposing the first one for causal races. */
export function createPageErrorRecorder(page) {
  const errors = []
  let reportFirstError
  const firstError = new Promise((resolve) => {
    reportFirstError = resolve
  })
  const capture = (error) => {
    errors.push(error)
    if (errors.length === 1) reportFirstError(error)
  }
  let active = true
  page.on("pageerror", capture)

  return {
    errors,
    firstError,
    dispose() {
      if (!active) return
      active = false
      page.off("pageerror", capture)
    },
  }
}

/** Opens the isolated provider fixture and returns snapshots for each demand boundary. */
export async function exerciseSpecializedProviderHarness(page) {
  const fixtureUrl = "https://massagelab-specialized.test/fixture"
  const fulfillFixture = (route) => route.fulfill({
    status: 200,
    contentType: "text/html",
    body: '<main id="root"></main>',
  })
  await page.route(fixtureUrl, fulfillFixture)
  try {
    await page.goto(fixtureUrl)
  } finally {
    await page.unroute(fixtureUrl, fulfillFixture)
  }
  const pageErrors = createPageErrorRecorder(page)
  const firstPageErrorFailure = pageErrors.firstError.then((error) => { throw error })
  const awaitOrPageError = async (operation, phase) => {
    if (pageErrors.errors.length > 0) throw pageErrors.errors[0]
    try {
      const result = await Promise.race([firstPageErrorFailure, operation])
      if (pageErrors.errors.length > 0) throw pageErrors.errors[0]
      return result
    } catch (error) {
      if (pageErrors.errors.length <= 1 || !pageErrors.errors.includes(error)) throw error
      throw new AggregateError(
        [...pageErrors.errors],
        `Specialized provider harness captured page errors during ${phase}`,
        { cause: pageErrors.errors[0] },
      )
    }
  }
  try {
    await awaitOrPageError(
      (async () => {
        await page.addScriptTag({ content: await specializedProviderBundle() })
        await page.waitForFunction(() => {
          const state = window.__specializedProviderHarness?.read?.()
          return state && (state.errors.length > 0 || state.passiveConsumerCount === 0)
        })
      })(),
      "mount",
    )

    const read = () => page.evaluate(() => window.__specializedProviderHarness.read())
    const readHealthySnapshot = async (phase) => {
      const snapshot = await awaitOrPageError(read(), phase)
      if (snapshot.errors.length > 0) {
        throw new Error(
          `Specialized provider harness captured browser errors during ${phase}: ${snapshot.errors.join(" | ")}`,
        )
      }
      return snapshot
    }
    const mounted = await readHealthySnapshot("mount")

    await awaitOrPageError(
      page.evaluate(() => window.__specializedProviderHarness.setConsumerCount(1)),
      "first consumer update",
    )
    await awaitOrPageError(page.waitForFunction(() => {
      const state = window.__specializedProviderHarness.read()
      return state.errors.length > 0 || (state.passiveConsumerCount === 1 && state.profileGets === 1)
    }), "first consumer")
    const firstConsumer = await readHealthySnapshot("first consumer")

    await awaitOrPageError(
      page.evaluate(() => window.__specializedProviderHarness.setConsumerCount(2)),
      "concurrent consumer update",
    )
    await awaitOrPageError(page.waitForFunction(() => {
      const state = window.__specializedProviderHarness.read()
      return state.errors.length > 0 || (
        state.passiveConsumerCount === 2 && state.consumerNames.length === 2
      )
    }), "concurrent consumer")
    const concurrentConsumer = await readHealthySnapshot("concurrent consumer")

    await awaitOrPageError(
      page.evaluate(() => window.__specializedProviderHarness.resolveProfile()),
      "profile resolution",
    )
    await awaitOrPageError(page.waitForFunction(() => {
      const state = window.__specializedProviderHarness.read()
      return state.errors.length > 0 || (
        state.consumerNames.length === 2
        && state.consumerNames.every((name) => name === "Synthetic Therapist")
      )
    }), "profile hydration")
    const hydrated = await readHealthySnapshot("profile hydration")

    await awaitOrPageError(
      page.evaluate(() => window.__specializedProviderHarness.setPracticeEnabled(true)),
      "practice enablement",
    )
    await awaitOrPageError(page.waitForFunction(() => {
      const state = window.__specializedProviderHarness.read()
      return state.errors.length > 0 || (
        state.calendarGets === 1 && state.practiceId === "practice-inert"
      )
    }), "practice hydration")
    const practiceEnabled = await readHealthySnapshot("practice hydration")
    const snapshots = { mounted, firstConsumer, concurrentConsumer, hydrated, practiceEnabled }

    return snapshots
  } finally {
    pageErrors.dispose()
  }
}
