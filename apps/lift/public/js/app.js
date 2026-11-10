import * as db from "./store.js";
import { MUSCLES, EQUIPMENT, DEFAULT_INCREMENT, PATTERNS } from "./seed.js";
import { history, prescribe, trend, e1rm, fmtKg, roundTo } from "./progression.js";
import { plateSvg } from "./plates.js";
import { blockPosition, nextSession, setsPerMuscle, weekStart, PHASE_TEXT, WEEK } from "./program.js";
import { bodyMap } from "./body.js";
import { movementHtml, start as startMovement, toggle as toggleMovement } from "./anim.js";
import { motionFor } from "./motions.js";
import * as iv from "./interval.js";

const $ = (s, el = document) => el.querySelector(s);
const app = $("#app");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// ---------- icons ----------
const I = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
  swap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h13l-3-3M20 16H7l3 3"/></svg>',
  today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2.5 12h19"/><rect x="5" y="6.5" width="3" height="11" rx="1"/><rect x="16" y="6.5" width="3" height="11" rx="1"/><rect x="2.5" y="9" width="2.5" height="6" rx=".8"/><rect x="19" y="9" width="2.5" height="6" rx=".8"/></svg>',
  coach: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/></svg>',
  progress: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  history: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></svg>',
};

// ---------- formatting ----------
const DAY = 86400000;
const fmtDate = (t) => new Date(t).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
const fmtShort = (t) => new Date(t).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
const fmtTime = (t) => new Date(t).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" });
const mmss = (s) => `${Math.floor(Math.abs(s) / 60)}:${String(Math.floor(Math.abs(s) % 60)).padStart(2, "0")}`;
const fmtDur = (ms) => { const m = Math.round(ms / 60000); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`; };
const setsText = (sets) => sets.map((s) => (+s.weight ? `${fmtKg(s.weight)}×${s.reps}` : `${s.reps}`)).join(", ");
const repRange = (t) => (t.repMin === t.repMax ? `${t.repMin}` : `${t.repMin}–${t.repMax}`);
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

// ---------- data helpers ----------
const exercises = () => db.list("exercise").sort((a, b) => a.name.localeCompare(b.name));
const exById = () => Object.fromEntries(db.list("exercise").map((e) => [e.id, e]));
const finished = () => db.list("workout").filter((w) => w.finishedAt).sort((a, b) => b.startedAt - a.startedAt);
const isBar = (ex) => ex?.equipment === "barbell";
const isBodyweight = (ex) => ex?.equipment === "bodyweight";
const incrementFor = (ex) => ex?.increment ?? DEFAULT_INCREMENT[ex?.equipment] ?? 2.5;
const activeProgram = () => db.list("program").filter((p) => p.status === "active").sort((a, b) => b.startedAt - a.startedAt)[0] || null;

// Each session wears a plate colour: A red, B blue, C yellow, D green.
const HUES = ["red", "blue", "yellow", "green"];
function hueFor(key, program = activeProgram()) {
  const i = program?.sessions.findIndex((s) => s.key === key) ?? -1;
  return HUES[(i >= 0 ? i : Math.max(0, String(key || "A").charCodeAt(0) - 65)) % HUES.length];
}
const disc = (key, hue, done = false) => `<span class="disc" data-hue="${hue}" aria-hidden="true">${done ? I.check : esc(key ?? "")}</span>`;
const weekday = () => new Date().toLocaleDateString("en-AU", { weekday: "long" });

function blockMeter(p, pos) {
  return `<a class="block-meter" href="#/block" aria-label="${esc(p.name)}, week ${Math.min(pos.week + 1, pos.weeks)} of ${pos.weeks}. About this block">
    <span class="bm-name">${esc(p.name)}</span>
    <span class="bm-week">${pos.done ? "Finished" : `Week ${pos.week + 1} of ${pos.weeks}, ${PHASE_TEXT[pos.phase].toLowerCase()}`}</span>
    <span class="bm-track" style="--n:${p.phases.length}" aria-hidden="true">${p.phases.map((ph, i) => `<i class="${ph}${i < pos.week ? " past" : i === pos.week ? " now" : ""}"></i>`).join("")}</span>
  </a>`;
}

function activeWorkout() {
  const id = db.ui().activeWorkoutId;
  const w = id && db.get("workout", id);
  return w && !w.finishedAt ? w : null;
}

// ---------- shell ----------
let sheetOpen = false;
const tabs = (cur) => `
<nav class="tabs" aria-label="Sections">
  <a href="#/" ${cur === "today" ? 'aria-current="page"' : ""}>${I.today}Today</a>
  <a href="#/coach" ${cur === "coach" ? 'aria-current="page"' : ""}>${I.coach}Coach</a>
  <a href="#/progress" ${cur === "progress" ? 'aria-current="page"' : ""}>${I.progress}Progress</a>
  <a href="#/history" ${cur === "history" ? 'aria-current="page"' : ""}>${I.history}History</a>
</nav>`;

const SYNC_TEXT = { idle: "Not synced yet", syncing: "Syncing", synced: "Synced", pending: "Changes waiting", offline: "Offline, saved on phone", error: "Sync failed, will retry", signin: "Sign in to sync", noident: "Sync blocked" };
const syncDot = () => `<span class="sync-dot" data-s="${db.sync.status}"><i></i>${SYNC_TEXT[db.sync.status] || ""}</span>`;
const signinBanner = () => db.sync.status === "signin"
  ? `<div class="banner">Your sign-in has expired, so changes are only on this phone. <a href="/" data-act="signin">Sign in again</a></div>`
  : db.sync.status === "noident"
    ? `<div class="banner">You're signed in, but the server couldn't confirm who you are, so changes are only on this phone. ${esc(db.sync.detail || "")} <a href="/" data-act="signin">Try signing in again</a></div>`
    : "";

function route() {
  const [name, id] = location.hash.replace(/^#\/?/, "").split("/");
  return { name: name || "today", id };
}

function render() {
  const r = route();
  const views = { routine: viewRoutine, interval: viewInterval, today: viewToday, session: viewSessionPreview, run: viewRun, workout: viewWorkout, history: viewHistory, exercises: viewExercises, exercise: viewExercise, settings: viewSettings, coach: viewCoach, progress: viewProgress, block: viewBlock };
  const fn = views[r.name] || viewToday;
  app.className = r.name === "run" ? "run" : r.name === "interval" ? "run interval" : "";
  app.innerHTML = fn(r.id);
  if (r.name === "exercise") wireChart();
  if (r.name === "run" || r.name === "exercise" || r.name === "interval") {
    const exId = r.name === "exercise" ? r.id : r.name === "interval" ? intervalFocusExercise() : curEntry().e?.exerciseId;
    const spec = motionFor(db.get("exercise", exId));
    if (spec) startMovement(app, spec);
  }
  wakeLock(r.name === "run" || r.name === "interval");
  if (r.name === "interval") startIntervalTicker(); else stopIntervalTicker();
  renderRest();
}

function go(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

// ---------- Today ----------
function itemLine(it, ex, all) {
  const h = history(all, it.exerciseId)[0];
  const top = h ? Math.max(...h.sets.map((s) => +s.weight || 0)) : 0;
  return `<li><span class="r-main"><span class="r-title">${esc(ex?.name ?? "Missing exercise")}</span>${it.role === "rehab" ? ` <span class="tag">Achilles rehab</span>` : ""}<br>
    <span class="r-sub">${it.sets} × ${repRange(it)}${h ? `, last ${top ? `${fmtKg(top)} kg` : `${Math.max(...h.sets.map((s) => s.reps))} reps`}` : ""}</span></span></li>`;
}

function viewToday() {
  const active = activeWorkout();
  const p = activeProgram();
  const head = `<header class="top"><div class="grow wordmark"><span class="wm-plate" aria-hidden="true"></span>Lift</div>${syncDot()}<a class="icon-btn" href="#/settings" aria-label="Settings">${I.gear}</a></header>${signinBanner()}`;
  if (!p) return `${head}<div class="empty"><p>No program yet. Ask your coach to write one.</p><a class="btn primary" href="#/coach">Open coach</a></div>${tabs("today")}`;

  const pos = blockPosition(p);
  const all = db.list("workout");
  const ex = exById();
  const meter = blockMeter(p, pos);

  if (active) {
    const hue = hueFor(active.sessionKey, p);
    const done = active.entries.reduce((a, e) => a + e.sets.filter((x) => x.done).length, 0);
    const total = active.entries.reduce((a, e) => a + e.sets.length, 0);
    if (active.kind === "interval") {
      return `${head}${meter}<a class="hero resume-hero" href="#/interval">
        <div class="hero-top">${disc("KB", "none")}<span>In progress since ${fmtTime(active.startedAt)}</span></div>
        <h1 class="hero-title">${esc(active.name)}</h1>
        <span class="btn go block">Resume workout</span></a>${otherWorkouts()}${tabs("today")}`;
    }
    return `${head}${meter}<a class="hero resume-hero" data-hue="${hue}" href="#/run">
      <div class="hero-top">${disc(active.sessionKey, hue)}<span>In progress since ${fmtTime(active.startedAt)}</span></div>
      <h1 class="hero-title">${esc(active.name)}</h1>
      <p class="hero-meta">${done} of ${total} sets done</p>
      <span class="btn go block">Resume session</span></a>${tabs("today")}`;
  }

  if (pos.done) {
    return `${head}${meter}
      <section class="hero" data-hue="green"><h1 class="hero-title">Block complete</h1>
        <p class="hero-meta">${pos.weeks} weeks done. Your coach will read your logs and write the next block.</p>
        <button class="btn go block" data-act="coach-run" data-trigger="new-block" ${coachBusy ? "disabled" : ""}>${coachBusy ? "Coach is writing…" : "Write my next block"}</button>
      </section>${tabs("today")}`;
  }

  const n = nextSession(p, all, ex);
  const s = p.sessions.find((x) => x.key === n.key);
  const hue = hueFor(s.key, p);
  const done = new Set(n.doneThisWeek);
  const sets = s.items.reduce((a, it) => a + it.sets, 0);
  const phaseNote = {
    calibration: "Calibration week: start light and build up each set to find your working weights.",
    deload: "Deload week: fewer sets and less weight so you recover before the next block.",
    build: "",
  }[pos.phase];

  return `${head}${meter}
  <section class="hero" data-hue="${hue}" aria-labelledby="today-h">
    <div class="hero-top">${disc(s.key, hue)}<span>${n.extra ? "Bonus session" : weekday()}</span></div>
    <h1 id="today-h" class="hero-title today-title">${esc(s.name)}</h1>
    <p class="hero-meta">${s.items.length} exercises, ${sets} sets, about 45 minutes</p>
    ${n.reason ? `<p class="reason">${esc(n.reason)}</p>` : ""}
    ${phaseNote ? `<p class="hero-note">${phaseNote}</p>` : ""}
    <ol class="hero-list">${s.items.map((it) => heroItem(it, ex[it.exerciseId], all)).join("")}</ol>
    <button class="btn go block" data-act="begin" data-key="${s.key}">Start ${esc(s.name)}</button>
  </section>
  <div class="section-head"><h2>This week</h2><span class="muted small">${done.size} of ${p.sessions.length} done</span></div>
  <ul class="rows week-rows">${p.sessions.map((x) => `<li><a href="#/session/${x.key}">${disc(x.key, hueFor(x.key, p), done.has(x.key))}<span class="r-main"><span class="r-title">${esc(x.name)}</span><br><span class="r-sub">${esc(x.focus || "")}</span></span><span class="r-side small">${done.has(x.key) ? "Done" : x.key === n.key ? "Next" : ""}</span></a></li>`).join("")}</ul>
  ${otherWorkouts()}
  ${tabs("today")}`;
}

function heroItem(it, ex, all) {
  const h = history(all, it.exerciseId)[0];
  const top = h ? Math.max(...h.sets.map((x) => +x.weight || 0)) : 0;
  const last = h ? (top ? `${fmtKg(top)} kg` : `${Math.max(...h.sets.map((x) => x.reps))} reps`) : "";
  return `<li><span class="hl-name">${esc(ex?.name ?? "Missing exercise")}${it.role === "rehab" ? ` <span class="tag tag-rehab">Achilles</span>` : ""}</span><span class="hl-sets">${it.sets} × ${repRange(it)}${last ? `<small>last ${last}</small>` : ""}</span></li>`;
}

function viewSessionPreview(key) {
  const p = activeProgram();
  const s = p?.sessions.find((x) => x.key === key);
  if (!s) return `<header class="top"><a class="icon-btn" href="#/" aria-label="Back">${I.back}</a></header><p>Session not found.</p>`;
  const ex = exById(), all = db.list("workout");
  return `<header class="top"><a class="icon-btn" href="#/" aria-label="Back to today">${I.back}</a><div class="grow title">${esc(p.name)}</div></header>
    <div class="title-with-disc">${disc(s.key, hueFor(s.key, p))}<h1>${esc(s.name)}</h1></div><p class="muted" style="margin:.4rem 0 1rem">${esc(s.focus || "")}</p>
    <ul class="rows compact">${s.items.map((it) => itemLine(it, ex[it.exerciseId], all)).join("")}</ul>
    <div style="margin-top:1rem"><button class="btn primary block" data-act="begin" data-key="${s.key}" ${activeWorkout() ? "disabled" : ""}>Start ${esc(s.name)} instead</button></div>
    ${tabs("today")}`;
}

function viewBlock() {
  const p = activeProgram();
  if (!p) return `<header class="top"><a class="icon-btn" href="#/" aria-label="Back">${I.back}</a></header><p>No active block.</p>`;
  const pos = blockPosition(p);
  const ex = exById();
  return `<header class="top"><a class="icon-btn" href="#/" aria-label="Back to today">${I.back}</a><div class="grow title">About this block</div></header>
    <h1>${esc(p.name)}</h1>
    <p class="muted" style="margin:.4rem 0 1rem">Started ${fmtDate(p.startedAt)}. Written by ${p.createdBy === "coach" ? "your in-app coach" : "Claude"}.</p>
    <p class="prose">${esc(p.rationale || "")}</p>
    <div class="section-head"><h2>Weeks</h2></div>
    <ol class="weeks">${p.phases.map((ph, i) => `<li ${i === pos.week ? 'aria-current="step"' : ""}><span class="num">${i + 1}</span>${PHASE_TEXT[ph]}</li>`).join("")}</ol>
    <div class="section-head"><h2>Weekly targets</h2></div>
    <p class="small muted">Working sets per muscle each week. Priorities: ${esc((p.priorities || []).join(" and "))}.</p>
    <p class="prose">${Object.entries(p.targets || {}).filter(([, v]) => v > 0).map(([m, v]) => `${m} ${v}`).join(", ")}</p>
    ${p.sessions.map((s) => `<div class="section-head"><h2>${esc(s.name)}</h2></div><ul class="rows compact">${s.items.map((it) => `<li><span class="r-main"><span class="r-title">${esc(ex[it.exerciseId]?.name ?? it.exerciseId)}</span><br><span class="r-sub">${it.sets} × ${repRange(it)}, rest ${mmss(it.restSec)}${it.note ? `. ${esc(it.note)}` : ""}</span></span></li>`).join("")}</ul>`).join("")}
    ${tabs("today")}`;
}

// ---------- starting a session ----------
async function beginSession(key) {
  const p = activeProgram();
  const s = p?.sessions.find((x) => x.key === key);
  if (!s) return;
  const hasRehab = s.items.some((it) => it.role === "rehab");
  let achilles = null;
  if (hasRehab) {
    achilles = await achillesSheet();
    if (achilles === undefined) return; // cancelled
  }
  const pos = blockPosition(p);
  const all = db.list("workout");
  const prev = finished().find((w) => w.achilles != null);
  const entries = s.items.map((it) => {
    const ex = db.get("exercise", it.exerciseId);
    return buildEntry(it, ex, all, { phase: pos.phase, achilles: it.role === "rehab" ? achilles : null, prevAchilles: prev?.achilles ?? null });
  });
  const w = db.put("workout", { id: db.uid("w"), programId: p.id, sessionKey: s.key, week: pos.week, phase: pos.phase, name: s.name, startedAt: Date.now(), finishedAt: null, achilles, entries, note: "", energy: null });
  db.ui({ activeWorkoutId: w.id, runIndex: 0, rest: null });
  go("#/run");
}

function buildEntry(it, ex, all, ctx, extra = {}) {
  const inc = incrementFor(ex);
  const hist = history(all, ex?.id);
  const s = prescribe(hist, it, inc, ctx);
  const weight = isBodyweight(ex) ? (s.weight ?? 0) : s.weight;
  return {
    itemKey: it.key, exerciseId: ex?.id, name: ex?.name ?? "Exercise", role: it.role, note: it.note || "",
    target: { sets: s.sets, repMin: it.repMin, repMax: it.repMax, restSec: it.restSec, increment: inc },
    advice: { kind: s.kind, text: s.reason },
    last: hist[0] ? { at: hist[0].workout.startedAt, sets: hist[0].sets.map(({ weight, reps }) => ({ weight, reps })) } : null,
    sets: Array.from({ length: s.sets }, (_, i) => ({ weight, reps: !hist.length && ctx.phase === "calibration" && it.role !== "rehab" ? it.repMax : s.reps[i], done: false })),
    feel: null,
    ...extra,
  };
}

function achillesSheet() {
  return new Promise((resolve) => {
    const root = $("#sheet-root");
    root.innerHTML = `<div class="scrim" data-a="cancel"></div>
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="ach-h">
        <h2 id="ach-h">Achilles check</h2>
        <p class="muted">How does it feel right now? 0 is nothing, 10 is the worst it's been. This sets today's calf load.</p>
        <div class="scale" role="group" aria-label="Achilles score 0 to 10">${Array.from({ length: 11 }, (_, i) => `<button data-a="${i}" data-band="${i <= 3 ? "ok" : i <= 5 ? "warn" : "bad"}">${i}</button>`).join("")}</div>
        <div class="scale-legend small"><span data-band="ok">0–3 fine</span><span data-band="warn">4–5 careful</span><span data-band="bad">6+ ease off</span></div>
        <div class="actions"><button class="btn quiet block" data-a="skip">Skip the check today</button></div>
      </div>`;
    sheetOpen = true;
    root.onclick = (e) => {
      const v = e.target.closest("[data-a]")?.dataset.a;
      if (v == null) return;
      closeSheet();
      resolve(v === "cancel" ? undefined : v === "skip" ? null : +v);
    };
  });
}

// ---------- generic sheets ----------
function closeSheet() {
  $("#sheet-root").innerHTML = "";
  $("#sheet-root").onclick = null;
  sheetOpen = false;
}

function confirmSheet({ title, body, ok, okClass = "primary", cancel = "Cancel", extra, extraHtml = "" }) {
  return new Promise((resolve) => {
    const root = $("#sheet-root");
    root.innerHTML = `<div class="scrim" data-v="cancel"></div>
      <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <h2>${esc(title)}</h2>${body ? `<p class="muted">${body}</p>` : ""}${extraHtml}
        <div class="actions">
          <button class="btn ${okClass} block" data-v="ok">${esc(ok)}</button>
          ${extra ? `<button class="btn danger block" data-v="extra">${esc(extra)}</button>` : ""}
          <button class="btn quiet block" data-v="cancel">${esc(cancel)}</button>
        </div></div>`;
    sheetOpen = true;
    root.onclick = (e) => {
      const t = e.target.closest("[data-v],[data-energy]");
      if (!t) return;
      if (t.dataset.energy) {
        root.querySelectorAll("[data-energy]").forEach((b) => b.setAttribute("aria-pressed", String(b === t)));
        return;
      }
      const v = t.dataset.v;
      const note = $("#finish-note", root)?.value ?? null;
      const energy = +($('[data-energy][aria-pressed="true"]', root)?.dataset.energy || 0) || null;
      closeSheet();
      resolve({ v, note, energy });
    };
  });
}

// ---------- swap ----------
function swapSheet(entry, isRehab) {
  return new Promise((resolve) => {
    const cur = db.get("exercise", entry.exerciseId);
    const pattern = cur?.pattern;
    let showAll = false;
    const root = $("#sheet-root");
    const draw = () => {
      const opts = exercises().filter((e) => e.id !== entry.exerciseId && (isRehab ? e.pattern === "calf-bent-knee" : showAll || e.pattern === pattern));
      $("#swap-list", root).innerHTML = opts.length
        ? `<ul class="rows">${opts.map((e) => `<li><button class="row" data-pick="${e.id}"><span class="r-main"><span class="r-title">${esc(e.name)}</span><br><span class="r-sub">${esc([e.equipment, ...(e.muscles || [])].join(", "))}</span></span></button></li>`).join("")}</ul>`
        : `<p class="muted">No other ${esc(PATTERNS[pattern] || "matching")} exercises in your library.</p>`;
    };
    root.innerHTML = `<div class="scrim" data-close></div>
      <div class="sheet" role="dialog" aria-modal="true" aria-label="Swap exercise">
        <div style="display:flex;align-items:center;justify-content:space-between"><h2>Swap ${esc(entry.name)}</h2><button class="icon-btn" data-close aria-label="Close">${I.x}</button></div>
        <p class="muted small">${isRehab ? "Your physio asked for bent-knee calf raises, so only those are offered." : `Same movement (${esc(PATTERNS[pattern] || "similar")}), so the program stays on track.`}</p>
        <div id="swap-list"></div>
        ${isRehab ? "" : `<button class="btn quiet block" data-all>Show every exercise</button>`}
        <div id="swap-when" hidden>
          <h3 style="margin-top:1rem">For how long?</h3>
          <div class="actions">
            <button class="btn primary block" data-when="today">Just today</button>
            <button class="btn block" data-when="block">For the rest of this block</button>
          </div>
        </div>
      </div>`;
    sheetOpen = true;
    draw();
    let picked = null;
    root.onclick = (e) => {
      const t = e.target.closest("[data-close],[data-pick],[data-all],[data-when]");
      if (!t) return;
      if ("all" in t.dataset) { showAll = true; t.remove(); draw(); return; }
      if (t.dataset.pick) {
        picked = t.dataset.pick;
        root.querySelectorAll("[data-pick]").forEach((b) => b.classList.toggle("picked", b.dataset.pick === picked));
        $("#swap-when", root).hidden = false;
        $("#swap-when", root).scrollIntoView({ block: "nearest" });
        return;
      }
      if (t.dataset.when && picked) { closeSheet(); resolve({ exerciseId: picked, when: t.dataset.when }); return; }
      closeSheet();
      resolve(null);
    };
  });
}

async function doSwap() {
  const { w, idx, e } = curEntry();
  if (!e || e.sets.some((s) => s.done)) return;
  const res = await swapSheet(e, e.role === "rehab");
  if (!res) return;
  const ex = db.get("exercise", res.exerciseId);
  const p = db.get("program", w.programId);
  const item = p?.sessions.find((s) => s.key === w.sessionKey)?.items.find((it) => it.key === e.itemKey)
    || { key: e.itemKey, sets: e.target.sets, repMin: e.target.repMin, repMax: e.target.repMax, restSec: e.target.restSec, role: e.role, note: e.note };
  const all = db.list("workout");
  w.entries[idx] = buildEntry(item, ex, all, { phase: w.phase, achilles: e.role === "rehab" ? w.achilles : null }, { swappedFrom: e.swappedFrom || e.exerciseId });
  db.put("workout", w);
  if (res.when === "block" && p) {
    for (const s of p.sessions) for (const it of s.items) if (it.exerciseId === e.exerciseId || it.exerciseId === e.swappedFrom) it.exerciseId = ex.id;
    db.put("program", p);
    toast(`${ex.name} for the rest of the block`);
  } else toast(`${ex.name} for today`);
  render();
}

// ---------- Runner ----------
const ADVICE_SHORT = {
  up: "Up from last time", hold: "Same weight, one more rep", deload: "Lighter today",
  new: "Find your working weight", "reps-only": "Top of the range: add load or a harder version",
};
const REF_TABS = [["move", "Movement"], ["form", "Cues"], ["muscles", "Muscles"], ["why", "Notes"]];

function viewRun() {
  if (activeWorkout()?.kind === "interval") { setTimeout(() => go("#/interval")); return ""; }
  const w = activeWorkout();
  if (!w) return `<header class="top"><a class="icon-btn" href="#/" aria-label="Back">${I.back}</a></header><div class="empty"><p>No session in progress.</p><a class="btn primary" href="#/">Go to today</a></div>`;
  const n = w.entries.length;
  const idx = Math.min(db.ui().runIndex || 0, Math.max(0, n - 1));
  const e = w.entries[idx];
  const ex = db.get("exercise", e.exerciseId);
  const t = e.target;
  const next = w.entries[idx + 1];
  const cfg = db.settings();
  const hue = hueFor(w.sessionKey);
  const st = (en) => { const d = en.sets.filter((s) => s.done).length; return d === 0 ? "none" : d >= en.sets.length ? "done" : "part"; };
  const allDone = e.sets.length && e.sets.every((s) => s.done);
  const askFeel = allDone && (w.phase === "calibration" || cfg.track?.feelAlways) && e.role !== "rehab";
  const curSi = e.sets.findIndex((s) => !s.done);
  const target = e.sets[curSi >= 0 ? curSi : 0];
  const targetText = target?.weight ? `${fmtKg(target.weight)} kg × ${target.reps}` : `${target?.reps ?? t.repMin} reps`;

  return `
  <header class="top run-top">
    <a class="icon-btn" href="#/" aria-label="Back to today">${I.back}</a>
    <div class="grow title run-title">${disc(w.sessionKey, hue)}<span>${esc(w.name)}</span></div>
    <span class="run-count">${idx + 1}/${n}</span>
    <button class="icon-btn" data-act="run-menu" aria-label="Session options">${I.more}</button>
  </header>
  <nav class="seq" aria-label="Exercises" data-hue="${hue}">
    ${w.entries.map((en, i) => `<button data-act="jump" data-i="${i}" data-state="${st(en)}" ${i === idx ? 'aria-current="step"' : ""} aria-label="${i + 1}: ${esc(en.name)}${st(en) === "done" ? ", done" : ""}"></button>`).join("")}
  </nav>

  <section class="focus" aria-label="Current exercise" data-hue="${hue}">
    <div class="ex-head">
      <h1 class="ex-title">${esc(e.name)}</h1>
      ${e.sets.some((s) => s.done) ? "" : `<button class="btn tonal sm swap-btn" data-act="swap" aria-label="Swap ${esc(e.name)}">${I.swap}Swap</button>`}
    </div>
    ${e.role === "rehab" || e.swappedFrom ? `<p class="ex-sub">${e.role === "rehab" ? `<span class="tag tag-rehab">Achilles rehab</span>${w.achilles != null ? ` Achilles today ${w.achilles}/10` : ""}` : ""}${e.swappedFrom ? `${e.role === "rehab" ? ". " : ""}Swapped in for ${esc(db.get("exercise", e.swappedFrom)?.name ?? "the planned exercise")}` : ""}</p>` : ""}
    <dl class="chips">
      <div><dt>Plan</dt><dd>${t.sets} × ${repRange(t)}</dd></div>
      <div><dt>Rest</dt><dd>${mmss(t.restSec)}</dd></div>
      <div class="chip-target" data-kind="${e.advice.kind}"><dt>${esc(ADVICE_SHORT[e.advice.kind] || "Target")}</dt><dd>${targetText}</dd></div>
    </dl>
    ${isBar(ex) ? `<div class="loadout" id="loadout">${loadoutHtml(e)}</div>` : ""}
    <div class="sets" role="table" aria-label="Sets">
      <div class="set-head" role="row"><span role="columnheader"><span class="sr">Set</span></span><span role="columnheader">${isBodyweight(ex) ? "Added kg" : "kg"}</span><span role="columnheader">Reps</span><span role="columnheader"><span class="sr">Done</span></span></div>
      ${e.sets.map((s, si) => (si === curSi ? `<div id="rest-slot"></div>` : "") + setRow(s, si, ex, cfg, si === curSi)).join("")}
      ${curSi < 0 ? `<div id="rest-slot"></div>` : ""}
    </div>
    <div class="set-tools">
      <button class="btn quiet sm" data-act="add-set">+ Add set</button>
      ${e.sets.length > 1 ? `<button class="btn quiet sm" data-act="remove-set">− Remove set</button>` : ""}
    </div>
    ${askFeel ? `<div class="feel" role="group" aria-label="How did ${esc(e.name)} feel?"><p>How did that feel?</p><div class="feel-btns">
        ${["easy", "right", "hard"].map((f) => `<button data-act="feel" data-v="${f}" aria-pressed="${e.feel === f}">${{ easy: "Easy", right: "About right", hard: "Hard" }[f]}</button>`).join("")}
      </div></div>` : ""}
  </section>

  ${ex ? referencePanel(e, ex, w, cfg) : ""}

  <div class="run-nav" data-hue="${hue}">
    ${next ? `<p class="up-next-line"><span class="muted">Next</span> ${esc(next.name)}, ${next.target.sets} × ${repRange(next.target)}</p>` : `<p class="up-next-line"><span class="muted">Last exercise</span></p>`}
    <div class="run-nav-btns">
      <button class="btn tonal icon-only" data-act="jump" data-i="${idx - 1}" ${idx === 0 ? "disabled" : ""} aria-label="Previous exercise">${I.back}</button>
      ${next ? `<button class="btn ${allDone ? "go" : "tonal"}" data-act="jump" data-i="${idx + 1}">Next exercise</button>`
             : `<button class="btn go" data-act="finish">Finish session</button>`}
    </div>
  </div>`;
}

/** Everything you might look up mid-session, in one place. */
function referencePanel(e, ex, w, cfg) {
  const motion = motionFor(ex);
  const tabs = REF_TABS.filter(([k]) => k !== "move" || motion);
  let cur = db.ui().refTab || "move";
  if (!tabs.some(([k]) => k === cur)) cur = tabs[0][0];
  const open = db.ui().refOpen !== false;
  const calfTarget = e.role === "rehab" && cfg.bodyweightKg ? `<p>Physio target: work up to your bodyweight, ${fmtKg(cfg.bodyweightKg)} kg.</p>` : "";
  const body = {
    move: () => movementHtml(motion, e.name),
    form: () => ex.cues?.length ? `<ol class="cues">${ex.cues.map((c) => `<li>${esc(c)}</li>`).join("")}</ol>` : `<p class="muted">No cues yet. Add some on the exercise page.</p>`,
    muscles: () => `<div class="ref-muscles">${bodyMap(ex.muscles || [], ex.secondary || [])}<p><strong>Main:</strong> ${esc((ex.muscles || []).join(", ") || "not set")}${ex.secondary?.length ? `<br><strong>Also:</strong> ${esc(ex.secondary.join(", "))}` : ""}</p></div>`,
    why: () => `<div class="ref-why">
        ${e.last ? `<p class="ref-last"><span class="muted">${fmtDate(e.last.at)}</span><br><strong>${setsText(e.last.sets)}</strong></p>` : `<p class="muted">First time doing this exercise.</p>`}
        <p>${esc(e.advice.text)}</p>${e.note ? `<p>${esc(e.note)}</p>` : ""}${calfTarget}
      </div>`,
  };
  return `<section class="ref ${open ? "open" : ""}" aria-label="Reference">
    <div class="ref-bar">
      <div class="seg" role="tablist" aria-label="Reference">${tabs.map(([k, label]) => `<button role="tab" data-act="ref-tab" data-v="${k}" aria-selected="${open && k === cur}">${label}</button>`).join("")}</div>
      <button class="icon-btn ref-toggle" data-act="ref-open" aria-expanded="${open}" aria-label="${open ? "Hide" : "Show"} reference">${open ? I.x : I.more}</button>
    </div>
    ${open ? `<div class="ref-body" role="tabpanel">${body[cur]()}</div>` : ""}
  </section>`;
}

function setRow(s, si, ex, cfg, current = false) {
  const step = incrementFor(ex) || 1;
  const effort = cfg.track?.effortPerSet ? `<div class="effort" role="group" aria-label="Reps left in set ${si + 1}"><span class="small muted">Reps left</span>${[0, 1, 2, 3].map((r) => `<button data-act="rir" data-si="${si}" data-v="${r}" aria-pressed="${s.rir === r}">${r === 3 ? "3+" : r}</button>`).join("")}</div>` : "";
  return `<div class="set ${s.done ? "done" : ""} ${current ? "current" : ""}" data-si="${si}" role="row">
    <span class="idx">${si + 1}</span>
    <div class="stepper">
      <button data-act="step" data-f="weight" data-si="${si}" data-d="${-step}" aria-label="Less weight" tabindex="-1">−</button>
      <input type="number" inputmode="decimal" step="any" min="0" data-sfield="weight" data-si="${si}" value="${s.weight ?? ""}" placeholder="kg" aria-label="Set ${si + 1} weight in kg" ${s.done ? "readonly" : ""}>
      <button data-act="step" data-f="weight" data-si="${si}" data-d="${step}" aria-label="More weight" tabindex="-1">+</button>
    </div>
    <div class="stepper">
      <button data-act="step" data-f="reps" data-si="${si}" data-d="-1" aria-label="Fewer reps" tabindex="-1">−</button>
      <input type="number" inputmode="numeric" min="0" data-sfield="reps" data-si="${si}" value="${s.reps ?? ""}" aria-label="Set ${si + 1} reps" ${s.done ? "readonly" : ""}>
      <button data-act="step" data-f="reps" data-si="${si}" data-d="1" aria-label="More reps" tabindex="-1">+</button>
    </div>
    <button class="tick" data-act="tick" data-si="${si}" aria-pressed="${s.done}" aria-label="${s.done ? "Undo" : "Done"} set ${si + 1}">${I.check}</button>
  </div>${s.done ? effort : ""}`;
}

function loadoutHtml(e) {
  const cur = e.sets.find((s) => !s.done) || e.sets[e.sets.length - 1];
  const w = +cur?.weight;
  const cfg = db.settings();
  if (!w) return "";
  const p = plateSvg(w, cfg.barKg, cfg.plates);
  let label;
  if (w < cfg.barKg) label = `Lighter than the ${fmtKg(cfg.barKg)} kg bar`;
  else if (!p.label || p.label === "Empty bar") label = `Just the ${fmtKg(cfg.barKg)} kg bar`;
  else label = `Each side: <strong>${p.label}</strong>${p.remainder > 0.001 ? `, ${fmtKg(p.remainder)} kg short` : ""}`;
  return `${w >= cfg.barKg ? p.svg : ""}<p class="plate-label">${label}</p>`;
}

function curEntry() {
  const w = activeWorkout();
  if (!w) return {};
  const idx = Math.min(db.ui().runIndex || 0, w.entries.length - 1);
  return { w, idx, e: w.entries[idx] };
}

async function finishWorkout() {
  const w = activeWorkout();
  if (!w) return;
  const open = w.entries.reduce((a, e) => a + e.sets.filter((s) => !s.done).length, 0);
  const done = w.entries.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0);
  if (!done) {
    const { v } = await confirmSheet({ title: "No sets ticked yet", body: "Tick the sets you've done, or discard this session.", ok: "Keep going", extra: "Discard session", cancel: "Cancel" });
    if (v === "extra") discardWorkout(w);
    return;
  }
  const cfg = db.settings();
  const notes = cfg.track?.sessionNotes ? `
    <label class="field"><span>Notes (optional)</span><textarea class="input" id="finish-note" placeholder="Anything worth remembering"></textarea></label>
    <div class="field"><span class="small" style="font-weight:600">Energy today</span><div class="toggles" style="margin-top:.35rem">${[1, 2, 3, 4, 5].map((n) => `<button data-energy="${n}" aria-pressed="false">${n}</button>`).join("")}</div></div>` : "";
  const { v, note, energy } = await confirmSheet({
    title: "Finish session?",
    body: open ? `${plural(open, "set")} ${open === 1 ? "isn't" : "aren't"} ticked and won't be saved.` : "Every set is ticked.",
    ok: "Finish session", cancel: "Keep going", extraHtml: notes,
  });
  if (v !== "ok") return;
  w.finishedAt = Date.now();
  if (note) w.note = note;
  if (energy) w.energy = energy;
  w.entries = w.entries.map((e) => ({ ...e, sets: e.sets.filter((s) => s.done) })).filter((e) => e.sets.length);
  db.put("workout", w);
  db.ui({ activeWorkoutId: null, rest: null, runIndex: 0, pendingCoach: w.id });
  go(`#/workout/${w.id}`);
  maybeRunPendingCoach();
}

function discardWorkout(w) {
  db.remove("workout", w.id);
  db.ui({ activeWorkoutId: null, rest: null, runIndex: 0 });
  go("#/");
  toast("Session discarded");
}

// ---------- Rest timer ----------
let audio;
function beep() {
  try {
    audio ||= new AudioContext();
    const o = audio.createOscillator(), g = audio.createGain();
    o.frequency.value = 880; o.connect(g); g.connect(audio.destination);
    g.gain.setValueAtTime(0.0001, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.3, audio.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.5);
    o.start(); o.stop(audio.currentTime + 0.55);
  } catch {}
}
let restTimer = null;
let restAlerted = false;
function startRest(sec, label) {
  if (!sec) return;
  restAlerted = false;
  try { audio ||= new AudioContext(); audio.resume?.(); } catch {}
  db.ui({ rest: { endsAt: Date.now() + sec * 1000, total: sec, label } });
}
function renderRest() {
  // On the session screen the timer docks inline, right above the set you're about to do.
  const floating = $("#rest");
  floating.hidden = true; floating.innerHTML = "";
  const el = $("#rest-slot");
  const rest = db.ui().rest;
  clearInterval(restTimer);
  if (!el) return;
  if (!rest || route().name !== "run") { el.innerHTML = ""; return; }
  el.innerHTML = `<div class="rest-card" role="timer" aria-live="off">
    <div class="bar"></div>
    <div class="rest-label">${esc(rest.label || "Rest")}</div>
    <div class="rest-row">
      <div class="rest-time"></div>
      <button class="btn" data-act="rest-add" data-d="-15">−15</button>
      <button class="btn" data-act="rest-add" data-d="15">+15</button>
      <button class="btn" data-act="rest-skip">Done</button>
    </div></div>`;
  const tick = () => {
    const left = (rest.endsAt - Date.now()) / 1000;
    const card = $(".rest-card", el);
    if (!card) return;
    $(".rest-time", el).textContent = left >= 0 ? mmss(Math.ceil(left)) : `+${mmss(-left)}`;
    $(".bar", el).style.width = `${Math.max(0, Math.min(100, (left / rest.total) * 100))}%`;
    card.classList.toggle("over", left < 0);
    if (left <= 0 && !restAlerted) {
      restAlerted = true;
      navigator.vibrate?.([250, 120, 250]);
      beep();
      $(".rest-label", el).textContent = "Rest over. Next set.";
    }
    if (left < -300) db.ui({ rest: null });
  };
  tick();
  restTimer = setInterval(tick, 250);
}

// ---------- Wake lock ----------
let lock = null;
async function wakeLock(on) {
  try {
    if (on && !lock && "wakeLock" in navigator && document.visibilityState === "visible") {
      lock = await navigator.wakeLock.request("screen");
      lock.addEventListener("release", () => { lock = null; });
    } else if (!on && lock) {
      await lock.release(); lock = null;
    }
  } catch { lock = null; }
}
document.addEventListener("visibilitychange", () => { if (route().name === "run") wakeLock(true); });

// ---------- Other workouts: interval (HIIT) routines ----------
const intervalRoutines = () => db.list("routine").filter((r) => r.format === "interval").sort((a, b) => a.name.localeCompare(b.name));
const routineSummary = (r) => {
  const L = iv.levelOf(r.level || 1), sc = iv.schedule(r.items, r.level || 1);
  return `${r.items.length} moves, ${L.work} s on, ${L.rest} s off, ${L.rounds} rounds, about ${iv.minutes(sc)} min`;
};

function otherWorkouts() {
  const rs = intervalRoutines();
  if (!rs.length) return "";
  return `<div class="section-head"><h2>Other workouts</h2></div>
  <ul class="rows">${rs.map((r) => `<li><a href="#/routine/${r.id}">${disc("KB", "none")}<span class="r-main"><span class="r-title">${esc(r.name)}</span><span class="r-sub">${esc(routineSummary(r))}</span></span><span class="chev" aria-hidden="true">›</span></a></li>`).join("")}</ul>`;
}

function viewRoutine(id) {
  const r = db.get("routine", id);
  if (!r || r.format !== "interval") return `<header class="top"><a class="icon-btn" href="#/" aria-label="Back">${I.back}</a></header><p>Workout not found.</p>${tabs("today")}`;
  const ex = exById();
  const L = iv.levelOf(r.level || 1);
  const last = finished().find((w) => w.routineId === r.id);
  const busy = activeWorkout();
  return `<header class="top"><a class="icon-btn" href="#/" aria-label="Back to today">${I.back}</a><div class="grow title">Other workouts</div></header>
  <h1>${esc(r.name)}</h1>
  <p class="prose" style="margin:var(--space-3) 0 var(--space-4)">${esc(r.description || "")}</p>
  <dl class="chips">
    <div><dt>Level</dt><dd>${r.level || 1} of ${iv.LEVELS.length}</dd></div>
    <div><dt>Work / rest</dt><dd>${L.work} / ${L.rest} s</dd></div>
    <div><dt>${L.rounds} rounds</dt><dd>${iv.minutes(iv.schedule(r.items, r.level || 1))} min</dd></div>
  </dl>
  <p class="small muted">${last ? `Last done ${fmtDate(last.startedAt)}${last.feel ? `, felt ${last.feel === "right" ? "about right" : last.feel}` : ""}. ` : ""}The level goes up when it feels easy (or about right twice running) and down when it's hard.</p>
  <div class="section-head"><h2>Moves</h2><span class="small muted">Bell weight</span></div>
  <ol class="iv-moves">${r.items.map((it, i) => {
    const e = ex[it.exerciseId];
    return `<li>
      <a class="iv-move-name" href="#/exercise/${it.exerciseId}"><span>${esc(e?.name ?? it.exerciseId)}</span>
        <span class="r-sub">${[it.sides ? "Both sides, switch halfway" : "", e?.pivot ? "Pivots on the back foot" : "", it.note].filter(Boolean).map(esc).join(". ")}</span></a>
      <div class="stepper iv-bell"><button data-act="iv-bell" data-id="${r.id}" data-i="${i}" data-d="-2" aria-label="Lighter bell">−</button><span class="num">${fmtKg(it.bell || 0)}<small> kg</small></span><button data-act="iv-bell" data-id="${r.id}" data-i="${i}" data-d="2" aria-label="Heavier bell">+</button></div>
    </li>`;
  }).join("")}</ol>
  <div style="margin-top:var(--space-5)"><button class="btn primary block" data-act="iv-begin" data-id="${r.id}" ${busy ? "disabled" : ""}>Start ${esc(r.name)}</button>
  ${busy ? `<p class="small muted" style="margin-top:var(--space-2)">Finish the workout in progress first.</p>` : ""}</div>
  ${tabs("today")}`;
}

async function beginInterval(routineId) {
  const r = db.get("routine", routineId);
  if (!r) return;
  try { audio ||= new AudioContext(); audio.resume?.(); } catch {}
  const ex = exById();
  let achilles = null;
  if (r.items.some((it) => ex[it.exerciseId]?.pivot)) {
    achilles = await achillesSheet();
    if (achilles === undefined) return;
  }
  const prev = finished().find((w) => w.achilles != null)?.achilles ?? null;
  const plantToday = achilles != null && (achilles >= 4 || (prev != null && achilles - prev >= 2));
  const L = iv.levelOf(r.level || 1);
  const swapped = [];
  const entries = r.items.map((it) => {
    let e = ex[it.exerciseId];
    let swappedFrom = null;
    if (plantToday && e?.pivot && ex[e.planted]) { swappedFrom = e.id; swapped.push(`${e.name} → ${ex[e.planted].name}`); e = ex[e.planted]; }
    return {
      exerciseId: e?.id ?? it.exerciseId, name: e?.name ?? "Move", sides: !!it.sides, note: it.note || "", swappedFrom,
      sets: Array.from({ length: L.rounds }, () => ({ weight: +it.bell || 0, secs: L.work, done: false })),
    };
  });
  const w = db.put("workout", {
    id: db.uid("w"), kind: "interval", routineId: r.id, name: r.name, level: r.level || 1,
    work: L.work, rest: L.rest, rounds: L.rounds, startedAt: Date.now(), finishedAt: null, achilles, entries, feel: null,
  });
  db.ui({ activeWorkoutId: w.id, interval: { clock: { t0: Date.now(), pausedAt: null }, skipped: [], lastPhase: -1 }, rest: null });
  if (swapped.length) toast(`Achilles ${achilles}/10: ${swapped.join(", ")} today`);
  go("#/interval");
}

function intervalState() {
  const w = activeWorkout();
  const st = db.ui().interval;
  if (!w || w.kind !== "interval" || !st) return null;
  const sched = iv.schedule(w.entries, w.level);
  const el = iv.elapsedOf(st.clock);
  return { w, st, sched, el, pos: iv.at(sched, el) };
}

function intervalFocusExercise() {
  const S = intervalState();
  if (!S || S.pos.done) return null;
  return S.w.entries[S.pos.phase.ex]?.exerciseId;
}

const PHASE_LABEL = { ready: "Get ready", work: "Work", rest: "Rest", roundRest: "Round rest" };

function viewInterval() {
  const S = intervalState();
  if (!S) return `<header class="top"><a class="icon-btn" href="#/" aria-label="Back">${I.back}</a></header><div class="empty"><p>No workout in progress.</p><a class="btn primary" href="#/">Go to today</a></div>`;
  const { w, st, sched, pos } = S;
  const head = `<header class="top run-top">
    <a class="icon-btn" href="#/" aria-label="Back to today">${I.back}</a>
    <div class="grow title run-title">${disc("KB", "none")}<span>${esc(w.name)}</span></div>
    <button class="icon-btn" data-act="iv-menu" aria-label="Workout options">${I.more}</button></header>`;

  if (pos.done) {
    const done = iv.completed(sched, S.el, st.skipped).length;
    return `${head}
    <section class="iv-done">
      <p class="iv-phase">Finished</p>
      <h1>${done} of ${sched.phases.filter((p) => p.type === "work").length} intervals</h1>
      <div class="feel" role="group" aria-label="How did it feel?"><p>How did that feel?</p><div class="feel-btns">
        ${["easy", "right", "hard"].map((f) => `<button data-act="iv-feel" data-v="${f}" aria-pressed="${w.feel === f}">${{ easy: "Easy", right: "About right", hard: "Hard" }[f]}</button>`).join("")}
      </div><p class="small muted" style="margin-top:var(--space-3)">Sets next time's level: work time, rest and rounds.</p></div>
      <button class="btn primary block" data-act="iv-finish" style="margin-top:var(--space-5)">Save workout</button>
    </section>`;
  }

  const p = pos.phase;
  const e = w.entries[p.ex];
  const ex = db.get("exercise", e.exerciseId);
  const working = p.type === "work";
  const works = sched.phases.map((ph, i) => ({ ph, i })).filter(({ ph }) => ph.type === "work");
  const doneSet = new Set(iv.completed(sched, S.el, st.skipped).map((c) => `${c.round}:${c.ex}`));
  const sideText = working && p.switchAt != null ? (pos.side === 1 ? "First side" : "Second side") : "";
  return `${head}
  <nav class="seq iv-seq" aria-label="Intervals">${works.map(({ ph, i }) => `<span data-state="${doneSet.has(`${ph.round}:${ph.ex}`) ? "done" : "none"}" ${i === pos.i ? 'aria-current="step"' : ""}></span>`).join("")}</nav>
  <section class="iv-focus" data-phase="${p.type}" aria-live="polite">
    <div class="iv-row"><span class="iv-phase">${PHASE_LABEL[p.type]}${p.type === "work" ? "" : working ? "" : ", next up"}</span><span class="iv-round">Round ${p.round + 1} of ${sched.rounds}</span></div>
    <div class="iv-clock" data-iv-clock>${mmss(Math.ceil(pos.left))}</div>
    <h1 class="iv-move">${esc(e.name)}</h1>
    <p class="iv-meta">${e.sets[0]?.weight ? `<strong>${fmtKg(e.sets[0].weight)} kg</strong>` : "Bodyweight"}${sideText ? ` <span class="iv-side" data-iv-side>${sideText}</span>` : e.sides ? " <span class=\"iv-side\">Both sides</span>" : ""}${e.swappedFrom ? ` <span class="tag">Swapped for your Achilles</span>` : ""}</p>
  </section>
  ${ex && motionFor(ex) ? `<div class="mv-card">${movementHtml(motionFor(ex), e.name)}</div>` : ""}
  ${ex?.cues?.length ? `<ol class="cues iv-cues">${ex.cues.map((c) => `<li>${esc(c)}</li>`).join("")}</ol>` : ""}
  <div class="run-nav iv-nav">
    <div class="iv-btns">
      <button class="btn tonal icon-only" data-act="iv-back" aria-label="Back">${I.back}</button>
      <button class="btn primary" data-act="iv-pause">${st.clock.pausedAt ? "Resume" : "Pause"}</button>
      <button class="btn tonal icon-only" data-act="iv-skip" aria-label="Skip">${I.back.replace("<svg", '<svg style="transform:scaleX(-1)"')}</button>
    </div>
  </div>`;
}

let ivTicker = null;
function stopIntervalTicker() { clearInterval(ivTicker); ivTicker = null; }
function startIntervalTicker() {
  stopIntervalTicker();
  let lastSide = null, lastBeepSec = null;
  ivTicker = setInterval(() => {
    const S = intervalState();
    if (!S) return stopIntervalTicker();
    const { st, pos } = S;
    if ((pos.done ? -2 : pos.i) !== st.lastPhase) {
      // Phase changed: record progress, signal, redraw.
      saveIntervalProgress(S);
      if (st.lastPhase !== -1 || pos.i > 0) cue(pos.done ? "done" : pos.phase.type);
      db.ui({ interval: { ...st, lastPhase: pos.done ? -2 : pos.i } });
      lastSide = null;
      return render();
    }
    if (pos.done || st.clock.pausedAt) return;
    const clock = $("[data-iv-clock]");
    if (clock) clock.textContent = mmss(Math.ceil(pos.left));
    const sec = Math.ceil(pos.left);
    if (sec <= 3 && sec >= 1 && sec !== lastBeepSec && pos.phase.type !== "work") { lastBeepSec = sec; tone(660, 0.12); }
    if (pos.side && lastSide && pos.side !== lastSide) { cue("switch"); const el = $("[data-iv-side]"); if (el) el.textContent = "Second side"; }
    lastSide = pos.side || lastSide;
  }, 200);
}

function tone(freq, dur, at = 0) {
  try {
    audio ||= new AudioContext();
    const o = audio.createOscillator(), g = audio.createGain();
    o.frequency.value = freq; o.connect(g); g.connect(audio.destination);
    const t = audio.currentTime + at;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.05);
  } catch {}
}
function cue(kind) {
  if (kind === "work") { tone(990, 0.18); tone(990, 0.3, 0.22); navigator.vibrate?.([200, 80, 200]); }
  else if (kind === "switch") { tone(880, 0.25); navigator.vibrate?.([120, 60, 120, 60, 120]); }
  else if (kind === "done") { tone(660, 0.2); tone(880, 0.2, 0.22); tone(1100, 0.4, 0.44); navigator.vibrate?.([300, 100, 300]); }
  else { tone(520, 0.35); navigator.vibrate?.(300); }
}

function saveIntervalProgress(S) {
  const { w, st, sched, el } = S;
  const done = new Set(iv.completed(sched, el, st.skipped).map((c) => `${c.round}:${c.ex}`));
  let changed = false;
  w.entries.forEach((e, ei) => e.sets.forEach((set, r) => {
    const d = done.has(`${r}:${ei}`);
    if (set.done !== d) { set.done = d; changed = true; }
  }));
  if (changed) db.put("workout", w);
}

function intervalControl(action) {
  const S = intervalState();
  if (!S) return;
  const { st, sched, el, pos } = S;
  let clock = st.clock, skipped = st.skipped;
  if (action === "pause") clock = clock.pausedAt ? iv.resume(clock) : iv.pause(clock);
  if (action === "skip") {
    if (pos.phase?.type === "work" && pos.into < pos.phase.secs / 2) skipped = [...skipped, pos.i];
    clock = iv.seek(clock, iv.skipTo(sched, el));
  }
  if (action === "back") {
    const to = iv.backTo(sched, el);
    const target = iv.at(sched, to).i;
    skipped = skipped.filter((i) => i < target);
    clock = iv.seek(clock, to);
  }
  db.ui({ interval: { ...st, clock, skipped } });
  render();
}

async function finishInterval(early) {
  const S = intervalState();
  if (!S) return;
  const { w, st, sched, el } = S;
  if (early) {
    const done = iv.completed(sched, el, st.skipped).length;
    if (!done) {
      const { v } = await confirmSheet({ title: "Nothing done yet", body: "No interval has been finished, so there's nothing to save.", ok: "Keep going", extra: "Discard workout" });
      if (v === "extra") { db.ui({ interval: null }); discardWorkout(w); }
      return;
    }
  }
  saveIntervalProgress(S);
  w.finishedAt = Date.now();
  w.roundsDone = Math.max(0, ...iv.completed(sched, el, st.skipped).map((c) => c.round + 1));
  w.entries = w.entries.map((e) => ({ ...e, sets: e.sets.filter((x) => x.done) })).filter((e) => e.sets.length);
  db.put("workout", w);
  const r = db.get("routine", w.routineId);
  if (r && w.feel) {
    const prevFeel = finished().find((x) => x.routineId === r.id && x.id !== w.id)?.feel;
    const next = iv.nextLevel(r.level || 1, w.feel, prevFeel);
    if (next !== (r.level || 1)) { r.level = next; db.put("routine", r); toast(`Next time: level ${next}`); }
  }
  db.ui({ activeWorkoutId: null, interval: null, pendingCoach: w.id });
  go(`#/workout/${w.id}`);
  maybeRunPendingCoach();
}

// ---------- Coach ----------
let coachBusy = null;      // trigger currently running
let coachError = null;     // { message, noKey }
let coachInfo = { available: null };

async function callCoach(trigger, message = "") {
  if (coachBusy) return null;
  coachBusy = trigger; coachError = null; render();
  try {
    await db.runSync();
    const res = await fetch("/api/coach", {
      method: "POST", headers: { "content-type": "application/json" }, redirect: "manual",
      body: JSON.stringify({ trigger, message }),
    });
    if (res.type === "opaqueredirect") throw new Error("Your sign-in has expired. Use Sign in again at the top of the page.");
    const body = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error(body.message || "The server couldn't confirm who you are.");
    if (res.status === 503 && body.error === "no_key") { coachInfo.available = false; throw Object.assign(new Error(body.message), { noKey: true }); }
    if (!res.ok) throw new Error(body.message || `The coach couldn't answer (${res.status}).`);
    await db.runSync();
    return body.log;
  } catch (e) {
    coachError = { message: e.message || "The coach couldn't be reached.", noKey: !!e.noKey };
    return null;
  } finally {
    coachBusy = null; render();
  }
}

let autoTriedFor = null;
/** Review the last finished session once it can reach the server. One automatic try per session. */
async function maybeRunPendingCoach() {
  const id = db.ui().pendingCoach;
  if (!id || coachBusy || !navigator.onLine || coachInfo.available === false || autoTriedFor === id) return;
  autoTriedFor = id;
  lastCoachRequest = { trigger: "session", message: "" };
  const log = await callCoach("session");
  if (log || coachError?.noKey) db.ui({ pendingCoach: null });
  else if (!navigator.onLine) autoTriedFor = null; // went offline mid-call: try again when back
}

function undoCoach(log) {
  const b = log.before;
  if (!b) return;
  if (b.newProgramId) db.remove("program", b.newProgramId);
  for (const p of b.programs || []) db.put("program", { ...p, status: "active" });
  db.put("coachlog", { ...log, undone: true });
  toast("Undone");
}

function logCard(l, { compact = false } = {}) {
  return `<article class="log ${l.undone ? "undone" : ""}">
    <div class="log-head"><span class="small muted">${fmtDate(l.at)}, ${fmtTime(l.at)}${l.trigger === "ask" ? "" : l.trigger === "new-block" ? ", new block" : ", after your session"}</span>
      ${l.before && !l.undone ? `<button class="btn sm quiet" data-act="undo-coach" data-id="${l.id}">Undo</button>` : l.undone ? `<span class="small muted">Undone</span>` : ""}</div>
    ${l.request ? `<p class="you">“${esc(l.request)}”</p>` : ""}
    ${l.message ? `<p class="coach-msg">${esc(l.message)}</p>` : ""}
    ${l.changes?.length ? `<ul class="changes">${l.changes.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>` : compact ? "" : `<p class="small muted">${esc(l.summary || "No changes")}</p>`}
    ${l.skipped?.length && !compact ? `<details class="small muted"><summary>${plural(l.skipped.length, "suggestion")} not applied</summary><ul>${l.skipped.map((s) => `<li>${esc(s)}</li>`).join("")}</ul></details>` : ""}
  </article>`;
}

function coachStatus() {
  if (coachBusy) return `<div class="coach-busy" role="status"><span class="spinner" aria-hidden="true"></span>${coachBusy === "session" ? "Coach is reviewing your session…" : coachBusy === "new-block" ? "Coach is writing your next block. This can take a minute…" : "Coach is thinking…"}</div>`;
  if (coachError) return coachError.noKey
    ? `<div class="banner">The coach isn't switched on yet. Add an <strong>ANTHROPIC_API_KEY</strong> secret to the Worker (see the app README), then try again.</div>`
    : `<div class="banner">${esc(coachError.message)} <button class="btn sm" data-act="coach-retry">Try again</button></div>`;
  return "";
}

let lastCoachRequest = null;
function viewCoach() {
  const logs = db.list("coachlog").sort((a, b) => b.at - a.at);
  return `
  <header class="top"><div class="grow"><h1>Coach</h1></div><button class="btn quiet sm" data-act="coach-run" data-trigger="new-block" ${coachBusy ? "disabled" : ""}>New block</button></header>
  ${signinBanner()}
  <form class="ask" data-form="ask">
    <label for="ask-q" class="sr">Ask or tell your coach</label>
    <textarea id="ask-q" class="input" rows="2" placeholder="Ask or tell your coach: sore Achilles, short on time, machine busy…"></textarea>
    <button class="btn primary" type="submit" ${coachBusy ? "disabled" : ""}>Send</button>
  </form>
  ${coachStatus()}
  <p class="small muted" style="margin:.75rem 0">Your coach reviews each session when you finish and changes the plan when it needs to. Every change has a reason, and you can undo it.</p>
  ${logs.length ? logs.map((l) => logCard(l)).join("") : `<p class="muted">Nothing yet. Finish a session or ask a question.</p>`}
  ${tabs("coach")}`;
}

// ---------- Workout detail ----------
function bestBefore(exerciseId, before) {
  let best = 0;
  for (const w of finished()) {
    if (w.startedAt >= before) continue;
    for (const e of w.entries) if (e.exerciseId === exerciseId) for (const s of e.sets) best = Math.max(best, e1rm(+s.weight || 0, s.reps));
  }
  return best;
}

function viewWorkout(id) {
  const w = db.get("workout", id);
  if (!w) return `<header class="top"><a class="icon-btn" href="#/history" aria-label="Back">${I.back}</a></header><p>This session was deleted.</p>`;
  const sets = w.entries.flatMap((e) => e.sets);
  const vol = sets.reduce((a, s) => a + (+s.weight || 0) * (s.reps || 0), 0);
  const log = db.list("coachlog").filter((l) => l.trigger === "session" && l.at >= w.finishedAt).sort((a, b) => a.at - b.at)[0];
  const justNow = db.ui().pendingCoach === w.id || (Date.now() - w.finishedAt < 15 * 60e3);
  return `
  <header class="top">
    <a class="icon-btn" href="#/history" aria-label="Back to history">${I.back}</a>
    <div class="grow title">${fmtDate(w.startedAt)}</div>
    <button class="btn quiet danger sm" data-act="delete-workout" data-id="${w.id}">Delete</button>
  </header>
  <div class="title-with-disc">${w.sessionKey ? disc(w.sessionKey, hueFor(w.sessionKey, db.get("program", w.programId))) : ""}<h1>${esc(w.name)}</h1></div>
  <div class="stat-line">
    ${w.finishedAt && w.finishedAt - w.startedAt >= 60e3 ? `<div>${fmtDur(w.finishedAt - w.startedAt)}<small>duration</small></div>` : ""}
    <div>${sets.length}<small>sets</small></div>
    ${vol > 0 ? `<div>${Math.round(vol).toLocaleString("en-AU")}<small>kg lifted</small></div>` : ""}
    ${w.kind === "interval" ? `<div>${w.roundsDone ?? "–"}/${w.rounds ?? "–"}<small>rounds</small></div><div>${w.level ?? 1}<small>level</small></div>` : ""}
    ${w.achilles != null ? `<div>${w.achilles}/10<small>Achilles</small></div>` : ""}
  </div>
  ${justNow || log ? `<section class="coach-on-workout"><h2>Coach</h2>${log ? logCard(log, { compact: true }) : coachStatus() || `<p class="muted small">Your coach reviews this session when you're back online.</p>`}</section>` : ""}
  ${w.note ? `<p class="prose">“${esc(w.note)}”</p>` : ""}
  ${w.entries.map((e) => {
    const best = Math.max(...e.sets.map((s) => e1rm(+s.weight || 0, s.reps)));
    const prev = bestBefore(e.exerciseId, w.startedAt);
    const pr = best > 0 && prev > 0 && best > prev + 0.01;
    return `<div class="wo-ex">
      <h3><a href="#/exercise/${e.exerciseId}" style="text-decoration:none">${esc(e.name)}</a>${pr ? `<span class="badge">New best</span>` : ""}${e.feel ? `<span class="small muted" style="font-family:var(--text);font-weight:400">felt ${e.feel === "right" ? "about right" : e.feel}</span>` : ""}</h3>
      <div class="wo-sets">${groupSets(e.sets).map((g) => `<span>${g}</span>`).join("")}</div>
    </div>`;
  }).join("")}
  ${tabs("history")}`;
}

/** "3 × 8 at 60 kg" instead of repeating identical sets. */
function groupSets(sets) {
  const out = [];
  for (const s of sets) {
    const k = `${+s.weight || 0}|${s.reps}|${s.secs}`;
    const last = out[out.length - 1];
    if (last && last.k === k) last.n++;
    else out.push({ k, n: 1, w: +s.weight || 0, r: s.reps, secs: s.secs });
  }
  return out.map((g) => g.secs
    ? `${g.n} × ${g.secs} s${g.w ? ` at ${fmtKg(g.w)} kg` : ""}`
    : `${g.n > 1 ? `${g.n} × ` : ""}${g.r}${g.w ? ` at ${fmtKg(g.w)} kg` : " reps"}`);
}

// ---------- History ----------
function viewHistory() {
  const ws = finished();
  return `
  <header class="top"><div class="grow"><h1>History</h1></div>${syncDot()}</header>
  ${ws.length ? `<ul class="rows">${ws.map((w) => {
    const sets = w.entries.reduce((a, e) => a + e.sets.length, 0);
    return `<li><a href="#/workout/${w.id}">${disc(w.kind === "interval" ? "KB" : w.sessionKey ?? "", w.sessionKey ? hueFor(w.sessionKey, db.get("program", w.programId)) : "none")}<span class="r-main"><span class="r-title">${esc(w.name)}</span><br><span class="r-sub">${fmtDate(w.startedAt)}, ${fmtDur(w.finishedAt - w.startedAt)}</span></span><span class="r-side">${sets} sets</span></a></li>`;
  }).join("")}</ul>` : `<div class="empty"><p>Finished sessions show up here.</p><a class="btn primary" href="#/">Go to today</a></div>`}
  ${tabs("history")}`;
}

// ---------- Progress ----------
function personalBests(ws, limit = 8) {
  const chron = [...ws].sort((a, b) => a.startedAt - b.startedAt);
  const best = {};
  const out = [];
  for (const w of chron) {
    for (const e of w.entries) {
      for (const s of e.sets) {
        const v = e1rm(+s.weight || 0, s.reps);
        if (!v) continue;
        if (best[e.exerciseId] && v > best[e.exerciseId] + 0.01) out.push({ at: w.startedAt, name: e.name, exerciseId: e.exerciseId, weight: +s.weight, reps: s.reps, est: v, wid: w.id });
        best[e.exerciseId] = Math.max(best[e.exerciseId] || 0, v);
      }
    }
  }
  const dedup = [];
  const seen = new Set();
  for (const p of out.reverse()) { const k = p.wid + p.exerciseId; if (!seen.has(k)) { seen.add(k); dedup.push(p); } }
  return dedup.slice(0, limit);
}

function viewProgress() {
  const p = activeProgram();
  const ws = finished();
  const ex = exById();
  const thisWeek = weekStart(Date.now());
  const now = setsPerMuscle(ws, ex, thisWeek, thisWeek + WEEK);
  const last = setsPerMuscle(ws, ex, thisWeek - WEEK, thisWeek);
  const targets = p?.targets || {};
  const pri = new Set(p?.priorities || []);
  const gap = (m) => (now[m] || 0) / targets[m];
  const muscles = MUSCLES.filter((m) => (targets[m] || 0) > 0).sort((a, b) => (pri.has(b) - pri.has(a)) || gap(a) - gap(b));
  const fmt1 = (v) => (Math.round(v * 2) / 2).toString();

  const volume = muscles.map((m) => {
    const v = now[m] || 0, t = targets[m];
    const pct = Math.min(130, (v / t) * 100);
    return `<li class="vol">
      <div class="vol-label"><span>${pri.has(m) ? `<i class="pri-dot" title="Priority"></i>` : ""}${esc(m)}${pri.has(m) ? `<span class="sr"> (priority)</span>` : ""}</span><span><span class="num">${fmt1(v)}</span> <span class="muted small">of ${t}, last week ${fmt1(last[m] || 0)}</span></span></div>
      <div class="vol-track" aria-hidden="true"><div class="vol-bar ${v >= t ? "met" : ""}" style="width:${(pct / 130) * 100}%"></div><div class="vol-target" style="left:${(100 / 130) * 100}%"></div></div>
    </li>`;
  }).join("");

  // consistency: last 8 weeks
  const weeks = Array.from({ length: 8 }, (_, i) => thisWeek - (7 - i) * WEEK);
  const counts = weeks.map((s) => ws.filter((w) => w.startedAt >= s && w.startedAt < s + WEEK).length);
  const goal = p?.sessions.length || 3;
  const maxC = Math.max(goal, ...counts);
  const W = 320, H = 120, L = 6, Bm = 20, bw = (W - L * 2) / 8;
  const y = (c) => H - Bm - (c / maxC) * (H - Bm - 10);
  const consistency = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Sessions per week for the last 8 weeks: ${counts.join(", ")}">
    <line x1="${L}" x2="${W - L}" y1="${y(goal)}" y2="${y(goal)}" class="goal-line"/>
    ${counts.map((c, i) => `<g><title>Week of ${fmtShort(weeks[i])}: ${plural(c, "session")}</title>
      <rect x="${L + i * bw + 5}" y="${y(c)}" width="${bw - 10}" height="${Math.max(0, H - Bm - y(c))}" rx="4" class="${i === 7 ? "bar-now" : "bar"}"/>
      <text x="${L + i * bw + bw / 2}" y="${y(c) - 4}" text-anchor="middle" class="bar-num">${c || ""}</text>
      <text x="${L + i * bw + bw / 2}" y="${H - 5}" text-anchor="middle" class="bar-x">${i === 7 ? "Now" : i === 0 || new Date(weeks[i]).getMonth() !== new Date(weeks[i - 1]).getMonth() ? fmtShort(weeks[i]) : new Date(weeks[i]).getDate()}</text></g>`).join("")}
  </svg>`;

  const pbs = personalBests(ws);
  const mains = p ? [...new Set(p.sessions.flatMap((s) => s.items.filter((it) => it.role === "main").map((it) => it.exerciseId)))] : [];
  const mainRows = mains.map((id) => {
    const t = trend(history(ws, id));
    if (!t.length) return `<li><a href="#/exercise/${id}"><span class="r-main"><span class="r-title">${esc(ex[id]?.name ?? id)}</span><br><span class="r-sub">Not logged yet</span></span></a></li>`;
    const first = t[0].best, lastV = t[t.length - 1].best;
    const diff = lastV - first;
    return `<li><a href="#/exercise/${id}"><span class="r-main"><span class="r-title">${esc(ex[id]?.name ?? id)}</span><br><span class="r-sub">${plural(t.length, "session")}${t.length > 1 ? `, ${diff >= 0 ? "+" : "−"}${fmtKg(roundTo(Math.abs(diff), 0.5))} kg since first` : ""}</span></span><span class="r-side">${fmtKg(roundTo(lastV, 0.5))} kg</span></a></li>`;
  }).join("");

  return `
  <header class="top"><div class="grow"><h1>Progress</h1></div></header>
  <section><div class="section-head"><h2>Sets this week</h2></div>
    ${muscles.length ? `<p class="small muted section-note">Against this block's weekly targets (the line). Main muscles count a full set, helpers half. <i class="pri-dot"></i> marks your priorities.</p><ul class="vols">${volume}</ul>` : `<p class="muted">No block targets yet.</p>`}
  </section>
  <section><div class="section-head"><h2>Consistency</h2><span class="small muted">goal ${goal} a week</span></div>
    ${counts.filter((c) => c > 0).length >= 3 ? `<div class="chart">${consistency}</div>` : `<p class="stat-big"><span class="num">${counts[7]}</span> of ${goal} sessions this week</p><p class="small muted">A weekly chart appears once you have three weeks of training.</p>`}</section>
  <section><div class="section-head"><h2>Main lifts</h2><span class="small muted">estimated 1-rep max</span></div>
    ${mainRows ? `<ul class="rows">${mainRows}</ul>` : `<p class="muted">No main lifts in this block.</p>`}</section>
  <section><div class="section-head"><h2>Personal bests</h2></div>
    ${pbs.length ? `<ul class="rows">${pbs.map((b) => `<li><a href="#/workout/${b.wid}"><span class="r-main"><span class="r-title">${esc(b.name)}</span><br><span class="r-sub">${fmtDate(b.at)}: ${b.weight ? `${fmtKg(b.weight)} kg × ${b.reps}` : `${b.reps} reps`}</span></span><span class="r-side">${fmtKg(roundTo(b.est, 0.5))} kg</span></a></li>`).join("")}</ul>` : `<p class="muted">New bests show up here once you beat a previous session.</p>`}</section>
  <ul class="rows link-rows" style="margin-top:1.5rem"><li><a href="#/exercises"><span class="r-title">All exercises</span><span class="chev" aria-hidden="true">›</span></a></li></ul>
  ${tabs("progress")}`;
}

// ---------- Exercises ----------
let exQuery = "";
function viewExercises() {
  const ql = exQuery.trim().toLowerCase();
  const all = db.list("workout");
  const list = exercises().filter((e) => !ql || e.name.toLowerCase().includes(ql) || e.muscles?.some((m) => m.includes(ql)));
  const groups = EQUIPMENT.map((eq) => [eq, list.filter((e) => e.equipment === eq)]).filter(([, l]) => l.length);
  return `
  <header class="top"><a class="icon-btn" href="#/progress" aria-label="Back to progress">${I.back}</a><div class="grow"><h1>Exercises</h1></div><button class="btn sm" data-act="new-exercise">New exercise</button></header>
  <input class="search" id="ex-q" type="search" placeholder="Search by name or muscle" value="${esc(exQuery)}" autocomplete="off">
  <div id="ex-list">${groups.map(([eq, l]) => `<div class="group-label">${eq}</div><ul class="rows">${l.map((e) => {
    const h = history(all, e.id)[0];
    const top = h ? Math.max(...h.sets.map((s) => +s.weight || 0)) : null;
    return `<li><a href="#/exercise/${e.id}"><span class="r-main"><span class="r-title">${esc(e.name)}</span><br><span class="r-sub">${esc((e.muscles || []).join(", "))}</span></span><span class="r-side">${h ? (top ? `${fmtKg(top)} kg` : `${Math.max(...h.sets.map((s) => s.reps))} reps`) : ""}</span></a></li>`;
  }).join("")}</ul>`).join("") || `<p class="muted" style="margin-top:1rem">No exercise matches “${esc(exQuery)}”.</p>`}</div>
  ${tabs("progress")}`;
}

let chartData = [];
function viewExercise(id) {
  const ex = db.get("exercise", id);
  if (!ex) return `<header class="top"><a class="icon-btn" href="#/exercises" aria-label="Back">${I.back}</a></header><p>This exercise was deleted.</p>`;
  const hist = history(db.list("workout"), id);
  chartData = trend(hist);
  const weighted = chartData.some((d) => d.top > 0);
  return `
  <header class="top">
    <a class="icon-btn" href="#/exercises" aria-label="Back to exercises">${I.back}</a>
    <div class="grow title">Exercise</div>
    <button class="btn quiet danger sm" data-act="delete-exercise" data-id="${ex.id}">Delete</button>
  </header>
  <label class="field"><span>Name</span><input class="input big" data-xfield="name" value="${esc(ex.name)}" autocomplete="off"></label>
  ${chartData.length >= 2 ? `<figure class="chart" style="margin-inline:0">
      <div class="chart-head"><h3>${weighted ? "Estimated 1-rep max" : "Best set reps"}</h3><div class="chart-read" id="chart-read"></div></div>
      <div id="chart-host"></div>
      <figcaption class="small muted" style="padding:0 .25rem">${weighted ? "Best set each session, converted with the Epley formula. Tap the chart for details." : "Most reps in a set each session."}</figcaption>
    </figure>` : `<p class="muted" style="margin:1rem 0">${chartData.length ? "Log one more session to see a trend." : "No sessions logged yet."}</p>`}
  ${motionFor(ex) ? `<div class="mv-card">${movementHtml(motionFor(ex), ex.name)}</div>` : ""}
  <div class="howto-body" style="margin:1rem 0">${bodyMap(ex.muscles || [], ex.secondary || [])}
    <label class="field" style="margin:0"><span>Form cues, one per line</span><textarea class="input" data-xfield="cues" rows="4">${esc((ex.cues || []).join("\n"))}</textarea></label></div>
  <div class="field"><span class="small" style="font-weight:600">Equipment</span>
    <div class="toggles" style="margin-top:.35rem">${EQUIPMENT.map((e) => `<button data-act="x-eq" data-v="${e}" aria-pressed="${ex.equipment === e}">${e}</button>`).join("")}</div></div>
  <div class="field"><span class="small" style="font-weight:600">Main muscles</span>
    <div class="toggles" style="margin-top:.35rem">${MUSCLES.map((m) => `<button data-act="x-muscle" data-f="muscles" data-v="${m}" aria-pressed="${!!ex.muscles?.includes(m)}">${m}</button>`).join("")}</div></div>
  <div class="field"><span class="small" style="font-weight:600">Also works</span>
    <div class="toggles" style="margin-top:.35rem">${MUSCLES.map((m) => `<button data-act="x-muscle" data-f="secondary" data-v="${m}" aria-pressed="${!!ex.secondary?.includes(m)}">${m}</button>`).join("")}</div></div>
  <label class="field"><span>Movement (decides what it can be swapped with)</span><select class="input" data-xfield="pattern">${Object.entries(PATTERNS).map(([k, v]) => `<option value="${k}" ${ex.pattern === k ? "selected" : ""}>${v}</option>`).join("")}</select></label>
  <label class="field"><span>Weight step for suggestions (kg)</span><input class="input" type="number" inputmode="decimal" step="any" min="0" data-xfield="increment" value="${ex.increment ?? ""}" style="max-width:9rem"></label>
  ${hist.length ? `<div class="section-head"><h2>Sessions</h2></div><ul class="rows">${hist.map((h) => `<li><a href="#/workout/${h.workout.id}"><span class="r-main"><span class="r-title">${fmtDate(h.workout.startedAt)}</span><br><span class="r-sub">${setsText(h.sets)}</span></span><span class="r-side">${weighted ? `${fmtKg(roundTo(Math.max(...h.sets.map((s) => e1rm(+s.weight || 0, s.reps))), 0.5))} kg` : ""}</span></a></li>`).join("")}</ul>` : ""}
  ${tabs("progress")}`;
}

function wireChart() {
  const host = $("#chart-host");
  if (!host || chartData.length < 2) return;
  const weighted = chartData.some((d) => d.top > 0);
  const pts = weighted ? chartData : history(db.list("workout"), route().id).reverse().map((h) => ({ at: h.workout.startedAt, best: Math.max(...h.sets.map((s) => s.reps)), top: 0 }));
  const W = 340, H = 170, L = 34, R = 10, T = 10, B = 22;
  const xs = pts.map((d) => d.at), ys = pts.map((d) => d.best);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  const pad = Math.max((y1 - y0) * 0.15, weighted ? 2.5 : 1);
  y0 = Math.max(0, y0 - pad); y1 = y1 + pad;
  const sx = (t) => L + ((t - x0) / Math.max(1, x1 - x0)) * (W - L - R);
  const sy = (v) => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
  const ticks = [y0, (y0 + y1) / 2, y1].map((v) => Math.round(v));
  host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Trend over ${pts.length} sessions">
    <g class="grid">${ticks.map((v) => `<line x1="${L}" x2="${W - R}" y1="${sy(v)}" y2="${sy(v)}"/>`).join("")}</g>
    <g class="axis">${ticks.map((v) => `<text x="${L - 6}" y="${sy(v) + 4}" text-anchor="end">${v}</text>`).join("")}
      <text x="${L}" y="${H - 4}">${fmtShort(x0)}</text><text x="${W - R}" y="${H - 4}" text-anchor="end">${fmtShort(x1)}</text></g>
    <line class="cross" id="cross" y1="${T}" y2="${H - B}" x1="-10" x2="-10"/>
    <polyline class="series" points="${pts.map((d) => `${sx(d.at)},${sy(d.best)}`).join(" ")}"/>
    ${pts.map((d, i) => `<circle class="dot" data-i="${i}" cx="${sx(d.at)}" cy="${sy(d.best)}" r="4.5"/>`).join("")}
    <rect x="${L}" y="0" width="${W - L - R}" height="${H}" fill="transparent"/>
  </svg>`;
  const svg = $("svg", host), read = $("#chart-read");
  const show = (i) => {
    const d = pts[i];
    $("#cross", svg).setAttribute("x1", sx(d.at)); $("#cross", svg).setAttribute("x2", sx(d.at));
    svg.querySelectorAll(".dot").forEach((c) => c.classList.toggle("on", +c.dataset.i === i));
    read.textContent = weighted ? `${fmtShort(d.at)}: ${fmtKg(roundTo(d.best, 0.5))} kg` : `${fmtShort(d.at)}: ${d.best} reps`;
  };
  const nearest = (ev) => {
    const r = svg.getBoundingClientRect();
    const x = ((ev.clientX - r.left) / r.width) * W;
    let bi = 0, bd = Infinity;
    pts.forEach((d, i) => { const dd = Math.abs(sx(d.at) - x); if (dd < bd) { bd = dd; bi = i; } });
    return bi;
  };
  svg.addEventListener("pointermove", (ev) => show(nearest(ev)));
  svg.addEventListener("pointerdown", (ev) => show(nearest(ev)));
  show(pts.length - 1);
}

// ---------- Settings ----------
function viewSettings() {
  const s = db.settings();
  const ALL = [25, 20, 15, 10, 5, 2.5, 1.25, 1, 0.5];
  const tr = s.track || {};
  const toggle = (k, label, help) => `<label class="switch"><input type="checkbox" data-track="${k}" ${tr[k] ? "checked" : ""}><span><strong>${label}</strong><br><span class="small muted">${help}</span></span></label>`;
  return `
  <header class="top"><a class="icon-btn" href="#/" aria-label="Back to today">${I.back}</a><div class="grow"><h1>Settings</h1></div></header>
  <label class="field"><span>About you (your coach reads this)</span><textarea class="input" data-sset="profile" rows="9">${esc(s.profile || "")}</textarea></label>
  <label class="field"><span>Bodyweight (kg), the target for your calf raises</span><input class="input" type="number" inputmode="decimal" step="any" min="0" data-sset="bodyweightKg" placeholder="e.g. 78" value="${s.bodyweightKg ?? ""}" style="max-width:9rem"></label>
  <div class="section-head"><h2>Extra tracking</h2></div>
  <p class="small muted">Off by default. Each one adds a tap, and gives your coach more to work with.</p>
  ${toggle("effortPerSet", "Reps left per set", "After each set, tap how many more reps you had in you.")}
  ${toggle("feelAlways", "How it felt, every exercise", "Easy / About right / Hard after each exercise, not just in calibration week.")}
  ${toggle("sessionNotes", "Session notes and energy", "A note and a 1–5 energy rating when you finish.")}
  <div class="section-head"><h2>Barbell</h2></div>
  <label class="field"><span>Bar weight (kg)</span><input class="input" type="number" inputmode="decimal" step="any" min="0" data-sset="barKg" value="${s.barKg}" style="max-width:9rem"></label>
  <div class="field"><span class="small" style="font-weight:600">Plates available (kg)</span>
    <div class="toggles" style="margin-top:.35rem">${ALL.map((p) => `<button data-act="plate" data-v="${p}" aria-pressed="${s.plates.includes(p)}">${p}</button>`).join("")}</div></div>
  <div class="section-head"><h2>Sync and coach</h2></div>
  <p>${syncDot()}</p>
  <p class="small muted" style="margin:.4rem 0 .4rem">Everything is saved on this phone first and copied to your account when there's a connection.${db.pendingCount() ? ` ${plural(db.pendingCount(), "change")} waiting.` : ""}</p>
  <p class="small muted" id="whoami"></p>
  <ul class="rows link-rows" style="margin-top:.8rem">
    <li><button class="row" data-act="sync-now"><span class="r-title">Sync now</span><span class="chev" aria-hidden="true">›</span></button></li>
    <li><button class="row" data-act="export"><span class="r-title">Download my data</span><span class="chev" aria-hidden="true">›</span></button></li>
    <li><a href="#/exercises"><span class="r-title">Exercise library</span><span class="chev" aria-hidden="true">›</span></a></li>
  </ul>`;
}

// ---------- toast ----------
let toastTimer;
function toast(msg) {
  let el = $(".toast");
  if (!el) { el = document.createElement("div"); el.className = "toast"; el.setAttribute("role", "status"); document.body.append(el); }
  el.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 2200);
}

// ---------- events ----------
document.addEventListener("click", async (ev) => {
  const t = ev.target.closest("[data-act]");
  if (!t || t.disabled) return;
  const act = t.dataset.act;
  const i = +t.dataset.i;

  switch (act) {
    case "reload": ev.preventDefault(); location.reload(); return;
    case "signin": ev.preventDefault(); location.href = `/?signin=${Date.now()}${location.hash}`; return;
    case "begin": return beginSession(t.dataset.key);
    case "iv-begin": return beginInterval(t.dataset.id);
    case "iv-bell": {
      const r = db.get("routine", t.dataset.id); const it = r.items[+t.dataset.i];
      it.bell = Math.max(0, (+it.bell || 0) + +t.dataset.d); db.put("routine", r); return render();
    }
    case "iv-pause": return intervalControl("pause");
    case "iv-skip": return intervalControl("skip");
    case "iv-back": return intervalControl("back");
    case "iv-feel": { const w = activeWorkout(); if (!w) return; w.feel = w.feel === t.dataset.v ? null : t.dataset.v; db.put("workout", w); return render(); }
    case "iv-finish": return finishInterval(false);
    case "iv-menu": {
      const { v } = await confirmSheet({ title: "Workout options", ok: "Finish now", extra: "Discard workout", cancel: "Close" });
      if (v === "ok") return finishInterval(true);
      if (v === "extra") {
        const c = await confirmSheet({ title: "Discard this workout?", body: "Nothing from it will be saved.", ok: "Discard workout", okClass: "danger" });
        if (c.v === "ok") { const w = activeWorkout(); db.ui({ interval: null }); if (w) discardWorkout(w); }
      }
      return;
    }
    case "mv-toggle": return toggleMovement(t);
    case "ref-tab": db.ui({ refTab: t.dataset.v, refOpen: true }); return render();
    case "ref-open": db.ui({ refOpen: db.ui().refOpen === false }); return render();
    case "swap": return doSwap();

    case "jump": {
      const w = activeWorkout(); if (!w) return;
      db.ui({ runIndex: Math.max(0, Math.min(w.entries.length - 1, i)) });
      render(); scrollTo({ top: 0 }); return;
    }
    case "step": {
      const { w, e } = curEntry(); if (!e) return;
      const si = +t.dataset.si, f = t.dataset.f, d = +t.dataset.d;
      const s = e.sets[si]; if (s.done) return;
      const old = s[f];
      const base = f === "weight" && (old == null || old === "") ? (e.sets.slice(0, si).reverse().find((x) => +x.weight)?.weight ?? 0) : +old || 0;
      s[f] = Math.max(0, roundTo(base + d, f === "reps" ? 1 : 0.25));
      if (f === "weight") propagate(e, si, old);
      db.put("workout", w); return render();
    }
    case "tick": {
      const { w, idx, e } = curEntry(); if (!e) return;
      const si = +t.dataset.si; const s = e.sets[si];
      const ex = db.get("exercise", e.exerciseId);
      if (!s.done) {
        if ((s.weight == null || s.weight === "") && !isBodyweight(ex)) {
          toast("Enter the weight first"); $(`[data-sfield="weight"][data-si="${si}"]`)?.focus(); return;
        }
        if (!(s.reps > 0)) { toast("Enter your reps first"); return; }
        s.done = true; s.at = Date.now();
        if (s.weight == null || s.weight === "") s.weight = 0;
        const lastOfAll = idx === w.entries.length - 1 && e.sets.every((x) => x.done);
        const nextSet = e.sets.find((x) => !x.done);
        const label = nextSet ? `Next: set ${e.sets.indexOf(nextSet) + 1} of ${e.name}` : w.entries[idx + 1] ? `Next: ${w.entries[idx + 1].name}` : "";
        if (!lastOfAll) startRest(e.target.restSec, label); else db.ui({ rest: null });
      } else {
        s.done = false; delete s.at; delete s.rir;
      }
      db.put("workout", w); return render();
    }
    case "rir": {
      const { w, e } = curEntry(); if (!e) return;
      const s = e.sets[+t.dataset.si]; s.rir = s.rir === +t.dataset.v ? undefined : +t.dataset.v;
      db.put("workout", w); return render();
    }
    case "feel": {
      const { w, e } = curEntry(); if (!e) return;
      e.feel = e.feel === t.dataset.v ? null : t.dataset.v;
      db.put("workout", w); return render();
    }
    case "add-set": {
      const { w, e } = curEntry(); if (!e) return;
      const prev = e.sets[e.sets.length - 1];
      e.sets.push({ weight: prev?.weight ?? null, reps: prev?.reps ?? e.target.repMin, done: false });
      db.put("workout", w); return render();
    }
    case "remove-set": {
      const { w, e } = curEntry(); if (!e || e.sets.length < 2) return;
      e.sets.pop(); db.put("workout", w); return render();
    }
    case "rest-add": {
      const r = db.ui().rest; if (!r) return;
      const endsAt = Math.max(Date.now(), r.endsAt + +t.dataset.d * 1000);
      restAlerted = endsAt <= Date.now();
      db.ui({ rest: { ...r, endsAt, total: Math.max(r.total, (endsAt - Date.now()) / 1000) } }); return renderRest();
    }
    case "rest-skip": db.ui({ rest: null }); return renderRest();
    case "finish": return finishWorkout();
    case "run-menu": {
      const w = activeWorkout(); if (!w) return;
      const { v } = await confirmSheet({ title: "Session options", ok: "Finish session", extra: "Discard session", cancel: "Close" });
      if (v === "ok") finishWorkout();
      if (v === "extra") {
        const c = await confirmSheet({ title: "Discard this session?", body: "Nothing from it will be saved.", ok: "Discard session", okClass: "danger" });
        if (c.v === "ok") discardWorkout(w);
      }
      return;
    }

    case "coach-run": {
      const trig = t.dataset.trigger;
      if (trig === "new-block") {
        const p = activeProgram();
        const pos = p && blockPosition(p);
        if (p && !pos.done) {
          const c = await confirmSheet({ title: "Start a new block now?", body: `You're in week ${pos.week + 1} of ${pos.weeks} of ${esc(p.name)}. The coach will end it and write a new one. You can undo this.`, ok: "Write a new block" });
          if (c.v !== "ok") return;
        }
      }
      lastCoachRequest = { trigger: trig, message: "" };
      const log = await callCoach(trig);
      if (log && trig === "new-block") { toast("New block ready"); go("#/"); }
      return;
    }
    case "coach-retry": {
      const req = lastCoachRequest || { trigger: "session", message: "" };
      const log = await callCoach(req.trigger, req.message);
      if (log && req.trigger === "session") db.ui({ pendingCoach: null });
      return;
    }
    case "undo-coach": {
      const l = db.get("coachlog", t.dataset.id); if (!l) return;
      const c = await confirmSheet({ title: "Undo these changes?", body: "Your program goes back to how it was before this coach update.", ok: "Undo changes" });
      if (c.v === "ok") { undoCoach(l); render(); }
      return;
    }

    case "delete-workout": {
      const { v } = await confirmSheet({ title: "Delete this session?", body: "Its sets will no longer count towards suggestions or charts.", ok: "Delete session", okClass: "danger" });
      if (v === "ok") { db.remove("workout", t.dataset.id); go("#/history"); toast("Session deleted"); }
      return;
    }
    case "new-exercise": {
      const ex = db.put("exercise", { id: db.uid("ex"), name: "New exercise", equipment: "dumbbell", pattern: "biceps", muscles: [], secondary: [], cues: [], increment: DEFAULT_INCREMENT.dumbbell, notes: "" });
      go(`#/exercise/${ex.id}`);
      setTimeout(() => { const n = $('[data-xfield="name"]'); n?.focus(); n?.select(); }, 50);
      return;
    }
    case "delete-exercise": {
      const p = activeProgram();
      const used = p?.sessions.some((s) => s.items.some((it) => it.exerciseId === t.dataset.id));
      if (used) { toast("It's in your current block. Swap it out first."); return; }
      const { v } = await confirmSheet({ title: "Delete this exercise?", body: "Past sessions keep their sets.", ok: "Delete exercise", okClass: "danger" });
      if (v !== "ok") return;
      db.remove("exercise", t.dataset.id); go("#/exercises"); toast("Exercise deleted");
      return;
    }
    case "x-eq": {
      const ex = db.get("exercise", route().id);
      const wasDefault = ex.increment === DEFAULT_INCREMENT[ex.equipment];
      ex.equipment = t.dataset.v;
      if (wasDefault) ex.increment = DEFAULT_INCREMENT[ex.equipment];
      db.put("exercise", ex); return render();
    }
    case "x-muscle": {
      const ex = db.get("exercise", route().id); const m = t.dataset.v; const f = t.dataset.f;
      ex[f] = ex[f]?.includes(m) ? ex[f].filter((x) => x !== m) : [...(ex[f] || []), m];
      db.put("exercise", ex); return render();
    }
    case "plate": {
      const s = { ...db.settings() }; const p = +t.dataset.v;
      s.plates = s.plates.includes(p) ? s.plates.filter((x) => x !== p) : [...s.plates, p].sort((a, b) => b - a);
      db.put("settings", s); return render();
    }
    case "sync-now": db.runSync(); return;
    case "export": {
      const blob = new Blob([JSON.stringify(db.exportAll(), null, 2)], { type: "application/json" });
      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `lift-${new Date().toISOString().slice(0, 10)}.json` });
      a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      return;
    }
  }
});

document.addEventListener("submit", async (ev) => {
  if (ev.target.dataset.form !== "ask") return;
  ev.preventDefault();
  const q = $("#ask-q").value.trim();
  if (!q) { $("#ask-q").focus(); return; }
  lastCoachRequest = { trigger: "ask", message: q };
  const log = await callCoach("ask", q);
  if (log) toast(log.changes?.length ? "Coach updated your plan" : "Coach replied");
  else { const box = $("#ask-q"); if (box) box.value = q; }
});

/** When set N's weight changes, carry it to later unticked sets that had the same weight. */
function propagate(e, si, old) {
  for (let j = si + 1; j < e.sets.length; j++) {
    const s = e.sets[j];
    if (s.done) continue;
    if (s.weight == null || s.weight === "" || +s.weight === +old) s.weight = e.sets[si].weight;
  }
}

// Typing: update the model without re-rendering, so focus and taps aren't lost.
document.addEventListener("input", (ev) => {
  const el = ev.target;
  if (el.id === "ex-q") {
    exQuery = el.value;
    const tmp = document.createElement("div"); tmp.innerHTML = viewExercises();
    $("#ex-list").replaceWith($("#ex-list", tmp));
    return;
  }
  if (el.dataset.sfield) {
    const { w, e } = curEntry(); if (!e) return;
    const s = e.sets[+el.dataset.si]; if (s.done) return;
    const v = el.value === "" ? null : +el.value;
    if (el.dataset.sfield === "weight") {
      const old = s.weight; s.weight = v; propagate(e, +el.dataset.si, old);
      e.sets.forEach((x, j) => { const inp = $(`[data-sfield="weight"][data-si="${j}"]`); if (inp && inp !== el && !x.done) inp.value = x.weight ?? ""; });
      const lo = $("#loadout"); if (lo) lo.innerHTML = loadoutHtml(e);
    } else s.reps = v == null ? null : Math.round(v);
    db.put("workout", w);
    return;
  }
  if (el.dataset.xfield) {
    const ex = db.get("exercise", route().id); const f = el.dataset.xfield;
    if (f === "increment") ex[f] = el.value === "" ? null : +el.value;
    else if (f === "cues") ex.cues = el.value.split("\n").map((x) => x.trim()).filter(Boolean);
    else ex[f] = el.value;
    db.put("exercise", ex); return;
  }
  if (el.dataset.sset) {
    const s = { ...db.settings() }; const k = el.dataset.sset;
    if (k === "profile") s.profile = el.value;
    else s[k] = el.value === "" ? null : +el.value;
    db.put("settings", s);
  }
  if (el.dataset.track) {
    const s = { ...db.settings() }; s.track = { ...(s.track || {}), [el.dataset.track]: el.checked }; db.put("settings", s);
  }
});

document.addEventListener("toggle", (ev) => {
  if (ev.target.classList?.contains("howto")) db.ui({ howtoOpen: ev.target.open });
}, true);

addEventListener("keydown", (e) => { if (e.key === "Escape" && sheetOpen) closeSheet(); });
addEventListener("hashchange", () => { closeSheet(); render(); scrollTo(0, 0); });

// Re-render when another device's changes arrive, but never mid-typing or in a sheet.
let pendingRender = false;
const busy = () => {
  const a = document.activeElement;
  return sheetOpen || (a && ["INPUT", "TEXTAREA", "SELECT"].includes(a.tagName));
};
db.subscribe((reason) => {
  document.querySelectorAll(".sync-dot").forEach((el) => { el.outerHTML = syncDot(); });
  if (reason === "remote") pendingRender = true;
  // Show or clear the sign-in banner as soon as the sign-in state changes.
  const needsBanner = ["signin", "noident"].includes(db.sync.status);
  if (needsBanner !== !!document.querySelector("#app .banner a[data-act=signin]")) pendingRender = true;
  if (pendingRender && !busy()) { pendingRender = false; render(); }
  if (reason !== "local" && db.sync.status === "synced") maybeRunPendingCoach();
});
document.addEventListener("focusout", () => setTimeout(() => {
  if (pendingRender && !busy()) { pendingRender = false; render(); }
}, 0));

async function whoami() {
  try {
    const r = await fetch("/api/me", { redirect: "manual" });
    if (r.ok) {
      const { email, coach } = await r.json();
      coachInfo.available = coach;
      const el = $("#whoami");
      if (el) el.textContent = `Signed in as ${email}. Coach ${coach ? "is on" : "is off: add an ANTHROPIC_API_KEY secret to switch it on"}.`;
    }
  } catch {}
}

// ---------- boot ----------
db.seedIfEmpty();
render();
db.startSyncLoop();
whoami();
addEventListener("hashchange", () => route().name === "settings" && whoami());
if ("serviceWorker" in navigator && location.hostname !== "localhost") {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
