// Who is calling? Cloudflare Access puts a signed JWT on every request it lets
// through (Cf-Access-Jwt-Assertion header, and the CF_Authorization cookie).
// We verify it against the team's public keys, found via the token's issuer.

interface Jwk { kid: string; kty: string; n: string; e: string; alg?: string }
const certCache = new Map<string, { at: number; keys: Jwk[] }>();
const CERT_TTL = 60 * 60 * 1000;

const b64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const json = (s: string) => JSON.parse(new TextDecoder().decode(b64url(s)));

export function cookie(header: string | null, name: string): string | null {
  for (const part of (header || "").split(/;\s*/)) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i) === name) return part.slice(i + 1);
  }
  return null;
}

async function keysFor(issuer: string, fetcher: typeof fetch): Promise<Jwk[]> {
  const hit = certCache.get(issuer);
  if (hit && Date.now() - hit.at < CERT_TTL) return hit.keys;
  const res = await fetcher(`${issuer}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error(`certs ${res.status}`);
  const { keys } = (await res.json()) as { keys: Jwk[] };
  certCache.set(issuer, { at: Date.now(), keys });
  return keys;
}

/** Returns the verified email, or null with a reason. */
export async function verifyAccessJwt(token: string, fetcher: typeof fetch = fetch, now = Date.now()): Promise<{ email: string | null; reason?: string }> {
  try {
    const [h, p, sig] = token.split(".");
    if (!h || !p || !sig) return { email: null, reason: "malformed token" };
    const header = json(h), payload = json(p);
    const iss = String(payload.iss || "");
    if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(iss)) return { email: null, reason: "issuer is not Cloudflare Access" };
    if (header.alg !== "RS256") return { email: null, reason: "unexpected algorithm" };
    if (typeof payload.exp === "number" && payload.exp * 1000 < now) return { email: null, reason: "token expired" };
    // Keys rotate: if the cached set doesn't verify, refetch once.
    let ok = false, known = false;
    for (const fresh of [false, true]) {
      if (fresh) certCache.delete(iss);
      const jwk = (await keysFor(iss, fetcher)).find((k) => k.kid === header.kid);
      if (!jwk) continue;
      known = true;
      const key = await crypto.subtle.importKey("jwk", { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true }, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
      ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64url(sig), new TextEncoder().encode(`${h}.${p}`));
      if (ok) break;
    }
    if (!known) return { email: null, reason: "unknown signing key" };
    if (!ok) return { email: null, reason: "bad signature" };
    // Some identity providers (e.g. Auth0 set up without the email scope) don't pass an email
    // through. Access's subject id is stable per user, so fall back to that.
    const email = payload.email || payload.identity?.email;
    if (email) return { email: String(email).toLowerCase() };
    if (payload.sub) return { email: `access:${payload.sub}` };
    return { email: null, reason: "token has no email or user id" };
  } catch (e) {
    return { email: null, reason: e instanceof Error ? e.message : "verification failed" };
  }
}

/** Identify the user: Access email header, else the verified Access JWT; locally, a dev user. */
export async function identify(request: Request, url: URL, fetcher: typeof fetch = fetch): Promise<{ email: string | null; reason?: string }> {
  const header = request.headers.get("cf-access-authenticated-user-email");
  if (header) return { email: header.toLowerCase() };
  const token = request.headers.get("cf-access-jwt-assertion") || cookie(request.headers.get("cookie"), "CF_Authorization");
  if (token) return verifyAccessJwt(token, fetcher);
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return { email: "local@dev" };
  return { email: null, reason: "no Access identity on the request" };
}
