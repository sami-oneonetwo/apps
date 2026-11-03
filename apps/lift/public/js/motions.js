// Start (A) and end (B) poses for each exercise. See anim.js for the angle convention:
// 0 = up, 90 = forward (right), 180 = down, -90 = back (left). Ground is y = 170.

const bench = (x, y, w, h = 9) => [
  { t: "rect", x, y, w, h, r: 3 },
  { t: "rect", x: x + 6, y: y + h, w: 5, h: 170 - y - h, r: 1 },
  { t: "rect", x: x + w - 11, y: y + h, w: 5, h: 170 - y - h, r: 1 },
];
const seat = (x, y, w = 40) => bench(x, y, w, 8);
const stand = { shin: 0, thigh: 0, torso: 0, foot: 90, uarm: 180, farm: 180 };
const A0 = [80, 170];

export const MOTIONS = {
  // ---------- calves (your physio's movement first) ----------
  "ex-seated-calf-raise": {
    root: "ik", tempo: [3, 3], hold: [1, 0.6], labels: ["Up", "Down"],
    say: "sitting with knees bent at 90 degrees under the pad, heels drop below the platform, then rise high onto the toes",
    A: { at: [58, 122], toeAt: [114, 148], foot: 68, torso: 0, uarm: 165, farm: 120, bend: -1 },
    B: { toeAt: [114, 148], foot: 136 },
    props: [...seat(22, 124, 48), { t: "rect", x: 106, y: 148, w: 30, h: 22, r: 2 }, { t: "pad", at: "knee", dx: -6, dy: -9, w: 26, h: 9, behind: false }],
  },
  "ex-seated-dumbbell-calf-raise": {
    root: "ik", tempo: [3, 3], hold: [1, 0.6], labels: ["Up", "Down"],
    say: "sitting on a bench with dumbbells resting on the knees and the balls of the feet on a plate, heels drop then rise high onto the toes",
    A: { at: [58, 122], toeAt: [114, 156], foot: 66, torso: 0, uarm: 160, farm: 110, bend: -1 },
    B: { toeAt: [114, 156], foot: 136 },
    props: [...seat(22, 124, 48), { t: "rect", x: 102, y: 156, w: 26, h: 6, r: 3 }, { t: "db", at: "knee", dx: -4, dy: -8, behind: false }],
  },
  "ex-standing-calf-raise": {
    root: "toe", tempo: [2, 2], hold: [1, 0.5], labels: ["Up", "Down"],
    say: "standing on a step with straight knees, heels drop below the step then rise high onto the toes",
    A: { ...stand, at: [96, 152], foot: 70, uarm: 175, farm: 20 },
    B: { at: [96, 152], foot: 128 },
    props: [{ t: "rect", x: 82, y: 152, w: 34, h: 18, r: 2 }, { t: "pad", at: "shoulder", dx: 4, dy: -4, w: 18, h: 8 }],
  },

  // ---------- squat / single leg ----------
  "ex-back-squat": {
    root: "ankle", tempo: [2, 1.5], hold: [0.3, 0.6], labels: ["Down", "Up"],
    say: "bar across the upper back, sit down between the heels until thighs are about level, then stand",
    A: { ...stand, at: A0, uarm: 205, farm: 30 },
    B: { shin: 32, thigh: -80, torso: 42, uarm: 230, farm: 70 },
    props: [{ t: "plate", at: "shoulder", dx: -4, dy: 3, r: 17 }],
  },
  "ex-front-squat": {
    root: "ankle", tempo: [2, 1.5], hold: [0.3, 0.6], labels: ["Down", "Up"],
    say: "bar resting on the front of the shoulders with elbows high, sit straight down, then stand",
    A: { ...stand, at: A0, uarm: 95, farm: -95 },
    B: { shin: 35, thigh: -82, torso: 22, uarm: 112, farm: -78 },
    props: [{ t: "plate", at: "shoulder", dx: 8, dy: 0, r: 17 }],
  },
  "ex-leg-press": {
    root: "ik", tempo: [2, 1.5], hold: [0.3, 0.6], labels: ["Down", "Push"],
    say: "lying back in the sled, lower the platform until the knees come towards the chest, then press it away",
    A: { at: [84, 140], toeAt: [176, 80], foot: 30, torso: -62, uarm: 150, farm: 120, bend: 1 },
    B: { toeAt: [146, 102] },
    props: [{ t: "poly", pts: [[40, 108], [50, 102], [92, 144], [82, 150]] }, { t: "rect", x: 62, y: 144, w: 40, h: 8 }, { t: "bar", x1: 92, y1: 170, x2: 196, y2: 68, w: 3 }],
  },
  "ex-goblet-squat": {
    root: "ankle", tempo: [2, 1.5], hold: [0.3, 0.6], labels: ["Down", "Up"],
    say: "holding a weight against the chest, sit down between the heels with the chest up, then stand",
    A: { ...stand, at: A0, uarm: 165, farm: 15 },
    B: { shin: 35, thigh: -82, torso: 25, uarm: 175, farm: 30 },
    props: [{ t: "kb", at: "wrist", dx: 4, dy: -4, behind: false }],
  },
  "ex-bulgarian-split-squat": {
    root: "ankle", tempo: [2, 1.5], hold: [0.3, 0.6], labels: ["Down", "Up"],
    say: "back foot on a bench, drop the back knee towards the floor, then drive up through the front heel",
    A: { ...stand, at: [108, 170], shin: 4, thigh: -8, torso: 10, toe2At: [40, 128], foot2: 200, bend2: -1 },
    B: { shin: 18, thigh: -64, torso: 22 },
    props: [...bench(10, 130, 44), { t: "db", at: "wrist", dy: 4 }],
  },
  "ex-reverse-lunge": {
    root: "ankle", tempo: [1.5, 1.5], hold: [0.3, 0.6], labels: ["Step back", "Return"],
    say: "step one foot back and drop the back knee towards the floor, then push through the front heel to stand",
    A: { ...stand, at: [104, 170], toe2At: [116, 170], foot2: 90, bend2: -1 },
    B: { shin: 10, thigh: -70, torso: 6, toe2At: [44, 170], foot2: 160 },
    props: [{ t: "db", at: "wrist", dy: 4 }],
  },
  "ex-walking-lunge": {
    root: "ankle", tempo: [1.5, 1.5], hold: [0.3, 0.4], labels: ["Step", "Drive"],
    say: "long step forward, back knee towards the floor, then push off into the next step",
    A: { ...stand, at: [110, 170], toe2At: [122, 170], foot2: 90, bend2: -1 },
    B: { shin: 10, thigh: -70, torso: 6, toe2At: [50, 170], foot2: 160 },
    props: [{ t: "db", at: "wrist", dy: 4 }],
  },

  // ---------- hinge / glutes / hamstrings ----------
  "ex-deadlift": {
    root: "ankle", tempo: [1.5, 2], hold: [0.6, 0.4], labels: ["Stand", "Lower"],
    say: "bar over mid-foot, hips back and back flat, push the floor away and stand tall",
    A: { ...stand, at: A0, shin: 20, thigh: -45, torso: 72 },
    B: { shin: 0, thigh: 0, torso: 0 },
    props: [{ t: "plate", at: "wrist", dy: 4, r: 18, behind: false }],
  },
  "ex-trap-bar-deadlift": {
    root: "ankle", tempo: [1.5, 2], hold: [0.6, 0.4], labels: ["Stand", "Lower"],
    say: "standing inside the bar, hips a little lower than a deadlift, push the floor away and stand tall",
    A: { ...stand, at: A0, shin: 26, thigh: -55, torso: 58 },
    B: { shin: 0, thigh: 0, torso: 0 },
    props: [{ t: "plate", at: "wrist", dy: 2, r: 18, behind: false }],
  },
  "ex-romanian-deadlift": {
    root: "ankle", tempo: [2.5, 1.5], hold: [0.4, 0.6], labels: ["Hips back", "Stand"],
    say: "soft knees, push the hips back so the bar slides down the thighs to mid-shin with a flat back, then drive the hips forward",
    A: { ...stand, at: A0, shin: 0, thigh: 2, torso: 0 },
    B: { shin: 10, thigh: -26, torso: 78 },
    props: [{ t: "plate", at: "wrist", dy: 2, r: 16, behind: false }],
  },
  "ex-dumbbell-romanian-deadlift": {
    root: "ankle", tempo: [2.5, 1.5], hold: [0.4, 0.6], labels: ["Hips back", "Stand"],
    say: "soft knees, push the hips back with the dumbbells close to the legs and a flat back, then drive the hips forward",
    A: { ...stand, at: A0 },
    B: { shin: 10, thigh: -26, torso: 78 },
    props: [{ t: "db", at: "wrist", dy: 3, behind: false }],
  },
  "ex-hip-thrust": {
    root: "ankle", tempo: [1, 2], hold: [1, 0.3], labels: ["Squeeze up", "Lower"],
    say: "upper back on a bench, bar over the hips, drive the hips up until the body is flat from shoulders to knees",
    A: { ...stand, at: [124, 170], shin: -5, thigh: -122, torso: -62, neck: -40, uarm: 120, farm: 80 },
    B: { shin: 2, thigh: -90, torso: -95, neck: -60, uarm: 150, farm: 60 },
    props: [...bench(4, 128, 40), { t: "plate", at: "hip", dx: 2, dy: -8, r: 16, behind: false }],
  },
  "ex-machine-hip-thrust": {
    root: "ankle", tempo: [1, 2], hold: [1, 0.3], labels: ["Squeeze up", "Lower"],
    say: "upper back on the pad and the belt over the hips, drive the hips up until the body is flat, pause, then lower",
    A: { ...stand, at: [124, 170], shin: -5, thigh: -122, torso: -62, neck: -40, uarm: 160, farm: 120 },
    B: { shin: 2, thigh: -90, torso: -95, neck: -60, uarm: 170, farm: 120 },
    props: [...bench(4, 128, 40), { t: "pad", at: "hip", dx: 0, dy: -7, w: 26, h: 8, behind: false }],
  },
  "ex-glute-bridge": {
    root: "ankle", tempo: [1, 2], hold: [1, 0.3], labels: ["Squeeze up", "Lower"],
    say: "lying on your back with heels close to your bum, press through the heels and lift the hips",
    A: { ...stand, at: [124, 170], shin: -18, thigh: -128, torso: -90, neck: -90, uarm: 150, farm: 90 },
    B: { shin: -5, thigh: -100, torso: -112, neck: -100, uarm: 150, farm: 90 },
    props: [],
  },
  "ex-cable-pull-through": {
    root: "ankle", tempo: [2, 1], hold: [0.3, 0.8], labels: ["Hinge back", "Snap forward"],
    say: "facing away from a low cable with the rope between the legs, hinge the hips back, then snap them forward",
    A: { ...stand, at: [96, 170], uarm: 175, farm: 175 },
    B: { shin: 12, thigh: -30, torso: 72, uarm: 200, farm: 205 },
    props: [{ t: "cable", from: [6, 166], at: "wrist" }],
  },
  "ex-45-degree-back-extension": {
    root: "hip", tempo: [2, 1.5], hold: [0.3, 1], labels: ["Lower", "Squeeze up"],
    say: "hips on the pad, lower the chest towards the floor, then squeeze the glutes to rise to a straight line",
    A: { at: [100, 104], thighD: -135, shinD: -135, footD: -45, torso: 45, uarm: 170, farm: 10 },
    B: { torso: 150, uarm: 290, farm: 190 },
    props: [{ t: "poly", pts: [[94, 108], [104, 98], [112, 106], [102, 116]] }, { t: "bar", x1: 30, y1: 170, x2: 100, y2: 110, w: 3 }, { t: "rect", x: 32, y: 150, w: 16, h: 6, r: 2 }],
  },
  "ex-seated-leg-curl": {
    root: "hip", tempo: [1, 2], hold: [0.6, 0.3], labels: ["Curl", "Return"],
    say: "seated with the pad behind the ankles, curl the heels down and under, then control them back",
    A: { at: [70, 118], torso: -6, thighD: 92, shinD: 98, uarm: 170, farm: 120 },
    B: { shinD: 200 },
    props: [...seat(40, 120, 44), { t: "pad", at: "ankle", dx: 0, dy: 5, w: 12, h: 12 }],
  },
  "ex-lying-leg-curl": {
    root: "hip", tempo: [1, 2], hold: [0.6, 0.3], labels: ["Curl", "Return"],
    say: "lying face down with the pad behind the ankles, curl the heels towards the bum, then lower slowly",
    A: { at: [104, 118], torso: -90, neck: -100, thighD: 90, shinD: 92, footD: 180, uarm: 180, farm: -150 },
    B: { shinD: 10, footD: 100 },
    props: [...bench(20, 122, 130), { t: "pad", at: "ankle", dx: 0, dy: -6, w: 12, h: 12 }],
  },
  "ex-cable-hip-abduction": {
    view: "front", tempo: [1, 2], hold: [0.4, 0.3], labels: ["Out", "In"],
    say: "standing side-on to a low cable with the strap on the far ankle, lift the leg out to the side",
    A: { at: [100, 88], thighR: 182, thighL: -180, uarmL: -150, farmL: -120 },
    B: { thighR: 142 },
    props: [{ t: "cable", from: [192, 166], at: "ankleR" }, { t: "bar", x1: 52, y1: 60, x2: 52, y2: 170, w: 4 }],
  },
  "ex-hip-abduction-machine": {
    view: "front", tempo: [1, 2], hold: [0.6, 0.3], labels: ["Out", "In"],
    say: "seated with pads outside the knees, push the knees apart, pause, then control back",
    A: { at: [100, 106], thighLen: 24, thighR: 172, shinR: 180, uarmR: 160, farmR: 200 },
    B: { thighR: 132, shinR: 172 },
    props: [{ t: "rect", x: 70, y: 106, w: 60, h: 8, r: 3 }, { t: "pad", at: "kneeR", dx: 7, dy: 0, w: 8, h: 18, behind: false }, { t: "pad", at: "kneeL", dx: -7, dy: 0, w: 8, h: 18, behind: false }],
  },
  "ex-leg-extension": {
    root: "hip", tempo: [1, 2], hold: [0.8, 0.3], labels: ["Extend", "Lower"],
    say: "seated with the pad on the front of the ankles, straighten the knees, squeeze, then lower",
    A: { at: [70, 118], torso: -8, thighD: 92, shinD: 178, footD: 90, uarm: 170, farm: 120 },
    B: { shinD: 96, footD: 0 },
    props: [...seat(40, 120, 44), { t: "pad", at: "ankle", dx: 4, dy: 0, w: 12, h: 12, behind: false }],
  },
  "ex-kettlebell-swing": {
    root: "ankle", tempo: [0.6, 0.6], hold: [0.15, 0.15], labels: ["Snap", "Hinge"],
    say: "hinge with the bell between the legs, then snap the hips forward so the bell floats to chest height",
    A: { ...stand, at: A0, shin: 12, thigh: -38, torso: 62, uarm: 200, farm: 205 },
    B: { shin: 0, thigh: 0, torso: -4, uarm: 92, farm: 92 },
    props: [{ t: "kb", at: "wrist", behind: false }],
  },

  // ---------- chest ----------
  "ex-bench-press": {
    root: "hip", tempo: [2, 1], hold: [0.3, 0.6], labels: ["Lower", "Press"],
    say: "lying on the bench with shoulder blades pinched, lower the bar to the lower chest, then press up",
    A: { at: [92, 124], torso: -90, neck: -90, thighD: 125, shinD: 178, uarm: 2, farm: 0 },
    B: { uarm: 150, farm: 8 },
    props: [...bench(28, 127, 92), { t: "plate", at: "wrist", r: 16, behind: false }],
  },
  "ex-incline-bench-press": {
    root: "hip", tempo: [2, 1], hold: [0.3, 0.6], labels: ["Lower", "Press"],
    say: "on a bench at about 30 degrees, lower the bar to the upper chest, then press up over the shoulders",
    A: { at: [96, 128], torso: -60, neck: -60, thighD: 112, shinD: 175, uarm: 8, farm: 4 },
    B: { uarm: 150, farm: 20 },
    props: [{ t: "poly", pts: [[96, 132], [42, 100], [36, 108], [92, 140]] }, { t: "rect", x: 80, y: 130, w: 30, h: 8 }, { t: "rect", x: 92, y: 138, w: 5, h: 32 }, { t: "plate", at: "wrist", r: 16, behind: false }],
  },
  "ex-dumbbell-bench-press": {
    root: "hip", tempo: [2, 1], hold: [0.3, 0.6], labels: ["Lower", "Press"],
    say: "lying on the bench, lower the dumbbells until you feel a stretch across the chest, then press up",
    A: { at: [92, 124], torso: -90, neck: -90, thighD: 125, shinD: 178, uarm: 0, farm: 0 },
    B: { uarm: 155, farm: 4 },
    props: [...bench(28, 127, 92), { t: "db", at: "wrist", behind: false }],
  },
  "ex-incline-dumbbell-press": {
    root: "hip", tempo: [2, 1], hold: [0.3, 0.6], labels: ["Lower", "Press"],
    say: "on a bench at about 30 degrees, lower the dumbbells to a deep stretch, then press up and in",
    A: { at: [96, 128], torso: -60, neck: -60, thighD: 112, shinD: 175, uarm: 8, farm: 2 },
    B: { uarm: 155, farm: 16 },
    props: [{ t: "poly", pts: [[96, 132], [42, 100], [36, 108], [92, 140]] }, { t: "rect", x: 80, y: 130, w: 30, h: 8 }, { t: "rect", x: 92, y: 138, w: 5, h: 32 }, { t: "db", at: "wrist", behind: false }],
  },
  "ex-machine-chest-press": {
    root: "hip", tempo: [1, 2], hold: [0.3, 0.3], labels: ["Press", "Return"],
    say: "seated with the handles at mid-chest, press forward to straight arms, then let the chest stretch on the way back",
    A: { at: [68, 120], torso: -8, thighD: 92, shinD: 178, uarm: 205, farm: 92 },
    B: { uarm: 92, farm: 90 },
    props: [...seat(40, 122, 44), { t: "rect", x: 44, y: 66, w: 8, h: 56, r: 3 }, { t: "handle", at: "wrist", behind: false }],
  },
  "ex-cable-fly": {
    view: "front", tempo: [1.5, 2], hold: [0.5, 0.3], labels: ["Hug in", "Open wide"],
    say: "arms wide with a slight bend, bring the hands together in front of the chest like hugging a tree",
    A: { at: [100, 88], uarmR: 70, farmR: 60 },
    B: { uarmR: 168, farmR: 236, uarmLen: 24 },
    props: [{ t: "cable", from: [192, 10], at: "wristR" }, { t: "cable", from: [8, 10], at: "wristL" }],
  },
  "ex-pec-deck": {
    view: "front", tempo: [1.5, 2], hold: [0.5, 0.3], labels: ["Squeeze in", "Open wide"],
    say: "seated with the handles at chest height, bring the arms together in front, then return slowly to the stretch",
    A: { at: [100, 108], thighLen: 22, uarmR: 88, farmR: 40 },
    B: { uarmR: 150, farmR: 300, uarmLen: 22 },
    props: [{ t: "rect", x: 76, y: 108, w: 48, h: 8 }, { t: "handle", at: "wristR", behind: false }, { t: "handle", at: "wristL", behind: false }],
  },
  "ex-dumbbell-fly": {
    view: "front", tempo: [2, 1.5], hold: [0.3, 0.4], labels: ["Open wide", "Arc up"],
    say: "lying on a bench (seen from the feet), lower the dumbbells out wide in an arc with fixed elbows, then bring them back up",
    A: { at: [100, 140], torsoLen: 30, thighLen: 1, shinLen: 1, headUp: 2, uarmR: 8, farmR: 0 },
    B: { uarmR: 98, farmR: 78 },
    props: [{ t: "rect", x: 82, y: 118, w: 36, h: 14, r: 3 }, { t: "rect", x: 96, y: 132, w: 8, h: 38 }, { t: "db", at: "wristR", behind: false }, { t: "db", at: "wristL", behind: false }],
  },
  "ex-push-up": {
    root: "toe", tempo: [2, 1], hold: [0.2, 0.5], labels: ["Lower", "Push"],
    say: "body in one straight line, lower the chest to the floor with elbows at about 45 degrees, then push away",
    A: { at: [160, 170], foot: 150, shin: -66, thigh: -66, torso: -66, neck: -70, uarm: 186, farm: 180 },
    B: { foot: 170, shin: -81, thigh: -81, torso: -81, neck: -84, uarm: 120, farm: 205 },
    props: [],
  },
  "ex-dip": {
    root: "wrist", tempo: [2, 1], hold: [0.2, 0.5], labels: ["Lower", "Press up"],
    say: "on the bars with a slight forward lean, lower until the shoulders are just below the elbows, then press up",
    A: { at: [92, 72], farm: 182, uarm: 180, torso: 12, neck: 16, thighD: 192, shinD: 232 },
    B: { farm: 170, uarm: 252, torso: 26, neck: 30, thighD: 200, shinD: 238 },
    props: [{ t: "bar", x1: 70, y1: 74, x2: 124, y2: 74, w: 5 }, { t: "rect", x: 116, y: 74, w: 5, h: 96 }],
    floor: true,
  },

  // ---------- shoulders ----------
  "ex-overhead-press": {
    root: "ankle", tempo: [1, 2], hold: [0.5, 0.3], labels: ["Press", "Lower"],
    say: "glutes tight and ribs down, press the bar from the shoulders to straight arms overhead, head through at the top",
    A: { ...stand, at: A0, uarm: 165, farm: -15 },
    B: { uarm: 2, farm: 0 },
    props: [{ t: "plate", at: "wrist", r: 16, behind: false }],
  },
  "ex-dumbbell-shoulder-press": {
    root: "ankle", tempo: [1, 2], hold: [0.5, 0.3], labels: ["Press", "Lower"],
    say: "dumbbells at ear height, press up to straight arms overhead, then lower with control",
    A: { ...stand, at: A0, uarm: 150, farm: -5 },
    B: { uarm: 2, farm: 0 },
    props: [{ t: "db", at: "wrist", behind: false }],
  },
  "ex-lateral-raise": {
    view: "front", tempo: [1, 2], hold: [0.4, 0.3], labels: ["Raise", "Lower"],
    say: "leading with the elbows, raise the dumbbells out to the side to shoulder height, then lower slowly",
    A: { at: [100, 88], uarmR: 168, farmR: 172 },
    B: { uarmR: 92, farmR: 100 },
    props: [{ t: "db", at: "wristR", behind: false }, { t: "db", at: "wristL", behind: false }],
  },
  "ex-cable-lateral-raise": {
    view: "front", tempo: [1, 2], hold: [0.4, 0.3], labels: ["Raise", "Lower"],
    say: "cable low and crossing in front of the body, raise the arm out to the side to shoulder height",
    A: { at: [100, 88], uarmR: 196, farmR: 206, uarmL: -170, farmL: -110 },
    B: { uarmR: 92, farmR: 100 },
    props: [{ t: "cable", from: [40, 166], at: "wristR" }, { t: "handle", at: "wristR", behind: false }],
  },
  "ex-face-pull": {
    root: "ankle", tempo: [1, 2], hold: [0.6, 0.3], labels: ["Pull", "Return"],
    say: "rope at face height, pull towards the eyes with the elbows high, finishing with hands beside the ears",
    A: { ...stand, at: [70, 170], torso: -4, uarm: 84, farm: 86 },
    B: { uarm: -96, farm: 22 },
    props: [{ t: "cable", from: [194, 34], at: "wrist" }],
  },
  "ex-rear-delt-fly": {
    view: "front", tempo: [1, 2], hold: [0.5, 0.3], labels: ["Raise", "Lower"],
    say: "hinged forward with the chest down, raise the arms out wide with a slight bend, no shrugging",
    A: { at: [100, 88], torsoLen: 30, headUp: 8, uarmR: 178, farmR: 182 },
    B: { uarmR: 96, farmR: 100 },
    props: [{ t: "db", at: "wristR", behind: false }, { t: "db", at: "wristL", behind: false }],
  },

  // ---------- back ----------
  "ex-barbell-row": {
    root: "ankle", tempo: [1, 2], hold: [0.4, 0.3], labels: ["Row", "Lower"],
    say: "hinged to about 45 degrees with a flat back, pull the bar to the lower ribs, then lower under control",
    A: { ...stand, at: A0, shin: 14, thigh: -30, torso: 58 },
    B: { uarm: 230, farm: 170 },
    props: [{ t: "plate", at: "wrist", r: 16, behind: false }],
  },
  "ex-seated-cable-row": {
    root: "hip", tempo: [1, 2], hold: [0.4, 0.3], labels: ["Row", "Stretch"],
    say: "sitting tall with feet on the platform, pull the handle to the belly button and squeeze the shoulder blades",
    A: { at: [60, 146], torso: 22, thighD: 96, shinD: 104, footD: 0, uarm: 104, farm: 98 },
    B: { torso: -4, uarm: 215, farm: 95 },
    props: [{ t: "rect", x: 30, y: 148, w: 50, h: 8 }, { t: "rect", x: 128, y: 132, w: 8, h: 38 }, { t: "cable", from: [140, 146], at: "wrist" }],
  },
  "ex-chest-supported-row": {
    root: "hip", tempo: [1, 2], hold: [0.4, 0.3], labels: ["Row", "Lower"],
    say: "chest on the incline pad, drive the elbows back and squeeze the shoulder blades, then let the arms hang",
    A: { at: [70, 122], torso: 52, thighD: 140, shinD: 182, uarm: 178, farm: 180 },
    B: { uarm: 248, farm: 175 },
    props: [{ t: "poly", pts: [[74, 116], [114, 82], [122, 90], [80, 126]], behind: false }, { t: "rect", x: 52, y: 124, w: 32, h: 8 }, { t: "handle", at: "wrist", behind: false }],
  },
  "ex-one-arm-dumbbell-row": {
    root: "ankle", tempo: [1, 2], hold: [0.4, 0.3], labels: ["Row", "Lower"],
    say: "hand and knee on the bench with a flat back, pull the dumbbell to the hip, then lower",
    A: { ...stand, at: [62, 170], shin: 8, thigh: 10, torso: 82, thigh2: 160, shin2: 260, foot2: 180, uarm: 180, farm: 180, uarm2: 172, farm2: 178 },
    B: { uarm: 240, farm: 172 },
    props: [...bench(84, 128, 64), { t: "db", at: "wrist", behind: false }],
  },
  "ex-lat-pulldown": {
    root: "hip", tempo: [1, 2], hold: [0.4, 0.3], labels: ["Pull", "Stretch"],
    say: "seated with the thighs under the pad, pull the bar to the upper chest with elbows driving down and back",
    A: { at: [80, 126], torso: -10, thighD: 92, shinD: 180, uarm: 6, farm: 4 },
    B: { torso: -16, uarm: 196, farm: 24 },
    props: [...seat(56, 128, 44), { t: "pad", at: "knee", dx: -4, dy: -8, w: 18, h: 8, behind: false }, { t: "cable", from: [80, 4], at: "wrist" }],
  },
  "ex-pull-up": {
    root: "wrist", tempo: [1.5, 2], hold: [0.5, 0.3], labels: ["Pull", "Lower"],
    say: "from a dead hang, pull the chest towards the bar, then lower all the way",
    A: { at: [100, 14], farm: 2, uarm: 0, torso: 2, thighD: 172, shinD: 192 },
    B: { farm: 8, uarm: 192, torso: -8, thighD: 160, shinD: 196 },
    props: [{ t: "bar", x1: 60, y1: 14, x2: 150, y2: 14, w: 5 }],
  },
  "ex-chin-up": {
    root: "wrist", tempo: [1.5, 2], hold: [0.5, 0.3], labels: ["Pull", "Lower"],
    say: "palms facing you, pull the chest to the bar, then lower to a full hang",
    A: { at: [100, 14], farm: 2, uarm: 0, torso: 2, thighD: 172, shinD: 192 },
    B: { farm: 6, uarm: 196, torso: -6, thighD: 160, shinD: 196 },
    props: [{ t: "bar", x1: 60, y1: 14, x2: 150, y2: 14, w: 5 }],
  },

  // ---------- arms ----------
  "ex-dumbbell-curl": {
    root: "ankle", tempo: [1, 2], hold: [0.4, 0.2], labels: ["Curl", "Lower"],
    say: "elbows pinned at the sides, curl the weight up while turning the palm up, then lower slowly",
    A: { ...stand, at: A0, uarm: 178, farm: 178 },
    B: { farm: 22 },
    props: [{ t: "db", at: "wrist", behind: false }],
  },
  "ex-hammer-curl": {
    root: "ankle", tempo: [1, 2], hold: [0.4, 0.2], labels: ["Curl", "Lower"],
    say: "thumbs up, elbows still, curl the dumbbell to the shoulder, then lower",
    A: { ...stand, at: A0, uarm: 178, farm: 178 },
    B: { farm: 22 },
    props: [{ t: "db", at: "wrist", behind: false }],
  },
  "ex-cable-curl": {
    root: "ankle", tempo: [1, 2], hold: [0.4, 0.2], labels: ["Curl", "Lower"],
    say: "facing a low cable with elbows by your sides, curl up and squeeze, then control back down",
    A: { ...stand, at: [76, 170], uarm: 178, farm: 172 },
    B: { farm: 24 },
    props: [{ t: "cable", from: [160, 166], at: "wrist" }, { t: "handle", at: "wrist", behind: false }],
  },
  "ex-triceps-pushdown": {
    root: "ankle", tempo: [1, 2], hold: [0.4, 0.2], labels: ["Push down", "Return"],
    say: "elbows pinned to the sides, push down until the arms are straight, only the forearms move",
    A: { ...stand, at: [76, 170], torso: 8, uarm: 178, farm: 42 },
    B: { farm: 176 },
    props: [{ t: "cable", from: [126, 8], at: "wrist" }],
  },
  "ex-overhead-triceps-extension": {
    root: "ankle", tempo: [1, 2], hold: [0.4, 0.3], labels: ["Extend", "Stretch"],
    say: "facing away from the cable with the rope behind the head, elbows forward, straighten the arms",
    A: { ...stand, at: [96, 170], thigh: -6, torso: 22, uarm: 18, farm: -150 },
    B: { farm: 30 },
    props: [{ t: "cable", from: [6, 70], at: "wrist" }],
  },

  // ---------- core ----------
  "ex-pallof-press": {
    root: "ankle", tempo: [1, 1.5], hold: [2, 0.3], labels: ["Press out and hold", "Back in"],
    say: "standing side-on to the cable (it pulls across your body), press the handle straight out from the chest and resist the twist",
    A: { ...stand, at: A0, uarm: 165, farm: 60 },
    B: { uarm: 92, farm: 90 },
    props: [{ t: "handle", at: "wrist", behind: false }],
  },
  "ex-dead-bug": {
    root: "hip", tempo: [2, 1.5], hold: [0.4, 0.2], labels: ["Reach away", "Return"],
    say: "lying on your back with the lower back pressed down, slowly reach one arm overhead and the opposite leg away",
    A: { at: [96, 160], torso: -90, neck: -90, uarm: 0, farm: 0, thighD: 2, shinD: 92, uarm2: 0, farm2: 0, thigh2: 2, shin2: 92 },
    B: { uarm: -88, farm: -90, thigh2: 78, shin2: 84 },
    props: [],
  },
  "ex-cable-crunch": {
    root: "knee", tempo: [1.5, 2], hold: [0.5, 0.3], labels: ["Crunch", "Return"],
    say: "kneeling with the rope beside the head, curl the ribs towards the hips while the hips stay still",
    A: { at: [86, 168], thigh: 4, shinD: -90, torso: 10, uarm: 170, farm: 10 },
    B: { thigh: 14, torso: 80, neck: 120, uarm: 262, farm: 92 },
    props: [{ t: "cable", from: [100, 4], at: "wrist" }],
  },
  "ex-hanging-leg-raise": {
    root: "wrist", tempo: [1.5, 2], hold: [0.4, 0.3], labels: ["Raise", "Lower"],
    say: "from a dead hang with no swing, curl the pelvis up and raise the legs, then lower slowly",
    A: { at: [92, 14], farm: 0, uarm: 0, torso: 0, thighD: 178, shinD: 180 },
    B: { torso: -12, thighD: 78, shinD: 92 },
    props: [{ t: "bar", x1: 60, y1: 14, x2: 150, y2: 14, w: 5 }],
  },
  "ex-copenhagen-plank": {
    root: "ankle", tempo: [1, 1], hold: [2.5, 0.8], labels: ["Hips up and hold", "Lower"],
    say: "side-lying with the top leg on a bench and the forearm on the floor, lift the hips into a straight line and hold",
    A: { at: [150, 132], foot: 0, shin: -110, thigh: -122, torso: -110, neck: -100, uarm: 168, farm: -92 },
    B: { thigh: -108, torso: -104 },
    props: [...bench(140, 136, 50)],
  },

  // ---------- other ----------
  "ex-mace-360": {
    root: "ankle", tempo: [1.2, 1.2], hold: [0.2, 0.2], labels: ["Behind", "Over and back"],
    say: "holding the mace upright in front, let it swing behind the head and back, keeping it close and the ribs down",
    A: { ...stand, at: A0, uarm: 150, farm: 20, mace: 4 },
    B: { uarm: 18, farm: -60, mace: 196 },
    props: [{ t: "mace", at: "wrist", behind: false }],
  },
};

/** Fallback by movement pattern, for exercises you add yourself. */
const BY_PATTERN = {
  squat: "ex-goblet-squat", hinge: "ex-dumbbell-romanian-deadlift", lunge: "ex-reverse-lunge", "hip-thrust": "ex-glute-bridge",
  "horizontal-push": "ex-dumbbell-bench-press", "incline-push": "ex-incline-dumbbell-press", "vertical-push": "ex-dumbbell-shoulder-press",
  "horizontal-pull": "ex-seated-cable-row", "vertical-pull": "ex-lat-pulldown", "chest-fly": "ex-cable-fly",
  "lateral-raise": "ex-lateral-raise", "rear-delt": "ex-rear-delt-fly", biceps: "ex-dumbbell-curl", triceps: "ex-triceps-pushdown",
  "calf-bent-knee": "ex-seated-calf-raise", "calf-straight": "ex-standing-calf-raise", "core-anti": "ex-pallof-press",
  "core-flex": "ex-cable-crunch", "glute-med": "ex-cable-hip-abduction", "ham-curl": "ex-seated-leg-curl",
  "quad-ext": "ex-leg-extension", "back-ext": "ex-45-degree-back-extension", mace: "ex-mace-360",
};

export function motionFor(ex) {
  if (!ex) return null;
  return MOTIONS[ex.id] || MOTIONS[BY_PATTERN[ex.pattern]] || null;
}
