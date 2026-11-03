import { test } from "node:test";
import assert from "node:assert/strict";
import { memorySql } from "./sqlite-adapter.mjs";
import { init, sync, parseSyncBody, PAGE_SIZE } from "../src/sync.ts";

const fresh = () => { const s = memorySql(); init(s); return s; };
const ch = (id, updatedAt, data = { n: id }, extra = {}) => ({ kind: "routine", id, updatedAt, deleted: false, data, ...extra });

test("first sync stores changes and returns them with a cursor", () => {
  const s = fresh();
  const r = sync(s, 0, [ch("a", 10), ch("b", 11)]);
  assert.equal(r.applied, 2);
  assert.equal(r.cursor, 2);
  assert.deepEqual(r.changes.map((c) => c.id), ["a", "b"]);
});

test("pull with an up-to-date cursor returns nothing", () => {
  const s = fresh();
  const { cursor } = sync(s, 0, [ch("a", 10)]);
  const r = sync(s, cursor, []);
  assert.equal(r.changes.length, 0);
  assert.equal(r.cursor, cursor);
});

test("newer write wins, older write is ignored", () => {
  const s = fresh();
  sync(s, 0, [ch("a", 10, { v: 1 })]);
  const stale = sync(s, 1, [ch("a", 5, { v: 0 })]);
  assert.equal(stale.applied, 0);
  const newer = sync(s, 1, [ch("a", 20, { v: 2 })]);
  assert.equal(newer.applied, 1);
  assert.deepEqual(newer.changes[0].data, { v: 2 });
});

test("second device sees the first device's edits", () => {
  const s = fresh();
  const a = sync(s, 0, [ch("a", 10)]);
  const b = sync(s, 0, [ch("b", 12)]);
  assert.deepEqual(b.changes.map((c) => c.id), ["a", "b"]);
  const a2 = sync(s, a.cursor, []);
  assert.deepEqual(a2.changes.map((c) => c.id), ["b"]);
});

test("deletes travel as tombstones", () => {
  const s = fresh();
  sync(s, 0, [ch("a", 10)]);
  const r = sync(s, 1, [ch("a", 11, null, { deleted: true })]);
  assert.equal(r.changes[0].deleted, true);
});

test("pages large pulls", () => {
  const s = fresh();
  const many = Array.from({ length: PAGE_SIZE + 5 }, (_, i) => ch(`r${i}`, i + 1));
  sync(s, 0, many.slice(0, 1500 > many.length ? many.length : 1500));
  const p1 = sync(s, 0, []);
  assert.equal(p1.more, true);
  assert.equal(p1.changes.length, PAGE_SIZE);
  const p2 = sync(s, p1.cursor, []);
  assert.equal(p2.more, false);
  assert.equal(p2.changes.length, 5);
});

test("rejects bad input", () => {
  assert.equal(typeof parseSyncBody(null), "string");
  assert.equal(typeof parseSyncBody({ cursor: -1 }), "string");
  assert.equal(typeof parseSyncBody({ changes: [{ kind: "nope", id: "a", updatedAt: 1 }] }), "string");
  assert.equal(typeof parseSyncBody({ changes: [{ kind: "routine", id: "", updatedAt: 1 }] }), "string");
  const ok = parseSyncBody({ cursor: 3, changes: [{ kind: "workout", id: "w1", updatedAt: 5, data: { x: 1 } }] });
  assert.equal(typeof ok, "object");
  assert.equal(ok.changes[0].deleted, false);
});
