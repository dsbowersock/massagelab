import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

const licenseUrl = new URL("../LICENSE", import.meta.url)

describe("proprietary repository licensing", () => {
  it("keeps every public repository surface explicitly proprietary", async () => {
    assert.equal(existsSync(licenseUrl), true, "root LICENSE must exist")

    const [license, readme, packageText, sidebar] = await Promise.all([
      readFile(licenseUrl, "utf8"),
      readFile(new URL("../README.md", import.meta.url), "utf8"),
      readFile(new URL("../package.json", import.meta.url), "utf8"),
      readFile(new URL("../components/sidebar/app-sidebar-client.tsx", import.meta.url), "utf8"),
    ])
    const packageJson = JSON.parse(packageText)

    assert.match(license, /^MassageLab Proprietary License$/m)
    assert.match(
      license,
      /Copyright © 2025–2026 Derrick Bowersock, doing business as Massage Lab\. All rights reserved\./,
    )
    assert.match(license, /source-visible proprietary software/i)
    assert.match(license, /not open-source software/i)
    assert.match(license, /without prior written permission/i)
    assert.match(license, /third-party/i)
    assert.match(license, /provided "AS IS"/i)

    assert.match(
      readme,
      /MassageLab is source-visible proprietary software, not open-source software\./,
    )
    assert.match(readme, /\[LICENSE\]\(LICENSE\)/)
    assert.equal(packageJson.license, "UNLICENSED")

    assert.match(sidebar, /function ProprietaryCopyrightNotice/)
    assert.match(
      sidebar,
      /© 2025–2026 Derrick Bowersock, d\/b\/a Massage Lab\. All rights reserved\./,
    )
    assert.match(
      sidebar,
      /ProprietaryCopyrightNotice className="group-data-\[collapsible=icon\]:hidden"/,
    )
    assert.equal(
      sidebar.match(/<ProprietaryCopyrightNotice/g)?.length,
      2,
      "expanded compact and standard/drawer footers must render the notice",
    )
  })
})
