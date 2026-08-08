# Proprietary Repository Licensing Design

**Date:** 2026-08-07
**Status:** Approved for implementation
**Owner:** Derrick Bowersock, doing business as Massage Lab

## Objective

Keep the MassageLab GitHub repository public for CodeRabbit and source review while making its legal posture unambiguous: MassageLab is source-visible proprietary software, not open-source software.

## Confirmed Ownership and Date

- Derrick Bowersock owns the software personally.
- Massage Lab is his registered Ohio trade name; no LLC or corporation currently owns the software.
- The copyright notice will omit the professional credential `LMT` because it is not part of the owner's legal identity.
- Vercel records show the first successful Production deployment on January 6, 2025. Its retained build output includes both `/chimer` and `/anatomime`, and the project has no earlier deployment records.
- The repository notice will therefore use `2025–2026` as the supported publication range.

The canonical notice is:

> Copyright © 2025–2026 Derrick Bowersock, doing business as Massage Lab. All rights reserved.

## Repository License

Add a root `LICENSE` file titled `MassageLab Proprietary License`. It will:

1. Include the canonical copyright notice.
2. State that the repository and its contents are source-visible proprietary software and are not open-source.
3. State that public visibility does not grant permission to use, copy, modify, merge, publish, distribute, sublicense, sell, or create derivative works from MassageLab-owned repository content without prior written permission, except where applicable law expressly permits it.
4. Clarify that use of the hosted MassageLab application is governed by the application's user-facing terms rather than by access to this repository.
5. Preserve the independent license terms of third-party libraries, media, fonts, and other incorporated or referenced materials.
6. Include a conventional `AS IS` warranty and liability disclaimer.

The license will not claim ownership of third-party materials or override their existing licenses.

## README Notice

Replace the current provisional `License` section in `README.md` with:

- the canonical copyright notice;
- a direct statement that MassageLab is source-visible proprietary software and not open-source;
- a statement that public access does not grant reuse, modification, or redistribution rights; and
- a link to the root `LICENSE` file for the complete terms.

The README will remain public-facing and concise rather than duplicating the full license text.

## Application Footer

The application has no global content footer. Its established shared footer surface is `SidebarFooter` in `components/sidebar/app-sidebar-client.tsx`.

Add a compact version of the canonical notice to that shared footer:

> © 2025–2026 Derrick Bowersock, d/b/a Massage Lab. All rights reserved.

Placement and behavior:

- Display the notice in the expanded desktop sidebar and in the mobile sidebar drawer.
- Hide it in the collapsed icon-only rail, where the text cannot fit accessibly.
- Use subdued, readable text styling and preserve the existing navigation and account-menu hierarchy.
- Do not add the notice to immersive Chimer or Clock display chrome and do not introduce a new global footer that could reduce the protected application viewport.

## Package Metadata

Add the exact top-level field below `"private": true` in `package.json`:

```json
"license": "UNLICENSED"
```

This metadata reinforces that the package is not offered under an open-source package license. It does not replace the repository `LICENSE` terms.

## Verification Design

Use a test-first source-contract check:

1. Add a focused Node test that asserts the root `LICENSE` exists and contains the proprietary, not-open-source, ownership, and all-rights-reserved statements.
2. Assert that `README.md` contains the concise source-visible proprietary notice and links to `LICENSE`.
3. Parse `package.json` and assert that `license` is exactly `UNLICENSED`.
4. Assert that the shared sidebar footer contains the compact copyright notice and hides it in the collapsed icon-only state.
5. Run the new focused test before implementation and confirm that it fails for the missing licensing posture.
6. Implement only the approved changes and rerun the focused test to green.
7. Run the full unit suite, lint, typecheck, and `git diff --check` before completion.

No browser test is required because the footer change uses the existing shared footer and responsive state classes without introducing new interaction or layout behavior. Browser verification may be added if implementation reveals a layout regression risk.

## Scope Boundaries

Included files are expected to be:

- `LICENSE`
- `README.md`
- `package.json`
- `components/sidebar/app-sidebar-client.tsx`
- one focused test under `tests/`

Implementation-planning documentation under `docs/superpowers/` is also in scope under the requested Superpowers workflow.

Out of scope:

- changing repository visibility;
- changing CodeRabbit configuration;
- registering the copyright;
- forming an LLC or assigning the copyright to a future entity;
- changing user-facing Terms, Privacy, purchase licenses, or third-party attribution;
- adding source headers to every file; and
- changing existing open-license or commercial-use records for third-party anatomy and media assets.

## Legal Review Boundary

This implementation records the owner's requested proprietary posture using standard repository notices. It is not a substitute for attorney review, copyright registration, or a future written assignment if ownership moves to an LLC or another entity.

## Evidence

- [U.S. Copyright Office, Copyright Act § 401](https://www.copyright.gov/title17/92chap4.html): identifies the conventional notice elements as the copyright symbol, first-publication year, and owner name or recognizable alternative designation.
- [U.S. Copyright Office, Compendium Chapter 700](https://copyright.gov/comp3/chap700/ch700-literary-works.pdf): explains that general distribution of program code can constitute publication even when object code rather than source code is distributed.
- [Ohio Secretary of State business glossary](https://www.ohiosos.gov/business/ohio-business-roadmap/starting-a-business/glossary): distinguishes a registered trade name from its owner and explains that a sole proprietorship has no legal distinction from the individual owner.
- [Earliest retained MassageLab Vercel deployment](https://vercel.com/dsbteam/b_grxqskh35zw/B4AwZW6JPP58MUMBtYuh951NfJu7): January 6, 2025 Production deployment whose build output lists both `/chimer` and `/anatomime`.
