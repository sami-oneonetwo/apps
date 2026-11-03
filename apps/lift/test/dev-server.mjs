// Local stand-in for the Worker: serves public/ and runs the real sync logic
// over node:sqlite. Used by the browser tests; `npm run dev` (wrangler) is the
// real local runtime.
//   node --experimental-strip-types test/dev-server.mjs [port] [dbfile]
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { memorySql } from "./sqlite-adapter.mjs";
import { init, sync, parseSyncBody } from "../src/sync.ts";

const root = fileURLToPath(new URL("../public/", import.meta.url));
const port = +(process.argv[2] || 8788);
const sql = memorySql(process.argv[3] || ":memory:");
init(sql);
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json", ".json": "application/json" };

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const send = (status, body, type = "application/json") => { res.writeHead(status, { "content-type": type, "cache-control": "no-store" }); res.end(body); };
  if (url.pathname === "/api/me") return send(200, JSON.stringify({ email: "local@dev" }));
  if (url.pathname === "/api/sync" && req.method === "POST") {
    let raw = ""; for await (const c of req) raw += c;
    let body; try { body = JSON.parse(raw); } catch { return send(400, '{"error":"Body must be JSON"}'); }
    const input = parseSyncBody(body);
    if (typeof input === "string") return send(400, JSON.stringify({ error: input }));
    return send(200, JSON.stringify(sync(sql, input.cursor, input.changes)));
  }
  if (url.pathname.startsWith("/api/")) return send(404, '{"error":"Not found"}');
  let p = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  if (p.endsWith("/")) p += "index.html";
  try {
    const buf = await readFile(join(root, p));
    send(200, buf, TYPES[extname(p)] || "application/octet-stream");
  } catch {
    send(200, await readFile(join(root, "index.html")), "text/html");
  }
}).listen(port, () => console.log(`lift dev server on http://127.0.0.1:${port}`));
