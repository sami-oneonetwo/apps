import { test } from "node:test";
import assert from "node:assert/strict";
import { applyCoach, buildUserPrompt, OUTPUT_SCHEMA } from "../src/coach.ts";
import { blockOne } from "../public/js/program.js";
import { SEED_EXERCISES, DEFAULT_SETTINGS } from "../public/js/seed.js";

const NOW = new Date(2026, 10, 4, 19).getTime();
const empty = { summary: "", message: "", next_session: { key: "", reason: "" }, item_changes: [], new_exercises: [], new_block: { create: false, name: "", rationale: "", phases: [], priorities: [], targets: [], sessions: [] } };
const snap = () => ({ settings: DEFAULT_SETTINGS, programs: [blockOne(NOW)], exercises: SEED_EXERCISES, workouts: [], coachlogs: [] });
const run = (out, s = snap()) => applyCoach(s, { ...empty, ...out }, { trigger: "session", request: "", now: NOW, logId: "coach-1" });
const programWrite = (r) => r.writes.filter((w) => w.kind === "program").map((w) => w.data);

test("schema only uses keywords structured outputs accepts", () => {
  const banned = ["minimum", "maximum", "minLength", "maxLength", "multipleOf", "maxItems", "oneOf"];
  const walk = (o) => {
    if (!o || typeof o !== "object") return;
    for (const k of Object.keys(o)) {
      assert.ok(!banned.includes(k), `uses ${k}`);
      if (k === "additionalProperties") assert.equal(o[k], false);
      walk(o[k]);
    }
    if (o.type === "object") assert.deepEqual([...o.required].sort(), Object.keys(o.properties).sort());
  };
  walk(OUTPUT_SCHEMA);
});

test("no changes writes only a log, with nothing to undo", () => {
  const r = run({ summary: "No changes", message: "Solid session." });
  assert.equal(programWrite(r).length, 0);
  assert.equal(r.log.before, null);
  assert.equal(r.writes.length, 1);
});

test("edits an item and keeps the before-state for undo", () => {
  const r = run({ item_changes: [{ session_key: "A", item_key: "ex-cable-fly", exercise_id: "ex-pec-deck", sets: 3, rep_min: 10, rep_max: 15, rest_sec: 60, note: "", reason: "Cable station is always busy." }] });
  const [p] = programWrite(r);
  const it = p.sessions[0].items.find((i) => i.key === "ex-cable-fly");
  assert.equal(it.exerciseId, "ex-pec-deck");
  assert.equal(r.log.before.programs[0].sessions[0].items.find((i) => i.key === "ex-cable-fly").exerciseId, "ex-cable-fly");
  assert.match(r.log.changes[0], /Cable fly → Pec deck/);
});

test("refuses to remove or swap out the physio's calf raise", () => {
  const r = run({ item_changes: [
    { session_key: "A", item_key: "ex-seated-calf-raise", exercise_id: "ex-seated-calf-raise", sets: 0, rep_min: 12, rep_max: 15, rest_sec: 60, note: "", reason: "" },
    { session_key: "B", item_key: "ex-seated-calf-raise", exercise_id: "ex-standing-calf-raise", sets: 3, rep_min: 12, rep_max: 15, rest_sec: 60, note: "", reason: "" },
  ] });
  assert.equal(programWrite(r).length, 0);
  assert.equal(r.log.skipped.length, 2);
});

test("allows swapping the calf raise for another bent-knee version", () => {
  const r = run({ item_changes: [{ session_key: "B", item_key: "ex-seated-calf-raise", exercise_id: "ex-seated-dumbbell-calf-raise", sets: 3, rep_min: 12, rep_max: 15, rest_sec: 60, note: "", reason: "No seated machine free." }] });
  assert.equal(programWrite(r)[0].sessions[1].items.find((i) => i.role === "rehab").exerciseId, "ex-seated-dumbbell-calf-raise");
});

test("adds items before the calf work, removes accessories, ignores unknown ids", () => {
  const r = run({ item_changes: [
    { session_key: "C", item_key: "", exercise_id: "ex-lateral-raise", sets: 2, rep_min: 12, rep_max: 20, rest_sec: 45, note: "", reason: "Side delts." },
    { session_key: "C", item_key: "ex-pallof-press", exercise_id: "ex-pallof-press", sets: 0, rep_min: 0, rep_max: 0, rest_sec: 0, note: "", reason: "Time." },
    { session_key: "C", item_key: "", exercise_id: "ex-made-up", sets: 3, rep_min: 8, rep_max: 12, rest_sec: 60, note: "", reason: "" },
  ] });
  const c = programWrite(r)[0].sessions[2];
  const keys = c.items.map((i) => i.key);
  assert.ok(keys.includes("ex-lateral-raise"));
  assert.ok(!keys.includes("ex-pallof-press"));
  assert.equal(c.items[c.items.length - 1].role, "rehab");
  assert.equal(r.log.skipped.length, 1);
});

test("new exercises can be created and used in the same answer", () => {
  const r = run({
    new_exercises: [{ id: "ex-landmine-press", name: "Landmine press", equipment: "barbell", pattern: "incline-push", muscles: ["chest", "shoulders"], secondary: ["triceps"], cues: ["Bar in a landmine", "Press up and forward"], increment: 2.5 }],
    item_changes: [{ session_key: "C", item_key: "", exercise_id: "ex-landmine-press", sets: 3, rep_min: 8, rep_max: 12, rest_sec: 75, note: "", reason: "Shoulder-friendly press." }],
  });
  assert.ok(r.writes.some((w) => w.kind === "exercise" && w.id === "ex-landmine-press"));
  assert.ok(programWrite(r)[0].sessions[2].items.some((i) => i.exerciseId === "ex-landmine-press"));
});

test("next-session override is recorded with a reason", () => {
  const r = run({ next_session: { key: "C", reason: "Legs need a break after B." } });
  const [p] = programWrite(r);
  assert.equal(p.nextSessionKey, "C");
  assert.equal(p.nextSessionSetAt, NOW);
});

test("a new block ends the old one, and puts the calf rehab back if it was left out", () => {
  const r = run({ new_block: { create: true, name: "Block 2: Build", rationale: "More chest.", phases: ["build", "build", "build", "deload"], priorities: ["chest"], targets: [{ muscle: "chest", sets: 14 }],
    sessions: [{ key: "A", name: "Upper", focus: "", items: [
      { exercise_id: "ex-bench-press", sets: 4, rep_min: 6, rep_max: 8, rest_sec: 150, role: "main", note: "" },
      { exercise_id: "ex-bench-press", sets: 2, rep_min: 10, rep_max: 12, rest_sec: 90, role: "accessory", note: "Back-off sets" },
      { exercise_id: "ex-nope", sets: 3, rep_min: 8, rep_max: 12, rest_sec: 60, role: "accessory", note: "" },
    ] }] } });
  const ps = programWrite(r);
  assert.equal(ps.length, 2);
  assert.equal(ps[0].status, "done");
  const nb = ps[1];
  assert.equal(nb.status, "active");
  assert.deepEqual(nb.sessions[0].items.map((i) => i.key), ["ex-bench-press", "ex-bench-press-2", "ex-seated-calf-raise"]);
  assert.equal(r.log.before.newProgramId, nb.id);
});

test("the prompt carries the profile, Achilles scores and item keys", () => {
  const s = snap();
  s.workouts = [{ id: "w1", programId: "block-1", sessionKey: "A", name: "Squat + chest", startedAt: NOW - 3600e3, finishedAt: NOW - 600e3, achilles: 3, phase: "calibration",
    entries: [{ exerciseId: "ex-back-squat", name: "Back squat", feel: "right", sets: [{ weight: 80, reps: 8, done: true }] }] }];
  const p = buildUserPrompt(s, "session", "", NOW);
  assert.match(p, /Achilles 3\/10/);
  assert.match(p, /item_key=ex-cable-fly/);
  assert.match(p, /bent-knee \(seated\) calf raises/);
  assert.match(p, /Back squat: 80×8, felt right/);
});
