// Starter exercise library. Fixed IDs and updatedAt = 1 so every device seeds the
// same records and any edit you make wins over the seed.

export const MUSCLES = [
  "chest", "shoulders", "triceps", "biceps", "forearms", "upper back", "lats",
  "lower back", "core", "glutes", "quads", "hamstrings", "adductors", "calves",
];

export const EQUIPMENT = ["barbell", "dumbbell", "bodyweight", "kettlebell", "mace", "machine", "cable", "other"];

export const DEFAULT_INCREMENT = { barbell: 2.5, dumbbell: 2, kettlebell: 4, mace: 2, machine: 5, cable: 2.5, bodyweight: 0, other: 2.5 };

const E = (name, equipment, muscles) => ({
  id: "ex-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-$/, ""),
  name, equipment, muscles,
  increment: DEFAULT_INCREMENT[equipment],
  notes: "",
  updatedAt: 1,
});

export const SEED_EXERCISES = [
  E("Back squat", "barbell", ["quads", "glutes", "adductors"]),
  E("Front squat", "barbell", ["quads", "glutes", "core"]),
  E("Deadlift", "barbell", ["hamstrings", "glutes", "lower back", "upper back"]),
  E("Romanian deadlift", "barbell", ["hamstrings", "glutes", "lower back"]),
  E("Bench press", "barbell", ["chest", "triceps", "shoulders"]),
  E("Incline bench press", "barbell", ["chest", "shoulders", "triceps"]),
  E("Overhead press", "barbell", ["shoulders", "triceps", "core"]),
  E("Barbell row", "barbell", ["upper back", "lats", "biceps"]),
  E("Hip thrust", "barbell", ["glutes", "hamstrings"]),
  E("Good morning", "barbell", ["hamstrings", "lower back", "glutes"]),

  E("Dumbbell bench press", "dumbbell", ["chest", "triceps", "shoulders"]),
  E("Incline dumbbell press", "dumbbell", ["chest", "shoulders", "triceps"]),
  E("Dumbbell shoulder press", "dumbbell", ["shoulders", "triceps"]),
  E("One-arm dumbbell row", "dumbbell", ["lats", "upper back", "biceps"]),
  E("Goblet squat", "dumbbell", ["quads", "glutes", "core"]),
  E("Bulgarian split squat", "dumbbell", ["quads", "glutes", "adductors"]),
  E("Dumbbell Romanian deadlift", "dumbbell", ["hamstrings", "glutes"]),
  E("Single-leg Romanian deadlift", "dumbbell", ["hamstrings", "glutes", "core"]),
  E("Walking lunge", "dumbbell", ["quads", "glutes"]),
  E("Lateral raise", "dumbbell", ["shoulders"]),
  E("Rear delt fly", "dumbbell", ["shoulders", "upper back"]),
  E("Dumbbell curl", "dumbbell", ["biceps", "forearms"]),
  E("Hammer curl", "dumbbell", ["biceps", "forearms"]),
  E("Overhead triceps extension", "dumbbell", ["triceps"]),
  E("Dumbbell fly", "dumbbell", ["chest"]),
  E("Standing calf raise", "dumbbell", ["calves"]),

  E("Pull-up", "bodyweight", ["lats", "upper back", "biceps"]),
  E("Chin-up", "bodyweight", ["lats", "biceps"]),
  E("Push-up", "bodyweight", ["chest", "triceps", "shoulders"]),
  E("Dip", "bodyweight", ["chest", "triceps"]),
  E("Hanging leg raise", "bodyweight", ["core"]),
  E("Glute bridge", "bodyweight", ["glutes", "hamstrings"]),
  E("Dead bug", "bodyweight", ["core"]),
  E("Copenhagen plank", "bodyweight", ["adductors", "core"]),

  E("Kettlebell swing", "kettlebell", ["glutes", "hamstrings", "lower back"]),
  E("Mace 360", "mace", ["shoulders", "core", "upper back"]),
  E("Mace 10-to-2", "mace", ["shoulders", "core", "forearms"]),
];

export const DEFAULT_SETTINGS = {
  id: "main",
  barKg: 20,
  plates: [25, 20, 15, 10, 5, 2.5, 1.25],
  updatedAt: 1,
};
