# wacrm

A multi-tenant WhatsApp CRM for shared inboxes, contacts, broadcasts, templates, automations, pipelines, teams, and the public API.

## Stack

- Next.js App Router with Server Components and Server Actions
- MySQL/MariaDB with Prisma
- Auth.js v5 Credentials authentication
- Tailwind CSS and shadcn/ui foundations
- Local media storage and WhatsApp Cloud API integration

## Local setup

```bash
cp .env.example .env
npm install
npx prisma migrate dev
npm run dev
```

Before starting the app, update `.env` with a real `DATABASE_URL`, `AUTH_SECRET`, and `ENCRYPTION_KEY`. The generated Prisma client is created automatically during install, build, and typecheck.

API documentation is available in [`docs/API.md`](docs/API.md), including authentication, scopes, contacts, messages, broadcasts, and WhatsApp policy details.

Useful commands:

```bash
npm run dev
npm run typecheck
npm run lint
npm run build
npx prisma validate
npx prisma studio
npm run db:seed   # create the Platform Admin (uses PLATFORM_ADMIN_EMAIL/PASSWORD)
```

## Platform Admin

A SaaS-wide admin console lives at `/platform-admin` (role `SUPER_ADMIN`). It
manages every account: search/filter, view, set manual message quotas, activate
or suspend, and delete, plus platform analytics. Every new account starts on the
**Free plan with a lifetime quota of 10 WhatsApp messages**; once exhausted,
messaging is blocked until the Platform Admin assigns a custom quota (e.g.
3,000 / 50,000 / 300,000 / 3,000,000) based on what the customer purchased.
Create the admin with `npm run db:seed` after setting `PLATFORM_ADMIN_EMAIL` and
`PLATFORM_ADMIN_PASSWORD` in `.env`.

## Environment notes

- `NEXT_PUBLIC_SITE_URL` must be a publicly reachable HTTPS URL in production because WhatsApp fetches outbound media from it.
- `UPLOAD_DIR` should point outside the repository on a VPS.
- `FFMPEG_PATH` is optional when `ffmpeg` is already available on `PATH`.
- Set `AUTOMATION_CRON_SECRET` in production to protect the automation scheduler endpoint.
- Set `WHATSAPP_TEMPLATES_DRY_RUN=true` only for local template UI testing.
