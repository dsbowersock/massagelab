# AtmoShaper Migration Rollback Plan

## Source Lock and Non-Negotiable Preservation

This plan applies to the source repository `https://github.com/dsbowersock/massagelab` at selected `main` SHA `fa78ca01a42179329cc223df77c76f308e76320b` (2026-09-06). The old repository remains unchanged, accessible, and authoritative for historical evidence and rollback. No rollback action may rewrite its history, remove historical material, archive it, change its visibility, or alter its production service without separate authorization.

The migration is reversible only because its phases preserve the source commit, bound changes into reviewable units, and avoid production/provider mutation until a separately authorized later cutover. A failed source or destination verification is a stop condition, not an invitation to weaken parity.

## Phase 1 Rollback

- Phase 1 may add only migration-owned documentation, inventories, evidence, characterization tests, and audit tooling within its approved task boundaries.
- Roll back only the specific task-owned documentation or test commit that introduced an error, after verifying its exact paths and that it contains no unrelated work.
- Do not alter `main`, production, providers, databases, legal documents, deployment configuration, or the standalone historical `.git/REBASE_HEAD` as part of rollback.
- Preserve failed baseline output and record why it failed when it is needed to explain the stop condition; do not represent an incomplete or failed baseline as a source-parity receipt.
- If `main` advances or source refs disagree before export, discard the stale Phase 1 measurements and restart source selection from the latest clean, fully verified `main` rather than reverting or modifying the old source.

## Phase 2 Pre-Publication Rollback

- If the local fresh-root destination fails export, audit, installation, parity, or security checks before publication, stop new-repository work and keep the failed local destination intact for diagnosis.
- Remove that local destination only after separate approval identifies its exact path and confirms ownership. Never delete, move, or reuse an ownership-unknown directory.
- Do not copy old Git metadata into the replacement destination and do not use a history-bearing clone as a shortcut.
- Correct only the bounded destination/export cause after the source lock and reference inventory explain the difference; otherwise return to Phase 1 evidence gathering.
- The MassageLab repository, its Git history, source SHA `fa78ca01a42179329cc223df77c76f308e76320b`, and current production service remain untouched throughout this rollback.

## Phase 2 Post-Publication Rollback

- On a failed published bootstrap, stop new-repository work and preserve the public `dsbowersock/atmoshaper` repository, fresh-root commits, CI results, and parity evidence for diagnosis.
- Leave the existing MassageLab production service serving. Do not redirect traffic, alter production domains, or make the new repository a production source merely because it exists publicly.
- Do not delete, archive, privatize, rename, force-push, or rewrite the public repository without separate explicit authorization that names the target, expected effect, evidence-preservation approach, and readback.
- Keep `dsbowersock/massagelab` available as the history, evidence, and rollback source. A new repository failure never authorizes alteration of old repository history.

## Later Deployment and Domain Rollback Prerequisites

No later deployment or domain rollback is executed by this task. Before any separately authorized provider, deployment, or cutover action, the owning plan must establish all of the following:

- a verified prior production deployment and host/DNS configuration to which traffic can be restored;
- parallel non-production environments and readback evidence for Vercel, Neon, OAuth, email, Stripe, R2, Sentry, and other affected providers before traffic moves;
- explicit host-aware behavior for `www.atmoshaper.com`, `atmoshaper.com`, `atmosha.com`, `massagelab.app`, and `www.massagelab.app`, including the preconditions for any redirect;
- provider-specific rollback instructions that preserve durable identifiers, Stripe reconciliation, authentication/security cookies, browser storage, PWA behavior, and compatibility formats;
- a rehearsed reversal that restores the prior verified deployment and host configuration without destructive database rollback, deletion of historical evidence, or unreviewed provider writes; and
- separate authorization for each production, DNS, OAuth, email, payment, media, database, legal, or provider mutation.

## Old-Origin Local-Data Recovery Is Non-Removable

Old-origin local-data recovery is a cutover dependency, not optional cleanup. Before any broad redirect of `massagelab.app` or `www.massagelab.app`, the old origin must continue to provide a host-aware recovery/export path that explains the transition, permits valid legacy local-data recovery/export, supports safe sign-in as applicable, explains PWA replacement/reinstallation, and links users to matching AtmoShaper routes.

No phase may automatically move PHI, professional records, or encrypted-vault content between origins. Valid legacy imports, encrypted user-controlled export/import, browser storage compatibility, service-worker transition behavior, and installed-old-PWA recovery must be verified before any old-origin behavior is retired. Destruction of old-origin browser data, encrypted-vault readability, or historical migration evidence is prohibited as rollback preparation.
