// Worker entry point. Static files come from ./public; this handles /api/*.
// Run `npm run types` to regenerate worker-configuration.d.ts after changing bindings.

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/whoami") {
      // Cloudflare Access adds this header after you sign in.
      // Missing = the request didn't come through Access (e.g. `wrangler dev`).
      const email = request.headers.get("cf-access-authenticated-user-email");
      return Response.json({
        app: "__APP__",
        email,
        colo: request.cf?.colo ?? null,
        time: new Date().toISOString(),
      });
    }

    if (url.pathname.startsWith("/api/")) {
      return Response.json({ error: "not found" }, { status: 404 });
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
