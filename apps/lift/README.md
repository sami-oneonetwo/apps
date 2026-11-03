# Lift

Routines, guided sessions and progression for lifting. Phone-first, works offline.

- **Prod:** https://lift.apps.fatherbean.com
- **Preview:** https://lift-preview.apps.fatherbean.com (separate data)

## How it works

- **Frontend:** plain ES modules in `public/`, no build step. A service worker caches the app
  so it opens with no signal; `public/js/store.js` keeps everything in localStorage and
  queues changes.
- **Sync:** `POST /api/sync` sends queued changes and pulls everything after a cursor.
  Records are last-write-wins per record (`src/sync.ts`).
- **Storage:** one SQLite-backed Durable Object per signed-in user (keyed by the
  Cloudflare Access email), so there's no database to provision.
- **Progression:** double progression in `public/js/progression.js`. Every set hits the top
  of the rep range → add the exercise's weight step and drop to the bottom of the range.
  Below the bottom of the range two sessions running at the same weight → drop ~10%.
  Otherwise hold the weight and add a rep.

## Develop

```bash
npm test                      # sync + progression unit tests (also run in CI before deploy)
npm run dev                   # wrangler dev, the real runtime: http://localhost:8787
npm run serve:test -- 8788    # Node stand-in server, no wrangler needed
```

Locally there's no Access, so the API treats you as `local@dev`.
