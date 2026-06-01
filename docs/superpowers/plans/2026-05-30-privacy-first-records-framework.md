# Privacy-First Records Framework

## Goal

Move therapist documentation from route-specific plaintext browser drafts into one encrypted local `ProfessionalRecordVault`.

## Implementation Scope

- Add a shared professional-record vault helper with AES-GCM encryption, PBKDF2-SHA-256 key derivation, encrypted full-vault `.mlab` bundles, and one-time legacy draft migration.
- Store the encrypted browser vault under `massagelab-professional-record-vault-v1`.
- Keep legacy plaintext keys only as migration inputs: `massagelab-soap-draft`, `massagelab-intake-workspace-v1`, `massagelab-client-journal-draft`, and `massagelab-rom-session-draft`.
- Add a persistent `/notes` vault provider so the passphrase and decrypted payload stay in React memory for the current app session only.
- Route SOAP, intake, journal, and ROM save/load through the shared vault; remove plaintext JSON/TXT/research exports and plaintext JSON imports from these route UIs.
- Keep DOC/PDF generation available only behind an explicit plaintext-output warning.

## Verification

- Unit coverage validates vault creation, unlock, wrong-passphrase rejection, encrypted bundle import/export, no plaintext sentinel in the envelope, legacy plaintext migration, malformed legacy preservation, and intake workspace normalization through the shared vault.
- Source guards verify therapist documentation pages use the shared vault, do not write old plaintext keys, do not import plaintext JSON, and do not add clinical sync, client API, account preferences, Prisma, or fetch upload paths.
- Run `npm run test`, `npm run lint`, `npm run typecheck`, and `npm run build` before closing the branch.
