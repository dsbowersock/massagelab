# Local Development

## Requirements

- Node.js `24.x`
- npm
- Neon Postgres when account, Prisma, calendar, anatomy publishing, or billing persistence flows are exercised

## Setup

```bash
npm install
cp .env.example .env.local
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Open `http://localhost:3000`.

Anonymous use should work for Chimer, Anatomime, SOAP notes, intake forms, client journals, and ROM tools.

## Useful Commands

```bash
npm run prisma:validate
npm run lint
npm run typecheck
npm run test
npm run build
```

Seed anatomy content from the local fallback data:

```bash
npm run anatomy:seed
```

Grant admin access to emails listed in `ADMIN_EMAILS`:

```bash
npm run admin:grant
```

Grant admin access to specific emails:

```bash
npm run admin:grant -- you@example.com
```
