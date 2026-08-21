# Atmosphere Physical Artwork, First-Play, and Compact-Landscape Player Design

Date: 2026-08-16

Status: Approved in conversation; written-spec review pending

Related design: `docs/superpowers/specs/2026-08-15-atmosphere-artwork-vinyl-player-design.md`

## Purpose

This supplement addresses three failures observed on a Samsung Galaxy S24 Ultra against the exact protected preview for commit `4c187f9fdd1bee793634e9840786ed74057ae8f2`:

1. Every carousel and player artwork request falls back to `MassageLab station artwork unavailable`, and Android notification and lock-screen surfaces show no artwork.
2. The first station Play touch/click is still not sufficient; a second activation starts playback.
3. The expanded bottom player consumes too much height on a phone in constrained landscape, forcing the user to scroll around the station carousel.

The same physical pass confirmed that the fabricated 10-second timeline is gone, Previous/Play-or-Pause/Next work from Android media surfaces, the compact player behavior is otherwise acceptable, and reduced motion appears correct but still needs a deliberate retest.

## Scope

This supplement covers:

- binary-safe delivery of the already-approved canonical station PNG;
- one authoritative first Play action on a cold physical-device path;
- a route-scoped right-side player rail for constrained phone landscape;
- container-aware Music carousel sizing within the remaining viewport;
- safe placement of menus, drawers, notices, popovers, dialogs, and fixed controls while the rail is exposed;
- repair of the GitHub browser-QA environment so its scoped WebKit project can launch;
- automated, hosted, and physical-device acceptance evidence.

It does not redesign the station artwork, add seeking or duration, change the approved player control semantics, apply the rail to portrait, squeeze content on other routes, certify Apple hardware, or merge the draft pull request.

## Evidence and diagnosis boundary

### Hosted artwork

The route itself is present and executing. The exact Vercel deployment built the route, Linux production-server tests decoded the artwork locally, Vercel logs recorded authenticated Samsung-era artwork requests as HTTP 200 cache misses and hits, and an authenticated request reported `Content-Type: image/png` with a nonempty body. Routing, station lookup, a missing Sharp package, and ordinary 404/500 failures are therefore not the leading causes.

The failure occurs after route execution and before browser image decoding. The leading hypothesis is that the serverless response boundary is treating the Node `Buffer` passed to `Response` as text. A non-byte-safe capture began with UTF-8 replacement bytes rather than PNG's `89 50 4E 47` signature, but that capture tool could itself have transformed the response. This remains a hypothesis until a byte-safe hosted check proves it.

The hypothesis test changes one variable: return the same Sharp output through an explicit `Uint8Array`. That exact commit is deployed, fetched with a byte-safe client, checked for the eight-byte PNG signature, and decoded in the protected preview. The change is retained only if that evidence turns green. Otherwise it is reverted before diagnosis continues.

### First Play

The carousel and shared Button paths call `music.playStation` from the first accepted click. Embla rejects drag initiation for protected Play descendants, slide centering ignores button clicks, and the shared Button invokes its click handler after press feedback. The leading failure boundary is later in playback startup.

The current provider begins carrier and runtime work concurrently but waits for both before starting the generator. On a cold phone, the finite silent carrier's `play()` promise can remain pending long enough for Tone's later resume/start to lose the initiating user-activation window. The second activation succeeds after the carrier and runtime are warm. Existing first-action tests replace Audio with an immediately resolving fake, so they cannot reproduce this boundary.

The proving test holds the first carrier start beyond the initiating task and makes the AudioContext resume boundary activation-sensitive. One real touch must still produce one accepted Loading intent and one generator generation without a second touch.

## Architecture

### Canonical artwork transport

The canonical station-art module, geometry, palette, motif, seed, URL, and page/Media Session ownership remain unchanged. Only the route's binary response transport may change. Carousel cards, expanded vinyl, compact vinyl, Media Session metadata, notification surfaces, and lock-screen surfaces continue to reference the same station URL.

Artwork failure remains nonfatal. Page surfaces retain the accessible neutral fallback, and playback proceeds independently. A successful fix must restore real station artwork rather than hiding or restyling the fallback.

### Authoritative first activation

An accepted Play action performs these operations without waiting for one another unnecessarily:

1. increment the provider's request/session generation and publish Loading;
2. claim the existing media carrier immediately;
3. continue the already-started runtime preparation;
4. start the generator as soon as its runtime is ready, without waiting for carrier readiness;
5. publish Playing only for the still-current request generation.

Carrier failure remains nonfatal to ordinary in-app generator playback. A pending or late carrier result cannot create a second generator or reverse explicit Pause, Stop, Previous, or Next. The visible card and player control become Stop as soon as the first Play intent is accepted, preventing a second Play intent during Loading.

### Route-scoped compact-landscape rail

The rail activates only when all of these are true:

- the current route is `/music`;
- a player is exposed;
- the viewport is landscape;
- viewport width is at most `60rem` (960px);
- viewport height is at most `31.25rem` (500px).

Portrait never enters rail mode. Other routes retain the existing top/bottom player behavior and ordinary scrolling even at the same dimensions.

The Music page becomes a two-column viewport workspace only in rail mode. The adaptive station workspace occupies the left column and the player occupies the right column. Shared CSS custom properties publish the current rail width and a right-edge exclusion inset for portal and fixed surfaces.

## Player rail layout

### Collapsed

The collapsed rail is `7rem` wide. It exposes only:

- the decorative vinyl;
- Play or Stop;
- Expand.

It does not add station text or secondary controls that compete with the available height. The controls retain accessible names and tooltips. The vinyl keeps its existing state-driven motion and reduced-motion contract.

### Expanded

The expanded rail width is `clamp(16rem, 34vw, 20rem)`. Its content is laid out relative to the rail rather than reusing the horizontal desktop-toolbar grid. It contains:

- active station identity and state;
- interruption notice when applicable;
- Player settings;
- Favorite;
- Previous, Play/Stop, and Next;
- Background;
- volume when the available rail height supports it;
- Minimize.

The approved visual hierarchy remains: destructive Stop, green Play, glow Previous/Next/settings/minimize, purple Favorite, and attention Background. The rail consumes the right safe-area inset once and occupies the height above the mobile app bar. It never becomes an independently scrolling toolbar.

## Music workspace and carousel

In compact landscape, `/music` uses the remaining dynamic viewport height rather than document height. Category controls and the group heading remain visible. The carousel receives the remaining bounded row and measures its own container.

The adaptive carousel may reduce the visible window to three cards and use smaller bounded card dimensions. The centered card remains fully legible and exposes its Play/Stop and Favorite actions. Side cards may remain summaries. Carousel navigation controls stay inside the workspace and do not require page scrolling.

The page must not gain vertical overflow merely because the player appears or expands. Expanding the rail changes the left column width, causing the carousel to recompute its layout from the new container without losing the centered station.

Portrait retains the approved bottom player and existing document-scrolling behavior.

## Overlay and fixed-surface safety

Rail mode publishes a zero-by-default right exclusion inset. When active, shared overlay primitives consume that inset so their usable viewport ends before the rail:

- player settings opens inward toward the Music workspace;
- the interruption notice stays inside the rail;
- dialogs center within the unobscured viewport;
- right drawers/sheets stop before the rail;
- dropdowns, popovers, and tooltips receive bounded width and collision space;
- fixed utility controls move inward by the rail inset plus their normal gap.

These rules alter placement only while rail mode is active. Non-Music content width and scrolling remain unchanged.

## Accessibility and motion

- The vinyl remains decorative and pointer-inert.
- Play/Stop and Expand remain reachable in the collapsed rail.
- Expanded controls preserve their existing accessible names, pressed states, disabled states, focus order, and tooltips.
- Player settings remains operable without hover.
- The fallback artwork continues to announce the affected station without duplicate vinyl announcements.
- `prefers-reduced-motion: reduce` prevents vinyl rotation in bottom and rail layouts.
- Enlarged text must not hide the primary transport controls or create rail scrolling.

## Validation

### Focused automated evidence

1. Artwork route tests assert PNG signature, content type, stable repeated bytes, distinct station hashes, successful browser decoding, and exact URL equality across carousel, vinyl, and Media Session metadata.
2. The hosted hypothesis test verifies the exact deployed `Uint8Array` response with a byte-safe client before the transport change is accepted.
3. A cold-start browser test holds carrier readiness, enforces activation-sensitive AudioContext resume, issues exactly one touch, and requires Loading/Playing plus one generator generation.
4. Loading tests prove repeated input creates no duplicate generator and explicit Pause/Stop defeats every late carrier/runtime completion.
5. Portrait phone tests prove the bottom player remains unchanged.
6. Compact-landscape tests cover representative `844x390` and Samsung-class landscape dimensions in expanded and collapsed rail states.
7. Layout tests prove the `/music` document does not vertically overflow, category controls and navigation remain visible, the centered card remains actionable, and expansion preserves the centered station.
8. Other-route tests prove ordinary content width and scrolling are unchanged.
9. Overlay tests exercise settings, interruption notice, dialog, right drawer, popover/dropdown, and fixed controls against the active right exclusion inset.
10. Motion tests prove Playing-only animation and reduced-motion suppression in both player placements.

### Proportionate gates

Run focused Node and browser suites first, then lint, typecheck, full Node tests, production build, desktop Chromium, mobile Chromium, and scoped WebKit media smoke. The GitHub QA workflow must install the configured WebKit browser so a missing executable cannot make the branch check red before its assertions run.

### Physical Android gate

Deploy the exact final candidate and repeat the affected Samsung Galaxy S24 Ultra observations:

- one centered Play touch is sufficient;
- carousel, expanded player, compact player, notification, and lock screen show the same station artwork;
- Previous and Next update title and artwork together;
- no fabricated 10-second timeline appears;
- portrait retains the bottom player;
- constrained landscape uses the right rail and the Music workspace requires no vertical page scrolling;
- collapsed and expanded rail controls match the approved sets;
- reduced motion is deliberately verified.

Rows involving installed PWA, Bluetooth/headset, in-app Stop, background return, carrier failure, calls, and meeting applications remain pending until actually exercised. No Apple hardware certification is implied.

## Release rule

PR #183 remains draft. Do not update canonical project-state or wiki truth, mark the PR ready, trigger the final CodeRabbit loop, or merge while any affected automated, hosted, or physical-device gate remains red. Every fix must start with the smallest reproducing RED, remain within audited non-admin paths, and receive independent review before release work resumes.
