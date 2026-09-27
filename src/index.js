/**
 * Praxuni - Cloudflare Worker Entry Point
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // API health check
    if (url.pathname === "/api/health") {
      if (request.method !== "GET") {
        return new Response(
          JSON.stringify({ error: "Method Not Allowed" }),
          {
            status: 405,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
              "Allow": "GET",
            },
          }
        );
      }

      return new Response(
        JSON.stringify({
          status: "ok",
          service: "praxuni",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
        }
      );
    }

    // Unknown API endpoint
    if (url.pathname.startsWith("/api/")) {
      return new Response(
        JSON.stringify({ error: "API endpoint not found" }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
        }
      );
    }

    // Serve static assets
    return env.ASSETS.fetch(request);
  },
};
