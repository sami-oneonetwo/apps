// Exercise library. Fixed IDs; updatedAt = SEED_VERSION so every device seeds the
// same records, a newer library version replaces older seeds, and any edit you
// make (stamped with the current time) always wins.

export const SEED_VERSION = 3;

export const MUSCLES = [
  "chest", "shoulders", "triceps", "biceps", "forearms", "upper back", "lats",
  "lower back", "core", "glutes", "quads", "hamstrings", "adductors", "calves",
];

export const EQUIPMENT = ["barbell", "dumbbell", "machine", "cable", "bodyweight", "kettlebell", "mace", "other"];

export const DEFAULT_INCREMENT = { barbell: 2.5, dumbbell: 2, kettlebell: 4, mace: 2, machine: 5, cable: 2.5, bodyweight: 0, other: 2.5 };

/** Movement patterns: exercises that share one can be swapped for each other. */
export const PATTERNS = {
  squat: "Squat", hinge: "Hip hinge", lunge: "Single-leg", "hip-thrust": "Glute bridge",
  "horizontal-push": "Chest press", "incline-push": "Incline press", "vertical-push": "Overhead press",
  "horizontal-pull": "Row", "vertical-pull": "Pulldown / pull-up", "chest-fly": "Chest fly",
  "lateral-raise": "Side delts", "rear-delt": "Rear delts", biceps: "Biceps", triceps: "Triceps",
  "calf-bent-knee": "Bent-knee calf raise", "calf-straight": "Straight-leg calf raise",
  "core-anti": "Core stability", "core-flex": "Core flexion", "glute-med": "Glute medius",
  "ham-curl": "Hamstring curl", "quad-ext": "Quad isolation", "back-ext": "Back extension", mace: "Mace",
  rotation: "Rotation", "kb-ballistic": "Kettlebell swing",
};

const E = (name, equipment, pattern, muscles, secondary, cues) => ({
  id: "ex-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-$/, ""),
  name, equipment, pattern, muscles, secondary, cues,
  increment: DEFAULT_INCREMENT[equipment],
  notes: "",
  updatedAt: SEED_VERSION,
});

export const SEED_EXERCISES = [
  // ---- squat / single leg ----
  E("Back squat", "barbell", "squat", ["quads", "glutes"], ["adductors", "lower back", "core"],
    ["Brace before you descend: big breath into your belly, then hold it", "Knees track over your toes", "Drive up through the whole foot, chest and hips rising together"]),
  E("Front squat", "barbell", "squat", ["quads"], ["glutes", "core", "upper back"],
    ["Elbows high so the bar sits on your shoulders, not your wrists", "Sit straight down between your heels", "Stay tall: if the elbows drop, the bar rolls"]),
  E("Leg press", "machine", "squat", ["quads", "glutes"], ["adductors"],
    ["Lower until your hips are about to lift off the pad, no further", "Push through your heels and mid-foot", "Don't lock your knees hard at the top"]),
  E("Goblet squat", "dumbbell", "squat", ["quads", "glutes"], ["core", "adductors"],
    ["Hold the bell against your chest, elbows inside your knees at the bottom", "Sit down between your heels", "Keep the chest up the whole way"]),
  E("Bulgarian split squat", "dumbbell", "lunge", ["glutes", "quads"], ["adductors"],
    ["Front foot far enough out that your shin stays fairly upright", "Lean slightly forward to bias glutes", "Push through the front heel; back leg is just for balance"]),
  E("Reverse lunge", "dumbbell", "lunge", ["glutes", "quads"], ["hamstrings", "adductors"],
    ["Step back long and drop the back knee straight down", "Most of your weight stays on the front leg", "Drive through the front heel to return"]),
  E("Walking lunge", "dumbbell", "lunge", ["quads", "glutes"], ["adductors"],
    ["Long steps, back knee towards the floor", "Torso tall", "Push off the front heel into the next step"]),

  // ---- hinge / glutes / hamstrings ----
  E("Deadlift", "barbell", "hinge", ["hamstrings", "glutes", "lower back"], ["upper back", "forearms", "quads"],
    ["Bar over mid-foot, shins touch the bar before you pull", "Pull the slack out of the bar, then push the floor away", "Lock out with glutes, not by leaning back"]),
  E("Trap bar deadlift", "barbell", "hinge", ["glutes", "quads", "hamstrings"], ["upper back", "lower back", "forearms"],
    ["Stand centred in the handle frame", "Hips a little lower than a straight-bar deadlift", "Push the floor away and stand tall"]),
  E("Romanian deadlift", "barbell", "hinge", ["hamstrings", "glutes"], ["lower back", "forearms"],
    ["Soft knees, push your hips back like closing a door with your bum", "Bar slides down your thighs, back flat", "Stop when your hamstrings are fully stretched, then squeeze glutes to stand"]),
  E("Dumbbell Romanian deadlift", "dumbbell", "hinge", ["hamstrings", "glutes"], ["lower back"],
    ["Hips back, dumbbells close to your legs", "Back flat, neck neutral", "Stand by driving hips forward"]),
  E("Hip thrust", "barbell", "hip-thrust", ["glutes"], ["hamstrings", "quads"],
    ["Upper back on the bench edge, bar padded over your hip crease", "Chin tucked, ribs down: move from the hips, not the lower back", "Pause and squeeze at the top"]),
  E("Machine hip thrust", "machine", "hip-thrust", ["glutes"], ["hamstrings"],
    ["Feet so shins are vertical at the top", "Chin tucked, ribs down", "Pause one second at the top"]),
  E("Glute bridge", "bodyweight", "hip-thrust", ["glutes"], ["hamstrings"],
    ["Heels close to your bum", "Press through heels and squeeze glutes up", "Don't arch your lower back"]),
  E("Cable pull-through", "cable", "hinge", ["glutes", "hamstrings"], ["lower back"],
    ["Face away from a low cable, rope between your legs", "Hinge back until you feel the hamstrings", "Snap the hips forward and squeeze"]),
  E("45-degree back extension", "bodyweight", "back-ext", ["glutes", "lower back"], ["hamstrings"],
    ["Pad just below your hip bones", "Round slightly and squeeze glutes to come up (glute bias)", "Stop when your body is in a straight line"]),
  E("Seated leg curl", "machine", "ham-curl", ["hamstrings"], [],
    ["Knee joint lined up with the machine pivot", "Curl fully, control the way back", "Keep hips down on the seat"]),
  E("Lying leg curl", "machine", "ham-curl", ["hamstrings"], [],
    ["Hips pressed into the pad", "Curl to your bum, lower slowly", "Don't let your hips pop up"]),
  E("Cable hip abduction", "cable", "glute-med", ["glutes"], [],
    ["Ankle strap on the far leg, hold the frame", "Lift the leg out to the side, toes forward", "Slow on the way back"]),
  E("Hip abduction machine", "machine", "glute-med", ["glutes"], [],
    ["Sit tall or lean slightly forward for more glute", "Push out, pause, control back", "Don't bounce off the stack"]),
  E("Leg extension", "machine", "quad-ext", ["quads"], [],
    ["Knee lined up with the pivot", "Squeeze at the top for a second", "Lower under control"]),
  E("Kettlebell swing", "kettlebell", "hinge", ["glutes", "hamstrings"], ["lower back", "core"],
    ["It's a hinge, not a squat: hips back, shins vertical", "Snap the hips; arms just guide the bell", "Stand tall and squeeze at the top"]),

  // ---- chest ----
  E("Bench press", "barbell", "horizontal-push", ["chest", "triceps"], ["shoulders"],
    ["Shoulder blades pinched and down, slight arch, feet planted", "Lower to your lower chest, elbows about 45° from your body", "Press up and slightly back over your shoulders"]),
  E("Incline bench press", "barbell", "incline-push", ["chest", "shoulders"], ["triceps"],
    ["Bench at about 30°", "Lower to your upper chest", "Keep shoulder blades pinned"]),
  E("Dumbbell bench press", "dumbbell", "horizontal-push", ["chest", "triceps"], ["shoulders"],
    ["Shoulder blades back and down", "Lower until you feel a stretch across the chest", "Press up and slightly together"]),
  E("Incline dumbbell press", "dumbbell", "incline-push", ["chest", "shoulders"], ["triceps"],
    ["Bench at about 30°", "Elbows slightly tucked, deep stretch at the bottom", "Press up and in"]),
  E("Machine chest press", "machine", "horizontal-push", ["chest", "triceps"], ["shoulders"],
    ["Handles level with mid-chest", "Shoulder blades back against the pad", "Full stretch, controlled press"]),
  E("Cable fly", "cable", "chest-fly", ["chest"], ["shoulders"],
    ["Slight bend in the elbows, keep it fixed", "Open wide until you feel the chest stretch", "Hug a big tree: bring hands together in front"]),
  E("Pec deck", "machine", "chest-fly", ["chest"], ["shoulders"],
    ["Handles at chest height", "Elbows slightly bent", "Squeeze together, slow return to the stretch"]),
  E("Dumbbell fly", "dumbbell", "chest-fly", ["chest"], ["shoulders"],
    ["Slight elbow bend, fixed", "Lower wide until you feel a stretch", "Bring the dumbbells up in an arc"]),
  E("Push-up", "bodyweight", "horizontal-push", ["chest", "triceps"], ["shoulders", "core"],
    ["Body in one straight line", "Chest to the floor, elbows about 45°", "Push the floor away"]),
  E("Dip", "bodyweight", "horizontal-push", ["chest", "triceps"], ["shoulders"],
    ["Lean slightly forward for chest", "Lower until shoulders are just below elbows", "Stop if your shoulders complain"]),

  // ---- shoulders ----
  E("Overhead press", "barbell", "vertical-push", ["shoulders", "triceps"], ["core", "upper back"],
    ["Squeeze glutes, ribs down, no leaning back", "Bar travels close to your face, then head through", "Lock out with the bar over your mid-foot"]),
  E("Dumbbell shoulder press", "dumbbell", "vertical-push", ["shoulders", "triceps"], [],
    ["Seated or standing, ribs down", "Lower to about ear height", "Press up, don't clash the dumbbells"]),
  E("Lateral raise", "dumbbell", "lateral-raise", ["shoulders"], [],
    ["Lead with the elbows, slight bend", "Raise to shoulder height, no higher", "Slow down, no swinging"]),
  E("Cable lateral raise", "cable", "lateral-raise", ["shoulders"], [],
    ["Cable low, crossing in front of your body", "Raise out to the side to shoulder height", "Control the return"]),
  E("Face pull", "cable", "rear-delt", ["shoulders", "upper back"], [],
    ["Rope at face height, thumbs pointing back", "Pull towards your eyes, elbows high", "Finish with hands beside your ears"]),
  E("Rear delt fly", "dumbbell", "rear-delt", ["shoulders", "upper back"], [],
    ["Hinge forward, chest down", "Raise arms out wide, slight elbow bend", "Think 'pinkies up', no shrugging"]),

  // ---- back ----
  E("Barbell row", "barbell", "horizontal-pull", ["upper back", "lats"], ["biceps", "lower back"],
    ["Hinge to about 45°, back flat", "Pull the bar to your lower ribs", "Lower under control; no heaving"]),
  E("Seated cable row", "cable", "horizontal-pull", ["upper back", "lats"], ["biceps"],
    ["Sit tall, slight lean forward at the start", "Pull to your belly button, squeeze shoulder blades", "Let shoulders stretch forward on the way back"]),
  E("Chest-supported row", "machine", "horizontal-pull", ["upper back", "lats"], ["biceps"],
    ["Chest stays on the pad", "Drive elbows back, squeeze shoulder blades", "Full stretch at the bottom"]),
  E("One-arm dumbbell row", "dumbbell", "horizontal-pull", ["lats", "upper back"], ["biceps"],
    ["Hand and knee on the bench, back flat", "Pull the dumbbell to your hip", "Don't twist your torso"]),
  E("Lat pulldown", "cable", "vertical-pull", ["lats"], ["biceps", "upper back"],
    ["Grip just outside shoulder width", "Pull the bar to your upper chest, elbows down and back", "Full stretch at the top"]),
  E("Pull-up", "bodyweight", "vertical-pull", ["lats"], ["biceps", "upper back"],
    ["Start from a dead hang", "Pull chest towards the bar", "Lower all the way, under control"]),
  E("Chin-up", "bodyweight", "vertical-pull", ["lats", "biceps"], ["upper back"],
    ["Palms facing you, shoulder width", "Chest to the bar", "Full hang at the bottom"]),

  // ---- arms ----
  E("Dumbbell curl", "dumbbell", "biceps", ["biceps"], ["forearms"],
    ["Elbows pinned at your sides", "Turn palms up as you curl", "Lower slowly"]),
  E("Hammer curl", "dumbbell", "biceps", ["biceps", "forearms"], [],
    ["Thumbs up the whole time", "Elbows still", "No swinging"]),
  E("Cable curl", "cable", "biceps", ["biceps"], ["forearms"],
    ["Elbows by your sides", "Squeeze at the top", "Control back down"]),
  E("Triceps pushdown", "cable", "triceps", ["triceps"], [],
    ["Elbows pinned to your sides", "Push down until arms are straight", "Only the forearms move"]),
  E("Overhead triceps extension", "cable", "triceps", ["triceps"], [],
    ["Face away from the cable, rope behind your head", "Elbows point forward, don't flare", "Full stretch, then straighten"]),

  // ---- calves ----
  E("Seated calf raise", "machine", "calf-bent-knee", ["calves"], [],
    ["Knees at 90°, pads snug on your thighs", "Slow: about 3 seconds up, 3 seconds down", "Full range: deep stretch at the bottom, high on your toes at the top"]),
  E("Seated dumbbell calf raise", "dumbbell", "calf-bent-knee", ["calves"], [],
    ["Sit on a bench, balls of your feet on a plate, dumbbells (or a padded barbell) on your knees", "Slow: about 3 seconds up, 3 seconds down", "Full range from heels down to high on your toes"]),
  E("Standing calf raise", "machine", "calf-straight", ["calves"], [],
    ["Knees straight but not locked", "Slow up and down", "Full stretch at the bottom"]),

  // ---- core ----
  E("Pallof press", "cable", "core-anti", ["core"], [],
    ["Stand side-on to the cable, handle at your chest", "Press straight out and hold for 2 seconds", "Don't let the cable twist you"]),
  E("Dead bug", "bodyweight", "core-anti", ["core"], [],
    ["Lower back pressed into the floor the whole time", "Reach opposite arm and leg away slowly", "Breathe out as you reach"]),
  E("Cable crunch", "cable", "core-flex", ["core"], [],
    ["Kneel, rope beside your head", "Curl your ribs towards your hips", "Hips stay still"]),
  E("Hanging leg raise", "bodyweight", "core-flex", ["core"], [],
    ["Dead hang, no swinging", "Curl your pelvis up, not just your legs", "Lower slowly"]),
  E("Copenhagen plank", "bodyweight", "core-anti", ["adductors", "core"], [],
    ["Top leg on the bench, bottom leg free", "Hips up in a straight line", "Short holds, build up"]),

  // ---- kettlebell rotation and cross-body ----
  E("Kettlebell halo", "kettlebell", "rotation", ["shoulders", "core"], ["upper back", "triceps"],
    ["Hold the bell upside down by the horns, at chest height", "Circle it slowly around your head, close to the neck", "Ribs down and glutes tight so only the arms move. Change direction each round"]),
  E("Kettlebell figure 8", "kettlebell", "rotation", ["core", "glutes"], ["hamstrings", "forearms", "lower back"],
    ["Wide stance, hinge forward with a flat back", "Pass the bell between your legs from one hand to the other, around the outside of each leg", "Hips stay back and still. Let the trunk resist the pull"]),
  E("Kettlebell woodchop", "kettlebell", "rotation", ["core", "shoulders"], ["glutes", "upper back"],
    ["Both hands on the horns, bell starts high over one shoulder", "Chop diagonally across your body to the opposite hip, turning from the hips", "Let the back heel lift and pivot gently. Swap sides halfway"]),
  E("Half-kneeling kettlebell chop", "kettlebell", "rotation", ["core", "shoulders"], ["glutes"],
    ["One knee down, front foot flat: no foot pivot, so it is kind to the Achilles", "Chop the bell from high over one shoulder across to the opposite hip", "Squeeze the glute of the down knee and keep your hips square. Swap sides halfway"]),
  E("Kettlebell gorilla row", "kettlebell", "horizontal-pull", ["upper back", "lats"], ["core", "hamstrings", "biceps"],
    ["Two bells on the floor between wide feet, hinge to hold them", "Row one bell to your hip while pressing the other into the floor", "Alternate sides and don't let your hips twist"]),
  E("Kettlebell Russian twist", "kettlebell", "rotation", ["core"], ["shoulders"],
    ["Sit tall, leaning back a little, heels on the floor", "Hold the bell at your chest and turn it to one hip, then the other", "Turn from the ribs and keep the bell close. Lift the feet only once it is easy"]),

  // ---- other ----
  E("Mace 360", "mace", "mace", ["shoulders", "core"], ["upper back", "forearms"],
    ["Start light", "Keep the mace close behind your head", "Ribs down, move from the shoulders"]),
];

// Moves that pivot on the back foot, and what to do instead on a sore-Achilles day.
const PIVOT = { "ex-kettlebell-woodchop": "ex-half-kneeling-kettlebell-chop" };
for (const e of SEED_EXERCISES) if (PIVOT[e.id]) Object.assign(e, { pivot: true, planted: PIVOT[e.id] });
for (const e of SEED_EXERCISES) if (e.equipment === "kettlebell") e.increment = 2;

/** Workouts you pick yourself, outside the block. Interval format: work/rest on a clock. */
export const SEED_ROUTINES = [{
  id: "kb-rotation",
  name: "Kettlebell rotation",
  format: "interval",
  description: "A beginner HIIT circuit of rotation and across-the-body kettlebell moves for trunk stability and full-body conditioning. Move well first; speed comes later.",
  level: 1,
  items: [
    { exerciseId: "ex-kettlebell-halo", sides: false, bell: 8, note: "Change direction each round." },
    { exerciseId: "ex-kettlebell-figure-8", sides: false, bell: 12, note: "" },
    { exerciseId: "ex-kettlebell-swing", sides: false, bell: 16, note: "Hinge, don't squat. Bell floats to chest height." },
    { exerciseId: "ex-kettlebell-woodchop", sides: true, bell: 8, note: "Back heel pivots gently." },
    { exerciseId: "ex-kettlebell-gorilla-row", sides: false, bell: 12, note: "Two bells, alternate rows." },
    { exerciseId: "ex-kettlebell-russian-twist", sides: false, bell: 8, note: "" },
  ],
  createdBy: "claude",
  updatedAt: SEED_VERSION,
}];

export const DEFAULT_PROFILE = `Goal: build a solid base that lasts long into life. Train every muscle group, with extra focus on weaker areas: glutes and chest.
Schedule: 3 sessions a week, about 45 minutes each, at a commercial gym with all equipment.
Experience: comfortable with the big barbell lifts.
Running: easy running only.
Achilles: injury from the half marathon in October 2026, managed by a physio. Her plan: bent-knee (seated) calf raises 3 times a week, progressing load towards bodyweight. No jumping or plyometrics.
Preferences: same exercises within a block. The coach should adjust things automatically and explain why.`;

export const DEFAULT_SETTINGS = {
  id: "main",
  barKg: 20,
  plates: [25, 20, 15, 10, 5, 2.5, 1.25],
  bodyweightKg: null,
  profile: DEFAULT_PROFILE,
  track: { feelAlways: false, effortPerSet: false, sessionNotes: false },
  updatedAt: SEED_VERSION,
};
