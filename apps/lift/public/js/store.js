// Local-first store. Everything lives in localStorage and works offline;
// changes queue up and sync to the server whenever it can be reached.

import { SEED_EXERCISES, DEFAULT_SETTINGS, SEED_VERSION, SEED_ROUTINES } from "./seed.js";
import { blockOne } from "./program.js";

const KEY = "lift:v1";
const KINDS = ["exercise", "routine", "workout", "settings", "program", "coachlog"];

let state = load();
const listeners = new Set();
let syncTimer = null;
let syncing = false;
let syncAgain = false;

export const sync = { status: "idle", lastAt: null, detail: null };

function emptyState() {
  return { records: Object.fromEntries(KINDS.map((k) => [k, {}])), dirty: {}, cursor: 0, ui: {} };
}

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.records) {
      for (const k of KINDS) s.records[k] ||= {};
      s.dirty ||= {};
      s.ui ||= {};
      return s;
    }
  } catch {}
  return emptyState();
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Could not save locally", e);
  }
}

function emit(reason = "local") {
  for (const fn of listeners) fn(reason);
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const uid = (prefix) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Seed the library and Block 1; upgrade seeds you haven't edited when the library changes. */
export function seedIfEmpty() {
  let changed = false;
  const mark = (kind, rec) => { state.records[kind][rec.id] = structuredClone(rec); state.dirty[`${kind}:${rec.id}`] = 1; changed = true; };
  for (const e of SEED_EXERCISES) {
    const cur = state.records.exercise[e.id];
    if (!cur || (!cur.deleted && (cur.updatedAt || 0) < e.updatedAt)) mark("exercise", e);
  }
  for (const r of SEED_ROUTINES) {
    const cur = state.records.routine[r.id];
    if (!cur || (!cur.deleted && (cur.updatedAt || 0) < r.updatedAt)) mark("routine", r);
  }
  const st = state.records.settings.main;
  if (!st) mark("settings", DEFAULT_SETTINGS);
  else if ((st.updatedAt || 0) < SEED_VERSION) mark("settings", { ...DEFAULT_SETTINGS, barKg: st.barKg ?? DEFAULT_SETTINGS.barKg, plates: st.plates ?? DEFAULT_SETTINGS.plates });
  else {
    for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) if (st[k] === undefined) { st[k] = structuredClone(v); changed = true; }
  }
  if (!Object.keys(state.records.program).length) mark("program", blockOne());
  if (changed) save();
}

export function get(kind, id) {
  const r = state.records[kind][id];
  return r && !r.deleted ? r : null;
}

export function list(kind) {
  return Object.values(state.records[kind]).filter((r) => !r.deleted);
}

export function put(kind, obj) {
  const rec = { ...obj, updatedAt: Math.max(Date.now(), (state.records[kind][obj.id]?.updatedAt || 0) + 1) };
  delete rec.deleted;
  state.records[kind][rec.id] = rec;
  state.dirty[`${kind}:${rec.id}`] = 1;
  save();
  emit();
  scheduleSync();
  return rec;
}

export function remove(kind, id) {
  const prev = state.records[kind][id];
  state.records[kind][id] = { id, deleted: true, updatedAt: Math.max(Date.now(), (prev?.updatedAt || 0) + 1) };
  state.dirty[`${kind}:${id}`] = 1;
  save();
  emit();
  scheduleSync();
}

export const settings = () => get("settings", "main") || DEFAULT_SETTINGS;

/** Small bits of device-only UI state (active workout, rest timer). Not synced. */
export function ui(patch) {
  if (patch) {
    state.ui = { ...state.ui, ...patch };
    save();
    emit();
  }
  return state.ui;
}

export function exportAll() {
  return { exportedAt: new Date().toISOString(), ...Object.fromEntries(KINDS.map((k) => [k, list(k)])) };
}

// ---- sync ----

export function scheduleSync(delay = 1500) {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(runSync, delay);
}

function setStatus(s) {
  if (sync.status !== s) {
    sync.status = s;
    emit();
  }
}

export async function runSync() {
  if (syncing) {
    syncAgain = true;
    return;
  }
  syncing = true;
  setStatus("syncing");
  let remote = 0;
  try {
    let more = true;
    while (more) {
      const keys = Object.keys(state.dirty).slice(0, 500);
      const sent = keys.map((k) => {
        const [kind, ...rest] = k.split(":");
        const id = rest.join(":");
        const r = state.records[kind][id];
        const { updatedAt, deleted, ...data } = r;
        return { kind, id, updatedAt, deleted: !!deleted, data: deleted ? null : data };
      });

      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cursor: state.cursor, changes: sent }),
        credentials: "same-origin",
        redirect: "manual",
      });
      // Cloudflare Access redirects to its login page when the session has expired.
      if (res.type === "opaqueredirect" || res.status === 403) {
        sync.detail = null;
        setStatus("signin");
        return;
      }
      if (res.status === 401) {
        const b = await res.json().catch(() => ({}));
        sync.detail = b.message || null;
        setStatus("noident");
        return;
      }
      if (!res.ok) throw new Error(`sync failed: ${res.status}`);
      const body = await res.json();

      for (const c of sent) {
        const cur = state.records[c.kind][c.id];
        if (cur && cur.updatedAt === c.updatedAt) delete state.dirty[`${c.kind}:${c.id}`];
      }
      for (const c of body.changes) {
        if (!state.records[c.kind]) continue;
        const local = state.records[c.kind][c.id];
        if (local && local.updatedAt > c.updatedAt) continue;
        state.records[c.kind][c.id] = c.deleted
          ? { id: c.id, deleted: true, updatedAt: c.updatedAt }
          : { ...c.data, id: c.id, updatedAt: c.updatedAt };
        if (local && local.updatedAt <= c.updatedAt) delete state.dirty[`${c.kind}:${c.id}`];
        if (!local || local.updatedAt < c.updatedAt) remote += 1;
      }
      state.cursor = body.cursor;
      save();
      more = body.more || Object.keys(state.dirty).length > 0 && keys.length === 500;
    }
    sync.lastAt = Date.now();
    setStatus(Object.keys(state.dirty).length ? "pending" : "synced");
    emit(remote ? "remote" : "status");
  } catch (e) {
    setStatus(navigator.onLine ? "error" : "offline");
  } finally {
    syncing = false;
    if (syncAgain) {
      syncAgain = false;
      scheduleSync(200);
    }
  }
}

export const pendingCount = () => Object.keys(state.dirty).length;

export function startSyncLoop() {
  addEventListener("online", () => scheduleSync(100));
  addEventListener("offline", () => setStatus("offline"));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") scheduleSync(100);
  });
  setInterval(() => document.visibilityState === "visible" && runSync(), 60_000);
  scheduleSync(50);
}
