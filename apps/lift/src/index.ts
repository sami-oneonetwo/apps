import { DurableObject } from "cloudflare:workers";
import { init, parseSyncBody, sync, type Change, type SyncResult } from "./sync";

interface LiftEnv {
  ASSETS: Fetcher;
  LIFT_STORE: DurableObjectNamespace<LiftStore>;
}

/** All of one user's data: a single SQLite database inside a Durable Object. */
export class LiftStore extends DurableObject<LiftEnv> {
  constructor(ctx: DurableObjectState, env: LiftEnv) {
    super(ctx, env);
    init(ctx.storage.sql);
  }

  sync(cursor: number, changes: Change[]): SyncResult {
    return this.ctx.storage.transactionSync(() => sync(this.ctx.storage.sql, cursor, changes));
  }
}

/** The signed-in user. Cloudflare Access sets this header; locally there is no Access. */
function userFor(request: Request, url: URL): string | null {
  const email = request.headers.get("cf-access-authenticated-user-email");
  if (email) return email.toLowerCase();
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return "local@dev";
  return null;
}

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);

    const user = userFor(request, url);
    if (!user) return json({ error: "Sign in through Cloudflare Access" }, 401);

    if (url.pathname === "/api/me" && request.method === "GET") {
      return json({ email: user });
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
      const store = env.LIFT_STORE.get(env.LIFT_STORE.idFromName(user));
      return json(await store.sync(input.cursor, input.changes));
    }

    return json({ error: "Not found" }, 404);
  },
} satisfies ExportedHandler<LiftEnv>;
