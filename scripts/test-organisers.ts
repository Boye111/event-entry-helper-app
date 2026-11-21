/**
 * Organiser isolation, helpers and super admin tests against a running server.
 *   npm run test:organisers            (uses http://localhost:3000; super admin = ADMIN_PASSWORD from .env)
 * Creates two organisers through invite links, checks neither can see or change the other's
 * events, guests or ushers, tests helpers on an event, exercises the super admin tools, then cleans up.
 * Login/sign-up are rate-limited per IP: restart the server to re-run quickly.
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

const cookieOf = (res: Response) => res.headers.get("set-cookie")?.split(";")[0] ?? "";
const send = (method: string, path: string, cookie: string, body?: object) =>
  fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", cookie },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
const post = (p: string, c: string, b?: object) => send("POST", p, c, b);
const get = (p: string, c: string) => send("GET", p, c);

async function login(username: string, password: string) {
  const res = await post("/api/auth/login", "", { username, password });
  return { status: res.status, cookie: cookieOf(res) };
}

async function main() {
  const superRes = await post("/api/auth/admin", "", { password: process.env.ADMIN_PASSWORD });
  if (superRes.status !== 200) throw new Error(`super admin login failed: ${superRes.status}`);
  const SUPER = cookieOf(superRes);
  check("wrong super admin password -> 401", (await post("/api/auth/admin", "", { password: "nope" })).status === 401);
  check("organiser login can't be used with no username -> 400", (await post("/api/auth/login", "", { password: process.env.ADMIN_PASSWORD })).status === 400);

  // --- invites + sign-up
  const mkInvite = async (label: string) =>
    (await (await post("/api/admin/invites", SUPER, { label, days: 7 })).json()).invite as { id: number; token: string };
  const invA = await mkInvite("ZZ test A");
  const invB = await mkInvite("ZZ test B");
  const invX = await mkInvite("ZZ test cancelled");
  check("super admin creates invite links", !!invA?.token && !!invB?.token);

  const stamp = Date.now().toString(36);
  const userA = `zz-a-${stamp}`, userB = `zz-b-${stamp}`;
  const signup = (token: string, username: string) =>
    post("/api/auth/signup", "", { token, username, email: `${username}@example.com`, password: "password-123" });

  check("sign-up without a valid token -> 400", (await signup("not-a-token", `zz-x-${stamp}`)).status === 400);
  const sA = await signup(invA.token, userA);
  check("organiser A signs up with invite", sA.status === 201, sA.status);
  const A = cookieOf(sA);
  check("same invite can't be used twice -> 410", (await signup(invA.token, `zz-c-${stamp}`)).status === 410);
  check("taken username -> 409 and invite stays usable", (await signup(invB.token, userA)).status === 409);
  const sB = await signup(invB.token, userB);
  check("organiser B signs up", sB.status === 201, sB.status);
  const B = cookieOf(sB);
  check("cancel invite", (await send("DELETE", `/api/admin/invites/${invX.id}`, SUPER)).status === 200);
  check("cancelled invite can't be used -> 410", (await signup(invX.token, `zz-d-${stamp}`)).status === 410);
  const signupPage = await (await get(`/signup/${invA.token}`, "")).text();
  check("used invite page says it's used", signupPage.includes("already been used"));

  // --- A builds an event
  const ev = (await (await post("/api/org/events", A, { name: "ZZ A's party", type: "birthday" })).json()).event;
  const guest = (await (await post(`/api/org/events/${ev.id}/guests`, A, { name: "Guest One", seats: 2 })).json()).guest;
  const usher = (await (await post(`/api/org/events/${ev.id}/ushers`, A, { name: "Usher A" })).json()).usher;
  check("A creates event, guest, usher", !!ev?.id && !!guest?.id && !!usher?.id);

  // --- deleting guests: one, selected, and other events' ids are ignored
  const addGuest = async (name: string) =>
    (await (await post(`/api/org/events/${ev.id}/guests`, A, { name, seats: 1 })).json()).guest as { id: number };
  const [g2, g3, g4] = [await addGuest("Del 1"), await addGuest("Del 2"), await addGuest("Del 3")];
  check("owner deletes one guest", (await send("DELETE", `/api/org/guests/${g2.id}`, A)).status === 200);
  const bulk = await (await post(`/api/org/events/${ev.id}/guests/delete`, A, { ids: [g3.id, g4.id] })).json();
  check("owner deletes selected guests", bulk.deleted === 2, bulk);
  check("bulk delete with nothing chosen -> 400", (await post(`/api/org/events/${ev.id}/guests/delete`, A, {})).status === 400);

  // --- B can't see or touch any of it (always 404, never data)
  const bList = (await (await get("/api/org/events", B)).json()).events as { id: number }[];
  check("B's event list doesn't include A's event", Array.isArray(bList) && !bList.some((e) => e.id === ev.id));
  const aList = (await (await get("/api/org/events", A)).json()).events as { id: number }[];
  check("A's event list includes it", aList.some((e) => e.id === ev.id));

  const guestBody = { name: "Hacked", seats: 1 };
  const attempts: [string, string, string, object?][] = [
    ["GET", `/api/org/events/${ev.id}/guests`, "list guests"],
    ["POST", `/api/org/events/${ev.id}/guests`, "add guest", guestBody],
    ["POST", `/api/org/events/${ev.id}/import`, "import guests", { rows: [guestBody] }],
    ["GET", `/api/org/events/${ev.id}/export`, "export CSV"],
    ["GET", `/api/org/events/${ev.id}/ushers`, "list ushers"],
    ["POST", `/api/org/events/${ev.id}/ushers`, "add usher", { name: "x" }],
    ["PATCH", `/api/org/events/${ev.id}`, "edit event", { name: "Hacked", type: "wedding" }],
    ["DELETE", `/api/org/events/${ev.id}/photo`, "delete photo"],
    ["DELETE", `/api/org/events/${ev.id}`, "delete event"],
    ["PATCH", `/api/org/guests/${guest.id}`, "edit guest", guestBody],
    ["POST", `/api/org/guests/${guest.id}/undo`, "undo check-in"],
    ["DELETE", `/api/org/guests/${guest.id}`, "delete guest"],
    ["POST", `/api/org/events/${ev.id}/guests/delete`, "bulk delete selected guests", { ids: [guest.id] }],
    ["POST", `/api/org/events/${ev.id}/guests/delete`, "delete all guests", { all: true }],
    ["PATCH", `/api/org/ushers/${usher.id}`, "turn off usher", { active: false }],
    ["POST", `/api/org/ushers/${usher.id}/reset`, "reset usher"],
    ["DELETE", `/api/org/ushers/${usher.id}`, "delete usher"],
  ];
  for (const [method, path, what, body] of attempts) {
    const res = await send(method, path, B, body);
    check(`B can't ${what} on A's event -> 404`, res.status === 404, res.status);
  }
  const photoForm = new FormData();
  photoForm.append("photo", new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])]), "x.jpg");
  const photo = await fetch(`${BASE}/api/org/events/${ev.id}/photo`, { method: "POST", headers: { cookie: B }, body: photoForm });
  check("B can't upload A's photo -> 404", photo.status === 404, photo.status);

  const bCheckin = await (await post("/api/checkin", B, { code: guest.code, eventId: ev.id })).json().catch(() => ({}));
  check("B can't check in A's guest", bCheckin.status !== "admitted", bCheckin);
  check("B can't search A's guests", (await get(`/api/guests/search?event=${ev.id}&q=Guest`, B)).status === 400);
  check("B can't read A's stats", (await get(`/api/stats?event=${ev.id}`, B)).status === 400);
  for (const page of ["", "/ushers", "/details", "/team"]) {
    check(`B gets 404 on A's page /dashboard/events/${ev.id}${page}`, (await get(`/dashboard/events/${ev.id}${page}`, B)).status === 404);
  }
  const scanPage = await get(`/scan?event=${ev.id}`, B);
  check("B's scanner refuses A's event", scanPage.status === 307, scanPage.status);
  const after = (await (await get(`/api/org/events/${ev.id}/guests`, A)).json()).guests as { name: string }[];
  check("A's data is unchanged", after.length === 1 && after[0].name === "Guest One", after);

  // --- organisers can't use super admin tools
  const superAsOrg = await get("/admin", A);
  check("organiser can't open /admin (sent to admin login)", superAsOrg.status === 307 && (superAsOrg.headers.get("location") ?? "").includes("/admin/login"));
  check("organiser can't list invites -> 403", (await get("/api/admin/invites", A)).status === 403);
  check("organiser can't create invites -> 403", (await post("/api/admin/invites", A, { label: "x" })).status === 403);

  // --- super admin sees and manages everything
  const superPage = await (await get("/admin", SUPER)).text();
  check("super admin page lists A's event and both organisers", superPage.includes("ZZ A") && superPage.includes(userA) && superPage.includes(userB));
  check("super admin can open A's event", (await get(`/api/org/events/${ev.id}/guests`, SUPER)).status === 200);
  check("organiser can't list organisers -> 403", (await get("/api/admin/organisers", A)).status === 403);

  // move A's event to B
  const bId = await organiserId(SUPER, userB);
  const aId = await organiserId(SUPER, userA);
  check("found organiser ids", !!aId && !!bId, { aId, bId });
  check("super admin moves the event to B", (await send("PATCH", `/api/admin/events/${ev.id}`, SUPER, { organiserId: bId })).status === 200);
  check("B now sees it", (await get(`/api/org/events/${ev.id}/guests`, B)).status === 200);
  check("A no longer does", (await get(`/api/org/events/${ev.id}/guests`, A)).status === 404);

  // turn off / on
  check("turn off A", (await send("PATCH", `/api/admin/organisers/${aId}`, SUPER, { active: false })).status === 200);
  check("A's open session stops working at once -> 401", (await get("/api/org/events", A)).status === 401);
  check("A can't log in while off -> 403", (await login(userA, "password-123")).status === 403);
  check("turn A back on", (await send("PATCH", `/api/admin/organisers/${aId}`, SUPER, { active: true })).status === 200);
  const aAgain = await login(userA, "password-123");
  check("A can log in again", aAgain.status === 200);

  // password reset
  const reset = await (await post(`/api/admin/organisers/${aId}/password`, SUPER)).json();
  check("reset gives a temporary password", typeof reset.password === "string" && reset.password.length >= 8, reset);
  check("reset logs A out", (await get("/api/org/events", aAgain.cookie)).status === 401);
  check("old password no longer works", (await login(userA, "password-123")).status === 401);
  const aTemp = await login(userA, reset.password);
  check("temporary password works", aTemp.status === 200);

  // --- helpers: B (now owner of the event) invites a helper
  const hInv = (await (await post(`/api/org/events/${ev.id}/team`, B, { label: "ZZ helper" })).json()).invite;
  check("owner creates a helper invite", !!hInv?.token);
  check("other organiser can't create helper invites -> 404", (await post(`/api/org/events/${ev.id}/team`, aTemp.cookie, { label: "x" })).status === 404);
  const helperPage = await (await get(`/signup/${hInv.token}`, "")).text();
  check("helper invite page names the event", helperPage.includes("ZZ A") && helperPage.includes("help run"));
  const userH = `zz-h-${stamp}`;
  const sH = await signup(hInv.token, userH);
  check("helper signs up", sH.status === 201, sH.status);
  const H = cookieOf(sH);
  const hList = (await (await get("/api/org/events", H)).json()).events as { id: number; access: string }[];
  check("helper sees the event, marked as helper", hList.length === 1 && hList[0].id === ev.id && hList[0].access === "helper", hList);
  check("helper can add guests", (await post(`/api/org/events/${ev.id}/guests`, H, { name: "Added by helper", seats: 1 })).status === 201);
  check("helper can see ushers", (await get(`/api/org/events/${ev.id}/ushers`, H)).status === 200);
  check("helper can use the scanner API", (await get(`/api/stats?event=${ev.id}`, H)).status === 200);
  check("helper can open the event page", (await get(`/dashboard/events/${ev.id}`, H)).status === 200);
  check("helper can't delete the event -> 403", (await send("DELETE", `/api/org/events/${ev.id}`, H)).status === 403);
  check("helper can't invite more helpers -> 403", (await post(`/api/org/events/${ev.id}/team`, H, { label: "x" })).status === 403);
  check("helper can't create events -> 403", (await post("/api/org/events", H, { name: "x", type: "wedding" })).status === 403);
  check("helper's new-event page sends them back", (await get("/dashboard/events/new", H)).status === 307);
  check("helper invite can't be reused", (await signup(hInv.token, `zz-h2-${stamp}`)).status === 410);
  check("helper can't see A's other things", (await get("/api/admin/organisers", H)).status === 403);
  // existing account joins with a second invite
  const hInv2 = (await (await post(`/api/org/events/${ev.id}/team`, B, { label: "ZZ A joins" })).json()).invite;
  const aJoin = await post("/api/auth/join", aTemp.cookie, { token: hInv2.token });
  check("existing account joins with a helper invite", aJoin.status === 200, aJoin.status);
  check("A can now work on the event again (as helper)", (await get(`/api/org/events/${ev.id}/guests`, aTemp.cookie)).status === 200);
  const hInv3 = (await (await post(`/api/org/events/${ev.id}/team`, B, { label: "ZZ owner" })).json()).invite;
  check("owner can't join own event as helper -> 409", (await post("/api/auth/join", B, { token: hInv3.token })).status === 409);
  const hId = await organiserId(SUPER, userH);
  check("owner removes the helper", (await send("DELETE", `/api/org/events/${ev.id}/team/${hId}`, B)).status === 200);
  check("removed helper loses access -> 404", (await get(`/api/org/events/${ev.id}/guests`, H)).status === 404);
  check("super admin can make a helper an organiser", (await send("PATCH", `/api/admin/organisers/${hId}`, SUPER, { role: "organiser" })).status === 200);
  check("now they can create events", (await post("/api/org/events", H, { name: "ZZ H's own", type: "wedding" })).status === 201);
  check("delete helper account", (await send("DELETE", `/api/admin/organisers/${hId}`, SUPER)).status === 200);

  // --- super admin deletes guests and events
  const superAll = await (await post(`/api/org/events/${ev.id}/guests/delete`, SUPER, { all: true })).json();
  check("super admin can delete all guests of an event", superAll.deleted >= 1, superAll);
  check("guest list is now empty", ((await (await get(`/api/org/events/${ev.id}/guests`, SUPER)).json()).guests ?? [1]).length === 0);
  check("organiser can't use the no-owner clean-up -> 403", (await post("/api/admin/events/unowned", B, { confirm: "DELETE" })).status === 403);
  check("no-owner clean-up needs DELETE typed -> 400", (await post("/api/admin/events/unowned", SUPER, {})).status === 400);
  check("super admin deletes the event", (await send("DELETE", `/api/org/events/${ev.id}`, SUPER)).status === 200);
  check("deleted event is gone for its owner", (await get(`/api/org/events/${ev.id}/guests`, B)).status === 404);

  // --- cleanup: deleting organisers deletes their events
  check("delete A", (await send("DELETE", `/api/admin/organisers/${aId}`, SUPER)).status === 200);
  check("delete B", (await send("DELETE", `/api/admin/organisers/${bId}`, SUPER)).status === 200);
  check("B's event is gone", (await get(`/api/org/events/${ev.id}/guests`, SUPER)).status === 404);
  const inviteOk = await (await get(`/invite/${guest.code}`, "")).text();
  check("its invite link stops working", inviteOk.includes("not found") || inviteOk.includes("Not found"));

  console.log(failures ? `\n${failures} FAILED` : "\nAll passed.");
  process.exit(failures ? 1 : 0);
}

/** Organiser id by username, read from the super admin page's organiser API. */
async function organiserId(cookie: string, username: string): Promise<number | null> {
  const res = await get("/api/admin/organisers", cookie);
  const list = (await res.json().catch(() => ({}))).organisers as { id: number; username: string }[] | undefined;
  return list?.find((o) => o.username === username)?.id ?? null;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
