# Proprietary Repository Licensing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Status:** Completed on 2026-08-08. Steps 1–10 record the finalized implementation workflow. The embedded contract test reflects its final post-review form; package-lock synchronization, canonical-state documentation, helper documentation, and stronger assertions remain separate follow-up commits and do not change the initial implementation commit boundary.

**Goal:** Make the public MassageLab repository unambiguously source-visible proprietary software across its root license, README, package metadata, and shared application footer.

**Architecture:** One focused source-contract test will lock the complete repository posture before implementation. The implementation adds a standalone proprietary `LICENSE`, concise README and package declarations, and one reusable static copyright notice rendered in the existing shared sidebar footer surfaces without changing application behavior or immersive layouts.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, Node.js test runner, npm

## Global Constraints

- The legal owner is `Derrick Bowersock, doing business as Massage Lab`; do not include `LMT`.
- The full notice is `Copyright © 2025–2026 Derrick Bowersock, doing business as Massage Lab. All rights reserved.`
- The compact footer notice is `© 2025–2026 Derrick Bowersock, d/b/a Massage Lab. All rights reserved.`
- MassageLab must be described as `source-visible proprietary software` and `not open-source software`.
- Keep the GitHub repository public and do not change CodeRabbit configuration.
- Preserve all third-party licenses and attribution; do not claim MassageLab ownership of third-party code, media, fonts, or assets.
- Hosted-application use remains governed by MassageLab's user-facing terms, not by repository access.
- Set the exact package metadata value to `"license": "UNLICENSED"`.
- Do not change legal pages, purchase licenses, repository visibility, or per-file source headers.
- Preserve the existing collapsed sidebar and immersive Chimer/Clock viewport behavior.
- Work only in the isolated `codex/proprietary-licensing` worktree; do not touch the original background-preview checkout or its untracked image.

---

## File Responsibility Map

- Create `LICENSE`: authoritative proprietary repository terms, ownership notice, third-party boundary, and warranty/liability disclaimer.
- Modify `README.md`: concise public explanation of the source-visible proprietary posture with a link to `LICENSE`.
- Modify `package.json` and `package-lock.json`: npm ecosystem signal that the package is unlicensed for reuse, synchronized across both manifests.
- Modify `components/sidebar/app-sidebar-client.tsx`: reusable static notice and placement in the existing expanded/drawer footer surfaces.
- Create `tests/proprietary-license.test.mjs`: one source-contract test covering every requested licensing surface and collapsed-sidebar safeguard.
- Modify `docs/project-state.md` and `docs/project-log.md`: mirror the completed legal posture into the canonical current state and chronological history.
- Modify `docs/superpowers/specs/2026-08-07-proprietary-repository-licensing-design.md`: retain the already-approved status; no further content changes are expected during implementation.

### Task 1: Establish and Implement the Proprietary Repository Contract

**Files:**
- Create: `tests/proprietary-license.test.mjs`
- Create: `LICENSE`
- Modify: `README.md:60-62`
- Modify: `package.json:1-7`
- Modify: `package-lock.json:7-11`
- Modify: `components/sidebar/app-sidebar-client.tsx:85-96, 777-800`
- Modify: `docs/project-state.md`
- Modify: `docs/project-log.md`

**Interfaces:**
- Consumes: the existing `cn(...classes)` helper and `SidebarFooter` responsive group attributes; no runtime data or new dependency is required.
- Produces: a local `ProprietaryCopyrightNotice({ className?: string }): React.JSX.Element` render helper. No exported API, persistence, route, environment variable, or network behavior is added.

- [x] **Step 1: Write the failing repository contract test**

The embedded test below is the final post-review contract. It supersedes the narrower RED-stage draft while retaining the same first expected failure (`root LICENSE must exist`) when run before implementation.

Create `tests/proprietary-license.test.mjs` with this final contract:

```js
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
```

- [x] **Step 2: Run the focused test and verify the red state**

Run:

```powershell
node --test tests/proprietary-license.test.mjs
```

Expected: `FAIL` with the assertion message `root LICENSE must exist`. The test must fail as an assertion because the requested repository contract is absent, not because of a syntax or import error.

- [x] **Step 3: Add the root proprietary license**

Create `LICENSE` with this exact content:

```text
MassageLab Proprietary License

Copyright © 2025–2026 Derrick Bowersock, doing business as Massage Lab. All rights reserved.

MassageLab is source-visible proprietary software and is not open-source software. Public availability of this repository permits inspection through the hosting platform but does not grant a license to use, copy, modify, merge, publish, distribute, sublicense, sell, or create derivative works from MassageLab-owned source code, documentation, media, or other content.

Except for rights necessarily provided by the hosting platform's terms and rights expressly permitted by applicable law, you may not use, copy, modify, merge, publish, distribute, sublicense, sell, or create derivative works from MassageLab-owned content in this repository without prior written permission from the copyright owner.

Use of the hosted MassageLab application is governed by MassageLab's applicable user-facing terms and policies, not by access to this repository.

Third-party libraries, code, media, fonts, and other materials incorporated into or referenced by this repository remain governed by their respective license terms. Nothing in this license limits rights granted by those third-party licenses or claims ownership of third-party materials.

THE SOFTWARE AND MASSAGELAB-OWNED CONTENT ARE PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NONINFRINGEMENT. IN NO EVENT SHALL THE COPYRIGHT OWNER BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY ARISING FROM, OUT OF, OR IN CONNECTION WITH THE SOFTWARE OR MASSAGELAB-OWNED CONTENT OR THEIR USE.
```

- [x] **Step 4: Replace the provisional README notice and set package metadata**

Replace the existing `README.md` `License` paragraph with:

```markdown
Copyright © 2025–2026 Derrick Bowersock, doing business as Massage Lab. All rights reserved.

MassageLab is source-visible proprietary software, not open-source software. Public access to this repository does not grant permission to reuse, modify, or redistribute MassageLab-owned source code or assets. See [LICENSE](LICENSE) for the complete terms.
```

Add the top-level field directly below `"private": true` in `package.json`, and synchronize the same root package metadata in `package-lock.json` under `packages[""]`:

```json
"license": "UNLICENSED",
```

- [x] **Step 5: Add the reusable shared-footer notice**

Add this local helper after the `SidebarUser` type in `components/sidebar/app-sidebar-client.tsx`:

```tsx
/**
 * Renders the shared ownership notice for both sidebar footer surfaces.
 * Callers control collapsed-state visibility through `className`.
 */
function ProprietaryCopyrightNotice({ className }: { className?: string }): React.JSX.Element {
  return (
    <p
      className={cn(
        "px-2 py-1 text-[0.6875rem] leading-relaxed text-sidebar-foreground/60",
        className,
      )}
    >
      © 2025–2026 Derrick Bowersock, d/b/a Massage Lab. All rights reserved.
    </p>
  )
}
```

In the expanded compact-landscape secondary column, render the notice after `AccountMenu`:

```tsx
<div className="flex flex-col gap-2">
  <NavSecondary pathname={pathname} secondaryRoutes={navigation.secondaryNavigationRoutes} compact />
  <AccountMenu accountRoutes={navigation.accountMenuRoutes} user={user} pathname={pathname} compact />
  <ProprietaryCopyrightNotice />
</div>
```

In the standard `SidebarFooter`, render the notice after `AccountMenu` and hide it only when the desktop sidebar is collapsed to its icon rail:

```tsx
<SidebarFooter className={cn(isDrawer && "gap-2 border-t border-sidebar-border")}>
  <NavSecondary pathname={pathname} secondaryRoutes={navigation.secondaryNavigationRoutes} />
  <AccountMenu accountRoutes={navigation.accountMenuRoutes} user={user} pathname={pathname} />
  <ProprietaryCopyrightNotice className="group-data-[collapsible=icon]:hidden" />
</SidebarFooter>
```

Do not add the notice to the compact-landscape collapsed `SidebarFooter`; that surface is intentionally icon-only. The mobile drawer does not set the desktop `group` or `data-collapsible="icon"` state, so the standard footer notice remains visible there.

- [x] **Step 6: Run the focused test and verify the green state**

Run:

```powershell
node --test tests/proprietary-license.test.mjs
```

Expected: `1` test passes, `0` fail.

- [x] **Step 7: Run the full repository unit suite**

Run:

```powershell
npm test
```

Expected: all tests pass. The clean baseline was `2,102` passed, `0` failed, and `1` skipped before the new licensing test, so the expected post-change total is `2,103` passed, `0` failed, and `1` skipped unless unrelated upstream tests change.

- [x] **Step 8: Run static validation separately**

Run:

```powershell
npm run typecheck
```

Expected: exit code `0` with no TypeScript errors.

Then run:

```powershell
npm run lint
```

Expected: exit code `0` with no ESLint errors.

- [x] **Step 9: Review the initial implementation cohort and whitespace gate**

Run:

```powershell
git add -N -- LICENSE tests/proprietary-license.test.mjs
git diff --check
git status --short
git diff -- LICENSE README.md package.json components/sidebar/app-sidebar-client.tsx tests/proprietary-license.test.mjs
```

Expected: `git diff --check` exits `0`; only the five initial implementation files are uncommitted; the diff contains no repository-visibility, legal-page, purchase-license, CodeRabbit, attribution, or immersive-layout changes. Review follow-up files listed in the completed status above are handled in later commits.

- [x] **Step 10: Commit the verified initial implementation cohort**

```powershell
git add -- LICENSE README.md package.json components/sidebar/app-sidebar-client.tsx tests/proprietary-license.test.mjs
git commit -m "Add proprietary repository licensing"
```

Expected: one initial implementation commit containing only the five approved implementation files. Keep the previously committed design spec and implementation plan as separate documentation history; retain any review-driven refinements in later commits.
