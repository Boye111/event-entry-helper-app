# CLAUDE.md — Event Entry (QR invitations & gate check-in)

## ▶ Where we stopped (read this first, keep it current)

_Last updated: 2026-11-21. Update this section at the end of every working session._

**Status:** multi-organiser app with super admin and per-event helpers is built and tested locally
(`npm run test:organisers` 96 checks, `npm run test:checkin` 50 checks, all passing on a production build).
Latest additions: bulk guest delete (selected / all), super admin can delete any event and has a one-click
"delete all events with no owner" clean-up, plus redirect fixes (super admin logout, scanner, account page).
Multi-organiser + helpers + super admin was pushed to `main` as `d078da5` on 2026-11-21 (Vercel deploys from
`main`). Not yet confirmed by the owner on the live site or a real phone.

**Before deploying the multi-organiser version:** run `npm run db:migrate` against the Supabase DB first
(adds roles, invites, event ownership, event_helpers), then push. Everyone is logged out once.
After deploy: log in at `/admin` with `ADMIN_PASSWORD` → create an invite link for the organiser the app was
built for → under "All events", **Move** any old event worth keeping, then **Delete all events with no owner**
to clear old test events and their guests (the owner expects old test data to be removed, not kept).
The account created earlier on the live site with the old setup page is now an ordinary organiser account
(delete it from `/admin` if it isn't needed).

**Who the app is for:** built first for one organiser (a friend of the owner, running a wedding); the owner
now wants other organisers to use it too, invite-only for now.

**Backlog (agreed ideas, not built yet), roughly in priority order:**
1. Forgot password by email (Resend, free tier). `organisers.email` is already collected at sign-up. Until then
   the super admin uses **Reset password** (temporary password shown once).
2. Activity / audit log: who did what (deleted event, undid check-in, removed helper, moved event).
3. Limits per organiser (events / guests) if the app is ever charged for; open sign-up from the landing page.
4. Impersonation ("see what this organiser sees") — deliberately skipped for now; opening their events covers it.
5. Remove the unused `USHER_PIN` line from the local `.env` (nothing reads it any more).

## What this project is

A web app for weddings and other events. **Organisers** (invite-only accounts) each manage their own **events**;
each event has its own guests, ushers, photo, scanner and **helpers** (co-planners). Each guest gets a unique QR
code (sent via WhatsApp). At the venue gate, ushers scan the QR with their phone. The **first** valid scan admits
the guest (they get a wristband); any later scan of the same QR is rejected and shows when it was used.
The app owner is the **super admin** at `/admin` and can see and manage everything.

Deployed on **Vercel** (free tier) with **Supabase** Postgres. Must work well on mobile phones (Android Chrome
especially) — organisers, ushers and guests are all on phones.

## Core rules (do not break these)

1. **Only the scanner can check someone in.** The guest invite page (`/invite/[code]`) must NEVER mark a guest as checked in.
2. **One-scan-only is enforced in the database, atomically.** Check-in is a single conditional update, never "read then write":
   ```sql
   UPDATE guests SET checked_in_at = now(), checked_in_by = $2
   WHERE code = $1 AND event_id = $3 AND checked_in_at IS NULL
   RETURNING *;
   ```
   1 row → ADMIT · 0 rows → code exists in this event → ALREADY USED (time + usher) · other event → WRONG EVENT · else INVALID.
   Must stay correct when several ushers scan at the same time (tested with a 20-way race).
3. **Codes and tokens are unguessable** (`nanoid`, look-alike-free alphabet in `lib/codes.ts`). Never sequential IDs in URLs or QRs.
4. **Tenant isolation:** an organiser/helper must never see or change another organiser's events, guests, ushers
   or invites. **Every organiser route uses `requireEvent` / `requireRowOf` / `pageEvent` from `lib/auth.ts`**
   (never a bare `getEvent(id)`); someone else's event answers **404**, never 403 or data.
5. **All auth and check-in logic runs server-side.** Sessions are re-checked against the DB on every request.

## Tech stack

- Next.js 15 (App Router) + TypeScript (strict), Tailwind CSS v4
- Postgres (Supabase transaction pooler, port 6543) via `postgres` (plain SQL, no ORM); schema in `db/schema.sql`
- `qrcode`, `html5-qrcode`, `nanoid`, `zod`, `papaparse` + `read-excel-file`, `jose` (cookie JWT),
  Node `crypto.scrypt` for passwords, `next/og` for invite cards / WhatsApp previews (`jpeg-js`, `pngjs`)
- Dev machine is Windows: keep npm scripts cross-platform

## Environment variables

```
DATABASE_URL=postgres://...   # Supabase transaction pooler
ADMIN_PASSWORD=...            # super admin login at /admin (no username). Changing it logs the super admin out.
SESSION_SECRET=...            # 32+ random chars for signing cookies
SITE_URL=...                  # optional, custom domain only; else VERCEL_PROJECT_PRODUCTION_URL (lib/siteUrl.ts)
NEXT_PUBLIC_EVENT_TIMEZONE=   # optional, default Africa/Lagos
```
Never commit `.env`. `.env.example` lists every key. `NEXT_PUBLIC_SITE_URL` is legacy (still honoured, not needed).

## Who logs in where

| Who | Login | Area | Session role |
|---|---|---|---|
| Super admin (app owner) | `/admin/login`, `ADMIN_PASSWORD` only | `/admin`, `/api/admin/*`; may open any event page under `/dashboard/events/[id]` | `super` |
| Organiser | `/login` username + password; sign up via invite from super admin | `/dashboard`, `/api/org/*` | `organiser` (account role `organiser`) |
| Helper | same `/login`; sign up via an event's helper invite (or join with an existing account) | events they were added to | `organiser` (account role `helper`) |
| Usher | `/scan/join/<token>` + 6-digit PIN | `/scan` for one event | `usher` |

- `middleware.ts` checks the cookie kind per area (signature only); `getActiveSession()` re-checks the DB:
  account active + `version` matches (turn off / password reset = instant logout), usher active + version,
  super admin cookie holds a fingerprint of `ADMIN_PASSWORD`.
- Event access levels (`eventAccess` in `lib/auth.ts`): `super` and `owner` can do everything; `helper` can
  manage guests, ushers, details, photo and scanner but **not** delete the event or change helpers
  (`requireEvent(id, "manage")`). Helper accounts can't create events until the super admin clicks **Make organiser**.
- Invites (`invites` table): one-time, expire, cancellable. `event_id NULL` = organiser sign-up (super admin);
  `event_id` set = helper for that event. Claimed with a conditional UPDATE inside a transaction.

## Data model (db/schema.sql is the source of truth; idempotent, `npm run db:migrate`)

- `events` (id, public_id, organiser_id → owner, name, type, hosts, event_date, venue, dress_code, note, photo…)
- `guests` (id, event_id, code unique, name, phone, email, seats, side, table_no, checked_in_at, checked_in_by, checked_in_usher_id)
- `ushers` (id, event_id, token, name, phone, pin, active, version, last_login_at)
- `organisers` = accounts (id, username lowercase unique, email, password_hash scrypt, role organiser|helper, active, version, invite_id, last_login_at)
- `event_helpers` (event_id, organiser_id)
- `invites` (id, token, label, created_by, event_id, expires_at, used_at, used_by, revoked_at)
- `settings`: legacy single row, only used to migrate very old data into `events`
- Deleting an account deletes the events it owns (cascade → guests, ushers, helper rows, invites).
- RLS is enabled on every table with no policies, so Supabase's REST API exposes nothing; the app connects as owner.

## Pages & routes

- `/` landing (no data). App name = `APP_NAME` in `lib/site.ts`.
- `/login`, `/signup/[token]` (organiser or helper invite; logged-in accounts can "Join as …"), `/admin/login`.
- `/admin` super admin: overview numbers, organiser invite links, accounts (turn off/on, make organiser/helper,
  reset password, delete), all events (open, move to another organiser, delete, delete all with no owner).
- `/dashboard` an account's events (owned + helping); `/dashboard/events/new` (organisers only);
  `/dashboard/events/[id]` guests (stats, search, add, Excel/CSV import with preview, WhatsApp/email invite,
  QR/card download, undo check-in, delete one / selected / all, CSV export); `/[id]/ushers`; `/[id]/team` (owner, helpers, helper invite
  links); `/[id]/details` (edit, photo, delete by typing DELETE); `/dashboard/account` (password, email).
- `/invite/[code]` public read-only invite + big QR + Open Graph preview. Never checks in.
- `/scan` full-screen camera scanner + manual search, locked to one event; results: ADMIT / ALREADY USED / WRONG EVENT / INVALID.
- APIs: `/api/auth/{login,admin,signup,join,usher,logout}`, `/api/org/...` (events, guests, ushers, team,
  invites, account), `/api/admin/...` (invites, organisers, events move), `/api/checkin`, `/api/guests/search`,
  `/api/headcount`, `/api/qr/[code]`, `/api/card/[code]`, `/api/og/[code]`, `/api/photo/[publicId]`.
- Rate limits (in-memory per IP): logins, sign-up, check-in.
- **Don't name API paths with words ad blockers block** (`stats`, `analytics`, `track`, `metrics`, `pixel`,
  `beacon`): blocked requests look like "Can't reach the server". The headcount route was renamed from
  `/api/stats` for this reason; the organiser guest page counts from its single guest-list request.

## UI / design
- Mobile-first, big tap targets; scanner result screens fill the screen with strong colours.
- Elegant invite page (Playfair Display); clean practical organiser screens.
- Wording from the event `type` (`lib/eventTypes.ts`).
- Light/dark theme via CSS variables in `app/globals.css` + `data-theme` on `<html>`; use `bg-surface`, `text-ink`,
  `text-on-ink`, never hard-coded white/black outside the scanner. Cards on phones, tables from `md`.
- Client components get the public site address from `useSiteUrl()` (`components/SiteUrl.tsx`), never from env.

## Nigerian phone numbers
Normalise for `wa.me`: strip spaces/dashes/`+`; `0XXXXXXXXXX` (11 digits) → `234XXXXXXXXXX`; leave `234...` as is.

## Testing
- Start the app (`npm run build && npm start` is more reliable than `npm run dev` for test runs), then
  `npm run test:organisers` and `npm run test:checkin`. Both log in as super admin with `ADMIN_PASSWORD` from
  `.env`, create throwaway `zz-…` accounts/events, and clean up. Restart the server between repeated runs
  (login/sign-up rate limits).
- Don't run `npm run build` while `npm run dev` is running (they share `.next` and corrupt each other).
- Still manual: QR scanning from a screenshot and from print; Android Chrome + iOS Safari camera permission.

## Deployment
- Run `npm run db:migrate` against Supabase **before** pushing code that needs new columns/tables
  (PowerShell: `$env:DATABASE_URL="<pooler url>"; npm run db:migrate`).
- Push to GitHub `main` → Vercel deploys automatically.
- Before an event: rehearsal with 2–3 phones, export CSV backup, ushers log in beforehand, mobile data / MiFi.

## Working with the owner
- When the data model changes, old test data (events/guests from earlier versions) should be cleaned up or a
  clean-up tool provided; don't leave it lying around. Ask before deleting anything on the live database.
- The owner reviews on a phone; check every new screen works on a narrow screen.

## Coding conventions
- TypeScript strict. Validate all inputs with zod. Plain-English error messages (no stack traces on screen).
- Server-only code in route handlers / server components; never expose `DATABASE_URL` or secrets to the client.
- Small components; client components only for interactive parts.
- Keep `README.md` (setup + how to use), `.env.example`, and the **Where we stopped** section above current.
