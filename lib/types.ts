export type Guest = {
  id: number;
  event_id: number;
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
  seats: number;
  side: string | null;
  table_no: string | null;
  checked_in_at: string | null;
  checked_in_by: string | null;
  created_at: string;
};

export type EventDetails = {
  id: number;
  public_id: string;
  name: string;
  type: string;
  hosts: string | null;
  event_date: string | null;
  venue: string | null;
  dress_code: string | null;
  note: string | null;
  /** Changes on each upload; null = no photo. Used for cache-busting /api/photo/<public_id>?v= */
  photo_version: string | null;
  created_at: string;
};

export type EventSummary = EventDetails & Stats;

export type Stats = {
  guests: number;
  seats: number;
  arrived_guests: number;
  arrived_seats: number;
};

export type CheckinResult =
  | { status: "admitted"; guest: Guest; checkedInAt: string; checkedInBy: string }
  | { status: "already_used"; guest: Guest; checkedInAt: string; checkedInBy: string }
  | { status: "invalid" }
  /** Real code, but for a different event than the one this scanner is working */
  | { status: "wrong_event" };

export type Usher = {
  id: number;
  event_id: number;
  token: string;
  name: string;
  phone: string | null;
  pin: string;
  active: boolean;
  version: number;
  last_login_at: string | null;
  created_at: string;
  /** Guests this usher admitted */
  admitted: number;
};
