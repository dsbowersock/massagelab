# Atmosphere Polish And QA

## Goal

Improve the public Atmosphere listening experience after live station testing: reduce startup load pressure, show visible loading feedback, separate the breathing guide into its own Wellness tool page, organize stations by listener intent, and add persistent player station navigation.

## Scope

- Keep `/wellness/atmosphere` and `/browse` on the shared station workspace and global music provider.
- Move the breathing guide to `/wellness/breathing` while linking it from Atmosphere and the Wellness hub.
- Keep audio public and non-clinical; do not store account audio selections beyond existing non-PHI favorites/recent/volume browser preferences.
- Keep YouTube, subscription gating, user-authored generators, and sample replacement/remastering outside this branch.

## Implementation Notes

- Reduce background prewarm from all playable Generative.fm stations to a small starter set. Hover/focus and play-button pointer-down should prepare metadata/modules only so sample-payload warmup does not compete with the real playback loader.
- Add runtime progress callbacks so station cards and the persistent mini-player can display preparing state during slow first starts.
- Add previous/next station controls to the mini-player so active playback behaves more like a station tuner.
- Group stations by listener-facing sound feel rather than backend package/sample details.
- Update the descriptions for stations flagged in manual QA so sparse, wave-like, or voice-like stations set expectations more accurately.

## Validation Plan

- Focused node tests for Atmosphere station catalog, grouping, runtime controller, and navigation.
- Typecheck and lint for the React/provider changes.
- Rendered browser QA for `/wellness/atmosphere` and `/wellness/breathing`, including route-persistent player behavior and loading feedback.
