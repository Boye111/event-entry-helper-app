# Event Entry: QR invitations & gate check-in

Create an event (wedding, birthday, burial, conference…), add guests, and send each one a personal invite link with a
QR code on WhatsApp or email. At the gate, ushers scan the QR with their phones. The **first** scan admits the guest;
any later scan shows **ALREADY USED** with the time and the usher who scanned it. A QR from a different event shows
**WRONG EVENT**.

Works on phones, tablets and laptops, in light or dark mode (the toggle is in the top-right corner of every page; it
follows the device setting until you pick one).

| Page | Who | What |
|---|---|---|
| `/` | Anyone | What the product does + organiser login |
| `/login` | Organisers & helpers | Username + password |
| `/signup/<link>` | Invited person | One-time invite link: choose username, email, password (or "Join as …" if already logged in) |
| `/dashboard` | Organiser / helper | Your events (owned, and ones you help with). Delete an owned event from its card |
| `/dashboard/events/new` | Organiser | Create an event: kind, name, title on invite, date, venue, dress code, note |
| `/dashboard/events/<id>` | Owner / helper | **Guests**: stats, add, Excel/CSV import, WhatsApp/email invite, QR/card download, undo, delete (one, selected or all), CSV export |
| `/dashboard/events/<id>/ushers` | Owner / helper | Ushers: personal link + PIN, turn off / reset, who admitted how many |
| `/dashboard/events/<id>/team` | Owner (helpers can view) | Invite helpers with a one-time link, remove helpers |
| `/dashboard/events/<id>/details` | Owner / helper | Edit the event, upload the photo; owner can delete the event |
| `/dashboard/account` | Organiser / helper | Change password / email |
| `/admin` | **Super admin** (`ADMIN_PASSWORD`) | Whole-app numbers, organiser invite links, all accounts, all events (open, move). Not linked anywhere |
| `/invite/<code>` | Guest | Personal invite + QR. Read-only, never checks anyone in |
| `/scan/join/<link>` | Usher | Personal scanner link: enter PIN, then scan |
| `/scan` | Usher (or organiser / helper via the **Scanner** tab) | Camera scanner + manual search, locked to one event |

## Run locally

Needs Node 20+ and a Postgres database (local Docker works):

```bash
docker run -d --name wedding-pg -e POSTGRES_PASSWORD=wedding -e POSTGRES_DB=wedding -p 5433:5432 postgres:16-alpine
cp .env.example .env        # then fill in values (see below)
npm install
npm run db:migrate          # create / update tables (safe to run again)
npm run db:seed             # optional: a sample event with 5 fake guests
npm run dev                 # http://localhost:3000
npm run test:checkin        # with the server running: ~50 end-to-end checks (double-scan, 20-way race, ushers)
npm run test:organisers     # ~85 checks: organisers can't see each other's data, helpers, super admin tools
                            # (both log in as super admin with ADMIN_PASSWORD from .env and clean up after)
```

The phone camera only works on `https://` or `localhost`. To test the scanner on a real phone, deploy to Vercel
(easiest) or use a tunnel such as `npx localtunnel --port 3000`.

### Why invite links don't open on phones locally

Invite links and QR codes use the site's public address. On your computer that is `http://localhost:3000`, which
only exists on that computer, so phones can't open it and WhatsApp can't show a preview. The organiser pages show
a yellow note when this is the case. Once deployed on Vercel, the live `https://<project>.vercel.app` address is
used automatically; nothing to set.

## Environment variables

| Key | Example | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql://…` | Supabase / Neon connection string (see Deploy) |
| `ADMIN_PASSWORD` | long passphrase | **Super admin** login at `/admin` (no username). Changing it logs the super admin out |
| `SESSION_SECRET` | 64 random hex chars | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `SITE_URL` | `https://tundebisi.com` | Optional, **only for a custom domain**. Otherwise Vercel's address is used automatically. It goes inside every QR and link, so don't change it after sending invites |
| `NEXT_PUBLIC_EVENT_TIMEZONE` | `Africa/Lagos` | Optional, default `Africa/Lagos` |

You don't need `NEXT_PUBLIC_SITE_URL` any more (an old value still works, and a leftover `localhost` value is
ignored on Vercel). Ushers don't use an env variable: each one gets a personal link + PIN from the **Ushers** tab.

## Deploy (Vercel + Supabase, both free)

1. **Supabase**: create a project at supabase.com (pick a region close to Nigeria, e.g. *eu-west* / London).
   Save the database password it shows you.
2. In Supabase click **Connect** → **Connection string** → **Transaction pooler** (port `6543`). Copy it and put
   your database password in it. Use this pooler URL (not "Direct connection", which Vercel can't reach over IPv4).
3. Create the tables once from your computer:
   `DATABASE_URL="<supabase pooler url>" npm run db:migrate`
   (PowerShell: `$env:DATABASE_URL="<url>"; npm run db:migrate`)
4. Push this repo to GitHub → **Import** it in Vercel. Pick the final project name first, because that is the
   address in every invite (e.g. `tunde-bisi-wedding` → `https://tunde-bisi-wedding.vercel.app`).
5. In Vercel → Settings → Environment Variables, add `DATABASE_URL`, `ADMIN_PASSWORD` and `SESSION_SECRET`.
6. Deploy. Open `/admin`, log in with `ADMIN_PASSWORD`, create an **invite link** for each organiser and send it
   on WhatsApp. They choose a username and password, then **New event** → add guests → **Ushers** → send each
   usher their link. Events made before accounts existed have no owner: **Move** them to an organiser in `/admin`.

The schema turns on Row Level Security for every table. That blocks Supabase's public REST API from reading the data;
the app itself connects directly as the database owner and is not affected. Never put the database URL or
`SUPABASE_SERVICE_ROLE_KEY` in client code. This app doesn't need any Supabase API keys.

Neon works the same way: use its **pooled** connection string as `DATABASE_URL`.

## Events

- One organiser login runs any number of events. Each event has its own guests, ushers, photo, stats and scanner.
- The **kind of event** sets the wording: "The wedding of…", "Celebrating the life of…", "You're invited to…".
- **Event name** is for you and your ushers; the **title** (couple / celebrant / event title) is what guests see.
- **Delete** an event from its card on the events list, or from its **Details** tab. You type `DELETE` to
  confirm; it removes all its guests and ushers.
- Databases from before events existed are upgraded automatically by `npm run db:migrate`: the old event details
  become the first event and all existing guests and ushers are moved into it.

## Guests

- Add one at a time or **import Excel (.xlsx) or CSV** with a header row: `name, phone, email, seats, side, table_no`
  (only `name` is required; `full name`, `phone number`, `table`, `group` are also understood). You see a preview and
  any problems before anything is saved. Excel phone numbers that lost their leading 0 are fixed automatically.
- **WhatsApp** opens WhatsApp with the invite message for that guest. **Email** (shown when the guest has an email)
  opens your own email app with the invite ready to send. Nothing is sent automatically yet.
- **Delete guests:** one at a time (**Delete** on the guest), or **Select guests to delete** → tick them →
  **Delete N**, or **Delete all guests…** (type DELETE). Deleted guests' QR codes stop working.
- **Export CSV backup** includes every guest's code, link, email and check-in status.

## Ushers

Each usher gets a **private scanner link and a 6-digit PIN** for **one event**, made on that event's **Ushers** tab.
The WhatsApp message contains both. The usher opens the link, types the PIN, allows the camera and starts scanning.

- Ushers can only see and admit guests of their own event.
- Every check-in records which usher did it. The Ushers page shows "Admitted N guests" and when they last logged in.
- **Turn off**: that phone stops scanning straight away (checked on every request, not just at login).
  Turning them back on means they log in again with the same link + PIN.
- **New link & PIN**: use it if a link was forwarded to someone else. The old link dies and the phone is logged out.
- **Delete**: removes the usher. Guests they already admitted stay checked in.
- The organiser can scan too, from the event's **Scanner** tab (e.g. as a backup at the gate).

## Organisers, helpers and the super admin

Many organisers can use the app. Each logs in at `/login` with their own **username and password** and only
ever sees **their own** events (another organiser's event is simply "not found").

- **Super admin (the app owner)** logs in at `/admin` with `ADMIN_PASSWORD`, no username. It isn't linked from
  the site. From there:
  - **Overview:** organisers, helpers, events, guests, check-ins (and the last 7 days) across the whole app.
  - **Invite links:** organisers can only sign up through one. Each link makes one account, expires after
    1 / 7 / 30 days, and can be cancelled. Share it on WhatsApp or copy it.
  - **Organisers & helpers:** events owned, events helping on, last login. **Turn off** (logged out at once),
    **Make organiser / Make helper**, **Reset password** (temporary password shown once, to send them),
    **Delete** (type DELETE; removes the events they own too).
  - **All events:** open any event to check on it or help, **Move** it to another organiser, or **Delete** it.
    Old events with no owner can be cleared in one go with **Delete all events with no owner** (type DELETE).
- **Organisers** sign up from the invite link, then log in any time from any device. **Account** changes password
  or email; a new password logs out their other devices.
- **Helpers** (co-planners): on an event's **Team** tab the owner makes a one-time helper link. The helper signs
  up (or, with an existing account, logs in and taps **Join**). Helpers can manage guests, ushers, details and the
  scanner for that event, but can't delete it or change the team. A helper account can't create its own events
  unless the super admin clicks **Make organiser**. The owner can **Remove** a helper at any time.
- **Forgot password:** no self-service reset yet. Ask the super admin, who uses **Reset password**.

## Event-day checklist

- [ ] Invite links start with the live https address, and a test invite opens on a phone and shows a preview on WhatsApp.
- [ ] Rehearsal a few days before: 2–3 phones scanning at the same time, from screenshots and printed cards.
- [ ] Every usher has opened their link and logged in **before** guests arrive (Ushers page shows "Logged in …").
- [ ] Undo any rehearsal check-ins (or delete test guests).
- [ ] **Export CSV backup** the morning of the event and keep it on the organiser's phone.
- [ ] Ushers have mobile data / MiFi and charged power banks.
- [ ] Use the **Search** tab for guests with dead phones.

## How "one scan only" works

Check-in is a single conditional SQL update (`lib/guests.ts → checkIn`):

```sql
UPDATE guests SET checked_in_at = now(), checked_in_by = $usher_name, checked_in_usher_id = $usher_id
WHERE code = $code AND event_id = $event AND checked_in_at IS NULL
RETURNING *;
```

Postgres row locking guarantees only one request can flip `checked_in_at` from NULL, even with several gates
scanning the same code at the same instant. `npm run test:checkin` fires 20 parallel scans and asserts exactly one ADMIT.

## Renaming the app

The product name is one constant: `APP_NAME` in `lib/site.ts`.

## Roadmap

Done: events, per-event ushers with personal links, guest emails, Excel import, landing page, light/dark mode,
invite-only organiser accounts, helpers per event, super admin console.

| Area | Now | Next |
|---|---|---|
| Passwords | Super admin resets them by hand | Forgot password by email (Resend) |
| Accountability | — | Activity log: who deleted / undid / moved what |
| Sign-up | Invite links only | Open sign-up and limits per organiser, if it becomes a paid product |
| Event rules | Seats per guest | Check-in opening/closing times, +1s, re-entry allowed or not |
| Invites | Organiser taps WhatsApp / Email per guest | Bulk email, WhatsApp Business API template, delivery status |
| Money | Free | Plans by guest count (Paystack / Flutterwave) |
| Privacy | — | Privacy policy, data deletion after the event (NDPA compliance) |

The core rule stays the same: **only the usher scanner checks people in, and one-scan-only is enforced by a single
atomic SQL update.**
