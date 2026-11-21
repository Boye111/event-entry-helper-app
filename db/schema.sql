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
-- Organiser accounts: username + password (scrypt hash). The first one is created on the login page,
-- which asks for ADMIN_PASSWORD once so a stranger can't claim the app. `email` is kept for a future
-- "forgot password" flow. All organiser accounts currently see all events.
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
