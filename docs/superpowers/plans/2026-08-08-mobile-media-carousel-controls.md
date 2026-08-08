# Mobile Media Carousel Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver unobstructed responsive Background previews, reliable center-card station swiping, and a non-scrolling icon-only music toolbar on phones.

**Architecture:** Keep the existing adaptive carousel and playback provider. Add one opt-in custom-control renderer to the shared carousel, let `BackgroundCarousel` supply a responsive external tray, and add one explicit drag-surface marker for the station details trigger. Keep all music playback state in `MusicProvider`; only `MusicMiniPlayer` presentation and shell spacing change.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Embla Carousel, Radix UI, Tailwind CSS, CSS Modules, Node test runner, Playwright.

## Global Constraints

- Use the targeted responsive-adaptation approach; do not rewrite the adaptive carousel or create a second mobile render tree.
- Background cards must not overlay name, description, access, selection, unlock, permanent-ownership, or favorite controls on their artwork.
- The Background tray is always visible while the panel is open: below the stage normally and to its right for the existing `short-landscape` profile.
- `short-landscape` shows at most the previous, centered, and next Background cards.
- Animated previews default enabled on first use, persist on the device, and are paused by reduced motion without overwriting the saved preference.
- Station artwork, title, and description accept both a short tap for details and a horizontal drag; Play/Stop and Favorite remain protected controls.
- The expanded music toolbar never scrolls horizontally. It uses two rows on narrow phones, icon-only success/leaf controls, and one Play/Stop button instead of Restart plus a separate Stop.
- Preserve the existing wide-screen volume slider; it remains a non-button enhancement and does not appear in the narrow two-row action set.
- Casting, Android audio-focus/media-notification work, browser fullscreen guidance, and timer-size-control placement are out of scope.
- Add no backend, schema, API, entitlement, catalog, account, or commerce-state changes.
- Do not edit `app/chimer/page.tsx`, `components/sidebar/sidebar.tsx`, admin source files, or admin tests.
- The concurrent admin worktree currently owns `docs/project-state.md`, `docs/project-log.md`, and `docs/wiki/index.md`. Recheck that worktree before implementation and do not edit those files while overlap remains.
- Add focused JSDoc or comments for the new shared control state, drag-surface exception, and persisted preference behavior.

---

## File Structure

### Create

- `components/backgrounds/background-carousel-control-tray.tsx` — centered Background metadata, commerce/access actions, favorite, Info dialog, and preview switch.
- `components/backgrounds/background-carousel-control-tray.module.css` — normal bottom-tray content layout and compact short-landscape presentation.
- `lib/background-preview-preference.js` — guarded device-storage parsing and writing for the animated-preview preference.
- `tests/background-preview-preference.test.mjs` — pure storage-contract coverage.

### Modify

- `components/carousels/adaptive-carousel-model.js` — set Background `short-landscape` to visible radius one while other profiles remain radius two.
- `components/carousels/adaptive-carousel-stage.tsx` — expose a typed optional custom-control renderer and keep the existing navigation as the default.
- `components/carousels/adaptive-carousel-stage.module.css` — place custom Background controls below or beside the stage from the existing profile attribute.
- `components/carousels/use-adaptive-carousel-controller.ts` — allow only explicitly marked interactive drag surfaces to bypass the normal interactive-element drag block.
- `components/backgrounds/background-carousel.tsx` — own centered-item lookup, autoplay preference, effective reduced-motion playback, and tray wiring.
- `components/backgrounds/background-carousel-card.tsx` — render preview artwork and selected styling only.
- `components/atmosphere/station-carousel-card.tsx` — mark the station details trigger as a drag-capable interactive surface.
- `components/providers/music-mini-player.tsx` — responsive grid, icon-only tooltips, shared success variant, Play/Stop behavior, and collapsed body class.
- `app/chimer/immersive-panel-shell.tsx` — expose a stable Background scroller test hook.
- `app/chimer/immersive-panel-shell.module.css` — give the Background carousel the remaining panel height without a required scroll to its tray.
- `app/chimer/running-timer.module.css` — let Background settings content and carousel fill the available panel block.
- `app/globals.css` — reserve correct expanded and collapsed toolbar heights at narrow widths.
- `tests/adaptive-carousel.test.mjs` — responsive radius and custom-control source contracts.
- `tests/carousel-lab-source.test.mjs` — shared drag-surface and off-card Background action ownership contracts.
- `tests/music-visualizer-provider.test.mjs` — persistent-toolbar source contract.
- `tests/browser/background-carousel-preview.spec.ts` — default autoplay, persisted toggle, reduced-motion override, off-card content, and portrait/landscape layout.
- `tests/browser/background-commerce.spec.ts` — point commerce assertions at the centered control tray instead of the card.
- `tests/browser/immersive-panel-shell.spec.ts` — verify navigation and selection remain reachable in the full-screen Background panel.
- `tests/browser/public-routes.spec.ts` — center-card swipe/tap behavior and narrow toolbar layout/collapse behavior.
- `tests/browser/app-shell.spec.ts` — verify responsive toolbar height reservation and collapsed body class.

---

### Task 1: Add the shared custom-control slot and short-landscape card budget

**Files:**
- Modify: `components/carousels/adaptive-carousel-model.js:31-107`
- Modify: `components/carousels/adaptive-carousel-stage.tsx:13-229`
- Modify: `components/carousels/adaptive-carousel-stage.module.css:1-133`
- Test: `tests/adaptive-carousel.test.mjs:1-97`

**Interfaces:**
- Consumes: existing `useAdaptiveCarouselController()` values `centeredId`, `canGoPrevious`, `canGoNext`, `goPrevious`, and `goNext`.
- Produces: `AdaptiveCarouselControlState` and optional `renderControls(state)` on `AdaptiveCarouselStageProps<T>`.
- Produces: Background tuning with `visibleRadius === 1` only for `short-landscape`; every other Background profile remains radius two.

- [ ] **Step 1: Write failing radius and custom-control contract tests**

Update the profile table and assertions in `tests/adaptive-carousel.test.mjs` so the expected radius is part of each case, and load the stage source:

```js
const stageSource = readFileSync(
  new URL("../components/carousels/adaptive-carousel-stage.tsx", import.meta.url),
  "utf8",
)

it("uses three Background renderers only in short landscape", () => {
  const cases = [
    [{ containerWidth: 479, viewportWidth: 390, viewportHeight: 844 }, "phone-portrait", 164, 312, 22, 2],
    [{ containerWidth: 1000, viewportWidth: 844, viewportHeight: 480 }, "short-landscape", 200, 240, 26, 1],
    [{ containerWidth: 759, viewportWidth: 779, viewportHeight: 1121 }, "tablet", 220, 304, 29, 2],
    [{ containerWidth: 760, viewportWidth: 1365, viewportHeight: 820 }, "compact-desktop", 256, 360, 33, 2],
    [{ containerWidth: 960, viewportWidth: 1121, viewportHeight: 779 }, "wide-landscape", 280, 388, 36, 2],
  ]

  for (const [dimensions, expectedProfile, cardWidth, cardHeight, spread, visibleRadius] of cases) {
    const profile = resolveAdaptiveCarouselViewportProfile(dimensions)
    const tuning = getResponsiveBackgroundCarouselTuning(profile)
    assert.equal(profile, expectedProfile)
    assert.equal(tuning.cardWidth, cardWidth)
    assert.equal(tuning.cardHeight, cardHeight)
    assert.equal(tuning.spread, spread)
    assert.equal(tuning.visibleRadius, visibleRadius)
  }
})

it("offers typed custom controls while retaining default navigation", () => {
  assert.match(stageSource, /export interface AdaptiveCarouselControlState/)
  assert.match(stageSource, /renderControls\?: \(state: AdaptiveCarouselControlState\) => ReactNode/)
  assert.match(stageSource, /renderControls \? renderControls\(controlState\) : defaultNavigation/)
  assert.match(stageSource, /data-has-custom-controls=/)
})
```

- [ ] **Step 2: Run the focused test and confirm the new expectations fail**

Run:

```powershell
node --test tests/adaptive-carousel.test.mjs
```

Expected: FAIL because short landscape still reports radius two and the stage has no custom-control interface.

- [ ] **Step 3: Make visible radius part of the Background profile defaults**

Change the profile defaults and stop overwriting the profile-specific radius in `getResponsiveBackgroundCarouselTuning()`:

```js
export const BACKGROUND_CAROUSEL_PROFILE_DEFAULTS = Object.freeze({
  "phone-portrait": Object.freeze({ cardWidth: 164, cardHeight: 312, spread: 22, visibleRadius: 2 }),
  "short-landscape": Object.freeze({ cardWidth: 200, cardHeight: 240, spread: 26, visibleRadius: 1 }),
  tablet: Object.freeze({ cardWidth: 220, cardHeight: 304, spread: 29, visibleRadius: 2 }),
  "compact-desktop": Object.freeze({ cardWidth: 256, cardHeight: 360, spread: 33, visibleRadius: 2 }),
  "wide-landscape": Object.freeze({ cardWidth: 280, cardHeight: 388, spread: 36, visibleRadius: 2 }),
})

export function getResponsiveBackgroundCarouselTuning(profile, overrides = {}) {
  return /** @type {AdaptiveCarouselTuning} */ ({
    ...BACKGROUND_CAROUSEL_BASE_TUNING,
    ...overrides,
    ...(BACKGROUND_CAROUSEL_PROFILE_DEFAULTS[profile]
      ?? BACKGROUND_CAROUSEL_PROFILE_DEFAULTS["compact-desktop"]),
    gap: 0,
    radius: 420,
    scaleFalloff: 0.08,
  })
}
```

- [ ] **Step 4: Add the typed control renderer without changing default Station navigation**

Add the following public state and prop to `adaptive-carousel-stage.tsx`:

```tsx
export interface AdaptiveCarouselControlState {
  centeredItemId: string | null
  canGoPrevious: boolean
  canGoNext: boolean
  goPrevious: () => void
  goNext: () => void
}

export interface AdaptiveCarouselStageProps<T extends AdaptiveCarouselItem> {
  items: readonly T[]
  initialItemId?: string | null
  selectedItemId?: string | null
  surface: "backgrounds" | "stations"
  presentation: "existing" | "cover-flow" | "three-d" | "background-picker"
  tuning: Record<string, number | boolean>
  reducedMotion: boolean
  renderItem: (item: T, state: AdaptiveCarouselItemRenderState) => ReactNode
  onCenteredItemChange?: (itemId: string) => void
  onEffectiveLoopChange?: (value: boolean) => void
  onNavigate?: () => void
  testId?: string
  viewportProfile?: string
  renderControls?: (state: AdaptiveCarouselControlState) => ReactNode
}
```

Destructure `renderControls`, construct wrapped navigation callbacks that still call `onNavigate`, and render the custom result in a stable wrapper:

```tsx
const controlState: AdaptiveCarouselControlState = {
  centeredItemId: centeredId,
  canGoPrevious,
  canGoNext,
  goPrevious: () => {
    onNavigate?.()
    goPrevious()
  },
  goNext: () => {
    onNavigate?.()
    goNext()
  },
}

const defaultNavigation = (
  <div className={styles.navigation}>
    <Button
      type="button"
      className={styles.navigationButton}
      aria-label={`Previous ${itemLabel}`}
      title={`Previous ${itemLabel}`}
      disabled={!canGoPrevious}
      onClick={controlState.goPrevious}
      size="icon"
      variant="glow"
    >
      <StepBack aria-hidden="true" />
    </Button>
    <Button
      type="button"
      className={styles.navigationButton}
      aria-label={`Next ${itemLabel}`}
      title={`Next ${itemLabel}`}
      disabled={!canGoNext}
      onClick={controlState.goNext}
      size="icon"
      variant="glow"
    >
      <StepForward aria-hidden="true" />
    </Button>
  </div>
)
```

Add `data-has-custom-controls={Boolean(renderControls)}` to the root and replace the current navigation block with:

```tsx
<div className={styles.controls}>
  {renderControls ? renderControls(controlState) : defaultNavigation}
</div>
```

Do not change the live-region status paragraph or its `statusText` source.

- [ ] **Step 5: Lay out custom Background controls from the existing profile attribute**

Add these structural rules to `adaptive-carousel-stage.module.css` and leave default Station navigation styling intact:

```css
.controls {
  min-width: 0;
}

.root[data-surface="backgrounds"][data-has-custom-controls="true"] {
  display: grid;
  grid-template-areas:
    "stage"
    "controls";
  grid-template-rows: minmax(0, 1fr) auto;
  min-height: 0;
  height: 100%;
}

.root[data-surface="backgrounds"][data-has-custom-controls="true"] .stage {
  grid-area: stage;
  align-self: center;
}

.root[data-surface="backgrounds"][data-has-custom-controls="true"] .controls {
  grid-area: controls;
}

.root[data-surface="backgrounds"][data-has-custom-controls="true"][data-carousel-responsive-profile="short-landscape"] {
  grid-template-areas: "stage controls";
  grid-template-columns: minmax(0, 1fr) minmax(12.5rem, 17rem);
  grid-template-rows: minmax(0, 1fr);
  gap: 0.75rem;
}
```

- [ ] **Step 6: Run the focused model/source test**

Run:

```powershell
node --test tests/adaptive-carousel.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit the shared carousel contract**

```powershell
git add components/carousels/adaptive-carousel-model.js components/carousels/adaptive-carousel-stage.tsx components/carousels/adaptive-carousel-stage.module.css tests/adaptive-carousel.test.mjs
git commit -m "feat: add responsive carousel control slot"
```

---

### Task 2: Move Background information and actions into the responsive tray

**Files:**
- Create: `components/backgrounds/background-carousel-control-tray.tsx`
- Create: `components/backgrounds/background-carousel-control-tray.module.css`
- Modify: `components/backgrounds/background-carousel.tsx:3-203`
- Modify: `components/backgrounds/background-carousel-card.tsx:3-245`
- Modify: `app/chimer/immersive-panel-shell.tsx:669-696`
- Modify: `app/chimer/immersive-panel-shell.module.css:428-456`
- Modify: `app/chimer/running-timer.module.css:667-679`
- Test: `tests/carousel-lab-source.test.mjs:176-211`
- Test: `tests/browser/background-commerce.spec.ts:300-575`
- Test: `tests/browser/immersive-panel-shell.spec.ts:230-255`
- Test: `tests/browser/background-carousel-preview.spec.ts:86-326`

**Interfaces:**
- Consumes: `AdaptiveCarouselControlState` from Task 1 and the existing authoritative `commerceState` produced by `backgroundCardCommerceState()`.
- Produces: `BackgroundCarouselControlTrayProps` with one centered option and callbacks for selection, locked acquisition, permanent ownership, favorite, preview preference, and navigation.
- Produces: `[data-testid="background-carousel-controls"]` and `[data-background-scroller]` browser contracts.

- [ ] **Step 1: Write failing ownership and layout tests**

In `tests/carousel-lab-source.test.mjs`, import `existsSync` alongside `readFileSync`, assert the new file URL, and then load both owners:

```js
it("keeps production Background actions and metadata off the preview artwork", () => {
  const card = read("components/backgrounds/background-carousel-card.tsx")
  assert.equal(existsSync(new URL("../components/backgrounds/background-carousel-control-tray.tsx", import.meta.url)), true)
  const tray = read("components/backgrounds/background-carousel-control-tray.tsx")

  assert.doesNotMatch(card, /data-carousel-primary-action|data-carousel-favorite-action/)
  assert.doesNotMatch(card, /visualDescriptor|previewTags|acquisitionHint/)
  assert.match(tray, /data-background-carousel-controls/)
  assert.match(tray, /data-carousel-primary-action/)
  assert.match(tray, /data-carousel-favorite-action/)
  assert.match(tray, /DialogTrigger/)
})
```

Change the `accessCard` helper in `tests/browser/background-commerce.spec.ts` so existing commerce assertions target the tray associated with the centered slide:

```ts
function accessCard(slide: Awaited<ReturnType<typeof centerPremium>>) {
  return slide
    .locator("xpath=ancestor::section[@aria-label='Background carousel']")
    .getByTestId("background-carousel-controls")
}
```

Add a production layout test to `tests/browser/background-carousel-preview.spec.ts`:

```ts
test("production Background controls stay off-card and visible in portrait and short landscape", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const panel = await openProductionBackgroundCarousel(page)
  const controls = panel.getByTestId("background-carousel-controls")
  const centeredCard = panel.locator('[data-carousel-slide][data-centered="true"] article')

  await expect(controls).toBeVisible()
  await expect(centeredCard.locator("h3, [data-carousel-primary-action], [data-carousel-favorite-action]")).toHaveCount(0)
  await expect(controls.getByRole("button", { name: "Previous background" })).toBeVisible()
  await expect(controls.getByRole("button", { name: "Next background" })).toBeVisible()
  const firstName = await controls.getByRole("heading", { level: 3 }).textContent()
  await controls.getByRole("button", { name: "Next background" }).click()
  await expect.poll(() => controls.getByRole("heading", { level: 3 }).textContent()).not.toBe(firstName)

  await page.setViewportSize({ width: 844, height: 390 })
  const root = panel.getByRole("region", { name: "Background carousel" })
  await expect(root).toHaveAttribute("data-carousel-responsive-profile", "short-landscape")
  await expect(panel.locator('[data-carousel-slide][data-detail-level="full"], [data-carousel-slide][data-detail-level="summary"]')).toHaveCount(3)

  const [stageBox, trayBox] = await Promise.all([
    panel.getByTestId("background-carousel-stage").boundingBox(),
    controls.boundingBox(),
  ])
  expect(trayBox?.x ?? 0).toBeGreaterThan((stageBox?.x ?? 0) + (stageBox?.width ?? 0) / 2)
  expect(await panel.locator("[data-background-scroller]").evaluate((node) => node.scrollHeight <= node.clientHeight + 1)).toBe(true)

  await controls.getByRole("button", { name: /More information about/i }).click()
  await expect(page.getByRole("dialog").getByRole("heading")).toBeVisible()
  await page.keyboard.press("Escape")
})
```

- [ ] **Step 2: Run the focused source test and layout test to establish failure**

Run:

```powershell
node --test tests/carousel-lab-source.test.mjs
npm run test:browser -- tests/browser/background-carousel-preview.spec.ts --project=desktop-chromium --grep "controls stay off-card"
```

Expected: FAIL because the tray file, test hooks, and side layout do not exist.

- [ ] **Step 3: Create the centered Background control-tray component**

Create `background-carousel-control-tray.tsx` with this public interface:

```tsx
export interface BackgroundCarouselControlTrayProps {
  option: BackgroundDefinition
  commerceState: {
    state: string
    canSelect: boolean
    showKeepPermanently: boolean
    isInCart: boolean
    isReserved: boolean
    ownershipStatus: string | null
    ownershipSource: string | null
  }
  selected: boolean
  saved: boolean
  signedIn: boolean
  previewPreferenceEnabled: boolean
  reducedMotion: boolean
  canGoPrevious: boolean
  canGoNext: boolean
  onPrevious: () => void
  onNext: () => void
  onSelect: () => void
  onLockedSelect?: () => void
  onKeepPermanently?: () => void
  onToggleSaved: () => void
  onPreviewPreferenceChange: (enabled: boolean) => void
}
```

Move `accessLabel()`, `ownershipSourceLabel()`, the acquisition hint, permanent-ownership badge, commerce status, visual tags, primary action, and favorite action from the card into this component. Keep the existing authoritative action decision:

```tsx
function handlePrimaryAction() {
  if (!commerceState.canSelect) {
    onLockedSelect?.()
    return
  }
  onSelect()
}
```

Derive the action state once so every visible label and accessible name uses the same authoritative decision:

```tsx
const statusLabel = accessLabel(commerceState)
const sourceLabel = ownershipSourceLabel(commerceState.ownershipSource)
const permanentlyOwned = hasActivePermanentOwnership(commerceState)
const unavailable = commerceState.state === "unavailable"
const locked = !commerceState.canSelect && !unavailable
const primaryLabel = unavailable
  ? "Unavailable"
  : locked
    ? "Unlock"
    : selected
      ? "Selected"
      : "Select"
const acquisitionHint = signedIn
  ? "Use a credit, buy for $1, or unlock all premium backgrounds."
  : "Add this background now, then sign in or create an account at checkout."
const previewTags = getBackgroundVisualTags(option)
  .filter((tag) => !["shader", "video"].includes(tag.toLowerCase()))
  .slice(0, 4)
const acquisitionHintId = useId()
const reducedMotionStatusId = useId()
```

The tray root, metadata, and navigation contract are:

```tsx
<section
  className={styles.tray}
  data-background-carousel-controls
  data-background-access-state={commerceState.state}
  data-testid="background-carousel-controls"
  aria-label={`Controls for ${option.label}`}
>
  <div className={styles.metadata}>
    <h3>{option.label}</h3>
    <p className={styles.description}>{option.visualDescriptor}</p>
    <div className={styles.accessState}>
      {statusLabel ? (
        <span>
          {statusLabel}
          {statusLabel === "Owned" && sourceLabel ? <span className="sr-only"> - {sourceLabel}</span> : null}
        </span>
      ) : null}
      {commerceState.isReserved ? <span>Reserved</span> : commerceState.isInCart ? <span>In cart</span> : null}
    </div>
    <div className={styles.supplementaryMetadata}>
      {previewTags.length > 0 ? <span>{previewTags.join(" - ")}</span> : null}
      {locked ? <span id={acquisitionHintId}>{acquisitionHint}</span> : null}
    </div>
  </div>
  <div className={styles.actions}>
    <Button type="button" size="icon" variant="glow" aria-label="Previous background" disabled={!canGoPrevious} onClick={onPrevious}>
      <StepBack aria-hidden="true" />
    </Button>
    <Button
      type="button"
      data-carousel-primary-action
      disabled={unavailable}
      aria-describedby={locked ? acquisitionHintId : undefined}
      aria-label={`${primaryLabel} ${option.label} background`}
      title={locked ? acquisitionHint : undefined}
      onClick={handlePrimaryAction}
      size="sm"
      variant={locked ? "default" : "glow"}
    >
      {locked ? <Lock aria-hidden="true" /> : null}
      {primaryLabel}
    </Button>
    {commerceState.showKeepPermanently && onKeepPermanently ? (
      <Button type="button" size="icon" variant="glow" onClick={onKeepPermanently} aria-label={`Open permanent ownership options for ${option.label}`} title="Keep permanently">
        <DollarSign aria-hidden="true" />
      </Button>
    ) : null}
    {permanentlyOwned ? (
      <span role="img" aria-label={`${option.label} is permanently owned`} title="Permanently owned">
        <Crown aria-hidden="true" />
      </span>
    ) : null}
    <Button type="button" data-carousel-favorite-action aria-pressed={saved} aria-label={`${saved ? "Unsave" : "Save"} ${option.label}`} onClick={onToggleSaved} size="icon" variant="glow">
      <MetalFavoriteIcon kind="star" selected={saved} />
    </Button>
    <Button type="button" size="icon" variant="glow" aria-label="Next background" disabled={!canGoNext} onClick={onNext}>
      <StepForward aria-hidden="true" />
    </Button>
  </div>
</section>
```

Render the preview switch in the tray using the exact saved preference rather than effective playback:

```tsx
<ToggleControl
  className={styles.previewToggle}
  label="Animated previews"
  valueLabel={previewPreferenceEnabled ? "On" : "Off"}
  checked={previewPreferenceEnabled}
  density="dense"
  tone="leaf"
  aria-describedby={reducedMotion ? reducedMotionStatusId : undefined}
  onCheckedChange={onPreviewPreferenceChange}
/>
{reducedMotion ? (
  <p id={reducedMotionStatusId} role="status" className={styles.motionStatus}>
    Paused by your reduced-motion setting. Your preview preference is still saved.
  </p>
) : null}
```

Add the compact Info dialog with concrete centered content:

```tsx
<Dialog>
  <DialogTrigger asChild>
    <Button type="button" className={styles.infoTrigger} size="icon" variant="glow" aria-label={`More information about ${option.label}`} title="Background information">
      <Info aria-hidden="true" />
    </Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>{option.label}</DialogTitle>
      <DialogDescription>{option.visualDescriptor}</DialogDescription>
    </DialogHeader>
    <p>{statusLabel ?? (commerceState.canSelect ? "Available" : "Locked")}</p>
    {previewTags.length > 0 ? <p>{previewTags.join(" - ")}</p> : null}
    {locked ? <p>{acquisitionHint}</p> : null}
  </DialogContent>
</Dialog>
```

These nodes stay inside the tray or dialog and never move back onto the preview artwork.

- [ ] **Step 4: Give the tray compact normal and short-landscape CSS**

Create `background-carousel-control-tray.module.css` with explicit, non-scrolling regions:

```css
.tray {
  display: grid;
  grid-template-areas:
    "metadata actions"
    "preview actions";
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
  padding: 0.65rem 0.75rem;
  border: 1px solid rgb(255 255 255 / 18%);
  border-radius: 0.9rem;
  background: rgb(5 5 5 / 88%);
}

.metadata {
  grid-area: metadata;
  min-width: 0;
}

.previewRegion {
  grid-area: preview;
  min-width: 0;
}

.description {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.actions {
  grid-area: actions;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.45rem;
}

.infoTrigger {
  display: none;
}

:global([data-carousel-responsive-profile="short-landscape"]) .tray {
  grid-template-areas:
    "metadata"
    "preview"
    "actions";
  grid-template-columns: minmax(0, 1fr);
  align-content: center;
  height: 100%;
  padding: 0.55rem;
}

:global([data-carousel-responsive-profile="short-landscape"]) .description,
:global([data-carousel-responsive-profile="short-landscape"]) .supplementaryMetadata {
  display: none;
}

:global([data-carousel-responsive-profile="short-landscape"]) .infoTrigger {
  display: inline-flex;
}

:global([data-carousel-responsive-profile="short-landscape"]) .actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
```

In the final JSX, place the preview switch and reduced-motion status inside `<div className={styles.previewRegion}>`, and place the Info `DialogTrigger` inside `.actions` after Next. The Info `DialogContent` may portal outside the tray through Radix. The primary action may span two columns when its text needs room. Keep every tap target at least the shared Button component's icon/small size.

- [ ] **Step 5: Reduce the Background card to unobstructed preview artwork**

Change `BackgroundCarouselCardProps` to:

```tsx
interface BackgroundCarouselCardProps {
  option: BackgroundDefinition
  detailLevel: AdaptiveCarouselDetailLevel
  selected: boolean
  active: boolean
  playPreviews: boolean
  reducedMotion: boolean
}
```

Keep the existing `BackgroundPreviewMedia` rendition/fallback wiring, `data-background-id`, and `data-background-selected`. Remove commerce calculations, metadata gradients, buttons, tags, and acquisition hints. Apply a non-obscuring selected treatment to the `<article>`:

```tsx
className={cn(
  "relative grid aspect-[5/7] h-full overflow-hidden rounded-2xl border bg-black text-white shadow-2xl",
  selected
    ? "border-primary/80 shadow-primary/20"
    : "border-white/20",
)}
```

- [ ] **Step 6: Wire the tray to the centered item in `BackgroundCarousel`**

Initialize the in-memory preview preference to `true` for this task and preserve the separate effective value:

```tsx
const [previewPreferenceEnabled, setPreviewPreferenceEnabled] = useState(true)
const previewPlaybackActive = previewPreferenceEnabled && active && !reducedMotion
```

Delete the effect that permanently sets the preference to false when reduced motion turns on. Supply the tray through Task 1's control renderer:

```tsx
renderControls={(controls) => {
  const centeredOption = items.find(({ id }) => id === controls.centeredItemId)
  if (!centeredOption) return null

  return (
    <BackgroundCarouselControlTray
      option={centeredOption}
      commerceState={centeredOption.commerceState}
      selected={selectedId === centeredOption.id}
      saved={savedIds.includes(centeredOption.id)}
      signedIn={signedIn}
      previewPreferenceEnabled={previewPreferenceEnabled}
      reducedMotion={reducedMotion}
      canGoPrevious={controls.canGoPrevious}
      canGoNext={controls.canGoNext}
      onPrevious={controls.goPrevious}
      onNext={controls.goNext}
      onSelect={() => onSelect(centeredOption.id)}
      onLockedSelect={() => onLockedSelect?.(centeredOption)}
      onKeepPermanently={() => onKeepPermanently?.(centeredOption)}
      onToggleSaved={() => onToggleSaved(centeredOption.id)}
      onPreviewPreferenceChange={setPreviewPreferenceEnabled}
    />
  )
}}
```

Pass only the reduced card props from `renderItem`.

- [ ] **Step 7: Constrain the production Background panel to the carousel/tray layout**

Add `data-background-scroller` to the Background scroller in `immersive-panel-shell.tsx`:

```tsx
<div className={styles.backgroundScroller} data-background-scroller>
  {backgroundContent}
</div>
```

Update the panel CSS so the scroller gives the Background content a stable remaining block rather than requiring users to scroll to the controls:

```css
.backgroundScroller {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  padding-bottom: max(0.875rem, env(safe-area-inset-bottom, 0px));
}

.backgroundScroller > * {
  min-height: 0;
  height: 100%;
}
```

Update `running-timer.module.css`:

```css
.backgroundSettingsTabContent {
  min-height: 0;
  height: 100%;
  touch-action: pan-y;
}

.backgroundSettingsTabContent > :global([data-background-carousel]) {
  min-height: 0;
  height: 100%;
}
```

Remove the mobile-only top padding that consumes Background carousel height. The panel header already provides separation and safe-area spacing.

- [ ] **Step 8: Run the Background source, layout, commerce, and panel tests**

Run:

```powershell
node --test tests/carousel-lab-source.test.mjs
npm run test:browser -- tests/browser/background-carousel-preview.spec.ts --project=desktop-chromium --grep "controls stay off-card"
npm run test:browser -- tests/browser/background-commerce.spec.ts tests/browser/immersive-panel-shell.spec.ts --project=desktop-chromium
```

Expected: PASS. Existing acquisition, ownership, selection, and favorite assertions now resolve inside the tray.

- [ ] **Step 9: Commit the responsive Background tray**

```powershell
git add components/backgrounds/background-carousel-control-tray.tsx components/backgrounds/background-carousel-control-tray.module.css components/backgrounds/background-carousel.tsx components/backgrounds/background-carousel-card.tsx app/chimer/immersive-panel-shell.tsx app/chimer/immersive-panel-shell.module.css app/chimer/running-timer.module.css tests/carousel-lab-source.test.mjs tests/browser/background-carousel-preview.spec.ts tests/browser/background-commerce.spec.ts tests/browser/immersive-panel-shell.spec.ts
git commit -m "feat: move background controls into responsive tray"
```

---

### Task 3: Persist automatic preview playback and preserve reduced-motion preference

**Files:**
- Create: `lib/background-preview-preference.js`
- Create: `tests/background-preview-preference.test.mjs`
- Modify: `components/backgrounds/background-carousel.tsx:3-203`
- Modify: `components/backgrounds/background-carousel-control-tray.tsx`
- Test: `tests/browser/background-carousel-preview.spec.ts:86-326`
- Test: `tests/adaptive-carousel.test.mjs:64-77`

**Interfaces:**
- Produces: `BACKGROUND_PREVIEW_PREFERENCE_STORAGE_KEY`, `readBackgroundPreviewPreference(storage)`, and `writeBackgroundPreviewPreference(storage, enabled)`.
- Consumes: `previewPreferenceEnabled` in the tray; the switch reflects saved intent while effective playback remains `hydrated && enabled && active && !reducedMotion`.

- [ ] **Step 1: Write failing pure storage tests**

Create `tests/background-preview-preference.test.mjs`:

```js
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  BACKGROUND_PREVIEW_PREFERENCE_STORAGE_KEY,
  readBackgroundPreviewPreference,
  writeBackgroundPreviewPreference,
} from "../lib/background-preview-preference.js"

function memoryStorage(initialValue = null) {
  let value = initialValue
  return {
    getItem(key) {
      assert.equal(key, BACKGROUND_PREVIEW_PREFERENCE_STORAGE_KEY)
      return value
    },
    setItem(key, nextValue) {
      assert.equal(key, BACKGROUND_PREVIEW_PREFERENCE_STORAGE_KEY)
      value = nextValue
    },
    value: () => value,
  }
}

describe("Background preview preference", () => {
  it("defaults to enabled and reads only explicit false as disabled", () => {
    assert.equal(readBackgroundPreviewPreference(memoryStorage()), true)
    assert.equal(readBackgroundPreviewPreference(memoryStorage("true")), true)
    assert.equal(readBackgroundPreviewPreference(memoryStorage("false")), false)
    assert.equal(readBackgroundPreviewPreference(memoryStorage("unexpected")), true)
  })

  it("writes the current device choice", () => {
    const storage = memoryStorage()
    assert.equal(writeBackgroundPreviewPreference(storage, false), true)
    assert.equal(storage.value(), "false")
    assert.equal(writeBackgroundPreviewPreference(storage, true), true)
    assert.equal(storage.value(), "true")
  })

  it("falls back safely when storage throws", () => {
    const storage = {
      getItem() { throw new DOMException("blocked", "SecurityError") },
      setItem() { throw new DOMException("blocked", "SecurityError") },
    }
    assert.equal(readBackgroundPreviewPreference(storage), true)
    assert.equal(writeBackgroundPreviewPreference(storage, false), false)
  })
})
```

- [ ] **Step 2: Run the new test and confirm the module is missing**

Run:

```powershell
node --test tests/background-preview-preference.test.mjs
```

Expected: FAIL with module-not-found for `lib/background-preview-preference.js`.

- [ ] **Step 3: Implement the guarded preference helper**

Create `lib/background-preview-preference.js`:

```js
// @ts-check

export const BACKGROUND_PREVIEW_PREFERENCE_STORAGE_KEY =
  "massagelab-background-preview-autoplay-v1"

/**
 * Reads device intent without treating blocked storage as a reason to disable
 * the first-use autoplay default.
 * @param {Pick<Storage, "getItem">} storage
 */
export function readBackgroundPreviewPreference(storage) {
  try {
    return storage.getItem(BACKGROUND_PREVIEW_PREFERENCE_STORAGE_KEY) !== "false"
  } catch {
    return true
  }
}

/**
 * Persists device intent while allowing the current React session to continue
 * when browser privacy settings reject storage.
 * @param {Pick<Storage, "setItem">} storage
 * @param {boolean} enabled
 */
export function writeBackgroundPreviewPreference(storage, enabled) {
  try {
    storage.setItem(BACKGROUND_PREVIEW_PREFERENCE_STORAGE_KEY, enabled ? "true" : "false")
    return true
  } catch {
    return false
  }
}
```

- [ ] **Step 4: Hydrate saved intent before mounting preview videos**

In `BackgroundCarousel`, add `preferenceHydrated` and read once after mount:

```tsx
const [previewPreferenceEnabled, setPreviewPreferenceEnabled] = useState(true)
const [preferenceHydrated, setPreferenceHydrated] = useState(false)

useEffect(() => {
  setPreviewPreferenceEnabled(readBackgroundPreviewPreference(window.localStorage))
  setPreferenceHydrated(true)
}, [])

const previewPlaybackActive =
  preferenceHydrated && previewPreferenceEnabled && active && !reducedMotion

function handlePreviewPreferenceChange(enabled: boolean) {
  setPreviewPreferenceEnabled(enabled)
  writeBackgroundPreviewPreference(window.localStorage, enabled)
}
```

Pass `handlePreviewPreferenceChange` to the tray. The tray uses `ToggleControl` or `Switch` with `tone="leaf"`, `checked={previewPreferenceEnabled}`, and a label containing `Animated previews`. Do not disable the switch during reduced motion. Associate this status text when reduced motion is active:

```tsx
<p id={reducedMotionStatusId} role="status">
  Paused by your reduced-motion setting. Your preview preference is still saved.
</p>
```

The switch uses `aria-describedby={reducedMotion ? reducedMotionStatusId : undefined}`.

- [ ] **Step 5: Rewrite preview browser expectations around default autoplay and a semantic switch**

In `background-carousel-preview.spec.ts`:

- Remove initial `Play Preview` clicks from rendition/fallback tests; wait for videos immediately after opening the panel.
- Replace Pause/Play button assertions with the `Animated previews` switch and `aria-checked`.
- Add a persistence test:

```ts
test("animated preview intent defaults on and persists on this device", async ({ page }) => {
  await installPreviewRuntimeProbe(page)
  let panel = await openProductionBackgroundCarousel(page)
  let previewSwitch = panel.getByRole("switch", { name: /Animated previews/i })

  await expect(previewSwitch).toHaveAttribute("aria-checked", "true")
  await expect.poll(() => panel.getByTestId("carousel-background-video").count()).toBeGreaterThan(0)

  await previewSwitch.click()
  await expect(previewSwitch).toHaveAttribute("aria-checked", "false")
  await expect(panel.getByTestId("carousel-background-video")).toHaveCount(0)

  await page.reload({ waitUntil: "domcontentloaded" })
  panel = page.getByRole("dialog", { name: "Background" })
  previewSwitch = panel.getByRole("switch", { name: /Animated previews/i })
  await expect(previewSwitch).toHaveAttribute("aria-checked", "false")
  await expect(panel.getByTestId("carousel-background-video")).toHaveCount(0)
})
```

Rewrite the reduced-motion test to seed the preview preference as enabled, expect `aria-checked="true"`, expect the reduced-motion status, and expect zero videos. This proves the override does not erase intent.

- [ ] **Step 6: Run preference and preview tests**

Run:

```powershell
node --test tests/background-preview-preference.test.mjs tests/adaptive-carousel.test.mjs
npm run test:browser -- tests/browser/background-carousel-preview.spec.ts --project=desktop-chromium
```

Expected: PASS.

- [ ] **Step 7: Commit automatic persisted previews**

```powershell
git add lib/background-preview-preference.js tests/background-preview-preference.test.mjs components/backgrounds/background-carousel.tsx components/backgrounds/background-carousel-control-tray.tsx tests/browser/background-carousel-preview.spec.ts tests/adaptive-carousel.test.mjs
git commit -m "feat: persist automatic background previews"
```

---

### Task 4: Allow station-card swipes without sacrificing tap-for-details

**Files:**
- Modify: `components/carousels/use-adaptive-carousel-controller.ts:12-19`
- Modify: `components/atmosphere/station-carousel-card.tsx:80-184`
- Test: `tests/carousel-lab-source.test.mjs:176-188`
- Test: `tests/browser/public-routes.spec.ts` near the existing mobile Atmosphere carousel coverage

**Interfaces:**
- Produces: `[data-carousel-drag-surface="true"]` as the only interactive-element exception to the normal drag block.
- Consumes: Embla's existing `watchDrag`, movement threshold, and click suppression; no second pointer state is introduced.

- [ ] **Step 1: Write failing source and browser gesture tests**

Extend the Station source contract:

```js
const controller = read("components/carousels/use-adaptive-carousel-controller.ts")
const stageCss = read("components/carousels/adaptive-carousel-stage.module.css")
assert.match(sharedCard, /data-carousel-drag-surface="true"/)
assert.match(controller, /dragSurface\.matches\(interactiveSlideSelector\)/)
assert.match(stageCss, /touch-action:\s*pan-y pinch-zoom/)
```

Add a focused mobile browser test to `public-routes.spec.ts`:

```ts
test("center station details support swipe and short tap while actions stay protected", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Touch carousel behavior is covered in mobile Chromium.")
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/music", { waitUntil: "domcontentloaded" })
  const centered = await centerCarouselItem(page, "mlab-proof-drone", "Next station")
  const details = centered.locator('[data-carousel-station-details]')
  const beforeId = await centered.getAttribute("data-carousel-item-id")
  const box = await details.boundingBox()
  if (!box) throw new Error("Station details surface has no drag bounds")

  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.5)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.5, { steps: 8 })
  await page.mouse.up()

  await expect.poll(async () => page.locator('[data-carousel-slide][data-centered="true"]').getAttribute("data-carousel-item-id"))
    .not.toBe(beforeId)
  await expect(page.getByRole("dialog")).toHaveCount(0)

  const proof = await centerCarouselItem(page, "mlab-proof-drone", "Next station")
  await proof.locator('[data-carousel-station-details]').click()
  await expect(page.getByRole("dialog").getByRole("heading", { name: "MassageLab Proof Drone" })).toBeVisible()
  await page.keyboard.press("Escape")

  await proof.locator('[data-carousel-station-details]').focus()
  await page.keyboard.press("Enter")
  await expect(page.getByRole("dialog").getByRole("heading", { name: "MassageLab Proof Drone" })).toBeVisible()
  await page.keyboard.press("Escape")

  await proof.getByRole("button", { name: /^Play MassageLab Proof Drone$/i }).click()
  await expect(proof).toHaveAttribute("data-centered", "true")
  await proof.getByRole("button", { name: /Favorite MassageLab Proof Drone|Remove MassageLab Proof Drone from favorites/i }).click()
  await expect(proof).toHaveAttribute("data-centered", "true")
  await page.getByTestId("music-player-toolbar").getByRole("button", { name: "Stop", exact: true }).click()
})
```

- [ ] **Step 2: Run the focused tests and verify drag remains blocked**

Run:

```powershell
node --test tests/carousel-lab-source.test.mjs
npm run test:browser -- tests/browser/public-routes.spec.ts --project=mobile-chromium --grep "center station details"
```

Expected: FAIL because the details button is still rejected by `interactiveSlideSelector`.

- [ ] **Step 3: Add the narrow drag-surface exception**

Replace `shouldStartCarouselDrag()` with:

```ts
const interactiveSlideSelector =
  "button, a, input, select, textarea, [role='button'], [role='option']"
const interactiveDragSurfaceSelector = "[data-carousel-drag-surface='true']"

/**
 * Keeps controls protected while allowing an explicitly marked interactive
 * surface to share tap and Embla drag behavior.
 */
function shouldStartCarouselDrag(event: MouseEvent | TouchEvent) {
  const target = event.target
  if (!(target instanceof Element)) return true

  const interactive = target.closest(interactiveSlideSelector)
  if (!interactive) return true

  const dragSurface = target.closest(interactiveDragSurfaceSelector)
  return dragSurface === interactive && dragSurface.matches(interactiveSlideSelector)
}
```

This remains false for Play/Stop, Favorite, links, fields, and any unmarked button.

- [ ] **Step 4: Mark only the station details trigger**

Add the marker directly to the existing `DialogTrigger` button:

```tsx
<button
  type="button"
  data-carousel-station-details
  data-carousel-drag-surface="true"
  aria-label={`Show full information for ${station.title}`}
  className="absolute inset-x-0 bottom-0 top-[42%] z-20 grid min-w-0 content-start gap-1 bg-gradient-to-t from-black/95 via-black/85 to-transparent px-3 pb-3 pt-10 text-left text-white transition-colors hover:from-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
>
  <span className="truncate text-sm font-semibold tracking-normal">{station.title}</span>
  <span className="overflow-hidden text-xs leading-5 text-white/75 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
    {station.description}
  </span>
</button>
```

Do not add the marker to the article, Play/Stop, Favorite, dialog links, or non-carousel production cards.

- [ ] **Step 5: Run the source and mobile browser tests**

Run:

```powershell
node --test tests/carousel-lab-source.test.mjs
npm run test:browser -- tests/browser/public-routes.spec.ts --project=mobile-chromium --grep "center station details"
```

Expected: PASS. The swipe changes center without opening the dialog, a tap opens it, and dedicated controls leave the center unchanged.

- [ ] **Step 6: Commit the Station gesture fix**

```powershell
git add components/carousels/use-adaptive-carousel-controller.ts components/atmosphere/station-carousel-card.tsx tests/carousel-lab-source.test.mjs tests/browser/public-routes.spec.ts
git commit -m "fix: allow swiping from station details"
```

---

### Task 5: Rebuild the persistent player as a non-scrolling responsive toolbar

**Files:**
- Modify: `components/providers/music-mini-player.tsx:1-181`
- Modify: `app/globals.css:115-230,1860-1940`
- Test: `tests/music-visualizer-provider.test.mjs:93-112`
- Test: `tests/browser/public-routes.spec.ts:530-645`
- Test: `tests/browser/app-shell.spec.ts:650-735`
- Test: `tests/browser/music-visualizer.spec.ts` existing toolbar Stop selector

**Interfaces:**
- Consumes: existing `music.playStation(id)`, `music.stopCurrent()`, previous/next, visualizer link, volume, and collapse state.
- Produces: `[data-testid="music-player-toolbar-identity"]`, `[data-testid="music-player-toolbar-controls"]`, `data-collapsed`, and the body class `ml-music-player-collapsed`.
- Produces: icon-only accessible actions named `Previous station`, `Play` or `Stop`, `Next station`, `Background` or `Minimize visualizer`, and `Collapse` or `Expand`.

- [ ] **Step 1: Write failing toolbar source and mobile layout assertions**

Extend `tests/music-visualizer-provider.test.mjs`:

```js
it("uses one icon-only leaf toolbar without horizontal scrolling", () => {
  assert.doesNotMatch(miniPlayerSource, /RefreshCw|Restart|overflow-x-auto/)
  assert.match(miniPlayerSource, /variant="success"/)
  assert.match(miniPlayerSource, /TooltipProvider/)
  assert.match(miniPlayerSource, /ml-music-player-collapsed/)
  assert.match(miniPlayerSource, /data-testid="music-player-toolbar-controls"/)
})
```

In the existing `Atmosphere visualizer action retains selected station across client routes` browser test, remove the width-gated collapse branch. On mobile and desktop, require Collapse to be visible. Add these narrow-layout assertions before navigating to Background:

```ts
const overflow = await playerToolbar.evaluate((node) => ({
  clientWidth: node.clientWidth,
  scrollWidth: node.scrollWidth,
}))
expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1)

const identityBox = await playerToolbar.getByTestId("music-player-toolbar-identity").boundingBox()
const controlsBox = await playerToolbar.getByTestId("music-player-toolbar-controls").boundingBox()
if ((page.viewportSize()?.width ?? 0) < 640) {
  expect(controlsBox?.y ?? 0).toBeGreaterThan(identityBox?.y ?? 0)
}

for (const name of ["Previous station", "Stop", "Next station", "Background", "Collapse"]) {
  await expect(playerToolbar.getByRole(name === "Background" ? "link" : "button", { name, exact: true })).toBeVisible()
}
```

After clicking Collapse, assert `data-collapsed="true"`, Background is absent from the compact row, and Play/Stop plus Expand remain. Expand again before testing the Background link.

- [ ] **Step 2: Run the source and mobile route tests to verify failure**

Run:

```powershell
node --test tests/music-visualizer-provider.test.mjs
npm run test:browser -- tests/browser/public-routes.spec.ts --project=mobile-chromium --grep "visualizer action retains"
```

Expected: FAIL because the toolbar still contains Restart, separate Stop, horizontal overflow, blue/secondary buttons, and a mobile-hidden Collapse action.

- [ ] **Step 3: Define one Play/Stop behavior from existing provider state**

In `MusicMiniPlayer`, derive the active control state without changing `MusicProvider`:

```tsx
const isCollapsed = music.miniPlayerCollapsed
const isLoading = music.playbackState === "loading"
const isPlayingOrLoading = music.playbackState === "playing" || isLoading

function handlePlayStop() {
  if (isPlayingOrLoading) {
    void music.stopCurrent()
    return
  }
  if (music.activeStationId) void music.playStation(music.activeStationId)
}
```

The button uses `aria-label={isPlayingOrLoading ? "Stop" : "Play"}`, `title` with the same value, and Square or Play icon. It remains enabled during loading so the user can stop startup; disable it only when no active station exists.

- [ ] **Step 4: Replace the scrolling flex row with explicit expanded and collapsed grids**

Import `ChevronDown`, `ChevronUp`, `Tooltip`, `TooltipContent`, `TooltipProvider`, and `TooltipTrigger`; remove `RefreshCw`. Add these root contracts:

```tsx
<div
  className="ml-music-player-toolbar pointer-events-none absolute inset-x-0 z-[10020]"
  data-placement={placement}
  data-collapsed={isCollapsed}
  data-playback-state={music.playbackState}
  data-testid="music-player-toolbar"
  role="region"
  aria-label="Atmosphere audio player"
>
```

Inside `TooltipProvider`, use this container:

```tsx
<div className={cn(
  "mx-auto grid w-full max-w-screen-2xl gap-2 px-3 py-2 sm:px-4",
  isCollapsed
    ? "min-h-[4.5rem] grid-cols-[minmax(0,1fr)_auto_auto] items-center"
    : "min-h-[7rem] grid-cols-1 content-center sm:min-h-16 sm:grid-cols-[minmax(8rem,1fr)_auto] sm:items-center lg:grid-cols-[minmax(8rem,1fr)_auto_minmax(9rem,14rem)]",
)}>
```

Render the title/status/loading region with `data-testid="music-player-toolbar-identity"`. In expanded state render:

```tsx
<div
  className="grid min-w-0 grid-cols-5 gap-1 sm:flex sm:shrink-0 sm:items-center sm:gap-2"
  data-testid="music-player-toolbar-controls"
>
  {previousAction}
  {playStopAction}
  {nextAction}
  {visualizerAction}
  {collapseAction}
</div>
```

Every action uses `size="icon"` and `variant="success"`. Wrap each with the established Radix tooltip pattern:

```tsx
<Tooltip>
  <TooltipTrigger asChild>
    <Button type="button" size="icon" variant="success" aria-label="Previous station" onClick={() => void music.playPreviousStation()}>
      <SkipBack aria-hidden="true" />
    </Button>
  </TooltipTrigger>
  <TooltipContent>Previous station</TooltipContent>
</Tooltip>
```

Create all action constants immediately above the return:

```tsx
const previousAction = (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button type="button" size="icon" variant="success" aria-label="Previous station" disabled={isLoading} onClick={() => void music.playPreviousStation()}>
        <SkipBack aria-hidden="true" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>Previous station</TooltipContent>
  </Tooltip>
)

const playStopLabel = isPlayingOrLoading ? "Stop" : "Play"
const playStopAction = (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button type="button" size="icon" variant="success" aria-label={playStopLabel} title={playStopLabel} disabled={!music.activeStationId} onClick={handlePlayStop}>
        {isPlayingOrLoading ? <Square aria-hidden="true" /> : <Play aria-hidden="true" />}
      </Button>
    </TooltipTrigger>
    <TooltipContent>{playStopLabel}</TooltipContent>
  </Tooltip>
)

const nextAction = (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button type="button" size="icon" variant="success" aria-label="Next station" disabled={isLoading} onClick={() => void music.playNextStation()}>
        <SkipForward aria-hidden="true" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>Next station</TooltipContent>
  </Tooltip>
)

const visualizerAction = (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button asChild size="icon" variant="success">
        <Link
          href={visualizerHref}
          replace={isMusicVisualizerRoute}
          data-visual-draft-navigation-mode={isMusicVisualizerRoute ? "replace" : undefined}
          aria-label={visualizerActionLabel}
          title={visualizerActionLabel}
        >
          <Wallpaper aria-hidden="true" />
        </Link>
      </Button>
    </TooltipTrigger>
    <TooltipContent>{visualizerActionLabel}</TooltipContent>
  </Tooltip>
)

const collapseAction = (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button type="button" size="icon" variant="success" aria-label="Collapse" onClick={() => music.setMiniPlayerCollapsed(true)}>
        <ChevronDown aria-hidden="true" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>Collapse</TooltipContent>
  </Tooltip>
)

const expandAction = (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button type="button" size="icon" variant="success" aria-label="Expand" onClick={() => music.setMiniPlayerCollapsed(false)}>
        <ChevronUp aria-hidden="true" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>Expand</TooltipContent>
  </Tooltip>
)
```

In collapsed state, render the identity region plus Play/Stop and Expand only. The existing wide-screen volume slider remains expanded-only and moves to the optional third grid column with `hidden lg:flex`.

- [ ] **Step 5: Keep shell spacing synchronized with the two toolbar heights**

Move `isCollapsed` before the body-class effect and toggle one additional class:

```tsx
body.classList.toggle(
  "ml-music-player-collapsed",
  showPlayer && isCollapsed,
)
```

Remove it in the effect cleanup. Add narrow overrides to `app/globals.css`:

The effect dependency list becomes `[isCollapsed, placement, showPlayer]` so the class and spacing update immediately after Collapse or Expand.

```css
@media (max-width: 39.999rem) {
  body.ml-music-player-active:not(.ml-music-player-collapsed) {
    --ml-audio-toolbar-height: 7rem;
  }

  body.ml-music-player-active.ml-music-player-collapsed {
    --ml-audio-toolbar-height: 4.5rem;
  }
}
```

Do not change safe-area formulas; they continue consuming `--ml-audio-toolbar-height`.

- [ ] **Step 6: Extend app-shell tests for expanded and collapsed reservation**

In each mobile active-player shell test, assert that the measured expanded variable matches the toolbar content height within one pixel. Then collapse and verify the class and smaller reservation:

```ts
const expandedPlayerBox = await player.boundingBox()
expect(expandedPlayerBox?.height ?? 0).toBeCloseTo(activeSpacing.audioToolbar, 0)

await player.getByRole("button", { name: "Collapse", exact: true }).click()
await expect(page.locator("body")).toHaveClass(/ml-music-player-collapsed/)
const collapsedSpacing = await resolvedShellSpacing(page)
expect(collapsedSpacing.audioToolbar).toBeLessThan(activeSpacing.audioToolbar)
const collapsedPlayerBox = await player.boundingBox()
expect(collapsedPlayerBox?.height ?? 0).toBeCloseTo(collapsedSpacing.audioToolbar, 0)
```

Expand before clicking Stop. Keep the existing top/bottom app-bar stacking assertions.

- [ ] **Step 7: Run focused source, route, shell, and visualizer tests**

Run:

```powershell
node --test tests/music-visualizer-provider.test.mjs
npm run test:browser -- tests/browser/public-routes.spec.ts tests/browser/app-shell.spec.ts --project=mobile-chromium
npm run test:browser -- tests/browser/public-routes.spec.ts tests/browser/music-visualizer.spec.ts --project=desktop-chromium
```

Expected: PASS with no toolbar horizontal overflow, correct two-row/one-row state, and unchanged visualizer routing.

- [ ] **Step 8: Commit the responsive player toolbar**

```powershell
git add components/providers/music-mini-player.tsx app/globals.css tests/music-visualizer-provider.test.mjs tests/browser/public-routes.spec.ts tests/browser/app-shell.spec.ts tests/browser/music-visualizer.spec.ts
git commit -m "feat: simplify responsive music toolbar"
```

---

### Task 6: Run the complete regression and overlap gate

**Files:**
- Verify only; do not edit the protected canonical docs while the admin worktree remains dirty.

**Interfaces:**
- Consumes: all five task commits.
- Produces: a clean working tree and recorded command results for branch handoff.

- [ ] **Step 1: Recheck the protected admin overlap before any documentation decision**

Run:

```powershell
git -C C:\Users\derri\code\my_projects\massagelab\.worktrees\admin-authorization-audit-foundation status --short
git status --short
```

Expected: the UI worktree contains only intended plan-checkbox progress or is clean. If the admin worktree still lists `docs/project-state.md`, `docs/project-log.md`, or `docs/wiki/index.md`, leave those files untouched and report the deferred documentation reconciliation in the handoff.

- [ ] **Step 2: Run all focused Node tests together**

```powershell
node --test tests/adaptive-carousel.test.mjs tests/background-preview-preference.test.mjs tests/carousel-lab-source.test.mjs tests/music-visualizer-provider.test.mjs
```

Expected: PASS.

- [ ] **Step 3: Run the focused Background browser suites**

```powershell
npm run test:browser -- tests/browser/background-carousel-preview.spec.ts --project=desktop-chromium
npm run test:browser -- tests/browser/background-commerce.spec.ts tests/browser/immersive-panel-shell.spec.ts --project=desktop-chromium
```

Expected: PASS.

- [ ] **Step 4: Run mobile and desktop Music browser suites**

```powershell
npm run test:browser -- tests/browser/public-routes.spec.ts tests/browser/app-shell.spec.ts --project=mobile-chromium
npm run test:browser -- tests/browser/public-routes.spec.ts tests/browser/music-visualizer.spec.ts --project=desktop-chromium
```

Expected: PASS.

- [ ] **Step 5: Run repository-wide validation separately**

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
git diff --check
git status --short
```

Expected: every command exits zero and no uncommitted application changes remain. Do not create an empty verification commit; include exact results and the admin-doc overlap state in the final handoff.

---

## Completion Handoff

Report:

- Worktree: `C:\tmp\massagelab-mobile-media-controls`
- Branch: `codex/mobile-media-carousel-controls`
- Final HEAD and the five implementation commit hashes
- Whether the admin worktree still owns the canonical documentation files
- Focused Node, Background browser, mobile Music browser, desktop Music browser, lint, typecheck, full test, build, and `git diff --check` results
- Confirmation that casting, Android notification work, and fullscreen-control placement were not changed
