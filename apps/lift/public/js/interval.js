// Interval (HIIT) sessions: a schedule of phases and a clock read from timestamps,
// so it stays right through screen locks, app switches and reloads. Pure: no DOM.

/** Levels from easiest. Each step adds work time or a round. */
export const LEVELS = [
  { work: 30, rest: 30, rounds: 3 },
  { work: 35, rest: 25, rounds: 3 },
  { work: 40, rest: 20, rounds: 3 },
  { work: 40, rest: 20, rounds: 4 },
  { work: 45, rest: 15, rounds: 4 },
];
export const READY_SECS = 10;
export const ROUND_REST_SECS = 60;

export const levelOf = (n) => LEVELS[Math.min(LEVELS.length, Math.max(1, n | 0)) - 1];

/**
 * Phases in order: get ready, then for each round every move (work), with rest
 * between moves and a longer rest between rounds.
 * Each phase: { type: "ready"|"work"|"rest"|"roundRest", secs, start, ex, round, switchAt }
 * ex is the move being done (work) or coming up next (ready/rest/roundRest).
 */
export function schedule(items, level) {
  const { work, rest, rounds } = levelOf(level);
  const phases = [];
  let t = 0;
  const push = (p) => { phases.push({ ...p, start: t }); t += p.secs; };
  push({ type: "ready", secs: READY_SECS, ex: 0, round: 0 });
  for (let r = 0; r < rounds; r++) {
    items.forEach((it, i) => {
      push({ type: "work", secs: work, ex: i, round: r, switchAt: it.sides ? Math.round(work / 2) : null });
      const lastMove = i === items.length - 1;
      if (!lastMove) push({ type: "rest", secs: rest, ex: i + 1, round: r });
      else if (r < rounds - 1) push({ type: "roundRest", secs: ROUND_REST_SECS, ex: 0, round: r + 1 });
    });
  }
  return { phases, total: t, work, rest, rounds };
}

/** Where the clock is. elapsed in seconds. */
export function at(sched, elapsed) {
  const { phases, total } = sched;
  if (elapsed >= total) return { i: phases.length, phase: null, left: 0, into: 0, done: true };
  let i = phases.length - 1;
  while (i > 0 && phases[i].start > elapsed) i--;
  const p = phases[i];
  const into = elapsed - p.start;
  return { i, phase: p, left: p.secs - into, into, done: false, side: p.switchAt != null ? (into < p.switchAt ? 1 : 2) : 0 };
}

/** Elapsed time after "skip": the start of the next phase. */
export const skipTo = (sched, elapsed) => {
  const { i } = at(sched, elapsed);
  return i + 1 < sched.phases.length ? sched.phases[i + 1].start : sched.total;
};

/** Elapsed time after "back": restart this phase, or go to the previous one if just started. */
export const backTo = (sched, elapsed) => {
  const { i, into } = at(sched, elapsed);
  if (i >= sched.phases.length) return sched.phases[sched.phases.length - 1].start;
  return into > 3 || i === 0 ? sched.phases[i].start : sched.phases[i - 1].start;
};

/**
 * Which work phases count as done: reached their end, minus any skipped before halfway.
 * skipped: array of phase indexes. Returns [{ ex, round }].
 */
export function completed(sched, elapsed, skipped = []) {
  const skip = new Set(skipped);
  return sched.phases
    .map((p, i) => ({ p, i }))
    .filter(({ p, i }) => p.type === "work" && elapsed >= p.start + p.secs && !skip.has(i))
    .map(({ p }) => ({ ex: p.ex, round: p.round }));
}

/** Clock state helpers. clock = { t0 (ms), pausedAt (ms or null) } */
export const elapsedOf = (clock, now = Date.now()) => Math.max(0, ((clock.pausedAt ?? now) - clock.t0) / 1000);
export const seek = (clock, secs, now = Date.now()) => ({ ...clock, t0: (clock.pausedAt ?? now) - secs * 1000 });
export const pause = (clock, now = Date.now()) => (clock.pausedAt ? clock : { ...clock, pausedAt: now });
export const resume = (clock, now = Date.now()) => (clock.pausedAt ? { t0: clock.t0 + (now - clock.pausedAt), pausedAt: null } : clock);

/** Next time's level from how this session felt. Two "about right"s in a row also step up. */
export function nextLevel(level, feel, prevFeel) {
  const max = LEVELS.length;
  if (feel === "easy") return Math.min(max, level + 1);
  if (feel === "hard") return Math.max(1, level - 1);
  if (feel === "right" && prevFeel === "right") return Math.min(max, level + 1);
  return level;
}

export const minutes = (sched) => Math.round(sched.total / 60);
