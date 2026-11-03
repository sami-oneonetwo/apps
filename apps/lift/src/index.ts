import { DurableObject } from "cloudflare:workers";
import { init, parseSyncBody, sync, type Change, type SyncResult } from "./sync";
import { identify } from "./access";
import { applyCoach, askClaude, buildUserPrompt, DEFAULT_MODEL, SYSTEM_PROMPT, type Snapshot, type Trigger } from "./coach";

interface LiftEnv {
  ASSETS: Fetcher;
  LIFT_STORE: DurableObjectNamespace<LiftStore>;
  ANTHROPIC_API_KEY?: string;
  COACH_MODEL?: string;
}

const WEEKS_OF_HISTORY = 10;

/** All of one user's data: a single SQLite database inside a Durable Object. */
export class LiftStore extends DurableObject<LiftEnv> {
  constructor(ctx: DurableObjectState, env: LiftEnv) {
    super(ctx, env);
    init(ctx.storage.sql);
  }

  sync(cursor: number, changes: Change[]): SyncResult {
    return this.ctx.storage.transactionSync(() => sync(this.ctx.storage.sql, cursor, changes));
  }

  /** Current records the coach needs. */
  snapshot(now: number): Snapshot {
    const rows = this.ctx.storage.sql
      .exec(`SELECT kind, data FROM records WHERE deleted = 0 AND kind IN ('settings','program','exercise','workout','coachlog')`)
      .toArray();
    const snap: Snapshot = { settings: {}, programs: [], exercises: [], workouts: [], coachlogs: [] };
    const since = now - WEEKS_OF_HISTORY * 7 * 86400000;
    for (const r of rows) {
      const d = JSON.parse(String(r.data));
      if (r.kind === "settings" && d.id === "main") snap.settings = d;
      else if (r.kind === "program") snap.programs.push(d);
      else if (r.kind === "exercise") snap.exercises.push(d);
      else if (r.kind === "workout" && d.finishedAt && d.startedAt >= since) snap.workouts.push(d);
      else if (r.kind === "coachlog") snap.coachlogs.push(d);
    }
    return snap;
  }

  /** Write records (last-write-wins like any other sync). */
  write(changes: Change[]): number {
    return this.ctx.storage.transactionSync(() => sync(this.ctx.storage.sql, Number.MAX_SAFE_INTEGER, changes).applied);
  }
}

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });

async function runCoach(env: LiftEnv, store: DurableObjectStub<LiftStore>, trigger: Trigger, request: string) {
  const now = Date.now();
  const snap = await store.snapshot(now);
  const out = await askClaude(env.ANTHROPIC_API_KEY!, env.COACH_MODEL || DEFAULT_MODEL, SYSTEM_PROMPT, buildUserPrompt(snap, trigger, request, now));
  const { writes, log } = applyCoach(snap, out, { trigger, request, now, logId: `coach-${now.toString(36)}` });
  await store.write(writes);
  return log;
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);

    const who = await identify(request, url);
    if (!who.email) {
      console.log("auth failed", who.reason, [...request.headers.keys()].filter((k) => /^cf-|cookie/i.test(k)));
      return json({ error: "no_identity", message: `Couldn't confirm who you are (${who.reason}).` }, 401);
    }
    const user = who.email;
    const store = env.LIFT_STORE.get(env.LIFT_STORE.idFromName(user));

    if (url.pathname === "/api/me" && request.method === "GET") {
      return json({ email: user, coach: !!env.ANTHROPIC_API_KEY });
    }

    if (url.pathname === "/api/sync" && request.method === "POST") {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return json({ error: "Body must be JSON" }, 400);
      }
      const input = parseSyncBody(body);
      if (typeof input === "string") return json({ error: input }, 400);
      return json(await store.sync(input.cursor, input.changes));
    }

    if (url.pathname === "/api/coach" && request.method === "POST") {
      if (!env.ANTHROPIC_API_KEY) return json({ error: "no_key", message: "The coach needs an ANTHROPIC_API_KEY secret on this Worker." }, 503);
      const body = (await request.json().catch(() => ({}))) as { trigger?: string; message?: string };
      const trigger = (["session", "ask", "new-block"].includes(body.trigger ?? "") ? body.trigger : "ask") as Trigger;
      const message = String(body.message ?? "").slice(0, 2000);
      // Keep running even if the phone locks or leaves the page mid-request.
      const work = runCoach(env, store, trigger, message);
      ctx.waitUntil(work.catch(() => {}));
      try {
        return json({ log: await work });
      } catch (e) {
        return json({ error: "coach_failed", message: e instanceof Error ? e.message : String(e) }, 502);
      }
    }

    return json({ error: "Not found" }, 404);
  },
} satisfies ExportedHandler<LiftEnv>;
