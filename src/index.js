/**
 * Praxuni - Cloudflare Worker Entry Point
 */

// ---------------------------------------------------------------------------
// /dev/* password gate
// ---------------------------------------------------------------------------
// Set the environment variable DEV_SECRET in your Cloudflare dashboard to a
// strong random string. Anyone who navigates to /dev/ must enter that secret
// before the diagnostics page is served. A session cookie keeps them logged
// in for 8 hours per browser session.
// ---------------------------------------------------------------------------

const DEV_COOKIE_NAME = "prx_dev_auth";
const DEV_COOKIE_MAX_AGE = 60 * 60 * 8; // 8 hours

function getDevSecret(env) {
  // Falls back to a local-dev placeholder when the env var is not set.
  return env.DEV_SECRET || "praxuni-dev-2026";
}

function hasDevAccess(request, env) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(new RegExp(`${DEV_COOKIE_NAME}=([^;]+)`));
  return match ? match[1] === getDevSecret(env) : false;
}

function devLoginPage(errorMsg = "") {
  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>Developer Access — Praxuni</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,-apple-system,sans-serif;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:1.5rem}
  .card{background:#1e293b;border:1px solid #334155;border-radius:16px;padding:2.5rem 2rem;max-width:380px;width:100%;text-align:center}
  .logo{font-size:2.2rem;margin-bottom:0.75rem}
  h1{font-size:1.35rem;font-weight:800;color:#fff;margin-bottom:0.35rem}
  p{font-size:0.88rem;color:#94a3b8;margin-bottom:1.75rem;line-height:1.5}
  label{display:block;text-align:left;font-size:0.78rem;font-weight:600;color:#94a3b8;margin-bottom:0.4rem}
  input[type=password]{width:100%;padding:0.7rem 1rem;background:#0f172a;border:1px solid #334155;border-radius:10px;color:#fff;font-size:0.95rem;outline:none;transition:border-color .2s;margin-bottom:1rem}
  input[type=password]:focus{border-color:#38bdf8}
  button{width:100%;padding:0.72rem;background:#38bdf8;color:#0f172a;font-weight:700;font-size:0.95rem;border:none;border-radius:10px;cursor:pointer;transition:background .2s}
  button:hover{background:#7dd3fc}
  .error{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);color:#f87171;font-size:0.82rem;padding:0.55rem 0.85rem;border-radius:8px;margin-bottom:1rem}
</style>
</head>
<body>
<div class="card">
  <div class="logo">⚡</div>
  <h1>Developer Access</h1>
  <p>This area is restricted to Praxuni developers. Enter the access key to continue.</p>
  ${errorMsg ? `<div class="error">${errorMsg}</div>` : ""}
  <form method="POST" action="/dev/">
    <label for="pwd">Access Key</label>
    <input type="password" id="pwd" name="pwd" placeholder="Enter access key…" autofocus autocomplete="current-password">
    <button type="submit">Unlock →</button>
  </form>
</div>
</body>
</html>`,
    {
      status: 200,
      headers: {
        "Content-Type": "text/html;charset=UTF-8",
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    }
  );
}

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

    // Silence Chrome DevTools .well-known appspecific probes
    if (url.pathname.startsWith("/.well-known/")) {
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      });
    }

    // Redirect root / to /home/
    if (url.pathname === "/" || url.pathname === "") {
      return Response.redirect(new URL("/home/", request.url), 302);
    }

    // ---------------------------------------------------------------------------
    // /dev/* password gate — intercept before static asset serving
    // ---------------------------------------------------------------------------
    if (url.pathname === "/dev" || url.pathname.startsWith("/dev/")) {
      const secret = getDevSecret(env);

      // POST: process password form submission
      if (request.method === "POST") {
        const formData = await request.formData();
        const pwd = formData.get("pwd") || "";
        if (pwd === secret) {
          // Correct — set auth cookie and redirect to the actual dev page
          return new Response(null, {
            status: 302,
            headers: {
              Location: "/dev/",
              "Set-Cookie": `${DEV_COOKIE_NAME}=${secret}; Path=/dev; Max-Age=${DEV_COOKIE_MAX_AGE}; SameSite=Strict; HttpOnly`,
              "Cache-Control": "no-store",
            },
          });
        }
        // Wrong password — show form again with error
        return devLoginPage("Incorrect access key. Please try again.");
      }

      // GET: check session cookie
      if (!hasDevAccess(request, env)) {
        return devLoginPage();
      }
    }

    // Serve static assets
    return env.ASSETS.fetch(request);
  },
};
