// Last-write-wins record sync. Pure logic over a minimal SQL interface so it
// runs inside a Durable Object (ctx.storage.sql) and in Node tests (node:sqlite).

export interface SqlLike {
  exec(query: string, ...bindings: unknown[]): { toArray(): Record<string, unknown>[] };
}

export interface Change {
  kind: string;
  id: string;
  updatedAt: number;
  deleted: boolean;
  data: unknown;
}

export interface SyncResult {
  cursor: number;
  changes: Change[];
  applied: number;
  more: boolean;
}

export const KINDS = new Set(["exercise", "routine", "workout", "settings"]);
export const MAX_CHANGES_IN = 2000;
export const PAGE_SIZE = 1000;
const MAX_DATA_BYTES = 256 * 1024;

export function init(sql: SqlLike): void {
  sql.exec(
    `CREATE TABLE IF NOT EXISTS records (
      kind TEXT NOT NULL,
      id TEXT NOT NULL,
      data TEXT,
      updated_at INTEGER NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0,
      seq INTEGER NOT NULL,
      PRIMARY KEY (kind, id)
    )`,
  );
  sql.exec(`CREATE INDEX IF NOT EXISTS records_seq ON records (seq)`);
}

/** Validate an untrusted request body. Returns an error message or the parsed input. */
export function parseSyncBody(body: unknown): { cursor: number; changes: Change[] } | string {
  if (!body || typeof body !== "object") return "body must be a JSON object";
  const b = body as Record<string, unknown>;
  const cursor = b.cursor ?? 0;
  if (typeof cursor !== "number" || !Number.isInteger(cursor) || cursor < 0) return "cursor must be a non-negative integer";
  const raw = b.changes ?? [];
  if (!Array.isArray(raw)) return "changes must be an array";
  if (raw.length > MAX_CHANGES_IN) return `at most ${MAX_CHANGES_IN} changes per request`;
  const changes: Change[] = [];
  for (const [i, c] of raw.entries()) {
    if (!c || typeof c !== "object") return `changes[${i}] must be an object`;
    const { kind, id, updatedAt, deleted, data } = c as Record<string, unknown>;
    if (typeof kind !== "string" || !KINDS.has(kind)) return `changes[${i}].kind is not a known kind`;
    if (typeof id !== "string" || id.length < 1 || id.length > 100) return `changes[${i}].id must be a 1-100 char string`;
    if (typeof updatedAt !== "number" || !Number.isFinite(updatedAt) || updatedAt < 0) return `changes[${i}].updatedAt must be a timestamp`;
    if (JSON.stringify(data ?? null).length > MAX_DATA_BYTES) return `changes[${i}].data is too large`;
    changes.push({ kind, id, updatedAt: Math.floor(updatedAt), deleted: deleted === true, data: data ?? null });
  }
  return { cursor, changes };
}

/** Apply incoming changes (newer updatedAt wins), then return everything after `cursor`. */
export function sync(sql: SqlLike, cursor: number, changes: Change[]): SyncResult {
  let seq = Number(sql.exec(`SELECT COALESCE(MAX(seq), 0) AS s FROM records`).toArray()[0].s);
  let applied = 0;

  for (const c of changes) {
    const existing = sql.exec(`SELECT updated_at FROM records WHERE kind = ? AND id = ?`, c.kind, c.id).toArray()[0];
    if (existing && Number(existing.updated_at) >= c.updatedAt) continue;
    seq += 1;
    sql.exec(
      `INSERT INTO records (kind, id, data, updated_at, deleted, seq) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (kind, id) DO UPDATE SET
         data = excluded.data, updated_at = excluded.updated_at,
         deleted = excluded.deleted, seq = excluded.seq`,
      c.kind, c.id, JSON.stringify(c.data), c.updatedAt, c.deleted ? 1 : 0, seq,
    );
    applied += 1;
  }

  const rows = sql
    .exec(
      `SELECT kind, id, data, updated_at, deleted, seq FROM records WHERE seq > ? ORDER BY seq LIMIT ?`,
      cursor, PAGE_SIZE + 1,
    )
    .toArray();
  const more = rows.length > PAGE_SIZE;
  const page = more ? rows.slice(0, PAGE_SIZE) : rows;

  return {
    cursor: page.length ? Number(page[page.length - 1].seq) : Math.max(cursor, seq),
    more,
    applied,
    changes: page.map((r) => ({
      kind: String(r.kind),
      id: String(r.id),
      updatedAt: Number(r.updated_at),
      deleted: Number(r.deleted) === 1,
      data: r.data == null ? null : JSON.parse(String(r.data)),
    })),
  };
}
