# Mobile Visual Panel and Render Lifecycle Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the dirty-Visual confirmation usable over the phone Visual dock and release the selected live background renderer while the opaque full-screen picker covers it.

**Architecture:** Keep `RunningTimer` as the owner of selected background ID, Visual draft, and pending intent. Add an explicit modal interlock from that owner to `ImmersivePanelShell`, so its nonmodal document listeners do not consume pointer or Escape events while the Radix AlertDialog owns the interaction. Raise only this confirmation dialog and its overlay above the immersive shell through an opt-in `AlertDialogContent` overlay-class contract. Separately, derive picker coverage from `activePanel === "background"` and conditionally unmount the live `BackgroundHost`; closing the picker remounts the same host from the unchanged parent-owned ID, palette, and settings.

**Tech Stack:** Next.js App Router, React 19, TypeScript, CSS Modules and Tailwind utility classes, Radix AlertDialog/Dialog, Node test runner, Playwright.

## Global Constraints

- Do not generate, replace, upload, delete, or modify preview media, preview assets, preview manifests, or preview rendering scripts.
- Preserve the approved naming audit; do not change background names, IDs, catalog order, selected IDs, or persisted visual settings.
- Phone-first browser coverage is required, including the configured `mobile-chromium` Playwright project.
- Preserve reduced-motion behavior and the existing accessible focus contracts.
- This slice leaves the picker’s current preview playback implementation unchanged. A later adaptive preview runtime owns the approved playback contract: the center preview plus the two positions on either side may play (five positions total).
- Keep the Background picker’s existing visual design and full-screen behavior unchanged.
- Add useful JSDoc/comments for non-obvious shared helpers and modal/lifecycle decisions; do not add comments that merely restate JSX or CSS.
- Do not add a Prisma migration, storage version, dependency, route, entitlement change, account-preference write, or media manifest change.

---

## File Structure

- `components/ui/alert-dialog.tsx` — keep the shared AlertDialog default at its existing app-wide layer while exposing a typed, opt-in overlay class for the one confirmation that must sit above immersive chrome.
- `app/chimer/unsaved-visual-changes-dialog.tsx` — use the opt-in high layer for both the confirmation content and its blocking overlay; retain the three explicit outcomes and captured-focus restoration.
- `app/chimer/immersive-panel-shell.tsx` — accept one owner-controlled `modalInterlockActive` boolean and suspend its nonmodal outside-pointer/Escape listeners while a nested modal is open.
- `app/chimer/running-timer.tsx` — derive the modal interlock from `pendingVisualIntent`; derive selected-renderer suspension from `activePanel === "background"`, without mutating selected ID, draft, or settings.
- `tests/background-visual-draft.test.mjs` — assert the confirmation component’s explicit outcomes, high-layer request, and focus-restoration contract.
- `tests/immersive-panel-shell.test.mjs` — assert the typed shell interlock and the Background-picker renderer-suspension boundary.
- `tests/browser/immersive-panel-shell.spec.ts` — exercise both behaviors at phone width using the actual accessible Clock/Visual/Background controls.

No preview-media component, carousel component, catalog/registry, asset directory, manifest, or preview-generation script is part of this plan.

---

### Task 1: Put the dirty-Visual confirmation above the immersive dock and isolate its input

**Files:**

- Modify: `components/ui/alert-dialog.tsx:30-46`
- Modify: `app/chimer/unsaved-visual-changes-dialog.tsx:18-93`
- Modify: `app/chimer/immersive-panel-shell.tsx:27-51,455-491`
- Modify: `app/chimer/running-timer.tsx:13255-13267`
- Modify: `tests/background-visual-draft.test.mjs:42,1200-1265`
- Modify: `tests/immersive-panel-shell.test.mjs:72-108`
- Modify: `tests/browser/immersive-panel-shell.spec.ts` after the existing `Clock and Visual switch one active panel and honor dismissal focus` test

**Interfaces:**

- Consumes: `pendingVisualIntent: PendingVisualIntent | null` in `RunningTimer`; `AlertDialogContent` currently accepts normal Radix content props; `UnsavedVisualChangesDialog` already receives `restoreFocusTarget: HTMLElement | null`.
- Produces: `AlertDialogContentProps` with `overlayClassName?: string`; `ImmersivePanelShellProps.modalInterlockActive?: boolean`; a phone-visible `role="alertdialog"` whose content and overlay both stack above `--immersive-global-chrome-z: 10030`.
- Behavioral contract: while `modalInterlockActive` is true, the Visual dock’s document-level `pointerdown` and `Escape` listeners are absent. Radix AlertDialog therefore receives its normal pointer/Escape behavior, and `onCloseAutoFocus` restores the previously captured connected Visual control after **Keep editing** or Escape.

- [ ] **Step 1: Add failing source-contract tests for the opt-in stack layer and modal interlock**

  In `tests/background-visual-draft.test.mjs`, load the shared alert-dialog source next to the existing `unsavedDialogSource`, then add this test:

  ```js
  const alertDialogSource = await read("components/ui/alert-dialog.tsx")

  test("unsaved Visual confirmation raises both dialog layers above immersive chrome", () => {
    assert.match(alertDialogSource, /type AlertDialogContentProps =[\s\S]*overlayClassName\?: string/)
    assert.match(alertDialogSource, /<AlertDialogOverlay className=\{overlayClassName\} \/>/)
    assert.match(unsavedDialogSource, /overlayClassName="z-\[10060\]"/)
    assert.match(unsavedDialogSource, /className="z-\[10060\]"/)
    assert.match(unsavedDialogSource, /onCloseAutoFocus/)
    assert.match(unsavedDialogSource, /getConnectedVisualFocusTarget\(restoreFocusTarget\)\?\.focus\(\)/)
  })
  ```

  In `tests/immersive-panel-shell.test.mjs`, add this test:

  ```js
  test("defers Visual dock pointer and Escape dismissal while its owner has a modal intent", () => {
    assert.match(shellSource, /modalInterlockActive\?: boolean/)
    assert.match(shellSource, /if \(!nonmodalPanel \|\| modalInterlockActive\) \{\s*return\s*\}/)
    assert.match(runningTimerSource, /modalInterlockActive=\{Boolean\(pendingVisualIntent\)\}/)
  })
  ```

- [ ] **Step 2: Run the focused tests and verify they fail before implementation**

  Run:

  ```powershell
  node --test tests/background-visual-draft.test.mjs tests/immersive-panel-shell.test.mjs
  ```

  Expected: FAIL because `AlertDialogContentProps`, `overlayClassName`, `modalInterlockActive`, and the RunningTimer prop are not present.

- [ ] **Step 3: Add the typed opt-in overlay class to the shared AlertDialog primitive**

  In `components/ui/alert-dialog.tsx`, insert this type immediately before `AlertDialogContent` and destructure the new prop so it is never spread onto Radix `Content`:

  ```tsx
  type AlertDialogContentProps = React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content> & {
    /** Adds a caller-owned layer class to the matching blocking overlay. */
    overlayClassName?: string
  }

  const AlertDialogContent = React.forwardRef<
    React.ElementRef<typeof AlertDialogPrimitive.Content>,
    AlertDialogContentProps
  >(({ className, overlayClassName, ...props }, ref) => (
    <AlertDialogPortal>
      <AlertDialogOverlay className={overlayClassName} />
      <AlertDialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
          className,
        )}
        {...props}
      />
    </AlertDialogPortal>
  ))
  ```

  Keep the existing `z-50` defaults untouched: ordinary AlertDialogs must retain their established layer. The short JSDoc explains why the new prop exists and makes clear that it styles the paired overlay.

- [ ] **Step 4: Raise only the Visual confirmation’s two layers**

  In `app/chimer/unsaved-visual-changes-dialog.tsx`, replace the opening content element with:

  ```tsx
  <AlertDialogContent
    className="z-[10060]"
    overlayClassName="z-[10060]"
    onCloseAutoFocus={(event) => {
      event.preventDefault()
      window.requestAnimationFrame(() => {
        getConnectedVisualFocusTarget(restoreFocusTarget)?.focus()
      })
    }}
  >
  ```

  Do not change the controlled `onOpenChange`, `explicitOutcomeRef`, Apply, Discard, or Keep editing callbacks. The dialog remains the only focus trap; the Visual dock remains nonmodal when this dialog is absent.

- [ ] **Step 5: Add the shell’s owner-controlled modal interlock**

  In `app/chimer/immersive-panel-shell.tsx`:

  1. Add `modalInterlockActive?: boolean` after `onRequestActivePanelChange` in `ImmersivePanelShellProps` with this JSDoc:

     ```tsx
     /**
      * Temporarily yields document-level nonmodal dismissal to a child modal
      * while its owner resolves a protected Visual draft action.
      */
     modalInterlockActive?: boolean
     ```

  2. Destructure `modalInterlockActive = false` in `ImmersivePanelShell`.
  3. Change the first guard in the nonmodal listener effect from `if (!nonmodalPanel) return` to:

     ```tsx
     if (!nonmodalPanel || modalInterlockActive) {
       return
     }
     ```

  4. Add `modalInterlockActive` to that effect’s dependency array.

  This removes the dock’s pointer/Escape listeners rather than attempting to guess which Radix portal received an event. It preserves existing `CHIMER_CONTROL_PORTAL_SELECTOR` handling when no confirmation is open.

- [ ] **Step 6: Wire the interlock from the only state owner**

  In `app/chimer/running-timer.tsx`, pass the modal state beside the existing panel callbacks:

  ```tsx
  <ImmersivePanelShell
    activePanel={activePanel}
    onActivePanelChange={handleActivePanelChange}
    onRequestActivePanelChange={handlePanelChangeRequest}
    modalInterlockActive={Boolean(pendingVisualIntent)}
    protectedDisplayRef={protectedDisplayRef}
    // existing props unchanged
  ```

  Use `pendingVisualIntent`, not `visualDraft?.dirty`: only an open confirmation needs to suspend dock listeners. A dirty dock continues to request confirmation normally.

- [ ] **Step 7: Run the focused source-contract tests and verify they pass**

  Run:

  ```powershell
  node --test tests/background-visual-draft.test.mjs tests/immersive-panel-shell.test.mjs
  ```

  Expected: PASS, including the existing explicit Apply/Discard/Keep behavior and Background default-outside-dismissal assertions.

- [ ] **Step 8: Add a phone-first browser regression for visibility, Escape isolation, and focus return**

  In `tests/browser/immersive-panel-shell.spec.ts`, add the following test after the existing Clock/Visual dismissal test. It uses the free clock context, so no account or entitlement fixture is needed:

  ```ts
  test("mobile dirty Visual confirmation owns Escape and returns focus to the close control", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chromium", "phone-first Visual dialog regression")
    await openClock(page)

    const visualControl = page.getByRole("button", { name: "Visual", exact: true })
    await visualControl.click()
    const visual = page.getByRole("dialog", { name: "Visual background controls" })
    await visual.getByRole("button", { name: "Custom", exact: true }).click()
    const closeVisual = page.getByRole("button", { name: "Close Visual panel" })
    await closeVisual.click()

    const confirmation = page.getByRole("alertdialog", { name: "Save Visual changes?" })
    await expect(confirmation).toBeVisible()
    await expect.poll(() => page.evaluate(() => {
      const alert = document.querySelector('[role="alertdialog"]')
      const shell = document.querySelector('[data-immersive-shell]')
      return {
        alertZ: Number.parseInt(getComputedStyle(alert!).zIndex, 10),
        shellZ: Number.parseInt(getComputedStyle(shell!).zIndex, 10),
      }
    })).toEqual({ alertZ: 10060, shellZ: 10030 })

    await page.keyboard.press("Escape")
    await expect(confirmation).toHaveCount(0)
    await expect(visual).toBeVisible()
    await expect(closeVisual).toBeFocused()
  })
  ```

- [ ] **Step 9: Run the exact browser regression on the configured phone project**

  Run:

  ```powershell
  npm run test:browser -- --project mobile-chromium -- tests/browser/immersive-panel-shell.spec.ts
  ```

  Expected: PASS. The confirmation is visible and actionable on a Pixel 7 viewport, Escape closes only the confirmation, the dirty Visual dock remains open, and focus returns to its close button.

- [ ] **Step 10: Commit the dialog remediation**

  ```powershell
  git add components/ui/alert-dialog.tsx app/chimer/unsaved-visual-changes-dialog.tsx app/chimer/immersive-panel-shell.tsx app/chimer/running-timer.tsx tests/background-visual-draft.test.mjs tests/immersive-panel-shell.test.mjs tests/browser/immersive-panel-shell.spec.ts
  git commit -m "fix: isolate unsaved visual confirmation"
  ```

---

### Task 2: Unmount the obscured live renderer while Background owns the full screen

**Files:**

- Modify: `app/chimer/running-timer.tsx:1515-1530,12443-12448`
- Modify: `tests/immersive-panel-shell.test.mjs` after the modal-interlock test from Task 1
- Modify: `tests/browser/immersive-panel-shell.spec.ts` after the Background modal test

**Interfaces:**

- Consumes: `activePanel: ImmersivePanelId`, `shouldRenderLiveBackground: boolean`, and the existing parent-owned `backgroundId`, `effectiveBackgroundPalette`, `effectiveDnaTwistedCubesHostProps`, and all renderer props.
- Produces: `shouldSuspendCoveredLiveBackground: boolean`, defined exactly as `activePanel === "background"`; `BackgroundHost` is absent only while the opaque full-screen picker is active, then remounts with the same `key={`${mode.context}:${backgroundId}`}` and existing props.
- Behavioral contract: opening Background must release the live DOM/canvas/WebGL renderer rather than merely setting `motionEnabled={false}`. Selecting a card, closing with the close button/Escape, reduced motion, background access, settings persistence, and the current picker preview playback implementation keep their existing behavior in this slice; the later adaptive runtime owns the approved center-plus-two-on-each-side playback contract.

- [ ] **Step 1: Add failing source-contract coverage for the renderer suspension boundary**

  In `tests/immersive-panel-shell.test.mjs`, add:

  ```js
  test("Background picker unmounts only the live renderer it fully covers", () => {
    assert.match(
      runningTimerSource,
      /const shouldSuspendCoveredLiveBackground = activePanel === "background"/,
    )
    assert.match(
      runningTimerSource,
      /shouldRenderLiveBackground && !shouldSuspendCoveredLiveBackground && \(\s*<BackgroundHost/,
    )
    assert.match(
      runningTimerSource,
      /key=\{`\$\{mode\.context\}:\$\{backgroundId\}`\}/,
    )
    assert.match(runningTimerSource, /active=\{activePanel === "background"\}/)
  })
  ```

  The final assertion guards the existing picker activation prop: this task must not redesign preview playback.

- [ ] **Step 2: Run the focused test and verify it fails before implementation**

  Run:

  ```powershell
  node --test tests/immersive-panel-shell.test.mjs
  ```

  Expected: FAIL because `shouldSuspendCoveredLiveBackground` does not exist and the host is currently rendered whenever `shouldRenderLiveBackground` is true.

- [ ] **Step 3: Add the narrowly scoped suspension derivation and conditional host mount**

  In `app/chimer/running-timer.tsx`, immediately after the existing `shouldRenderLiveBackground` declaration, add:

  ```tsx
  // Background is an opaque full-screen modal, so retain no hidden canvas/WebGL
  // renderer beneath it. The selected ID and all render settings remain in this
  // parent and are passed unchanged when closing remounts the host.
  const shouldSuspendCoveredLiveBackground = activePanel === "background"
  ```

  Change the live host opening from:

  ```tsx
  {shouldRenderLiveBackground && (
    <BackgroundHost
  ```

  to:

  ```tsx
  {shouldRenderLiveBackground && !shouldSuspendCoveredLiveBackground && (
    <BackgroundHost
  ```

  Do not change the host key, `motionEnabled`, selection/access/palette props, `BackgroundCarousel active={activePanel === "background"}`, carousel options, preview URLs, cards, fallback behavior, or Background dialog styles. Conditional unmount is required because `motionEnabled={false}` pauses CSS but retains canvas/WebGL allocations and animation work.

- [ ] **Step 4: Run the focused source-contract tests and verify they pass**

  Run:

  ```powershell
  node --test tests/immersive-panel-shell.test.mjs tests/music-visualizer-integration.test.mjs tests/background-preview-media.test.mjs
  ```

  Expected: PASS. The shared Music renderer remains owned by `RunningTimer`, and the preview-media test continues to cover the current preview implementation without this slice asserting a playback count or position set.

- [ ] **Step 5: Add a phone-first browser remount and selected-ID regression**

  In `tests/browser/immersive-panel-shell.spec.ts`, add this test after the existing Background modal test:

  ```ts
  test("mobile Background picker releases and safely remounts the covered live host", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chromium", "phone-first renderer lifecycle regression")
    await openClock(page)

    const host = page.getByTestId("background-host")
    const selectedId = await host.getAttribute("data-background-id")
    expect(selectedId).toBeTruthy()

    await page.getByRole("button", { name: "Background", exact: true }).click()
    const picker = page.getByRole("dialog", { name: "Background" })
    await expect(picker).toBeVisible()
    await expect(host).toHaveCount(0)
    await page.keyboard.press("Escape")
    await expect(picker).toHaveCount(0)
    await expect(host).toHaveAttribute("data-background-id", selectedId!)
  })
  ```

  This test intentionally closes without selecting a card. It proves the renderer remounts after the picker releases coverage and the chosen ID survived; it does not inspect WebGL internals, mutate local/account settings, or specify picker playback. The later adaptive preview runtime owns the approved five-playing-position behavior: center plus two positions on either side.

- [ ] **Step 6: Run the exact browser regression on the configured phone project**

  Run:

  ```powershell
  npm run test:browser -- --project mobile-chromium -- tests/browser/immersive-panel-shell.spec.ts
  ```

  Expected: PASS. While the full-screen picker is open there is no `[data-testid="background-host"]`; after Escape the same selected ID remounts. This lifecycle slice does not assert the number of mounted or playing picker previews.

- [ ] **Step 7: Commit the renderer lifecycle remediation**

  ```powershell
  git add app/chimer/running-timer.tsx tests/immersive-panel-shell.test.mjs tests/browser/immersive-panel-shell.spec.ts
  git commit -m "fix: release covered background renderer"
  ```

---

### Task 3: Run slice-level safeguards before handoff

**Files:**

- Verify only: `components/ui/alert-dialog.tsx`
- Verify only: `app/chimer/unsaved-visual-changes-dialog.tsx`
- Verify only: `app/chimer/immersive-panel-shell.tsx`
- Verify only: `app/chimer/running-timer.tsx`
- Verify only: `tests/background-visual-draft.test.mjs`
- Verify only: `tests/immersive-panel-shell.test.mjs`
- Verify only: `tests/browser/immersive-panel-shell.spec.ts`

**Interfaces:**

- Consumes: completed Task 1 and Task 2 changes.
- Produces: evidence that the two narrow remediations compile, preserve existing renderer/preview contracts, and work at phone width without media mutations.

- [ ] **Step 1: Run all focused Node tests together**

  Run:

  ```powershell
  node --test tests/background-visual-draft.test.mjs tests/immersive-panel-shell.test.mjs tests/music-visualizer-integration.test.mjs tests/background-preview-media.test.mjs
  ```

  Expected: PASS with no assertions that name a preview manifest, media asset, or changed catalog ID.

- [ ] **Step 2: Typecheck and lint the implementation**

  Run:

  ```powershell
  npm run typecheck
  npm run lint
  ```

  Expected: both commands exit 0. Resolve only errors caused by this slice; preserve any documented unrelated baseline warnings.

- [ ] **Step 3: Re-run the mobile browser file after static validation**

  Run:

  ```powershell
  npm run test:browser -- --project mobile-chromium -- tests/browser/immersive-panel-shell.spec.ts
  ```

  Expected: PASS for the existing phone panel behavior plus the new confirmation and renderer lifecycle regressions.

- [ ] **Step 4: Confirm no media/catalog artifacts changed and whitespace is clean**

  Run:

  ```powershell
  git diff --check
  $forbiddenPreviewChanges = git diff --name-only | Where-Object {
    $_ -match '^(components/backgrounds/(BackgroundPreviewMedia|background-carousel|background-carousel-card)\.tsx|lib/background-catalog\.js|scripts/chimer-preview-generation/|public/)'
  }
  $forbiddenPreviewChanges
  ```

  Expected: `git diff --check` has no output; `$forbiddenPreviewChanges` has no output. Do not edit or stage a changed media path for this slice.

- [ ] **Step 5: Confirm the implementation commit sequence before handoff**

  Run:

  ```powershell
  git log --oneline -2
  git status --short
  ```

  Expected: the latest two commits are `fix: isolate unsaved visual confirmation` and `fix: release covered background renderer`; `git status --short` contains no files from this slice. Preserve unrelated user changes without staging or cleaning them.

## Self-Review Performed

- **Spec coverage:** Task 1 covers hidden confirmation layering, pointer isolation, Escape isolation, and captured-focus restoration. Task 2 covers unmounting the covered selected renderer, retaining its parent-owned ID/settings, and safe remount after picker close. Tasks 1–3 cover phone-first browser execution and reduced-motion preservation while leaving picker preview playback unchanged; the later adaptive runtime owns the approved five-playing positions (center plus two on each side).
- **Scope check:** The dialog and renderer are separate implementation units, but both are confined to the same `RunningTimer`/immersive-panel user flow and can be delivered as independently testable commits. No background visual-quality, tuning-control, naming, preview, or asset work enters this slice.
- **Placeholder scan:** The prohibited planning-marker scan is clean. Every implementation action names an exact file, prop/function, code shape, command, and expected result.
- **Type consistency:** `modalInterlockActive?: boolean` is declared on `ImmersivePanelShellProps`, defaulted in the shell, and passed as `Boolean(pendingVisualIntent)`. `overlayClassName?: string` is declared on `AlertDialogContentProps`, consumed by `AlertDialogOverlay`, and passed only by `UnsavedVisualChangesDialog`. `shouldSuspendCoveredLiveBackground` stays a local boolean and does not alter the `BackgroundHost` public props.
