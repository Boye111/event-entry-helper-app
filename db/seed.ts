import "dotenv/config";
import postgres from "postgres";
import { newGuestCode } from "../lib/codes";

const guests = [
  { name: "Adaeze Okafor", phone: "08031234567", email: "adaeze@example.com", seats: 2, side: "bride", table_no: "1" },
  { name: "Tunde Bakare", phone: "08059876543", email: null, seats: 1, side: "groom", table_no: "3" },
  { name: "Mama Ngozi", phone: "07012345678", email: null, seats: 3, side: "family", table_no: "VIP" },
  { name: "Chidi Eze", phone: "2348091112222", email: "chidi@example.com", seats: 1, side: "friends", table_no: "5" },
  { name: "Funmi Adeyemi", phone: null, email: "funmi@example.com", seats: 2, side: "bride", table_no: "2" },
];

/** Creates one sample event ("Tunde & Bisi's Wedding (sample)") with 5 fake guests. Safe to run twice. */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = postgres(url, { max: 1, prepare: false });

  const [event] = await sql`
    INSERT INTO events (name, type, hosts, event_date, venue, dress_code, note)
    VALUES ('Tunde & Bisi''s Wedding (sample)', 'wedding', 'Tunde & Bisi', now() + interval '30 days',
            'Eko Hotel, Victoria Island, Lagos', 'Emerald green & gold',
            'Reception starts immediately after the church service.')
    RETURNING id, name`;
  console.log(`Event #${event.id}: ${event.name}`);

  for (const g of guests) {
    const [row] = await sql`
      INSERT INTO guests (event_id, code, name, phone, email, seats, side, table_no)
      VALUES (${event.id}, ${newGuestCode()}, ${g.name}, ${g.phone}, ${g.email}, ${g.seats}, ${g.side}, ${g.table_no})
      RETURNING code, name`;
    console.log(`  ${row.name.padEnd(16)} /invite/${row.code}`);
  }
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
