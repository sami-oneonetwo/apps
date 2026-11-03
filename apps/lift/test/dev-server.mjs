// Local stand-in for the Worker: serves public/ and runs the real sync logic
// over node:sqlite. Used by the browser tests; `npm run dev` (wrangler) is the
// real local runtime.
//   node --experimental-strip-types test/dev-server.mjs [port] [dbfile]
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { memorySql } from "./sqlite-adapter.mjs";
import { init, sync, parseSyncBody } from "../src/sync.ts";
import { applyCoach, askClaude, buildUserPrompt, SYSTEM_PROMPT, DEFAULT_MODEL } from "../src/coach.ts";

const root = fileURLToPath(new URL("../public/", import.meta.url));
const port = +(process.argv[2] || 8788);
const sql = memorySql(process.argv[3] || ":memory:");
init(sql);
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json", ".json": "application/json" };

// COACH=off simulates a Worker without an API key; otherwise a scripted stand-in
// coach answers (or the real API if ANTHROPIC_API_KEY is set).
const COACH = process.env.COACH || "fake";
function snapshot(now) {
  const snap = { settings: {}, programs: [], exercises: [], workouts: [], coachlogs: [] };
  for (const r of sql.exec("SELECT kind, data FROM records WHERE deleted = 0").toArray()) {
    const d = JSON.parse(r.data);
    if (r.kind === "settings") snap.settings = d;
    else if (r.kind === "program") snap.programs.push(d);
    else if (r.kind === "exercise") snap.exercises.push(d);
    else if (r.kind === "workout" && d.finishedAt) snap.workouts.push(d);
    else if (r.kind === "coachlog") snap.coachlogs.push(d);
  }
  return snap;
}
const EMPTY = { summary: "No changes", message: "", next_session: { key: "", reason: "" }, item_changes: [], new_exercises: [], new_block: { create: false, name: "", rationale: "", phases: [], priorities: [], targets: [], sessions: [] } };
function fakeCoach(snap, trigger, message) {
  const p = snap.programs.find((x) => x.status === "active");
  if (trigger === "session") return { ...EMPTY, message: "Good first session. Weights look sensible for calibration; keep the calf work slow." };
  if (trigger === "new-block") return { ...EMPTY, summary: "New block", message: "Block 2 is ready.", new_block: { create: true, name: "Block 2: Build", rationale: "More chest volume.", phases: ["build", "build", "build", "deload"], priorities: ["chest", "glutes"], targets: [{ muscle: "chest", sets: 14 }, { muscle: "glutes", sets: 12 }],
    sessions: p.sessions.map((s) => ({ key: s.key, name: s.name, focus: s.focus, items: s.items.filter((i) => i.role !== "rehab").map((i) => ({ exercise_id: i.exerciseId, sets: i.sets, rep_min: i.repMin, rep_max: i.repMax, rest_sec: i.restSec, role: i.role, note: i.note })) })) } };
  if (/fly/i.test(message)) return { ...EMPTY, summary: "Swapped cable fly for pec deck", message: "Done: pec deck instead of cable fly in Squat + chest.",
    item_changes: [{ session_key: "A", item_key: "ex-cable-fly", exercise_id: "ex-pec-deck", sets: 3, rep_min: 12, rep_max: 15, rest_sec: 60, note: "", reason: "The cable station is always busy." }],
    next_session: { key: "C", reason: "You asked to do the pressing day next." } };
  return { ...EMPTY, message: "Noted." };
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const send = (status, body, type = "application/json") => { res.writeHead(status, { "content-type": type, "cache-control": "no-store" }); res.end(body); };
  // ACCESS=1 imitates Cloudflare Access: no CF_Authorization cookie → redirect to a login page.
  if (process.env.ACCESS && !url.pathname.startsWith("/fake-access")) {
    const authed = /(?:^|;\s*)CF_Authorization=ok/.test(req.headers.cookie || "");
    if (!authed) { res.writeHead(302, { location: `/fake-access/login?redirect_url=${encodeURIComponent(url.pathname + url.search)}` }); return res.end(); }
  }
  if (url.pathname === "/fake-access/login") return send(200, `<!doctype html><h1 id="access-login">Sign in to Lift</h1><a id="go" href="/fake-access/callback?r=${encodeURIComponent(url.searchParams.get("redirect_url") || "/")}">Continue</a>`, "text/html");
  if (url.pathname === "/fake-access/callback") { res.writeHead(302, { "set-cookie": "CF_Authorization=ok; Path=/", location: url.searchParams.get("r") || "/" }); return res.end(); }
  if (process.env.NOIDENT && url.pathname === "/api/sync") return send(401, JSON.stringify({ error: "no_identity", message: "Couldn't confirm who you are (no Access identity on the request)." }));
  if (url.pathname === "/api/me") return send(200, JSON.stringify({ email: "local@dev", coach: COACH !== "off" }));
  if (url.pathname === "/api/coach" && req.method === "POST") {
    if (COACH === "off") return send(503, JSON.stringify({ error: "no_key", message: "The coach needs an ANTHROPIC_API_KEY secret on this Worker." }));
    let raw = ""; for await (const c of req) raw += c;
    const { trigger = "ask", message = "" } = JSON.parse(raw || "{}");
    const now = Date.now();
    const snap = snapshot(now);
    try {
      const out = process.env.ANTHROPIC_API_KEY
        ? await askClaude(process.env.ANTHROPIC_API_KEY, process.env.COACH_MODEL || DEFAULT_MODEL, SYSTEM_PROMPT, buildUserPrompt(snap, trigger, message, now))
        : fakeCoach(snap, trigger, message);
      const { writes, log } = applyCoach(snap, out, { trigger, request: message, now, logId: `coach-${now.toString(36)}` });
      sync(sql, Number.MAX_SAFE_INTEGER, writes);
      return send(200, JSON.stringify({ log }));
    } catch (e) { return send(502, JSON.stringify({ error: "coach_failed", message: e.message })); }
  }
  if (url.pathname === "/api/sync" && req.method === "POST") {
    let raw = ""; for await (const c of req) raw += c;
    let body; try { body = JSON.parse(raw); } catch { return send(400, '{"error":"Body must be JSON"}'); }
    const input = parseSyncBody(body);
    if (typeof input === "string") return send(400, JSON.stringify({ error: input }));
    return send(200, JSON.stringify(sync(sql, input.cursor, input.changes)));
  }
  if (url.pathname.startsWith("/api/")) return send(404, '{"error":"Not found"}');
  let p = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  if (p.endsWith("/")) p += "index.html";
  try {
    const buf = await readFile(join(root, p));
    send(200, buf, TYPES[extname(p)] || "application/octet-stream");
  } catch {
    send(200, await readFile(join(root, "index.html")), "text/html");
  }
}).listen(port, () => console.log(`lift dev server on http://127.0.0.1:${port}`));
