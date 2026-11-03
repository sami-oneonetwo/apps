// Movement animations: a jointed figure posed by angles, moving between a start
// and end pose at the exercise's tempo. Original drawings, no external media.
//
// Angles are degrees: 0 = up, 90 = right (the way the figure faces), 180 = down, -90 = left.

const SEG = { foot: 15, shin: 40, thigh: 42, torso: 52, neck: 15, uarm: 28, farm: 26 };
const GROUND = 170;
const rad = (a) => (a * Math.PI) / 180;
const v = (a, L) => [L * Math.sin(rad(a)), -L * Math.cos(rad(a))];
const add = (p, q) => [p[0] + q[0], p[1] + q[1]];
const sub = (p, q) => [p[0] - q[0], p[1] - q[1]];

/** Knee position for a leg with hip and ankle fixed. side = +1 bends one way, -1 the other. */
function ik(hip, ankle, L1, L2, side) {
  const dx = ankle[0] - hip[0], dy = ankle[1] - hip[1];
  const d = Math.min(Math.hypot(dx, dy), L1 + L2 - 0.01);
  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  const px = hip[0] + (a * dx) / d, py = hip[1] + (a * dy) / d;
  return [px + (side * -dy * h) / d, py + (side * dx * h) / d];
}

// ---------- side view ----------
function sideJoints(p, root) {
  const J = {};
  const footFrom = (ankle, a) => add(ankle, v(a, SEG.foot));
  if (root === "toe") {
    J.toe = p.at; J.ankle = sub(J.toe, v(p.foot, SEG.foot));
    J.knee = add(J.ankle, v(p.shin, SEG.shin)); J.hip = add(J.knee, v(p.thigh, SEG.thigh));
  } else if (root === "ankle") {
    J.ankle = p.at; J.toe = footFrom(J.ankle, p.foot ?? 90);
    J.knee = add(J.ankle, v(p.shin, SEG.shin)); J.hip = add(J.knee, v(p.thigh, SEG.thigh));
  } else if (root === "ik") {
    J.hip = p.at; J.toe = p.toeAt; J.ankle = sub(J.toe, v(p.foot, SEG.foot));
    J.knee = ik(J.hip, J.ankle, SEG.thigh, SEG.shin, p.bend ?? -1);
  } else if (root === "knee") {
    J.knee = p.at; J.hip = add(J.knee, v(p.thigh, SEG.thigh));
    J.ankle = add(J.knee, v(p.shinD, SEG.shin)); J.toe = footFrom(J.ankle, p.footD ?? p.shinD - 90);
  } else if (root === "wrist") {
    J.wrist = p.at; J.elbow = sub(J.wrist, v(p.farm, SEG.farm));
    J.shoulder = sub(J.elbow, v(p.uarm, SEG.uarm)); J.hip = sub(J.shoulder, v(p.torso, SEG.torso));
  } else { // hip
    J.hip = p.at;
  }
  if (!J.knee) {
    J.knee = add(J.hip, v(p.thighD, SEG.thigh)); J.ankle = add(J.knee, v(p.shinD, SEG.shin));
    J.toe = footFrom(J.ankle, p.footD ?? p.shinD - 90);
  }
  J.shoulder ||= add(J.hip, v(p.torso, SEG.torso));
  J.head = add(J.shoulder, v(p.neck ?? p.torso, SEG.neck));
  J.elbow ||= add(J.shoulder, v(p.uarm, SEG.uarm));
  J.wrist ||= add(J.elbow, v(p.farm, SEG.farm));
  if (p.uarm2 != null) { J.elbow2 = add(J.shoulder, v(p.uarm2, SEG.uarm)); J.wrist2 = add(J.elbow2, v(p.farm2 ?? p.uarm2, SEG.farm)); }
  if (p.toe2At) {
    J.toe2 = p.toe2At; J.ankle2 = sub(J.toe2, v(p.foot2 ?? 90, SEG.foot));
    J.knee2 = ik(J.hip, J.ankle2, SEG.thigh, SEG.shin, p.bend2 ?? -1);
  } else if (p.thigh2 != null) {
    J.knee2 = add(J.hip, v(p.thigh2, SEG.thigh)); J.ankle2 = add(J.knee2, v(p.shin2 ?? p.thigh2, SEG.shin));
    J.toe2 = add(J.ankle2, v(p.foot2 ?? (p.shin2 ?? p.thigh2) - 90, SEG.foot));
  }
  if (p.mace != null) J.maceEnd = add(J.wrist, v(p.mace, 46));
  return J;
}

// ---------- front view ----------
function frontJoints(p) {
  const J = {};
  const pelvis = p.at;
  const torsoLen = p.torsoLen ?? SEG.torso;
  J.neck = [pelvis[0], pelvis[1] - torsoLen];
  J.head = [pelvis[0], J.neck[1] - (p.headUp ?? 14)];
  const mir = (a) => (a == null ? null : -a);
  for (const [s, dir] of [["R", 1], ["L", -1]]) {
    const hip = [pelvis[0] + dir * 9, pelvis[1]];
    const thigh = p["thigh" + s] ?? (s === "L" ? mir(p.thighR ?? 180) : 180);
    const shin = p["shin" + s] ?? (s === "L" ? mir(p.shinR ?? p.thighR ?? 180) : thigh);
    const knee = add(hip, v(thigh, p.thighLen ?? SEG.thigh));
    const ankle = add(knee, v(shin, p.shinLen ?? SEG.shin));
    const sh = [pelvis[0] + dir * 17, J.neck[1] + 5];
    const ua = p["uarm" + s] ?? (s === "L" ? mir(p.uarmR ?? 180) : 180);
    const fa = p["farm" + s] ?? (s === "L" ? mir(p.farmR ?? p.uarmR ?? 180) : ua);
    const elbow = add(sh, v(ua, p.uarmLen ?? SEG.uarm));
    const wrist = add(elbow, v(fa, p.farmLen ?? SEG.farm));
    Object.assign(J, { ["hip" + s]: hip, ["knee" + s]: knee, ["ankle" + s]: ankle, ["shoulder" + s]: sh, ["elbow" + s]: elbow, ["wrist" + s]: wrist });
  }
  return J;
}

// ---------- drawing ----------
const line = (a, b, cls, w) => `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" class="${cls}" stroke-width="${w}"/>`;
const circle = (c, r, cls) => `<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="${r}" class="${cls}"/>`;
const at = (J, name, dx = 0, dy = 0) => { const p = J[name]; return [p[0] + dx, p[1] + dy]; };

function propSvg(pr, J) {
  switch (pr.t) {
    case "rect": return `<rect x="${pr.x}" y="${pr.y}" width="${pr.w}" height="${pr.h}" rx="${pr.r ?? 2}" class="mv-kit"/>`;
    case "poly": return `<polygon points="${pr.pts.map((p) => p.join(",")).join(" ")}" class="mv-kit"/>`;
    case "bar": return line([pr.x1, pr.y1], [pr.x2, pr.y2], "mv-kit-line", pr.w ?? 4);
    case "plate": { const c = at(J, pr.at, pr.dx, pr.dy); return circle(c, pr.r ?? 15, "mv-plate") + circle(c, 3, "mv-hub"); }
    case "db": { const c = at(J, pr.at, pr.dx, pr.dy); return `<g class="mv-db"><rect x="${c[0] - 9}" y="${c[1] - 2}" width="18" height="4" rx="1"/><rect x="${c[0] - 11}" y="${c[1] - 5.5}" width="5" height="11" rx="1.5"/><rect x="${c[0] + 6}" y="${c[1] - 5.5}" width="5" height="11" rx="1.5"/></g>`; }
    case "kb": { const c = at(J, pr.at, pr.dx ?? 0, (pr.dy ?? 0) + 8); return `${circle(c, 8, "mv-kb")}<path d="M${c[0] - 5} ${c[1] - 6} q5 -8 10 0" class="mv-kb-h"/>`; }
    case "cable": { const w = at(J, pr.at); return line(pr.from, w, "mv-cable", 1.5) + circle(pr.from, 4, "mv-pulley"); }
    case "pad": { const c = at(J, pr.at, pr.dx, pr.dy); return `<rect x="${c[0] - pr.w / 2}" y="${c[1] - pr.h / 2}" width="${pr.w}" height="${pr.h}" rx="${pr.h / 2}" class="mv-pad"/>`; }
    case "handle": { const c = at(J, pr.at); return `<rect x="${c[0] - 3}" y="${c[1] - 6}" width="6" height="12" rx="2" class="mv-handle"/>`; }
    case "mace": return line(J.wrist, J.maceEnd, "mv-kit-line", 3) + circle(J.maceEnd, 8, "mv-kb");
    case "floor": return line([0, GROUND], [200, GROUND], "mv-floor", 2);
    default: return "";
  }
}

function sideFigure(J) {
  const out = [];
  const limb = (pts, cls, w) => pts.slice(1).map((p, i) => line(pts[i], p, cls, w)).join("");
  if (J.knee2) out.push(limb([J.hip, J.knee2, J.ankle2, J.toe2], "mv-far", 8));
  if (J.elbow2) out.push(limb([J.shoulder, J.elbow2, J.wrist2], "mv-far", 7));
  out.push(limb([J.hip, J.knee, J.ankle, J.toe], "mv-limb", 8.5));
  out.push(line(J.hip, J.shoulder, "mv-torso", 13));
  out.push(circle(J.head, 9.5, "mv-head"));
  out.push(limb([J.shoulder, J.elbow, J.wrist], "mv-limb", 7.5));
  return out.join("");
}

function frontFigure(J) {
  const out = [];
  const limb = (pts, cls, w) => pts.slice(1).map((p, i) => line(pts[i], p, cls, w)).join("");
  for (const s of ["L", "R"]) out.push(limb([J["hip" + s], J["knee" + s], J["ankle" + s]], "mv-limb", 8.5));
  out.push(`<polygon points="${[J.shoulderL, J.shoulderR, J.hipR, J.hipL].map((p) => p.map((n) => n.toFixed(1)).join(",")).join(" ")}" class="mv-torso-fill"/>`);
  out.push(circle(J.head, 10, "mv-head"));
  for (const s of ["L", "R"]) out.push(limb([J["shoulder" + s], J["elbow" + s], J["wrist" + s]], "mv-limb", 7.5));
  return out.join("");
}

function lerpPose(A, B, t) {
  const o = {};
  for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) {
    const a = A[k] ?? B[k], b = B[k] ?? A[k];
    o[k] = Array.isArray(a) ? a.map((x, i) => x + (b[i] - x) * t) : typeof a === "number" ? a + (b - a) * t : a;
  }
  return o;
}

export function frameSvg(spec, t) {
  const p = lerpPose(spec.A, spec.B, t);
  const J = spec.view === "front" ? frontJoints(p) : sideJoints(p, spec.root);
  const props = (spec.props || []).map((pr) => propSvg(pr, J));
  const behind = props.filter((_, i) => spec.props[i].behind !== false).join("");
  const front = props.filter((_, i) => spec.props[i].behind === false).join("");
  return `${spec.floor === false ? "" : propSvg({ t: "floor" }, J)}${behind}${spec.view === "front" ? frontFigure(J) : sideFigure(J)}${front}`;
}

const ease = (x) => 0.5 - Math.cos(Math.PI * x) / 2;

/** Position 0..1 between the start and end pose at time ms. */
export function phaseAt(spec, ms) {
  const [go, back] = spec.tempo || [1.5, 1.5];
  const [h1, h2] = spec.hold || [0.4, 0.4];
  const T = go + h1 + back + h2;
  let s = (ms / 1000) % T;
  if (s < go) return { t: ease(s / go), label: spec.labels?.[0] };
  s -= go;
  if (s < h1) return { t: 1, label: spec.labels?.[0] };
  s -= h1;
  if (s < back) return { t: 1 - ease(s / back), label: spec.labels?.[1] };
  return { t: 0, label: spec.labels?.[1] };
}

const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Markup for a movement figure; call start() after it's in the DOM. */
export function movementHtml(spec, name) {
  if (!spec) return "";
  const [go, back] = spec.tempo || [1.5, 1.5];
  const tempo = spec.labels ? `${spec.labels[0]} ${go} s, ${spec.labels[1].toLowerCase()} ${back} s` : "";
  return `<figure class="mv" data-mv>
    <svg viewBox="0 -38 200 220" role="img" aria-label="Animation of ${name}: ${spec.say || "the movement"}">
      <g data-frame>${frameSvg(spec, reduced() ? 1 : 0)}</g>
    </svg>
    <figcaption><span data-mv-phase>${spec.labels?.[0] ?? ""}</span>${tempo ? `<span class="mv-tempo">${tempo}</span>` : ""}
      <button class="mv-toggle" data-act="mv-toggle" aria-pressed="${!reduced()}">${reduced() ? "Play" : "Pause"}</button></figcaption>
  </figure>`;
}

const running = new WeakMap();
/** Animate every [data-mv] figure inside root for the given spec (one per root). */
export function start(root, spec) {
  const fig = root?.querySelector("[data-mv]");
  if (!fig || !spec) return;
  const g = fig.querySelector("[data-frame]"), label = fig.querySelector("[data-mv-phase]");
  const state = { playing: !reduced(), t0: performance.now(), pausedAt: 0 };
  running.set(fig, state);
  let lastLabel = null;
  const tick = (now) => {
    if (!fig.isConnected) return;
    if (state.playing) {
      const { t, label: l } = phaseAt(spec, now - state.t0);
      g.innerHTML = frameSvg(spec, t);
      if (l !== lastLabel && label) { label.textContent = l ?? ""; lastLabel = l; }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export function toggle(btn) {
  const fig = btn.closest("[data-mv]");
  const state = fig && running.get(fig);
  if (!state) return;
  state.playing = !state.playing;
  if (state.playing) state.t0 = performance.now() - state.pausedAt;
  else state.pausedAt = performance.now() - state.t0;
  btn.setAttribute("aria-pressed", String(state.playing));
  btn.textContent = state.playing ? "Pause" : "Play";
}
