# CLAUDE.md

Reference for working in this codebase. Read this before making changes — it captures architecture decisions, a full schema reference, and a list of real bugs already debugged once, so they don't get reintroduced.

## Project Overview

**wacrm** is a multi-tenant WhatsApp CRM: shared inbox, contacts, broadcasts, message templates, visual automation builder, sales pipelines, team management, and a public REST API. It's a from-scratch MySQL/Prisma/Auth.js rebuild of a Supabase-based reference template — the original's Postgres-specific mechanisms (Row Level Security, SECURITY DEFINER triggers, partial unique indexes) do not exist in this stack and have been reimplemented at the application layer.

**Deployment target: a self-managed VPS, not Vercel.** This matters for storage (local disk, not Blob), transcoding (system/npm ffmpeg binary, not a serverless-safe library), and env var handling (no platform-injected secrets — everything comes from `.env`).

## Tech Stack

- **Framework:** Next.js (App Router, Server Actions, Server Components). Assume Next.js 15+ — `params` and `searchParams` are `Promise`s in both Server *and* Client Components; see Gotchas.
- **DB:** MySQL + Prisma.
- **Auth:** Auth.js (NextAuth) v5, **Credentials provider only** — no OAuth, no adapter (adapters don't support database sessions with Credentials; sessions are JWT-based). Session carries `user.id`, `user.accountId`, `user.accountRole`. The JWT callback **always re-reads `accountId`, `accountRole`, `name`, and `email` from the DB on every request** (`lib/auth.ts`), so accepting an invitation (which moves a user to another account) and admin role changes take effect without forcing a re-login. Do not "optimize" this into a sign-in-only refresh — doing so reintroduces stale-workspace-data and stale-role bugs after invitation acceptance.
- **Excel/CSV import uses `xlsx`:** `lib/client-excel.ts` parses `.xlsx`/`.xls`/`.csv` in the browser (`XLSX.read` on an ArrayBuffer) into `{phone,name,email,company}` rows, which are then sent to `importContactsFromCsv` (server action) that owns validation + dedupe. Do not reintroduce the old hand-rolled CSV parser for imports.
- **Contact categories are the primary view:** the `/contacts` landing page (`getCategoryOverview`) returns each category with `count` and `duplicateCount` (duplicates = contacts sharing an email that also exists elsewhere in the account; phone is globally unique per account). The category detail page (`/contacts/category/[id]`) uses `getCategoryContacts` for server-side pagination/sorting/search and `@tanstack/react-table` (v8) for the table. `deleteCategoryContacts` wipes all contacts in a category.
- **Platform Admin (SUPER_ADMIN):** a dedicated SaaS-wide super admin with its own account row + role `SUPER_ADMIN`, created via `npm run db:seed` (env `PLATFORM_ADMIN_EMAIL`/`_PASSWORD`/`_NAME`). It signs in at the **separate `/admin/login`** page (redirects to `/platform-admin` on success, and verifies the role is `SUPER_ADMIN`, signing back out otherwise). Its UI lives under `/platform-admin` (protected in `proxy.ts` and in `app/(platform)/platform-admin/layout.tsx`) using the **shadcn `SidebarProvider`/`Sidebar`/`SidebarInset`** (`PlatformSidebar`, collapsible to icon); all platform actions in `app/(platform)/platform-admin/actions.ts` bypass account scoping and operate across every account. It can list/search/filter accounts (TanStack Table + CSV/XLSX export via `xlsx`), activate/suspend, delete, edit its own profile + password (`/platform-admin/profile`), view analytics, and manage the **quota purchase ledger** (`QuotaPurchase`): when the admin adjusts an account's quota via `updateAccountQuota(input)`, it records amount paid (INR), validity (months; 0 = lifetime), quota before/after, and sets `Account.quotaValidUntil`. The account detail page shows that account's ledger table + `totalPaid`/`purchaseCount` stats, and a **dedicated global Ledger module** at `/platform-admin/ledger` (`listAllPurchases`) shows every purchase across all accounts with search, sorting, and Excel export. **Platform accounts are excluded from all stats** via `getPlatformAccountIds()`. The root `/` just redirects to `/login` (or `/inbox`). **SUPER_ADMIN is included in `ADMIN_ROLES` and `WRITE_ROLES`** (`lib/permissions.ts`) so the super admin gets full read/write (not viewer-only) access when using the WhatsApp workspace.
- **Message quota system (`lib/quota.ts`):** every new account starts on `planType=FREE` with a **lifetime `messageQuota=10`**; `consumeMessages()` reserves messages (and writes a `MessageUsageLog` row) before every outbound message across Inbox, Broadcasts, API (`/api/v1/messages`, `/api/v1/broadcasts` → 402), and Automations. Suspended or exhausted accounts are blocked. The platform admin raises `messageQuota`/`planType=CUSTOM` manually and logs each adjustment as a **`QuotaPurchase`** ledger entry (amount paid + validity). This is the seam a future subscription/billing system can replace — keep `consumeMessages`'s signature, swap its implementation. Do not bypass `consumeMessages` in any new message-sending feature.
- **Roles: OWNER > ADMIN > AGENT > VIEWER.** `lib/permissions.ts` centralizes checks: `isAdminRole` (OWNER/ADMIN), `canWriteWorkspace` (OWNER/ADMIN/AGENT), `roleLabel`. **Two-layer enforcement:** every mutating Server Action uses `requireWriteSession()` (blocks VIEWER) and admin-only settings use `requireAdmin()`; the frontend reads role from `components/role-context.tsx` (`useRole()` → `{ role, isAdmin, canWrite, canView }`, provided by `DashboardShell`) to hide interactive UI for viewers (inbox composer/emoji/attachments/mic/send, assignment, contact edit/notes, contacts add/edit/delete/import, broadcast create/delete, automation create/toggle/delete, pipeline add/drag/delete, builder pages redirect via `assertCanWrite`). **Keep both layers in sync** — never rely on hidden UI alone.
- **Conversation assignment visibility:** non-admins (AGENT/VIEWER) can only see conversations `assignedAgentId == null OR == their own id` (via `conversationScope()` in `inbox/actions.ts`); Owners/Admins see all. Non-admins can only assign a conversation to themselves (`assignConversation` rejects reassigning others). The public `/api/v1/*` is account-scoped by API key and intentionally not per-user-assignment filtered.
- **Invitation-aware signup:** when a new user signs up from an invitation link (`/signup?next=/join/<token>`), the signup action creates their `User` **directly inside the invited account** with the invite's role and marks the invitation accepted — it does **not** create a throwaway personal workspace. The "Team name" field is hidden in this mode and the user lands in `/inbox`. Existing users who already have an account should sign in and accept from the join page (that path migrates an empty personal account into the invited one).
- **Styling:** Tailwind utility classes for layout/spacing; brand colors via CSS custom properties (see Design Tokens) rather than Tailwind theme colors, since the palette needed to stay editable without a Tailwind config round-trip.
- **Fonts:** `next/font/google` — Space Grotesk (display/headings), Inter (body/UI), IBM Plex Mono (technical values: phone numbers, IDs, tokens, template variables).
- **Icons:** `lucide-react`.
- **Notable feature libraries:** `emoji-picker-react` (composer emoji picker), `leaflet` + OpenStreetMap tiles (location picker/display — no Google Maps API key required), `ffmpeg-static` (npm-installable ffmpeg binary, used via `child_process.spawn`, not a wrapper library).

## Critical Invariants — do not violate these

1. **Every query must filter by `accountId` manually.** MySQL has no Row Level Security. There is no DB-enforced tenant isolation anywhere — it is 100% the responsibility of every Server Action and API route to scope every `findMany`/`findFirst`/`update`/`delete` by the caller's `accountId`. A query missing this filter is a cross-tenant data leak, not a cosmetic bug.
2. **Never trust a route param or query param to be defined before using it in a Prisma `where` clause.** Prisma silently *drops* an `undefined` field from a `where` filter instead of matching nothing — `findFirst({ where: { id: undefined, accountId } })` returns some *other* row in the account, not null. Always explicit-guard (`if (!id) throw ...`) before any Prisma call that takes a dynamic id.
3. **`params` (and `searchParams`) are `Promise`s**, in Server Components (`await params`) and Client Components (`use(params)` from React, not `await`). This bit us repeatedly — see Gotchas §1.
4. **Prisma `Json` fields type as `JsonValue`/`unknown` on read, never assume the shape.** Use a type guard (`function isX(v: unknown): v is X`) before reading a `Json` column's contents (e.g. `Message.metadata`, `Automation.triggerConfig`). Don't type the field as the narrow shape directly or as `any` — TypeScript will happily let bad data through either way; a guard is the only version that's both safe and doesn't disable checking.
5. **WhatsApp's 24-hour customer service window is a real, non-negotiable Meta policy**, not an app bug: free-form text/media can only be sent to a contact who has messaged *you* within the last 24 hours. Outside that window, only an approved template message works. Any "why didn't my message send" bug report should check this before anything else.
6. **Per-company Meta Developer App secrets (the current architecture).** Each company owns its own Meta Developer App, so its App Secret is stored **encrypted per-account** in `WhatsAppConfig.metaAppSecretEncrypted` (Settings → WhatsApp → "Meta App secret"). The single shared webhook endpoint (`app/api/webhooks/whatsapp/route.ts`) verifies `x-hub-signature-256` by trying each company's stored secret via `resolveVerifiedConfig()`, identifies the sending account by signature, and scopes processing to it. The old global `META_APP_SECRET` env var is now only an optional **legacy fallback** (and `globalSecretVerifies` covers it); it should not be relied on for new tenants. The webhook GET verify-token handshake remains per-company via `verifyToken` lookup.

## Architecture Decisions (with reasoning, so they aren't second-guessed later)

- **Local disk storage, not Vercel Blob / S3.** `lib/local-storage.ts` writes to `UPLOAD_DIR` (outside the repo directory in production — see Gotchas §5) and serves back through `app/api/media/[filename]/route.ts`, which must stay unauthenticated since Meta's servers fetch outbound media links directly and can't send session cookies.
- **`ffmpeg-static` over a system `apt install ffmpeg`.** Chosen specifically so `npm install` alone makes transcoding work without root/system-package access — relevant if this ever moves hosts or gets containerized. `lib/ffmpeg.ts` resolves the binary via (1) `FFMPEG_PATH` env override, (2) bare `"ffmpeg"` on `PATH`. No fallback probing of `ffmpeg-static`'s resolved path — that package was fully removed after repeated Windows-local ENOENT issues (its postinstall binary download is unreliable behind corporate proxies/antivirus); production relies on `apt install ffmpeg` on the VPS.
- **Circular FK bootstrap for signup.** `Account.ownerUserId` and `User.accountId` reference each other, but neither can be created first with a satisfied FK. Fixed by pre-generating the `User`'s id (`randomUUID()`) in app code, creating `Account` with that id as a plain non-relational field, then creating `User` with that same id inside one `$transaction`.
- **`User` model absorbs what the original template called "profiles."** There is no separate `Profile` table — auth fields and CRM-agent fields live on one `User` row.
- **AES-256-GCM encryption for the WhatsApp access token**, via `lib/encryption.ts`, keyed by `ENCRYPTION_KEY` (64 hex chars = 32 bytes). Stored format: `iv:authTag:ciphertext`, all hex, in one `TEXT` column. Rotating `ENCRYPTION_KEY` makes every previously-saved token permanently undecryptable.
- **Broadcast recipient status counters are updated incrementally**, not via `COUNT(*)` recomputation, mirroring the original template's Postgres trigger design: a status transition (e.g. `SENT → DELIVERED`) decrements the old rung's contribution and increments the new one across a fixed "ladder" (`PENDING → SENT → DELIVERED → READ → REPLIED`, with `FAILED` as a side branch). See `bumpRecipientStatus` in `app/(dashboard)/broadcasts/actions.ts`.
- **No shared dashboard shell/sidebar was built by this work.** A persistent sidebar + settings sub-nav was proposed once and explicitly rejected — the project already has its own root layout/nav from the original template; everything built here is page-level content and Server Actions under existing routes, not a new app shell.
- **Automations use a flat-with-parent-pointer step model, not a tree serialized as JSON.** `AutomationStep.parentStepId` + `AutomationStep.branch` (`YES`/`NO`) let a `CONDITION` step have children without a recursive JSON blob — `saveAutomation`'s `flattenSteps`/`createLevel` and `getAutomationForEdit`'s `buildLevel` are the flatten/unflatten pair. The **engine supports arbitrary nesting depth**; the **builder UI deliberately caps at one level** (a Condition's branches can't contain another Condition) as a shippability guardrail, not an engine limitation.
- **`Wait` automation steps do not self-schedule.** A `Wait` step persists an `AutomationPendingExecution` row with a `runAt` timestamp and returns — nothing resumes it automatically. `GET /api/automations/cron` drains due rows, but **only when something pings it**. Production requires an external scheduler (cron-job.org, a `vercel.json`-style cron equivalent, or a plain crontab entry) hitting that route on an interval. Any "automation just stops partway through" report should check this first if the automation has a `Wait` step.

## Directory Map

```
app/
  (auth)/
    login/                     — login form (reads ?next= for post-login redirect)
    signup/                    — signup form (creates Account + User together)
    join/[token]/              — accepts an AccountInvitation
    layout.tsx                 — chat-bubble brand panel (split-screen auth layout)
    auth-field.tsx              — shared input component for login/signup
  (dashboard)/
    inbox/
      actions.ts               — conversations, messages, media upload, assign, location, contacts-as-message
      [conversationId]/
        thread.tsx              — composer + message list (text/media/emoji/voice/camera/sticker/contact/location)
        contact-panel.tsx        — "View profile" side panel: contact summary + notes
        attachment-menu.tsx      — the "+" attachment dropdown
        camera-capture-modal.tsx — getUserMedia photo/video capture
        location-picker-modal.tsx— Leaflet map picker + reverse geocode
        contact-picker-modal.tsx — pick an existing Contact to share as a WhatsApp contact card
    contacts/                  — CRUD, tags, custom fields, CSV import, contact-form-modal (shared add/edit)
    broadcasts/
      actions.ts                — audience resolution, template variable mapping, incremental status ladder
      new/page.tsx               — 4-step wizard (Template → Audience → Personalize → Send)
    automations/
      actions.ts                 — saveAutomation/getAutomationForEdit (flatten/unflatten), test-run
      builder.tsx                 — node-based visual builder (trigger card + step cards + connectors)
      [id]/edit/, [id]/logs/, new/
    pipelines/                  — kanban board, drag-and-drop stage transitions, metrics cards
    settings/
      whatsapp/                  — connect/verify WhatsApp (Meta Graph API calls happen here)
      templates/                 — create/edit/sync message templates with Meta
      fields-tags/                — Tag and CustomField CRUD
      team/                       — member roles, invitations
      api-keys/                   — public API key management (scopes, revoke)
  api/
    webhooks/whatsapp/route.ts  — GET (verify) + POST (inbound messages/media/contacts/location/stickers, status updates)
    media/[filename]/route.ts   — serves locally-stored uploads; MUST stay public/unauthenticated
    automations/cron/route.ts   — drains due AutomationPendingExecution rows; needs an external pinger
    v1/                         — public REST API: me, messages, contacts, conversations, broadcasts
lib/
  auth.ts                       — NextAuth config (Credentials provider, JWT session callbacks)
  prisma.ts                     — Prisma client singleton
  encryption.ts                 — AES-256-GCM encrypt/decrypt for WhatsApp access tokens
  local-storage.ts              — writes uploads to UPLOAD_DIR, returns public /api/media/ URL
  media-utils.ts                — MIME→ContentType mapping, per-type size caps
  client-media.ts                — browser-only: sticker image→WebP conversion
  ffmpeg.ts                      — WebM→MP4 (video) / WebM→OGG (audio) transcoding
  format.ts                      — relative time, message time, initials
  currency.ts                     — Account.defaultCurrency-aware formatting
  api-keys.ts / api-auth.ts       — API key generation/hashing, Bearer auth + scope enforcement for /api/v1
  automations/engine.ts           — trigger matching, step execution, Condition branching, Wait persistence
  whatsapp/
    client.ts                     — all outbound Meta Graph API calls (text/media/template/contact/location/templates)
    media.ts                       — downloads Meta's short-lived inbound media URL, re-hosts locally
    templates.ts                    — Meta template component builder, {{n}} variable extraction/substitution
types/next-auth.d.ts             — Session.user gains id/accountId/accountRole
```

## Full Prisma Schema (authoritative — reconcile any drift against this)

```prisma
enum AccountRole { OWNER ADMIN AGENT VIEWER }
enum ConversationStatus { OPEN PENDING CLOSED }
enum SenderType { CUSTOMER AGENT BOT }
enum ContentType { TEXT IMAGE DOCUMENT AUDIO VIDEO LOCATION TEMPLATE INTERACTIVE STICKER CONTACT }
enum MessageStatus { SENDING SENT DELIVERED READ FAILED }
enum BroadcastStatus { DRAFT SCHEDULED SENDING SENT FAILED }
enum RecipientStatus { PENDING SENT DELIVERED READ REPLIED FAILED }
enum WhatsAppStatus { CONNECTED DISCONNECTED }
enum TemplateCategory { MARKETING UTILITY AUTHENTICATION }
enum TemplateStatus { DRAFT PENDING APPROVED REJECTED PAUSED DISABLED IN_APPEAL PENDING_DELETION }
enum TemplateHeaderType { TEXT IMAGE VIDEO DOCUMENT }
enum AutomationTrigger { NEW_MESSAGE_RECEIVED FIRST_MESSAGE_FROM_CONTACT KEYWORD_MATCH NEW_CONTACT_CREATED CONVERSATION_ASSIGNED TAG_ADDED }
enum AutomationStepType { SEND_MESSAGE ADD_TAG REMOVE_TAG UPDATE_CONTACT_FIELD ASSIGN_CONVERSATION WAIT CONDITION SEND_WEBHOOK CLOSE_CONVERSATION }
enum AutomationBranch { YES NO }
enum PendingExecutionStatus { PENDING RUNNING DONE FAILED }
enum AutomationLogStatus { SUCCESS FAILED }
enum DealStatus { OPEN WON LOST }

model User {
  id          String      @id @default(cuid())
  name        String?
  email       String      @unique
  password    String
  avatarUrl   String?
  accountId   String
  accountRole AccountRole @default(AGENT)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  account               Account              @relation("AccountMembers", fields: [accountId], references: [id], onDelete: Cascade)
  assignedConversations Conversation[]       @relation("AssignedAgent")
  createdContacts       Contact[]            @relation("ContactCreator")
  createdBroadcasts     Broadcast[]          @relation("BroadcastCreator")
  createdInvitations    AccountInvitation[]  @relation("InvitationCreator")
  acceptedInvitations   AccountInvitation[]  @relation("InvitationAccepter")
  notes                 ContactNote[]

  @@index([accountId])
  @@map("users")
}

model Account {
  id              String   @id @default(cuid())
  name            String
  ownerUserId     String   @unique   // plain field, NOT a relation — see circular-FK note
  defaultCurrency String   @default("USD")
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  members          User[]              @relation("AccountMembers")
  invitations      AccountInvitation[]
  contacts         Contact[]
  conversations    Conversation[]
  broadcasts       Broadcast[]
  tags             Tag[]
  customFields     CustomField[]
  messageTemplates MessageTemplate[]
  automations      Automation[]
  pipelines        Pipeline[]
  deals            Deal[]
  apiKeys          ApiKey[]

  @@map("accounts")
}

model AccountInvitation {
  id               String      @id @default(cuid())
  accountId        String
  tokenHash        String      @unique
  role             AccountRole // app layer rejects OWNER
  createdByUserId  String?
  label            String?
  createdAt        DateTime    @default(now())
  expiresAt        DateTime
  acceptedAt       DateTime?
  acceptedByUserId String?

  account    Account @relation(fields: [accountId], references: [id], onDelete: Cascade)
  createdBy  User?   @relation("InvitationCreator", fields: [createdByUserId], references: [id], onDelete: SetNull)
  acceptedBy User?   @relation("InvitationAccepter", fields: [acceptedByUserId], references: [id], onDelete: SetNull)

  @@index([accountId, expiresAt])
  @@map("account_invitations")
}

model Contact {
  id              String   @id @default(cuid())
  accountId       String
  createdByUserId String?
  name            String?
  phone           String
  phoneNormalized String   // digits-only, computed in app code on write
  email           String?
  company         String?
  category        String   @default("LEAD")   // stores the category NAME; valid categories live in the `contact_categories` table (user-managed, seeded with LEAD/PROSPECT/CUSTOMER/VIP/OTHER)
  avatarUrl       String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  account             Account              @relation(fields: [accountId], references: [id], onDelete: Cascade)
  createdBy           User?                @relation("ContactCreator", fields: [createdByUserId], references: [id], onDelete: SetNull)
  conversations       Conversation[]
  broadcastRecipients BroadcastRecipient[]
  tags                ContactTag[]
  customValues        ContactCustomValue[]
  notes               ContactNote[]
  deals                Deal[]

  @@unique([accountId, phoneNormalized])
  @@index([accountId])
  @@map("contacts")
}

model ContactNote {
  id        String   @id @default(cuid())
  contactId String
  authorId  String
  body      String   @db.Text
  createdAt DateTime @default(now())

  contact Contact @relation(fields: [contactId], references: [id], onDelete: Cascade)
  author  User    @relation(fields: [authorId], references: [id])

  @@index([contactId])
  @@map("contact_notes")
}

model Tag {
  id        String   @id @default(cuid())
  accountId String
  name      String
  color     String   @default("#1F6F5C")
  createdAt DateTime @default(now())

  account  Account      @relation(fields: [accountId], references: [id], onDelete: Cascade)
  contacts ContactTag[]

  @@unique([accountId, name])
  @@map("tags")
}

model ContactTag {
  id        String @id @default(cuid())
  contactId String
  tagId     String

  contact Contact @relation(fields: [contactId], references: [id], onDelete: Cascade)
  tag     Tag     @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@unique([contactId, tagId])
  @@map("contact_tags")
}

model CustomField {
  id        String   @id @default(cuid())
  accountId String
  fieldName String
  fieldType String   @default("text") // text | number | date
  createdAt DateTime @default(now())

  account Account              @relation(fields: [accountId], references: [id], onDelete: Cascade)
  values  ContactCustomValue[]

  @@unique([accountId, fieldName])
  @@map("custom_fields")
}

model ContactCustomValue {
  id            String  @id @default(cuid())
  contactId     String
  customFieldId String
  value         String?

  contact     Contact     @relation(fields: [contactId], references: [id], onDelete: Cascade)
  customField CustomField @relation(fields: [customFieldId], references: [id], onDelete: Cascade)

  @@unique([contactId, customFieldId])
  @@map("contact_custom_values")
}

model Conversation {
  id              String             @id @default(cuid())
  accountId       String
  contactId       String
  assignedAgentId String?
  status          ConversationStatus @default(OPEN)
  lastMessageText String?            @db.Text
  lastMessageAt   DateTime?
  unreadCount     Int                @default(0)
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt

  account       Account   @relation(fields: [accountId], references: [id], onDelete: Cascade)
  contact       Contact   @relation(fields: [contactId], references: [id], onDelete: Cascade)
  assignedAgent User?     @relation("AssignedAgent", fields: [assignedAgentId], references: [id], onDelete: SetNull)
  messages      Message[]

  @@index([accountId])
  @@index([contactId])
  @@map("conversations")
}

model Message {
  id                 String        @id @default(cuid())
  conversationId     String
  senderType         SenderType
  senderId           String?
  contentType        ContentType   @default(TEXT)
  contentText        String?       @db.Text
  mediaUrl           String?
  templateName       String?
  whatsappMessageId  String?       @unique
  status             MessageStatus @default(SENT)
  errorMessage       String?       @db.Text   // populated from Meta's status webhook on FAILED
  createdAt          DateTime      @default(now())
  replyToMessageId   String?       // schema exists; no reply/quote UI built yet — see Not Yet Built
  interactiveReplyId String?
  metadata           Json?         // CONTACT: {name, phone} · LOCATION: {latitude, longitude, name?, address?}

  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  replyTo      Message?     @relation("MessageReply", fields: [replyToMessageId], references: [id], onDelete: SetNull)
  replies      Message[]    @relation("MessageReply")

  @@index([conversationId])
  @@map("messages")
}

model WhatsAppConfig {
  id                    String         @id @default(cuid())
  accountId             String         @unique
  phoneNumberId         String         @unique
  wabaId                String?
  accessTokenEncrypted  String         @db.Text
  verifyToken           String?
  status                WhatsAppStatus @default(DISCONNECTED)
  connectedAt           DateTime?
  registeredAt          DateTime?
  subscribedAppsAt      DateTime?
  lastRegistrationError String?        @db.Text
  createdAt             DateTime       @default(now())
  updatedAt             DateTime       @updatedAt

  account Account @relation(fields: [accountId], references: [id], onDelete: Cascade)

  @@map("whatsapp_configs")
}
// WhatsAppConfig.metaAppSecretEncrypted holds the per-company Meta Developer
// App Secret (AES-256-GCM encrypted at rest). The shared webhook verifies the
// signature per company via this column. See Critical Invariants §6.

model MessageTemplate {
  id              String              @id @default(cuid())
  accountId       String
  name            String
  category        TemplateCategory    @default(MARKETING)
  language        String              @default("en_US")
  headerType      TemplateHeaderType?
  headerContent   String?
  bodyText        String              @db.Text
  footerText      String?
  buttons         Json?               // schema exists; builder UI for buttons not built — see Not Yet Built
  status          TemplateStatus      @default(DRAFT)
  sampleValues    Json?
  metaTemplateId  String?
  rejectionReason String?
  qualityScore    String?
  submissionError String?
  lastSubmittedAt DateTime?
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt

  account    Account     @relation(fields: [accountId], references: [id], onDelete: Cascade)
  broadcasts Broadcast[]

  @@unique([accountId, name, language])
  @@map("message_templates")
}

model Broadcast {
  id                String          @id @default(cuid())
  accountId         String
  createdByUserId   String?
  messageTemplateId String?
  name              String
  templateName      String          // denormalized snapshot — survives template edits/deletion
  templateLanguage  String
  variableMapping   Json?           // [{variable, source: "static"|"field"|"custom_field", value}]
  audienceFilter    Json?           // the AudienceSpec used to build this broadcast (audit/display)
  scheduledAt       DateTime?
  status            BroadcastStatus @default(DRAFT)
  totalRecipients   Int             @default(0)
  sentCount         Int             @default(0)
  deliveredCount    Int             @default(0)
  readCount         Int             @default(0)
  repliedCount      Int             @default(0)
  failedCount       Int             @default(0)
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt

  account    Account              @relation(fields: [accountId], references: [id], onDelete: Cascade)
  createdBy  User?                @relation("BroadcastCreator", fields: [createdByUserId], references: [id], onDelete: SetNull)
  template   MessageTemplate?     @relation(fields: [messageTemplateId], references: [id], onDelete: SetNull)
  recipients BroadcastRecipient[]

  @@index([accountId])
  @@map("broadcasts")
}

model BroadcastRecipient {
  id                String          @id @default(cuid())
  broadcastId       String
  contactId         String?
  whatsappMessageId String?         @unique
  status            RecipientStatus @default(PENDING)
  sentAt            DateTime?
  deliveredAt       DateTime?
  readAt            DateTime?
  repliedAt         DateTime?
  errorMessage      String?
  createdAt         DateTime        @default(now())

  broadcast Broadcast @relation(fields: [broadcastId], references: [id], onDelete: Cascade)
  contact   Contact?  @relation(fields: [contactId], references: [id], onDelete: SetNull)

  @@index([broadcastId, status])
  @@map("broadcast_recipients")
}

model Automation {
  id             String            @id @default(cuid())
  accountId      String
  name           String
  triggerType    AutomationTrigger
  triggerConfig  Json?             // KEYWORD_MATCH: { keywords: string[] }
  isActive       Boolean           @default(false)
  executionCount Int               @default(0)
  lastExecutedAt DateTime?
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt

  account           Account                      @relation(fields: [accountId], references: [id], onDelete: Cascade)
  steps             AutomationStep[]
  logs              AutomationLog[]
  pendingExecutions AutomationPendingExecution[]

  @@index([accountId, triggerType])
  @@map("automations")
}

model AutomationStep {
  id           String              @id @default(cuid())
  automationId String
  parentStepId String?             // null = root level; else the CONDITION step this is a child of
  branch       AutomationBranch?   // null for root steps; YES/NO for children of a CONDITION
  stepType     AutomationStepType
  config       Json                // shape varies per stepType — see engine.ts's executeStep switch
  position     Int

  automation Automation       @relation(fields: [automationId], references: [id], onDelete: Cascade)
  parent     AutomationStep?  @relation("StepBranches", fields: [parentStepId], references: [id], onDelete: Cascade)
  children   AutomationStep[] @relation("StepBranches")

  @@index([automationId, position])
  @@index([parentStepId])
  @@map("automation_steps")
}

model AutomationLog {
  id           String              @id @default(cuid())
  automationId String
  accountId    String
  contactId    String?
  status       AutomationLogStatus
  errorMessage String?             @db.Text
  createdAt    DateTime            @default(now())

  automation Automation @relation(fields: [automationId], references: [id], onDelete: Cascade)

  @@index([automationId, createdAt])
  @@map("automation_logs")
}

model AutomationPendingExecution {
  id               String                 @id @default(cuid())
  automationId     String
  accountId        String
  contactId        String?
  conversationId   String?
  parentStepId     String?
  branch           AutomationBranch?
  nextStepPosition Int
  context          Json                   @default("{}")
  status           PendingExecutionStatus @default(PENDING)
  runAt            DateTime
  createdAt        DateTime               @default(now())

  automation Automation @relation(fields: [automationId], references: [id], onDelete: Cascade)

  @@index([runAt, status])
  @@map("automation_pending_executions")
}

model Pipeline {
  id        String   @id @default(cuid())
  accountId String
  name      String
  isDefault Boolean  @default(false)
  createdAt DateTime @default(now())

  account Account         @relation(fields: [accountId], references: [id], onDelete: Cascade)
  stages  PipelineStage[]
  deals   Deal[]

  @@map("pipelines")
}

model PipelineStage {
  id          String  @id @default(cuid())
  pipelineId  String
  name        String
  position    Int
  color       String  @default("#1F6F5C")
  probability Int     @default(50)
  isWonStage  Boolean @default(false)
  isLostStage Boolean @default(false)

  pipeline Pipeline @relation(fields: [pipelineId], references: [id], onDelete: Cascade)
  deals    Deal[]

  @@index([pipelineId, position])
  @@map("pipeline_stages")
}

model Deal {
  id         String     @id @default(cuid())
  accountId  String
  pipelineId String
  stageId    String
  contactId  String?
  title      String
  value      Int        @default(0)
  status     DealStatus @default(OPEN)
  closedAt   DateTime?
  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt

  account  Account       @relation(fields: [accountId], references: [id], onDelete: Cascade)
  pipeline Pipeline      @relation(fields: [pipelineId], references: [id], onDelete: Cascade)
  stage    PipelineStage @relation(fields: [stageId], references: [id])
  contact  Contact?      @relation(fields: [contactId], references: [id], onDelete: SetNull)

  @@index([pipelineId, stageId])
  @@map("deals")
}

model ApiKey {
  id              String    @id @default(cuid())
  accountId       String
  createdByUserId String?
  name            String
  keyPrefix       String    // display only, e.g. "wacrm_live_a1b2c3d4..."
  keyHash         String    @unique // SHA-256 of the full plaintext key — plaintext shown once, never stored
  scopes          Json      // string[]: messages:send, messages:read, contacts:read, contacts:write, conversations:read, broadcasts:send
  lastUsedAt      DateTime?
  expiresAt       DateTime?
  revokedAt       DateTime?
  createdAt       DateTime  @default(now())

  account Account @relation(fields: [accountId], references: [id], onDelete: Cascade)

  @@index([accountId])
  @@map("api_keys")
}
```

## Design Tokens

Light "jade" theme — CSS custom properties, not Tailwind theme colors, defined in `app/globals.css`:

```css
:root {
  --ink: #101828;        --ink-soft: #4B5259;
  --paper: #F7F8F6;      --paper-raised: #FFFFFF;
  --jade: #1F6F5C;       --jade-dark: #165445;    --jade-soft: #E4F0EC;
  --amber: #B7791F;      --amber-soft: #FBF0DE;
  --coral: #C4432B;       --coral-soft: #FBEAE6;
  --line: #E2E4DF;
}
```
Usage pattern throughout: `style={{ background: "var(--jade)", color: "var(--ink)" }}` rather than Tailwind color classes, so the palette stays centrally editable. A dark-violet theme was explored once (matching a *reference product's* screenshots, not this codebase) and explicitly reverted — **this app stays on the light jade palette.** Font access in JSX: `font-[family-name:var(--font-display)]` / `var(--font-code)`.

## Environment Variables

```
# REQUIRED
DATABASE_URL="mysql://user:password@localhost:3306/wacrm?charset=utf8mb4"   # charset=utf8mb4 is required — see Gotchas §7
AUTH_SECRET=                      # npx auth secret
ENCRYPTION_KEY=                   # 64 hex chars (32 bytes) — node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
NEXT_PUBLIC_SITE_URL=             # e.g. https://your-vps-domain.com — baked into every stored media URL; must be reachable by Meta's servers, not localhost

# OPTIONAL legacy fallback for webhook signatures. New tenants should store
# their own Meta Developer App Secret per-account in Settings → WhatsApp
# (encrypted in WhatsAppConfig.metaAppSecretEncrypted). See Critical Invariants §6.
META_APP_SECRET=                  # legacy global secret

# OPTIONAL
UPLOAD_DIR=                       # defaults to ./uploads at project root if unset — set OUTSIDE the repo in production, see Gotchas §5
FFMPEG_PATH=                      # override if ffmpeg isn't on PATH (mainly a local Windows-dev concern)
AUTOMATION_CRON_SECRET=           # protects GET /api/automations/cron
ALLOWED_INVITE_HOSTS=             # comma-separated hostnames allowed in generated invite URLs
WHATSAPP_TEMPLATES_DRY_RUN=true   # skips real Meta calls on template submit; synthetic dry-run-<uuid> id, status APPROVED — for local dev without a real WABA
```

## Gotchas Already Debugged Once (do not reintroduce)

1. **Next.js 15 async `params`.** Server Components: `const { id } = await params`. Client Components: `const { id } = use(params)` (React's `use`, not a Promise `await` — Client Components can't be `async function`). Missed once in a client page reading `params.token` directly → `undefined` → crashed a `createHash().update(undefined)` call downstream. If a route param is ever `undefined` where it shouldn't be, check this first.
2. **Prisma's silent `undefined`-filter behavior** — see Critical Invariants §2. This caused a real production bug: a missing `conversationId` didn't error, it matched a *different* conversation in the same account, which then crashed later when the undefined value was used in a `create`.
3. **MySQL `Buffer<ArrayBufferLike>` vs `Buffer<ArrayBuffer>` TypeScript friction.** Newer `@types/node` made `Buffer` generic. Two symptoms: (a) `new NextResponse(buffer, ...)` — fix: `new NextResponse(new Uint8Array(buffer), ...)`. (b) reassigning a `let buffer = Buffer.from(...)` from a function typed to return the wider `Buffer<ArrayBufferLike>` — fix: annotate the declaration explicitly, `let buffer: Buffer = Buffer.from(...)`.
4. **Duplicate React keys from polling + optimistic-send racing.** The inbox polls every 4s; if a poll and a send-confirmation both add the "same" message before the other's cleanup ran, two entries with the same real id could coexist. Fixed by making `mergeMessages` (upsert-by-id into a `Map`, then sort) the *only* place messages are ever added to state — never `[...prev, ...fresh]` or `.map()`-based id-swapping directly.
5. **Upload directory must live outside the deploy directory in production.** If `UPLOAD_DIR` (or the default `./uploads`) sits inside the repo path, a `git pull`/clean redeploy can wipe every received/sent media file. Set `UPLOAD_DIR=/var/www/wacrm-uploads` (or similar), `chown` it to the app's run user, and gitignore `uploads/` regardless.
6. **Nginx's default `client_max_body_size` (1MB) silently rejects uploads** before they reach Next.js at all — looks like a generic failure with no app-level error. Set `client_max_body_size 20M;` in the server block to match `next.config.js`'s `experimental.serverActions.bodySizeLimit`.
7. **MySQL emoji corruption is a charset issue, not a browser/font issue.** A single emoji rendering as a tofu box (□) while others work is the signature of a table/column still on legacy 3-byte `utf8` instead of full 4-byte `utf8mb4` — some emoji happen to fit in 3 bytes and survive, others don't. Fix at three levels if it recurs: `ALTER DATABASE ... CHARACTER SET utf8mb4`, `ALTER TABLE ... CONVERT TO CHARACTER SET utf8mb4` per table (there's no bulk syntax — generate the per-table statements from `information_schema.TABLES`), and `?charset=utf8mb4` on `DATABASE_URL`. Already-corrupted rows do not self-heal; only new writes after the fix are affected.
8. **Browser-recorded media (camera video, mic voice notes) is WebM** (VP8/9+Opus or VP8+Opus) — **WhatsApp only accepts MP4/3GPP for video and OGG/AAC/MP3/AMR/M4A for audio.** `uploadInboxMedia` in `app/(dashboard)/inbox/actions.ts` detects `mimeType.startsWith("video/webm")` / `"audio/webm"` and routes through `lib/ffmpeg.ts`'s transcode functions before upload — this is not optional polish, sends will fail without it. Note the `.startsWith`, not `===`: a recorded blob's mimeType can arrive with a codec suffix (`audio/webm;codecs=opus`) depending on the browser.
9. **Meta's inbound media URLs are short-lived and require the App's access token to fetch** — they can't be embedded directly in the UI or stored long-term. `lib/whatsapp/media.ts`'s `downloadAndStoreMedia` downloads once server-side and re-hosts locally; this must happen inside the webhook handler synchronously, not deferred.
10. **A message can sit at `status: SENT` forever looking successful while actually undelivered**, because Meta reports delivery failures (e.g. "unable to fetch media" if your public URL isn't reachable/HTTPS-valid) via a *separate* `statuses` webhook event, not inline with the send response. `handleStatusUpdate` in the webhook route must be wired up and `Message.errorMessage` must be surfaced in the UI, or failures are invisible. If media sends work for you but not for the recipient, check that your `NEXT_PUBLIC_SITE_URL` is genuinely publicly reachable over valid HTTPS from outside your own network — test with an external tool, not from the same machine/network as the server.
11. **Leaflet's default marker icon path breaks under Next.js's bundler** unless overridden to point at a CDN (`L.Icon.Default.mergeOptions({ iconUrl: "https://unpkg.com/leaflet@.../marker-icon.png", ... })`) — otherwise markers render as broken image icons.
12. **`crypto.timingSafeEqual` throws (not returns false) if the two buffers differ in length** — guard with a length check before calling it (webhook signature verification does this: `sigBuf.length === expBuf.length && crypto.timingSafeEqual(...)`), or a malformed/missing signature crashes the route with a 500 instead of cleanly 401ing.

## Feature-by-Feature Status

**Fully working:** auth (signup/login/invite-join), multi-tenant accounts + roles, team management, contacts (**category-first**: `/contacts` lists categories with contact + duplicate counts; each category has a `/contacts/category/[id]` detail page with a server-paginated TanStack table, sorting, search, add-contact, and Excel/CSV import via the `xlsx` library in `lib/client-excel.ts`; CRUD/tags/**user-defined categories**/custom fields), WhatsApp connection + verification, inbox text/image/video/audio/document/sticker/contact-card/location send & receive, voice notes (hold-to-record), emoji picker, assign-conversation dropdown + automation trigger, contact notes panel, message templates (create/edit/sync-from-Meta/submit), broadcast wizard (template→audience→personalize→send, with incremental status counters), automation engine + visual builder (6 triggers, 9 step types, one level of Condition branching, Wait via external cron), pipelines/deals kanban, public API v1 (contacts, conversations, messages, broadcasts, scoped API keys). API reference: `docs/API.md`. Inbox free-form sends enforce WhatsApp’s 24-hour customer-service window.

**Explicitly not built** (real gaps, not oversights — flag before assuming they exist):
- Message reply/quote threading — schema fields exist (`replyToMessageId`) but no UI.
- Message reactions — no model, no UI.
- Interactive buttons/list-picker messages — automations/broadcasts only ever send plain text/template/media, never Meta's `interactive` button type.
- Agent-side quick replies/canned response macros.
- Business hours / away-message scheduling.
- Message template **buttons** in the builder UI (`buttons` Json column exists, unused).
- Template image/video/document **header uploads** — Meta requires a Resumable Upload handle, not a plain URL; not implemented.
- `Update Contact Field` automation step only supports `name`/`email`/`company` — no custom field support.
- `Send Webhook` automation step always POSTs an empty body — no payload templating.
- Nested Condition steps beyond one level in the **builder UI** (engine supports it; UI doesn't expose it).
- Contact CSV export is not built yet. Contact CSV import supports quoted values and processes uploads in server-safe chunks (250 client rows per request; 500-row server limit).
- Read-receipt tick icons (single/double/blue check) — only a text status label exists.
- Multiple WhatsApp numbers per account — `WhatsAppConfig` is one-to-one with `Account`.
- A "Flows" visual chatbot builder as a *separate* subsystem from Automations — out of scope by design, not partially built.
- Any shared dashboard shell/sidebar/nav — assume it already exists elsewhere in the project; nothing here supplies it.

## Local Dev Setup

```bash
npm install
npx prisma migrate dev
npx prisma generate
npm run dev
```
Windows-local note: ffmpeg-dependent features (camera video, voice notes) may not work locally if `ffmpeg-static`'s postinstall binary download was blocked (corporate proxy/antivirus/`ignore-scripts`). This is a known, accepted local-only gap — production on the VPS uses a real `apt install ffmpeg`. Don't spend more than a few minutes chasing it locally; set `FFMPEG_PATH` to a manual install if you need it working on your machine specifically.

## Production Deployment Checklist (VPS)

```bash
sudo apt install ffmpeg
mkdir -p /var/www/wacrm-uploads && chown -R <app-user>:<app-user> /var/www/wacrm-uploads
```
- Nginx: `client_max_body_size 20M;`
- `.env`: real `NEXT_PUBLIC_SITE_URL` (HTTPS, publicly reachable — verify with an external tool, not from the same network), `UPLOAD_DIR` outside the repo, `DATABASE_URL` with `?charset=utf8mb4`.
- External cron (crontab, cron-job.org, etc.) hitting `GET /api/automations/cron?secret=...` on an interval, or `Wait` automation steps never resume.
- Meta webhook config: callback URL = `https://<domain>/api/webhooks/whatsapp`, verify token matching what's saved in Settings → WhatsApp, and the **"messages" field checkbox explicitly checked** in Meta's webhook field subscription UI — easy to miss, and without it nothing arrives even though the URL/token are correct.

## Command Reference

```bash
npm run dev                          # local dev server
npm run build && npm run start       # production build/run (what PM2 etc. should invoke on the VPS)
npx prisma studio                    # visual DB browser — fastest way to confirm what a Server Action actually wrote
npx prisma migrate dev --name <x>    # create + apply a migration in dev
npx prisma generate                  # regenerate the Prisma client after any schema.prisma edit — do this even if migrate dev already ran, editors sometimes need a manual trigger
npx tsc --noEmit                     # full-project type check in one pass — run this after any multi-file change instead of waiting to hit each error one at a time in the dev server
```

## Server Action Conventions

Every feature's `actions.ts` follows the same shape — deviating from it is how the accountId-scoping invariant gets accidentally dropped:

```ts
"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session;
}

// Role-gated variant, used in Settings/Team/API keys/WhatsApp config —
// anything that changes account-wide settings rather than day-to-day data.
async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!["OWNER", "ADMIN"].includes(session.user.accountRole)) throw new Error("Forbidden");
  return session;
}

export async function someAction(id: string /* , ...rest */) {
  const session = await requireSession();
  if (!id) throw new Error("id is required");           // guard BEFORE any Prisma call — see Critical Invariants §2

  const row = await prisma.someModel.findFirst({
    where: { id, accountId: session.user.accountId },     // every query scoped like this, no exceptions
  });
  if (!row) throw new Error("Not found");

  // ...mutate, return a plain object (Server Actions can't return class instances / functions)
}
```

Client-side optimistic-update pattern (used in inbox, contacts, automations list, broadcasts): create a temp object with a `pending-${Date.now()}-${random}` id, splice it into local state immediately, then in a `startTransition(async () => {...})` block call the Server Action and merge the real result in by id on success, or flip a `status: "FAILED"` flag on catch. Never mutate state with `[...prev, ...fresh]` directly when polling and optimistic updates can both be live — always route through an id-keyed merge (see Gotchas §4).

## Extending the System — Recipes

**Add a new Automation step type:**
1. Add the value to `AutomationStepType` in `schema.prisma`, migrate.
2. `builder.tsx`: add to `STEP_OPTIONS` (icon + label), add a case to `defaultConfigFor`, add a case to `StepConfigForm` (the config UI).
3. `lib/automations/engine.ts`: add a case to `executeStep`'s switch, implement the step function.
4. Nothing else — it automatically becomes usable inside a Condition's Yes/No branch, since `StepList` is already recursive.

**Add a new Automation trigger:**
1. Add the value to `AutomationTrigger` in `schema.prisma`, migrate.
2. `builder.tsx`: add to `TRIGGER_OPTIONS`.
3. Call `runAutomationsForTrigger("YOUR_TRIGGER", ctx)` from wherever the real-world event actually happens. Grep for existing `runAutomationsForTrigger(` calls (`inbox/actions.ts`, the webhook route, `contacts/actions.ts`) to see every current call site and match the pattern.

**Add a new inbound/outbound WhatsApp message type:**
1. Add the value to `ContentType` in `schema.prisma`, migrate.
2. Outbound: add a `send*Message` function to `lib/whatsapp/client.ts`; wire it into the `sendMessage` branch logic in `inbox/actions.ts`.
3. Inbound: add a branch inside `handleInboundMessage` in `app/api/webhooks/whatsapp/route.ts` mapping Meta's `msg.type` to your new `ContentType`.
4. UI: add a render branch to `MessageContent` in `thread.tsx`.

**Add a new public API endpoint:**
1. Add the scope string to the `SCOPES` array in `settings/api-keys/page.tsx` so it's selectable when creating a key.
2. Create `app/api/v1/<resource>/route.ts`; first line of every handler is `const { accountId } = await authenticateApiRequest(req, "your:scope")`.
3. Scope every Prisma query by that returned `accountId` — never by anything the client sent in the request body/params.

## Manual Test Checklists (condensed — expand as needed per change)

- **WhatsApp connection:** Settings → WhatsApp → save credentials → "Verify connection" → should flip to Connected, or show Meta's exact rejection text under "Last check failed" (not a generic failure).
- **Inbox round-trip:** send each type (text, image, voice note, location, sticker, contact card) from the composer → confirm real delivery on a phone. Then send each type *to* the business number from a real phone → confirm correct in-thread rendering, not a broken preview or plain-text fallback.
- **Automations:** use the builder's "Test with: [contact] → Run test" and read the trace output rather than guessing why something didn't fire. A `WAIT` step needs the cron pinger actually running to ever resume — verify that separately from the rest of the automation.
- **Broadcasts:** step 1 should only list `APPROVED` templates. Sending to a contact outside the 24-hour window should surface as a per-recipient `FAILED` with Meta's reason attached, not a silent success.
- **Public API:** call `GET /api/v1/me` first to confirm the key and base URL are correct before testing anything scope-gated. Deliberately call an endpoint with a key that's missing the required scope to confirm you get a clean 403 with the expected message, not a silent 200.
