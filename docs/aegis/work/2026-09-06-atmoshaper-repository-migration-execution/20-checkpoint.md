# AtmoShaper Repository Migration Execution Checkpoint

## Superseded checkpoint

This file originally captured a temporary Task 3 Browser-QA database blocker. That blocker was cleared under explicit authorization by creating, using, and deleting an empty Neon QA project. The old prepared-state instructions are historical and must not be used to resume execution.

## Completed state

- Tasks 1 and 2 locked the source and migration boundaries at `67545dae` and `421a4f5e`.
- Task 3 migration parity is committed at `ecd28af0`; the reviewed source-QA hardening and overlay contract is committed at `a8fe56fd`.
- The owned fresh-build parity run passed 22/22 cases and retained all 24 canonical desktop/mobile screenshots unchanged.
- Task 4 completed the MassageLab source-baseline gate and published PR #206. The exact evidence, including the deleted temporary-QA lifecycle and zero residual fixture rows, is recorded in `90-evidence.md`, `docs/project-state.md`, and the AtmoShaper reference inventory.

## Current resume boundary

Resume by checking PR #206's exact head, hosted checks, open review threads, and latest eligible CodeRabbit review. Any correction head must pass the hosted gates and receive a fresh eligible review. Merge, destination-repository creation, deployment, production or destination provider/DNS work, and production database mutation remain unauthorized.
