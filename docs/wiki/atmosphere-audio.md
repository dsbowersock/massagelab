# Atmosphere Audio

This page records source, licensing, and runtime findings for the public Atmosphere audio branch series.

## Current Product Boundary

Atmosphere is a public, non-clinical audio workspace. It does not store PHI, therapist professional records, client appointment details, or clinical notes. The public station surface lives under `/music`, the old `/atmosphere` and `/wellness/atmosphere` page URLs are not retained, the breathing pacer lives under `/wellness/breathing`, and `/browse` remains a compatibility grid/workbench for the same station runtime while future experiments are staged.

## Runtime Decision

MassageLab hosts the audio runtime in the app. It does not embed Generative.fm as a remote player UI. `/music` now exposes the local Tone.js proof station plus the full Alex Bainter Generative.fm package catalog through the global music provider, route-persistent playback, grouped station browsing, Atmosphere-only swipe/scroll station rails, deterministic organic-geometric SVG station artwork, and the placement-aware audio toolbar opposite the selected app bar edge. All 57 Generative.fm package stations are currently playable from hosted public-media sample indexes. `/wellness/breathing` carries the first public Calmness-style breathing guide as a separate Wellness tool that does not store account data or clinical records. The hosted Generative.fm runtime prewarms sample-index metadata and browser modules for a small starter set during idle, warms compressed sample payloads only for a tiny starter subset and deliberate hover on healthy connections, and batches provider sample fetch/decode work so large stations do not request every sample in one unbounded burst. Actual Tone start, Transport start, output nodes, and WAV fallback payload loading remain user-gesture gated. The audio toolbar shows loading progress while a station prepares and offers previous/next station controls; supported browsers also receive Media Session metadata and play/pause/stop/previous/next handlers for notification and lock-screen controls. Generative.fm handoffs fade the outgoing station down and fade the incoming station up to soften abrupt first notes. All playable Generative.fm stations have Ogg Opus, AAC/M4A, and MP3 sidecar indexes for broader browser coverage, and keep their original WAV indexes as the final fallback.

## AtmoShaper Core Mixer Boundary

AtmoShaper is a live-session mixer inside `/music`. It supports multiple generated white, pink, and brown noise layers, multiple approved ambient catalog layers, plus at most one existing Atmosphere station foundation, one binaural layer, and one isochronic layer. Adding another layer of an exclusive kind replaces the existing layer of that kind; the recipe domain enforces the same rule independently of the interface. Ambient layers stream the exact reviewed production catalog through the same private-output and promotion boundaries as the generated sources.

AtmoShaper and ordinary stations share the existing global music provider and exactly one global player. Starting either source replaces the other, and an AtmoShaper mix is represented to Media Session as one item with play, pause, and stop actions but no previous/next station actions. Its platform metadata uses the existing 512×512 MassageLab icon as standard AtmoShaper artwork; user-selected mix artwork remains a later package. Per-layer failures remain isolated so healthy layers can continue while the failed layer offers source-named Retry and Remove controls.

The Sound Library can audition one temporary source through that same provider-owned mixer runtime. A preview by itself does not publish the global player or Media Session identity; it replaces any prior preview, may layer over an already playing AtmoShaper recipe, and is stopped by route cleanup or a competing playback owner. Adding the matching preview promotes its stable layer id and live audio handle into the committed recipe, so the interface publishes one AtmoShaper player without starting a duplicate source. Preview volume, failure, Retry, and Stop Preview remain separate from committed-layer state until promotion and render in a reserved area of the matching source card, so preview state does not move the category rail or library grid. The category rail is transparent and reserves vertical glow space. Binaural and isochronic views share one centered, feathered decorative wave canvas sized to 110% of the library content width behind their immediately reachable titles, presets, and advanced controls; horizontal library clipping removes the canvas overflow without introducing a nested panel or hard-edged image border. After an explicit committed Stop, late playing or failed callbacks are rejected before they can mutate either preview-facing or global playback state; preview-only snapshots remain publishable, the authoritative stopped callback is accepted, and a later explicit Play begins a new accepted session.

Current Mix is one continuously mounted full-height rail on the screen edge opposite the configured app sidebar. The rail observes the shell, safe-area, player, and bottom-bar boundaries in both states and animates its own width inward; there is no separate collapsed strip or replacement drawer. Mix, transport, whole-mix volume, and layer controls retain their DOM identities and vertical anchors while their slots stretch into the expanded layout. The expanded rail overlays rather than resizes the Sound Library. Measured workspaces at least `42rem` wide and `32rem` tall use modeless behavior that also collapses when the user clicks the library outside it; every smaller workspace uses a backdrop, contained focus, Escape close, and semantic opener restoration while keeping the same controls mounted. Adding the first committed layer expands the rail for discovery, while later additions preserve the user's collapsed or open choice. Each compact rail tile uses its full-width source label as the panel opener, followed by equal icon actions for Mute/Unmute and Solo/Unsolo. The compact whole-mix Volume control remains within the exact shared slot with a complete Outline border, then expands into the separately labeled outlined horizontal slider rather than exposing an imprecise vertical slider. Solo uses the existing recipe mute controls across both states: entering it snapshots the exact mute pattern, mutes every other layer, and leaving it restores that pattern rather than unmuting everything. Expanded rows align name/status with destructive Remove and a drag handle, and place Mute and Solo beside the layer-volume slider. Both states use the same Play/Stop control; Stop uses destructive intent, while the separately labeled whole-mix slider controls master volume. Drag handles support pointer, touch, and keyboard sorting. Sorting changes recipe organization only: active audio handles and playback continue unchanged. Explicit Stop starts the standard 60-second stopped-player retention deadline immediately, before asynchronous AtmoShaper teardown; restart or replacement cancels that deadline, and its generation/owner checks keep stale retirement from removing newer playback. After any awaited preview teardown, the Stop continuation rechecks that same ownership before synchronously invalidating the runtime lease, so a retained-player restart cannot be disposed by the older Stop.

Tone, generated-audio adapters, and station runtimes remain behind the provider's browser-only dynamic import and do not load with the workspace UI. The current recipe is memory-only for the live app session: this package does not save it, silently restore it after a full reload, or grant recall access.

Provider diagnostics and one-shot adapter failure injection exist only in the isolated browser-QA build selected by `NEXT_PUBLIC_ATMOSHAPER_BROWSER_QA=1`. Ordinary production builds resolve those imports to a marker-free substitute, and the production-bundle check rejects any emitted diagnostics global, failure request, or injected-failure message. The QA owner additionally requires an enabled request on a loopback hostname and exposes only public provider/runtime snapshots, never private Tone nodes.

Saved mixes, Supporter feature-key recall, one-dollar permanent slots, user artwork, public sharing, and lo-fi tools remain separate later packages. The ambient catalog does not imply that those entitlement, commerce, sharing, or persistence gates are complete.

## AtmoShaper Production Ambient Catalog

The first production ambient release contains 51 reviewer-approved concepts: four checksum-bound processed concepts and 47 exact dynamic concepts. Retired or rejected batches, the source-insufficient hold, and Moodist concepts that still need recordings are excluded. The development review interface remains available for future intake without becoming production runtime state.

`data/atmoshaper/production-audio-catalog.json` is the browser-safe release owner. Its catalog revision is derived from the validated catalog body and each concept retains its review fingerprint, exact source pool, scheduling configuration, optional runtime policy, and optional one-recording selection policy. Runtime validation fails closed on missing formats, malformed checksums, duplicate concept identities, or an invalid source selection.

Each distinct reviewed audio payload is stored once under `atmosphere/atmoshaper/v1/audio/<payload-sha256>/` in the existing `massagelab-public-media` R2 bucket. Every payload has Ogg Opus, AAC/M4A, MP3, and the exact source file. The browser chooses the first supported rendition in that order. Object keys and the catalog key are immutable and checksum-addressed; audio uses one-year immutable caching while catalog metadata uses short revalidation caching.

The production adapter reuses the exact reviewed scheduler for whole-source sequencing, event spacing, walking cadence, crossfades, pauses, overlapping voices, multi-lane playback, and fixed or random source regions. Media elements are connected through Web Audio gain nodes to the AtmoShaper layer output so per-source leveling, layer volume, mute, solo, pause, preview promotion, and master volume remain authoritative. Boiling Water uses its selected processed artifact: the one-time opening plays once, then the artifact-local loop repeats from 82 seconds so the baked 8-second equal-power seam remains intact.

Use the reproducible local release workflow only after the prepared catalog is fully approved:

```powershell
npm run atmoshaper:production:check
npm run atmoshaper:production:plan
npm run atmoshaper:production:stage -- --staging-root "<task-owned-external-directory>"
npm run atmoshaper:production:upload -- --staging-root "<task-owned-external-directory>"
npm run atmoshaper:production:verify -- --staging-root "<task-owned-external-directory>"
```

Staging rechecks every source checksum and uses the approved FFmpeg toolchain. Upload is idempotent and publishes the catalog only after all audio objects pass public content-length and media-type checks plus browser byte-range and CORS verification. No audio binary, R2 credential, or machine-absolute source path belongs in Git.

## AtmoShaper Sound Catalog Audit and Processing Workflow

Moodist media is retired and is not an audio source or fallback for AtmoShaper. The repository retains only Moodist's exact 84 non-binaural concept identities and upstream asset references as research evidence. AtmoShaper's five binaural presets are a separate generated-audio catalog and are not included in those 84 concepts. No Moodist binary may be copied, processed, published, or used as a fallback.

The user accepts the [Signature Sounds site-wide CC0 statement](https://signaturesounds.org/about-) as license evidence for this downloaded library. A pack-specific CC0 file remains stronger evidence when one exists. Either evidence tier records provenance only: it does not satisfy the independent technical, full-listening, processing, publication, or runtime gates.

The repo-relative [2026-08-23 catalog audit](../superpowers/reports/2026-08-23-atmoshaper-signature-sound-catalog-audit.md) records the full read-only local scan:

- 100 top-level packs and 3,693 audio files totaling 9,995,726,103 bytes.
- 3,587 WAV, 69 MP3, 35 AIF, and 2 AIFF files. MIDI is excluded.
- 239 groups in which two or more files have the same audio-file checksum.

The initial 2026-08-23 audit had four decision lists. They are retained as historical discovery evidence; the production boundary is the separately validated 51-concept release above.

| List | Audit result | Meaning |
| --- | --- | --- |
| Qualified Moodist matches | 0 | No Signature Sounds candidate has passed technical review, full listening, and verified processing. |
| Needs audition or processing | 7 | Campfire, Cafe, Crowd, Road, Traffic, Waves, and Wind Chimes are mapped to Moodist concepts but still have pending technical, listening, and processing gates. |
| Recording or source gaps | 74 | These concepts have no active candidate in the production declaration. This is a declaration gap, not proof that the downloaded library lacks a possible recording; the exhaustive discovery review below is the broader listening queue. Native white, pink, and brown noise are generated and are never recording gaps. |
| Signature-only concept candidates | 9 | Air Traffic Control, Cave Room Tone, Church Bells, Lunar Wind, Male Choir, Open Field Ambience, Room Tone, Stadium Crowd, and Train Station Announcement are exploratory ideas outside the 84-concept taxonomy and production catalog. Product approval would be required before treating an extra concept as a catalog assignment. |

At that audit checkpoint all 16 declared candidates were technical-pending, listening-pending, and processing-pending. Filename similarity and accepted license evidence did not amount to listening approval or production qualification.

### Exhaustive local candidate review

The follow-up discovery pass explicitly reviews all 100 top-level packs and partitions all 3,693 scanned recordings. Its generated, checksum-bound manifest contains 926 proposed candidate sources, 2,738 explicit exclusions, and 29 intentionally unclassified sources. The proposals span 34 of the 84 Moodist concepts and 59 Signature-only ideas. In particular, it includes all 8 files in the dedicated Footsteps in Snow pack and all 246 files explicitly labeled Walking On Stoney Pathway in Forest Kit. The latter propose both Moodist `walk-on-gravel` and the more literal Signature-only `Walk on Stone` concept.

Regenerate the manifest after the local library or review rules change:

```powershell
npm run atmoshaper:sounds:discover -- "<signature-root>"
```

The generator first requires the committed review rules to match the exact filesystem pack names, then hashes every allowed audio file and atomically publishes `data/atmoshaper/signature-sound-review.json`. Every file remains visible as candidate, excluded, or unclassified; no machine-absolute source root is serialized.

Start the complete local listening workspace with every server-only audio root configured. Keeping these together is important: the concept pages use the raw Signature root, retained processed-audio batches use the catalog and compatibility roots, and speech-reduced concepts use the separately anchored speech root.

```powershell
$env:ATMOSHAPER_SIGNATURE_SOUNDS_ROOT = "<signature-root>"
$env:ATMOSHAPER_SIGNATURE_DERIVED_CATALOG_ROOT = "<derived-catalog-parent>"
$env:ATMOSHAPER_SIGNATURE_DERIVED_ROOT = "<single-derived-batch-compatibility-root>"
$env:ATMOSHAPER_SIGNATURE_SPEECH_REDUCTION_ROOT = "<retained-v1-speech-bundle-root>"
$env:ATMOSHAPER_SIGNATURE_SPEECH_REDUCTION_TRAFFIC_ROOT = "<traffic-v2-speech-bundle-root>"
npm run dev -- --port 3013
```

Open `http://localhost:3013/dev/candidates`. The hub, review pages, and byte-range audio route return 404 in Production. The lightweight hub links to separate recording and concept pages so thousands of recording controls are not mounted beside every concept preview. Only the two review pages load the full manifest:

- `/dev/candidates/recordings` auditions individual recordings, keeps an overall Keep/Maybe/Reject observation and note, assigns one recording to multiple existing concepts, and creates local custom concepts.
- `/dev/candidates/concepts` reviews exact per-concept ingredients and dynamic playback. Every recording in a concept remains visible, including removed recordings, with Include/Remove, a concept-specific note, and Play This in Setup for included ingredients.

Both pages use one closed version-3 browser workspace tied to the exact discovery and curation fingerprints. On first open it safely migrates valid version-1 recording work and version-2 group work independently; the older keys remain untouched as recovery inputs. A recording removed from one concept stays available in every other concept, and a custom concept appears immediately in the concept queue. Either review page exports the one complete JSON handoff.

Each active concept shows its proposed and selected strategy plus exact Included/Removed/Total counts. Whole-source and adaptive one-shot concepts expose end-to-end, crossfade, or overlap timing; walking concepts expose steps per minute and cadence variation; spaced-event concepts expose minimum and maximum gaps. Start Preview performs the selected strategy, Stop Preview retires every preview-owned voice and timer, and Next Transition or Next Event exposes boundaries without waiting through a long recording. Play This in Setup begins that same dynamic setup from the selected included recording rather than creating a second audio player.

Approve Heard Setup stays disabled until the exact included source IDs, strategy, and tuning have started successfully. Changing inclusion, strategy, or tuning stops playback and clears stale audition and approval evidence; recording or concept note edits preserve valid listening evidence. Needs Changes does not require an audition. Approval remains playback-design feedback only: it does not change the strategy declaration, qualify audio, process a final loop, or connect the strategy to the production player.

Recording playback still resolves only a manifest-listed source inside the canonical configured root and rechecks its recorded byte size. Search, discovery-state, concept, and overall-decision filters operate on the immutable manifest. The interface cannot promote declarations, process or copy audio, or publish a runtime catalog.

Import a returned export with:

```powershell
npm run atmoshaper:sounds:curate-review -- "<exported-review-json>"
```

The importer accepts only the exact discovery fingerprint and proposed source IDs, publishes only `data/atmoshaper/signature-sound-listening-review.json`, and retains no input path. Explicit Reject excludes that recording only; its concept group remains active. An omitted or note-only proposed source becomes contextual Maybe. The rule does not apply to discovery-excluded or unclassified files.

The committed curation covers all 926 proposed sources: 354 explicit Keeps, 113 explicit Maybes, 360 explicit Rejects, and 99 contextual Maybes. It leaves 566 non-rejected ingredients across 93 active groups; seven active groups need a different usable recording. Strategy metadata is dynamic: whole recordings normally shuffle without immediate repeats and use group-appropriate end-to-end, crossfade, or overlap transitions; walking one-shots use a cadence sequencer; Horror, Keys Jingling, and underwater one-shots use an adaptive one-shot sequence; and whistles use a spaced-event sequence. The reusable scheduler performs those behaviors for local design audition and for the exact 51-concept production projection. A successful development preview by itself still does not qualify a new or changed concept: it must enter a new checksum-bound prepared and production release.

Partial recording notes, concept assignments, ingredient notes, preview settings, and auditions are preserved even before Approve or Needs Changes is selected; unreviewed concepts remain distinguishable from accepted designs. `/dev/candidates` is retained as an internal development tool for later concept intake and audition. Retiring it requires a separate explicit decision rather than completion of this Signature Sounds pass.

### Complete-review construction reconciliation

The returned version-1 listening export and version-3 complete review are evidence inputs, not writable product data. Reconcile them against the repository-owned discovery, playback-policy, listening, workspace, and interpretation authorities with:

```powershell
npm run atmoshaper:sounds:reconcile-review -- "<listening-review-v1-json>" "<complete-review-v3-json>"
npm run atmoshaper:sounds:reconcile-review -- "<listening-review-v1-json>" "<complete-review-v3-json>" --format markdown
```

Both commands write nothing. JSON is the deterministic machine-readable review; Markdown summarizes review readiness and keeps pending audio/rebuilt-QA boundaries visible. Neither output includes an input path or local Signature root.

Only the fixed generated owner may be replaced, and only through the explicit form:

```powershell
npm run atmoshaper:sounds:reconcile-review -- "<listening-review-v1-json>" "<complete-review-v3-json>" --output data/atmoshaper/signature-sound-construction-review.json
```

The CLI confines that destination to the canonical repository/worktree, writes through same-directory transaction files, rolls back failure, then rereads and fully revalidates the result. `data/atmoshaper/signature-sound-construction-interpretations.json` is the reviewed human-to-structured mapping; the generated review is never a substitute for that declaration.

The current exact result covers 3,693 recordings, 93 groups, and 38 group/ingredient notes as 36 structured dispositions, no deferred dispositions, and two unresolved naming decisions. It records desired audible outcomes and playback auditions only. Gravel crossfade/overlap remains an explicit rebuilt boundary comparison rather than an inferred final choice. No resolution means that filtering, source separation, trimming, normalization, loop repair, encoding, technical QA, or listening QA has succeeded. Those steps and production qualification remain separate gates.

### Playback-construction audition

The retained development tool now links to `/dev/candidates/construction`. Its generated browser projection is regression-checked against the canonical construction owner and includes these exact scheduler auditions:

- Air Traffic Control: events spaced 1–7 seconds with four intervening selections before reuse.
- Horror Suspense: events spaced 0–16 seconds.
- Sci-Fi Whistles: events spaced 0–8 seconds.
- Dryer: a newly sampled crossfade duration from 3.75–10 seconds at each source boundary.
- Walk on Gravel: A/B comparison between cadence crossfade and overlap.
- Walk on Leaves: three intervening selections before reuse.
- Moon Footsteps: the next cadence event may overlap the current one.
- Walking in Puddles: 105 steps per minute with 8% cadence variation.
- Walk on Stone: visible but blocked because the returned Change decision contains no construction instruction.

The page reuses the sole development preview player. One group plays at a time; Start begins the exact setup, Stop retires all owned playback, and Next Event or Next Transition exposes a boundary immediately. Listening evidence is recorded only when the reviewer explicitly selects Confirm Current Setup Heard while that exact configuration remains active. Cross-tab configuration changes stop playback, and Gravel's crossfade/overlap and crossfade-duration controls clear only Gravel's stale audition and decision. Exact source paths and pending processing intent IDs stay visible.

Construction QA is a separate version-1 browser-local record. Pass binds the construction-review fingerprint, scheduler algorithm, group, exact included source IDs, preview settings, selected construction policy, heard timestamp, note, and QA scope. Needs Rebuild and Reject may carry that same exact-heard evidence, or may be recorded from a non-empty note without an audition or QA scope; this preserves negative triage without pretending an unacceptable setup was heard and approved. Pass always requires exact current heard evidence. Processing-pending groups expose only Playback Only because raw-source scheduling cannot prove trimming, normalization, speech treatment, or effects. The isolated storage key neither migrates nor deletes version-1 recording, version-2 group, or version-3 complete-review records; Export Construction QA downloads only this exact evidence. If browser storage is unavailable, the page retains exportable in-memory QA and displays a not-persisted warning; invalid saved JSON remains untouched for recovery.

Import Construction QA restores only a JSON export that passes that same closed current-fingerprint validator. Import stops active playback, restores exact A/B and scope selections, and then uses the existing persistence path. A malformed, stale, fabricated, or differently fingerprinted file leaves current in-memory work unchanged. An imported exact heard record immediately enables every decision. An entry with only a note enables Needs Rebuild and Reject while Pass remains locked. Needs Rebuild keeps the concept active while sending its sources or construction back through review; Reject declines the current construction or ingredient result without globally rejecting a recording from every concept.

QA scope is not a decision. When a group permits only Playback Only, the page renders that scope as fixed status because there is no alternative to select until processed audio exists. Groups that permit both Playback Only and Complete Construction retain the scope selector. Pass, Needs Rebuild, and Reject appear separately under Construction Decision, with an explicit message stating whether the exact setup is confirmed or still needs Start plus Confirm Current Setup Heard.

The returned `2026-08-25T16:49:56.695Z` export remains historical evidence with eight configured groups: six exact heard configurations and two walking notes. The current validated sparse decision input keeps `needs-rework` for Walk on Gravel and Walk on Leaves without fabricating heard evidence or QA scope, so both concepts remain active and revisitable. It records exact `complete-construction` Pass decisions for Horror Suspense, Moon Footsteps, and Walking in Puddles, plus exact `playback-only` Passes for Air Traffic Control's spacing/repeat policy, Dryer's variable transition policy, and Sci-Fi Whistles' `0–8` second event spacing. Air Traffic's normalized-artifact QA, Dryer's pending trim work, and Sci-Fi Whistles' pending echo/delay processing stay separate from scheduler approval. Every accepted decision is recomputed against the current sources, settings, and construction policy; blocked Walk on Stone remains without a construction decision.

The local route has returned HTTP 200 with all nine groups and both blocker classes, and a manifest-listed source returned a valid HTTP 206 byte range. The development audio route requires the scanned SHA-256 and serves byte ranges from the same in-memory snapshot that passed checksum verification rather than reopening a mutable source path. Interactive browser QA remains unclaimed because the in-app browser's admin-enforced localhost policy could not be verified; that policy was not bypassed. This construction page invokes no media tool and does not edit, copy, encode, qualify, publish, or upload audio.

### Derived-audio batches and artifact QA

The separately authorized derived-audio workflow uses a portable declaration plus explicit server-owned roots:

```powershell
npm run atmoshaper:sounds:derived-audio -- measure --batch-id "<registered-batch-id>" --source-root "<absolute-signature-root>" --output-root "<absolute-external-batch-root>" --ffmpeg "<ffmpeg-9-path>" --ffprobe "<matching-ffprobe-path>"
npm run atmoshaper:sounds:derived-audio -- render --batch-id "<registered-batch-id>" --source-root "<absolute-signature-root>" --output-root "<absolute-external-batch-root>" --ffmpeg "<ffmpeg-9-path>" --ffprobe "<matching-ffprobe-path>"
```

The runner verifies exact source size/SHA-256 before media-tool use; canonicalizes the nearest existing output ancestor; rejects filesystem, source, repository, linked-main, and worktree overlap; requires the recorded FFmpeg 9.0 build; and refuses every existing destination. It renders to task-owned temporary WAVs, verifies the entire batch, then publishes the files and portable manifest. A later failure removes only files created by that run. Corrected artifacts require a new declaration/output version rather than overwrite.

Campfire Batch 01 uses four exact sources. EBU R128 input measurements are `-23.1`, `-33.0`, `-38.3`, and `-25.4` LUFS. The transparent recipe selects the quietest input (`-38.3` LUFS) and applies attenuation-only gains `-15.2`, `-5.3`, `0`, and `-12.9` dB before lossless stereo 48 kHz/24-bit PCM output. All four outputs retained source duration within one output sample and measured `-38.3` or `-38.4` LUFS. Their combined size is 129,799,918 bytes. The committed anchor binds the external manifest SHA-256 `04f96575eb156fc39913244b9e7f30d46025f7b3580031e15af2cc1e8c3b53a8`; no audio is committed to Git.

Start the development server with `ATMOSHAPER_SIGNATURE_SOUNDS_ROOT` and `ATMOSHAPER_SIGNATURE_DERIVED_ROOT`, then open `/dev/candidates/processing`. Each card provides Source Recording and Processed Recording players, measurements, notes, and Pass/Needs Rebuild/Reject. Pass unlocks after both exact recordings start; a non-empty note may record a negative decision without fake heard evidence. Export Artifact QA produces fingerprinted local JSON. The derived route rereads the anchored manifest and verifies the exact output size and checksum before serving a byte range.

Campfire is `audible-qa-passed` for the four exact manifest-bound artifacts. The committed QA contains four Pass decisions and the page prefers that newer baseline over an older browser draft; a genuinely later valid local review can still supersede it. Successful processing and artifact QA are not publication qualification. Boiling Water remains parameter-gated inside the historical Batch 01 final-recipe declaration, while its separate corrected Batch 04 v2 audition has a directly selected 8-second crossfade. Walking ingredient repair, voice removal/obscuring, source separation, production wiring, browser delivery encodes, publication, upload, deployment, push, and merge remain separate work.

Air Traffic Control Batch 02 selects its closed declaration through the portable batch registry and preserves the exact 12-source construction pool. Read-only measurement confirmed every input is mono 44.1 kHz/16-bit PCM and measured `-14.0` through `-23.1` LUFS. The transparent recipe keeps speech and timing unchanged, preserves mono channel semantics, selects `-23.1` LUFS as the quietest-input target, and applies gains from `0` to `-9.1` dB before lossless 48 kHz/24-bit PCM output. All 12 outputs independently measured `-23.1` LUFS, total 8,802,360 bytes, and match the external manifest anchored by SHA-256 `fb0163b77a656f92f61bcc2bd63d46b9ad74bbc55fb9b4557268beab95a1ef94`. Its declaration fingerprint is `87a79b019a119ef781640fb344a8f3b688a2aa7fd0a0457a7da29a1b1da17008`. The reviewer directly confirmed all 12 source/processed comparisons Pass; the separate committed QA validates every exact output identity, and Batch 02 is now `audible-qa-passed` without implying publication qualification.

The development page selects the one external manifest whose bytes match a committed anchor, then resolves the corresponding immutable declaration and committed QA by batch identity. This allows the same server-owned review page and byte-range route to review either retained batch without changing the other batch's identities or decisions. A newly rendered batch starts with a complete-key, decision-empty QA draft rather than inheriting another batch's browser or committed decisions.

Sci-Fi Whistles Batch 03 is a treatment audition rather than a final normalization recipe. Its current immutable v2 uses all 18 exact construction-owned stereo sources and creates four parameter-bound variants per source: short delay (`120 ms`), medium echo (`180/360 ms`), wide dual echo (`260/520 ms`, decay `0.34/0.17`), and wide dual echo ×2 (the same taps with doubled `0.68/0.34` decay and `-3 dB` safety attenuation). The 72 lossless 48 kHz/24-bit PCM WAVs total 71,680,872 bytes and independently match every manifest size and SHA-256. Output true peaks range from `-23.9` to `-6.2` dBTP; the ×2 subset peaks from `-23.9` to `-8.7` dBTP. The declaration fingerprint is `e05aadb04e87f56e9df4f69cba180ce37ca0f4481fbfc0fa2c981bdd4fb4163a`; external manifest SHA-256 is `8ff6856b1342a8d88366eeae48e1307b7cbc0921ef0ef7755fce8ac4f7faa6c6`. The original 54-file v1 remains untouched, and all three retained v2 treatments are byte-identical to v1.

When the server is configured with the Batch 03 v2 external root, `/dev/candidates/processing` presents five complete concept auditions: dry, short delay, medium echo, wide dual echo, and wide dual echo ×2. Every audition selects dynamically from all 18 exact sources with the approved `0–8` second spaced-event scheduler. Start switches the one shared player to that complete version; Stop retires its audio; Next event skips the current wait; and explicit confirmation records that the current complete concept was heard. Pass requires confirmed dry and effect auditions. Needs Rebuild or Reject may instead be supported by a non-empty concept note. The exported browser-local concept QA binds each effect decision to all 18 exact output identities. Individual artifact players and notes remain in a collapsed diagnostics section for isolating a troublesome recording, but their evidence does not substitute for concept-level review. The reviewer directly passed wide dual echo ×2. The committed selection record binds that Pass to the exact declaration, manifest, and 18 ×2 output identities, so Batch 03 is `audible-qa-passed` and the page restores that result after restart. Short delay, medium echo, and the original wide dual echo remain undecided comparisons, not rejected alternatives. This approval does not publish or production-qualify the concept; all other unresolved treatments remain parameter- or choice-gated.

Boiling Water Batch 04 v2 follows the reviewer's exact full-concept recipe: source `0:00–1:30` plays once, then only `0:15–1:30` repeats. Its `2s`, `4s`, and `8s` equal-power variants bake the return crossfade into a loop region that begins at output offsets `88`, `86`, and `82s`; the corresponding loop-region durations are `73`, `71`, and `67s`. The development player decodes the selected manifest-bound WAV, starts at zero, and then uses Web Audio regional loop points so the `0:00–0:15` opening never repeats. The three stereo 48 kHz/24-bit PCM candidates total 134,496,306 bytes and pass exact checksum, size, duration, format, and peak verification under declaration `7ba27607e61fdd09f3cad2c6898fec8726dd9762d798ad1437ff8120ae6e16e4` and manifest `dbbdb177e8cd47fa2923528f9de834a5ad1cdb87fe3c2cc3c780bf67a2a6c5c6`. The direct reviewer selection records the `Long 8-second crossfade` as Pass against exact output identity `d63ea4082951404502d5d48c3fdfc2df6af907ca897c06f95956f52b0b96bf04`; it does not fabricate browser hearing timestamps or decide the `2s` and `4s` alternatives. Batch 04 is `audible-qa-passed`. The superseded v1 `4.0–111.4s` external review directory remains immutable and is not the current anchor.

Dryer Batch 05 trims exact source `a2cdc5b801058999b253de905dcdc45e612c5e944ef6e4202a0d815b91bf8d4f` to `1.8–17.7s` and adds `0.15s` fades at the new boundaries without loudness normalization. The immutable 15.9-second stereo 48 kHz/24-bit PCM comparison is 4,579,302 bytes, measures `-19.5` LUFS and `-9.1` dBTP, and matches manifest SHA-256 `2612f3cf58c2be61ad3f609fc5e6237af34143c1185a983f5a892a58a11d9d9d`. The processing page compares the dry and trimmed recordings as whole dynamic concepts using the already approved adaptive scheduler and a new crossfade duration between `3.75–10s` at every boundary. The reviewer directly selected `Dry concept`; a committed record binds that Pass to the source, comparison output, and exact playback configuration. The trimmed artifact remains unselected rather than rejected. Batch 05 is `audible-qa-complete-dry-selected` and is neither published nor production-qualified.

### Raw whole-concept review queue

After Batches 01–05 reach terminal review states, `/dev/candidates/processing` offers one compact selector for the current 42 surviving concepts through Batch 51. The queue is for direct listening and chat feedback; it intentionally has no page decision buttons. Forty-one direct chat audition Passes are retained as exact restart-safe records without invented heard timestamps. Merged Batches 32, 39, 40, and 48 redirect to Batches 20, 22, 21, and 49 respectively, so old review links and batch references remain valid. The dropdown's `Batch NN · concept` identity is authoritative; the concept page shows that same stable number and labels the filtered queue position separately as Review progress.

The committed queue stores only batch and group identities. Its validator reprojects the exact accepted sources and playback configuration from fingerprint-verified discovery and construction owners, requires portable path-derived source identity, and rejects unsupported playback constraints. A closed amendment layer then applies exact reviewer-directed source pools, labels, playback policies, measurements, readiness states, and redirects without rewriting those evidence owners. The selector keeps processing-gated and production-insufficient concepts visible instead of deleting or implicitly rejecting them.

The same development selector appends a separately validated catalog-expansion review owner. The active stable identities are Batches 52, 55, 56, 57, 60, and 61; removed Batches 53, 54, 58, and 59 are not renumbered or redirected. Grinding Pepper uses 100 events per minute and carries an exact chat Pass alongside Bagpipes Outside and Open Fields. Ambient Loops exposes 22 retained recordings after 12 exact filename exclusions. It uses one randomized pool: each choice plays three to six times total before switching to a different recording. The default boundary is four 4-beat bars at 77 BPM, or `960/77` seconds (about `12.468s`). Exact source-bound exceptions give String Loop 03, Piano Loop 04, and Piano Loop 06 two bars, or `480/77` seconds (about `6.234s`), because those recordings are too short for the default boundary. Its earlier Pass applied to a superseded pool and schedule, so the revised policy awaits a new review. Crowd Walla keeps all 13 sources with transparent per-file constant gain to `-27.2 LUFS`, and that exact setup carries an exact chat Pass. White Noise loops only the selected recording through a plain `0.25s` self-overlap with no fade. Processed Batches 02–05 and all concept reviews appear in the same Concept review queue dropdown. Batch 01 is omitted because Fireplace at Batch 30 replaces Campfire; its old review URL redirects to Fireplace while historical manifest and QA evidence remains retained. These remain development review decisions and do not publish or qualify audio for production.

`/dev/candidates/prepared` is the derived implementation-handoff view. It currently shows four terminal processed concepts and 45 exact dynamic-setup Passes as 49 prepared concepts, then subtracts every Moodist concept with a usable included construction source from the canonical 81 recordable concepts. The resulting 51-item recording checklist distinguishes 47 concepts with no represented candidate from Subway Station, Underwater, Wind, and Wind in Trees, whose groups retained no usable source. White, Pink, and Brown Noise are native-generated and remain outside that checklist. Each prepared row has an on-demand Play control and a Review link; starting one row retires the prior row. Batches 02–05 also show a final assembled concept audition. Those players bind to the exact terminal Air Traffic outputs, selected Wide dual echo x2 whistles, selected 8-second Boiling Water intro/loop artifact, and selected Dry Dryer source. Boiling Water additionally shows its source-time recipe and live artifact timeline. Dryer identifies the original Dry selection, reads back its fresh `3.75–10s` crossfade lead at each boundary, and provides both a pre-play duration timeline and a seekable live timeline. Batch-qualified derived URLs keep every playback request inside its manifest catalog. The page creates no parallel decision owner and does not claim publication or production qualification.

Every raw concept displays a concrete policy readback for selection, timing, and boundary behavior. Starting playback adds one seekable elapsed/duration timeline for each active recording; simultaneous rows make overlap visible, while time updates remain outside screen-reader live status. Navigation is keyed by exact review fingerprint so leaving a concept stops its player. The scheduler serializes automatic/manual requests, applies optional measured constant gain, and can preserve full-length plain overlaps without fading or cutting the outgoing recording. Median leveling may safely raise or lower a recording through a separate Web Audio gain stage, but the declared target must retain at least one dB of measured true-peak headroom. Leveling does not imply EQ, compression, filtering, denoising, or rewritten source audio.

Reviewer-directed audition revisions sit above immutable construction evidence. Washing Machine plays from the beginning, then repeats `0:15–0:55` with a four-second return crossfade. Other amended policies include randomized bounded loop windows, pause-separated/faded sequences, cadence timing, and strict concurrent-source caps. Waves and Church Bells use median-centered, true-peak-safe overall gain, while already heard attenuation-only concepts retain their exact reviewed identities. Experimental Atmosphere selects a fresh `2–6s` overlap lead, uses no crossfade, and lets every triggered recording finish naturally. Raw batch URLs use the existing development-only checksum-bound source route and create no processed files.

Heavy Rain keeps only the long Outside5 recording after the rejected siren-bearing sources were removed; each playback boundary chooses a fresh random window anywhere in `0–143.413s`, at least 20 seconds long, with a 10-second return crossfade, and that exact setup is Pass. Children's Choir Ambience uses all five distinct matching library recordings and is Pass. Orthodox Choir excludes the four named removals, permits at most two audible recordings, uses four-second crossfades, and is Pass. Church Bells' 15-second crossfade and reviewed constant-gain treatment are Pass. Spaceship Interior retains only the original nine-source Track 1 sequence and is Pass. Speech review deliberately spans two immutable bundles. Batch 21 uses the v2 nine-source Traffic pool after the two Aberdeen City `-2` takes and `Cars Passing During Rain On A Wet Road-1 (1).wav` were removed before a genuine no-vocals rerender; it is now an exact processed Pass. Its v2 bundle declaration is `45706b1994b3fcd219bf3102bffab9cbf41d8ccae3c991945eb9a7040acf2378`; the 84,920-byte manifest SHA-256 is `9e4fc27a0eac42681ddf995a0dbee2e6a23fe72a14fccb2f926eb5153a4db302`, and its nine Traffic WAVs total 180,596,094 bytes. Batch 35 and Batch 45 retain their validated v1 London and Stadium bytes and are Pass. The later Stadium dynamics/leveling render is an inactive external experiment after the reviewer preferred the v1 speech-stage sound. Train Station at stable Batch 47 remains unchanged and is held for insufficient sources. Transit Announcements at stable Batch 49 uses four sources, keeps only `0:00–0:06` of `The next station is - Announcement. 2.wav` in the non-destructive audition, and is Pass.

For speech-reduction review, set `ATMOSHAPER_SIGNATURE_SPEECH_REDUCTION_ROOT` to retained v1 and `ATMOSHAPER_SIGNATURE_SPEECH_REDUCTION_TRAFFIC_ROOT` to Traffic v2. Separate committed anchors verify both manifest byte snapshots. The page and development route share stable-batch selection: Batch 21 validates and streams v2, while Batches 35 and 45 validate and stream retained v1. Missing or partial manifests, wrong batches, changed files, unsafe paths, Production, or absent concept-scoped URLs fail closed; processed concepts never fall back to raw recordings.

For retained multi-batch review, set `ATMOSHAPER_SIGNATURE_DERIVED_CATALOG_ROOT` to the server-owned parent containing the immutable batch directories, then open `/dev/candidates/processing`. The selector accepts only committed batch ids and maps them to server-owned directory leaves; batch-qualified audio routes revalidate the manifest and artifact bytes. A bare catalog URL opens the first anchor that is not already `audible-qa-passed`, or the first registered batch when every retained batch has passed. `ATMOSHAPER_SIGNATURE_DERIVED_ROOT` remains the exact single-batch compatibility path.

### Repeatable read-only audit

Run the catalog audit against the Signature Sounds library with:

```powershell
npm run atmoshaper:sounds:audit -- "<signature-root>"
```

The default command prints stable Markdown to stdout and writes nothing. `--format json` prints the machine-readable form. Reports are written only when `--report-markdown <in-repo-destination>` or `--report-json <in-repo-destination>` is explicitly supplied; report targets are confined to the current repository or worktree. Neither stdout format exposes the machine-specific source root.

The audit fingerprints three independent inputs: the checksum-bearing scanned audio inventory, the canonical Moodist concept inventory, and the declared Signature Sounds candidates and gate states. A changed fingerprint means that input changed and the prior audit must not be treated as current. The Markdown output always keeps the four decision headings distinct: `Qualified Moodist matches`, `Needs audition or processing`, `Recording or source gaps`, and `Signature-only concept candidates`.

### Processing-plan boundary

After gate decisions and checksum-bound source measurements have been recorded, create an inert plan with:

```powershell
npm run atmoshaper:sounds:process-plan -- "<signature-root>" --output-root "<absolute-external-output-root>"
```

The output root must be an explicit absolute directory outside the repository or worktree. The planner resolves it only to prove that boundary; it does not create the directory. The current real catalog result is `state: no-qualified-assignments`, `processingVerification: not-run`, and zero sources.

Planning eligibility is intentionally narrower than runtime qualification. A candidate may enter planning only when it is mapped to a Moodist concept, uses accepted evidence, remains active, has passed technical and listening review, and has processing pending or verified. Signature-only extras remain ideas until separate product approval. A production-qualified Moodist match additionally requires processing to be verified.

The planner validates each assignment against the fresh audit checksum and a source measurement bound to that same candidate and checksum. Measurements record duration, channel count, sample rate, and a measurement-method version. The current profile plans a non-repeated source window of target duration `T` plus crossfade duration `X`, crossfades the tail into the head so the cyclic seam sits inside the asset, and emits WebM/Opus and M4A/AAC recipes. It emits inert `ffmpeg` argument arrays only and never invokes `ffmpeg`. Two-pass loudness values remain explicit placeholders until an authorized first-pass measurement fills them. Output identities include the candidate, full source checksum, full profile checksum, algorithm version, output version, and format. `-n` no-overwrite arguments, monotonically newer output versions, and the anchored publication ledger protect prior output identities and publication history.

Actual encoding, decoded-output seam inspection, and decoded loudness/true-peak verification remain future authorized work. A plan is not evidence that any media was processed or approved.

### Candidate listening and qualification sequence

1. Run the read-only audit and confirm its fingerprints and four decision lists.
2. Inspect the declared license evidence. Prefer a pack-specific CC0 file when present; otherwise apply the accepted Signature Sounds site-wide statement only to this downloaded library.
3. Listen to the entire candidate, not a filename excerpt or a short spot-check. Record whether it contains speech or announcements, distracting events, poor concept fit, or material that will not tolerate looping.
4. Record the technical measurement and the separate technical and listening gate decisions. A listening pass requires a technical pass; any failed gate requires an explicit rejection and reason.
5. Add a checksum-bound processing assignment only after technical and listening pass, then rerun the processing planner.
6. In a separately authorized external workspace, execute the reviewed recipe and verify the decoded seam, integrated loudness, true peak, duration, channels, sample rate, and both browser delivery formats.
7. Mark processing verified and production-qualified only after those decoded-output checks pass.

Stop at that point unless the next scope is separately authorized. Git media, a hosted manifest, R2 or other uploads, runtime wiring, deployment, push, and merge are separate changes and are not authorized by an audit, listening decision, or processing plan.

## Physical Android verification

The affected media/player behavior passed physical review on a Samsung Galaxy
S24 Ultra using Chrome `151.0.7922.137` against immutable deployment
`https://massagelab-1ia9a0227-dsbteam.vercel.app/music` at exact commit
`ca429f7f4c3cc1c40bac2a850be73a8226981c2e`. One touch starts playback;
revisioned 512×512 system artwork looks sharp and remains paired with the title
through Previous/Next; no fabricated timeline appears; the vinyl completes one
normal revolution in 52 seconds and becomes static under reduced motion; rail
art retains approximately 7px edge clearance; portrait cards keep the same
height while the player expands or collapses; touch-only station buttons are
hidden unless reduced motion or a fine pointer applies; station navigation
loops in both directions; constrained landscape uses the global side rail; and
explicit Stop retires the rail after 60 seconds unless playback restarts first.

The web runtime intentionally does not imitate a native notification Favorite
or rating action. The requested heart remains deferred to a future native
Android wrapper. Installed-PWA, Bluetooth/headset, real-call, meeting-app,
controlled carrier-failure, broader lock/background-return, current-session
preference, and physical Apple verification remain separate pending work. The
physical QA record keeps the exact evidence boundary, screenshot filenames,
and source raster dimensions; CSS viewport, DPR, and safe-area values are not
inferred from attachment pixels.

## Package Findings

| Package | Version | License | Source |
| --- | --- | --- | --- |
| `tone` | `14.9.17` | MIT | https://github.com/Tonejs/Tone.js |
| `@generative-music/web-provider` | `3.0.0` | MIT | https://github.com/generative-music/web-provider |
| `@generative-music/web-library` | `0.2.2` | MIT | https://github.com/generative-music/web-library |
| `@generative-music/piece-observable-streams` | `5.2.0` | MIT | https://github.com/generative-music/piece-observable-streams |
| `@generative-music/pieces-alex-bainter` | `5.2.2` | MIT | https://github.com/generative-music/pieces-alex-bainter |

## Generative.fm Observable Streams Adapter

`@generative-music/piece-observable-streams` exports a default piece that activates through a Generative.fm-style sample library. Its package manifest lists these sample names:

- `observable-streams__vsco2-piano-mf`
- `observable-streams__vsco2-violin-arcvib`
- `observable-streams__sso-cor-anglais`

The selected package does not include the actual sample-index data needed to resolve those names to hosted audio files. MassageLab supplies a first-party hosted sample index from `massagelab-public-media` and validates the package sample-name groups before importing browser-only Generative.fm runtime modules.

The original package expects `sso-cor-anglais` from Sonatina Symphonic Orchestra. MassageLab will not use SSO raw samples for the hosted public feature because SSO uses the retired Creative Commons Sampling Plus 1.0 license, which is not a clean fit for browser-hosted raw sample redistribution in a public product that may become subscription-supported. The first MassageLab adaptation maps that role to a CC0 VSCO sustained oboe source instead.

## Local Sample Asset Intake

The local sample folder supplied for this branch is `C:\Users\derri\code\audio`. The raw audio files stay outside the repo; MassageLab only commits repeatable scanner logic and documentation.

Run the bounded scan with:

```powershell
npm run atmosphere:samples:scan -- "C:\Users\derri\code\audio"
```

The 2026-06-17 scan found 7,740 files and 7,429 audio files. It confirmed these local libraries and license evidence:

| Library | Local status | License evidence |
| --- | --- | --- |
| VSCO 2 Community Edition | Present | `VSCO-2-CE-1.1.0/VSCO-2-CE-1.1.0/LICENSE` uses CC0 1.0 Universal. |
| Versilian Community Sample Library | Present | `VCSL-1.2.2-RC/VCSL-1.2.2-RC/README.md` describes the collection as CC0/public-domain-style. |

Observable Streams local coverage:

| Source sample | Local status | Evidence |
| --- | --- | --- |
| `vsco2-piano-mf` | Candidate present | 69 VSCO upright piano WAVs matched, with `MappingChart.txt` mapping A0 to C8 across 45 sample numbers. The first staged adaptation uses dynamic layer `2` as the medium piano source. |
| `vsco2-violin-arcvib` | Candidate present | 30 VSCO solo violin arco vibrato WAVs matched across `f` and `p` dynamics. |
| `vsco2-oboe-sus` | Replacement present | 18 VSCO sustained oboe WAVs matched across dynamics `1` and `3`. This intentionally replaces the package's `sso-cor-anglais` role. |

Stage the first curated Observable Streams adaptation with:

```powershell
npm run atmosphere:samples:stage -- "C:\Users\derri\code\audio" --dry-run
```

The dry run selects 24 WAV files: 12 VSCO piano dynamic-2 notes, 6 VSCO violin `p` notes, and 6 VSCO sustained-oboe dynamic-1 notes. Running the same command without `--dry-run` copies those WAVs into `public/audio/atmosphere/observable-streams-vsco-adaptation/samples/` and writes `sample-index.json` plus `manifest.json` beside them. The generated `samples/` folder is gitignored so the branch cannot accidentally commit raw audio.

The generated sample index intentionally exposes the oboe replacement under `sso-cor-anglais`. That lets the existing Observable Streams package request its original musical role while MassageLab serves a CC0 VSCO sustained-oboe source instead of SSO raw samples.

Excluded package source and adaptations:

| Source sample | Decision | Reason |
| --- | --- | --- |
| Raw SSO samples | Excluded | SSO's Sampling Plus license is not a clean fit for hosting raw browser samples in a public MassageLab product feature. |
| `sso-cor-anglais` package role | Adapted | Served from CC0 VSCO sustained oboe while preserving the package-facing sample name. |

Decision: build the first Observable Streams path as a MassageLab-hosted VSCO adaptation. Observable Streams is playable after the generated sample index was hosted with the right cache/CORS behavior and wired to the Generative.fm adapter.

## Catalog-Wide Generative.fm Sample Coverage

Run the full catalog coverage scan without copying or committing raw audio:

```powershell
npm run atmosphere:samples:coverage -- "C:\Users\derri\code\audio"
```

The 2026-06-19 scan checked the full Alex Bainter package catalog against the local audio root and confirmed the local VSCO, VCSL, and selected Signature Sounds libraries have hostable CC0 evidence:

| Library | Local status | License evidence |
| --- | --- | --- |
| VSCO 2 Community Edition | Present | `VSCO-2-CE-1.1.0/VSCO-2-CE-1.1.0/LICENSE` confirms CC0 1.0 Universal. |
| Versilian Community Sample Library | Present | `VCSL-1.2.2-RC/VCSL-1.2.2-RC/README.md` confirms Creative Commons 0/public-domain-style permissions. |
| Signature Sounds Beach Ambience Recordings | Present | `Signature Samples/SS_Beach_Ambience_Recordings_CC0/SS_Beach_Ambience_Recordings_CC0/LICENSE_Beach_Collection_PRO.txt` confirms CC0 1.0 Universal permissions. |
| Signature Sounds Choirs/Vocals SFX Teaser | Present | `Signature Samples/SS_Choirs_Vocals_SFX_Teaser_CC0/SS_Choirs_Vocals_SFX_Teaser_CC0/LICENSE_Choir_Collection_PRO.txt` confirms CC0 1.0 Universal permissions. |
| Signature Sounds Serbian Orthodox Choirs | Present | `Signature Samples/SS_Serbian_Orthodox_Choirs_Original_Recordings_CC0/SS_Serbian_Orthodox_Choirs_Original_Recordings_CC0/LICENSE_Serbian_Choir_PRO_v2.txt` confirms CC0 1.0 Universal permissions. |
| Signature Sounds site-wide CC0 packs | Present | `https://signaturesounds.org/about-` describes the site as a CC0-licensed sound-pack library. This branch treats that site-wide statement as satisfactory evidence for packs under `Signature Samples`. |

Current catalog matrix:

| Coverage category | Count | Meaning |
| --- | ---: | --- |
| Hosted/playable stations | 57 | Observable Streams plus all 56 Alex Bainter package pieces now have public-media WAV indexes plus Opus, AAC/M4A, and MP3 sidecar indexes with browser-readable CORS. |
| Local CC0 source candidates | 0 | All currently planned package pieces are hosted rather than waiting as local-only candidates. |
| Replacement/source-review pieces | 0 | The remaining-generator rollout mapped the final field, guitar, voice/hum, lofi drum, percussion, pad, and noise groups to VSCO, VCSL, and Signature Sounds replacement sources. |

The configured SSO-role adaptations are `sso-cor-anglais` to CC0 VSCO sustained oboe, `sso-chorus-female` to Signature Sounds children choir ambience, and `sso-chorus-male` to Signature Sounds men-of-choirs WAVs. The `waves` source group maps to Signature Sounds Beach Ambience WAVs. Later rendered uploads should keep the package-facing sample names while serving those replacement sources.

The expanded source-index rollout hosted the previous 25 render/upload candidates: 420hz Gamma Waves for Big Brain, A Viable System, Above the Rain, Agua Ravine, Apoapsis, Beneath Waves, Bhairav, Buttafingers, Documentary Films, Drones, Drones II, Enough, Expand/Collapse, Homage, Nakaii, Oxalis 1, Remembering, Return to Form, Ritual, Soundtrack, Splash, Spring Again, Substrate, Timbral Oscillations, and Yesterday.

The remaining-generator rollout then hosted Animalia Chordata, Awash, Didgeridoobeats, Eyes Closed, Last Transit, Lullaby, Meditation, Moment, Neuroplasticity, Otherness, Peace, Pulse-code Modulation, Skyline, Stratospheric, Stream of Consciousness, Townsend, Western Medicine, and Zed. Their previous missing groups are now covered by package-facing indexes that use VSCO flute/harp/marimba/piano/strings, VCSL ocean drum/didgeridoo, and Signature Sounds underwater, guitar, choir, transit, birds, fireworks, lofi drum, percussion, pad, and white-noise replacements.

Other downloaded Signature Sounds packs are useful future candidates for custom generator tools and for freshening rendered station palettes. The current Generative.fm coverage rules count packs only when they have a direct current sample-group fit or a deliberate replacement mapping.

Downloaded Signature Sounds future candidate packs:

| Pack | Current use label | Notes |
| --- | --- | --- |
| `Angellic+Vocal+Kit` | Future vocal/pad candidate | Useful for custom generator vocal textures after loop/key review. |
| `Beach+amb-recordings+3` | Future ambience candidate | Overlaps with the confirmed beach ambience source family; not wired because `SS_Beach_Ambience_Recordings_CC0` has clearer local license evidence. |
| `Cave+Atmosphere+SFX+2` | Future ambience candidate | Useful for dark room-tone, cave, and low movement atmosphere generators. |
| `Fire+place+foley+CC0+SignatureSounds.org` | Future ambience/foley candidate | Folder name and site copy support CC0-style use; useful for warm-room and hearth atmosphere tools. |
| `Light+Rain` | Future ambience candidate | Useful for rain layers and calmness/noise-mix tools. |
| `Moroccan+Countryside+` | Future field-recording candidate | Useful for outdoor/place-based atmosphere experiments after content review. |
| `Risers+And+Whooshes` | Future transition/texture candidate | Useful for subtle generator transitions only if kept gentle enough for treatment-room use. |
| `SignatureSamples.Co.Uk+Light+Waves+Crashing` | Future wave candidate | Site listing marks Waves Crashing on Shore as CC0, but the current `waves` rule uses the WAV-only `SS_Beach_Ambience_Recordings_CC0` pack with local license evidence. |
| `SignatureSamples.Co.Uk+Mallets` | Future melodic/percussive candidate | Useful for custom generator instruments after key/range review. |
| `Spiritual+Acoustics+CC0+Signaturesounds.org` | Current guitar replacement plus future ambience candidate | Site-wide CC0 evidence accepted; currently maps several guitar-like source groups and remains useful for custom generator layers. |
| `SS_Beach_Ambience_Recordings_CC0` | Current `waves` source candidate | Local license evidence confirmed and mapped to the Generative.fm `waves` source group. |
| `SS_Choirs_Vocals_SFX_Teaser_CC0` | Current SSO chorus adaptation | Local license evidence confirmed and mapped to `sso-chorus-female` and `sso-chorus-male`. |
| `SS_Serbian_Orthodox_Choirs_Original_Recordings_CC0` | Future choir variation candidate | Local license evidence confirmed; held for later variation or custom generator work rather than the first SSO chorus mapping. |
| `Underwater+One+Shots+2` | Current whale-texture replacement plus future texture candidate | Site-wide CC0 evidence accepted; currently maps `whales` for Animalia Chordata. |
| `White+Noise` | Current Zed noise replacement plus future noise-layer candidate | Site-wide CC0 evidence accepted; currently maps `zed__noise`. |

The detailed coverage branch handoff lives at [../superpowers/plans/2026-06-18-atmosphere-generative-fm-sample-coverage.md](../superpowers/plans/2026-06-18-atmosphere-generative-fm-sample-coverage.md). The first-batch hosting handoff lives at [../superpowers/plans/2026-06-18-atmosphere-first-batch-hosting.md](../superpowers/plans/2026-06-18-atmosphere-first-batch-hosting.md), the second-batch hosting handoff lives at [../superpowers/plans/2026-06-18-atmosphere-second-batch-hosting.md](../superpowers/plans/2026-06-18-atmosphere-second-batch-hosting.md), the third-batch listener-copy handoff lives at [../superpowers/plans/2026-06-18-atmosphere-third-batch-listener-copy.md](../superpowers/plans/2026-06-18-atmosphere-third-batch-listener-copy.md), the startup-performance handoff lives at [../superpowers/plans/2026-06-18-atmosphere-startup-performance.md](../superpowers/plans/2026-06-18-atmosphere-startup-performance.md), the web-audio format pilot handoff lives at [../superpowers/plans/2026-06-18-atmosphere-web-audio-format-pilot.md](../superpowers/plans/2026-06-18-atmosphere-web-audio-format-pilot.md), the hosted Opus sidecars handoff lives at [../superpowers/plans/2026-06-18-atmosphere-hosted-opus-sidecars.md](../superpowers/plans/2026-06-18-atmosphere-hosted-opus-sidecars.md), the rendered piano/source-rollout handoff lives at [../superpowers/plans/2026-06-19-atmosphere-rendered-piano-batch.md](../superpowers/plans/2026-06-19-atmosphere-rendered-piano-batch.md), the remaining-generator handoff lives at [../superpowers/plans/2026-06-19-atmosphere-remaining-generators.md](../superpowers/plans/2026-06-19-atmosphere-remaining-generators.md), the AAC/MP3 sidecar handoff lives at [../superpowers/plans/2026-06-19-atmosphere-aac-mp3-sidecars.md](../superpowers/plans/2026-06-19-atmosphere-aac-mp3-sidecars.md), the playback-performance handoff lives at [../superpowers/plans/2026-06-19-atmosphere-playback-performance.md](../superpowers/plans/2026-06-19-atmosphere-playback-performance.md), and the CI build-cache handoff lives at [../superpowers/plans/2026-06-19-ci-build-cache.md](../superpowers/plans/2026-06-19-ci-build-cache.md).

## Public R2 Sample Hosting

Atmosphere samples are public, non-PHI media and should be hosted from `massagelab-public-media`. Do not use `massagelab-anatomy-media` for these audio files, and do not use `massagelab-private-media` for public browser-playable samples.

Configured bucket roles:

| Bucket | Atmosphere use |
| --- | --- |
| `massagelab-public-media` | Public non-PHI audio samples, sample indexes, and manifests. |
| `massagelab-anatomy-media` | Anatomy media workflow only. |
| `massagelab-private-media` | Reserved for private media workflows; not used for public Atmosphere samples. |

Check local R2 readiness without printing secrets:

```powershell
npm run atmosphere:samples:r2:check
```

Plan the hosted Observable Streams object layout without uploading:

```powershell
npm run atmosphere:samples:r2:upload -- "C:\Users\derri\code\audio" --dry-run --public-base-url "https://media.massagelab.app"
```

Include package-compatible rendered samples in the plan or upload:

```powershell
npm run atmosphere:samples:r2:upload -- "C:\Users\derri\code\audio" --dry-run --include-rendered --public-base-url "https://media.massagelab.app"
```

Generate and upload compressed sidecars for Observable Streams. Omit `--format` to use the default Opus sidecar, or pass `--format aac` / `--format mp3` for the older-browser fallbacks:

```powershell
npm run atmosphere:samples:web-audio:r2:upload -- "C:\Users\derri\code\audio" --dry-run --public-base-url "https://media.massagelab.app"
npm run atmosphere:samples:web-audio:r2:upload -- "C:\Users\derri\code\audio" --public-base-url "https://media.massagelab.app"
npm run atmosphere:samples:web-audio:r2:upload -- "C:\Users\derri\code\audio" --format aac --public-base-url "https://media.massagelab.app"
npm run atmosphere:samples:web-audio:r2:upload -- "C:\Users\derri\code\audio" --format mp3 --public-base-url "https://media.massagelab.app"
```

Generate and upload compressed sidecars for the hosted non-Observable Generative.fm stations. Omit `--piece` to cover all 56 package stations, or pass one or more `--piece <piece-id>` values for a targeted repair:

```powershell
npm run atmosphere:samples:generative:web-audio:r2:upload -- "C:\Users\derri\code\audio" --dry-run --public-base-url "https://media.massagelab.app"
npm run atmosphere:samples:generative:web-audio:r2:upload -- "C:\Users\derri\code\audio" --public-base-url "https://media.massagelab.app"
npm run atmosphere:samples:generative:web-audio:r2:upload -- "C:\Users\derri\code\audio" --format aac --public-base-url "https://media.massagelab.app"
npm run atmosphere:samples:generative:web-audio:r2:upload -- "C:\Users\derri\code\audio" --format mp3 --public-base-url "https://media.massagelab.app"
```

The dry run reuses the same curated 24-WAV asset selection as local staging. With `--include-rendered`, it also generates 30 rendered WAV payloads in memory from those curated sources, then maps everything to these public-media R2 objects:

- `atmosphere/observable-streams-vsco-adaptation/samples/*.wav`
- `atmosphere/observable-streams-vsco-adaptation/rendered/<rendered-instrument>/*.wav`
- `atmosphere/observable-streams-vsco-adaptation/sample-index.json`
- `atmosphere/observable-streams-vsco-adaptation/manifest.json`

Actual upload requires `MASSAGELAB_PUBLIC_MEDIA_PUBLIC_BASE_URL`, R2 credentials, and either `CLOUDFLARE_ACCOUNT_ID` or an explicit R2 endpoint. The command uploads WAVs directly from the local audio root, generates optional rendered WAVs locally, and writes generated JSON metadata to R2; the raw and rendered audio stay outside Git.

The uploader applies long-lived immutable cache headers to WAV sample payloads and short revalidating cache headers to generated JSON metadata (`sample-index.json` and `manifest.json`). That keeps stable sample URLs cacheable while allowing metadata corrections to propagate quickly.

The public bucket is connected to `https://media.massagelab.app` with the checked-in CORS policy at [../cloudflare/massagelab-public-media-cors.json](../cloudflare/massagelab-public-media-cors.json). The policy allows public browser `GET` and `HEAD` reads with the `Range` request header and exposes the media/cache headers needed by audio fetches.

On 2026-06-18 the first Observable Streams VSCO adaptation was uploaded to `massagelab-public-media`: 24 WAV files, `sample-index.json`, and `manifest.json`. Verification confirmed:

- `https://media.massagelab.app/atmosphere/observable-streams-vsco-adaptation/sample-index.json` returns `200` with `Content-Type: application/json; charset=utf-8`.
- `https://media.massagelab.app/atmosphere/observable-streams-vsco-adaptation/samples/piano-c-sharp2.wav` returns `200` with `Content-Type: audio/wav`.
- Both verified URLs return `Access-Control-Allow-Origin: *` when requested with an Origin header.

The hosted sample index is now wired into the Observable Streams station on `/browse`.

Later on 2026-06-18, the prerendered sample branch uploaded 30 rendered Observable Streams WAVs beside the source samples and refreshed `sample-index.json` plus `manifest.json`. The hosted index now includes these rendered instrument keys, which the runtime requests before source-key fallbacks:

- `observable-streams__vsco2-piano-mf`: 16 rendered notes.
- `observable-streams__vsco2-violin-arcvib`: 8 rendered notes.
- `observable-streams__sso-cor-anglais`: 6 rendered notes, still generated from the CC0 VSCO sustained-oboe replacement source.

Verification confirmed the refreshed sample index returns `200` with `Content-Type: application/json; charset=utf-8` and `Access-Control-Allow-Origin: *`. A rendered piano sample at `https://media.massagelab.app/atmosphere/observable-streams-vsco-adaptation/rendered/observable-streams__vsco2-piano-mf/rendered-piano-c4.wav` returned `206` for a range request with `Content-Type: audio/wav`, `Content-Range`, and `Access-Control-Allow-Origin: *`.

Also on 2026-06-18, the first non-Observable Streams batch was uploaded under `atmosphere/generative-fm/`:

| Piece | Hosted object prefix | Payload |
| --- | --- | --- |
| `aisatsana` | `atmosphere/generative-fm/aisatsana` | 23 VSCO upright piano source WAVs plus `sample-index.json` and `manifest.json`. |
| `at-sunrise` | `atmosphere/generative-fm/at-sunrise` | 11 VCSL vibraphone source WAVs, 8 rendered vibraphone WAVs, `sample-index.json`, and `manifest.json`. |
| `little-bells` | `atmosphere/generative-fm/little-bells` | 6 VSCO glockenspiel source WAVs, 10 rendered glockenspiel WAVs, `sample-index.json`, and `manifest.json`. |

The upload published 64 objects, approximately 140.6 MB of WAV payload, with no raw audio committed to Git. Verification confirmed each hosted `sample-index.json` returns `200` with JSON content and `Access-Control-Allow-Origin: *`; representative WAV range requests return `206`, `Content-Type: audio/wav`, a valid `Content-Range`, and `Access-Control-Allow-Origin: *`.

These first-batch indexes are intentionally piece-specific. `aisatsana` can use a hosted `vsco2-piano-mf` source index, but that shared source name is not marked globally hosted for every piano-backed package because other packages may request different exact rendered note names.

Later on 2026-06-18, the second piano-source batch was uploaded under `atmosphere/generative-fm/`:

| Piece | Hosted object prefix | Payload |
| --- | --- | --- |
| `day-dream` | `atmosphere/generative-fm/day-dream` | 23 VSCO upright piano source WAVs plus `sample-index.json` and `manifest.json`. |
| `eno-machine` | `atmosphere/generative-fm/eno-machine` | 23 VSCO upright piano source WAVs plus `sample-index.json` and `manifest.json`. |
| `impact` | `atmosphere/generative-fm/impact` | 23 VSCO upright piano source WAVs plus `sample-index.json` and `manifest.json`. |
| `lemniscate` | `atmosphere/generative-fm/lemniscate` | 23 VSCO upright piano source WAVs plus `sample-index.json` and `manifest.json`. |

The second-batch upload published 100 objects, approximately 344.6 MB of WAV payload, with no raw audio committed to Git. Verification confirmed each hosted `sample-index.json` and `manifest.json` returns `200` with JSON content; representative `vsco2-piano-mf-c-sharp4.wav` range requests return `206`, `Content-Type: audio/wav`, a valid `Content-Range`, and `Access-Control-Allow-Origin: *` when requested with an Origin header.

Later on 2026-06-18, the third piano-source batch was uploaded under `atmosphere/generative-fm/`:

| Piece | Hosted object prefix | Payload |
| --- | --- | --- |
| `pinwheels` | `atmosphere/generative-fm/pinwheels` | 23 VSCO upright piano source WAVs plus `sample-index.json` and `manifest.json`. |
| `sevenths` | `atmosphere/generative-fm/sevenths` | 23 VSCO upright piano source WAVs plus `sample-index.json` and `manifest.json`. |
| `uun` | `atmosphere/generative-fm/uun` | 23 VSCO upright piano source WAVs plus `sample-index.json` and `manifest.json`. |

The third-batch upload published 75 objects, approximately 258.5 MB of WAV payload, with no raw audio committed to Git. Verification confirmed each hosted `sample-index.json` and `manifest.json` returns `200` with JSON content; representative `vsco2-piano-mf-c-sharp4.wav` range requests return `206`, `Content-Type: audio/wav`, a valid `Content-Range`, and `Access-Control-Allow-Origin: *` when requested with an Origin header.

Later on 2026-06-18, the web-audio format pilot uploaded Observable Streams Opus sidecar payloads under the existing prefix:

| Format | Object layout | Payload |
| --- | --- | --- |
| Ogg Opus | `atmosphere/observable-streams-vsco-adaptation/web/opus/...` | 54 encoded audio objects plus `sample-index.opus.json` and `manifest.opus.json`. |

The Opus upload published 56 objects, approximately 10.7 MB of encoded audio payload, representing the same 172.1 MB WAV source/rendered plan. Verification confirmed `sample-index.opus.json` returns `200` with JSON content, short metadata caching, and `Access-Control-Allow-Origin: *`; representative rendered Opus range requests return `206`, `Content-Type: audio/ogg; codecs=opus`, a valid `Content-Range`, immutable cache headers, and `Access-Control-Allow-Origin: *`.

Later on 2026-06-18, the hosted Opus sidecars branch uploaded Opus payloads for the ten non-Observable playable stations:

| Scope | Object layout | Payload |
| --- | --- | --- |
| Hosted batch stations | `atmosphere/generative-fm/<piece>/web/opus/...` | 219 encoded audio objects plus 20 `sample-index.opus.json` and `manifest.opus.json` metadata objects. |

The batch Opus upload published 239 objects, approximately 31.3 MB of encoded audio payload, representing the same 743.7 MB WAV source/rendered plans. Verification confirmed all ten hosted batch `sample-index.opus.json` URLs return `200` with JSON content; representative direct-piano, rendered vibraphone, and rendered glock Opus range requests return `206`, `Content-Type: audio/ogg; codecs=opus`, valid `Content-Range`, immutable cache headers, and `Access-Control-Allow-Origin: *`.

On 2026-06-19, the rendered piano batch uploaded package-compatible rendered sample groups for three more Generative.fm stations:

| Piece | Hosted object prefix | WAV payload | Opus sidecar payload |
| --- | --- | --- | --- |
| `no-refrain` | `atmosphere/generative-fm/no-refrain` | 23 VSCO upright piano source WAVs, 12 rendered piano WAVs, `sample-index.json`, and `manifest.json`. | 35 Ogg Opus audio objects, `sample-index.opus.json`, and `manifest.opus.json`. |
| `transmission` | `atmosphere/generative-fm/transmission` | 23 VSCO upright piano source WAVs, 12 rendered piano WAVs, `sample-index.json`, and `manifest.json`. | 35 Ogg Opus audio objects, `sample-index.opus.json`, and `manifest.opus.json`. |
| `trees` | `atmosphere/generative-fm/trees` | 23 VSCO upright piano source WAVs, 13 rendered piano WAVs, `sample-index.json`, and `manifest.json`. | 36 Ogg Opus audio objects, `sample-index.opus.json`, and `manifest.opus.json`. |

The rendered-piano upload published 112 WAV-side objects, representing approximately 360.5 MB of WAV payload, and 112 Opus sidecar objects: 106 encoded audio payloads plus 6 sidecar metadata objects. The encoded Opus payload is approximately 16.9 MB, a 0.0469 compression ratio against the represented WAV payload. Verification confirmed each new `sample-index.json` and `sample-index.opus.json` returns `200` with JSON content, and representative rendered-piano Opus range requests return `206`, `Content-Type: audio/ogg; codecs=opus`, valid `Content-Range`, immutable cache headers, and `Access-Control-Allow-Origin: *`.

Later on 2026-06-19, the expanded source-index rollout uploaded the remaining currently covered local CC0 candidate pieces under `atmosphere/generative-fm/`:

| Scope | Object layout | Payload |
| --- | --- | --- |
| Expanded source-index rollout | `atmosphere/generative-fm/<piece>/samples/...` | 653 source WAV objects plus 50 `sample-index.json` and `manifest.json` metadata objects across 25 pieces. |
| Expanded source-index Opus sidecars | `atmosphere/generative-fm/<piece>/web/opus/...` | 653 encoded audio objects plus 50 `sample-index.opus.json` and `manifest.opus.json` metadata objects across the same 25 pieces. |

The WAV-side upload published 703 objects, representing approximately 2,077.7 MB of WAV payload, and the Opus upload published 703 sidecar objects with approximately 99.9 MB of encoded audio payload, a 0.0481 compression ratio. Verification confirmed all 25 new `sample-index.json`, `manifest.json`, `sample-index.opus.json`, and `manifest.opus.json` URLs return `200` with JSON content and `Access-Control-Allow-Origin: *`; representative beach ambience, darbuka, tenor sax Opus files and a piano WAV fallback returned `206 Partial Content`, correct audio content types, valid `Content-Range`, and `Access-Control-Allow-Origin: *`.

Later on 2026-06-19, the remaining-generator rollout uploaded the final 18 Generative.fm package pieces under `atmosphere/generative-fm/`:

| Scope | Object layout | Payload |
| --- | --- | --- |
| Remaining-generator rollout | `atmosphere/generative-fm/<piece>/samples/...` | 668 source WAV objects plus 36 `sample-index.json` and `manifest.json` metadata objects across 18 pieces. |
| Remaining-generator Opus sidecars | `atmosphere/generative-fm/<piece>/web/opus/...` | 668 encoded audio objects plus 36 `sample-index.opus.json` and `manifest.opus.json` metadata objects across the same 18 pieces. |

The WAV-side upload published 704 objects, representing approximately 1,491.6 MB of WAV payload, and the Opus upload published 704 sidecar objects with approximately 79.5 MB of encoded audio payload. Runtime-validator HTTP checks confirmed all 36 new `sample-index.json` and `sample-index.opus.json` URLs contain the required package groups. Representative Animalia Chordata WAV, Animalia Chordata Opus, Peace Opus, and Zed Opus payloads returned `206 Partial Content`, correct audio content types, valid `Content-Range`, and `Access-Control-Allow-Origin: *`.

Also on 2026-06-19, the AAC/MP3 sidecar rollout expanded compressed fallback coverage to all 57 playable Generative.fm stations:

| Scope | Object layout | Payload |
| --- | --- | --- |
| Observable Streams AAC | `atmosphere/observable-streams-vsco-adaptation/web/aac/...` | 54 AAC/M4A audio objects plus `sample-index.aac.json` and `manifest.aac.json`, representing 172.1 MB WAV as 10.0 MB AAC. |
| Observable Streams MP3 | `atmosphere/observable-streams-vsco-adaptation/web/mp3/...` | 54 MP3 audio objects plus `sample-index.mp3.json` and `manifest.mp3.json`, representing 172.1 MB WAV as 14.0 MB MP3. |
| Package-station AAC | `atmosphere/generative-fm/<piece>/web/aac/...` | 1,646 AAC/M4A audio objects plus 112 `sample-index.aac.json` and `manifest.aac.json` metadata objects across all 56 package stations, representing 4,673.5 MB WAV as 238.0 MB AAC. |
| Package-station MP3 | `atmosphere/generative-fm/<piece>/web/mp3/...` | 1,646 MP3 audio objects plus 112 `sample-index.mp3.json` and `manifest.mp3.json` metadata objects across all 56 package stations, representing 4,673.5 MB WAV as 313.5 MB MP3. |

The combined AAC upload published 1,814 sidecar objects and the combined MP3 upload published 1,814 sidecar objects. HTTP verification confirmed all 57 AAC and all 57 MP3 `sample-index` URLs return JSON with CORS and the required package sample groups. Representative Observable Streams, Peace, and Zed AAC/MP3 payloads returned `206 Partial Content`, `Content-Type: audio/mp4; codecs=mp4a.40.2` or `audio/mpeg`, valid `Content-Range`, and `Access-Control-Allow-Origin: *`.

## Generative.fm Adapter Runtime

- `/music` exposes the full 57-piece Alex Bainter Generative.fm package catalog through MassageLab's global music provider, swipe/scroll category rails, deterministic organic-geometric SVG station artwork, and a persistent placement-aware audio toolbar. `/atmosphere` and `/wellness/atmosphere` are not retained after the navigation move, and `/browse` remains available as a compatibility grid/workbench for the same station runtime.
- The browser-only adapter fetches and validates the hosted sample index for the selected verified station with browser cache-aware semantics, creates the Generative.fm web library/provider pair, loads the requested package through the aggregate package loader, starts Tone transport, and returns cleanup to the existing runtime controller.
- When a station exposes compressed sidecars, the runtime chooses the first browser-supported sample index in this order: Ogg Opus via `audio.canPlayType('audio/ogg; codecs="opus"')`, AAC-LC in M4A/MP4 via `audio.canPlayType('audio/mp4; codecs="mp4a.40.2"')`, MP3 via `audio.canPlayType("audio/mpeg")`, and finally the WAV `hostedSampleIndexUrl`. All currently playable Generative.fm stations now expose Opus, AAC, and MP3 sidecar URLs.
- Startup prewarm validates hosted sample-index metadata and imports shared browser runtime modules for a small starter station set after idle. Station hover/focus and play-button pointer-down remain metadata-only so browsing or tapping the full catalog does not trigger speculative sample-payload fetches that compete with the real playback loader. It intentionally does not start Tone, start Transport, construct output nodes, or download WAV fallback payloads before a user chooses playback.
- Playback dispatches `massagelab:atmosphere-startup-timing` with station, piece, selected sample format, completed metadata-prewarm reuse, retained sample-payload warmup fields, provider request/decode counts, and phase timing details. Runtime progress is also reported to the shared music provider so station cards and the persistent mini-player can show visible preparing feedback. Console logging is opt-in with `localStorage.setItem("massagelab:atmosphere:debug", "1")`.
- Generative.fm output nodes start at silence and ramp to the saved volume over the handoff fade window. Cleanup ramps the outgoing output down before deactivating the package piece; if a newer station claims Tone's shared Transport during that fade, the old cleanup avoids stopping the newer station's Transport.
- The station id for Observable Streams remains `observable-streams-probe` for local favorites and recent-station storage stability while the display copy treats it as a playable station.
- The current hosted public-media indexes enable all 57 Generative.fm pieces: Observable Streams plus all 56 Alex Bainter package pieces through Zed. No Generative.fm catalog entries remain sample-pending.
- Manifest-level source-group matches such as `vsco2-piano-mf` are not enough to enable a station by themselves. Future enablement should add package-compatible rendered sample groups or otherwise verify note coverage before flipping a station to playable. The hosting registry therefore supports piece-scoped indexes without treating shared source names as global hosted coverage.
- The local audio root currently contains VSCO 2 Community Edition, VCSL, and selected Signature Sounds packs. The known covered candidates and deliberate replacement mappings are now hosted. Future work should focus on performance and custom-generator controls rather than basic catalog coverage.
- Next/Turbopack resolves `tone` to `tone/build/esm/index.js` and maps `regenerator-runtime/runtime.js` to a local no-op shim because the older Generative.fm packages otherwise fail the Next 16 production build before runtime.
- Observable Streams, At Sunrise, Little Bells, No Refrain, Transmission, and Trees include package-compatible rendered instrument keys, so those stations should skip browser-time prerendering on first start. The source-index stations use piece-scoped VSCO, VCSL, and Signature Sounds indexes directly. Keep browser smoke coverage around first play because these optimizations depend on each package continuing to request the same source or rendered names.

## CI Build Cache

- GitHub Actions already uses `actions/setup-node` with `cache: npm`, which caches npm package download data but does not persist Next.js build output.
- The CI workflow now restores and saves `${{ github.workspace }}/.next/cache` through a pinned `actions/cache@v4` step so repeated PR runs can reuse Next/Turbopack build artifacts.
- The cache key includes the runner OS, `package-lock.json`, framework config files, Prisma schema files, and app/library source files, with lockfile-scoped restore fallbacks for source-only changes.
- Pull-request CI uses concurrency cancellation so superseded commits do not keep consuming time after a newer commit is pushed to the same PR.
- CI validates and generates Prisma explicitly, then calls `npm run build:next` so the build step does not trigger the local `prebuild` Prisma generation a second time. Local `npm run build` still keeps the normal Prisma prebuild behavior.
- Playwright browser installation remains explicit with `npx playwright install --with-deps chromium`; do not cache browser binaries unless a later timing check proves it is faster than restore plus Linux dependency installation.

## Attribution Draft

Generative.fm pieces by Alex Bainter. Packages used with permission and MIT package licensing. Playable MassageLab stations use hosted public-media sample indexes, including CC0 VSCO, VCSL, and Signature-compatible adaptations plus VSCO sustained oboe under the Observable Streams `sso-cor-anglais` role.
