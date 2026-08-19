# Stage 4 QA and release checklist

Stage 4 is the reliability and production-readiness wrap-up for wacrm.

## Automated checks

- [x] `npm run typecheck`
- [x] `npm run lint`
- [x] `npm run build`
- [x] `npx prisma validate`
- [x] Protected dashboard routes redirect unauthenticated users to `/login?next=...`.
- [x] API endpoints return `401` when the Bearer API key is missing.
- [x] Dev preview starts on `0.0.0.0:3000`.

## Database-backed smoke tests

Run these with a real MariaDB database configured in `.env`:

- [ ] Sign up with valid data and confirm the owner account is created.
- [ ] Invalid login shows an inline error and never leaves the loading state.
- [ ] Logout invalidates the session and returns to `/login`.
- [ ] Contacts: create, edit, delete, tag, custom field, CSV import.
- [ ] Inbox: inbound message, text send, media send, assignment, notes.
- [ ] Confirm free-form WhatsApp sends are blocked outside the 24-hour customer window.
- [ ] Broadcast: approved template, mapped variables, partial failure, all-recipient failure.
- [ ] Automation: trigger, condition branch, wait/cron resume, failure log.
- [ ] Team: invite, accept, role change, revoke, member removal.
- [ ] API: `/api/v1/me`, scope failures, contact write, message send, template variables.

## Production configuration

- [ ] Set a strong `AUTH_SECRET`.
- [ ] Set a real `DATABASE_URL`.
- [ ] Set a unique 64-character hex `ENCRYPTION_KEY`.
- [ ] Set a publicly reachable HTTPS `NEXT_PUBLIC_SITE_URL`.
- [ ] Store each company's own Meta Developer App Secret in Settings → WhatsApp (per-account, encrypted) so the shared webhook verifies signatures per company. (`META_APP_SECRET` is now only an optional legacy fallback.)
- [ ] Set `AUTOMATION_CRON_SECRET` so the scheduler is not public.
- [ ] Install ffmpeg and set `FFMPEG_PATH` if it is not on `PATH`.
- [ ] Configure Nginx `client_max_body_size 20M` or higher as appropriate.
- [ ] Configure an external scheduler for `/api/automations/cron`.
- [ ] Configure the Meta webhook `messages` subscription field.

## Known non-blocking build note

Next.js/Turbopack reports a tracing warning for the dynamic ffmpeg filesystem path. The production build still completes successfully.
