import { spawnSync } from "node:child_process"

/** Builds the isolated client artifact whose module aliases include browser-QA hooks. */
const result = spawnSync(process.execPath, ["--run", "build:next"], {
  env: {
    ...process.env,
    NEXT_PUBLIC_ATMOSHAPER_BROWSER_QA: "1",
  },
  stdio: "inherit",
})

if (result.error) throw result.error
process.exitCode = result.status ?? 1
