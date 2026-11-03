# fatherbean apps

Small web apps on Cloudflare Workers, one folder per app, deployed by GitHub Actions.

| Branch       | URL                                          | Command                          |
|--------------|----------------------------------------------|----------------------------------|
| `main`       | `https://<app>.apps.fatherbean.com`          | `wrangler deploy`                |
| anything else| `https://<app>-preview.apps.fatherbean.com`  | `wrangler deploy --env preview`  |

Everything under `*.apps.fatherbean.com` sits behind Cloudflare Access. `workers.dev` and
version URLs are disabled on every app, because they'd be public, so the custom domain is
the only way in.

```
apps/<name>/            one Worker per app (static assets in public/, API in src/)
templates/worker/       what new apps are copied from
scripts/new-app.sh      npm run new-app -- <name>
scripts/changed-apps.sh decides which apps a push deploys
.github/workflows/deploy.yml
```

## One-time setup

Do steps 1–3 **before the first push**, so nothing is ever reachable without Access.

### 1. Zero Trust team + login method
1. Cloudflare dashboard → **Zero Trust**. Pick a team name (becomes `<team>.cloudflareaccess.com`) and the Free plan.
2. **Settings → Authentication → Login methods**: One-time PIN is on by default and is enough.
   Optionally add GitHub or Google for one-click sign-in.

### 2. Access application covering every app
**Access → Applications → Add → Self-hosted**
- Name: `apps (wildcard)`
- Public hostname: subdomain `*`, domain `apps.fatherbean.com`
- Session duration: 1 month (your call)
- Policy: **Allow**, Include → Emails → `dump@fatherbean.com`

### 3. API token + GitHub secrets
**My Profile → API Tokens → Create Token → "Edit Cloudflare Workers" template**
- Account resources: your account
- Zone resources: `fatherbean.com` only
- Add permission: **Zone → DNS → Edit** (custom domains create DNS records)
- Add **Account → D1 → Edit** too if you'll want databases

In the GitHub repo → **Settings → Secrets and variables → Actions**, add:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID` (Workers & Pages overview, right-hand side)

### 4. Push
The first push deploys `apps/hello`. Open `https://hello.apps.fatherbean.com`: you should get
the Access login, then a page showing your email from `/api/whoami`.

## Day to day

```bash
npm install
npm run new-app -- myapp
cd apps/myapp && npm run dev        # local, http://localhost:8787 (no Access locally)
```

Push a branch → `myapp-preview.apps.fatherbean.com`. Merge to main → `myapp.apps.fatherbean.com`.
There's one preview slot per app, and the last branch pushed wins. The Actions run summary
lists the URLs that were deployed.

Manual redeploy: **Actions → deploy → Run workflow** (pick an app or `all`, production or preview).

## Access recipes

**Make one app public.** Add another self-hosted Access application for exactly
`myapp.apps.fatherbean.com` with a **Bypass → Everyone** policy. The more specific hostname wins
over the wildcard.

**Public webhook path on a private app.** Same, but scope the hostname to a path:
`myapp.apps.fatherbean.com/webhooks`.

**Scripts / cron / other services calling an app.** Access → Service credentials → create a
service token, then add a **Service Auth** policy for it on the app. Callers send
`CF-Access-Client-Id` and `CF-Access-Client-Secret` headers.

**Who is calling?** Inside the Worker, `request.headers.get("cf-access-authenticated-user-email")`.
For defence in depth, verify the `Cf-Access-Jwt-Assertion` JWT against
`https://<team>.cloudflareaccess.com/cdn-cgi/access/certs` with the application's AUD tag.

## Secrets and bindings

- App secrets: `npx wrangler secret put NAME` (and `--env preview`) from inside the app folder,
  or set them in the dashboard. Local values go in `apps/<name>/.dev.vars` (gitignored).
- Bindings (KV, D1, R2, vars) are **not inherited** by `env.preview`, so declare them under
  both the top level and `env.preview` in `wrangler.jsonc`, ideally pointing preview at its own
  database/bucket.
- After changing bindings, run `npm run types` in the app to regenerate `worker-configuration.d.ts`.

## Removing an app

Delete the folder and merge. The workflow doesn't delete Workers, so then run
`npx wrangler delete --name <app>` and `npx wrangler delete --name <app>-preview`
(the custom domains and DNS records go with them).
