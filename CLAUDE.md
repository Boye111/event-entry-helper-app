# CLAUDE.md — Event Entry (QR invitations & gate check-in)

## What this project is

A web app for weddings and other events. One organiser login manages many **events**; each event has its own guests, ushers, photo and scanner. The organiser adds invited guests to an event; each guest gets a unique QR code (sent via WhatsApp). At the venue gate, ushers scan the QR with their phone. The **first** valid scan admits the guest (they get a wristband); any later scan of the same QR is rejected and shows when it was used.

Deployed on **Vercel** (free tier). Must work well on mobile phones (Android Chrome especially) — ushers and guests are all on phones.

## Core rules (do not break these)

1. **Only the usher scanner can check someone in.** The guest invite page (`/invite/[code]`) must NEVER mark a guest as checked in. A guest scanning their own QR with their phone camera just opens their invite page.
2. **One-scan-only is enforced in the database, atomically.** Check-in must be a single conditional update, never "read then write":
   ```sql
   UPDATE guests
   SET checked_in_at = now(), checked_in_by = $2
   WHERE code = $1 AND checked_in_at IS NULL
   RETURNING *;
   ```
   - 1 row returned → ADMIT
   - 0 rows → look up the code: if it exists → ALREADY USED (show time + usher); if not → INVALID
   This must stay correct when several ushers scan at different gates at the same time.
3. **Codes must be unguessable.** Use `nanoid` (10–12 chars, URL-safe alphabet without look-alike characters). Never sequential IDs in URLs or QRs.
4. **Admin and scanner are protected.** Guests must not be able to reach `/admin` or `/scan` actions.
5. **All check-in logic runs server-side** (route handlers / server actions). The client never decides if a guest is admitted.

## Tech stack

- **Next.js 15 (App Router) + TypeScript**
- **Tailwind CSS** for styling
- **Postgres** via **Neon** or **Supabase** (free tier) — use `DATABASE_URL`
- **Drizzle ORM** (or plain `postgres`/`pg` with SQL — keep it simple)
- **`qrcode`** (npm) — generate QR images (PNG data URL / SVG) server-side
- **`html5-qrcode`** — camera-based QR scanning in the browser (requires HTTPS; Vercel provides it; use `localhost` in dev)
- **`nanoid`** — guest codes
- **`zod`** — validate inputs
- **`papaparse`** — CSV import of guests

## Environment variables

```
DATABASE_URL=postgres://...
ADMIN_PASSWORD=...        # one-time setup password to create the organiser account
SESSION_SECRET=...        # long random string for signing cookies
SITE_URL=...              # optional, custom domain only; else VERCEL_PROJECT_PRODUCTION_URL (lib/siteUrl.ts)
```

Create `.env.example` with these keys (no real values). Never commit `.env`.

## Data model

```sql
CREATE TABLE guests (
  id             SERIAL PRIMARY KEY,
  code           TEXT UNIQUE NOT NULL,         -- nanoid, goes inside the QR
  name           TEXT NOT NULL,
  phone          TEXT,                          -- for WhatsApp share link, e.g. 2348012345678
  seats          INTEGER NOT NULL DEFAULT 1,    -- how many people this QR admits (wristbands to give)
  side           TEXT,                          -- optional: 'bride' | 'groom' | 'family' | 'friends'
  table_no       TEXT,                          -- optional
  checked_in_at  TIMESTAMPTZ,                   -- NULL = not yet arrived
  checked_in_by  TEXT,                          -- usher name/gate entered on scanner login
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Current schema lives in db/schema.sql (idempotent; npm run db:migrate). Summary of later additions:
--   events (id, public_id, name, type, hosts, event_date, venue, dress_code, note, photo...)
--   guests.event_id (NOT NULL, FK, cascade), guests.email, guests.checked_in_usher_id
--   ushers (id, event_id, token, name, phone, pin, active, version, last_login_at)
-- Guest codes stay globally unique; check-in additionally requires the scanner's event_id.
-- RLS is enabled on every table (no policies) so Supabase's REST API exposes nothing.

CREATE TABLE settings (           -- LEGACY single row; only used to migrate old data into `events`
  id          INTEGER PRIMARY KEY DEFAULT 1,
  couple      TEXT,               -- e.g. "Tunde & Bisi"
  event_date  TIMESTAMPTZ,
  venue       TEXT,
  dress_code  TEXT,
  note        TEXT
);
```

Provide a migration (Drizzle migration or `db/schema.sql`) and a seed script with ~5 fake guests.

## Pages & routes

### `/` — Landing
Product landing page (what it does, organiser login). No guest or event data. App name = `APP_NAME` in `lib/site.ts`.

### `/admin` — Organiser (password protected)
- Login with username + password (`organisers` table, scrypt hash) → signed httpOnly cookie with `organiserId`.
  First visit with no organiser: setup form, proven with `ADMIN_PASSWORD`. `/admin/account` changes password/email.
  Forgot password: not built yet (organisers.email is stored for it).
- `/admin` lists events; `/admin/events/new` creates one; `/admin/events/[id]` = guests (below),
  `/admin/events/[id]/ushers`, `/admin/events/[id]/details` (edit, photo, delete with typed confirmation).
  Event APIs are nested: `/api/admin/events/[id]/{guests,import,export,ushers,photo}`.
- Everything below is per event.
- Stats at top: total guests, total seats, checked in (guests + seats), remaining. Auto-refresh every ~10s.
- Guest table: search by name/phone, filter (all / arrived / not arrived), shows status + check-in time.
- Add guest form (name, phone, seats, side, table).
- **CSV import** (columns: `name,phone,seats,side,table_no`) with a preview before saving.
- Per guest actions:
  - View/download QR (PNG)
  - Download **invite card** image (couple names, guest name, date, venue, QR) — nice for WhatsApp
  - **Share on WhatsApp** button → `https://wa.me/<phone>?text=<encoded message with invite link>`
  - Copy invite link
  - Edit / delete
  - **Undo check-in** (for mistakes) — with a confirm step
- Export all guests to CSV (backup for the gate if internet fails).
- Event settings form (couple, date, venue, dress code, note).

### `/invite/[code]` — Guest invite page (public, read-only)
- Shows: couple names, "You're invited, {name}", date, venue, dress code, seats ("Admits 2").
- Large QR code (encodes the full URL `siteUrl()/invite/{code}`, see `lib/siteUrl.ts`) so it scans well from a screenshot.
- Tip text: "Show this QR at the gate."
- If already checked in, it may show "Checked in ✓" — but it must NOT perform a check-in.
- Invalid code → friendly "Invite not found" page.
- Add proper Open Graph meta so the WhatsApp link preview looks good.

### `/scan` — Usher scanner (PIN protected)
- Ushers are created by the organiser at `/admin/ushers` (table `ushers`): each gets a private link
  `/scan/join/<token>` + 6-digit PIN, sent via WhatsApp. Login puts `usherId` + `usherVersion` in the signed
  cookie; every usher request re-checks the DB (`getActiveSession`), so "Turn off" / "New link & PIN" log them out
  immediately. `guests.checked_in_usher_id` records who admitted whom. Shared `USHER_PIN` login only if that env is set.
- Full-screen camera scanner (rear camera by default), mobile-first.
- Scanner accepts either the full invite URL or a bare code; extract the code from the URL.
- On scan → POST `/api/checkin` → show a **full-screen result**:
  - 🟢 **GREEN — ADMIT**: guest name, "Give N wristband(s)", side/table
  - 🔴 **RED — ALREADY USED**: guest name, "Checked in at 3:42 PM by Kemi – Gate A"
  - 🟡 **YELLOW/RED — INVALID**: "Code not recognised"
- Play a short beep/vibrate (`navigator.vibrate`) on result; different pattern for success vs fail.
- Pause scanning while the result shows; "Scan next" button (or auto-resume after ~3s) to avoid double-scanning the same QR.
- **Manual search fallback**: search guest by name/phone and check in with a button (same atomic API) — for broken phones / dead batteries.
- Live counter at top: "Checked in: 142 / 300".

### API routes
- `POST /api/checkin` `{ code }` → usher session required → atomic update → `{ status: 'admitted' | 'already_used' | 'invalid', guest, checkedInAt, checkedInBy }`
- `GET /api/guests/search?q=` → usher or admin session
- `GET /api/stats` → usher or admin session
- Admin CRUD routes / server actions for guests, CSV import, export, settings, undo check-in
- `GET /api/qr/[code]` → returns PNG of the QR (public is fine; it only reveals the code the guest already has)

Rate-limit `/api/checkin` and login routes lightly (simple in-memory or per-IP counter is fine) to stop PIN brute-forcing.

## Auth (keep it simple)
- One organiser account (username + password, see `/admin`); ushers use personal links + PIN (see `/scan`).
- On login, set a signed httpOnly, secure, sameSite=lax cookie (use `jose` or `iron-session`) with role `admin` or `usher` (+ usher name).
- Use `middleware.ts` to guard `/admin/*` and `/scan/*` and the matching API routes.
- Admin role can also use the scanner.

## UI / design
- Mobile-first. Big tap targets. Scanner result screens fill the whole screen with strong colours readable in sunlight.
- Elegant wedding look for the invite page (soft colours, serif heading font e.g. Playfair Display via `next/font`); clean and practical for admin/scanner.
- Wording comes from the event `type` (`lib/eventTypes.ts`); title/date/venue/photo from the `events` row.
- Light/dark theme via CSS variables in `app/globals.css` + `data-theme` on `<html>`; use `bg-surface`, `text-ink`, `text-on-ink`, never hard-coded white/black outside the scanner. Mobile-first: cards on phones, tables from `md`.

## Folder structure (suggested)
```
app/
  page.tsx
  invite/[code]/page.tsx
  admin/(login, dashboard, guests, settings)
  scan/page.tsx, scan/login/page.tsx
  api/checkin/route.ts
  api/guests/search/route.ts
  api/stats/route.ts
  api/qr/[code]/route.ts
lib/
  db.ts          # db client
  schema.ts      # drizzle schema
  auth.ts        # session sign/verify helpers
  codes.ts       # nanoid generator
  qr.ts          # qr helpers
  whatsapp.ts    # wa.me link builder (normalise Nigerian numbers: 080... -> 23480...)
components/
middleware.ts
db/seed.ts
.env.example
README.md
```

## Nigerian phone numbers
Normalise for `wa.me`: strip spaces/dashes/`+`; `0XXXXXXXXXX` (11 digits) → `234XXXXXXXXXX`; leave `234...` as is.

## Build order
1. Scaffold Next.js + Tailwind + TypeScript, DB connection, schema, migration, seed.
2. Auth (admin password + usher PIN, cookies, middleware).
3. Admin: add/list guests, stats.
4. Invite page + QR generation.
5. Scanner page + `/api/checkin` with the atomic update. **Test double-scan and concurrent scans.**
6. CSV import/export, WhatsApp share, invite card image, undo check-in.
7. Polish UI, Open Graph tags, README with deploy steps.

## Testing checklist
- Scanning a fresh code → ADMIT; scanning it again → ALREADY USED with correct time and usher.
- Two simultaneous check-in requests for the same code → exactly one admitted (write a small script that fires both in parallel).
- Invalid / random code → INVALID.
- Guest opening their own invite link many times → never checked in.
- `/admin` and `/scan` inaccessible without login; API routes return 401.
- QR scans reliably from a phone screenshot and from a printed card.
- Works on Android Chrome and iOS Safari (camera permission flow).

## Deployment
- Push to GitHub → import in Vercel → set env vars → deploy.
- Run migrations against the production DB before the event.
- Before the wedding day: do a full rehearsal with 2–3 phones scanning, export a CSV backup, and make sure ushers have mobile data/MiFi.

## Coding conventions
- TypeScript strict mode. Validate all inputs with zod.
- Server-only code in route handlers/server actions; never expose `DATABASE_URL` or secrets to the client.
- Keep components small; prefer server components, use client components only for the scanner and interactive forms.
- Clear error messages in plain English for ushers (no stack traces on screen).
