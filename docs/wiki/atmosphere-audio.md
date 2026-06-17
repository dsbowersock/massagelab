# Atmosphere Audio

This page records source, licensing, and runtime findings for the public Atmosphere audio branch series.

## Current Product Boundary

Atmosphere is a public, non-clinical audio workspace. It does not store PHI, therapist professional records, client appointment details, or clinical notes. The first implementation stays hidden from primary navigation while playback reliability, browser behavior, and source permissions are verified.

## Runtime Decision

MassageLab hosts the audio runtime in the app. It does not embed Generative.fm as a remote player UI. The first audible branch uses a small local Tone.js proof station so global audio lifecycle, route persistence, and cleanup can be validated before sample-heavy imported pieces are exposed.

## Package Findings

| Package | Version | License | Source |
| --- | --- | --- | --- |
| `tone` | `14.9.17` | MIT | https://github.com/Tonejs/Tone.js |
| `@generative-music/web-provider` | `3.0.0` | MIT | https://github.com/generative-music/web-provider |
| `@generative-music/web-library` | `0.2.2` | MIT | https://github.com/generative-music/web-library |
| `@generative-music/piece-observable-streams` | `5.2.0` | MIT | https://github.com/generative-music/piece-observable-streams |

## Generative.fm Piece Probe

`@generative-music/piece-observable-streams` exports a default piece that activates through a Generative.fm-style sample library. Its package manifest lists these sample names:

- `observable-streams__vsco2-piano-mf`
- `observable-streams__vsco2-violin-arcvib`
- `observable-streams__sso-cor-anglais`

The selected package does not include the actual sample-index data needed to resolve those names to hosted audio files. Until MassageLab has explicit sample hosting or a documented first-party sample index, Observable Streams should remain a disabled catalog probe rather than a playable station.

## Attribution Draft

Observable Streams by Alex Bainter. Used as a Generative.fm package probe with permission and MIT package licensing. Before any imported piece becomes playable, verify sample file license, hosting rights, CORS behavior, and attribution wording.
