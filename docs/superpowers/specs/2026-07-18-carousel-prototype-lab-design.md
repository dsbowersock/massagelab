# Carousel Prototype Lab Design

**Date:** 2026-07-18

**Status:** Reviewed and approved for implementation planning

**Track:** 3A of 6

**Surface:** `/dev/buttons`

## Summary

Build a development-only Carousel Lab on `/dev/buttons` so the existing MassageLab carousel patterns can be compared with native adaptations of two public CodePen concepts using real MassageLab content and production behavior.

The lab compares three presentations across two surfaces:

| Surface | Existing | Cover Flow | 3D Carousel |
| --- | --- | --- | --- |
| Backgrounds | Current Clock/Chimer radial picker | Native adaptation of Jhey's infinite cover flow | Native adaptation of Jhey's scroll-driven image carousel |
| Music Stations | Current Music station rail | The same cover-flow presentation with station cards | The same 3D presentation with station cards |

Backgrounds and Music visualizer backgrounds are one product surface for this decision. They must use the same eventual winner. Music categories remain vertically stacked sections; Track 3 replaces each category's station rail, not the category layout itself.

Track 3A does not replace any production carousel. It produces six production-faithful review combinations, focused local tuning controls, and enough accessibility, performance, and responsive behavior to make the comparison trustworthy. After review, the user records exactly two winners and their tuned defaults:

1. one shared Background carousel for Clock, active Chimer, and the Music visualizer; and
2. one Music Station carousel used inside every Music category.

Those decisions become the input to a separate Track 3B production-rollout design and implementation plan.

## Current State

- Active Chimer owns a custom radial Background carousel with a 35-degree spread, 285-pixel radius, roughly three visible neighbors on each side, keyboard navigation, drag gestures, and explicit Select/Save actions.
- `/music` renders each category as a heading plus a finite horizontal station rail. The rail uses native snapping, hidden scrollbars, hover/focus arrows, and distance-based scrolling.
- Music station cards already own real artwork, title, description, attribution, Play/Stop/Favorite actions, loading state, and playback prewarming on user intent.
- `BackgroundSelector` is also used on current setup and Music surfaces but is not the final Track 2 visualizer-picker contract.
- The repository already includes `embla-carousel-react` and a shared Embla-based UI carousel primitive.
- Track 2 defines the future Clock/Visual/Background panels and the separate Music visualizer context.
- Track 4 defines shared palette editing, preview behavior, and background visual properties.
- Track 1 will define permanent ownership, background credits, individual purchases, subscriptions, and the locked-background decision popup.

## Goals

- Compare the existing presentation and both proposed CodePen-inspired presentations under the same real content, actions, and controller behavior.
- Keep Background and Music Station comparisons production-faithful rather than using static mock cards.
- Use one shared, accessible carousel controller with presentation adapters so style evaluation is not distorted by different input behavior.
- Preserve explicit primary actions: browsing a card never selects a background or starts a station.
- Exercise realistic catalog size without mounting or playing every expensive preview.
- Expose only the tuning values needed to make a fair decision.
- Persist lab tuning on the current device per surface and presentation so review can continue across refreshes.
- Make reduced-motion, phone, keyboard, screen-reader, zoom, and media-failure behavior part of the prototype rather than deferred production work.
- Record source, license, attribution, adaptation, and omitted demo dependencies before production use.
- End Track 3A with two explicit winner decisions and tuned production defaults.

## Non-goals

- Replacing a production Background or Music Station carousel.
- Choosing the two winners before the user reviews the prototypes.
- Allowing separate Background winners for Clock, Chimer, and the Music visualizer.
- Adding a carousel for Music category cards.
- Changing Music playback, favorites, filtering, station grouping, or category order.
- Implementing Track 1 billing, ownership, credits, cart, refund, or chargeback behavior.
- Implementing Track 2's Music visualizer route transition or shared panels.
- Implementing Track 4's palette editor or visual presets.
- Adding automatic advancement, continuous rotation, shuffle-colors, vertical carousel mode, or user-facing carousel tuning.
- Copying CodePen demo assets, global styles, GSAP, ScrollTrigger, Tweakpane, or an iframe into MassageLab.
- Publishing this work on the public Roadmap.

## Track Boundary And Dependencies

Track 3 is split into two subtracks.

### Track 3A: Carousel Prototype Lab

- Build the six `/dev/buttons` combinations.
- Reuse live MassageLab data and card behavior.
- Supply local dev-only tuning and simulated access states.
- Validate interaction, accessibility, responsiveness, and resource use.
- Record the two winner decisions and tuned defaults after review.

### Track 3B: Production rollout

- Begins only after Track 3A review is complete.
- Receives exactly two approved presentation/default bundles.
- Replaces the shared Background picker presentation across Clock, active Chimer, and Music visualizer contexts.
- Replaces each Music category's station rail with the approved Station presentation.
- Integrates with the Track 1, Track 2, and Track 4 contracts that have landed by implementation time.

Track 3A may extract reusable card presentation and pure controller helpers, but production routes retain their existing carousel components and behavior. No hidden feature flag may silently switch production to a lab prototype.

## Source And License Record

The implementation must add `docs/carousel-sources.md` with this source record:

| Prototype | Source | Author | License basis | MassageLab treatment |
| --- | --- | --- | --- | --- |
| Cover Flow | [CSS Scroll Driven Animation Cover Flow - Infinite Edition](https://codepen.io/jh3y/pen/ZEqNVxx) | `jh3y` / Jhey | Public CodePen; CodePen documents public Pens as MIT licensed | Native React, Embla, and scoped-CSS adaptation |
| 3D Carousel | [CSS Scroll-Driven Image Carousel](https://codepen.io/jh3y/pen/PovoorJ) | `jh3y` / Jhey | Public CodePen; CodePen documents public Pens as MIT licensed | Native React, Embla, and scoped-CSS adaptation |

The ledger links to [CodePen's licensing documentation](https://blog.codepen.io/documentation/licensing/) and records the retrieval date. It identifies which geometry or presentation ideas were retained and which source elements were omitted.

The adaptation must omit:

- source demo images and content;
- GSAP and ScrollTrigger fallback code;
- Tweakpane or other demo-control code;
- global `body`, `:root`, universal-selector, font, color-scheme, and page-layout rules;
- continuous or automatic animation;
- vertical-mode controls;
- demo-only backface behavior where MassageLab has no card back; and
- source HTML structure that conflicts with MassageLab semantics.

No new runtime dependency is required. The existing Embla dependency supplies shared carousel mechanics.

## Architecture

### Shared controller

One headless controller owns interaction and index state for all six prototypes. Its contract is comparable to:

```ts
type CarouselSurface = "backgrounds" | "stations";
type CarouselPresentation = "existing" | "cover-flow" | "three-d";

interface CarouselItemIdentity {
  id: string;
  label: string;
  disabled?: boolean;
}

interface CarouselControllerOptions {
  items: readonly CarouselItemIdentity[];
  initialItemId?: string;
  loop: boolean;
  visibleRadius: number;
  onCenteredItemChange?: (itemId: string) => void;
}

interface CarouselControllerState {
  centeredItemId: string | null;
  centeredIndex: number;
  canGoPrevious: boolean;
  canGoNext: boolean;
  effectiveLoop: boolean;
  scrollProgressById: ReadonlyMap<string, number>;
  mountedItemIds: ReadonlySet<string>;
}
```

The exact API may follow the existing shared carousel component, but responsibilities must remain equivalent. The controller owns:

- Embla initialization and teardown;
- drag and snap behavior;
- current item identity and index;
- finite or looping traversal;
- previous, next, Home, End, and focus-recenter behavior;
- centered-item announcements;
- continuous relative scroll progress for visual transforms;
- the bounded nearby-mount set; and
- reinitialization when filter results or item identity change.

The controller does not own:

- background selection;
- station playback;
- favorite state;
- access or billing decisions;
- card copy;
- preview-media creation; or
- lab tuning persistence.

### Presentation adapters

Presentation is a typed adapter that converts controller state and sanitized tuning into scoped CSS variables and structural class names.

```ts
interface CarouselPresentationAdapter<TTuning> {
  id: CarouselPresentation;
  defaults: (surface: CarouselSurface) => TTuning;
  sanitize: (surface: CarouselSurface, input: unknown) => TTuning;
  getItemStyle: (
    relativeProgress: number,
    tuning: TTuning,
    reducedMotion: boolean,
  ) => Readonly<Record<string, string | number>>;
}
```

Adapters do not fork carousel input behavior or card actions. They provide only the visual arrangement:

- **Existing:** current surface-specific presentation. Backgrounds use the current radial geometry; Stations use the current flat finite snap rail.
- **Cover Flow:** center-emphasized cards with side rotation, scale falloff, z-order, and optional artwork-only reflection.
- **3D Carousel:** a perspective arc with bounded nearby cards, depth, scale falloff, and edge masking inspired by the scroll-driven source.

The 3D adapter is not a literal DOM ring containing the entire catalog. It presents a virtualized visible arc around the active item so an 80-item background catalog does not create 80 simultaneously transformed media cards.

### Imperative transform path

Embla scroll progress changes continuously while dragging. The controller updates CSS custom properties on mounted card shells through Embla events or animation-frame-coalesced DOM writes. It must not set React state for every drag frame.

React state updates only for semantic changes such as the centered item, available actions, navigation availability, or the nearby mount set. This keeps visual motion smooth and avoids rerendering real cards during every pointer movement.

### Card renderers

Two renderers supply real content to the shared controller.

**Background card renderer**

- Uses the live background registry, filters, poster/video metadata, categories, selected state, and access result shape.
- Shows full details and the explicit Select action only on the centered card.
- Uses the real Track 1 popup shape for simulated locked states without calling billing or ownership mutations.
- Plays preview video only for the centered card when motion and visibility rules allow it.
- Renders nearby cards with poster art and a short title.
- Renders distant positions as lightweight indexed shells without media or action subtrees.

**Station card renderer**

- Uses live Music categories, stations, artwork, descriptions, attribution, loading state, favorite state, and Play/Stop behavior.
- Shows full details and actions only on the centered card.
- Uses static artwork for centered and neighboring stations.
- Prewarms only for centered, keyboard-focused, hovered, or pressed intent.
- Does not start playback when a non-centered card is clicked or centered.

Extraction must preserve the existing production action implementations. The lab may wrap those actions with dev-safe adapters, but it must not create a second playback or favorites domain.

## Carousel Lab Layout

`/dev/buttons` gains a clearly labeled **Carousel Lab** section.

1. A top-level segmented control switches between **Backgrounds** and **Music Stations**.
2. An inner segmented control switches between **Existing**, **Cover Flow**, and **3D Carousel**.
3. Only the selected surface/presentation prototype is mounted.
4. A compact tuning panel sits beside the prototype on wide screens and below it on narrow screens.
5. A compact readout summarizes the current tuning values even when the controls are collapsed.
6. A Reset action restores the curated defaults for only the active surface/presentation pair.

The Background surface contains the real filter UI and complete live background catalog. The Music Station surface contains a real category selector and the selected category's complete station list. The Music comparison does not flatten all categories into one rail.

The lab remains behind the existing development-route protections. Dev-only access simulation and tuning code must not be imported by production routes.

## Tuning Contract

Tuning exists to compare presentations, not to become a general layout builder. Each adapter declares only relevant controls; a disabled or irrelevant control is not displayed.

All numeric input is clamped, finite, and rounded to the step shown below.

### Shared controls

| Control | Background range/default | Station range/default | Step |
| --- | ---: | ---: | ---: |
| Card width | 160-280px / 208px | 168-320px / 208px | 4px |
| Gap | 0-64px / 16px | 0-64px / 20px | 2px |
| Nearby radius | 1-4 / 3 | 1-4 / 2 | 1 |
| Loop | Off | Off | Boolean |
| Motion | On | On | Boolean |

Nearby radius controls how many fully rendered neighbors are mounted on each side, subject to available item count. It does not hide valid catalog positions from keyboard or pointer navigation.

Loop is an evaluation control. If there are too few items for stable looping at the selected card width and nearby radius, the controller sets `effectiveLoop` to false and reports **Loop unavailable for this item count** without corrupting the saved requested value.

### Existing Background controls

| Control | Range | Default | Step |
| --- | ---: | ---: | ---: |
| Angular spread | 15-50deg | 35deg | 1deg |
| Radius | 160-420px | 285px | 5px |
| Scale falloff per position | 0.04-0.15 | 0.08 | 0.01 |

These values begin from the current production radial picker. Existing Stations has no adapter-specific geometry controls beyond the shared values because its purpose is to preserve the current flat snap-rail baseline.

### Cover Flow controls

| Control | Range | Default | Step |
| --- | ---: | ---: | ---: |
| Side rotation | 0-55deg | 33deg | 1deg |
| Center scale | 1-1.35 | 1.2 | 0.01 |
| Edge scale | 0.6-1 | 0.75 | 0.01 |
| Perspective | 400-1600px | 900px | 20px |
| Reflection | On | On | Boolean |
| Reflection opacity | 0-0.65 | 0.4 | 0.05 |
| Reflection gap | 0-24px | 8px | 1px |

Reflection applies only to the artwork or preview-media frame. It never reflects titles, descriptions, badges, status, or actions. The adapter uses a scoped mask/fade and has a non-reflection fallback where the browser does not support the preferred CSS property.

### 3D Carousel controls

| Control | Range | Default | Step |
| --- | ---: | ---: | ---: |
| Perspective | 240-1200px | 320px | 20px |
| Arc angle per position | 12-50deg | 22deg | 1deg |
| Depth | 80-520px | 280px | 10px |
| Center scale | 1-1.3 | 1.08 | 0.01 |
| Edge scale | 0.55-1 | 0.78 | 0.01 |
| Near mask falloff | 0.25-1.5 | 0.9 | 0.05 |
| Far mask falloff | 1-3 | 1.8 | 0.05 |

The near/far mask controls influence edge fade only. They do not make a focused or centered card invisible, and they do not remove accessible identity from unmounted visual details.

### Reduced-motion override

When `prefers-reduced-motion: reduce` is active, or the lab Motion control is off:

- all three presentations become a simple horizontal snap rail;
- rotation, perspective depth, scale animation, reflection, animated mask transitions, and looping animation are disabled;
- the same centered-item, explicit-action, keyboard, focus, and previous/next rules remain;
- dragging may still move the rail directly, but snapping does not animate; and
- preview video follows the existing reduced-motion static/poster rule.

The tuning panel retains the requested values so they return when motion is enabled. The current effective-mode summary clearly reports **Reduced-motion rail**.

## Tuning Persistence

The lab stores one sanitized tuning record per surface/presentation pair in current-device local storage under a versioned key comparable to:

```text
massagelab-carousel-lab-v1
```

The stored object contains exactly six entries. It contains no account ID, station state, background preference, billing state, clinical data, or other user content.

- Tuning survives refresh and browser restart on the same device.
- Tuning does not sync to an account or another device.
- Switching surface or presentation restores that pair's last sanitized values.
- Reset affects only the active pair.
- Missing entries receive curated defaults.
- A malformed entry resets only that pair.
- An unknown schema version is ignored and replaced with current defaults.
- Storage denial or quota failure keeps tuning in memory and shows no blocking error.

Track 3B copies only the two explicitly approved, sanitized default bundles into production source. It never reads this dev local-storage record at runtime.

## Interaction Contract

### Center before action

Clicking or tapping a non-centered card performs one action: center that card.

It never:

- selects a background;
- plays, stops, or changes a station;
- opens the locked-background decision popup;
- toggles Favorite; or
- navigates away.

The centered card reveals full details and explicit primary actions. Backgrounds show Select or the applicable locked-state action. Stations show Play or Stop plus Favorite. The user must activate that control separately.

### Pointer and touch

- Horizontal drag moves the carousel.
- A movement threshold distinguishes drag from click/tap.
- Vertical page scrolling remains available from the carousel on touch devices.
- Pointer cancellation and interrupted gestures leave a valid centered index.
- No presentation captures the pointer for free rotation.
- There is no automatic advance or continuous spin.

### Keyboard and focus

- Left Arrow centers the previous item.
- Right Arrow centers the next item.
- Home centers the first item in finite mode.
- End centers the last item in finite mode.
- Previous and Next buttons expose accurate disabled state.
- Tabbing reaches the carousel once and then the centered card's actions; it does not tab through hidden neighbor actions.
- Keyboard focus on a real card or its action recenters that item before exposing actions.
- Focus remains on a stable control when a card recenters or the adapter changes.
- Filter/category changes move focus to a useful surviving control rather than a removed slide.

### Announcements and semantics

The carousel uses a labeled region or group appropriate to the existing accessibility conventions. A polite live status reports semantic changes such as **Ocean Waves, item 4 of 18**. It does not announce every drag-frame transform.

Each indexed item retains its full accessible identity and state even when its visual neighbor presentation is shortened to art plus title. Hidden detail must not be duplicated into the accessibility tree. Decorative reflections, masks, and duplicate visual layers are `aria-hidden`.

## Content And Position Behavior

### Backgrounds

- The lab uses the full live background registry and real supported filters.
- When a filter changes, the selected background is centered if it remains present.
- If the selected background is not present, the first available result is centered.
- An empty result shows the real empty state and disables carousel navigation.
- A single result centers without loop, neighbors, or misleading navigation.
- Filter browsing position is session-only and is not an account preference.

### Music Stations

- The selected Music category uses its full real station list.
- Each category remembers its own centered station for the current page session.
- When `/music` or the lab initializes with an active station, that station is centered in its category.
- If playback was selected elsewhere and the active category is opened, its active station is centered.
- Ongoing playback progress does not repeatedly steal focus or recenter a carousel the user is browsing.
- Other categories retain their session positions when playback changes.
- Category position is not stored in the account or long-term local preferences.

Identity is keyed by stable background or station ID, never by an array index. When data changes, the controller preserves the centered identity if it survives, then uses the applicable fallback above.

## Background Access Simulation

The Background lab provides a dev-only state selector with these scenarios:

- Free;
- Owned;
- Subscriber-unlocked;
- Credit available; and
- Locked.

The selector passes a fixture shaped like the canonical access resolver result into the real Background card renderer. It does not alter a session, database, entitlement, cart, credit balance, or ownership record.

For Locked and Credit available scenarios, pressing the centered card's explicit Select action opens the approved three-action decision shape where applicable:

- **Use free credit**;
- **Buy for $1**; and
- **Unlock all**.

Actions terminate in clearly labeled dev-only outcomes. They must not call server actions, Stripe, cart mutations, or ownership mutations. Owned and Subscriber-unlocked states expose normal selection behavior inside the isolated lab only.

This fixture is an integration seam for Track 1, not a substitute entitlement implementation.

## Media And Resource Rules

- Only the centered Background card may mount and play its preview video.
- A centered preview starts only when the document is visible, the carousel prototype is mounted, reduced motion permits it, and the media is ready.
- Moving away pauses the video and releases unnecessary playback resources.
- Neighboring Background cards use poster images.
- Distant Background items retain only lightweight slide shells needed for stable indexing and measurement.
- Station art remains static; the carousel never creates video or audio previews for neighbors.
- Station prewarming occurs only for centered, focused, hovered, or pressed intent and uses the existing prewarm path.
- Unmounting a prototype removes Embla listeners, pending animation-frame writes, media listeners, and any intent prewarm started by the lab.
- Changing presentation mounts only the newly selected prototype. Hidden combinations do not remain alive offscreen.
- The DOM contains at most the full set of lightweight index shells plus the centered item and configured nearby radius of full card subtrees.

If `video.play()` rejects, the card keeps its poster and remains selectable. A failed image uses the existing media fallback without changing carousel identity or navigation.

## Responsive Behavior

- Desktop and wide tablet layouts show the carousel with enough protected space for transformed cards and artwork-only reflection.
- Narrow phones use the same horizontal interaction with smaller effective card sizing clamped to the viewport.
- The effective card width never exceeds the available carousel viewport minus navigation and safe padding.
- The tuning panel moves below the prototype on narrow screens.
- At 200% zoom, the centered details and actions remain reachable without horizontal page overflow.
- Short landscape layouts may reduce nearby mounted detail and visual depth before shrinking the centered action target.
- Carousel overflow is clipped within the lab stage; focus outlines and centered actions are not clipped.
- Tooltips are not required to understand tuning values or primary card actions.

The production-like surface width is part of the review. The lab must not give a presentation an artificially wide viewport that production Clock, Chimer, or Music layouts cannot provide.

## Error Handling And Recovery

- Missing, non-finite, or out-of-range tuning uses the adapter's sanitized value.
- Malformed persisted tuning resets only the affected surface/presentation pair.
- Empty and single-item catalogs remain valid controller states.
- Duplicate or missing item IDs fail visibly in development and fall back to the first unique valid item rather than corrupting navigation.
- A removed centered item uses the surface-specific identity fallback.
- Looping automatically becomes finite when the item count cannot support stable clones.
- Adapter changes clear stale inline transform variables before the new adapter applies its values.
- Unmounted neighbor actions cannot retain focus.
- Media errors retain poster/fallback content and explicit actions.
- Rejected media playback never produces an unhandled promise rejection.
- Storage failure leaves the lab usable for the current session.
- A failed access fixture cannot invoke production billing behavior.
- An adapter render failure is contained to the active lab panel and provides a Reset/retry path without breaking `/dev/buttons`.

## Validation Contract

### Pure tests

- Every adapter supplies defaults for Background and Station surfaces.
- Every tuning sanitizer clamps non-finite, malformed, fractional, and excessive values.
- Versioned local persistence restores six independent sanitized records.
- Reset changes only the active surface/presentation pair.
- Relative-position math is correct before, during, and after a wrap boundary.
- Finite navigation exposes correct first/last availability.
- Loop eligibility disables loop for insufficient item counts.
- Identity reconciliation preserves a surviving centered ID and applies approved fallbacks otherwise.
- Nearby-mount calculation includes the centered item and configured radius without exceeding catalog bounds.
- Reduced-motion resolution produces a flat finite rail and suppresses transform-only effects.

### Component and interaction tests

For all six surface/presentation combinations:

- pointer drag, tap-to-center, arrows, previous/next, Home/End, and focus recenter work;
- non-centered activation only centers;
- explicit Select, Play/Stop, and Favorite actions remain separate;
- centered details and neighbor summaries match the approved hierarchy;
- status announcements occur once per semantic center change;
- only centered actions are tabbable;
- filter or category changes preserve/fallback by stable identity;
- empty and single-item states remain usable;
- Reset and local restoration work; and
- switching tabs unmounts the previous prototype cleanly.

### Access and media tests

- All five dev-only Background access states render their expected card treatment.
- Locked/Credit available Select opens the three-action popup shape without a network or mutation call.
- Owned and Subscriber-unlocked states can exercise isolated selection behavior.
- Only the centered Background preview attempts playback.
- Neighbors render posters and distant items render lightweight shells.
- Moving center pauses the old video before the new preview becomes active.
- Rejected playback and missing media retain a usable card.
- Station prewarm occurs only for the approved intent states.
- Playback changes center the active station when initializing its category but do not continuously steal focus.

### Accessibility and responsive tests

- Keyboard-only review can reach every item and centered action.
- Screen-reader labels include complete identity, position, and relevant state without announcing transforms.
- Reflection and duplicated decorative layers are absent from the accessibility tree.
- Reduced-motion renders all three presentations as the approved flat rail.
- 200% zoom, phone portrait, short landscape, tablet, and desktop layouts have no page-level horizontal overflow.
- Touch dragging does not block vertical page scrolling.
- Focus indicators remain visible against real light and dark artwork.

### Performance checks

- Only one of six prototypes is mounted at a time.
- React does not rerender every card on each drag frame.
- Full card subtree count remains bounded by the configured nearby radius.
- Only one Background preview video is mounted/playing.
- Switching presentation or leaving the route removes listeners and pending animation-frame work.
- The full live catalog remains navigable without mounting full media/details for every item.

### Repository gate

- Add and review `docs/carousel-sources.md`.
- Run focused pure and component tests.
- Run focused desktop and mobile browser tests for `/dev/buttons`.
- Run `npm run lint`.
- Run `npm run typecheck`.
- Run `npm run test`.
- Run `npm run build`.
- Run `git diff --check`.
- Confirm production Clock, Chimer, and Music carousel implementations are unchanged in Track 3A.

## Review And Track 3B Handoff

Track 3A is complete only after the user reviews the lab and records:

```ts
interface ApprovedCarouselDecision {
  background: {
    presentation: CarouselPresentation;
    defaults: SanitizedCarouselTuning;
  };
  station: {
    presentation: CarouselPresentation;
    defaults: SanitizedCarouselTuning;
  };
}
```

There is no third Music-visualizer Background decision. The `background` choice is shared by Clock, active Chimer, and Music visualizer pickers.

The handoff also records any accepted surface-specific card dimensions, reflection setting, loop setting, and reduced-motion observations. Track 3B then receives a new design/specification pass against the production code and whichever Track 1, Track 2, and Track 4 contracts are current. It must not infer a winner from the last-open lab tab or local-storage tuning.

## Approved Decisions

- Split Track 3 into prototype/review Track 3A and production-rollout Track 3B.
- Build production-faithful prototypes, not static mockups.
- Compare exactly six combinations: two surfaces by three presentations.
- Use one eventual Background winner across Clock, active Chimer, and Music visualizer.
- Use one eventual Station winner for every Music category's station rail.
- Keep Music categories as vertically stacked sections rather than adding category-card carousels.
- Use the full real background registry and real Music categories/stations.
- Use a shared headless Embla controller with presentation adapters.
- Keep browsing separate from Select, Play/Stop, Favorite, and access actions.
- Show full details/actions only for the centered card and art/short title for neighbors.
- Keep complete accessible identity and state for every indexed item.
- Remember Background filter and Music category positions only for the page session.
- Center the active station when its category initializes without continuously stealing focus.
- Mount/play only the centered Background preview video.
- Keep Station art static and prewarm only on approved intent.
- Flatten every presentation to the same simple rail for reduced motion.
- Retain Cover Flow reflection on artwork only, with a dev toggle defaulting on.
- Add no automatic advance or continuous spin.
- Keep temporary tuning per surface/presentation on the current device only.
- Simulate Free, Owned, Subscriber-unlocked, Credit available, and Locked access without real mutations.
- Use native React, existing Embla, and scoped CSS; do not add GSAP, ScrollTrigger, Tweakpane, or another runtime.
- Keep Track 3A off production routes.
- Require two explicit user-approved winners and defaults before Track 3B begins.
- Add no public Roadmap entry for this work.
