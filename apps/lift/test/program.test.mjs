import { test } from "node:test";
import assert from "node:assert/strict";
import { blockOne, nextSession, setsPerMuscle, blockPosition, weekStart, WEEK, DAY } from "../public/js/program.js";
import { prescribe } from "../public/js/progression.js";
import { SEED_EXERCISES } from "../public/js/seed.js";

const EX = Object.fromEntries(SEED_EXERCISES.map((e) => [e.id, e]));
const MON = weekStart(new Date(2026, 10, 2, 12).getTime()); // Mon 2 Nov 2026
const at = (weekOffset, day = 0, h = 18) => MON + weekOffset * WEEK + day * DAY + h * 3600e3;
const prog = () => ({ ...blockOne(MON), startedAt: MON });

function did(program, key, t, frac = 1) {
  const s = program.sessions.find((x) => x.key === key);
  return {
    id: key + t, programId: program.id, sessionKey: key, startedAt: t, finishedAt: t + 2700e3,
    entries: s.items.map((it) => ({ exerciseId: it.exerciseId, sets: Array.from({ length: it.sets }, (_, i) => ({ weight: 50, reps: 10, done: i < Math.round(it.sets * frac) })) })),
  };
}

test("every Block 1 exercise exists in the library, and every session has the physio's calf work", () => {
  const p = blockOne(MON);
  for (const s of p.sessions) {
    for (const it of s.items) assert.ok(EX[it.exerciseId], `${it.exerciseId} missing`);
    assert.ok(s.items.some((it) => it.role === "rehab" && EX[it.exerciseId].pattern === "calf-bent-knee"));
  }
});

test("Block 1 planned weekly volume meets its own priority targets", () => {
  const p = blockOne(MON);
  const ws = p.sessions.map((s, i) => did(p, s.key, at(0, i * 2)));
  const v = setsPerMuscle(ws, EX, MON, MON + WEEK);
  for (const m of p.priorities) assert.ok(v[m] >= p.targets[m], `${m}: ${v[m]} < ${p.targets[m]}`);
});

test("block position and phases", () => {
  const p = prog();
  assert.deepEqual(blockPosition(p, at(0, 2)), { week: 0, weeks: 6, phase: "calibration", done: false });
  assert.equal(blockPosition(p, at(5, 1)).phase, "deload");
  assert.equal(blockPosition(p, at(6, 0)).done, true);
});

test("fresh week starts at A, then B, then C, then a bonus", () => {
  const p = prog();
  assert.equal(nextSession(p, [], EX, at(0, 1)).key, "A");
  const ws = [did(p, "A", at(0, 0))];
  assert.equal(nextSession(p, ws, EX, at(0, 1)).key, "B");
  ws.push(did(p, "B", at(0, 2)), did(p, "C", at(0, 4)));
  const n = nextSession(p, ws, EX, at(0, 5));
  assert.equal(n.extra, true);
});

test("missed session carrying short priority muscles goes first next week", () => {
  const p = prog();
  // Week 0: did A and C, missed B. B has incline press (chest) and split squats + back ext (glutes).
  const ws = [did(p, "A", at(0, 0)), did(p, "C", at(0, 3))];
  const n = nextSession(p, ws, EX, at(1, 0));
  assert.equal(n.key, "B");
  assert.match(n.reason, /missed Deadlift \+ incline/);
});

test("missed session is dropped when priorities were covered anyway", () => {
  const p = prog();
  p.targets = { ...p.targets, chest: 6, glutes: 6 };
  const ws = [did(p, "A", at(0, 0)), did(p, "C", at(0, 3))];
  assert.equal(nextSession(p, ws, EX, at(1, 0)).key, "A");
});

test("coach override wins until a session is done after it", () => {
  const p = { ...prog(), nextSessionKey: "C", nextSessionSetAt: at(0, 0, 8), nextSessionReason: "Shoulder rest." };
  assert.equal(nextSession(p, [], EX, at(0, 1)).key, "C");
  assert.equal(nextSession(p, [did(p, "C", at(0, 1))], EX, at(0, 2)).key, "A");
});

const H = (w, reps, feel) => [{ workout: { startedAt: 1 }, entry: { feel }, sets: reps.map((r) => ({ weight: w, reps: r, done: true })) }];
const item = { sets: 3, repMin: 8, repMax: 12, role: "accessory" };
const calf = { sets: 3, repMin: 12, repMax: 15, role: "rehab" };

test("calibration with no history asks to ramp up", () => {
  assert.match(prescribe([], item, 2.5, { phase: "calibration" }).reason, /Calibration/);
});

test("feel: easy jumps two steps, hard holds instead of adding", () => {
  const easy = prescribe(H(40, [10, 9, 9], "easy"), item, 2.5);
  assert.equal(easy.weight, 45);
  assert.equal(prescribe(H(50, [10, 10, 10], "easy"), { ...item, repMax: 10, repMin: 6 }, 2.5).weight, 55, "easy at top of range also jumps two steps");
  const hard = prescribe(H(40, [12, 12, 12], "hard"), item, 2.5);
  assert.equal(hard.weight, 40);
  assert.equal(hard.kind, "hold");
});

test("Achilles: high score cuts calf load, moderate or rising score blocks increases", () => {
  const hist = H(60, [15, 15, 15]);
  assert.equal(prescribe(hist, calf, 5, { achilles: 1 }).weight, 65);
  assert.equal(prescribe(hist, calf, 5, { achilles: 4 }).weight, 60);
  assert.equal(prescribe(hist, calf, 5, { achilles: 3, prevAchilles: 1 }).weight, 60);
  const bad = prescribe(hist, calf, 5, { achilles: 7 });
  assert.equal(bad.kind, "deload");
  assert.equal(bad.weight, 50, "15% below what was lifted last time (60), not below the would-be increase");
});

test("Achilles gate never touches non-rehab lifts", () => {
  assert.equal(prescribe(H(60, [12, 12, 12]), item, 2.5, { achilles: 8 }).weight, 62.5);
});

test("deload week drops a set and ~10% load", () => {
  const d = prescribe(H(100, [8, 8, 8]), item, 2.5, { phase: "deload" });
  assert.equal(d.sets, 2);
  assert.equal(d.reps.length, 2);
  assert.equal(d.weight, 90);
});
