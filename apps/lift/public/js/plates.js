// Work out and draw the plates for one side of a barbell.

export const PLATE_STYLE = {
  25: { fill: "var(--plate-red)", h: 1 },
  20: { fill: "var(--plate-blue)", h: 1 },
  15: { fill: "var(--plate-yellow)", h: 0.9 },
  10: { fill: "var(--plate-green)", h: 0.8 },
  5: { fill: "var(--plate-white)", h: 0.58 },
  2.5: { fill: "var(--plate-steel)", h: 0.46 },
  1.25: { fill: "var(--plate-steel)", h: 0.38 },
};

/** Greedy plate breakdown per side. Returns { plates, remainder } (remainder per side, kg). */
export function perSide(total, bar, available) {
  let side = (total - bar) / 2;
  if (!(side > 0)) return { plates: [], remainder: Math.min(0, side) };
  const plates = [];
  for (const p of [...available].sort((a, b) => b - a)) {
    while (side >= p - 1e-9) {
      plates.push(p);
      side = +(side - p).toFixed(4);
    }
  }
  return { plates, remainder: side };
}

/** SVG of one sleeve, loaded from the collar outwards. */
export function plateSvg(total, bar, available) {
  const { plates, remainder } = perSide(total, bar, available);
  const H = 120, cy = H / 2;
  let x = 34;
  const parts = [
    `<rect x="0" y="${cy - 5}" width="30" height="10" rx="2" fill="var(--steel)"/>`,
    `<rect x="26" y="${cy - 14}" width="8" height="28" rx="2" fill="var(--steel)"/>`,
  ];
  for (const p of plates) {
    const st = PLATE_STYLE[p] || { fill: "var(--plate-steel)", h: 0.4 };
    const h = Math.round((H - 8) * st.h);
    const w = p >= 10 ? 16 : p >= 5 ? 12 : 9;
    parts.push(
      `<rect x="${x}" y="${cy - h / 2}" width="${w}" height="${h}" rx="3" fill="${st.fill}" stroke="var(--ink)" stroke-opacity=".25"/>`,
    );
    x += w + 2;
  }
  const sleeveEnd = Math.max(x + 18, 170);
  parts.unshift(`<rect x="30" y="${cy - 7}" width="${sleeveEnd - 30}" height="14" rx="3" fill="var(--steel-light)"/>`);
  const label = plates.length
    ? plates.map((p) => String(p)).join(" + ")
    : total > 0 && total <= bar ? "Empty bar" : "";
  return {
    svg: `<svg viewBox="0 0 ${sleeveEnd + 4} ${H}" class="plates-svg" role="img" aria-label="Per side: ${label || "nothing"}">${parts.join("")}</svg>`,
    label,
    remainder,
  };
}
