import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { withSentryConfig } from "@sentry/nextjs"
import { assertBrowserQaTelemetryEnvironment } from "./scripts/browser-qa-environment.mjs"

const root = dirname(fileURLToPath(import.meta.url))
const migrationParityBuild = process.env.ATMOSHAPER_MIGRATION_PARITY === "1"
const browserQaBuild = process.env.NEXT_PUBLIC_ATMOSHAPER_BROWSER_QA === "1"
// Fail before compilation/provider hooks: NEXT_PUBLIC values are inlined into
// browser bundles, so disabling Sentry only in the later server cannot suffice.
if (browserQaBuild || migrationParityBuild) assertBrowserQaTelemetryEnvironment(process.env, {
  label: migrationParityBuild ? "Migration parity build" : "Browser QA build",
})
const buildCpuOverride = Number.parseInt(process.env.NEXT_BUILD_CPUS ?? (process.env.CI ? "" : "4"), 10)
// Resolve the real diagnostics owner only while producing the isolated QA artifact;
// ordinary builds cannot emit its globals or injected-failure strings.
const atmoShaperBrowserQaEnabled = process.env.NEXT_PUBLIC_ATMOSHAPER_BROWSER_QA === "1"
const atmoShaperBrowserQaModule = atmoShaperBrowserQaEnabled
  ? "./lib/atmoshaper/browser-qa.ts"
  : "./lib/atmoshaper/browser-qa-disabled.ts"
// Browser-QA child builds set this public build-time flag to expose the
// content-free proof route and select the instrumented RSC session loader;
// ordinary production builds leave both disabled.
const rscSessionProofEnabled = process.env.NEXT_PUBLIC_RSC_SESSION_PROOF === "1"

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  ...(buildCpuOverride > 0 ? { experimental: { cpus: buildCpuOverride } } : {}),
  async headers() {
    return [
      {
        source: "/brand/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
        ],
      },
      {
        source: "/icons/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self'",
          },
        ],
      },
    ]
  },
  async rewrites() {
    return {
      beforeFiles: rscSessionProofEnabled
        ? []
        : [{ source: "/dev/rsc-session-proof", destination: "/_not-found" }],
      afterFiles: [],
      fallback: [],
    }
  },
  turbopack: {
    root,
    resolveAlias: {
      "@/lib/atmoshaper/browser-qa": atmoShaperBrowserQaModule,
      "regenerator-runtime/runtime.js": "./lib/atmosphere/regenerator-runtime-shim.js",
      tone: "tone/build/esm/index.js",
    },
  },
  webpack(config) {
    config.resolve.alias["@/lib/atmoshaper/browser-qa"] = resolve(root, atmoShaperBrowserQaModule)
    return config
  },
}

export default withSentryConfig(nextConfig, {
  // The build plugin has its own telemetry DSN, independent of the app DSN.
  ...(migrationParityBuild || browserQaBuild ? { telemetry: false } : {}),
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: browserQaBuild ? "" : process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
})
