# MassageLab

MassageLab is a private-alpha toolkit for massage therapists and students. The first production-quality surface is Chimer, a treatment-room interval timer. Documentation tools are local-first in this alpha: the app does not upload SOAP notes or intake forms.

## Current Alpha

- Chimer: treatment-room timer with local preference persistence, pause/resume, fullscreen mode, current-time display, font sizing, and interval alerts.
- Local-first documentation: SOAP notes and intake forms can be saved as browser-local drafts, imported from MassageLab JSON files, and exported as user-controlled files.
- Anatomime: classroom anatomy game backed by the local bones-and-muscles anatomy content, with Prisma-backed anatomy publishing work in progress.
- Optional accounts: Auth.js and Prisma support preference sync, therapist profile defaults, templates, roles, 2FA, and learning/progress data only.
- Admin anatomy tools: account-gated anatomy content and correction workflows are present for editor/admin use.
- Music tools and managed HIPAA storage are intentionally out of alpha scope until their workflows are reviewed, hardened, and legally/compliance reviewed.

## PHI Posture

SOAP notes, intake forms, and other PHI-bearing workflows are designed to keep data under the user's control.

- SOAP drafts stay in the current browser under `massagelab-soap-draft`.
- Intake drafts stay in the current browser under `massagelab-intake-draft`.
- SOAP exports use `schemaVersion: 1` and `noteType: "soap"`.
- Intake exports use `schemaVersion: 1` and `formType: "intake"`.
- Exported files are the user's responsibility to store, transmit, or back up appropriately.
- Account sync must not include SOAP note or intake form content.

Future managed HIPAA-compliant storage should be treated as a separate paid product. It must include legal and compliance review, BAAs, access controls, audit logging, encryption, incident response, and operational policies before implementation.

## Getting Started

Requirements:

- Node.js `>=20.9.0`
- npm
- Neon Postgres only if account, Prisma, or anatomy publishing flows are being exercised

Install dependencies and start the app:

```bash
npm install
npm run dev
```

Open http://localhost:3000.

Anonymous use should work for Chimer, Anatomime, SOAP notes, and intake forms.

## Accounts, Auth.js, And Prisma

Accounts are optional for alpha use. They enable preference sync, therapist profile defaults, note/form templates, learning progress, roles, and account security features.

1. Create a Neon project and copy its connection strings.
2. Copy `.env.example` to `.env.local`.
3. Set `DATABASE_URL` to Neon's pooled connection string.
4. Set `DIRECT_URL` to Neon's direct connection string, or use `DATABASE_URL_UNPOOLED` if Vercel's Neon integration injected that name.
5. Fill in `AUTH_SECRET`, `AUTH_URL`, `TOTP_ENCRYPTION_KEY`, and `ADMIN_EMAILS`. The app also accepts `NEXTAUTH_SECRET` and `NEXTAUTH_URL`.
6. Add `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` only if Google login should be enabled. The app also accepts `AUTH_GOOGLE_CLIENT_ID` / `AUTH_GOOGLE_CLIENT_SECRET` and `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
7. Add SMTP settings only if email verification and password reset emails should be sent.

For Resend SMTP, verify `massagelab.app` in Resend, create an API key, and use:

```text
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASSWORD=<Resend API key>
SMTP_FROM=MassageLab <no-reply@massagelab.app>
```

For local Google OAuth testing, configure the OAuth client in Google Cloud Console with this authorized redirect URI:

```text
http://localhost:3000/api/auth/callback/google
```

For production Google OAuth, add this authorized redirect URI to the same OAuth client:

```text
https://massagelab.app/api/auth/callback/google
```

Generate Prisma Client and run local migrations:

```bash
npm run prisma:generate
npm run prisma:migrate
```

Seed anatomy content from the local fallback content:

```bash
npm run anatomy:seed
```

Email/password accounts require verification and support password reset through the configured SMTP server. Emails listed in `ADMIN_EMAILS` are granted the `ADMIN` role when they sign in or register. Authenticator-app 2FA is available from `/account/security` after sign-in; backup codes are shown once and stored only as hashes.

If the account already exists and `ADMIN_EMAILS` was added later, grant the role manually:

```bash
npm run admin:grant
```

You can also pass one or more emails without changing `ADMIN_EMAILS`:

```bash
npm run admin:grant -- you@example.com
```

## Verification

Run the automated gate before tagging or deploying an alpha build:

```bash
npm run prisma:validate
npm run lint
npm run typecheck
npm run test
npm run build
```

Then run the manual browser checklist in `docs/alpha-qa.md`. It covers Chimer, local-first documentation, anonymous access, privacy/network expectations, mobile and desktop layout, and release hygiene.

## Deployment

For Vercel and Neon deployment, set the same auth, SMTP, TOTP, admin, and database environment variables in Vercel.

- `DATABASE_URL` should be the pooled Neon URL for runtime Prisma Client connections.
- `DIRECT_URL` should be the direct Neon URL for migrations.
- `DATABASE_URL_UNPOOLED` can be used as the direct-url fallback when the Vercel Neon integration provides it.
- `AUTH_URL` should be `https://massagelab.app`. `NEXTAUTH_URL` is also accepted.
- `AUTH_SECRET`, `AUTH_GOOGLE_ID`, and `AUTH_GOOGLE_SECRET` must be set before deploying Google login. `NEXTAUTH_SECRET` is also accepted.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM` must be set before email verification and password reset emails can be delivered in production.

Run production migrations as a deploy step before serving new code:

```bash
npm run prisma:migrate:deploy
```

Do not run migrations from `next build`.

## Near-Term Direction

1. Keep Chimer as the production-quality alpha surface and continue manual browser checks across desktop and mobile.
2. Keep SOAP and intake local-first while validating import/export with anonymous sample files.
3. Expand the shared anatomy dataset for Anatomime, flashcards, SOAP assistance, and study tools.
4. Wire tools to read published anatomy content from Prisma with the local content module as fallback.
5. Add direct cloud-provider export only after the local file model is stable.
6. Design managed HIPAA storage as a separate subscription product.
