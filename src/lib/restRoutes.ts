// Shared plain-REST router for Ailhat's server-side API. This is the single
// source of truth for the /api/* routes (name-availability, site scan, intent
// capture, and owner auth + portfolio persistence). It is imported by BOTH the
// local Bun preview server (serve.ts) and the Vercel deployment entry
// (vercel-entry.ts) so the live site's backend behaves identically to the local
// preview (which previously had these routes only in serve.ts — meaning the
// Vercel deploy returned 404 for /api/auth/*).
//
// All routes return a Response directly (no TanStack RPC machinery — bypasses
// the framework's seroval framing). Returns null when the pathname is not an
// API route, so the caller falls through to static/SSR handling.
import {
  type AuthUser,
  SESSION_COOKIE,
  countUsers,
  createSession,
  createUser,
  deleteSessionByToken,
  findUserByEmail,
  findUserByToken,
  getPasswordHash,
  parseCookies,
  validateAuthInput,
  verifyPassword,
  hashPassword,
} from "./auth.ts";
import {
  getPortfolioState,
  putPortfolioState,
} from "./db-portfolio.ts";
import {
  saveIntentSignup,
  validateIntentInput,
} from "./db-intent.ts";
import { checkAvailability } from "./availability.ts";
import { runScan } from "./scanSite.ts";
import {
  readObservations,
  upsertObservation,
} from "./observations.server.ts";
import {
  sanitizeObservation,
  mapUrlToWorkspaceId,
  scanEvidenceObservation,
} from "./observations.ts";
import type { AvailabilityObservation } from "./observations.ts";
import { isOwnerEmail } from "./access.ts";

function jsonResponse(
  body: unknown,
  status = 200,
  setCookie?: string,
): Response {
  const headers: Record<string, string> = {
    "content-type": "application/json; charset=utf-8",
  };
  if (setCookie) headers["set-cookie"] = setCookie;
  return new Response(JSON.stringify(body), { status, headers });
}

function sessionCookie(token: string, secure: boolean): string {
  const maxAge = 30 * 24 * 60 * 60; // seconds, matches SESSION_TTL_MS
  return (
    `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}` +
    (secure ? "; Secure" : "")
  );
}

function clearSessionCookie(secure: boolean): string {
  return (
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0` +
    (secure ? "; Secure" : "")
  );
}

/**
 * Handle an /api/* request. `req` is a standard web Request and `secure`
 * controls whether Set-Cookie values are marked Secure (true over https, false
 * over plain-http localhost). Returns a Response for matching routes, or null
 * if the pathname is not an API route.
 */
export async function handleRestRoute(
  req: Request,
  secure: boolean,
): Promise<Response | null> {
  const { pathname, searchParams } = new URL(req.url);

  // GET /api/check-availability?name=x — name-availability check.
  if (pathname === "/api/check-availability") {
    const name = searchParams.get("name") ?? "";
    try {
      const result = await checkAvailability(name);
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    } catch {
      return new Response(
        JSON.stringify({ name, results: [], checkedAt: Date.now() }),
        {
          status: 500,
          headers: { "content-type": "application/json; charset=utf-8" },
        },
      );
    }
  }

  // GET /api/scan-site?url=<product url> — run the full site scan server-side.
  if (pathname === "/api/scan-site") {
    const url = searchParams.get("url") ?? "";
    try {
      const result = await runScan(url);
      // R1: when a completed scan has live evidence for a known workspace, persist
      // it (as a site-scan observation) so the next Control read recomputes that
      // workspace's readiness/confidence/lastScan from it. Persistence is gated
      // on the OWNER session (anonymous scans never pollute the feed) AND on the
      // URL mapping to a known portfolio workspace (arbitrary URLs are dropped).
      try {
        const token =
          parseCookies(req.headers.get("cookie"))[SESSION_COOKIE] ?? "";
        const owner = token ? await findUserByToken(token) : null;
        if (owner && isOwnerEmail(owner.email) && mapUrlToWorkspaceId(result.url)) {
          await upsertObservation(scanEvidenceObservation(result));
        }
      } catch (err) {
        // Persistence is best-effort — a storage failure must never fail the scan.
        console.error("[scan-site] failed to persist scan evidence:", err);
      }
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    } catch {
      return new Response(
        JSON.stringify({
          url,
          requestedUrl: url,
          ok: false,
          scannedAt: Date.now(),
          findings: [],
        }),
        {
          status: 500,
          headers: { "content-type": "application/json; charset=utf-8" },
        },
      );
    }
  }

  // ---- Agent Direct live-sync ingest (availability observations) ----
  // POST /api/availability and POST /api/sync (extension path) store the
  // extension's payload; GET (with optional ?since=<ms>) reads it back.
  // Defensive: bad rows are dropped, malformed bodies never crash, writes never
  // throw to the caller.
  const isAvailPath = pathname === "/api/availability";
  const isSyncPath = pathname === "/api/sync";
  if (isAvailPath || isSyncPath) {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, POST, OPTIONS",
          "access-control-allow-headers": "content-type",
        },
      });
    }
    const observationToken =
      parseCookies(req.headers.get("cookie"))[SESSION_COOKIE] ?? "";
    const observationUser = observationToken
      ? await findUserByToken(observationToken)
      : null;
    if (!observationUser) {
      return jsonResponse({ ok: false, error: "Not authenticated." }, 401);
    }
    if (!isOwnerEmail(observationUser.email)) {
      return jsonResponse(
        { ok: false, error: "This observation feed is not enabled for this account yet." },
        403,
      );
    }
    if (req.method === "POST") {
      let parsed: unknown = null;
      try {
        parsed = req.body ? JSON.parse(await req.text()) : null;
      } catch {
        return jsonResponse({ ok: false, error: "invalid JSON body" }, 400);
      }
      const rows = Array.isArray(parsed) ? parsed : [parsed];
      let stored = 0;
      let last: AvailabilityObservation | null = null;
      for (const row of rows) {
        const clean = sanitizeObservation(row);
        if (!clean) continue; // drop bad rows, never crash
        await upsertObservation(clean);
        stored += 1;
        last = clean;
      }
      if (stored === 0) {
        return jsonResponse(
          {
            ok: false,
            error:
              "no usable observation (need provider, url, observedAt as strings/numbers)",
          },
          400,
        );
      }
      return jsonResponse({ ok: true, stored, last, receivedAt: Date.now() });
    }
    if (req.method === "GET") {
      const sinceRaw = searchParams.get("since");
      let since = 0;
      if (sinceRaw) {
        const n = Number(sinceRaw);
        if (Number.isFinite(n)) since = n;
      }
      const rows = await readObservations(since > 0 ? { sinceMs: since } : {});
      return jsonResponse(rows);
    }
    return jsonResponse(
      { ok: false, error: `method ${req.method} not supported` },
      405,
    );
  }

  // POST /api/intent — waitlist / builder intent capture (Neon-backed).
  if (pathname === "/api/intent" && req.method === "POST") {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid JSON body." }),
        {
          status: 400,
          headers: { "content-type": "application/json; charset=utf-8" },
        },
      );
    }
    const parsed = validateIntentInput(body);
    if (!parsed.ok) {
      return new Response(JSON.stringify({ ok: false, error: parsed.error }), {
        status: parsed.status,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }
    try {
      const { id } = await saveIntentSignup(parsed.value);
      return new Response(
        JSON.stringify({ ok: true, id, receivedAt: Date.now() }),
        {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        },
      );
    } catch (err) {
      console.error("intent capture failed:", err);
      return new Response(
        JSON.stringify({
          ok: false,
          error:
            "We couldn't save your response right now. Please try again in a moment.",
        }),
        {
          status: 503,
          headers: { "content-type": "application/json; charset=utf-8" },
        },
      );
    }
  }

  // ---- Owner auth + server-side persistence ----
  const cookies = parseCookies(req.headers.get("cookie"));
  const token = cookies[SESSION_COOKIE] ?? "";

  // GET /api/auth/status — public; authed state + signup-open flag.
  if (pathname === "/api/auth/status") {
    try {
      const authed = token ? await findUserByToken(token) : null;
      const signupOpen = (await countUsers()) === 0;
      return jsonResponse({
        authed: !!authed,
        user: authed ? { id: authed.id, email: authed.email } : null,
        signupOpen,
      });
    } catch (err) {
      console.error("auth/status failed:", err);
      return jsonResponse(
        { authed: false, user: null, signupOpen: false, error: "Database unavailable." },
        503,
      );
    }
  }

  // POST /api/auth/signup — create the owner account (single-owner gated).
  if (pathname === "/api/auth/signup" && req.method === "POST") {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ ok: false, error: "Invalid JSON body." }, 400);
    }
    const parsed = validateAuthInput(body);
    if (!parsed.ok) return jsonResponse({ ok: false, error: parsed.error }, 400);
    try {
      if ((await countUsers()) !== 0) {
        return jsonResponse(
          { ok: false, error: "An owner account already exists. Please log in." },
          403,
        );
      }
      const existing = await findUserByEmail(parsed.email);
      if (existing) {
        return jsonResponse({ ok: false, error: "That email is already registered." }, 409);
      }
      const user = await createUser(parsed.email, await hashPassword(parsed.password));
      const sessionToken = await createSession(user.id);
      return jsonResponse(
        { ok: true, user: { id: user.id, email: user.email } },
        200,
        sessionCookie(sessionToken, secure),
      );
    } catch (err) {
      console.error("signup failed:", err);
      return jsonResponse(
        { ok: false, error: "We couldn't create your account right now. Please try again." },
        503,
      );
    }
  }

  // POST /api/auth/login — verify credentials, create a session, set cookie.
  if (pathname === "/api/auth/login" && req.method === "POST") {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ ok: false, error: "Invalid JSON body." }, 400);
    }
    const parsed = validateAuthInput(body);
    if (!parsed.ok) return jsonResponse({ ok: false, error: parsed.error }, 400);
    try {
      const user = await findUserByEmail(parsed.email);
      if (!user) {
        return jsonResponse({ ok: false, error: "Invalid email or password." }, 401);
      }
      const stored = await getPasswordHash(user.id);
      const valid = stored ? await verifyPassword(parsed.password, stored) : false;
      if (!valid) {
        return jsonResponse({ ok: false, error: "Invalid email or password." }, 401);
      }
      const sessionToken = await createSession(user.id);
      return jsonResponse(
        { ok: true, user: { id: user.id, email: user.email } },
        200,
        sessionCookie(sessionToken, secure),
      );
    } catch {
      return jsonResponse(
        { ok: false, error: "We couldn't log you in right now. Please try again." },
        503,
      );
    }
  }

  // POST /api/auth/logout — delete the session and clear the cookie.
  if (pathname === "/api/auth/logout" && req.method === "POST") {
    try {
      if (token) await deleteSessionByToken(token);
    } catch {
      // Deleting an already-invalid session is fine.
    }
    return jsonResponse({ ok: true }, 200, clearSessionCookie(secure));
  }

  // GET /api/auth/me — current user (id, email) or 401.
  if (pathname === "/api/auth/me") {
    try {
      const user = token ? await findUserByToken(token) : null;
      if (!user) return jsonResponse({ error: "Not authenticated." }, 401);
      return jsonResponse({ user: { id: user.id, email: user.email } });
    } catch {
      return jsonResponse({ error: "Database unavailable." }, 503);
    }
  }

  // /api/portfolio — GET (read) / PUT (write) the authenticated user's state.
  if (pathname === "/api/portfolio") {
    let authUser: AuthUser | null = null;
    try {
      authUser = token ? await findUserByToken(token) : null;
    } catch {
      return jsonResponse({ error: "Database unavailable." }, 503);
    }
    if (!authUser) {
      return jsonResponse({ error: "Not authenticated." }, 401);
    }

    if (req.method === "GET") {
      try {
        const state = await getPortfolioState(authUser.id);
        return jsonResponse({ state: state ?? null });
      } catch {
        return jsonResponse({ error: "Database unavailable." }, 503);
      }
    }

    if (req.method === "PUT") {
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return jsonResponse({ ok: false, error: "Invalid JSON body." }, 400);
      }
      if (typeof body !== "object" || body === null) {
        return jsonResponse({ ok: false, error: "Portfolio state must be an object." }, 400);
      }
      try {
        await putPortfolioState(authUser.id, body);
        return jsonResponse({ ok: true });
      } catch {
        return jsonResponse({ ok: false, error: "Database unavailable." }, 503);
      }
    }

    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  return null;
}
