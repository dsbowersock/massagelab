# MassageLab Agent Instructions

Read these files first, in order:

1. `docs/project-state.md` for the current source of truth.
2. `docs/project-log.md` for chronological progress, decisions, and change history.
3. `docs/wiki/index.md` for stable operational documentation.

## Operating Rules

- Treat `docs/project-state.md` as the canonical current-state file.
- Treat `docs/project-log.md` as the canonical chronological history.
- Treat `docs/roadmap.md`, `TODO.md`, audits, and wiki pages as source evidence unless their status is mirrored into the current state or project log.
- Keep clinical notes, intake forms, journals, ROM sessions, and other PHI-bearing workflows local-first unless hosted clinical storage passes the documented compliance gates.
- Do not document secrets, database rows, credentials, connection strings, or `.env.local` values.
- Use feature-key entitlement checks such as `chimer_custom_colors`; do not branch product behavior on displayed plan names.
- Prefer targeted, branch-sized changes over broad cleanup.
- Add detailed implementation plans under `docs/superpowers/plans/` when a task spans multiple subsystems or needs future agent handoff.
