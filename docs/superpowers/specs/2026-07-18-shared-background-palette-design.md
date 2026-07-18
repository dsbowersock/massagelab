# Shared Background Palette and Visual Presets Design

**Date:** 2026-07-18

**Status:** Reviewed and approved for implementation planning

**Track:** 4A of 6

**Surfaces:** Active Chimer, `/clock`, Music visualizer, BackgroundHost, account preferences, and `/dev/buttons`

## Summary

Replace the current mix of Global Colors and duplicated per-background color settings with one registry-driven background palette system. Every color-capable background uses one persisted global mode—Source, Custom, or Harmony—and one seven-swatch palette. The selected background declares its source colors, color roles, default swatch mapping, and renderer targets through a palette adapter. Users can optionally remap those roles to different global swatches without changing the shared colors.

Add draft editing with live preview, multi-step Undo/Redo, Apply, Cancel, unsaved-change guards, reusable Color presets, and per-background Visual presets. Color presets remain separate from Visual presets so a palette can be combined with any background's geometry, motion, position, opacity, interaction, and role mapping.

Track 4A is the required foundation for Track 4B's DNA and Twisted Cubes backgrounds. It also depends on Track 1's permanent-background ownership resolver for ownership-based color access.

## Why This Is A Separate Subtrack

Adding DNA and Twisted Cubes originally appeared to require only two new palette implementations. The approved requirement that Harmony and Custom colors persist across every background changes the work into a sitewide color-state migration. That migration affects dozens of CSS, DOM, Canvas, and WebGL renderers, the large RunningTimer settings surface, local and account preferences, entitlement logic, presets, tests, and future background authoring.

Track 4 is therefore split into:

1. **Track 4A:** shared palette migration, draft editing, and presets.
2. **Track 4B:** DNA and Twisted Cubes built on the completed Track 4A contract.

Track 4A must land first.

## Current State

- `RunningTimer` owns a local-only Global Colors state with semantic fields such as primary, secondary, accent, background, foreground, and CTA colors.
- Many backgrounds also persist their own palette mode, primary color, harmony choice, and one or more color fields inside `ChimerSettings`.
- Palette choices and UI patterns vary by effect: Custom/Harmony, Source/Custom/Harmony, Source/Rainbow/Custom/Harmony, and Auto/Custom all exist.
- The existing Global Colors picker and saved palettes are not the sole source of truth for compatible renderers.
- Existing per-background controls mix color and non-color properties in large conditional branches.
- Saved color palettes are local to the browser.
- Background changes preview live and persist through the broader Chimer settings flow, but there is no Apply/Cancel draft, general Undo/Redo history, or per-background Visual preset system.
- The largest existing color consumer is Gradient Animation, which accepts seven simultaneous colors: two backdrop colors and five animated colors.
- Fixed image/video media does not have meaningful renderer color inputs and should not be tinted merely to satisfy the shared palette.

## Goals

- Make one global Source/Custom/Harmony mode authoritative across every compatible background.
- Persist exactly seven generic swatches because seven is the current maximum renderer need.
- Name only Swatch 1 as Primary at the global level; do not impose semantic names on Swatches 2-7.
- Dynamically label all seven swatches according to how the selected background maps them.
- Keep unused swatches visible, saved, and visibly marked as unused by the selected background.
- Give every compatible background a curated default mapping and optional user-controlled remapping.
- Preserve original source colors and special source behavior until the user chooses Custom or Harmony.
- Leave non-color-capable images, videos, and fixed media unchanged.
- Preserve every existing non-color background setting.
- Remove duplicated per-background color state after a clean migration.
- Add live draft preview with multi-step Undo/Redo, Apply, Cancel, and unsaved-change protection.
- Keep reusable Color presets separate from per-background Visual presets.
- Sync committed palette state and presets for signed-in users while retaining local behavior for anonymous users.
- Allow Custom/Harmony when the user has `chimer_custom_colors` or permanently owns the selected premium background.
- Give future backgrounds one explicit, testable palette-adapter contract.

## Non-goals

- Adding DNA or Twisted Cubes; Track 4B owns those effects.
- Implementing permanent ownership, credits, purchases, refunds, or chargebacks; Track 1 owns those systems.
- Tinting fixed images or videos.
- Changing the animation, geometry, interaction, or source defaults of existing backgrounds solely to make the palette migration easier.
- Replacing the Background picker carousel; Track 3 owns that decision.
- Storing an account-wide, persistent edit-history log. Undo/Redo is an in-memory draft feature.
- Supporting unlimited saved presets.
- Preserving obsolete per-background color fields indefinitely for hypothetical users; the product has no outside users yet.

## Dependency On Track 1

Track 4A defines its color-access decision as:

```ts
canCustomizeBackgroundColors =
  hasFeature("chimer_custom_colors") || ownsSelectedPremiumBackground;
```

The permanent-ownership value must come from Track 1's real server-backed ownership resolver. Track 4A must not create a temporary or duplicate ownership store. If implementation sequencing requires it, Track 1's ownership foundation moves ahead of Track 4A.

Source mode remains available whenever the selected background itself is usable. Losing subscription or ownership access does not erase a saved palette or presets.

## Global Palette Contract

### Persisted state

```ts
type BackgroundPaletteMode = "source" | "custom" | "harmony";

type SevenColorSwatches = readonly [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
];

interface BackgroundPaletteState {
  mode: BackgroundPaletteMode;
  primaryColor: string;
  harmony: ColorHarmony;
  swatches: SevenColorSwatches;
}
```

Swatch 1 is the Primary color. In Custom mode all seven swatches are directly editable. In Harmony mode Primary and the harmony choice generate all seven swatches. Switching to Source does not erase or regenerate the dormant Custom/Harmony values.

Fresh state defaults to Source.

### Mode behavior

**Source**

- Uses the selected background adapter's original source colors.
- Preserves source-specific behavior such as Rainbow or automatic palette generation.
- Shows the selected background's resolved source colors in the swatch UI as read-only context.
- Keeps saved Custom/Harmony colors dormant and available when the user switches modes.

**Custom**

- Uses the seven directly edited global swatches.
- Resolves the selected background's color roles through its active role-to-swatch mapping.
- Persists unchanged when the user switches backgrounds.

**Harmony**

- Generates seven swatches from one Primary color and one global harmony choice.
- Uses the same role mapping as Custom.
- Persists unchanged when the user switches backgrounds.

### Unsupported backgrounds

An enabled background that cannot accept meaningful colors must declare an explicit unsupported reason. The shared palette UI reports that colors are unavailable for the selected effect. The renderer receives no tint or synthetic overlay, and the background remains selectable and otherwise configurable.

## Registry Palette Adapter

Every compatible registry entry declares a palette adapter comparable to:

```ts
interface BackgroundPaletteRole {
  id: string;
  label: string;
  sourceColor: string;
  defaultSwatch: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  rendererTarget: string;
}

interface BackgroundPaletteAdapter {
  roles: readonly BackgroundPaletteRole[];
  sourceBehavior?: "fixed" | "rainbow" | "automatic";
  unsupportedReason?: never;
}

interface UnsupportedBackgroundPaletteAdapter {
  roles?: never;
  unsupportedReason: string;
}
```

The exact implementation may use typed target functions instead of target strings if that produces safer compile-time coverage. The contract must still provide:

- stable role IDs;
- user-facing role labels;
- source colors;
- curated default Swatch 1-7 assignments;
- a renderer destination for every role;
- any special Source-only behavior; and
- an explicit unsupported reason when applicable.

The adapter is metadata and translation logic, not persisted user state.

## Dynamic Swatch Labels And Mapping

All seven swatches remain visible.

- A swatch used by one role displays that role's label.
- A swatch used by multiple roles lists the labels compactly.
- A swatch with no selected-background role is labeled **Not used by this background** and visually muted.
- Source mode shows how the selected effect's source roles are organized but does not allow global remapping to alter the source result.
- Custom and Harmony allow a compact **Color mapping** editor.

The user may assign each background role to any of Swatches 1-7. Multiple roles may intentionally share one swatch. Invalid, missing, or stale assignments fall back to the adapter's curated default.

The active mapping is background-specific. It is saved with that background's visual properties and included in its Visual presets. Changing a mapping never mutates the global seven colors.

## Special Source Behaviors

Special behaviors remain background-specific Visual properties while global mode is Source.

Examples include:

- Ripple Grid's rainbow behavior;
- Aurora Bars' automatic monochrome source behavior; and
- Tile Grid's source automatic palette behavior.

Custom or Harmony always uses the shared palette and active role mapping. Switching back to Source restores the saved source-specific behavior.

## Draft Editing Model

Opening the Visual editor establishes an in-memory snapshot of:

- shared palette state;
- shared Color presets;
- selected-background non-color properties;
- selected-background role mapping;
- selected-background Visual presets; and
- selected-background default Visual preset selection.

Changes preview live through a draft. They are not committed to local or account preferences until Apply.

The sticky editor action row contains:

- Undo;
- Redo;
- Apply;
- Cancel; and
- a clear dirty/saved status.

Undo and Redo cover color changes, property changes, mapping changes, resets, and draft preset-management actions. The history is bounded in memory and starts fresh after Apply, Cancel, or page reload. It does not undo background selection or application navigation.

Cancel restores the opening snapshot. Apply commits the final draft locally and starts account synchronization.

### Unsaved-change guards

When a dirty draft exists, these actions request **Apply changes / Discard changes / Keep editing**:

- closing the Visual panel;
- selecting another background; and
- internal application navigation.

Reloading or closing the browser tab uses the browser's native unsaved-changes warning. A user who confirms departure discards the in-memory draft.

## Reset Actions

Colors and visual properties have separate reset actions.

**Use source colors**

- Changes global mode to Source.
- Does not erase saved Custom/Harmony Primary, harmony, swatches, or Color presets.
- Is undoable in the draft.

**Reset visual properties**

- Restores only the selected background's registry/source non-color defaults.
- Restores its curated default color-role mapping.
- Does not change the global palette.
- Is undoable in the draft.

## Color Presets

Color presets are reusable across every compatible background. They store:

```ts
interface BackgroundColorPreset {
  id: string;
  name: string;
  mode: "custom" | "harmony";
  primaryColor: string;
  harmony: ColorHarmony;
  swatches: SevenColorSwatches;
  createdAt: string;
  updatedAt: string;
}
```

Source cannot be saved as a Color preset because Source colors belong to individual backgrounds rather than one cross-background palette.

Users may save at most six Color presets. Presets support:

- Save as new;
- Apply;
- Update;
- Rename;
- Delete.

Color presets do not have a default designation. The active shared palette already persists after Apply, so a second automatic-default mechanism would be redundant. A saved Color preset changes the active palette only when the user explicitly applies it.

Preset mutations participate in the draft. Cancel restores the preset collection from the opening snapshot.

## Visual Presets

Visual presets are separate for each background and exclude the global palette colors. They store:

- sanitized non-color renderer properties;
- source-specific visual behavior;
- the background's role-to-swatch mapping;
- a name and stable ID; and
- creation/update metadata.

Users may save at most three Visual presets per background. Presets support:

- Save as new;
- Apply;
- Update;
- Rename;
- Delete; and
- Set as default.

A default Visual preset automatically applies whenever its background is selected. A background without a user default uses its source property defaults. Applying a Visual preset previews it inside the active draft; Apply commits it.

## Visual Panel Organization

Track 4A targets the Track 2 Visual panel structure. Keep screen awake remains at the top as already approved. The palette migration adds these sections below the basic visual-background control:

1. **Shared Colors**
   - Source / Custom / Harmony;
   - Primary and seven swatches;
   - dynamic role labels;
   - Color mapping;
   - Use source colors;
   - up to six Color presets.
2. **Selected Background Properties**
   - existing non-color controls;
   - source-specific behavior;
   - Reset visual properties;
   - up to three Visual presets.
3. **Sticky draft actions**
   - Undo, Redo, Apply, Cancel, status.

Color mapping may collapse by default when the curated mapping has not been changed. Essential Apply/Cancel and unsaved status remain reachable at phone widths and 200% zoom.

## Persistence And Account Sync

Committed state lives in a nested, sanitized Chimer preference:

```ts
interface SharedBackgroundVisualPreferences {
  palette: BackgroundPaletteState;
  colorPresets: BackgroundColorPreset[];
  mappingsByBackground: Partial<Record<BackgroundId, BackgroundColorMapping>>;
  visualPresetsByBackground: Partial<
    Record<BackgroundId, BackgroundVisualPreset[]>
  >;
  defaultVisualPresetByBackground: Partial<Record<BackgroundId, string>>;
}
```

Anonymous users persist it through the existing Chimer local-storage record. Signed-in users sync it through the existing account-preferences JSON and Chimer preference flow. No Prisma migration is required.

Apply writes locally first. If account synchronization fails:

- the locally applied state remains active;
- the last confirmed cloud state is not represented as current;
- the UI shows a retryable sync error; and
- Retry sends the same sanitized committed state.

Preference limits and sanitizers protect account payload size:

- seven swatches exactly;
- six Color presets maximum;
- three Visual presets per background maximum;
- valid active background IDs only;
- known property keys only;
- clamped numeric values; and
- safe bounded names/metadata.

Palette and preset data is non-sensitive UI preference data. It must not contain clinical, wellness, client, or other PHI-bearing content.

## Clean Migration

The product has no outside users, so Track 4A uses a clean migration instead of long-lived dual schemas.

1. Read the existing Global Colors local record when present.
2. Map its current seven values into the new ordered swatches.
3. If its harmony is Custom, initialize mode as Custom; otherwise initialize mode as Harmony.
4. If no Global Colors record exists, initialize Source mode and the new default dormant palette.
5. Preserve every existing non-color Chimer/background setting.
6. Preserve existing background selection and entitlement behavior.
7. Remove obsolete per-background palette mode, Primary, harmony, and individual color fields from defaults, sanitization, props, controls, and account payloads.
8. Remove the old standalone Global Colors local-storage write path after successful migration.
9. Keep source palettes in registry adapters, not user settings.

Examples of removed duplicated settings include `massageLabAstralFlowPaletteMode`, `massageLabAstralFlowPrimaryColor`, `massageLabAstralFlowHarmony`, and `massageLabAstralFlowColorOne` through `ColorThree`. Equivalent duplicated fields for other effects are removed in the same final cutover.

This does not remove visible color customization. It replaces duplicated effect-specific storage with the shared palette and adapter mapping.

## Component Boundaries

### Palette domain module

Owns:

- global defaults;
- seven-swatch validation;
- harmony generation;
- source/custom/harmony resolution;
- mapping validation;
- preset sanitization and limits; and
- migration helpers.

It is DOM-independent and unit-testable.

### Registry palette adapters

Own:

- source colors;
- role IDs and labels;
- curated default mappings;
- renderer targets;
- special Source behavior; and
- explicit unsupported reasons.

### Draft editor reducer

Owns:

- opening snapshot;
- current draft;
- bounded Undo and Redo stacks;
- dirty comparison;
- reset actions;
- draft preset mutations; and
- Apply/Cancel transitions.

### Shared palette editor

Owns presentation and accessible controls for mode, Primary, seven swatches, dynamic labels, mapping, Color presets, and source reset. It does not persist directly.

### Visual preset manager

Uses the registry/source definition of non-color properties for the selected background. It does not capture shared palette colors.

### BackgroundHost boundary

Receives the selected background, its non-color props, and resolved role colors. It merges resolved colors into the existing effect-specific renderer contract. Individual renderers do not know about accounts, ownership, presets, or draft state.

### Unsaved-change guard

Coordinates Visual panel dismissal, background switching, internal navigation, and native unload behavior without owning renderer settings.

## Data Flow

```text
local/account preferences
  -> sanitized committed palette + presets + visual properties
  -> in-memory draft editor
  -> palette mode + selected registry adapter + saved mapping
  -> resolved role colors
  -> BackgroundHost renderer props
  -> live preview
  -> Apply
  -> local persistence
  -> account sync
```

Background changes do not mutate global palette state. They only change which adapter labels and consumes the seven saved swatches.

## Error Handling

- Invalid or missing swatches fall back to sanitized palette defaults.
- A palette array with any length other than seven is migrated or rejected into defaults.
- Invalid harmony or mode values fall back safely.
- Missing/stale role assignments fall back to the adapter's curated mapping.
- Multiple roles may intentionally target the same swatch.
- Unknown preset keys are discarded.
- Numeric Visual preset values reuse existing clamps.
- Missing background IDs or deleted presets are ignored without breaking the selected background.
- A missing adapter leaves the renderer unchanged and presents the explicit unsupported state.
- Renderer load failures continue through the existing BackgroundHost fallback.
- Account fetch failure leaves local state usable.
- Account save failure keeps locally applied state and exposes Retry.
- Access loss disables Custom/Harmony editing for the selected background without deleting saved palette data.

## Accessibility

- Palette mode uses a labeled single-choice control with visible selected state.
- Every swatch has an accessible dynamic role label.
- Unused swatches remain understandable and are not communicated through color alone.
- Role-to-swatch selectors expose both swatch number and current color.
- Undo, Redo, Apply, and Cancel expose disabled states and keyboard activation.
- Dirty status uses text in addition to visual treatment.
- The unsaved-change dialog traps focus, identifies the affected background, and provides three explicit actions.
- Preset menus and rename/delete confirmation are keyboard reachable.
- Controls and sticky actions remain reachable at 200% zoom, phone portrait, and short landscape.
- Live preview color changes do not announce every animation frame; committed status and errors use appropriate polite announcements.

## Performance

- Palette resolution is pure and memoized by mode, swatches, adapter, and mapping.
- Changing one swatch updates only the active renderer; it does not mount every background.
- Registry validation runs in tests/build-time paths, not on every animation frame.
- Draft history stores sanitized preference snapshots, not canvas frames or DOM trees.
- History is bounded to prevent unbounded memory use during long editing sessions.
- Custom/Harmony changes reuse existing renderer lifecycles rather than recreating unrelated audio or timer state.

## Development Review Surface

Add a development-only shared-palette matrix to `/dev/buttons` containing:

- Source/Custom/Harmony editor states;
- all seven swatches;
- dynamic labels and unused states;
- role remapping;
- dirty/Undo/Redo/Apply/Cancel states;
- Color and Visual preset states;
- representative live CSS, DOM, Canvas, and WebGL backgrounds; and
- adapter support status for every enabled background.

This is a migration review surface, not a replacement for the real Clock/Chimer/Music browser tests.

## Staged Rollout

Keep the current renderer path active while building and validating adapters. Stage implementation by boundary:

1. Palette domain, migration, and draft reducer.
2. Registry adapter schema and exhaustive inventory.
3. CSS and DOM adapters.
4. Canvas adapters.
5. WebGL/shader adapters.
6. Shared editor, mapping, and preset UI.
7. Account sync and Track 1 ownership integration.
8. Exhaustive adapter validation and live review.
9. Atomic cutover to the shared palette.
10. Removal of obsolete color fields and old local Global Colors writes.

The final cutover must not leave a background partially reading old and new color state.

## Validation Contract

### Pure unit tests

- Source, Custom, and Harmony resolution.
- Every supported harmony generates seven valid colors.
- Custom state accepts exactly seven sanitized colors.
- Swatch 1 remains Primary.
- Invalid mode, harmony, swatch, and mapping values fall back safely.
- Multiple roles may share one swatch.
- Unused swatches remain persisted.
- Color presets reject Source mode and enforce a maximum of six.
- Visual presets exclude shared colors and enforce three per background.
- Default Visual preset resolution.
- Reset colors and Reset properties remain separate.
- Migration from current Global Colors.
- Fresh migration defaults to Source.
- Non-color settings survive migration unchanged.

### Registry contract tests

- Every enabled background has a valid adapter or explicit unsupported reason.
- Every compatible role has a stable ID, non-empty label, valid source color, Swatch 1-7 default, and real renderer target.
- Source defaults resolve to the same visible color values as before migration.
- Special Source behavior remains available only through Source handling.
- Gradient Animation proves all seven swatches can be consumed.
- Fixed image/video media remains unsupported and untinted.

### Draft and preset tests

- Live draft does not persist before Apply.
- Multi-step Undo and Redo cover colors, properties, mappings, resets, and preset mutations.
- Cancel restores the complete opening snapshot.
- Apply commits one sanitized state and clears history/dirty state.
- Panel close, background switch, and internal navigation request Apply/Discard/Keep editing.
- Native unload warning appears only when dirty.
- Preset save, apply, update, rename, delete, and default behavior.
- Default Visual preset applies on selection; source values apply otherwise.

### Access and sync tests

- `chimer_custom_colors` unlocks every compatible background.
- Permanent ownership unlocks the owned premium background only.
- Lack of both keeps Source available and disables Custom/Harmony editing.
- Saved data survives access loss.
- Anonymous persistence remains local.
- Signed-in state hydrates and syncs through account preferences.
- Failed sync keeps applied local state and exposes Retry.
- Account payload limits and sanitization are enforced.

### Browser tests

- Global mode and colors persist while switching representative backgrounds.
- Dynamic labels update without changing saved swatches.
- User remapping changes only the selected background.
- Source restores original colors.
- Unsupported media is unchanged.
- Draft preview, Undo/Redo, Apply, Cancel, and unsaved guards behave at desktop and phone sizes.
- Color and Visual preset limits and default behavior are visible.
- Representative CSS, DOM, Canvas, and WebGL effects render without console failures in all three modes.
- Ripple Grid preserves Source rainbow behavior.
- Gradient Animation consumes seven mapped roles.
- Track 1 ownership and subscription access produce the correct editing state.
- Chimer timer and Music playback continue while editing and applying visual changes.

### Exhaustive render sweep

Automate selection of every enabled background under Source, Custom, and Harmony. Assert:

- no render exception or console error;
- BackgroundHost does not fall back unexpectedly;
- adapter role targets receive valid colors;
- non-color controls remain present; and
- reduced-motion behavior remains unchanged.

### Repository gate

- Focused Node tests.
- Focused desktop and mobile Playwright.
- Full browser render sweep.
- `npm run lint`.
- `npm run typecheck`.
- `npm run test`.
- `npm run build`.
- `git diff --check`.
- Manual visual review at desktop, phone portrait, short landscape, and reduced motion.

## Approved Decisions

- Decompose Track 4 into 4A shared palette migration and 4B DNA/Twisted Cubes.
- Use a registry-driven palette adapter.
- Make palette mode global across compatible backgrounds.
- Use Source, Custom, and Harmony modes.
- Default fresh state to source colors and source property values.
- Use seven total swatches because seven is the current maximum need.
- Name only the first swatch Primary; dynamically label all swatches by selected-background roles.
- Keep all seven swatches visible and mark unused ones.
- Provide curated mappings plus optional per-background remapping.
- Store remapping with visual properties and Visual presets.
- Leave fixed media unchanged rather than tinting it.
- Preserve special rainbow/automatic behavior in Source.
- Remove duplicated per-background color fields after migrating current Global Colors.
- Preserve every existing non-color setting.
- Combine live draft editing with multi-step Undo/Redo and Apply/Cancel.
- Guard panel close, background switch, navigation, reload, and tab close when dirty.
- Keep Use source colors and Reset visual properties separate.
- Keep Color and Visual presets separate.
- Do not allow Source-mode Color presets.
- Allow six Color presets and three Visual presets per background.
- Support Save as new, Apply, Update, Rename, and Delete for Color presets.
- Support Save as new, Apply, Update, Rename, Delete, and Set as default for Visual presets.
- Auto-apply a background's default Visual preset on selection.
- Sync committed palette and presets for signed-in users.
- Allow colors through `chimer_custom_colors` or permanent ownership of the selected premium background.
- Depend on Track 1's real ownership resolver and move Track 1 earlier if implementation sequencing requires it.
