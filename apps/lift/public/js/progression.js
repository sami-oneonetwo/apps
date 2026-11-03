// Double progression: work inside a rep range at one weight. When every set
// reaches the top of the range, add weight and drop back to the bottom.

export const roundTo = (x, step) => (step > 0 ? +(Math.round(x / step) * step).toFixed(2) : +x.toFixed(2));

/** Epley estimated one-rep max. */
export const e1rm = (weight, reps) => (weight > 0 && reps > 0 ? weight * (1 + reps / 30) : 0);

export const fmtKg = (w) => (w == null ? "" : String(+(+w).toFixed(2)));

/** Finished sessions that include this exercise with at least one completed set, newest first. */
export function history(workouts, exerciseId, { excludeId } = {}) {
  const out = [];
  for (const w of workouts) {
    if (!w.finishedAt || w.deleted || w.id === excludeId) continue;
    for (const entry of w.entries || []) {
      if (entry.exerciseId !== exerciseId) continue;
      const done = (entry.sets || []).filter((s) => s.done && s.reps > 0);
      if (done.length) out.push({ workout: w, entry, sets: done });
    }
  }
  return out.sort((a, b) => b.workout.startedAt - a.workout.startedAt);
}

const topWeight = (sets) => Math.max(...sets.map((s) => +s.weight || 0));

/**
 * Suggest what to do next time.
 * item: { sets, repMin, repMax }   increment: kg step for this exercise
 * Returns { weight, reps: number[], kind, reason }
 * kind: "new" | "up" | "hold" | "deload" | "reps-only"
 */
export function suggest(hist, item, increment) {
  const { sets: n, repMin, repMax } = item;
  const fill = (r) => Array.from({ length: n }, (_, i) => (Array.isArray(r) ? r[i] : r));

  if (!hist.length) {
    return {
      weight: null,
      reps: fill(repMin),
      kind: "new",
      reason: `First time. Pick a weight you can lift for ${repMax} clean reps.`,
    };
  }

  const last = hist[0].sets;
  const w = topWeight(last);
  const atW = last.filter((s) => (+s.weight || 0) === w);
  const bodyweight = w === 0;

  const allTop = atW.length >= n && atW.slice(0, n).every((s) => s.reps >= repMax);
  if (allTop) {
    if (bodyweight || !increment) {
      return {
        weight: bodyweight ? null : w,
        reps: fill(repMax),
        kind: "reps-only",
        reason: `You hit ${repMax} on every set. Add load or move to a harder variation.`,
      };
    }
    return {
      weight: roundTo(w + increment, increment),
      reps: fill(repMin),
      kind: "up",
      reason: `You hit ${repMax} on every set at ${fmtKg(w)} kg. Add ${fmtKg(increment)} kg and start at ${repMin} reps.`,
    };
  }

  const missed = (sets, weight) => sets.some((s) => (+s.weight || 0) === weight && s.reps < repMin);
  if (!bodyweight && increment && hist.length > 1 && missed(last, w) && topWeight(hist[1].sets) === w && missed(hist[1].sets, w)) {
    const down = Math.max(0, roundTo(w * 0.9, increment));
    return {
      weight: down,
      reps: fill(repMin),
      kind: "deload",
      reason: `You fell short of ${repMin} reps two sessions running at ${fmtKg(w)} kg. Drop to ${fmtKg(down)} kg and build back up.`,
    };
  }

  const reps = fill(Array.from({ length: n }, (_, i) => {
    const prev = atW[i]?.reps ?? atW[atW.length - 1]?.reps ?? repMin;
    return Math.min(repMax, Math.max(repMin, prev + 1));
  }));
  return {
    weight: bodyweight ? null : w,
    reps,
    kind: "hold",
    reason: bodyweight
      ? `Add a rep where you can. Top of the range is ${repMax}.`
      : `Stay at ${fmtKg(w)} kg and add a rep where you can. Top of the range is ${repMax}.`,
  };
}

/** Best estimated 1RM and top weight per finished session, oldest first. */
export function trend(hist) {
  return hist
    .map(({ workout, sets }) => ({
      at: workout.startedAt,
      top: topWeight(sets),
      best: Math.max(...sets.map((s) => e1rm(+s.weight || 0, s.reps))),
      volume: sets.reduce((a, s) => a + (+s.weight || 0) * s.reps, 0),
      reps: sets.reduce((a, s) => a + s.reps, 0),
    }))
    .reverse();
}
