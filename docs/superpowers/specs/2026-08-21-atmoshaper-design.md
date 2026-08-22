# AtmoShaper Design

Date: 2026-08-21

Status: Core mixer approved and implemented; AtmoShaper UI redesign approved for implementation planning on 2026-08-22.

## Context

MassageLab Atmosphere currently offers 57 hosted generative stations on `/music`, global playback through `MusicProvider`, responsive station-category rails, favorites, deterministic station artwork, media-session integration, interruption handling, and a persistent player bar. The final category button already reserves an AtmoShaper destination, but that destination is only a coming-soon state.

AtmoShaper will turn that destination into a unified sound-building workspace. A visitor can combine ambient loops, generated noise, one optional existing generator station, one binaural layer, and one isochronic layer into a single mix. The result behaves like one crafted Atmosphere station even though it is composed from several independently controlled sources.

Moodist is the primary product and catalog reference. AtmoShaper must remain a MassageLab-owned implementation integrated with the existing Atmosphere runtime rather than embedding Moodist or copying its UI. Moodist's catalog is also the first sourcing baseline: audit its existing 84 sound concepts and sources before searching elsewhere, retain every entry that passes MassageLab's licensing and quality requirements, and replace or improve only the entries that fail those requirements or have a clearly better candidate.

## Goals

- Let anyone build, customize, and play an AtmoShaper mix without an account or payment.
- Let a mix contain one sound or any supported combination; an existing generator station is optional.
- Preserve one global playback owner so an AtmoShaper mix and an ordinary Atmosphere station never play unintentionally at the same time.
- Make the workspace useful across phone, tablet, laptop, television, portrait, and landscape viewports without device-name branches.
- Offer a catalog targeting Moodist's 84 sound concepts, subject to verified no-cost commercial-use licensing and production audio quality.
- Offer approachable binaural and isochronic presets with optional advanced controls and neutral, non-medical wording.
- Allow unlimited saved mix records while making recall a Supporter benefit or a one-dollar permanent per-slot purchase.
- Preserve guest work through sign-in, sync signed-in work across devices, and avoid destructive conflict resolution.
- Build clear failure recovery so one bad layer does not collapse a healthy mix.

## Non-Goals

- Lo-fi YouTube playback is a separate later project with its own visible-player and policy requirements.
- Version one does not support user-uploaded audio, recording inside the app, arbitrary effect graphs, or user-authored DSP code.
- Version one uses standard AtmoShaper artwork. User-supplied artwork is later work.
- Public/community publishing, discovery, moderation, reporting, and shared mixes are later work. Saved mixes are private by default.
- AtmoShaper does not make therapeutic, diagnostic, sleep-treatment, brain-health, or other medical claims.
- The exact count of 84 launch-ready sounds is a target, not permission to include unclear, low-quality, or legally unsuitable audio.
- Provider catalog creation, live Stripe mutation, tax configuration, deployment, and production enablement are not authorized by this design approval.

## Product Model

An **AtmoShaper mix** is a versioned recipe that references catalog sources and generator settings. Audio media is never embedded in the recipe.

A mix may contain:

- Any number of ambient catalog layers, subject only to measured browser resource safety rather than an arbitrary product cap.
- Zero or one existing Atmosphere generator station as a foundation layer.
- Zero or one binaural layer.
- Zero or one isochronic layer.

A station foundation is optional. A single rain loop, one noise layer, one binaural preset, or any other individual source is a valid mix.

Each layer has a stable layer id, source id and source type, ordering position, volume, mute state, source-specific settings, and loading/playback/error state. A mix has a stable mix id, an optional purchased-slot id, name, artwork seed/reference, recipe version, creation and update timestamps, and access metadata. Future schema revisions migrate recipes rather than silently discarding unfamiliar fields.

## Architecture

### Global Playback Ownership

`MusicProvider` remains the site-global playback and player-bar authority. It owns the currently active playback mode, master transport state, media-session metadata, interruption behavior, and global stop/replace lifecycle.

It gains an explicit playback-source distinction:

- Ordinary Atmosphere station.
- AtmoShaper mix.

Starting an ordinary station stops and disposes the active AtmoShaper session before the station starts. Starting AtmoShaper stops and disposes an ordinary station before mix playback starts. Selecting an existing generator inside AtmoShaper does not start it as an ordinary station; the mix controller hosts it as AtmoShaper's optional foundation layer.

The bottom player represents the complete active mix, not its individual layers. It displays the mix name, AtmoShaper artwork, loading or failure state, play/pause, stop, and master volume. It must not create a second player bar.

### Temporary Sound Preview

AtmoShaper owns one optional temporary preview source in addition to its committed recipe layers. Preview uses the same global playback-ownership and shared-output contracts as the mix controller; it is never allowed to create an independent player or an unmanaged second audio owner.

Only one preview may exist at a time. Starting another preview fades out and disposes the first before the replacement becomes audible. When a mix is playing, preview layers over that mix. When no mix is playing, preview plays alone. Starting a preview while an ordinary Atmosphere station owns playback stops that station first. A user who wants an Atmosphere station combined with other sources adds the station as AtmoShaper's foundation layer.

Preview remains outside the recipe, collapsed Current Mix rail, persistence, player metadata, and saved-mix model. Adding the previewed source promotes it into a committed layer with a smooth handoff that neither duplicates the sound nor produces an obvious stop-and-restart. Preview stops on explicit Stop Preview, leaving AtmoShaper, starting ordinary playback, stopping all AtmoShaper audio, or unrecoverable preview failure.

The Sound Library exposes a persistent Previewing status strip whenever a preview is active. It identifies the source and provides preview volume and Stop Preview controls so the user does not need to find the original card again. Binaural and isochronic previews use the currently selected waveform and frequency configuration.

### AtmoShaper Mix Controller

A dedicated browser-only mix controller sits behind a small interface consumed by `MusicProvider` and the workspace. It owns layer creation, connection to a shared mix output, parameter changes, start/pause/resume/stop, and disposal.

The controller delegates source-specific work to isolated adapters:

- Ambient loop adapter.
- Generated noise adapter.
- Existing Atmosphere generator adapter.
- Binaural oscillator adapter.
- Isochronic pulse adapter.

Every adapter exposes a consistent lifecycle: prepare, connect, start, update safe parameters, fade, stop, retry where applicable, and dispose. UI components never manipulate Web Audio or Tone nodes directly.

Ambient and generator sources connect to per-layer gain stages and then one AtmoShaper master gain. New or replaced layers start silent and fade in. Removal and replacement fade out before disposal. Parameter changes ramp over a short bounded interval to avoid clicks. Editing a stopped mix updates its recipe without producing sound.

### Loading And Resource Use

Only selected layers load audio payloads. Catalog browsing may prefetch lightweight metadata but must not download every sound. Layer removal releases buffers, media elements, timers, subscriptions, and audio nodes that are no longer shared.

The UI has no arbitrary layer-count ceiling. The controller still protects the session from real resource exhaustion: if a requested layer cannot be prepared, existing playback continues and the new layer reports a recoverable error. Measurements during implementation establish safe decoding, memory, and concurrent-source behavior across the supported browser matrix.

## Workspace And Responsive Behavior

Selecting the AtmoShaper category replaces the normal station carousel with a purpose-built workspace rather than opening a separate popup player.

The workspace contains:

- **My Mixes**: unlocked, subscription-accessible, and locked saved mixes.
- **Sound Library**: ambient sounds, existing stations, binaural beats, and isochronic tones.
- **Current Mix**: ordered layers, per-layer controls, and master controls.

Master controls include Play/Pause, Stop, master volume, Save, and Save As. The current mix remains visible while the user explores the library.

The Sound Library is the primary full-width workspace. Current Mix is represented by a persistent narrow rail placed on the side opposite the configured application sidebar. A left application sidebar produces a right Current Mix rail; a right application sidebar produces a left rail. This remains true on phones and larger geometries.

The rail reserves only its narrow strip. Opening Current Mix slides an overlay drawer above the Sound Library without resizing, shifting, or squashing the library. On roomy tablet, laptop, desktop, and television geometries, the drawer has a bounded width and is modeless: the uncovered library remains visible and interactive. On narrow phone geometries, it uses nearly the full available content width, applies a subtle backdrop, contains keyboard focus, and restores focus to the opening control when closed.

The collapsed rail contains the drawer toggle, master Play/Pause and Stop controls, and one ordered icon for every committed layer. Each layer icon communicates loading, muted, and failed states, provides Mute/Unmute, and opens the drawer directly to that layer. The collapsed rail reflects recipe order but is not itself a drag surface.

The expanded drawer contains the complete master transport and every layer's volume, mute, retry, remove, and source-specific controls. Each layer row has a drag handle for pointer and touch reordering plus a keyboard alternative that supports grab, arrow movement, drop, and cancel. Reordering is organizational only and does not change audio routing or sound.

Adding the first committed layer opens the drawer directly to that layer and leaves it open until the user closes it. Later additions respect the user's current drawer state and do not force it open. Adding a source that is already present selects its existing layer instead of silently duplicating it, except for source types explicitly designed to support independently configured duplicates.

Layout thresholds derive from measured workspace geometry and CSS capabilities, not device labels, user-agent detection, or browser-zoom detection. The page must avoid document-level horizontal scrolling, keep controls reachable under enlarged text, preserve touch targets, and remain usable in constrained phone landscape. More space should reveal or enlarge useful content rather than leaving the core experience TV-small.

The rail and drawer account for the persistent global player, bottom navigation, application sidebar, and device safe-area insets. They must never cover those controls or create document-level overflow. Opening and closing use a side-aware transition that becomes immediate or minimal under reduced motion.

### Sound Library Visual Language

Sound Library categories use the same horizontally scrollable glow-pill language as the Atmosphere Station category rail. The selected category uses the purple selected glow; unselected categories use the warm orange glow. Endpoint padding preserves the full glow without masks or hard clipping, and keyboard selection scrolls the active pill into view.

Library cards use a fluid container-responsive grid. Collapsing Current Mix naturally gives the grid more usable space, while opening the overlay drawer does not recalculate or compress it.

Generated white, pink, and brown noise cards show deterministic decorative noise textures in their named color families, with sufficient contrast for text and controls. Any subtle decorative animation stops under reduced motion. Existing Atmosphere station cards use canonical station artwork. Binaural and isochronic cards use relevant wave or frequency imagery rather than generic empty panels. Future ambient catalog entries use licensed artwork or a cohesive generated illustration when no source artwork exists.

Add actions and Play AtmoShaper use the semantic forest/leaf-green success treatment. Preview remains a visually distinct secondary action. Binaural and isochronic waveform choices use glow buttons: purple for the current selection and warm orange for alternatives. Stop, Remove, Retry, and Mute retain their neutral, warning, or destructive semantics. Loading and unavailable states preserve control geometry to prevent layout shifts.

## Layer Controls

### Ambient And Noise Layers

Ambient catalog entries expose Add, Preview, source details, and credit/license details. Added layers expose volume, mute, replace, remove, loading, error, and retry controls.

Generated white, pink, and brown noise use native generation rather than loop assets when the implementation proves stable and efficient. They follow the same layer contract as catalog audio.

### Existing Station Foundation

The station library exposes the playable MassageLab generator catalog. Adding a station replaces any existing station foundation after confirmation when replacement would discard unsaved foundation-specific settings. The foundation retains safe station/runtime options supported by the existing adapter; AtmoShaper does not expose arbitrary generator internals in version one.

Station browsing and Preview use the same canonical artwork resolver as the ordinary Atmosphere station experience. Previewing a station does not start it through the ordinary station controller; it uses AtmoShaper's temporary-preview ownership path.

### Binaural And Isochronic Layers

Both tools start with friendly Delta, Theta, Alpha, Beta, and Gamma presets. Presets are starting configurations, not promised health outcomes.

Optional Advanced controls expose:

- Binaural carrier pitch and beat-frequency difference.
- Isochronic carrier pitch and pulse rate.

Values remain within validated audible and runtime-safe bounds. A mix may contain no more than one of each layer type. Each supports volume, mute, replace/preset change, remove, and smooth live parameter ramps.

Binaural controls display a concise headphone note because the effect depends on separate left/right tones. Isochronic controls identify the intentionally pulsing character. All descriptive text remains experiential and avoids medical, therapeutic, cognitive-performance, or sleep-treatment claims.

## Saved Mixes And Paid Recall

### Free Creation

Everyone can construct and play a mix. No sign-in, subscription, or purchase is required for the mixer, catalog, layer controls, or current-session playback.

Free users may create unlimited saved mix records. Saving is intentionally transparent rather than a surprise paywall. Before confirming a free save, the interface explains:

> This mix will be saved. Reopening it requires a Supporter membership or a $1 permanent unlock.

After saving, the current in-memory mix remains editable and playable for the active app session. Route navigation may preserve that active global session. A new browser session, reload, stopped/disposed session, or explicit attempt to recall the saved recipe applies the access decision.

Locked cards remain visible and retain the mix name, standard artwork, layer summary, timestamps, and access choices. A locked user may not start, edit, duplicate, or reveal the complete restorable recipe through the normal product interface.

### Supporter Access

Active Supporter access grants a dedicated feature key such as `atmoshaper_saved_mixes`; application behavior must never branch on displayed plan names. The feature grants recall, playback, editing, duplication, rename, favorite, and deletion for every account-owned saved mix while the entitlement is active.

If the subscription becomes inactive, mixes remain stored but non-purchased slots return to locked status. Revocation does not abruptly stop audio that is already playing; it applies on the next recall or new session. Individually purchased slots remain available.

### One-Dollar Permanent Slot

A signed-in user may purchase one permanent AtmoShaper mix slot for $1 through server-created Stripe Checkout. The purchase is a product transaction separate from one-time support and separate from background ownership. Its exact Stripe product, tax code, tax behavior, readiness checks, webhook events, refund/reversal behavior, and production activation require their own implementation and release review.

The ownership record belongs to a stable slot, not one recipe revision. A user may rename, clear, rebuild, and resave the mix assigned to that slot without paying again. Duplicating it or recalling another locked mix requires another available purchased slot or active Supporter access. Deleting the recipe leaves the purchased slot available for a replacement rather than destroying paid ownership.

Supporters may also purchase permanent slots if they want selected mixes to remain accessible after subscription loss.

Checkout completion alone does not grant access from the client. Signed webhook fulfillment or equally authoritative server reconciliation creates idempotent ownership. Canceled, incomplete, unsupported, refunded, disputed, or ambiguous payments fail closed according to the reviewed commerce lifecycle.

### Guest And Account Persistence

Signed-out saved records remain local to that device. A free working mix exists only in the live app session unless the user creates a locked save; it does not silently restore as an unlocked draft after a full reload. A guest purchase requires authentication, but the locked local mix and purchase intent survive the authentication round trip.

On sign-in, local records import non-destructively into the account. Stable ids prevent duplicate import. If a local and account record conflict, both versions are preserved with understandable labels rather than applying last-write-wins data loss.

Signed-in records synchronize across devices. Server storage keeps the authoritative account recipe, slot assignment, ownership, and revision/version metadata. Free signed-in users may see locked metadata across devices; recipe recall still requires current Supporter access or a purchased slot. Local caching keeps editing responsive for entitled users, but server access decisions remain authoritative.

## Sound Catalog Strategy

### Moodist-First Audit

Moodist's existing 84-sound catalog is the required starting inventory, not merely inspiration. Catalog work begins by enumerating all 84 upstream concepts and their referenced sources.

For each Moodist entry:

1. Identify the exact source file or source page, creator, and upstream catalog category.
2. Capture current license evidence from the original source rather than assuming the Moodist repository's MIT code license covers third-party audio.
3. Determine whether MassageLab may use, process, host, and deliver the sound in a commercial subscription-supported product without paying a license fee.
4. Audition the source for usefulness, cleanliness, loopability, artifacts, loudness, and behavior when layered.
5. Retain the sound when both licensing and quality pass.
6. Replace it only when licensing fails, evidence is unclear, quality is insufficient, or a meaningfully better source is available.

This approach should get AtmoShaper useful quickly while preserving a documented path to improve sound quality and licensing over time.

### Source Priority

Candidates are considered in this order:

1. Suitable Moodist-referenced sounds with verified rights.
2. MassageLab-owned recordings.
3. CC0 or public-domain sources, including suitable local Signature Samples material.
4. Other no-cost commercial-use sources with clear redistribution/hosting rights.
5. Attribution-required commercial-use sources when their quality makes creator credit worthwhile.

Reject non-commercial licenses, unclear “free” or “royalty-free” claims, uncertain authorship, licenses that do not permit the required hosted use, or sources whose evidence cannot be preserved.

The 84 concepts are a target. Every accepted sound must pass; a smaller verified launch catalog is preferable to filling a number with unsuitable media. Concepts without an acceptable source become a prioritized recording checklist describing the needed environment, duration, isolation, and loop characteristics.

### Evidence And Credits

Each catalog record preserves:

- Stable MassageLab source id and concept/category.
- Moodist reference id/source when applicable.
- Original source URL and downloadable asset identity.
- Creator and required attribution.
- License name, version, URL, and captured evidence date.
- Commercial-use, modification, hosting, and redistribution assessment.
- Local source checksum and processed-output checksums.
- Processing recipe, QA status, rejection/replacement reason, and reviewer notes.
- Hosted version and public-media URLs for each supported format.

Attribution appears on a central Sound Credits surface and in a subtle per-sound details view. Required notices remain available even if the source later disappears.

### Audio Preparation And Delivery

Raw candidates are not automatically production loops. Accepted sources are auditioned, trimmed, cleaned conservatively, given seamless loop boundaries or bounded crossfades, loudness-balanced, and tested both alone and in dense mixes. Processing must not erase required notices or exceed the source license.

Lossless masters, downloads, and license evidence remain outside Git. The repository stores catalog metadata, processing instructions, checksums, license references, tests, and hosted manifests. Production audio is published under versioned immutable public-media paths with browser-appropriate formats and fallbacks, range support, correct content types, CORS, and verified hashes.

## Error Handling

- A single layer load, decode, generator, or playback failure does not stop healthy layers.
- A preview failure leaves the committed recipe and healthy mix playback unchanged, reports the problem in the Previewing status area, and returns the source card to a retryable state.
- Loading guards prevent duplicate Preview or Add requests for the same source.
- A failed addition leaves the existing mix unchanged and provides Retry, Replace, and Remove actions.
- Replacing a layer does not dispose the working source until the replacement is ready to fade in.
- If every selected source fails, the mix enters a clear failed state while preserving the recipe.
- Stopping or removing layers disposes their resources even after partial startup.
- Browser audio-policy failures explain the required user action without repeatedly spawning audio contexts.
- Storage failures preserve the in-memory mix and explain that the save was not safely recorded.
- Sync conflicts preserve both versions. Unsupported future recipe versions fail read-only rather than being overwritten.
- Checkout and fulfillment failures preserve the locked mix and safe purchase intent without granting access.
- Subscription or ownership checks that cannot be confirmed fail closed for recall while leaving stored data intact.

## Accessibility And Motion

- Every layer and master control has a visible label, keyboard operation, and screen-reader name/value/state.
- Drawer toggle, Preview, Add, transport, mute, remove, and collapsed layer icons have explicit accessible names, visible focus states, and practical touch targets.
- Volume and frequency controls use bounded ranges, useful steps, arrow-key support, and readable values.
- Mute, remove, retry, and locked states do not rely on color alone.
- The narrow drawer contains focus while open. The roomy modeless drawer permits focus movement between the drawer and visible Sound Library. Both restore focus predictably when closed; focus also remains predictable when layers are removed or checkout/authentication returns.
- Drag handles support pointer and touch input plus keyboard grab, move, drop, and cancel. Reordering announces the layer's new position, and layer order is available as text rather than only spatial position.
- Reduced motion removes decorative movement while retaining short audio ramps needed to prevent clicks.
- Error, add, remove, reorder, preview, save, purchase, and playback changes use appropriate live-region announcements without narrating continuous slider movement.

## Testing And Validation

### Deterministic Tests

- Recipe creation, validation, versioning, and migration.
- One-per-type station, binaural, and isochronic constraints.
- Layer ordering, mute, volume, replace, and removal state transitions.
- Temporary preview ownership, one-preview replacement, volume, promotion into a committed layer, cleanup, and ordinary-station replacement.
- Drawer side derivation from the configured application sidebar, first-layer discovery behavior, later-addition stability, and organizational-only reordering.
- Global ordinary-station versus AtmoShaper ownership and cleanup.
- Save/Save As, unlimited locked records, slot assignment, rename, duplicate, favorite, clear, and delete behavior.
- Feature-key access, subscription lapse, permanent slot persistence, and server-authoritative checkout fulfillment.
- Guest import, stable-id deduplication, cross-device revisions, and preserve-both conflicts.
- Catalog completeness, unique ids, license/evidence requirements, format manifests, and checksum validation.
- Binaural/isochronic preset bounds and click-free parameter scheduling contracts.

### Browser Tests

- Free construction and playback without authentication.
- Preview plays without committing a layer, layers over an active AtmoShaper mix, replaces a previous preview smoothly, promotes through Add without duplication, and stops at every defined lifecycle boundary.
- Clear pre-save disclosure and locked recall behavior.
- Supporter recall and permanent-slot recall.
- Auth and checkout round trips preserve the intended mix.
- Active mix state and one player bar survive internal route navigation.
- Starting ordinary playback and AtmoShaper replace each other correctly.
- Partial layer failures preserve other playback and expose recovery.
- The opposite-edge rail and overlay drawer behave correctly for both sidebar positions; roomy drawers leave the visible library interactive while narrow drawers contain and restore focus.
- Wide, narrow, portrait, landscape, enlarged-text, reduced-motion, keyboard, and touch layouts remain usable without library squashing, document overflow, or bottom-control collisions.
- Drag-handle reordering works by pointer, touch, and keyboard while collapsed rail ordering remains accurate.
- Glow-pill categories preserve endpoint glow; noise visuals, canonical station artwork, waveform glow controls, and semantic forest-green Add/Play actions render with accessible contrast.
- Browser reload, interrupted load, offline/slow media, storage denial, and unsupported recipe cases fail safely.

### Audio And Performance QA

- Confirm seamless boundaries, sensible loudness, clean fades, and no clicks for each asset and generated source.
- Test every layer alone and representative sparse and dense combinations.
- Measure initial load, incremental layer load, decoded memory, CPU, battery-sensitive behavior, and resource release on representative mobile, tablet, desktop, and large-screen browsers.
- Confirm selected-only loading and verify that browsing the complete catalog does not fetch all audio.
- Confirm interruption, media-session, background-return, and explicit-stop behavior remains compatible with the current Atmosphere player contract.

Standard repository validation remains required: Prisma validation/generation when schema changes, typecheck, lint, focused tests, full tests, production build, `git diff --check`, and focused real-browser acceptance.

## Delivery Structure

Implementation proceeds through separately reviewable work packages while preserving one coherent product contract. The core recipe model, mix controller, representative generated sources, optional station foundation, player integration, initial workspace, and first acceptance gate are implemented. Remaining work proceeds in this order:

1. Opposite-edge Current Mix rail and overlay drawer, temporary preview lifecycle, drag-handle reordering, and cohesive Sound Library visual redesign.
2. Moodist-first catalog audit, production processing pipeline, hosted catalog, and recording-gap list.
3. Local/account persistence, guest import, non-destructive sync, and locked My Mixes experience.
4. Supporter feature entitlement and one-dollar permanent-slot commerce with separate provider/tax readiness.
5. Integrated catalog failure recovery, accessibility, performance, browser matrix, audio QA, and release evidence.

Internal work may land incrementally behind an inaccessible or explicit development gate. The public category should not expose an incoherent half-built workflow.

## Acceptance Criteria

- A visitor can build and play a valid AtmoShaper mix from one source or any supported combination without paying or signing in.
- AtmoShaper and ordinary Atmosphere stations never play unintentionally at the same time.
- Layer addition, removal, replacement, volume, mute, and source-specific changes are smooth and independently recoverable.
- Every library source can be previewed without committing it; only one temporary preview exists, and Add promotes it without audible duplication.
- The global player represents the complete AtmoShaper mix and no second player bar appears.
- Current Mix remains available as an opposite-edge collapsed rail and opens as an overlay drawer without squashing the Sound Library.
- Roomy overlay drawers leave the uncovered library usable; narrow drawers manage and restore focus.
- Layer order can be changed with accessible drag handles, and the collapsed rail reflects that order without implying an audio-routing change.
- The Sound Library uses Atmosphere-style glow category pills, generated color-appropriate noise art, canonical station art, glow waveform controls, and semantic forest-green Add/Play actions.
- The workspace responds to available geometry across supported viewport shapes without device-name or zoom branches.
- Free users can create unlimited clearly disclosed locked saves.
- Active Supporter access recalls all mixes; inactive access relocks non-purchased mixes without deleting them.
- Each completed one-dollar purchase provides one permanent reusable mix slot, fulfilled through authoritative server evidence.
- Guest mixes import safely after sign-in and account conflicts preserve both versions.
- Catalog work audits Moodist's 84 entries first, retains qualifying sources, documents every decision, and replaces only failed or meaningfully improvable entries.
- Every shipped sound has preserved commercial-use evidence and passes loop, loudness, format, hosting, and mix QA.
- Binaural and isochronic presets are approachable, advanced controls are bounded, and no medical claims are made.
- One failed layer does not collapse a healthy mix or erase its recipe.
- Lo-fi YouTube playback, user artwork, and public mix sharing remain outside this implementation.

## External References

- Moodist repository and catalog reference: https://github.com/remvze/moodist
- Moodist code license: https://github.com/remvze/moodist/blob/main/LICENSE
- Moodist sound data: https://github.com/remvze/moodist/tree/main/src/data/sounds
- Pixabay license summary: https://pixabay.com/service/license-summary/
- Creative Commons CC0: https://creativecommons.org/public-domain/cc0/
- Signature Sounds: https://signaturesounds.org/
- Stripe supported currencies and minimum charge amounts: https://docs.stripe.com/currencies

These references are discovery inputs, not blanket approval. Each shipped audio asset and each live commerce configuration still requires item-specific evidence and review.
