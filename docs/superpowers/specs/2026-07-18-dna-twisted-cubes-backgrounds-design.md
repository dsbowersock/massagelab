# DNA and Twisted Cubes Premium Backgrounds Design

**Date:** 2026-07-18

**Status:** Reviewed and approved for implementation planning

**Track:** 4B of 6

**Surfaces:** Active Chimer, `/clock`, Music visualizer, BackgroundHost, Visual panel, preview workflow, and background source ledger

## Summary

Add two enabled premium backgrounds adapted from the supplied MIT-licensed CodePen archives:

- **DNA** from `css-trigonometric-function-dna-strand.zip` and <https://codepen.io/jh3y/pen/GRBVNJE>.
- **Twisted Cubes** from `cubies.zip` and <https://codepen.io/jh3y/pen/qBoGJQj>.

Implement both as native React components with scoped CSS. Preserve each source effect's visual character while exposing a curated, responsive set of geometry and motion controls. Integrate colors exclusively through Track 4A's shared Source/Custom/Harmony palette adapter, role mapping, draft editing, and Visual preset system.

DNA keeps random node-color assignment on every mount. Twisted Cubes keeps its layered 3D rotation and uses a smooth six-anchor outline gradient in Custom and Harmony modes. Both share one saved configuration across Chimer, Clock, and the Music visualizer.

## Dependencies

Track 4B starts only after Track 4A's shared palette system is complete. It consumes:

- registry palette adapters;
- seven shared swatches;
- Source/Custom/Harmony resolution;
- per-background role mapping;
- non-color visual property definitions;
- draft Undo/Redo/Apply/Cancel;
- separate Color and Visual presets;
- account/local preference synchronization; and
- effective color access based on feature entitlement or permanent ownership.

Track 4B must not recreate any of those systems. Track 1 remains the server authority for permanent ownership, while Track 2 remains the authority for the Clock/Visual/Background panel shell and Music visualizer context.

## Source And License

Both attached archives contain complete source and an MIT license attributed to Jhey, 2026. The implementation may adapt the internal HTML, CSS, and JavaScript needed to render the effects inside MassageLab.

Implementation records both sources in `docs/background-sources.md` with:

- CodePen URL;
- provider and author;
- MIT license status;
- enabled premium usage;
- internal application use;
- source archive name;
- adaptation notes; and
- preview status.

No source download, reusable component package, or implementation-oriented artifact is exposed to users.

## Goals

- Ship DNA and Twisted Cubes as enabled premium backgrounds.
- Preserve source defaults until a user changes visual properties or colors.
- Use native React-generated markup plus scoped CSS Modules.
- Use Track 4A palette roles instead of new per-background color fields.
- Expose approved, responsive, bounded visual controls.
- Keep one configuration across Chimer, Clock, and Music visualizer contexts.
- Support reduced motion with a representative static composition.
- Generate short preview videos plus poster fallbacks through the existing workflow.
- Avoid new runtime dependencies, iframe isolation, Canvas rewrites, and pointer-drag interaction.

## Non-goals

- Building the Track 4A palette, draft, preset, or migration foundation.
- Adding purchase, credit, cart, refund, chargeback, or ownership storage.
- Adding pointer drag, touch rotation, cursor response, or shuffle-colors actions.
- Adding route-specific settings copies.
- Making DNA's random node-role assignment a saved preference.
- Persisting Twisted Cubes' computed intermediate colors.
- Reproducing the source archives' global `body`, universal selector, font, or `touch-action` rules.
- Replacing the Background picker carousel.

## Architecture

### Component boundaries

Create two focused client-side effects:

```text
components/backgrounds/effects/
  massage-lab-dna-background.tsx
  massage-lab-dna-background.module.css
  massage-lab-twisted-cubes-background.tsx
  massage-lab-twisted-cubes-background.module.css
```

Each component receives:

- sanitized non-color visual properties;
- resolved named palette-role colors;
- reduced-motion state through the existing host lifecycle; and
- normal `BackgroundEffectProps` integration.

The components do not import account, billing, membership, route, preset, or storage modules. `BackgroundHost` and the Track 4A adapter resolver remain the integration boundary.

### Registry entries

Use stable IDs:

```ts
"massage-lab-dna";
"massage-lab-twisted-cubes";
```

Both entries are:

- enabled;
- premium;
- available to `chimer`, `clock`, `music`, and `ambient` categories;
- MIT verified;
- medium motion intensity;
- medium CSS/DOM performance cost; and
- backed by static fallback styling and generated preview media.

### Rendering approach

DNA generates strand markup from the sanitized strand count. React assigns stable random node-role indexes for the current mounted count. CSS performs the node crossover, connector scaling, and whole-strand rotation.

Twisted Cubes generates one wrapper, cube, cuboid, and six faces per sanitized layer. CSS performs staggered rotations and 3D transforms. The component calculates each layer's outline color and alpha from the resolved palette roles and current layer index.

Neither component uses an iframe, Canvas, WebGL, external animation library, or runtime network request.

## DNA Source Behavior

The source defaults are:

- 13 strands;
- 2-second node crossover cycle;
- 14-second whole-strand rotation;
- 30-degree strand angle;
- 65vmin source height and 2:5 aspect ratio;
- 0.5vmin strand gap;
- 94% connector width;
- 30% connector thickness;
- 0.5vmin outlines;
- dark blue background;
- yellow, blue, white, and pink random node colors;
- white connectors; and
- black outlines.

MassageLab preserves the crossover geometry, phase relationship, opposite node animation directions, connector collapse timing, and overall rotation.

### Random node assignments

Each node receives one of four role IDs through a pure helper comparable to:

```ts
createDnaNodeRoleAssignments(nodeCount, (random = Math.random));
```

Production uses real randomness. Tests inject a deterministic random function.

Assignments are created when the client-mounted component initializes. They remain stable while the mounted background changes palette, position, scale, or motion settings. Changing strand count regenerates a valid assignment set for the new node count. Unmounting and remounting creates a new distribution.

Random assignments operate in Source, Custom, and Harmony modes. The assignment indexes are transient runtime data: they are never placed in local storage, account preferences, presets, or draft history.

### Cross-browser phase calculation

Instead of depending on CSS trigonometric functions, React computes each strand's sine-based phase with `Math.sin` and passes it through a scoped CSS variable. This preserves the source timing in browsers without `sin()` support and removes the source's feature-detection script.

## Twisted Cubes Source Behavior

The source defaults are:

- 20 cube layers;
- 4-second rotation cycle;
- 0.1-second layer stagger;
- -35-degree X view angle;
- -45-degree Y view angle;
- 50vmin scene size;
- 50vmin source layer depth spacing;
- 0.85 opacity falloff;
- relative outline thickness of 0.0075 of scene size;
- dark blue-gray background and face fill; and
- a continuous 180-to-340-degree HSL outline range at 80% saturation and 60% lightness.

MassageLab preserves the four-stage X/Y/Z rotation sequence and its cubic-bezier timing. It does not add pointer or touch rotation. Viewing angles change only through Visual-panel sliders.

For adjustable layer counts, the negative animation delay is normalized as a count-relative form of the source `(-18 + index) * 0.1s` expression, preserving the default phase at 20 layers while retaining a coherent traveling sequence at other counts.

## Visual Property Contract

All properties use Track 4A's registry visual-property sanitizer and Visual preset contract. Defaults are source values.

### DNA properties

| Property              |      Stored range | Default | UI behavior                        |
| --------------------- | ----------------: | ------: | ---------------------------------- |
| Strand count          |      integer 7-25 |      13 | Bounded count control              |
| Node motion speed     |          0.25x-3x |      1x | Renderer duration is `2s / speed`  |
| Strand rotation speed |           0.1x-3x |      1x | Renderer duration is `14s / speed` |
| Strand angle          | -180deg to 180deg |   30deg | Degree slider                      |
| Scale                 |           0.4-1.2 |       1 | Responsive percentage display      |
| Horizontal position   |       -35% to 35% |      0% | Center-relative slider             |
| Vertical position     |       -35% to 35% |      0% | Center-relative slider             |
| Strand spacing        |           0-2vmin | 0.5vmin | Formatted spacing control          |
| Connector width       |          60%-100% |     94% | Percentage slider                  |
| Connector thickness   |           10%-60% |     30% | Percentage slider                  |
| Outline thickness     |         0-1.5vmin | 0.5vmin | Allows zero outline                |

### Twisted Cubes properties

| Property            |    Stored range | Default | UI behavior                         |
| ------------------- | --------------: | ------: | ----------------------------------- |
| Layer count         |    integer 6-30 |      20 | Bounded count control               |
| Rotation speed      |        0.25x-3x |      1x | Renderer duration is `4s / speed`   |
| Layer stagger       |          0-0.3s |    0.1s | Independent delay control           |
| X viewing angle     | -80deg to 80deg |  -35deg | Slider only                         |
| Y viewing angle     | -80deg to 80deg |  -45deg | Slider only                         |
| Scale               |         0.4-1.2 |       1 | Responsive percentage display       |
| Horizontal position |     -35% to 35% |      0% | Center-relative slider              |
| Vertical position   |     -35% to 35% |      0% | Center-relative slider              |
| Layer depth spacing |       10-70vmin |  50vmin | Bounded depth control               |
| Opacity falloff     |          0-0.95 |    0.85 | Retains source fade by default      |
| Outline thickness   |     0.0025-0.02 |  0.0075 | Displayed as relative scene percent |

### Responsive bounds

A shared pure layout helper clamps scale and X/Y position against viewport aspect ratio and protected display space. Saved values remain unchanged; only the effective render transform is clamped. This lets the same preference recover when the viewport becomes larger and prevents a phone layout from making an effect unreachable.

Count, spacing, and depth sanitizers protect DOM and transform cost independently of viewport clamping.

## Palette Adapter Contracts

Both effects consume Track 4A's shared palette state and never persist their own colors.

### DNA roles

DNA declares seven stable roles:

| Role ID      | Label      | Source value         | Curated swatch |
| ------------ | ---------- | -------------------- | -------------: |
| `background` | Background | `hsl(210 80% 12%)`   |              4 |
| `node-one`   | Node 1     | `hsl(44 98% 60%)`    |      1 Primary |
| `node-two`   | Node 2     | `hsl(197 50% 44%)`   |              2 |
| `node-three` | Node 3     | `hsl(300 100% 100%)` |              3 |
| `node-four`  | Node 4     | `hsl(331 76% 50%)`   |              6 |
| `connector`  | Connector  | `#ffffff`            |              5 |
| `outline`    | Outline    | `#000000`            |              7 |

Source mode uses the source values directly and keeps random assignment among the four Node roles.

Custom and Harmony resolve the same roles through the active per-background mapping. Random assignment still selects among Node 1-4; palette changes recolor existing role assignments without reshuffling them.

### Twisted Cubes roles

Twisted Cubes declares seven stable roles:

| Role ID         | Label      | Source behavior                         | Curated swatch |
| --------------- | ---------- | --------------------------------------- | -------------: |
| `background`    | Background | Dark blue-gray background and face fill |              4 |
| `outline-one`   | Outline 1  | Start of source hue range               |      1 Primary |
| `outline-two`   | Outline 2  | Source-derived anchor                   |              2 |
| `outline-three` | Outline 3  | Source-derived anchor                   |              3 |
| `outline-four`  | Outline 4  | Source-derived anchor                   |              5 |
| `outline-five`  | Outline 5  | Source-derived anchor                   |              6 |
| `outline-six`   | Outline 6  | End of source hue range                 |              7 |

Source mode preserves the original continuous HSL formula instead of quantizing it into six visible bands.

Custom and Harmony use piecewise sRGB interpolation between the six resolved Outline anchors. For normalized layer position `t` from 0 to 1, the renderer selects one of five adjacent anchor segments and interpolates its RGB channels. First and last layers receive the first and sixth anchors exactly.

Depth alpha remains independent of color interpolation:

```ts
alpha = clamp(1 - (opacityFalloff / layerCount) * oneBasedLayerIndex, 0, 1);
```

At the source defaults, the deepest layer reaches an alpha of 0.15.

### Mapping behavior

The curated mappings use all seven swatches once and place the default dark global swatch on Background. Users may remap any role through Track 4A. Multiple roles may share one swatch. Reset visual properties restores the curated mapping without changing the global palette.

## Visual Panel Organization

Track 4B adds properties to Track 4A's approved Visual panel structure:

1. Keep screen awake;
2. Shared Colors and role mapping;
3. Selected Background Properties;
4. Color presets and per-background Visual presets in their approved sections; and
5. sticky Undo/Redo/Apply/Cancel/status actions.

When DNA is selected, its controls are grouped as Motion, Geometry, Position and scale, Connector, and Outline.

When Twisted Cubes is selected, its controls are grouped as Motion, View angles, Geometry and depth, Position and scale, Fade, and Outline.

Viewing angles are sliders only. No control, card, preview, or effect surface captures pointer movement for direct rotation. No shuffle-colors action is present.

Every property edit remains a Track 4A draft action. Reset, Undo, Redo, Apply, Cancel, unsaved-change guards, Visual preset save/apply/update/rename/delete/default, and account retry follow the existing foundation without background-specific variants.

## Persistence And Context Sharing

Track 4B adds only sanitized non-color property keys and adapter metadata to Track 4A. The current values continue through the existing Chimer preference JSON and Visual preset record.

One committed value set is shared by:

- active Chimer;
- ordinary `/clock`;
- `/clock?source=music`; and
- any ambient/background surface that uses the shared host and category.

Changing context does not duplicate, translate, or reset the configuration. A draft belongs to the current Visual editing session; committed values are visible in the next context.

Derived runtime data is excluded from persistence:

- DNA random role assignments;
- DNA calculated sine phases;
- Twisted Cubes per-layer interpolated colors;
- Twisted Cubes per-layer alpha;
- effective responsive transform clamps; and
- generated DOM layer arrays.

## Access And Ownership

Both background cards use the canonical background-access resolver created by Track 1 and the existing feature-key entitlement path.

- `premium_backgrounds` permits subscribers to use both effects.
- Permanent ownership permits the owned effect to remain usable after subscription cancellation.
- `chimer_custom_colors` permits Custom/Harmony across compatible effects.
- Permanent ownership of DNA or Twisted Cubes permits Custom/Harmony for that owned effect through Track 4A's approved color-access rule.
- Source mode remains the effective color mode when an otherwise usable background lacks Custom/Harmony access.
- Refund or chargeback revocation removes ownership-based use/customization while retaining sanitized saved preferences.

The components receive only already-resolved access-safe props. They do not inspect plan labels, sessions, billing state, carts, local purchase flags, or ownership tables.

## Reduced Motion And Static Representation

Both effects honor the existing ambient-motion resolver and host lifecycle.

### DNA static state

Reduced motion renders the configured strand count, angle, scale, position, spacing, connector geometry, outlines, and current role colors at a representative crossover phase. Node and strand animations are paused. Random role assignments still provide the approved multicolor composition.

### Twisted Cubes static state

Reduced motion renders the configured layer count, viewing angles, scale, position, depth spacing, falloff, outline thickness, and resolved gradient at a representative middle phase. Cube animations are paused.

Static states remain decorative and do not introduce separate saved preferences.

## Styling Isolation And Accessibility

Both roots are:

- `aria-hidden="true"` through the existing host;
- non-focusable;
- `pointer-events: none`;
- contained by the host bounds; and
- scoped through CSS Modules.

Do not copy the source archives' `body`, `:root`, `*`, `*:before`, `*:after`, global font, `min-height`, or `touch-action` rules. Required box sizing and `transform-style` declarations apply only beneath each component root.

Visual controls retain Track 4A labels, keyboard behavior, value formatting, dirty state, and 200% zoom support. Motion-speed labels communicate Faster/Slower or multipliers rather than requiring users to reason about inverse CSS duration.

## Lifecycle And Performance

- `BackgroundHost` lazy-loads only the selected component.
- DNA renders at most 25 strands and 50 nodes.
- Twisted Cubes renders at most 30 layers and 180 faces.
- Palette or property changes update the mounted component without mounting other backgrounds.
- DNA role assignments do not reshuffle on ordinary palette/property changes.
- CSS animations stop when the component unmounts.
- No window, document, pointer, touch, animation-frame, or resize listeners are required inside either effect.
- The existing host continues to own reduced-motion fallback and component cleanup.
- CSS containment and scoped custom properties prevent effect styles from invalidating unrelated route content.

The implementation adds no runtime package.

## Preview Media

Use the existing Chimer preview generation workflow to create:

- a short looping preview video for DNA;
- a poster fallback for DNA;
- a short looping preview video for Twisted Cubes; and
- a poster fallback for Twisted Cubes.

Previews use source defaults and a representative source-color composition. DNA's generated preview records one acceptable random distribution; preview rendering does not make production assignments deterministic.

Update the preview manifest and source ledger only after generated files validate. Runtime selection never generates or downloads preview assets dynamically.

## Error Handling

- Invalid or missing properties fall back through the registry sanitizer to source defaults.
- Invalid role colors fall back through Track 4A to adapter source values.
- Invalid mappings fall back to curated mappings.
- An invalid random value is clamped into one of the four DNA role indexes.
- Layer or strand counts are integers within their approved limits.
- Invalid speed values never produce zero, negative, infinite, or `NaN` durations.
- Invalid viewport measurements use centered saved values and source scale.
- Component import/render failure continues through the existing BackgroundHost fallback.
- Preview-generation failure does not enable a broken manifest entry.
- Preference sync failure keeps Track 4A's locally applied state and retry behavior.

## Validation Contract

### Pure tests

- Every property default equals the supplied source value.
- Every property sanitizer clamps invalid, fractional, negative, excessive, and non-finite input.
- Responsive transforms clamp effective output without mutating saved values.
- DNA assignment returns exactly `strandCount * 2` valid role indexes.
- Injected randomness produces deterministic test assignments.
- DNA phase calculation matches the source sine expression.
- DNA duration helpers preserve independent node and strand speeds.
- Twisted Cubes count-relative stagger matches the source phase at 20 layers.
- Twisted Cubes interpolation uses six anchors, five segments, and exact endpoints.
- Twisted Cubes alpha reaches 0.15 at source defaults.
- Derived runtime values are absent from serialized visual preferences and presets.

### Registry and adapter tests

- Both stable IDs are enabled premium entries in all approved categories.
- Both entries use verified MIT metadata and source URLs.
- Both adapters declare seven unique roles with valid source colors and renderer targets.
- Curated mappings use each shared swatch once.
- Source mode reproduces source palette behavior.
- Custom/Harmony resolves only through named roles.
- No per-background palette mode, Primary, harmony, or individual color preference fields are introduced.
- `docs/background-sources.md` and the preview manifest match registry status.

### Source-isolation tests

- No iframe, Canvas, WebGL, external animation import, or runtime fetch exists.
- No global `body`, `:root`, universal-selector, or `touch-action` rule escapes the CSS Module roots.
- No pointer, touch, mousemove, drag, or cursor handler is registered.
- No shuffle-colors action is present.
- The components do not import account, billing, membership, route, or preference modules.

### Browser tests

For both backgrounds:

- selection works in active Chimer, `/clock`, and Music visualizer;
- one configuration remains consistent across contexts;
- every approved property previews, applies, cancels, undoes, redoes, resets, and participates in Visual presets;
- Source/Custom/Harmony and role remapping work through Track 4A;
- DNA does not reshuffle during palette/property edits but does after remount;
- Twisted Cubes changes gradients smoothly without discrete repeating bands;
- permanent ownership and subscription access produce the approved result;
- timer state and Music playback continue during edits;
- reduced motion is static;
- no console, hydration, fallback, or cleanup error occurs; and
- controls remain usable at desktop, phone portrait, short landscape, and 200% zoom.

### Preview and repository gate

- Render and validate both short videos and posters.
- Run focused Node tests.
- Run focused desktop/mobile Playwright tests.
- Run Track 4A's exhaustive background render sweep.
- Run `npm run lint`.
- Run `npm run typecheck`.
- Run `npm run test`.
- Run `npm run build`.
- Run `git diff --check`.
- Manually compare source-default renders with the supplied archives.

## Approved Decisions

- Use native React plus scoped CSS, not Canvas, iframe, or an external runtime.
- Name the backgrounds DNA and Twisted Cubes.
- Enable both as premium backgrounds across Chimer, Clock, Music, and ambient categories.
- Preserve source behavior while allowing user customization.
- Use one shared configuration across all contexts.
- Use generated short videos plus poster fallbacks.
- Use representative static reduced-motion states.
- Keep DNA's node assignment truly random on every mount.
- Apply DNA randomness in Source, Custom, and Harmony.
- Give DNA separate node-motion and whole-strand-rotation speed controls.
- Make DNA strand count adjustable from 7 to 25 with source default 13.
- Use DNA roles for Background, four Node colors, Connector, and Outline.
- Give Twisted Cubes sliders only; do not add drag interaction.
- Smoothly interpolate Twisted Cubes colors instead of repeating discrete swatches.
- Use one Twisted Cubes Background role plus six Outline anchors.
- Make Twisted Cubes layer count adjustable from 6 to 30 with source default 20.
- Give Twisted Cubes separate rotation-speed and layer-stagger controls.
- Add adjustable opacity falloff with the source value as default.
- Include bounded X/Y position controls for both effects.
- Retain all Track 4A draft, reset, preset, mapping, access, and persistence behavior.
- Add no shuffle-colors action.
- Add no public Roadmap entry for this work.
