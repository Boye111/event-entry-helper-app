CREATE TABLE IF NOT EXISTS guests (
  id             SERIAL PRIMARY KEY,
  code           TEXT UNIQUE NOT NULL,
  name           TEXT NOT NULL,
  phone          TEXT,
  seats          INTEGER NOT NULL DEFAULT 1 CHECK (seats > 0),
  side           TEXT,
  table_no       TEXT,
  checked_in_at  TIMESTAMPTZ,
  checked_in_by  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guests_name_idx ON guests (lower(name));
CREATE INDEX IF NOT EXISTS guests_phone_idx ON guests (phone);

CREATE TABLE IF NOT EXISTS settings (
  id          INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  couple      TEXT,
  event_date  TIMESTAMPTZ,
  venue       TEXT,
  dress_code  TEXT,
  note        TEXT
);

INSERT INTO settings (id, couple) VALUES (1, 'Bride & Groom') ON CONFLICT (id) DO NOTHING;

-- Couple photo (stored in the DB so no extra file storage service is needed)
ALTER TABLE settings ADD COLUMN IF NOT EXISTS photo BYTEA;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS photo_type TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS photo_version BIGINT;

-- Ushers: each gets a private scanner link (token) + PIN. Organiser can deactivate or reset them.
-- `version` is copied into the usher's session cookie; bumping it logs that usher out everywhere.
CREATE TABLE IF NOT EXISTS ushers (
  id             SERIAL PRIMARY KEY,
  token          TEXT UNIQUE NOT NULL,
  name           TEXT NOT NULL,
  phone          TEXT,
  pin            TEXT NOT NULL,
  active         BOOLEAN NOT NULL DEFAULT true,
  version        INTEGER NOT NULL DEFAULT 1,
  last_login_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE guests ADD COLUMN IF NOT EXISTS checked_in_usher_id INTEGER REFERENCES ushers(id) ON DELETE SET NULL;

-- ============================================================================================
-- Events: one organiser login can run many events. Guests and ushers belong to exactly one event.
-- (The old single-row `settings` table is kept only so existing data can be moved over below.)
-- ============================================================================================
CREATE TABLE IF NOT EXISTS events (
  id             SERIAL PRIMARY KEY,
  -- Used in public photo URLs so event ids can't be enumerated
  public_id      TEXT UNIQUE NOT NULL DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 16),
  name           TEXT NOT NULL,                     -- e.g. "Tunde & Bisi's Wedding"
  type           TEXT NOT NULL DEFAULT 'wedding',   -- see lib/eventTypes.ts
  hosts          TEXT,                              -- big title on the invite, e.g. "Tunde & Bisi"
  event_date     TIMESTAMPTZ,
  venue          TEXT,
  dress_code     TEXT,
  note           TEXT,
  photo          BYTEA,
  photo_type     TEXT,
  photo_version  BIGINT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE guests ADD COLUMN IF NOT EXISTS event_id INTEGER REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE ushers ADD COLUMN IF NOT EXISTS event_id INTEGER REFERENCES events(id) ON DELETE CASCADE;

-- One-time move: if this database was used before events existed, turn the old settings row into
-- the first event and put every existing guest and usher into it.
DO $$
DECLARE new_id INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM events) AND (
       EXISTS (SELECT 1 FROM guests) OR EXISTS (SELECT 1 FROM ushers)
       OR EXISTS (SELECT 1 FROM settings WHERE event_date IS NOT NULL OR coalesce(couple, 'Bride & Groom') <> 'Bride & Groom')
  ) THEN
    INSERT INTO events (name, type, hosts, event_date, venue, dress_code, note, photo, photo_type, photo_version)
    SELECT coalesce(nullif(couple, ''), 'My') || '''s Wedding', 'wedding', couple, event_date, venue, dress_code, note,
           photo, photo_type, photo_version
    FROM settings WHERE id = 1
    RETURNING id INTO new_id;
    IF new_id IS NULL THEN
      INSERT INTO events (name) VALUES ('My Wedding') RETURNING id INTO new_id;
    END IF;
    UPDATE guests SET event_id = new_id WHERE event_id IS NULL;
    UPDATE ushers SET event_id = new_id WHERE event_id IS NULL;
  END IF;
END $$;

ALTER TABLE guests ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE ushers ALTER COLUMN event_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS guests_event_idx ON guests (event_id);
CREATE INDEX IF NOT EXISTS ushers_event_idx ON ushers (event_id);

-- Supabase exposes the public schema over its REST API. This app never uses that API (it connects
-- directly as the table owner, which bypasses RLS), so turn RLS on with no policies = REST sees nothing.
ALTER TABLE guests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ushers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE events   ENABLE ROW LEVEL SECURITY;

-- ============================================================================================
-- Accounts (username + password, scrypt hash). Nobody signs up without a one-time invite link:
--  - invite from the SUPER ADMIN (event_id NULL)  -> role 'organiser': can create and own events
--  - invite from an organiser for one event        -> role 'helper': works on events they're added to
-- The super admin is NOT an account: it logs in at /admin with ADMIN_PASSWORD only.
-- `active` = false turns an account off; bumping `version` logs that account out everywhere.
-- ============================================================================================
CREATE TABLE IF NOT EXISTS organisers (
  id             SERIAL PRIMARY KEY,
  username       TEXT UNIQUE NOT NULL CHECK (username = lower(username)),
  email          TEXT,
  password_hash  TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at  TIMESTAMPTZ
);
ALTER TABLE organisers ENABLE ROW LEVEL SECURITY;
ALTER TABLE organisers ADD COLUMN IF NOT EXISTS role    TEXT    NOT NULL DEFAULT 'organiser';
ALTER TABLE organisers ADD COLUMN IF NOT EXISTS active  BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE organisers ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
-- (An earlier version had a 'super' account role; the super admin is now ADMIN_PASSWORD only.)
ALTER TABLE organisers DROP CONSTRAINT IF EXISTS organisers_role_check;
UPDATE organisers SET role = 'organiser' WHERE role NOT IN ('organiser', 'helper');
ALTER TABLE organisers ADD CONSTRAINT organisers_role_check CHECK (role IN ('organiser', 'helper'));

CREATE TABLE IF NOT EXISTS invites (
  id          SERIAL PRIMARY KEY,
  token       TEXT UNIQUE NOT NULL,
  label       TEXT NOT NULL,                 -- who it's for, e.g. "Kemi - planner"
  created_by  INTEGER REFERENCES organisers(id) ON DELETE SET NULL,   -- NULL = super admin
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  used_by     INTEGER REFERENCES organisers(id) ON DELETE SET NULL,
  revoked_at  TIMESTAMPTZ
);
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE organisers ADD COLUMN IF NOT EXISTS invite_id INTEGER REFERENCES invites(id) ON DELETE SET NULL;

-- Each event has one owner. Deleting an account deletes the events it owns (and their guests and ushers).
-- Events from before accounts existed have no owner until the super admin moves them to someone.
ALTER TABLE events ADD COLUMN IF NOT EXISTS organiser_id INTEGER REFERENCES organisers(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS events_organiser_idx ON events (organiser_id);

-- Helpers: extra accounts that may work on an event (guests, ushers, scanner, details).
-- Only the owner (or super admin) can delete the event or change its helpers.
ALTER TABLE invites ADD COLUMN IF NOT EXISTS event_id INTEGER REFERENCES events(id) ON DELETE CASCADE;
CREATE TABLE IF NOT EXISTS event_helpers (
  event_id      INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  organiser_id  INTEGER NOT NULL REFERENCES organisers(id) ON DELETE CASCADE,
  added_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, organiser_id)
);
CREATE INDEX IF NOT EXISTS event_helpers_organiser_idx ON event_helpers (organiser_id);
ALTER TABLE event_helpers ENABLE ROW LEVEL SECURITY;
