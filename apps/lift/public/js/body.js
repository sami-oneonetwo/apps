// Front and back body map. Primary muscles solid, secondary light.
// Simple original drawing: each muscle is a few rounded shapes.

const F = 50;   // front figure centre x
const B = 150;  // back figure centre x

// [cx, cy, rx, ry, rotate]: mirrored where marked m:true
const REGIONS = {
  front: {
    shoulders: [[17, 37, 7, 6, 0, true]],
    chest: [[8.5, 44, 8.5, 7, 0, true]],
    biceps: [[24, 57, 4.2, 8, -8, true]],
    forearms: [[27, 77, 3.6, 9, -10, true]],
    core: [[0, 65, 9, 13, 0]],
    quads: [[8, 104, 6.5, 17, 4, true]],
    adductors: [[3, 98, 2.4, 9, 6, true]],
    calves: [[8, 146, 3.4, 11, 0, true]],
  },
  back: {
    "upper back": [[0, 41, 12, 7, 0]],
    shoulders: [[17, 37, 7, 6, 0, true]],
    lats: [[11, 56, 6, 11, -12, true]],
    triceps: [[24, 56, 4.2, 8.5, -8, true]],
    forearms: [[27, 77, 3.6, 9, -10, true]],
    "lower back": [[0, 74, 7, 7, 0]],
    glutes: [[7, 89, 8, 7.5, 0, true]],
    hamstrings: [[8, 112, 6, 14, 3, true]],
    calves: [[8, 145, 4.5, 11, 0, true]],
  },
};

const SILHOUETTE = (cx) => `
  <circle cx="${cx}" cy="14" r="9"/>
  <rect x="${cx - 4}" y="21" width="8" height="8" rx="2"/>
  <path d="M${cx - 21} 31 Q${cx} 26 ${cx + 21} 31 L${cx + 26} 50 L${cx + 31} 86 L${cx + 24} 87 L${cx + 18} 56 L${cx + 15} 80 L${cx + 16} 122 L${cx + 13} 168 L${cx + 4} 168 L${cx + 2} 112 L${cx} 100 L${cx - 2} 112 L${cx - 4} 168 L${cx - 13} 168 L${cx - 16} 122 L${cx - 15} 80 L${cx - 18} 56 L${cx - 24} 87 L${cx - 31} 86 L${cx - 26} 50 Z"/>`;

function shapes(regions, cx, primary, secondary) {
  const out = [];
  for (const [muscle, list] of Object.entries(regions)) {
    const cls = primary.includes(muscle) ? "m-pri" : secondary.includes(muscle) ? "m-sec" : "m-off";
    for (const [x, y, rx, ry, rot, mirror] of list) {
      const draw = (sx) => `<ellipse class="${cls}" cx="${cx + sx}" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(${sx < 0 ? -rot : rot} ${cx + sx} ${y})"><title>${muscle}</title></ellipse>`;
      out.push(mirror ? draw(-x) + draw(x) : draw(x));
    }
  }
  return out.join("");
}

export function bodyMap(primary = [], secondary = []) {
  const label = [primary.length ? `Main: ${primary.join(", ")}` : "", secondary.length ? `also: ${secondary.join(", ")}` : ""].filter(Boolean).join("; ");
  return `<svg class="body-map" viewBox="0 0 200 176" role="img" aria-label="Muscles worked. ${label}">
    <g class="silhouette">${SILHOUETTE(F)}${SILHOUETTE(B)}</g>
    ${shapes(REGIONS.front, F, primary, secondary)}
    ${shapes(REGIONS.back, B, primary, secondary)}
    <text x="${F}" y="175" text-anchor="middle" class="bm-label">Front</text>
    <text x="${B}" y="175" text-anchor="middle" class="bm-label">Back</text>
  </svg>`;
}
