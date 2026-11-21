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
| `/admin/login` | Organiser | Username + password. The very first visit creates the account (needs `ADMIN_PASSWORD` once) |
| `/admin` | Organiser | All events, with guest counts. Delete an event from its card |
| `/admin/account` | Organiser | Change password / email |
| `/admin/events/new` | Organiser | Create an event: kind, name, title on invite, date, venue, dress code, note |
| `/admin/events/<id>` | Organiser | **Guests of that event**: stats, add, Excel/CSV import, WhatsApp/email invite, QR/card download, undo, CSV export |
| `/admin/events/<id>/ushers` | Organiser | Ushers for that event: personal link + PIN, turn off / reset, who admitted how many |
| `/admin/events/<id>/details` | Organiser | Edit the event, upload the photo, delete the event |
| `/invite/<code>` | Guest | Personal invite + QR. Read-only, never checks anyone in |
| `/scan/join/<link>` | Usher | Personal scanner link: enter PIN, then scan |
| `/scan` | Usher (or organiser via the **Scanner** tab) | Camera scanner + manual search, locked to one event |

## Run locally

Needs Node 20+ and a Postgres database (local Docker works):

```bash
docker run -d --name wedding-pg -e POSTGRES_PASSWORD=wedding -e POSTGRES_DB=wedding -p 5433:5432 postgres:16-alpine
cp .env.example .env        # then fill in values (see below)
npm install
npm run db:migrate          # create / update tables (safe to run again)
npm run db:seed             # optional: a sample event with 5 fake guests
npm run dev                 # http://localhost:3000
npm run test:checkin        # with the server running + TEST_ADMIN_USERNAME/PASSWORD set: ~50 end-to-end checks
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
| `ADMIN_PASSWORD` | long passphrase | **Setup password**, typed once on the login page to create the organiser account |
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
6. Deploy. Open `/admin`: the first time, it asks for the setup password (`ADMIN_PASSWORD`) and lets you choose
   your **username and password**. From then on you log in with those. Then **New event** → add guests →
   **Ushers** → send each usher their link.

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

## Organiser account

- Log in with a **username and password**. The account is created on the first visit to `/admin/login`, using
  `ADMIN_PASSWORD` as a one-time setup password (so nobody else can claim your app).
- Change your password or email under **Account** (top bar).
- **Forgot password** isn't built yet. Until it is, the database owner can reset it by deleting the row in the
  `organisers` table (Supabase → Table editor) and creating the account again on the login page.
- There is one organiser account for now; it sees all events.

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

## Roadmap: from one organiser to a business

Done: events, per-event ushers with personal links, guest emails, Excel import, landing page, light/dark mode.

Still to build before other people can sign up:

| Area | Now | Product version |
|---|---|---|
| Login | One organiser password (`ADMIN_PASSWORD`) | Accounts (email + password, e.g. Supabase Auth); every event belongs to an account |
| Event rules | Seats per guest | Check-in opening/closing times, +1s, re-entry allowed or not, expected headcount |
| Invites | Organiser taps WhatsApp / Email per guest | Bulk email (Resend from your own domain), WhatsApp Business API with an approved template, delivery status, opt-out |
| Import | Excel + CSV with fixed column names | Column mapping, duplicate detection |
| Money | Free | Plans by guest count (Paystack / Flutterwave) |
| Privacy | Organiser's own data | Privacy policy, data deletion after the event (NDPA compliance) |

The core rule stays the same: **only the usher scanner checks people in, and one-scan-only is enforced by a single
atomic SQL update.**
