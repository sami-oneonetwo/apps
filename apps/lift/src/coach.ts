// The in-app coach: builds a prompt from the athlete's data, asks Claude for
// structured changes, then validates and applies them. Everything except the
// HTTP call is pure so it can be tested in Node.

import { blockPosition, setsPerMuscle, weekStart, WEEK, PHASE_TEXT } from "../public/js/program.js";
import { MUSCLES, EQUIPMENT, PATTERNS } from "../public/js/seed.js";
import type { Change } from "./sync";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Rec = Record<string, any>;

export interface Snapshot {
  settings: Rec;
  programs: Rec[];
  exercises: Rec[];
  workouts: Rec[];
  coachlogs: Rec[];
}

export type Trigger = "session" | "ask" | "new-block";

export const DEFAULT_MODEL = "claude-opus-5-5";
const PHASES = ["calibration", "build", "deload"];
const ROLES = ["main", "accessory", "rehab"];

// ---------- output schema (structured outputs: every field required, no numeric constraints) ----------
const str = { type: "string" };
const int = { type: "integer" };
const num = { type: "number" };
const obj = (properties: Rec) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
const arr = (items: Rec) => ({ type: "array", items });
const muscle = { type: "string", enum: MUSCLES };

export const OUTPUT_SCHEMA = obj({
  summary: str,
  message: str,
  next_session: obj({ key: str, reason: str }),
  item_changes: arr(obj({
    session_key: str, item_key: str, exercise_id: str,
    sets: int, rep_min: int, rep_max: int, rest_sec: int, note: str, reason: str,
  })),
  new_exercises: arr(obj({
    id: str, name: str,
    equipment: { type: "string", enum: EQUIPMENT },
    pattern: { type: "string", enum: Object.keys(PATTERNS) },
    muscles: arr(muscle), secondary: arr(muscle), cues: arr(str), increment: num,
  })),
  new_block: obj({
    create: { type: "boolean" },
    name: str, rationale: str,
    phases: arr({ type: "string", enum: PHASES }),
    priorities: arr(muscle),
    targets: arr(obj({ muscle, sets: num })),
    sessions: arr(obj({
      key: str, name: str, focus: str,
      items: arr(obj({
        exercise_id: str, sets: int, rep_min: int, rep_max: int, rest_sec: int,
        role: { type: "string", enum: ROLES }, note: str,
      })),
    })),
  }),
});

// ---------- prompt ----------
export const SYSTEM_PROMPT = `You are the strength coach inside Lift, a training app used by one athlete. You write and adjust their program. The athlete asked you to make changes automatically, so whatever you return is applied straight away, and they see your summary, each change's reason, and your message.

How the app already works, so you don't duplicate it:
- Weights progress automatically by double progression: when every set reaches the top of the rep range, the next session adds the exercise's weight step and drops to the bottom of the range. Otherwise it holds the weight and asks for a rep more.
- "Easy" taps move weight up faster and "Hard" taps hold. Deload weeks automatically drop a set and about 10% load.
- Calf rehab load is gated by the athlete's Achilles check (0–10) at the start of each session: 4+ or rising holds the load, 6+ cuts it.
Your job is the structure: exercises, sets, rep ranges, rest, notes, which session comes next, and new blocks.

Rules:
- Make small, justified changes. Most sessions after a normal workout need no changes at all: return empty item_changes, say what went well or what to watch, and stop.
- Keep exercises the same within a block. Only swap one for pain, a stall of 3 or more sessions with no progress, equipment problems the athlete mentions, or an explicit request. Prefer swaps with the same movement pattern.
- Achilles: the athlete's physio prescribed bent-knee (seated) calf raises 3 times a week, with load progressing towards bodyweight. Every session must keep one role "rehab" item using a bent-knee calf raise (pattern calf-bent-knee). Never remove it or swap it for another pattern. Never program jumping, plyometrics, sprints, skipping or bounding. If Achilles scores are 4 or more or trending up across sessions, say so plainly and suggest checking in with the physio. You are not a physio and don't diagnose.
- Respect weekly set targets per muscle, especially the priorities. Keep each session to roughly 45 minutes: about 20 working sets at most.
- Only use exercise ids from the library list, or ids you define in new_exercises (lowercase, starting "ex-"). Give every new exercise 2–3 short form cues.
- item_changes: to edit an item, give its item_key and the full new values (repeat unchanged values). To add an item, use item_key "". To remove an item, set sets to 0. One line of reason each, written for the athlete.
- next_session: key "" unless you have a specific reason to change the order. When you set one, give the reason.
- new_block: create true only when the trigger is new-block or the athlete explicitly asks for a new program. Otherwise create false with empty strings and arrays. A new block is normally 6 weeks: calibration, build ×4, deload. Build it from what the logs show: what progressed, what stalled, which muscles fell short, and how the Achilles responded.
- summary: one short line naming what changed, or "No changes".
- message: talk to the athlete directly. Plain, specific and encouraging without hype, in Australian English, 80 words at most. Refer to real numbers from their logs.`;

const fmtDate = (t: number) => new Date(t).toISOString().slice(0, 10);

export function buildUserPrompt(snap: Snapshot, trigger: Trigger, request: string, now: number): string {
  const ex = Object.fromEntries(snap.exercises.map((e) => [e.id, e]));
  const program = snap.programs.find((p) => p.status === "active");
  const lines: string[] = [];
  lines.push(`Today: ${fmtDate(now)}.`);
  lines.push(`\n## About the athlete (their own words)\n${snap.settings?.profile || "(not set)"}`);
  if (snap.settings?.bodyweightKg) lines.push(`Bodyweight: ${snap.settings.bodyweightKg} kg.`);

  if (program) {
    const pos = blockPosition(program, now);
    lines.push(`\n## Current block: ${program.name}`);
    lines.push(`Week ${Math.min(pos.week + 1, pos.weeks)} of ${pos.weeks} (${PHASE_TEXT[pos.phase as keyof typeof PHASE_TEXT]})${pos.done ? ". The block has finished." : ""}. Phases: ${program.phases.join(", ")}.`);
    lines.push(`Priorities: ${(program.priorities || []).join(", ")}. Weekly set targets: ${Object.entries(program.targets || {}).filter(([, v]) => (v as number) > 0).map(([m, v]) => `${m} ${v}`).join(", ")}.`);
    if (program.nextSessionKey) lines.push(`Next session override currently set: ${program.nextSessionKey}.`);
    for (const s of program.sessions) {
      lines.push(`Session ${s.key} "${s.name}":`);
      for (const it of s.items) {
        lines.push(`  - item_key=${it.key} ${ex[it.exerciseId]?.name ?? it.exerciseId} [${it.exerciseId}] ${it.sets}×${it.repMin}-${it.repMax}, rest ${it.restSec}s, role ${it.role}${it.note ? `, note: ${it.note}` : ""}`);
      }
    }
    const thisWeek = weekStart(now);
    for (const [label, from] of [["This week so far", thisWeek], ["Last week", thisWeek - WEEK]] as const) {
      const v = setsPerMuscle(snap.workouts, ex, from, from + WEEK);
      lines.push(`${label}, working sets per muscle: ${MUSCLES.map((m) => `${m} ${Math.round((v[m] || 0) * 10) / 10}`).join(", ")}.`);
    }
  } else {
    lines.push("\nNo active block.");
  }

  const recent = snap.workouts.filter((w) => w.finishedAt).sort((a, b) => b.startedAt - a.startedAt).slice(0, 15);
  lines.push(`\n## Recent sessions, newest first (${recent.length})`);
  for (const w of recent) {
    lines.push(`${fmtDate(w.startedAt)} session ${w.sessionKey ?? "?"} "${w.name}"${w.phase ? `, ${w.phase}` : ""}${w.achilles != null ? `, Achilles ${w.achilles}/10` : ""}, ${Math.round((w.finishedAt - w.startedAt) / 60000)} min${w.note ? `, note: "${w.note}"` : ""}${w.energy ? `, energy ${w.energy}/5` : ""}`);
    for (const e of w.entries || []) {
      const sets = (e.sets || []).filter((s: Rec) => s.done).map((s: Rec) => `${+s.weight ? `${s.weight}×` : ""}${s.reps}${s.rir != null ? `@${s.rir}RIR` : ""}`).join(", ");
      lines.push(`  - ${e.name}${e.swappedFrom ? ` (swapped in for ${ex[e.swappedFrom]?.name ?? e.swappedFrom})` : ""}: ${sets || "no sets"}${e.feel ? `, felt ${e.feel}` : ""}`);
    }
  }

  const logs = snap.coachlogs.sort((a, b) => b.at - a.at).slice(0, 6);
  if (logs.length) {
    lines.push("\n## Your recent coaching notes, newest first");
    for (const l of logs) lines.push(`${fmtDate(l.at)} (${l.trigger}${l.undone ? ", UNDONE by athlete" : ""}): ${l.summary}${l.request ? `. Athlete asked: "${l.request}"` : ""}`);
  }

  lines.push(`\n## Exercise library (id: name, pattern, equipment)`);
  for (const e of snap.exercises) lines.push(`${e.id}: ${e.name}, ${e.pattern ?? "?"}, ${e.equipment}`);

  lines.push(`\n## Trigger: ${trigger}`);
  if (trigger === "session") lines.push("The athlete just finished the most recent session above. Review it and adjust only if needed.");
  if (trigger === "new-block") lines.push("Write the next block (new_block.create = true).");
  if (request) lines.push(`The athlete says: "${request}"`);
  return lines.join("\n");
}

// ---------- apply ----------
export interface ApplyResult {
  writes: Change[];
  log: Rec;
}

const clampInt = (v: unknown, lo: number, hi: number, dflt: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
};

/** Validate the coach's output against the current data and turn it into record writes + a log entry. */
export function applyCoach(snap: Snapshot, out: Rec, ctx: { trigger: Trigger; request: string; now: number; logId: string }): ApplyResult {
  const { now } = ctx;
  const ex: Record<string, Rec> = Object.fromEntries(snap.exercises.map((e) => [e.id, e]));
  const changes: string[] = [];
  const skipped: string[] = [];
  const writes: Change[] = [];
  const put = (kind: string, rec: Rec) => {
    const { id, ...data } = rec;
    writes.push({ kind, id, updatedAt: now, deleted: false, data: { ...data, id } });
  };

  // New exercises first so changes can use them.
  for (const n of out.new_exercises || []) {
    const id = String(n.id || "").toLowerCase();
    if (!/^ex-[a-z0-9-]{2,60}$/.test(id)) { skipped.push(`New exercise "${n.name}": invalid id`); continue; }
    if (ex[id]) continue;
    const rec = {
      id, name: String(n.name).slice(0, 80), equipment: n.equipment, pattern: n.pattern,
      muscles: (n.muscles || []).filter((m: string) => MUSCLES.includes(m)),
      secondary: (n.secondary || []).filter((m: string) => MUSCLES.includes(m)),
      cues: (n.cues || []).slice(0, 4).map((c: string) => String(c).slice(0, 160)),
      increment: Number(n.increment) > 0 ? Number(n.increment) : 0, notes: "", createdBy: "coach",
    };
    ex[id] = rec;
    put("exercise", rec);
    changes.push(`Added ${rec.name} to your exercise library`);
  }

  const isBentKneeCalf = (id: string) => ex[id]?.pattern === "calf-bent-knee";
  const active = snap.programs.find((p) => p.status === "active");
  const before: Rec = { programs: active ? [structuredClone(active)] : [] };

  // ---- new block ----
  const nb = out.new_block;
  if (nb?.create) {
    const sessions = [];
    for (const [si, s] of (nb.sessions || []).entries()) {
      const key = String(s.key || "ABCDEF"[si]).slice(0, 4) || "ABCDEF"[si];
      const items: Rec[] = [];
      const seen = new Set<string>();
      for (const it of s.items || []) {
        if (!ex[it.exercise_id]) { skipped.push(`Session ${key}: unknown exercise ${it.exercise_id}`); continue; }
        let k = it.exercise_id; let n = 2;
        while (seen.has(k)) k = `${it.exercise_id}-${n++}`;
        seen.add(k);
        const role = ROLES.includes(it.role) ? it.role : "accessory";
        const repMin = clampInt(it.rep_min, 1, 50, 8);
        items.push({ key: k, exerciseId: it.exercise_id, sets: clampInt(it.sets, 1, 8, 3), repMin, repMax: clampInt(it.rep_max, repMin, 60, repMin), restSec: clampInt(it.rest_sec, 0, 600, 90), role: role === "rehab" && !isBentKneeCalf(it.exercise_id) ? "accessory" : role, note: String(it.note || "").slice(0, 200) });
      }
      if (!items.some((it) => it.role === "rehab")) {
        items.push({ key: "ex-seated-calf-raise", exerciseId: "ex-seated-calf-raise", sets: 3, repMin: 12, repMax: 15, restSec: 60, role: "rehab", note: "Physio plan for your Achilles: slow, 3 s up and 3 s down. Load climbs towards bodyweight." });
        skipped.push(`Session ${key}: the calf rehab was missing, so it was put back`);
      }
      if (items.length) sessions.push({ key, name: String(s.name || `Session ${key}`).slice(0, 60), focus: String(s.focus || "").slice(0, 120), items });
    }
    const phases = (nb.phases || []).filter((p: string) => PHASES.includes(p));
    if (sessions.length) {
      const n = snap.programs.length + 1;
      const program = {
        id: `block-${n}-${now.toString(36)}`, name: String(nb.name || `Block ${n}`).slice(0, 80), status: "active",
        startedAt: weekStart(now), phases: phases.length ? phases : ["calibration", "build", "build", "build", "build", "deload"],
        priorities: (nb.priorities || []).filter((m: string) => MUSCLES.includes(m)),
        targets: Object.fromEntries((nb.targets || []).filter((t: Rec) => MUSCLES.includes(t.muscle)).map((t: Rec) => [t.muscle, Math.max(0, Number(t.sets) || 0)])),
        rationale: String(nb.rationale || "").slice(0, 1500), sessions, nextSessionKey: null, createdBy: "coach",
      };
      if (active) put("program", { ...active, status: "done", endedAt: now });
      put("program", program);
      before.newProgramId = program.id;
      changes.push(`Started ${program.name}: ${program.sessions.length} sessions, ${program.phases.length} weeks`);
      return finish();
    }
    skipped.push("The new block had no valid sessions, so your current block stays");
  }

  if (!active) {
    skipped.push("No active block to change");
    return finish();
  }

  // ---- edits to the active block ----
  const program = structuredClone(active);
  let touched = false;
  for (const c of out.item_changes || []) {
    const s = program.sessions.find((x: Rec) => x.key === c.session_key);
    if (!s) { skipped.push(`Unknown session ${c.session_key}`); continue; }
    const idx = c.item_key ? s.items.findIndex((it: Rec) => it.key === c.item_key) : -1;
    const cur = idx >= 0 ? s.items[idx] : null;
    if (c.item_key && !cur) { skipped.push(`Session ${s.key}: unknown item ${c.item_key}`); continue; }
    const reason = String(c.reason || "").slice(0, 200);

    if (cur && Number(c.sets) <= 0) {
      if (cur.role === "rehab") { skipped.push(`Kept ${ex[cur.exerciseId]?.name}: the physio's calf work stays in every session`); continue; }
      s.items.splice(idx, 1);
      changes.push(`${s.name}: removed ${ex[cur.exerciseId]?.name}. ${reason}`);
      touched = true;
      continue;
    }
    if (!ex[c.exercise_id]) { skipped.push(`Unknown exercise ${c.exercise_id}`); continue; }
    if (cur?.role === "rehab" && !isBentKneeCalf(c.exercise_id)) { skipped.push(`Kept the bent-knee calf raise: the physio prescribed it`); continue; }
    const repMin = clampInt(c.rep_min, 1, 50, cur?.repMin ?? 8);
    const next = {
      key: cur?.key ?? c.exercise_id, exerciseId: c.exercise_id,
      sets: clampInt(c.sets, 1, 8, cur?.sets ?? 3), repMin, repMax: clampInt(c.rep_max, repMin, 60, cur?.repMax ?? repMin),
      restSec: clampInt(c.rest_sec, 0, 600, cur?.restSec ?? 90), role: cur?.role ?? "accessory",
      note: String(c.note ?? cur?.note ?? "").slice(0, 200),
    };
    if (!cur) {
      while (s.items.some((it: Rec) => it.key === next.key)) next.key += "-2";
      const rehabAt = s.items.findIndex((it: Rec) => it.role === "rehab");
      s.items.splice(rehabAt >= 0 ? rehabAt : s.items.length, 0, next);
      changes.push(`${s.name}: added ${ex[next.exerciseId].name}, ${next.sets}×${next.repMin}-${next.repMax}. ${reason}`);
    } else {
      const what = [];
      if (cur.exerciseId !== next.exerciseId) what.push(`${ex[cur.exerciseId]?.name ?? "exercise"} → ${ex[next.exerciseId].name}`);
      if (cur.sets !== next.sets || cur.repMin !== next.repMin || cur.repMax !== next.repMax) what.push(`${next.sets}×${next.repMin}-${next.repMax}`);
      if (cur.restSec !== next.restSec) what.push(`rest ${next.restSec}s`);
      if ((cur.note || "") !== next.note) what.push("new note");
      if (!what.length) continue;
      s.items[idx] = next;
      const swapped = cur.exerciseId !== next.exerciseId;
      changes.push(`${s.name}: ${swapped ? "" : `${ex[next.exerciseId].name}, `}${what.join(", ")}. ${reason}`);
    }
    touched = true;
  }

  const nk = out.next_session?.key;
  if (nk && program.sessions.some((s: Rec) => s.key === nk) && nk !== program.nextSessionKey) {
    program.nextSessionKey = nk;
    program.nextSessionSetAt = now;
    program.nextSessionReason = String(out.next_session.reason || "").slice(0, 200);
    changes.push(`Next session: ${program.sessions.find((s: Rec) => s.key === nk).name}. ${program.nextSessionReason}`);
    touched = true;
  }

  if (touched) put("program", program);
  return finish();

  function finish(): ApplyResult {
    const log = {
      id: ctx.logId, at: now, trigger: ctx.trigger, request: ctx.request.slice(0, 2000),
      summary: String(out.summary || (changes.length ? "Updated your program" : "No changes")).slice(0, 200),
      message: String(out.message || "").slice(0, 1500),
      changes, skipped, before: changes.length ? before : null, undone: false,
    };
    put("coachlog", log);
    return { writes, log };
  }
}

// ---------- the API call ----------
export async function askClaude(apiKey: string, model: string, system: string, user: string, maxTokens = 8000): Promise<Rec> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model, max_tokens: maxTokens, system,
      messages: [{ role: "user", content: user }],
      output_config: { format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
    }),
  });
  const body: Rec = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${body?.error?.message ?? "request failed"}`);
  if (body.stop_reason === "refusal") throw new Error("The coach declined that request.");
  if (body.stop_reason === "max_tokens") throw new Error("The coach's answer was cut off. Try again.");
  const text = (body.content || []).find((b: Rec) => b.type === "text")?.text;
  if (!text) throw new Error("The coach returned no answer.");
  return JSON.parse(text);
}
