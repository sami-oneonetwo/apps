import { test } from "node:test";
import assert from "node:assert/strict";
import { schedule, at, skipTo, backTo, completed, elapsedOf, seek, pause, resume, nextLevel, LEVELS, READY_SECS, ROUND_REST_SECS } from "../public/js/interval.js";
import { SEED_ROUTINES, SEED_EXERCISES } from "../public/js/seed.js";

const items = [{ sides: false }, { sides: true }, { sides: false }];

test("schedule: ready, work/rest between moves, round rest between rounds, none at the end", () => {
  const s = schedule(items, 1); // 30/30 x 3
  const types = s.phases.map((p) => p.type);
  assert.deepEqual(types.slice(0, 6), ["ready", "work", "rest", "work", "rest", "work"]);
  assert.equal(types[6], "roundRest");
  assert.equal(types[types.length - 1], "work");
  assert.equal(s.phases.filter((p) => p.type === "work").length, 9);
  assert.equal(s.total, READY_SECS + 9 * 30 + 6 * 30 + 2 * ROUND_REST_SECS);
});

test("side switch at halfway for two-sided moves", () => {
  const s = schedule(items, 1);
  const w = s.phases.find((p) => p.type === "work" && p.ex === 1);
  assert.equal(w.switchAt, 15);
  assert.equal(at(s, w.start + 5).side, 1);
  assert.equal(at(s, w.start + 20).side, 2);
});

test("at() finds the phase and time left", () => {
  const s = schedule(items, 1);
  const a = at(s, 12);
  assert.equal(a.phase.type, "work");
  assert.equal(a.left, 28);
  assert.equal(at(s, s.total + 5).done, true);
});

test("skip and back move between phase starts", () => {
  const s = schedule(items, 1);
  assert.equal(skipTo(s, 12), s.phases[2].start);
  assert.equal(backTo(s, 12 + 10), s.phases[1].start, "restart current when well into it");
  assert.equal(backTo(s, s.phases[2].start + 1), s.phases[1].start, "previous when just started");
});

test("completed counts finished work, not work skipped early", () => {
  const s = schedule(items, 1);
  const end1 = s.phases[1].start + 30;
  assert.deepEqual(completed(s, end1), [{ ex: 0, round: 0 }]);
  assert.deepEqual(completed(s, s.phases[4].start, [3]), [{ ex: 0, round: 0 }], "phase 3 skipped");
  assert.equal(completed(s, s.total).length, 9);
});

test("clock survives pause, resume and seek", () => {
  let c = { t0: 1000, pausedAt: null };
  assert.equal(elapsedOf(c, 11000), 10);
  c = pause(c, 11000);
  assert.equal(elapsedOf(c, 99000), 10, "paused clock doesn't move");
  c = resume(c, 20000);
  assert.equal(elapsedOf(c, 25000), 15);
  c = seek(c, 40, 25000);
  assert.equal(elapsedOf(c, 25000), 40);
});

test("level progression from feel", () => {
  assert.equal(nextLevel(1, "easy"), 2);
  assert.equal(nextLevel(1, "hard"), 1);
  assert.equal(nextLevel(3, "hard"), 2);
  assert.equal(nextLevel(2, "right", "easy"), 2);
  assert.equal(nextLevel(2, "right", "right"), 3);
  assert.equal(nextLevel(LEVELS.length, "easy"), LEVELS.length);
});

test("seed routine is a beginner circuit of real exercises, with a planted swap for the pivot move", () => {
  const ex = Object.fromEntries(SEED_EXERCISES.map((e) => [e.id, e]));
  const r = SEED_ROUTINES[0];
  assert.equal(r.format, "interval");
  assert.equal(r.level, 1);
  for (const it of r.items) assert.ok(ex[it.exerciseId], it.exerciseId);
  const pivots = r.items.filter((it) => ex[it.exerciseId].pivot);
  assert.ok(pivots.length >= 1);
  for (const it of pivots) assert.ok(ex[ex[it.exerciseId].planted], "planted alternative exists");
  const s = schedule(r.items, 1);
  assert.ok(s.total / 60 > 18 && s.total / 60 < 28, `about 20-25 min, got ${s.total / 60}`);
});
