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
let bundlePromise

/**
 * Bundles the real specialized shell providers with only owner-bootstrap and fetch adapters
 * replaced by inert browser doubles. No application route, account, or provider is contacted.
 */
function specializedProviderBundle() {
  if (bundlePromise) return bundlePromise

  bundlePromise = (async () => {
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

      writeFileSync(
        therapistModulePath,
        ts.transpileModule(await readFile(therapistProviderPath, "utf8"), { compilerOptions })
          .outputText,
      )
      writeFileSync(
        calendarModulePath,
        ts.transpileModule(await readFile(calendarProviderPath, "utf8"), { compilerOptions })
          .outputText,
      )
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
        export async function fetchJsonWithTimeout(input, init) {
          const response = await fetch(input, init);
          return { response, json: response.ok ? await response.json() : undefined };
        }
        export function fetchWithTimeout(input, init) {
          return fetch(input, init);
        }
      `)
      writeFileSync(entryPath, `
        import React, { useState } from "react";
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
          consumerCount: 0,
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
          return Promise.resolve(jsonResponse({ ok: true }));
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
          resolveProfile();
        };
        harness.read = () => ({
          profileGets: harness.profileGets,
          calendarGets: harness.calendarGets,
          consumerCount: harness.consumerCount,
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
  })()

  return bundlePromise
}

/** Opens the isolated provider fixture and returns snapshots for each demand boundary. */
export async function exerciseSpecializedProviderHarness(page) {
  await page.route("https://massagelab-specialized.test/fixture", (route) => route.fulfill({
    status: 200,
    contentType: "text/html",
    body: '<main id="root"></main>',
  }))
  await page.goto("https://massagelab-specialized.test/fixture")
  await page.addScriptTag({ content: await specializedProviderBundle() })
  await page.waitForFunction(() => (
    window.__specializedProviderHarness?.read().consumerCount === 0
  ))
  await page.waitForTimeout(50)

  const read = () => page.evaluate(() => window.__specializedProviderHarness.read())
  const mounted = await read()

  await page.evaluate(() => window.__specializedProviderHarness.setConsumerCount(1))
  await page.waitForFunction(() => {
    const state = window.__specializedProviderHarness.read()
    return state.consumerCount === 1 && state.profileGets === 1
  })
  const firstConsumer = await read()

  await page.evaluate(() => window.__specializedProviderHarness.setConsumerCount(2))
  await page.waitForFunction(() => (
    window.__specializedProviderHarness.read().consumerCount === 2
  ))
  await page.waitForTimeout(50)
  const concurrentConsumer = await read()

  await page.evaluate(() => window.__specializedProviderHarness.resolveProfile())
  await page.waitForFunction(() => {
    const names = window.__specializedProviderHarness.read().consumerNames
    return names.length === 2 && names.every((name) => name === "Synthetic Therapist")
  })
  const hydrated = await read()

  await page.evaluate(() => window.__specializedProviderHarness.setPracticeEnabled(true))
  await page.waitForFunction(() => {
    const state = window.__specializedProviderHarness.read()
    return state.calendarGets === 1 && state.practiceId === "practice-inert"
  })
  const practiceEnabled = await read()

  return { mounted, firstConsumer, concurrentConsumer, hydrated, practiceEnabled }
}
