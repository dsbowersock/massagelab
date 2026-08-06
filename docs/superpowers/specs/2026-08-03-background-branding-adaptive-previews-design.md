# Background Branding and Adaptive Preview Design

Date: 2026-08-03  
Status: Approved design; implementation planning has not started

## Summary

MassageLab will audit every selectable background against a restorative-laboratory naming system that leans toward wellness language. Strong existing names will remain. Approved renames will use one canonical user-facing name everywhere, paired with a short literal visual descriptor. Existing internal background IDs will never change because of branding.

Background previews will move from one uniform low-resolution capture to a manifest-driven rendition ladder. Each background will have an art-directed recipe for duration, poster timing, framing, and truthful looping. Low, standard, and high renditions will be generated for landscape, square, and vertical compositions. The picker will display a poster immediately and adapt video quality using connection, rendered size, device pixel ratio, measured throughput, and decoding health. The centered card plus two cards on each side will load and play concurrently on ordinary connections.

Naming approval, local media generation, remote publication, and production activation are separate gates.

## Current Baseline

- Background definitions already have stable IDs used by settings, favorites, access, commerce, and ownership.
- The generated preview manifest is keyed by those IDs and currently describes landscape, square, and vertical WebM assets.
- The production carousel uses the vertical preview inside a 5:7 card. A development review surface uses landscape media; square remains part of the authored media contract.
- The current generator uses one global six-second duration, 12 fps, VP9 CRF 44, and output sizes of 384x216, 384x384, and 216x384.
- The current runtime plays only the centered full-detail card and uses posters or registry fallbacks for other cards.
- The catalog contains naming debt, including duplicate visible labels and inconsistent voice, capitalization, specificity, and use of the MassageLab name.
- An earlier isolated quality experiment did not provide trustworthy visual proof that its very small clips captured live animated effects. The new pipeline therefore requires decoded-frame and visual validation, not only playable-file metadata.

## Goals

1. Give the catalog a coherent restorative, wellness-leaning laboratory voice without renaming backgrounds that already fit.
2. Keep names understandable by pairing branded titles with literal visual descriptors.
3. Make approved names canonical across every user-facing background surface.
4. Allow future display-name changes without migrations to settings, ownership, commerce, or media identity.
5. Show a useful poster immediately and the highest useful video quality the current connection and device can sustain.
6. Let five carousel cards play concurrently while prioritizing the centered experience.
7. Give each background enough time and an appropriate truthful loop to communicate its character.
8. Make capture, encoding, validation, publication, rollback, and review reproducible.

## Non-goals

- Renaming background IDs, purchase records, entitlement keys, saved-setting keys, or ownership references.
- Rebranding licensed adaptations as MassageLab originals.
- Demonstrating cursor, hover, tap, or drag behavior in recorded previews.
- Adding invented morphs, reversals, speed ramps, or other motion absent from the live background.
- Building HLS, DASH, or another segmented streaming platform for these short silent clips.
- Uploading media or activating a production manifest without a separate explicit authorization.
- Refactoring unrelated background renderers, palette controls, commerce flows, or carousel presentation.

## Architecture

The immutable background ID joins three independently testable units.

### Catalog identity and branding

The background catalog owns the current display name, visual descriptor, legacy search labels, source identity, and signature-original status. All user-facing consumers resolve copy through this canonical definition. Commerce, preferences, favorites, links, and ownership continue to use the unchanged ID.

### Preview recipe and generation

A recipe registry keyed by background ID owns capture and loop intent. The generator renders the real production `BackgroundHost`, captures one high-quality master per aspect, derives the rendition ladder, validates every asset, and emits a complete manifest revision.

### Runtime selection

The preview runtime consumes the generated manifest and chooses compatible poster/video assets for the current card, connection, and device. A carousel-level coordinator owns the five-card playback window and the shared download/decode budget. Individual media components remain responsible for playback, loop-boundary switching, and local fallback.

These boundaries keep naming decisions independent from encoding and allow the adaptive algorithm to change without changing catalog identity or generator recipes.

## Naming System

### Voice

The default voice is restorative laboratory with a wellness-first lean:

- Calm, sensory, and restorative
- Lightly experimental rather than overtly futuristic
- Specific enough to distinguish the visual
- Easy to pronounce, remember, and scan
- Free of medical promises, treatment claims, or diagnostic implications

`MassageLab` appears in a visible title only for a small signature collection of internally conceived visuals. Adapted or ported third-party effects remain ineligible even when their implementation or controls have been substantially transformed. Source attribution remains accurate in internal documentation regardless of the user-facing name.

### Canonical branding fields

Each selectable background needs the following conceptual branding contract:

- `id`: immutable internal identity
- `label`: one current canonical user-facing name
- `visualDescriptor`: a literal description of form and passive motion
- `legacyLabels`: prior user-facing names used only for search, support, and migration context
- `signatureOriginal`: true only for internally conceived MassageLab visuals
- Existing source/provider fields: unchanged attribution evidence

The visual descriptor should normally contain three to eight words, describe both form and motion where motion exists, and avoid repeating generic tags such as Animated or Premium. Ordinary UI shows the current label and descriptor, not a `formerly` annotation. Search may match legacy labels. Support and development diagnostics may expose them when needed.

### Audit rubric

Every selectable background is assessed for:

1. Voice fit
2. Visual and motion truthfulness
3. Uniqueness across the complete catalog
4. Pronunciation and scanability
5. Descriptor clarity
6. Medical-claim safety
7. Source-brand and attribution safety
8. Signature-original eligibility

The audit recommends `keep` or `rename`; it does not assume every background needs new branding.

### Review batches

The complete audit is reviewed in curated groups of approximately 10-15 backgrounds organized by visual character rather than source provider. Each row includes:

- Current name
- Keep/rename recommendation
- Recommended name
- Two or three alternative names
- Recommended visual descriptor
- Concise rationale
- Collision or similarity notes
- Signature-original eligibility

Preserved names remain visible in each batch so the collection can be judged as a whole. No catalog copy changes until its batch is approved. Once approved, the canonical label and descriptor propagate through Chimer, Clock, Music, Ambient, favorites, search, acquisition dialogs, carts, Account, and ownership history.

## Preview Recipe Contract

Each background has a declarative recipe with these conceptual fields:

- `backgroundId`
- `recipeRevision`
- `warmupMs`
- `durationMs`
- `posterTimeMs`
- `loopStrategy`: `natural` or `crossfade`
- `crossfadeMs` when the strategy requires it
- `frameRateClass`
- `passiveCaptureState`
- Optional landscape, square, and vertical framing overrides
- Review status and review evidence reference

Durations are chosen individually within an initial practical range of 6-18 seconds. A short effect must show a representative cycle; a slow effect must reveal meaningful evolution without becoming an unnecessarily large download. The pilot may adjust the range only if visual evidence shows a background cannot be represented truthfully within it.

Natural loops are preferred. When no usable natural cycle exists, a subtle crossfade may overlap ending frames with frames already present at the beginning. Crossfades must not introduce a visual state that the source cannot produce. Reversal, ping-pong playback, morphing, speed ramps, or fabricated interaction are not permitted.

All renditions for one aspect share identical timing and loop boundaries. Landscape, square, and vertical masters are captured independently from the live renderer rather than cropped from one master, preserving intentional framing in every shape. Capture uses passive defaults and never scripts cursor or touch behavior.

## Rendition Ladder and Asset Identity

The pilot begins with the following candidate dimensions:

| Tier | Landscape | Square | Vertical |
| --- | ---: | ---: | ---: |
| Low | 384x216 | 256x256 | 216x384 |
| Standard | 640x360 | 512x512 | 360x640 |
| High | 960x540 | 768x768 | 540x960 |

The pilot selects final frame-rate classes, codec settings, and byte budgets through visual comparison and measured five-card playback. Those calibrated values become explicit generator presets before full-catalog generation; full generation cannot begin while multiple pilot presets remain candidates.

VP9 WebM is the preferred codec, and v1 also generates an H.264 MP4 compatibility rendition for every aspect and quality tier. The browser selects a supported codec before applying the quality decision. Posters use high-quality WebP. The representative pilot must prove both codec paths before full-catalog generation.

Display names never appear in paths. Assets use:

`<background-id>/<recipe-revision>/<aspect>/<tier>.<extension>`

For example:

`massage-lab-wave-current/recipe-2/vertical/high.webm`

A display-name or descriptor change does not invalidate media. A capture, duration, loop, framing, codec, or material encoding change increments the recipe revision. Published revision paths are immutable.

## Generated Manifest

The generated manifest is the atomic application pointer to complete recipe revisions. Each rendition records:

- Stable background ID and recipe revision
- Aspect and quality tier
- URL and MIME type
- Codec
- Width and height
- Duration and frame rate
- Encoded bytes and SHA-256
- Loop strategy and loop-boundary metadata
- Matching poster URL, dimensions, bytes, and SHA-256

The manifest generator rejects incomplete aspect/tier sets, mixed recipe revisions, timing mismatches, missing posters, or asset metadata that disagrees with decoded media. The app never guesses a new revision path. It may retain existing legacy fallback behavior only for backgrounds that have not entered the new reviewed manifest contract.

## Five-card Runtime Adaptation

### Active window

The active playback window contains the centered card, the nearest two cards to its left, and the nearest two to its right. Carousel wrapping follows the carousel's canonical index behavior, and the active set is deduplicated if a future filtered catalog contains fewer than five items. Cards outside the active window remain poster-only and must not initiate video downloads.

The center receives first download and decode priority, followed by the immediate neighbors, then the outer neighbors. All five may reach their highest useful tier on a strong connection and capable device. Adjacent cards step down before the center when the shared budget is constrained. Because side cards render smaller, their highest useful tier may be lower while remaining visually lossless at their displayed size.

### Initial tier selection

The first selection uses:

- Data Saver preference
- Reduced-motion preference
- Browser connection hints when present
- Rendered card dimensions
- Device pixel ratio
- Supported codec information
- Session-local preview throughput
- Recent stalls, rendition failures, and decode health

Connection APIs are hints rather than authoritative measurements. The runtime maintains a short-lived estimate from actual preview transfers and evaluates the combined five-card workload. It does not persist network profiling or send it to analytics.

On an ordinary connection with no measurement history, the center begins at a conservative low or standard tier selected for its rendered size. Neighboring starts are staggered by priority. The poster remains visible until the first usable frame, so no spinner or blank transition is needed.

### Loop-boundary adaptation

A candidate higher or lower rendition is prepared separately while the current source continues playing. It replaces the current source only at a loop boundary. Identical timing across tiers lets the new source begin at the same authored boundary without a mid-motion jump.

Upgrades require both sufficient measured throughput and a ready buffer. Downgrades are prepared after repeated stalls, delivery below the required rate, or sustained decode pressure. Hysteresis and a cooldown prevent oscillation. Each of the five videos changes tier independently, but the carousel coordinator allocates the shared budget and protects center priority.

Browser playback-quality evidence, including dropped frames where available, prevents a fast connection from selecting five renditions that the device cannot decode smoothly.

### Data Saver and reduced motion

Data Saver or very slow connections receive poster-first presentation with an explicit `Play Preview` action. Reduced-motion users receive the same default. A deliberate play request enables adaptive playback for that card without changing the user's system preference. The safest useful initial tier is selected, and subsequent switches still occur only at loop boundaries.

The play action must be keyboard accessible, expose the background name in its accessible label, and communicate whether motion is currently playing. No autoplay occurs for these constrained states.

### Lifecycle and failures

Moving the carousel updates the five-card window. Newly included cards begin from posters and enter the priority queue. Cards leaving the window stop playback and cancel unfinished work where the browser permits. Hidden tabs pause all preview videos and suspend adaptation.

Failure follows this bounded chain:

1. Selected rendition
2. Next lower quality tier
3. Compatible alternate codec
4. Authored poster
5. Registry fallback style

Failures are remembered for the current visit so broken assets do not retry continuously. A card must never become blank because of preview failure.

## Representative Pilot

The local-only pilot covers approximately eight backgrounds representing materially different capture and compression behavior. The initial candidate set is:

- Massage Laba Lamp: signature original and slow gradient motion
- Silk: slow shader motion
- Wave Current: continuous directional flow
- DNA: structured CSS animation
- Hypercube: cyclic CSS animation and fine edges
- Galaxy: high-entropy particles
- Faulty Terminal: rapid detail and glitch motion
- MassageLab Tile Grid: internally conceived canvas animation

The exact set may substitute an equivalent background only when local inspection shows a candidate cannot exercise its intended motion class. The reason for substitution must be recorded in pilot evidence.

For all three aspects, the pilot compares candidate tiers, frame-rate classes, codec settings, natural and crossfade seams, per-background durations, poster timing, and five-card behavior under several connection and device conditions.

A local review surface shows synchronized renditions, loop-boundary replay, posters, encoded sizes, decoded-frame strips, and validation results. Generated pilot assets remain local and uncommitted in an isolated disposable worktree until visual approval; only deliberately reviewed source and specification changes may be promoted later through a separate implementation task. No R2 or production mutation is part of pilot generation.

## Validation and Testing

### Generated-media validation

Every asset must pass:

- FFprobe codec, dimension, duration, frame-rate, and MIME expectations
- Nonempty file and manifest byte/hash equality
- Full-file decoding without errors
- Poster/video pairing and aspect match
- Meaningful frame variation for animated recipes
- Absence of development indicators, error UI, or registry fallback capture
- Source-master-to-rendition quality comparison
- First/last seam checks appropriate to the declared loop strategy
- Complete timing alignment across quality tiers

Metadata and very small playable files are insufficient evidence. Animated captures require decoded-frame or visual proof that the intended renderer is present and changing.

### Runtime tests

Tests cover:

- Correct five-card active window, including carousel wrapping
- Center, near-neighbor, and outer-neighbor priority
- No video requests outside the active window
- Render-size and device-pixel-ratio tier ceilings
- Connection throttling and shared throughput measurement
- Upgrade and downgrade only at loop boundaries
- Hysteresis and anti-oscillation behavior
- Codec fallback and bounded retry behavior
- Carousel movement and cancellation
- Hidden-tab pause/resume
- Data Saver and reduced-motion poster defaults
- Keyboard-accessible explicit preview playback
- Poster and registry fallback after failures
- Dropped-frame/decode-pressure downgrades
- No blank frame or layout shift while video becomes ready

### Naming tests

Tests require:

- Unique canonical labels after each approved batch
- Nonempty valid visual descriptors
- Immutable IDs and unchanged identity-dependent references
- Legacy-label search without legacy labels leaking into ordinary UI
- Signature-original rules enforced against source identity
- Consistent canonical copy across all user-facing background consumers

### Manual acceptance

Manual review covers the local pilot and representative full-catalog batches at desktop, phone portrait, short landscape, reduced motion, Data Saver or equivalent throttling, and high-density displays. Review includes loop truthfulness, poster selection, five-card smoothness, readable side-card quality, and absence of jarring boundary switches.

## Rollout and Rollback

1. Approve the naming rubric and audit format.
2. Build and visually approve the local representative media pilot.
3. Freeze explicit ladder presets and recipe-schema rules from pilot evidence.
4. Implement and test runtime five-card adaptation against local fixtures.
5. Review naming in curated batches; apply only approved batches.
6. Generate and validate full media in reviewable batches.
7. Obtain separate authorization for immutable R2 publication.
8. Upload a complete new revision before changing the manifest.
9. Verify every remote object's status, MIME type, byte length, and SHA-256.
10. Activate the manifest in the app and complete the production verification matrix.

Immutable media uses long-lived CDN caching. The smaller manifest follows the application's revalidation policy and points only to complete revisions. Rollback restores the prior manifest pointer. A superseded revision remains at the origin for at least 30 days after activation and through successful validation of its successor, whichever is longer. Remote cleanup is a separate, explicitly authorized operation and never occurs in the activation rollout.

## Implementation Boundaries

The later implementation plan should divide work into branch-sized deliverables rather than combine catalog copy, generator changes, runtime adaptation, all generated media, and remote publication in one change. At minimum, it should separate:

1. Canonical branding fields, audit tooling, and naming-review batches
2. Preview recipe schema, generator, manifest, and local pilot surface
3. Five-card adaptive runtime and accessibility behavior
4. Approved full-catalog media generation and validation
5. Authorized remote publication and manifest activation

Each deliverable preserves existing ownership, settings, entitlements, commerce behavior, palette behavior, and background rendering unless the approved design explicitly changes it.

## Acceptance Criteria

The design is fulfilled when:

- Every selectable background has an approved keep/rename decision and literal descriptor.
- Approved names are canonical across every user-facing surface while IDs remain unchanged.
- Only internally conceived visuals may use visible MassageLab signature naming.
- Every reviewed animated background has approved recipes and complete low/standard/high renditions for all three aspects.
- Posters appear immediately, and the center plus two cards on each side play on ordinary connections.
- Quality adapts using both delivery and decode evidence, with switches only at loop boundaries.
- Data Saver and reduced-motion states remain poster-first with accessible opt-in playback.
- Media validation proves real animated renderer output and truthful loops.
- Publication is atomic, remotely verified, and reversible through the manifest pointer.
