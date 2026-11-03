// Programs (blocks), weekly volume and the "what's today?" scheduler.
// Pure functions: no DOM, no storage, so they're unit-tested in Node.

export const DAY = 86400000;
export const WEEK = 7 * DAY;

/** Monday 00:00 local time of the week containing t. */
export function weekStart(t) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7; // Mon = 0
  d.setDate(d.getDate() - dow);
  return d.getTime();
}

/** Whole weeks between two Monday-aligned week starts, safe across DST changes. */
const weeksBetween = (a, b) => Math.round((weekStart(b) - weekStart(a)) / WEEK);

export const PHASE_TEXT = {
  calibration: "Calibration week",
  build: "Build",
  deload: "Deload week",
};

/** Where we are in a block: { week (0-based), weeks, phase, done } */
export function blockPosition(program, now = Date.now()) {
  const week = Math.max(0, weeksBetween(program.startedAt, now));
  const weeks = program.phases.length;
  return { week, weeks, phase: program.phases[Math.min(week, weeks - 1)], done: week >= weeks };
}

const I = (exerciseId, sets, repMin, repMax, restSec, role = "accessory", note = "") =>
  ({ key: `${exerciseId}`, exerciseId, sets, repMin, repMax, restSec, role, note });

/** Block 1, written by Claude from the interview on 3 Nov 2026. */
export function blockOne(now = Date.now()) {
  const calf = () => I("ex-seated-calf-raise", 3, 12, 15, 60, "rehab", "Physio plan for your Achilles: slow, 3 s up and 3 s down. Load climbs towards bodyweight.");
  return {
    id: "block-1",
    name: "Block 1: Foundations",
    status: "active",
    startedAt: weekStart(now),
    phases: ["calibration", "build", "build", "build", "build", "deload"],
    priorities: ["chest", "glutes"],
    targets: { chest: 12, glutes: 12, quads: 8, hamstrings: 7, "upper back": 9, lats: 8, shoulders: 7, triceps: 5, biceps: 4, core: 4, calves: 9, adductors: 3, "lower back": 3, forearms: 0 },
    rationale:
      "Three full-body sessions, because with 3 × 45 minutes the only way to give chest and glutes extra attention is to hit them every session. Each day is built around one big barbell lift (squat, deadlift, overhead press), then chest, glute and back work, then your physio's calf raises. Same exercises for six weeks so progress is measurable: week 1 finds your working weights, weeks 2–5 build, week 6 backs off so you recover before Block 2. No jumping or plyometrics while the Achilles settles.",
    sessions: [
      {
        key: "A", name: "Squat + chest",
        focus: "Back squat, heavy bench, hip thrust",
        items: [
          I("ex-back-squat", 3, 5, 8, 150, "main"),
          I("ex-bench-press", 3, 6, 10, 120, "main"),
          I("ex-hip-thrust", 3, 8, 12, 90),
          I("ex-seated-cable-row", 3, 10, 12, 75),
          I("ex-cable-fly", 3, 12, 15, 60),
          calf(),
        ],
      },
      {
        key: "B", name: "Deadlift + incline",
        focus: "Deadlift, incline press, split squats",
        items: [
          I("ex-deadlift", 3, 4, 6, 150, "main"),
          I("ex-incline-dumbbell-press", 3, 8, 12, 90),
          I("ex-bulgarian-split-squat", 3, 8, 10, 75, "accessory", "Reps are per leg. Lean slightly forward for more glute."),
          I("ex-lat-pulldown", 3, 8, 12, 75),
          I("ex-45-degree-back-extension", 2, 12, 15, 60, "accessory", "Glute-biased: slight round, squeeze glutes to come up."),
          calf(),
        ],
      },
      {
        key: "C", name: "Press + glutes",
        focus: "Overhead press, Romanian deadlift, chest press",
        items: [
          I("ex-overhead-press", 3, 5, 8, 120, "main"),
          I("ex-romanian-deadlift", 3, 8, 10, 120),
          I("ex-machine-chest-press", 3, 10, 12, 75),
          I("ex-one-arm-dumbbell-row", 3, 10, 12, 60, "accessory", "Reps are per arm."),
          I("ex-cable-hip-abduction", 2, 12, 15, 45, "accessory", "Reps are per leg."),
          I("ex-pallof-press", 2, 10, 12, 45, "accessory", "Reps are per side."),
          calf(),
        ],
      },
    ],
    nextSessionKey: null,
    createdBy: "claude",
    updatedAt: 2,
  };
}

/** Working sets per muscle: primary muscles count 1, secondary 0.5. */
export function setsPerMuscle(workouts, exercisesById, from, to) {
  const out = {};
  for (const w of workouts) {
    if (!w.finishedAt || w.startedAt < from || w.startedAt >= to) continue;
    for (const e of w.entries || []) {
      const ex = exercisesById[e.exerciseId];
      if (!ex) continue;
      const n = (e.sets || []).filter((s) => s.done).length;
      if (!n) continue;
      for (const m of ex.muscles || []) out[m] = (out[m] || 0) + n;
      for (const m of ex.secondary || []) out[m] = (out[m] || 0) + n * 0.5;
    }
  }
  return out;
}

/** Planned sets per muscle for one session of a program. */
export function sessionMuscles(session, exercisesById) {
  const out = {};
  for (const it of session.items) {
    const ex = exercisesById[it.exerciseId];
    if (!ex) continue;
    for (const m of ex.muscles || []) out[m] = (out[m] || 0) + it.sets;
    for (const m of ex.secondary || []) out[m] = (out[m] || 0) + it.sets * 0.5;
  }
  return out;
}

/**
 * What to train next.
 * Rules, in order:
 * 1. A coach override (program.nextSessionKey) wins until a session is done after it was set.
 * 2. If a session was missed last week and it carried a priority muscle that came up short,
 *    it goes first this week.
 * 3. Otherwise the first session of the week's A/B/C not yet done.
 * 4. All done this week: offer the next one in rotation as an extra.
 * Returns { key, reason, doneThisWeek: [keys], extra }
 */
export function nextSession(program, workouts, exercisesById, now = Date.now()) {
  const keys = program.sessions.map((s) => s.key);
  const mine = workouts
    .filter((w) => w.finishedAt && w.programId === program.id)
    .sort((a, b) => a.startedAt - b.startedAt);
  const thisWeek = weekStart(now);
  const doneThisWeek = mine.filter((w) => w.startedAt >= thisWeek).map((w) => w.sessionKey);
  const doneSet = new Set(doneThisWeek);

  if (program.nextSessionKey && keys.includes(program.nextSessionKey)) {
    const doneSince = mine.some((w) => w.startedAt >= (program.nextSessionSetAt || 0));
    if (!doneSince) return { key: program.nextSessionKey, reason: program.nextSessionReason || "Your coach moved this session up.", doneThisWeek, extra: false };
  }

  const lastWeek = thisWeek - WEEK;
  if (program.startedAt <= lastWeek) {
    const doneLast = new Set(mine.filter((w) => w.startedAt >= lastWeek && w.startedAt < thisWeek).map((w) => w.sessionKey));
    const missed = keys.filter((k) => !doneLast.has(k) && !doneSet.has(k));
    if (missed.length) {
      const got = setsPerMuscle(mine, exercisesById, lastWeek, thisWeek);
      const short = (program.priorities || []).filter((m) => (got[m] || 0) < 0.8 * (program.targets?.[m] || 0));
      let best = null;
      for (const k of missed) {
        const planned = sessionMuscles(program.sessions.find((s) => s.key === k), exercisesById);
        const weight = short.reduce((a, m) => a + (planned[m] || 0), 0);
        if (weight > 0 && (!best || weight > best.weight)) best = { k, weight, muscles: short.filter((m) => planned[m]) };
      }
      if (best) {
        const name = program.sessions.find((s) => s.key === best.k).name;
        return {
          key: best.k,
          reason: `You missed ${name} last week and ${best.muscles.join(" and ")} came up short, so it's first this week.`,
          doneThisWeek, extra: false,
        };
      }
    }
  }

  const todo = keys.find((k) => !doneSet.has(k));
  if (todo) return { key: todo, reason: null, doneThisWeek, extra: false };

  const last = mine[mine.length - 1]?.sessionKey;
  const k = keys[(keys.indexOf(last) + 1) % keys.length] || keys[0];
  return { key: k, reason: "All three sessions are done this week. This one is a bonus if you want it.", doneThisWeek, extra: true };
}
