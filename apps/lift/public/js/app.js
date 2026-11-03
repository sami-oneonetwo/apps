import * as db from "./store.js";
import { MUSCLES, EQUIPMENT, DEFAULT_INCREMENT, PATTERNS } from "./seed.js";
import { history, prescribe, trend, e1rm, fmtKg, roundTo } from "./progression.js";
import { plateSvg } from "./plates.js";
import { blockPosition, nextSession, setsPerMuscle, weekStart, PHASE_TEXT, WEEK } from "./program.js";
import { bodyMap } from "./body.js";

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
  const views = { today: viewToday, session: viewSessionPreview, run: viewRun, workout: viewWorkout, history: viewHistory, exercises: viewExercises, exercise: viewExercise, settings: viewSettings, coach: viewCoach, progress: viewProgress, block: viewBlock };
  const fn = views[r.name] || viewToday;
  app.className = r.name === "run" ? "run" : "";
  app.innerHTML = fn(r.id);
  if (r.name === "exercise") wireChart();
  wakeLock(r.name === "run");
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
  const head = `<header class="top"><div class="grow wordmark">Lift</div>${syncDot()}<a class="icon-btn" href="#/settings" aria-label="Settings">${I.gear}</a></header>${signinBanner()}`;
  if (!p) return `${head}<div class="empty"><p>No program yet. Ask your coach to write one.</p><a class="btn primary" href="#/coach">Open coach</a></div>${tabs("today")}`;

  const pos = blockPosition(p);
  const all = db.list("workout");
  const ex = exById();
  const blockLine = pos.done
    ? `<p class="block-line">${esc(p.name)}: finished</p>`
    : `<p class="block-line"><a href="#/block">${esc(p.name)}</a><br><span class="muted">Week ${pos.week + 1} of ${pos.weeks}, ${PHASE_TEXT[pos.phase].toLowerCase()}</span></p>`;

  if (active) {
    return `${head}${blockLine}<a class="resume" href="#/run"><div class="small">In progress since ${fmtTime(active.startedAt)}</div><h2>Resume ${esc(active.name)}</h2></a>${tabs("today")}`;
  }

  if (pos.done) {
    return `${head}${blockLine}
      <div class="today-card"><h2>Block complete</h2>
        <p class="muted">Six weeks done. Your coach will read your logs and write the next block.</p>
        <button class="btn primary block" data-act="coach-run" data-trigger="new-block" ${coachBusy ? "disabled" : ""}>${coachBusy ? "Coach is writing…" : "Write my next block"}</button>
      </div>${tabs("today")}`;
  }

  const n = nextSession(p, all, ex);
  const s = p.sessions.find((x) => x.key === n.key);
  const done = new Set(n.doneThisWeek);
  const phaseNote = {
    calibration: "This week finds your working weights. Start light and build up each set.",
    deload: "Lighter week: fewer sets and less weight so you recover before the next block.",
    build: "",
  }[pos.phase];

  return `${head}${blockLine}
  <section class="today-card" aria-labelledby="today-h">
    <div class="small muted">${n.extra ? "Bonus session" : "Today"}</div>
    <h1 id="today-h" class="today-title">${esc(s.name)}</h1>
    ${n.reason ? `<p class="reason">${esc(n.reason)}</p>` : ""}
    ${phaseNote ? `<p class="small muted" style="margin:.4rem 0 0">${phaseNote}</p>` : ""}
    <ul class="rows compact">${s.items.map((it) => itemLine(it, ex[it.exerciseId], all)).join("")}</ul>
    <button class="btn primary block" data-act="begin" data-key="${s.key}">Start ${esc(s.name)}</button>
  </section>
  <div class="section-head"><h2>This week</h2><span class="muted small">${done.size} of ${p.sessions.length} done</span></div>
  <ul class="rows">${p.sessions.map((x) => `<li><a href="#/session/${x.key}"><span class="r-main"><span class="r-title">${esc(x.name)}</span><br><span class="r-sub">${esc(x.focus || "")}</span></span><span class="r-side">${done.has(x.key) ? `<span class="done-mark">${I.check}<span class="sr">Done</span></span>` : x.key === n.key ? "Next" : ""}</span></a></li>`).join("")}</ul>
  ${tabs("today")}`;
}

function viewSessionPreview(key) {
  const p = activeProgram();
  const s = p?.sessions.find((x) => x.key === key);
  if (!s) return `<header class="top"><a class="icon-btn" href="#/" aria-label="Back">${I.back}</a></header><p>Session not found.</p>`;
  const ex = exById(), all = db.list("workout");
  return `<header class="top"><a class="icon-btn" href="#/" aria-label="Back to today">${I.back}</a><div class="grow title">${esc(p.name)}</div></header>
    <h1>${esc(s.name)}</h1><p class="muted" style="margin:.4rem 0 1rem">${esc(s.focus || "")}</p>
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
        <div class="scale" role="group" aria-label="Achilles score 0 to 10">${Array.from({ length: 11 }, (_, i) => `<button data-a="${i}" class="${i <= 3 ? "ok" : i <= 5 ? "warn" : "bad"}">${i}</button>`).join("")}</div>
        <div class="scale-legend small muted"><span>Fine</span><span>Careful</span><span>Ease off</span></div>
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
function viewRun() {
  const w = activeWorkout();
  if (!w) return `<header class="top"><a class="icon-btn" href="#/" aria-label="Back">${I.back}</a></header><div class="empty"><p>No session in progress.</p><a class="btn primary" href="#/">Go to today</a></div>`;
  const n = w.entries.length;
  const idx = Math.min(db.ui().runIndex || 0, Math.max(0, n - 1));
  const e = w.entries[idx];
  const ex = db.get("exercise", e.exerciseId);
  const t = e.target;
  const next = w.entries[idx + 1];
  const cfg = db.settings();
  const st = (en) => { const d = en.sets.filter((s) => s.done).length; return d === 0 ? "none" : d >= en.sets.length ? "done" : "part"; };
  const allDone = e.sets.length && e.sets.every((s) => s.done);
  const askFeel = allDone && (w.phase === "calibration" || cfg.track?.feelAlways) && e.role !== "rehab";
  const calfTarget = e.role === "rehab" && cfg.bodyweightKg ? `<p class="small muted">Physio target: work up to your bodyweight, ${fmtKg(cfg.bodyweightKg)} kg.</p>` : "";

  return `
  <header class="top">
    <a class="icon-btn" href="#/" aria-label="Back to today">${I.back}</a>
    <div class="grow title">${esc(w.name)}</div>
    <button class="icon-btn" data-act="run-menu" aria-label="Session options">${I.more}</button>
  </header>
  <div class="seq-strip" role="list" aria-label="Exercises">
    ${w.entries.map((en, i) => `<button role="listitem" data-act="jump" data-i="${i}" data-state="${st(en)}" ${i === idx ? 'aria-current="step"' : ""} aria-label="${esc(en.name)}">${i + 1}</button>`).join("")}
  </div>
  <div class="ex-head">
    <h1 class="ex-title">${esc(e.name)}</h1>
    ${e.sets.some((s) => s.done) ? "" : `<button class="btn sm swap-btn" data-act="swap" aria-label="Swap ${esc(e.name)}">${I.swap}Swap</button>`}
  </div>
  ${e.role === "rehab" ? `<p class="tag-line"><span class="tag">Achilles rehab</span>${w.achilles != null ? ` Achilles today: ${w.achilles}/10` : ""}</p>` : ""}
  ${e.swappedFrom ? `<p class="small muted">Swapped in for ${esc(db.get("exercise", e.swappedFrom)?.name ?? "the planned exercise")}.</p>` : ""}
  <div class="target">
    <span>${t.sets} × ${repRange(t)}<small>sets × reps</small></span>
    <span>${mmss(t.restSec)}<small>rest</small></span>
  </div>
  <div class="advice" data-kind="${e.advice.kind}">${esc(e.advice.text)}${e.note ? `<br><span class="small">${esc(e.note)}</span>` : ""}</div>
  ${calfTarget}
  ${isBar(ex) ? `<div class="loadout" id="loadout">${loadoutHtml(e)}</div>` : ""}
  ${e.last ? `<p class="last">Last time, ${fmtShort(e.last.at)}: ${setsText(e.last.sets)}</p>` : ""}
  <div class="sets">
    <div class="set-head"><span></span><span>${isBodyweight(ex) ? "Added kg" : "kg"}</span><span>Reps</span><span></span></div>
    ${e.sets.map((s, si) => setRow(s, si, ex, cfg)).join("")}
  </div>
  <div style="display:flex;gap:.5rem;margin-top:.5rem">
    <button class="btn sm" data-act="add-set">Add set</button>
    ${e.sets.length > 1 ? `<button class="btn sm quiet" data-act="remove-set">Remove last set</button>` : ""}
  </div>
  ${askFeel ? `<div class="feel" role="group" aria-label="How did ${esc(e.name)} feel?"><p>How did that feel?</p><div class="feel-btns">
      ${["easy", "right", "hard"].map((f) => `<button data-act="feel" data-v="${f}" aria-pressed="${e.feel === f}">${{ easy: "Easy", right: "About right", hard: "Hard" }[f]}</button>`).join("")}
    </div></div>` : ""}
  ${ex ? `<details class="howto" ${db.ui().howtoOpen === false ? "" : "open"}>
    <summary>How to do it</summary>
    <div class="howto-body">
      ${bodyMap(ex.muscles || [], ex.secondary || [])}
      ${ex.cues?.length ? `<ul class="cues">${ex.cues.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>` : `<p class="muted small">No cues yet. Add some on the exercise page.</p>`}
    </div>
  </details>` : ""}
  ${next ? `<div class="up-next"><div class="muted">Up next</div><h3>${esc(next.name)}</h3><div class="small muted">${next.target.sets} × ${repRange(next.target)}${next.sets[0]?.weight ? ` at ${fmtKg(next.sets[0].weight)} kg` : ""}</div></div>` : ""}
  <div class="run-nav">
    <button class="btn" data-act="jump" data-i="${idx - 1}" ${idx === 0 ? "disabled" : ""}>Previous</button>
    ${next ? `<button class="btn primary" data-act="jump" data-i="${idx + 1}">Next exercise</button>`
           : `<button class="btn primary" data-act="finish">Finish session</button>`}
  </div>`;
}

function setRow(s, si, ex, cfg) {
  const step = incrementFor(ex) || 1;
  const effort = cfg.track?.effortPerSet ? `<div class="effort" role="group" aria-label="Reps left in set ${si + 1}"><span class="small muted">Reps left</span>${[0, 1, 2, 3].map((r) => `<button data-act="rir" data-si="${si}" data-v="${r}" aria-pressed="${s.rir === r}">${r === 3 ? "3+" : r}</button>`).join("")}</div>` : "";
  return `<div class="set ${s.done ? "done" : ""}" data-si="${si}">
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
  if (!w) return `<div class="weight-big">–<small>kg</small></div><div class="plate-label">Enter a weight to see the plates.</div>`;
  const p = plateSvg(w, cfg.barKg, cfg.plates);
  let label;
  if (w < cfg.barKg) label = `Lighter than the ${fmtKg(cfg.barKg)} kg bar.`;
  else if (!p.label || p.label === "Empty bar") label = `Just the ${fmtKg(cfg.barKg)} kg bar.`;
  else label = `Each side: ${p.label} kg${p.remainder > 0.001 ? `, ${fmtKg(p.remainder)} kg short` : ""}`;
  return `<div class="weight-big">${fmtKg(w)}<small>kg</small></div>${w >= cfg.barKg ? p.svg : ""}<div class="plate-label">${label}</div>`;
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
  const el = $("#rest");
  const rest = db.ui().rest;
  clearInterval(restTimer);
  if (!rest || route().name !== "run") { el.hidden = true; el.innerHTML = ""; return; }
  el.hidden = false;
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
  <header class="top"><div class="grow"><h1>Coach</h1></div>${syncDot()}</header>
  ${signinBanner()}
  <form class="ask" data-form="ask">
    <label for="ask-q" class="small" style="font-weight:600">Ask or tell your coach</label>
    <textarea id="ask-q" class="input" rows="3" placeholder="e.g. Achilles is sore after a long run, only have 30 minutes today, the cable station is always busy…"></textarea>
    <div class="ask-row">
      <button class="btn primary" type="submit" ${coachBusy ? "disabled" : ""}>Send</button>
      <button class="btn quiet" type="button" data-act="coach-run" data-trigger="new-block" ${coachBusy ? "disabled" : ""}>Write a new block</button>
    </div>
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
    <button class="btn sm danger" data-act="delete-workout" data-id="${w.id}">Delete</button>
  </header>
  <h1>${esc(w.name)}</h1>
  <div class="stat-line">
    <div>${w.finishedAt ? fmtDur(w.finishedAt - w.startedAt) : "–"}<small>duration</small></div>
    <div>${sets.length}<small>sets</small></div>
    <div>${Math.round(vol).toLocaleString("en-AU")}<small>kg lifted</small></div>
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
      <div class="wo-sets">${e.sets.map((s) => `<span>${+s.weight ? `${fmtKg(s.weight)} kg × ${s.reps}` : `${s.reps} reps`}</span>`).join("")}</div>
    </div>`;
  }).join("")}
  ${tabs("history")}`;
}

// ---------- History ----------
function viewHistory() {
  const ws = finished();
  return `
  <header class="top"><div class="grow"><h1>History</h1></div>${syncDot()}</header>
  ${ws.length ? `<ul class="rows">${ws.map((w) => {
    const sets = w.entries.reduce((a, e) => a + e.sets.length, 0);
    return `<li><a href="#/workout/${w.id}"><span class="r-main"><span class="r-title">${esc(w.name)}</span><br><span class="r-sub">${fmtDate(w.startedAt)}, ${fmtDur(w.finishedAt - w.startedAt)}</span></span><span class="r-side">${sets} sets</span></a></li>`;
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
  const muscles = MUSCLES.filter((m) => (targets[m] || 0) > 0).sort((a, b) => (pri.has(b) - pri.has(a)) || targets[b] - targets[a]);
  const fmt1 = (v) => (Math.round(v * 2) / 2).toString();

  const volume = muscles.map((m) => {
    const v = now[m] || 0, t = targets[m];
    const pct = Math.min(130, (v / t) * 100);
    return `<li class="vol">
      <div class="vol-label"><span>${esc(m)}${pri.has(m) ? ` <span class="tag">Priority</span>` : ""}</span><span><span class="num">${fmt1(v)}</span> <span class="muted small">of ${t}, last week ${fmt1(last[m] || 0)}</span></span></div>
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
  <section><div class="section-head"><h2>Sets this week</h2><span class="small muted">vs block targets</span></div>
    ${muscles.length ? `<ul class="vols">${volume}</ul><p class="small muted">Main muscles count a full set, helpers half. The line marks the weekly target.</p>` : `<p class="muted">No block targets yet.</p>`}
  </section>
  <section><div class="section-head"><h2>Consistency</h2><span class="small muted">sessions per week, goal ${goal}</span></div>
    <div class="chart">${consistency}</div></section>
  <section><div class="section-head"><h2>Main lifts</h2><span class="small muted">estimated 1-rep max</span></div>
    ${mainRows ? `<ul class="rows">${mainRows}</ul>` : `<p class="muted">No main lifts in this block.</p>`}</section>
  <section><div class="section-head"><h2>Personal bests</h2></div>
    ${pbs.length ? `<ul class="rows">${pbs.map((b) => `<li><a href="#/workout/${b.wid}"><span class="r-main"><span class="r-title">${esc(b.name)}</span><br><span class="r-sub">${fmtDate(b.at)}: ${b.weight ? `${fmtKg(b.weight)} kg × ${b.reps}` : `${b.reps} reps`}</span></span><span class="r-side">${fmtKg(roundTo(b.est, 0.5))} kg</span></a></li>`).join("")}</ul>` : `<p class="muted">New bests show up here once you beat a previous session.</p>`}</section>
  <p style="margin-top:1.5rem"><a class="btn block" href="#/exercises">All exercises</a></p>
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
    <button class="btn sm danger" data-act="delete-exercise" data-id="${ex.id}">Delete</button>
  </header>
  <label class="field"><span>Name</span><input class="input big" data-xfield="name" value="${esc(ex.name)}" autocomplete="off"></label>
  ${chartData.length >= 2 ? `<figure class="chart" style="margin-inline:0">
      <div class="chart-head"><h3>${weighted ? "Estimated 1-rep max" : "Best set reps"}</h3><div class="chart-read" id="chart-read"></div></div>
      <div id="chart-host"></div>
      <figcaption class="small muted" style="padding:0 .25rem">${weighted ? "Best set each session, converted with the Epley formula. Tap the chart for details." : "Most reps in a set each session."}</figcaption>
    </figure>` : `<p class="muted" style="margin:1rem 0">${chartData.length ? "Log one more session to see a trend." : "No sessions logged yet."}</p>`}
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
  <label class="field"><span>Bodyweight (kg), the target for your calf raises</span><input class="input" type="number" inputmode="decimal" step="any" min="0" data-sset="bodyweightKg" value="${s.bodyweightKg ?? ""}" style="max-width:9rem"></label>
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
  <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.8rem">
    <button class="btn sm" data-act="sync-now">Sync now</button>
    <button class="btn sm" data-act="export">Download my data</button>
    <a class="btn sm" href="#/exercises">Exercise library</a>
  </div>`;
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
addEventListener("hashchange", () => { closeSheet(); render(); });

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
