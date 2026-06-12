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
- For every branch, add useful docstrings/JSDoc or focused comments when writing new or changed non-obvious code, especially shared helpers, domain rules, server actions, data adapters, and scripts. Treat this as current branch work, not something to defer entirely to the later repo-wide docstring cleanup. Keep documentation focused on intent, inputs, outputs, and constraints; avoid noisy comments that restate self-explanatory code.

## Local Shell Reliability

- On Windows, sandboxed shell launches can intermittently fail before the command starts with `CreateProcessAsUserW failed: 1312`. Treat this as Codex/Windows process-launch noise, not as a MassageLab, Node, npm, Prisma, or Git failure.
- If a read-only or validation command hits that sandbox-token failure, rerun the same command through the approved outside-sandbox path instead of repeatedly retrying in the sandbox or reporting it as an app failure.
- Prefer repo npm scripts such as `npm run lint`, `npm run test`, `npm run typecheck`, `npm run build`, `npm run prisma:generate`, and `npm run prisma:validate` over ad hoc Node invocations. If a recurring generator/check command needs Node directly, add a named npm script for it and use that script.
- Keep user-facing updates terse: mention the command was rerun because the Windows sandbox failed before execution only when that context matters. Do not repeat long sandbox-token status messages for routine validation retries.
