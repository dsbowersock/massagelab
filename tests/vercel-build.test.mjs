import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { getVercelBuildSteps } from "../scripts/vercel-build.mjs"

describe("Vercel build plan", () => {
  it("runs the exact GET-only live readiness check before a Production build", () => {
    assert.deepEqual(getVercelBuildSteps({ VERCEL_ENV: "production" }), [
      {
        label: "Production Stripe readiness",
        args: [
          "run",
          "stripe:readiness",
          "--",
          "--live",
          "--verify-stripe",
          "--no-dotenv",
        ],
      },
      {
        label: "application build",
        args: ["run", "build"],
      },
    ])
  })

  for (const vercelEnvironment of ["preview", "development", undefined]) {
    it(`keeps the normal build unchanged for ${vercelEnvironment ?? "local"} execution`, () => {
      assert.deepEqual(
        getVercelBuildSteps({ VERCEL_ENV: vercelEnvironment }),
        [
          {
            label: "application build",
            args: ["run", "build"],
          },
        ],
      )
    })
  }
})
