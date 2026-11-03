# Lift

A coached strength program for one person. Phone-first, works offline.

- **Prod:** https://lift.apps.fatherbean.com
- **Preview:** https://lift-preview.apps.fatherbean.com (separate data)

## What it does

- **Today** shows the next session of the current block. You never build routines.
- **Blocks** (`public/js/program.js`): 6 weeks made up of a calibration week, 4 build weeks and a deload week. Exercises stay the same within a block. Block 1 was written by Claude from the interview; later blocks come from the in-app coach.
- **Scheduler:** A/B/C each week. If you miss a session that carried a priority muscle (chest, glutes) that came up short, it goes first the next week; otherwise the week moves on. The coach can override the order.
- **Progression** (`public/js/progression.js`):
  - Double progression: when every set reaches the top of the rep range, the weight goes up a step.
  - Easy / About right / Hard taps: "easy" jumps two steps, "hard" holds the weight.
  - Deload week drops a set and about 10% of the load.
- **Achilles:** each session starts with a 0–10 check. Calf rehab load holds at 4+ or when the score is rising, and drops about 15% at 6+. The bent-knee calf raise can't be removed or swapped for another movement, by you or the coach.
- **Coach** (`src/coach.ts`): after every session, and when you ask, the Worker sends your profile, block, recent sessions and weekly volume to Claude.
  - Claude returns structured changes. The app checks them against the rules above, applies them, and logs each one with its reason. Every change can be undone.
- **During a session:** form cues, a muscle map, one-tap swaps within the same movement pattern, a rest timer, plate loading for barbell lifts, and the screen stays on.
- **Progress:** sets per muscle against weekly targets, consistency, main-lift trends and personal bests.

## Switch the coach on

The coach needs an Anthropic API key as a Worker secret. Set it once for each Worker:

```bash
cd apps/lift
npx wrangler secret put ANTHROPIC_API_KEY --env preview   # lift-preview
npx wrangler secret put ANTHROPIC_API_KEY --env=""        # lift (prod)
```

Or in the dashboard: **Workers & Pages → lift-preview → Settings → Variables and Secrets → Add → Secret**, named `ANTHROPIC_API_KEY`.

The default model is `claude-opus-5-5`. To use a different one, set a `COACH_MODEL` variable.

## How data moves

- **On the phone:** everything is kept in localStorage first (`public/js/store.js`), and a service worker caches the app so it opens with no signal.
- **Sync:** `POST /api/sync` sends queued changes and pulls everything after a cursor. Each record is last-write-wins (`src/sync.ts`).
- **On the server:** one SQLite-backed Durable Object per Access email. The coach reads from it and writes its changes back through the same sync path.

## Develop

```bash
npm test                                   # unit tests (run in CI before every deploy)
npm run dev                                # wrangler dev: real runtime, http://localhost:8787
npm run serve:test -- 8788                 # Node stand-in, scripted coach (no key needed)
COACH=off npm run serve:test -- 8788       # stand-in with the coach switched off
```

Locally there's no Access, so the API treats you as `local@dev`.
