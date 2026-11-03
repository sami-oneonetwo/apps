import { test } from "node:test";
import assert from "node:assert/strict";
import { identify, verifyAccessJwt, cookie } from "../src/access.ts";

const ISS = "https://fatherbean.cloudflareaccess.com";
const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");

async function setup() {
  const { publicKey, privateKey } = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const jwk = { ...(await crypto.subtle.exportKey("jwk", publicKey)), kid: "k1" };
  const sign = async (payload, kid = "k1") => {
    const h = enc({ alg: "RS256", kid }), p = enc(payload);
    const sig = Buffer.from(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, new TextEncoder().encode(`${h}.${p}`))).toString("base64url");
    return `${h}.${p}.${sig}`;
  };
  let calls = 0;
  const fetcher = async (u) => { calls++; assert.equal(u, `${ISS}/cdn-cgi/access/certs`); return new Response(JSON.stringify({ keys: [jwk] })); };
  return { sign, fetcher, calls: () => calls };
}
const future = () => Math.floor(Date.now() / 1000) + 3600;

test("valid Access JWT gives the email", async () => {
  const { sign, fetcher } = await setup();
  const t = await sign({ iss: ISS, email: "Dump@Fatherbean.com", exp: future() });
  assert.deepEqual(await verifyAccessJwt(t, fetcher), { email: "dump@fatherbean.com" });
});

test("rejects tampered, expired, foreign-issuer and unknown-key tokens", async () => {
  const { sign, fetcher } = await setup();
  const good = await sign({ iss: ISS, email: "a@b.c", exp: future() });
  const [h, , s] = good.split(".");
  assert.equal((await verifyAccessJwt(`${h}.${enc({ iss: ISS, email: "evil@x.y", exp: future() })}.${s}`, fetcher)).email, null);
  assert.equal((await verifyAccessJwt(await sign({ iss: ISS, email: "a@b.c", exp: 1 }), fetcher)).reason, "token expired");
  assert.equal((await verifyAccessJwt(await sign({ iss: "https://evil.example.com", email: "a@b.c", exp: future() }), fetcher)).email, null);
  assert.equal((await verifyAccessJwt(await sign({ iss: ISS, email: "a@b.c", exp: future() }, "nope"), fetcher)).reason, "unknown signing key");
});

test("identify: header, then JWT header, then cookie, then local dev", async () => {
  const { sign, fetcher } = await setup();
  const t = await sign({ iss: ISS, email: "me@x.com", exp: future() });
  const u = new URL("https://lift-preview.apps.fatherbean.com/api/sync");
  assert.equal((await identify(new Request(u, { headers: { "cf-access-authenticated-user-email": "H@x.com" } }), u, fetcher)).email, "h@x.com");
  assert.equal((await identify(new Request(u, { headers: { "cf-access-jwt-assertion": t } }), u, fetcher)).email, "me@x.com");
  assert.equal((await identify(new Request(u, { headers: { cookie: `a=1; CF_Authorization=${t}` } }), u, fetcher)).email, "me@x.com");
  assert.equal((await identify(new Request(u), u, fetcher)).email, null);
  const l = new URL("http://localhost:8787/api/sync");
  assert.equal((await identify(new Request(l), l, fetcher)).email, "local@dev");
  assert.equal(cookie("x=1; CF_Authorization=abc", "CF_Authorization"), "abc");
});

test("no email from the identity provider: falls back to the Access user id", async () => {
  const { sign, fetcher } = await setup();
  const t = await sign({ iss: ISS, sub: "7335d417-61da-459d-899c-0a01c76a2f94", exp: future() });
  assert.deepEqual(await verifyAccessJwt(t, fetcher), { email: "access:7335d417-61da-459d-899c-0a01c76a2f94" });
});
