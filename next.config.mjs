import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { withSentryConfig } from "@sentry/nextjs"

const root = dirname(fileURLToPath(import.meta.url))
const buildCpuOverride = Number.parseInt(process.env.NEXT_BUILD_CPUS ?? (process.env.CI ? "" : "4"), 10)
// Resolve the real diagnostics owner only while producing the isolated QA artifact;
// ordinary builds cannot emit its globals or injected-failure strings.
const atmoShaperBrowserQaEnabled = process.env.NEXT_PUBLIC_ATMOSHAPER_BROWSER_QA === "1"
const atmoShaperBrowserQaModule = atmoShaperBrowserQaEnabled
  ? "./lib/atmoshaper/browser-qa.ts"
  : "./lib/atmoshaper/browser-qa-disabled.ts"

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
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
})
