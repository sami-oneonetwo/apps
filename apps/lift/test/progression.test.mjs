import { test } from "node:test";
import assert from "node:assert/strict";
import { suggest, history, trend, e1rm, roundTo } from "../public/js/progression.js";
import { perSide } from "../public/js/plates.js";

const item = { sets: 3, repMin: 8, repMax: 12 };
const S = (weight, ...reps) => reps.map((r) => ({ weight, reps: r, done: true }));
const H = (...sessions) => sessions.map((sets, i) => ({ workout: { startedAt: 1000 - i }, sets }));

test("no history asks for a starting weight", () => {
  const s = suggest([], item, 2.5);
  assert.equal(s.kind, "new");
  assert.equal(s.weight, null);
  assert.deepEqual(s.reps, [8, 8, 8]);
});

test("top of range on every set adds weight and resets reps", () => {
  const s = suggest(H(S(60, 12, 12, 12)), item, 2.5);
  assert.equal(s.kind, "up");
  assert.equal(s.weight, 62.5);
  assert.deepEqual(s.reps, [8, 8, 8]);
});

test("short of top holds weight and adds a rep per set, capped", () => {
  const s = suggest(H(S(60, 12, 10, 9)), item, 2.5);
  assert.equal(s.kind, "hold");
  assert.equal(s.weight, 60);
  assert.deepEqual(s.reps, [12, 11, 10]);
});

test("fewer sets than planned does not count as hitting the top", () => {
  const s = suggest(H(S(60, 12, 12)), item, 2.5);
  assert.equal(s.kind, "hold");
});

test("warm-up sets at lighter weights are ignored", () => {
  const s = suggest(H([...S(40, 10), ...S(60, 12, 12, 12)]), item, 2.5);
  assert.equal(s.kind, "up");
  assert.equal(s.weight, 62.5);
});

test("missing the bottom twice at the same weight deloads ~10%", () => {
  const s = suggest(H(S(100, 7, 6, 6), S(100, 8, 7, 6)), item, 2.5);
  assert.equal(s.kind, "deload");
  assert.equal(s.weight, 90);
});

test("missing once just holds", () => {
  const s = suggest(H(S(100, 7, 6, 6), S(97.5, 12, 12, 12)), item, 2.5);
  assert.equal(s.kind, "hold");
  assert.equal(s.weight, 100);
});

test("bodyweight progresses by reps then suggests harder variation", () => {
  assert.equal(suggest(H(S(0, 9, 8, 8)), item, 0).kind, "hold");
  const s = suggest(H(S(0, 12, 12, 12)), item, 0);
  assert.equal(s.kind, "reps-only");
  assert.equal(s.weight, null);
});

test("dumbbell increments round correctly", () => {
  assert.equal(suggest(H(S(22, 12, 12, 12)), item, 2).weight, 24);
  assert.equal(roundTo(0.9 * 22, 2), 20);
});

test("history picks finished sessions with done sets, newest first", () => {
  const ws = [
    { id: "a", startedAt: 1, finishedAt: 2, entries: [{ exerciseId: "x", sets: [{ weight: 50, reps: 8, done: true }] }] },
    { id: "b", startedAt: 3, finishedAt: null, entries: [{ exerciseId: "x", sets: [{ weight: 99, reps: 8, done: true }] }] },
    { id: "c", startedAt: 5, finishedAt: 6, entries: [{ exerciseId: "x", sets: [{ weight: 55, reps: 8, done: false }] }] },
    { id: "d", startedAt: 7, finishedAt: 8, entries: [{ exerciseId: "x", sets: [{ weight: 52.5, reps: 8, done: true }] }] },
  ];
  assert.deepEqual(history(ws, "x").map((h) => h.workout.id), ["d", "a"]);
  assert.deepEqual(trend(history(ws, "x")).map((t) => t.top), [50, 52.5]);
});

test("e1rm and plates", () => {
  assert.equal(Math.round(e1rm(100, 5)), 117);
  assert.deepEqual(perSide(100, 20, [25, 20, 15, 10, 5, 2.5, 1.25]).plates, [25, 15]);
  assert.deepEqual(perSide(62.5, 20, [25, 20, 15, 10, 5, 2.5, 1.25]).plates, [20, 1.25]);
  assert.deepEqual(perSide(20, 20, [25]).plates, []);
  assert.equal(perSide(61, 20, [25, 20, 15, 10, 5, 2.5, 1.25]).remainder, 0.5);
});
