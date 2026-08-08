import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

const licenseUrl = new URL("../LICENSE", import.meta.url)

describe("proprietary repository licensing", () => {
  it("keeps every public repository surface explicitly proprietary", async () => {
    assert.equal(existsSync(licenseUrl), true, "root LICENSE must exist")

    const [license, readme, packageText, packageLockText, sidebar] = await Promise.all([
      readFile(licenseUrl, "utf8"),
      readFile(new URL("../README.md", import.meta.url), "utf8"),
      readFile(new URL("../package.json", import.meta.url), "utf8"),
      readFile(new URL("../package-lock.json", import.meta.url), "utf8"),
      readFile(new URL("../components/sidebar/app-sidebar-client.tsx", import.meta.url), "utf8"),
    ])
    const packageJson = JSON.parse(packageText)
    const packageLock = JSON.parse(packageLockText)

    assert.match(license, /^MassageLab Proprietary License$/m)
    assert.match(
      license,
      /Copyright © 2025–2026 Derrick Bowersock, doing business as Massage Lab\. All rights reserved\./,
    )
    assert.match(license, /source-visible proprietary software/i)
    assert.match(license, /not open-source software/i)
    assert.match(license, /without prior written permission/i)
    assert.match(
      license,
      /Use of the hosted MassageLab application is governed by MassageLab's applicable user-facing terms and policies/,
    )
    assert.match(
      license,
      /Nothing in this license limits rights granted by those third-party licenses or claims ownership of third-party materials/,
    )
    assert.match(license, /provided "AS IS"/i)

    assert.match(
      readme,
      /MassageLab is source-visible proprietary software, not open-source software\./,
    )
    assert.match(
      readme,
      /Copyright © 2025–2026 Derrick Bowersock, doing business as Massage Lab\. All rights reserved\./,
    )
    assert.match(
      readme,
      /Public access to this repository does not grant permission to reuse, modify, or redistribute MassageLab-owned source code or assets/,
    )
    assert.match(readme, /\[LICENSE\]\(LICENSE\)/)
    assert.equal(packageJson.license, "UNLICENSED")
    assert.equal(packageLock.packages[""].license, "UNLICENSED")

    assert.match(sidebar, /function ProprietaryCopyrightNotice/)
    assert.match(
      sidebar,
      /© 2025–2026 Derrick Bowersock, d\/b\/a Massage Lab\. All rights reserved\./,
    )
    assert.match(
      sidebar,
      /ProprietaryCopyrightNotice className="group-data-\[collapsible=icon\]:hidden"/,
    )
    assert.match(
      sidebar,
      /<div\s+className=\{cn\(\s*"hidden min-h-0 flex-col p-2 group-data-\[state=expanded\]:flex"[\s\S]*?<ProprietaryCopyrightNotice \/>\s*<\/div>\s*<\/div>\s*<\/SidebarContent>/,
      "compact notice must remain inside the expanded compact-landscape footer column",
    )
    assert.equal(
      sidebar.match(/<ProprietaryCopyrightNotice/g)?.length,
      2,
      "expanded compact and standard/drawer footers must render the notice",
    )
  })
})
