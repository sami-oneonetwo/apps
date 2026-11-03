import * as db from "./store.js";
import { MUSCLES, EQUIPMENT, DEFAULT_INCREMENT } from "./seed.js";
import { history, suggest, trend, e1rm, fmtKg, roundTo } from "./progression.js";
import { plateSvg } from "./plates.js";

const $ = (s, el = document) => el.querySelector(s);
const app = $("#app");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// ---------- icons ----------
const I = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
  train: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2.5 12h19"/><rect x="5" y="6.5" width="3" height="11" rx="1"/><rect x="16" y="6.5" width="3" height="11" rx="1"/><rect x="2.5" y="9" width="2.5" height="6" rx=".8"/><rect x="19" y="9" width="2.5" height="6" rx=".8"/></svg>',
  history: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.5" cy="6.5" r="1.2" fill="currentColor"/><circle cx="4.5" cy="12" r="1.2" fill="currentColor"/><circle cx="4.5" cy="17.5" r="1.2" fill="currentColor"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></svg>',
};

// ---------- formatting ----------
const DAY = 86400000;
const fmtDate = (t) => new Date(t).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
const fmtShort = (t) => new Date(t).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
function ago(t) {
  const d = Math.floor((startOfDay(Date.now()) - startOfDay(t)) / DAY);
  if (d <= 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 14) return `${d} days ago`;
  return fmtShort(t);
}
function startOfDay(t) { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); }
const mmss = (s) => `${Math.floor(Math.abs(s) / 60)}:${String(Math.floor(Math.abs(s) % 60)).padStart(2, "0")}`;
const fmtDur = (ms) => { const m = Math.round(ms / 60000); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`; };
const setsText = (sets) => sets.map((s) => (+s.weight ? `${fmtKg(s.weight)}×${s.reps}` : `${s.reps}`)).join(", ");
const repRange = (t) => (t.repMin === t.repMax ? `${t.repMin}` : `${t.repMin}–${t.repMax}`);

// ---------- data helpers ----------
const exercises = () => db.list("exercise").sort((a, b) => a.name.localeCompare(b.name));
const routines = () => db.list("routine").sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));
const finished = () => db.list("workout").filter((w) => w.finishedAt).sort((a, b) => b.startedAt - a.startedAt);
const exName = (id) => db.get("exercise", id)?.name ?? "Deleted exercise";
const isBar = (ex) => ex?.equipment === "barbell";
const isBodyweight = (ex) => ex?.equipment === "bodyweight";
const incrementFor = (item, ex) => item?.increment ?? ex?.increment ?? DEFAULT_INCREMENT[ex?.equipment] ?? 2.5;

function activeWorkout() {
  const id = db.ui().activeWorkoutId;
  const w = id && db.get("workout", id);
  return w && !w.finishedAt ? w : null;
}

// ---------- shell ----------
let sheetOpen = false;
const tabs = (cur) => `
<nav class="tabs" aria-label="Sections">
  <a href="#/" ${cur === "train" ? 'aria-current="page"' : ""}>${I.train}Train</a>
  <a href="#/history" ${cur === "history" ? 'aria-current="page"' : ""}>${I.history}History</a>
  <a href="#/exercises" ${cur === "exercises" ? 'aria-current="page"' : ""}>${I.list}Exercises</a>
  <a href="#/settings" ${cur === "settings" ? 'aria-current="page"' : ""}>${I.gear}Settings</a>
</nav>`;

const SYNC_TEXT = { idle: "Not synced yet", syncing: "Syncing", synced: "Synced", pending: "Changes waiting", offline: "Offline, saved on phone", error: "Sync failed, will retry", signin: "Sign in to sync" };
const syncDot = () => `<span class="sync-dot" data-s="${db.sync.status}"><i></i>${SYNC_TEXT[db.sync.status] || ""}</span>`;
const signinBanner = () => db.sync.status === "signin"
  ? `<div class="banner">Your sign-in has expired, so changes are only on this phone. <a href="${location.pathname}" data-act="reload">Sign in again</a></div>` : "";

function route() {
  const [name, id] = location.hash.replace(/^#\/?/, "").split("/");
  return { name: name || "train", id };
}

function render() {
  const r = route();
  const views = { train: viewTrain, routine: viewRoutine, run: viewRun, workout: viewWorkout, history: viewHistory, exercises: viewExercises, exercise: viewExercise, settings: viewSettings };
  const fn = views[r.name] || viewTrain;
  app.className = r.name === "run" ? "run" : "";
  app.innerHTML = fn(r.id);
  after(r);
  wakeLock(r.name === "run");
  renderRest();
}

function after(r) {
  if (r.name === "exercise") wireChart();
}

function go(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

// ---------- Train ----------
function viewTrain() {
  const active = activeWorkout();
  const rs = routines();
  const ws = finished();
  const lastDone = (rid) => ws.find((w) => w.routineId === rid);

  const list = rs.length
    ? rs.map((r) => {
        const last = lastDone(r.id);
        const n = r.items?.length || 0;
        return `<div class="routine-row">
          <a class="name" href="#/routine/${r.id}"><h2>${esc(r.name)}</h2></a>
          <button class="btn primary" data-act="start" data-id="${r.id}" ${n && !active ? "" : "disabled"}>Start</button>
          <div class="meta">${n} exercise${n === 1 ? "" : "s"}${last ? `, last done ${ago(last.startedAt)}` : ", not done yet"}</div>
        </div>`;
      }).join("")
    : `<div class="empty"><p>Build a routine with the exercises, sets and rep ranges you want. Each time you train, Lift suggests what to lift next.</p>
       <button class="btn primary" data-act="new-routine">Create a routine</button></div>`;

  return `
  <header class="top"><div class="grow wordmark">Lift</div>${syncDot()}</header>
  ${signinBanner()}
  ${active ? `<a class="resume" href="#/run"><div class="small">In progress, started ${new Date(active.startedAt).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })}</div><h2>Resume ${esc(active.name)}</h2></a>` : ""}
  <div class="section-head"><h2>Routines</h2>${rs.length ? `<button class="btn sm" data-act="new-routine">New routine</button>` : ""}</div>
  ${list}
  ${tabs("train")}`;
}

function startWorkout(routineId) {
  const r = db.get("routine", routineId);
  if (!r) return;
  const all = db.list("workout");
  const entries = (r.items || []).map((it) => {
    const ex = db.get("exercise", it.exerciseId);
    const inc = incrementFor(it, ex);
    const hist = history(all, it.exerciseId);
    const s = suggest(hist, it, inc);
    const weight = isBodyweight(ex) ? (s.weight ?? 0) : s.weight;
    return {
      key: it.key, exerciseId: it.exerciseId, name: ex?.name ?? "Exercise",
      target: { sets: it.sets, repMin: it.repMin, repMax: it.repMax, restSec: it.restSec, increment: inc },
      advice: { kind: s.kind, text: s.reason },
      last: hist[0] ? { at: hist[0].workout.startedAt, sets: hist[0].sets.map(({ weight, reps }) => ({ weight, reps })) } : null,
      sets: Array.from({ length: it.sets }, (_, i) => ({ weight, reps: s.reps[i], done: false })),
    };
  });
  const w = db.put("workout", { id: db.uid("w"), routineId: r.id, name: r.name, startedAt: Date.now(), finishedAt: null, entries, notes: "" });
  db.ui({ activeWorkoutId: w.id, runIndex: 0, rest: null });
  go("#/run");
}

// ---------- Routine editor ----------
function viewRoutine(id) {
  const r = db.get("routine", id);
  if (!r) return `<header class="top"><a class="icon-btn" href="#/" aria-label="Back">${I.back}</a></header><p>This routine was deleted.</p>`;
  const items = r.items || [];
  return `
  <header class="top">
    <a class="icon-btn" href="#/" aria-label="Back to routines">${I.back}</a>
    <div class="grow title">Edit routine</div>
    <button class="btn sm danger" data-act="delete-routine" data-id="${r.id}">Delete</button>
  </header>
  <label class="field"><span>Name</span><input class="input big" data-rfield="name" value="${esc(r.name)}" autocomplete="off"></label>
  <label class="field"><span>Notes</span><textarea class="input" data-rfield="notes" placeholder="Warm-up, cues, anything to remember">${esc(r.notes || "")}</textarea></label>
  <div class="section-head"><h2>Exercises</h2></div>
  ${items.map((it, i) => {
    const ex = db.get("exercise", it.exerciseId);
    return `<div class="item" data-i="${i}">
      <div class="item-head">
        <span class="seq">${i + 1}</span>
        <button class="ex-name" data-act="swap-ex" data-i="${i}">${esc(ex?.name ?? "Deleted exercise")}</button>
        <button class="icon-btn" data-act="move" data-i="${i}" data-d="-1" aria-label="Move up" ${i === 0 ? "disabled" : ""}>${I.up}</button>
        <button class="icon-btn" data-act="move" data-i="${i}" data-d="1" aria-label="Move down" ${i === items.length - 1 ? "disabled" : ""}>${I.down}</button>
        <button class="icon-btn" data-act="remove-item" data-i="${i}" aria-label="Remove">${I.x}</button>
      </div>
      <div class="item-grid">
        <label class="mini"><span>Sets</span><input type="number" inputmode="numeric" min="1" max="20" data-ifield="sets" data-i="${i}" value="${it.sets}"></label>
        <div class="mini"><span>Reps</span><div class="range">
          <input type="number" inputmode="numeric" min="1" max="100" data-ifield="repMin" data-i="${i}" value="${it.repMin}" aria-label="Lowest reps">
          <span>–</span>
          <input type="number" inputmode="numeric" min="1" max="100" data-ifield="repMax" data-i="${i}" value="${it.repMax}" aria-label="Highest reps">
        </div></div>
        <label class="mini"><span>Rest (sec)</span><input type="number" inputmode="numeric" min="0" max="900" step="15" data-ifield="restSec" data-i="${i}" value="${it.restSec}"></label>
      </div>
    </div>`;
  }).join("")}
  <div style="margin-top:1rem"><button class="btn block" data-act="add-item">Add exercise</button></div>
  ${items.length ? `<div style="margin-top:.75rem"><button class="btn primary block" data-act="start" data-id="${r.id}" ${activeWorkout() ? "disabled" : ""}>Start this routine</button></div>` : ""}
  ${tabs("train")}`;
}

function newRoutine() {
  const r = db.put("routine", { id: db.uid("r"), name: "New routine", notes: "", items: [], order: routines().length });
  go(`#/routine/${r.id}`);
  setTimeout(() => { const n = $('[data-rfield="name"]'); n?.focus(); n?.select(); }, 50);
}

function routineItem(exerciseId) {
  const ex = db.get("exercise", exerciseId);
  const heavy = ex?.equipment === "barbell";
  return { key: db.uid("i"), exerciseId, sets: 3, repMin: heavy ? 5 : 8, repMax: heavy ? 8 : 12, restSec: heavy ? 150 : 90, increment: null };
}

// ---------- Exercise picker sheet ----------
function openPicker(onPick, title = "Add exercise") {
  let q = "";
  let muscle = null;
  const root = $("#sheet-root");
  const draw = () => {
    const ql = q.trim().toLowerCase();
    const matches = exercises().filter((e) => (!ql || e.name.toLowerCase().includes(ql)) && (!muscle || e.muscles?.includes(muscle)));
    const groups = EQUIPMENT.map((eq) => [eq, matches.filter((e) => e.equipment === eq)]).filter(([, l]) => l.length);
    $("#picker-list").innerHTML = `
      ${groups.map(([eq, l]) => `<div class="group-label">${eq}</div><ul class="rows">${l.map((e) => `<li><button class="row" data-pick="${e.id}"><span class="r-main"><span class="r-title">${esc(e.name)}</span><br><span class="r-sub">${esc((e.muscles || []).join(", "))}</span></span></button></li>`).join("")}</ul>`).join("")}
      ${ql ? `<div class="item" style="margin-top:1rem"><p class="small muted" style="margin-bottom:.5rem">Not in the list? Create it.</p>
        <div style="display:flex;gap:.5rem"><select class="input" id="new-eq" style="flex:1">${EQUIPMENT.map((e) => `<option ${e === "dumbbell" ? "selected" : ""}>${e}</option>`).join("")}</select>
        <button class="btn primary" data-create>Create “${esc(q.trim())}”</button></div></div>` : ""}
      ${!groups.length && !ql ? `<p class="muted">No exercises work ${esc(muscle)}. Clear the filter or create one.</p>` : ""}`;
  };
  root.innerHTML = `<div class="scrim" data-close></div>
  <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div style="display:flex;align-items:center;justify-content:space-between"><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="Close">${I.x}</button></div>
    <input class="search" id="picker-q" type="search" placeholder="Search exercises" autocomplete="off">
    <div class="toggles" style="margin:.75rem 0">${MUSCLES.map((m) => `<button data-muscle="${m}" aria-pressed="false">${m}</button>`).join("")}</div>
    <div id="picker-list"></div>
  </div>`;
  sheetOpen = true;
  draw();
  $("#picker-q").addEventListener("input", (e) => { q = e.target.value; draw(); });
  root.onclick = (e) => {
    const t = e.target.closest("[data-close],[data-pick],[data-create],[data-muscle]");
    if (!t) return;
    if (t.dataset.muscle) {
      muscle = muscle === t.dataset.muscle ? null : t.dataset.muscle;
      root.querySelectorAll("[data-muscle]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.muscle === muscle)));
      draw();
      return;
    }
    if (t.dataset.pick) { closeSheet(); onPick(t.dataset.pick); return; }
    if ("create" in t.dataset) {
      const eq = $("#new-eq").value;
      const ex = db.put("exercise", { id: db.uid("ex"), name: q.trim(), equipment: eq, muscles: muscle ? [muscle] : [], increment: DEFAULT_INCREMENT[eq], notes: "" });
      closeSheet(); onPick(ex.id); return;
    }
    closeSheet();
  };
}

function closeSheet() {
  $("#sheet-root").innerHTML = "";
  $("#sheet-root").onclick = null;
  sheetOpen = false;
}

function confirmSheet({ title, body, ok, okClass = "primary", cancel = "Cancel", extra }) {
  return new Promise((resolve) => {
    const root = $("#sheet-root");
    root.innerHTML = `<div class="scrim" data-v="cancel"></div>
      <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <h2>${esc(title)}</h2>${body ? `<p class="muted">${body}</p>` : ""}
        <div class="actions">
          <button class="btn ${okClass} block" data-v="ok">${esc(ok)}</button>
          ${extra ? `<button class="btn danger block" data-v="extra">${esc(extra)}</button>` : ""}
          <button class="btn quiet block" data-v="cancel">${esc(cancel)}</button>
        </div></div>`;
    sheetOpen = true;
    root.onclick = (e) => {
      const v = e.target.closest("[data-v]")?.dataset.v;
      if (!v) return;
      closeSheet();
      resolve(v);
    };
    $('[data-v="ok"]', root).focus();
  });
}

// ---------- Runner ----------
function viewRun() {
  const w = activeWorkout();
  if (!w) return `<header class="top"><a class="icon-btn" href="#/" aria-label="Back">${I.back}</a></header><div class="empty"><p>No workout in progress.</p><a class="btn primary" href="#/">Choose a routine</a></div>`;
  const n = w.entries.length;
  const idx = Math.min(db.ui().runIndex || 0, Math.max(0, n - 1));
  if (!n) return `<header class="top"><a class="icon-btn" href="#/">${I.back}</a></header><p>This routine has no exercises.</p>`;
  const e = w.entries[idx];
  const ex = db.get("exercise", e.exerciseId);
  const t = e.target;
  const next = w.entries[idx + 1];
  const st = (en) => { const d = en.sets.filter((s) => s.done).length; return d === 0 ? "none" : d >= en.sets.length ? "done" : "part"; };

  return `
  <header class="top">
    <a class="icon-btn" href="#/" aria-label="Back to routines">${I.back}</a>
    <div class="grow title">${esc(w.name)}</div>
    <button class="icon-btn" data-act="run-menu" aria-label="Workout options">${I.more}</button>
  </header>
  <div class="seq-strip" role="list" aria-label="Exercises">
    ${w.entries.map((en, i) => `<button role="listitem" data-act="jump" data-i="${i}" data-state="${st(en)}" ${i === idx ? 'aria-current="step"' : ""} aria-label="${esc(en.name)}">${i + 1}</button>`).join("")}
  </div>
  <h1 class="ex-title">${esc(e.name)}</h1>
  <div class="chips">${(ex?.muscles || []).map((m) => `<span class="chip">${esc(m)}</span>`).join("")}</div>
  <div class="target">
    <span>${t.sets} × ${repRange(t)}<small>sets × reps</small></span>
    <span>${mmss(t.restSec)}<small>rest</small></span>
  </div>
  <div class="advice" data-kind="${e.advice.kind}">${esc(e.advice.text)}</div>
  ${isBar(ex) ? `<div class="loadout" id="loadout">${loadoutHtml(e)}</div>` : ""}
  ${e.last ? `<p class="last">Last time, ${fmtShort(e.last.at)}: ${setsText(e.last.sets)}</p>` : ""}
  <div class="sets">
    <div class="set-head"><span></span><span>${isBodyweight(ex) ? "Added kg" : "kg"}</span><span>Reps</span><span></span></div>
    ${e.sets.map((s, si) => setRow(s, si, ex)).join("")}
  </div>
  <div style="display:flex;gap:.5rem;margin-top:.5rem">
    <button class="btn sm" data-act="add-set">Add set</button>
    ${e.sets.length > 1 ? `<button class="btn sm quiet" data-act="remove-set">Remove last set</button>` : ""}
  </div>
  ${next ? `<div class="up-next"><div class="muted">Up next</div><h3>${esc(next.name)}</h3><div class="small muted">${next.target.sets} × ${repRange(next.target)}${next.sets[0]?.weight ? ` at ${fmtKg(next.sets[0].weight)} kg` : ""}</div></div>` : ""}
  <div class="run-nav">
    <button class="btn" data-act="jump" data-i="${idx - 1}" ${idx === 0 ? "disabled" : ""}>Previous</button>
    ${next ? `<button class="btn primary" data-act="jump" data-i="${idx + 1}">Next exercise</button>`
           : `<button class="btn primary" data-act="finish">Finish workout</button>`}
  </div>`;
}

function setRow(s, si, ex) {
  const step = incrementFor(null, ex) || 1;
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
  </div>`;
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

function saveWorkout(w) { db.put("workout", w); }

async function finishWorkout() {
  const w = activeWorkout();
  if (!w) return;
  const open = w.entries.reduce((a, e) => a + e.sets.filter((s) => !s.done).length, 0);
  const done = w.entries.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0);
  if (!done) {
    const v = await confirmSheet({ title: "No sets ticked yet", body: "Tick the sets you've done, or discard this workout.", ok: "Keep going", extra: "Discard workout", cancel: "Cancel" });
    if (v === "extra") discardWorkout(w);
    return;
  }
  const v = await confirmSheet({
    title: "Finish workout?",
    body: open ? `${open} set${open === 1 ? " isn't" : "s aren't"} ticked and won't be saved.` : "Every set is ticked.",
    ok: "Finish workout", cancel: "Keep going",
  });
  if (v !== "ok") return;
  w.finishedAt = Date.now();
  w.entries = w.entries.map((e) => ({ ...e, sets: e.sets.filter((s) => s.done) })).filter((e) => e.sets.length);
  saveWorkout(w);
  db.ui({ activeWorkoutId: null, rest: null, runIndex: 0 });
  go(`#/workout/${w.id}`);
}

function discardWorkout(w) {
  db.remove("workout", w.id);
  db.ui({ activeWorkoutId: null, rest: null, runIndex: 0 });
  go("#/");
  toast("Workout discarded");
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

// ---------- Wake lock (keep the screen on mid-workout) ----------
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
  if (!w) return `<header class="top"><a class="icon-btn" href="#/history" aria-label="Back">${I.back}</a></header><p>This workout was deleted.</p>`;
  const sets = w.entries.flatMap((e) => e.sets);
  const vol = sets.reduce((a, s) => a + (+s.weight || 0) * (s.reps || 0), 0);
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
  </div>
  ${w.entries.map((e) => {
    const best = Math.max(...e.sets.map((s) => e1rm(+s.weight || 0, s.reps)));
    const prev = bestBefore(e.exerciseId, w.startedAt);
    const pr = best > 0 && prev > 0 && best > prev + 0.01;
    return `<div class="wo-ex">
      <h3><a href="#/exercise/${e.exerciseId}" style="text-decoration:none">${esc(e.name)}</a>${pr ? `<span class="badge">New best</span>` : ""}</h3>
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
  }).join("")}</ul>` : `<div class="empty"><p>Finished workouts show up here.</p><a class="btn primary" href="#/">Start a workout</a></div>`}
  ${tabs("history")}`;
}

// ---------- Exercises ----------
let exQuery = "";
function viewExercises() {
  const ql = exQuery.trim().toLowerCase();
  const all = db.list("workout");
  const list = exercises().filter((e) => !ql || e.name.toLowerCase().includes(ql) || e.muscles?.some((m) => m.includes(ql)));
  const groups = EQUIPMENT.map((eq) => [eq, list.filter((e) => e.equipment === eq)]).filter(([, l]) => l.length);
  return `
  <header class="top"><div class="grow"><h1>Exercises</h1></div><button class="btn sm" data-act="new-exercise">New exercise</button></header>
  <input class="search" id="ex-q" type="search" placeholder="Search by name or muscle" value="${esc(exQuery)}" autocomplete="off">
  <div id="ex-list">${groups.map(([eq, l]) => `<div class="group-label">${eq}</div><ul class="rows">${l.map((e) => {
    const h = history(all, e.id)[0];
    const top = h ? Math.max(...h.sets.map((s) => +s.weight || 0)) : null;
    return `<li><a href="#/exercise/${e.id}"><span class="r-main"><span class="r-title">${esc(e.name)}</span><br><span class="r-sub">${esc((e.muscles || []).join(", "))}</span></span><span class="r-side">${h ? (top ? `${fmtKg(top)} kg` : `${Math.max(...h.sets.map((s) => s.reps))} reps`) : ""}</span></a></li>`;
  }).join("")}</ul>`).join("") || `<p class="muted" style="margin-top:1rem">No exercise matches “${esc(exQuery)}”.</p>`}</div>
  ${tabs("exercises")}`;
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
  <div class="field"><span class="small" style="font-weight:600">Equipment</span>
    <div class="toggles" style="margin-top:.35rem">${EQUIPMENT.map((e) => `<button data-act="x-eq" data-v="${e}" aria-pressed="${ex.equipment === e}">${e}</button>`).join("")}</div></div>
  <div class="field"><span class="small" style="font-weight:600">Muscles worked</span>
    <div class="toggles" style="margin-top:.35rem">${MUSCLES.map((m) => `<button data-act="x-muscle" data-v="${m}" aria-pressed="${!!ex.muscles?.includes(m)}">${m}</button>`).join("")}</div></div>
  <label class="field"><span>Weight step for suggestions (kg)</span><input class="input" type="number" inputmode="decimal" step="any" min="0" data-xfield="increment" value="${ex.increment ?? ""}" style="max-width:9rem"></label>
  <label class="field"><span>Notes</span><textarea class="input" data-xfield="notes" placeholder="Setup, cues, form reminders">${esc(ex.notes || "")}</textarea></label>
  ${hist.length ? `<div class="section-head"><h2>Sessions</h2></div><ul class="rows">${hist.map((h) => `<li><a href="#/workout/${h.workout.id}"><span class="r-main"><span class="r-title">${fmtDate(h.workout.startedAt)}</span><br><span class="r-sub">${setsText(h.sets)}</span></span><span class="r-side">${weighted ? `${fmtKg(roundTo(Math.max(...h.sets.map((s) => e1rm(+s.weight || 0, s.reps))), 0.5))} kg` : ""}</span></a></li>`).join("")}</ul>` : ""}
  ${tabs("exercises")}`;
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
    <rect x="${L}" y="0" width="${W - L - R}" height="${H}" fill="transparent" id="hit"/>
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
  return `
  <header class="top"><div class="grow"><h1>Settings</h1></div></header>
  <label class="field"><span>Barbell weight (kg)</span><input class="input" type="number" inputmode="decimal" step="any" min="0" data-sset="barKg" value="${s.barKg}" style="max-width:9rem"></label>
  <div class="field"><span class="small" style="font-weight:600">Plates you own (kg)</span>
    <div class="toggles" style="margin-top:.35rem">${ALL.map((p) => `<button data-act="plate" data-v="${p}" aria-pressed="${s.plates.includes(p)}">${p}</button>`).join("")}</div>
    <p class="small muted" style="margin-top:.4rem">Used to show which plates to load on each side.</p></div>
  <div class="section-head"><h2>Sync</h2></div>
  <p>${syncDot()}</p>
  <p class="small muted" style="margin:.4rem 0 .8rem">Everything is saved on this phone first and copied to your account when there's a connection.${db.pendingCount() ? ` ${db.pendingCount()} change${db.pendingCount() === 1 ? "" : "s"} waiting.` : ""}</p>
  <p class="small muted" id="whoami"></p>
  <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.8rem">
    <button class="btn sm" data-act="sync-now">Sync now</button>
    <button class="btn sm" data-act="export">Download my data</button>
  </div>
  ${tabs("settings")}`;
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
    case "new-routine": return newRoutine();
    case "start": return startWorkout(t.dataset.id);

    // routine editor
    case "add-item": {
      const r = db.get("routine", route().id);
      return openPicker((exId) => { r.items = [...(r.items || []), routineItem(exId)]; db.put("routine", r); render(); });
    }
    case "swap-ex": {
      const r = db.get("routine", route().id);
      return openPicker((exId) => { r.items[i] = { ...r.items[i], exerciseId: exId }; db.put("routine", r); render(); }, "Change exercise");
    }
    case "move": {
      const r = db.get("routine", route().id); const j = i + +t.dataset.d;
      [r.items[i], r.items[j]] = [r.items[j], r.items[i]]; db.put("routine", r); return render();
    }
    case "remove-item": {
      const r = db.get("routine", route().id); r.items.splice(i, 1); db.put("routine", r); return render();
    }
    case "delete-routine": {
      const v = await confirmSheet({ title: "Delete this routine?", body: "Past workouts stay in your history.", ok: "Delete routine", okClass: "danger" });
      if (v === "ok") { db.remove("routine", t.dataset.id); go("#/"); toast("Routine deleted"); }
      return;
    }

    // runner
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
      saveWorkout(w); return render();
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
        s.done = false; delete s.at;
      }
      saveWorkout(w); return render();
    }
    case "add-set": {
      const { w, e } = curEntry(); if (!e) return;
      const prev = e.sets[e.sets.length - 1];
      e.sets.push({ weight: prev?.weight ?? null, reps: prev?.reps ?? e.target.repMin, done: false });
      saveWorkout(w); return render();
    }
    case "remove-set": {
      const { w, e } = curEntry(); if (!e || e.sets.length < 2) return;
      e.sets.pop(); saveWorkout(w); return render();
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
      const v = await confirmSheet({ title: "Workout options", ok: "Finish workout", extra: "Discard workout", cancel: "Close" });
      if (v === "ok") finishWorkout();
      if (v === "extra") {
        const c = await confirmSheet({ title: "Discard this workout?", body: "Nothing from this session will be saved.", ok: "Discard workout", okClass: "danger" });
        if (c === "ok") discardWorkout(w);
      }
      return;
    }

    // workouts, exercises, settings
    case "delete-workout": {
      const v = await confirmSheet({ title: "Delete this workout?", body: "Its sets will no longer count towards suggestions or charts.", ok: "Delete workout", okClass: "danger" });
      if (v === "ok") { db.remove("workout", t.dataset.id); go("#/history"); toast("Workout deleted"); }
      return;
    }
    case "new-exercise": {
      const ex = db.put("exercise", { id: db.uid("ex"), name: "New exercise", equipment: "dumbbell", muscles: [], increment: DEFAULT_INCREMENT.dumbbell, notes: "" });
      go(`#/exercise/${ex.id}`);
      setTimeout(() => { const n = $('[data-xfield="name"]'); n?.focus(); n?.select(); }, 50);
      return;
    }
    case "delete-exercise": {
      const used = routines().filter((r) => r.items?.some((it) => it.exerciseId === t.dataset.id));
      const v = await confirmSheet({
        title: "Delete this exercise?",
        body: used.length ? `It's in ${used.map((r) => esc(r.name)).join(", ")}. It will be removed from ${used.length === 1 ? "that routine" : "those routines"}. Past workouts keep their sets.` : "Past workouts keep their sets.",
        ok: "Delete exercise", okClass: "danger",
      });
      if (v !== "ok") return;
      for (const r of used) { r.items = r.items.filter((it) => it.exerciseId !== t.dataset.id); db.put("routine", r); }
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
      const ex = db.get("exercise", route().id); const m = t.dataset.v;
      ex.muscles = ex.muscles?.includes(m) ? ex.muscles.filter((x) => x !== m) : [...(ex.muscles || []), m];
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
    saveWorkout(w);
    return;
  }
  if (el.dataset.rfield) {
    const r = db.get("routine", route().id); r[el.dataset.rfield] = el.value; db.put("routine", r); return;
  }
  if (el.dataset.ifield) {
    const r = db.get("routine", route().id); const it = r.items[+el.dataset.i];
    if (el.value !== "") it[el.dataset.ifield] = Math.max(0, Math.round(+el.value));
    db.put("routine", r); return;
  }
  if (el.dataset.xfield) {
    const ex = db.get("exercise", route().id); const f = el.dataset.xfield;
    ex[f] = f === "increment" ? (el.value === "" ? null : +el.value) : el.value;
    db.put("exercise", ex); return;
  }
  if (el.dataset.sset) {
    const s = { ...db.settings() }; if (el.value !== "") s[el.dataset.sset] = +el.value; db.put("settings", s);
  }
});

// Tidy up routine numbers when a field is left.
document.addEventListener("change", (ev) => {
  const el = ev.target;
  if (el.dataset.ifield) {
    const r = db.get("routine", route().id); const it = r.items[+el.dataset.i];
    it.sets = Math.min(20, Math.max(1, it.sets || 1));
    it.repMin = Math.max(1, it.repMin || 1);
    it.repMax = Math.max(it.repMin, it.repMax || it.repMin);
    db.put("routine", r);
    el.closest(".item").querySelectorAll("[data-ifield]").forEach((x) => { x.value = it[x.dataset.ifield]; });
  }
  if (el.dataset.rfield === "name" && !el.value.trim()) {
    const r = db.get("routine", route().id); r.name = "Untitled routine"; db.put("routine", r); el.value = r.name;
  }
});

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
  if (pendingRender && !busy()) { pendingRender = false; render(); }
});
document.addEventListener("focusout", () => setTimeout(() => {
  if (pendingRender && !busy()) { pendingRender = false; render(); }
}, 0));

async function whoami() {
  try {
    const r = await fetch("/api/me", { redirect: "manual" });
    if (r.ok) { const { email } = await r.json(); const el = $("#whoami"); if (el) el.textContent = `Signed in as ${email}`; }
  } catch {}
}

// ---------- boot ----------
db.seedIfEmpty();
render();
db.startSyncLoop();
if (route().name === "settings") whoami();
addEventListener("hashchange", () => route().name === "settings" && whoami());
if ("serviceWorker" in navigator && location.hostname !== "localhost") {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
