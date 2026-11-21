/**
 * End-to-end tests against a running server (npm run dev).
 *   npm run test:checkin            (uses http://localhost:3000)
 *   BASE_URL=https://x.vercel.app npm run test:checkin
 * Logs in as super admin (ADMIN_PASSWORD from .env), makes a throwaway organiser through an invite link,
 * creates two events (with guests + ushers) as that organiser, then deletes everything again.
 * Note: usher logins are rate-limited (10 / 15 min per IP); restart the dev server to re-run quickly.
 */
import "dotenv/config";

const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
let failures = 0;

function check(label: string, cond: boolean, extra?: unknown) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) {
    failures++;
    if (extra !== undefined) console.log("      ", JSON.stringify(extra));
  }
}

async function login(path: string, body: object): Promise<string> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`login ${path} failed: ${res.status} ${await res.text()}`);
  return res.headers.get("set-cookie")!.split(";")[0];
}

const send = (method: string, path: string, cookie: string, body?: object) =>
  fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", cookie },
    body: body ? JSON.stringify(body) : undefined,
  });
const post = (path: string, cookie: string, body?: object) => send("POST", path, cookie, body);
const get = (path: string, cookie = "") => fetch(`${BASE}${path}`, { headers: { cookie } });

type Ev = { id: number; name: string };
type G = { id: number; code: string };
type U = { id: number; token: string; pin: string };

async function main() {
  // --- auth guards
  check("POST /api/checkin without login -> 401", (await post("/api/checkin", "", { code: "x" })).status === 401);
  check("GET /api/headcount without login -> 401", (await get("/api/headcount")).status === 401);
  check("GET /api/org/events without login -> 401", (await get("/api/org/events")).status === 401);
  const adminPage = await fetch(`${BASE}/dashboard`, { redirect: "manual" });
  check("/dashboard without login redirects", adminPage.status === 307 || adminPage.status === 308);
  const superPage = await fetch(`${BASE}/admin`, { redirect: "manual" });
  check("/admin without login redirects", superPage.status === 307 || superPage.status === 308);
  const scanPage = await fetch(`${BASE}/scan`, { redirect: "manual" });
  check("/scan without login redirects", scanPage.status === 307 || scanPage.status === 308);

  const SUPER = await login("/api/auth/admin", { password: process.env.ADMIN_PASSWORD });
  const invite = (await (await post("/api/admin/invites", SUPER, { label: "ZZ check-in test", days: 1 })).json()).invite;
  const orgName = `zz-checkin-${Date.now().toString(36)}`;
  const admin = await login("/api/auth/signup", {
    token: invite.token,
    username: orgName,
    email: `${orgName}@example.com`,
    password: "password-123",
  });

  // --- events are saved and listed
  const mkEvent = async (name: string, type = "wedding") =>
    (await (await post("/api/org/events", admin, { name, type, hosts: "Test & Test", venue: "Test Hall" })).json())
      .event as Ev;
  const evA = await mkEvent("ZZ Test Wedding A");
  const evB = await mkEvent("ZZ Test Birthday B", "birthday");
  check("create event returns an id", Number.isInteger(evA?.id) && Number.isInteger(evB?.id), { evA, evB });
  const badType = await post("/api/org/events", admin, { name: "x", type: "rave" });
  check("unknown event type -> 400", badType.status === 400);
  const patched = await send("PATCH", `/api/org/events/${evA.id}`, admin, {
    name: "ZZ Test Wedding A (edited)",
    type: "wedding",
    hosts: "Ada & Obi",
    event_date: "2026-12-24T14:00:00.000Z",
    venue: "Test Hall",
  });
  check("PATCH event -> 200", patched.status === 200);
  const listed = (await (await get("/api/org/events", admin)).json()).events as (Ev & { hosts: string })[];
  const savedA = listed.find((e) => e.id === evA.id);
  check("edited event is saved and listed", savedA?.name === "ZZ Test Wedding A (edited)" && savedA?.hosts === "Ada & Obi", savedA);

  try {
    // --- ushers belong to event A
    const mkUsher = async (name: string) =>
      (await (await post(`/api/org/events/${evA.id}/ushers`, admin, { name })).json()).usher as U;
    const uA = await mkUsher("Test – Gate A");
    const uB = await mkUsher("Test – Gate B");
    const uC = await mkUsher("Test – Gate C");
    const tryUsher = (token: string, pin: string) =>
      fetch(`${BASE}/api/auth/usher`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, pin }),
      });
    const wrongPin = uA.pin === "000000" ? "111111" : "000000";
    check("usher link + wrong PIN -> 401", (await tryUsher(uA.token, wrongPin)).status === 401);
    check("unknown usher link -> 401", (await tryUsher("abcdefghjkmnpqrs", uA.pin)).status === 401);
    const joinPage = await fetch(`${BASE}/scan/join/${uA.token}`, { redirect: "manual" });
    check("usher join page is reachable without login", joinPage.status === 200, joinPage.status);
    check("join page names the event", (await joinPage.text()).includes("ZZ Test Wedding A"));

    const usherA = await login("/api/auth/usher", { token: uA.token, pin: uA.pin });
    const usherB = await login("/api/auth/usher", { token: uB.token, pin: uB.pin });
    const usherC = await login("/api/auth/usher", { token: uC.token, pin: uC.pin });
    check("usher cannot list events -> 403", (await get("/api/org/events", usherA)).status === 403);
    check("usher cannot list guests -> 403", (await get(`/api/org/events/${evA.id}/guests`, usherA)).status === 403);

    const statsAs = (cookie: string, q = "") => get(`/api/headcount${q}`, cookie).then((r) => r.status);
    check("usher C can use the scanner API", (await statsAs(usherC)) === 200);
    await send("PATCH", `/api/org/ushers/${uC.id}`, admin, { active: false });
    check("turned-off usher is logged out immediately -> 401", (await statsAs(usherC)) === 401);
    check("turned-off usher cannot log in", (await tryUsher(uC.token, uC.pin)).status === 401);
    await send("PATCH", `/api/org/ushers/${uC.id}`, admin, { active: true });
    check("turning back on does NOT revive the old session", (await statsAs(usherC)) === 401);
    const usherC2 = await login("/api/auth/usher", { token: uC.token, pin: uC.pin });
    await post(`/api/org/ushers/${uC.id}/reset`, admin);
    check("new link & PIN logs the usher out", (await statsAs(usherC2)) === 401);
    check("old link stops working after reset", (await tryUsher(uC.token, uC.pin)).status === 401);

    // --- guests (with email) belong to one event
    const mk = async (ev: Ev, name: string, email?: string) => {
      const res = await post(`/api/org/events/${ev.id}/guests`, admin, { name, seats: 2, email });
      return (await res.json()).guest as G & { email: string | null; event_id: number };
    };
    const g1 = await mk(evA, "ZZ Test Single", "Single@Example.com");
    const g2 = await mk(evA, "ZZ Test Race");
    const g3 = await mk(evB, "ZZ Test Other Event");
    check("guest email saved (lower-cased)", g1.email === "single@example.com", g1.email);
    check("guest is linked to its event", g1.event_id === evA.id && g3.event_id === evB.id);
    const badEmail = await post(`/api/org/events/${evA.id}/guests`, admin, { name: "x", seats: 1, email: "nope" });
    check("bad email -> 400", badEmail.status === 400);
    const noEvent = await post(`/api/org/events/999999/guests`, admin, { name: "x", seats: 1 });
    check("adding a guest to a missing event -> 404", noEvent.status === 404);
    const imp = await post(`/api/org/events/${evB.id}/import`, admin, {
      rows: [{ name: "ZZ Imported", phone: "08031234567", email: "imp@example.com", seats: "1" }],
    });
    check("import into event B", (await imp.json()).imported === 1);
    const listB = (await (await get(`/api/org/events/${evB.id}/guests`, admin)).json()).guests as G[];
    const listA = (await (await get(`/api/org/events/${evA.id}/guests`, admin)).json()).guests as G[];
    check("guest lists are separate per event", listA.length === 2 && listB.length === 2, [listA.length, listB.length]);
    const csv = await (await get(`/api/org/events/${evA.id}/export`, admin)).text();
    check("CSV export has email column", csv.includes("email") && csv.includes("single@example.com"));

    // --- invite page + previews (read-only)
    const invite = await (await get(`/invite/${g1.code}`)).text();
    check("invite page shows the event title", invite.includes("Ada &amp; Obi") || invite.includes("Ada & Obi"));
    check("invite page has a WhatsApp preview image tag", invite.includes(`/api/og/${g1.code}`));
    const og = await get(`/api/og/${g1.code}`);
    const ogBytes = (await og.arrayBuffer()).byteLength;
    check(`preview image is a small JPEG (${Math.round(ogBytes / 1024)} KB < 300 KB)`,
      og.status === 200 && og.headers.get("content-type") === "image/jpeg" && ogBytes < 300_000);
    check("invite card renders", (await get(`/api/card/${g1.code}`)).status === 200);
    for (let i = 0; i < 3; i++) await get(`/invite/${g1.code}`);

    // --- first scan admits (full URL like the QR contains), second is already_used
    const r1 = await (await post("/api/checkin", usherA, { code: `${BASE}/invite/${g1.code}` })).json();
    check("first scan (after invite views) -> admitted", r1.status === "admitted", r1);
    check("checkedInBy is usher name", r1.checkedInBy === "Test – Gate A", r1.checkedInBy);
    const r2 = await (await post("/api/checkin", usherB, { code: g1.code })).json();
    check("second scan -> already_used", r2.status === "already_used", r2);
    check("already_used reports original usher + time",
      r2.checkedInBy === "Test – Gate A" && r2.checkedInAt === r1.checkedInAt, r2);

    // --- other event's QR is rejected, and leaks nothing
    const r6 = await (await post("/api/checkin", usherA, { code: g3.code, eventId: evB.id })).json();
    check("usher of A scanning B's guest -> wrong_event (eventId in body ignored)", r6.status === "wrong_event", r6);
    check("wrong_event reveals no guest data", !("guest" in r6));
    const searchA = (await (await get(`/api/guests/search?q=ZZ%20Test%20Other&event=${evB.id}`, usherA)).json()).guests;
    check("usher search only sees own event", Array.isArray(searchA) && searchA.length === 0, searchA);
    const statsA = await (await get(`/api/headcount?event=${evB.id}`, usherA)).json();
    check("usher stats are for own event", statsA.guests === 2, statsA);

    // --- admin scanning needs an event, and only admits that event's guests
    check("admin check-in without event -> 400", (await post("/api/checkin", admin, { code: g3.code })).status === 400);
    const r7 = await (await post("/api/checkin", admin, { code: g3.code, eventId: evA.id })).json();
    check("admin scanning for A with B's guest -> wrong_event", r7.status === "wrong_event", r7);
    const r8 = await (await post("/api/checkin", admin, { code: g3.code, eventId: evB.id })).json();
    check("admin scanning for B -> admitted", r8.status === "admitted", r8);

    // --- invalid codes
    const r3 = await (await post("/api/checkin", usherA, { code: "abcdefghjkm" })).json();
    check("unknown well-formed code -> invalid", r3.status === "invalid", r3);
    const r4 = await (await post("/api/checkin", usherA, { code: "'; DROP TABLE guests; --" })).json();
    check("garbage code -> invalid", r4.status === "invalid", r4);

    // --- concurrency: 20 parallel scans from two gates, exactly one admitted
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        post("/api/checkin", i % 2 ? usherA : usherB, { code: g2.code }).then((r) => r.json()),
      ),
    );
    const admitted = results.filter((r) => r.status === "admitted").length;
    const used = results.filter((r) => r.status === "already_used").length;
    check(`20 parallel scans -> exactly 1 admitted (got ${admitted}, ${used} already_used)`,
      admitted === 1 && used === 19);

    // --- undo check-in then rescan
    await post(`/api/org/guests/${g2.id}/undo`, admin);
    const r5 = await (await post("/api/checkin", usherA, { code: g2.code })).json();
    check("after undo, scan -> admitted again", r5.status === "admitted", r5);

    // --- per-usher admitted count (g1 by A; g2 by A after undo)
    const ushers = (await (await get(`/api/org/events/${evA.id}/ushers`, admin)).json()).ushers as (U & {
      admitted: number;
    })[];
    const countA = ushers.find((u) => u.id === uA.id)?.admitted;
    check("usher A admitted count = 2", countA === 2, countA);
  } finally {
    for (const ev of [evA, evB]) if (ev?.id) await send("DELETE", `/api/org/events/${ev.id}`, admin);
  }
  check("deleting events removes their guests too",
    (await (await get(`/api/org/events/${evA.id}/guests`, admin)).status) === 404);

  // remove the throwaway organiser
  const orgs = (await (await get("/api/admin/organisers", SUPER)).json()).organisers as { id: number; username: string }[];
  const me = orgs.find((o) => o.username === orgName);
  if (me) await send("DELETE", `/api/admin/organisers/${me.id}`, SUPER);

  console.log(failures ? `\n${failures} FAILED` : "\nAll passed.");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
