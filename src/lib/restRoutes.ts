// Shared plain-REST router for ailhat's server-side API.
// Tenant-sensitive routes resolve the session before any account data is read or written.
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
import { getPortfolioState, putPortfolioState } from "./db-portfolio.ts";
import { saveIntentSignup, validateIntentInput } from "./db-intent.ts";
import { checkAvailability } from "./availability.ts";
import { runCorrectedScan } from "./scan-correctness.ts";
import { readObservations, upsertObservation } from "./observations.server.ts";
import { sanitizeObservation, hostFromUrl, scanEvidenceObservation } from "./observations.ts";
import type { AvailabilityObservation } from "./observations.ts";

function jsonResponse(body: unknown, status = 200, setCookie?: string): Response {
  const headers: Record<string, string> = { "content-type": "application/json; charset=utf-8" };
  if (setCookie) headers["set-cookie"] = setCookie;
  return new Response(JSON.stringify(body), { status, headers });
}

function sessionCookie(token: string, secure: boolean): string {
  const maxAge = 30 * 24 * 60 * 60;
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}` + (secure ? "; Secure" : "");
}

function clearSessionCookie(secure: boolean): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0` + (secure ? "; Secure" : "");
}

async function requestUser(token: string): Promise<AuthUser | null> {
  try {
    return token ? await findUserByToken(token) : null;
  } catch {
    return null;
  }
}

function portfolioOwnsHost(state: unknown, url: string): boolean {
  const host = hostFromUrl(url);
  if (!host || !state || typeof state !== "object") return false;
  const products = (state as { products?: Array<{ url?: string }> }).products;
  return Array.isArray(products) && products.some((product) => hostFromUrl(product?.url) === host);
}

export async function handleRestRoute(req: Request, secure: boolean): Promise<Response | null> {
  const { pathname, searchParams } = new URL(req.url);
  const cookies = parseCookies(req.headers.get("cookie"));
  const token = cookies[SESSION_COOKIE] ?? "";

  if (pathname === "/api/check-availability") {
    const name = searchParams.get("name") ?? "";
    try {
      const result = await checkAvailability(name);
      return jsonResponse(result);
    } catch {
      return jsonResponse({ name, results: [], checkedAt: Date.now() }, 500);
    }
  }

  // Public scanning remains available, but persistence is account-scoped and only
  // occurs when the scanned host belongs to the authenticated user's portfolio.
  if (pathname === "/api/scan-site") {
    const url = searchParams.get("url") ?? "";
    try {
      const result = await runCorrectedScan(url);
      try {
        const user = await requestUser(token);
        if (user) {
          const state = await getPortfolioState(user.id);
          if (portfolioOwnsHost(state, result.url || result.requestedUrl || url)) {
            await upsertObservation(user.id, scanEvidenceObservation(result));
          }
        }
      } catch (error) {
        console.error("[scan-site] failed to persist tenant scan evidence:", error);
      }
      return jsonResponse(result);
    } catch {
      return jsonResponse({ url, requestedUrl: url, ok: false, scannedAt: Date.now(), findings: [] }, 500);
    }
  }

  // Agent Direct availability/live-sync is private tenant evidence. Reads and
  // writes fail closed without an authenticated session. The old shared feed is
  // not reachable from these routes.
  const isAvailPath = pathname === "/api/availability";
  const isSyncPath = pathname === "/api/sync";
  if (isAvailPath || isSyncPath) {
    const user = await requestUser(token);
    if (!user) return jsonResponse({ ok: false, error: "Not authenticated." }, 401);

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
        if (!clean) continue;
        await upsertObservation(user.id, clean);
        stored += 1;
        last = { ...clean, account: String(user.id) };
      }
      if (stored === 0) {
        return jsonResponse({ ok: false, error: "no usable observation (need provider, url, observedAt)" }, 400);
      }
      return jsonResponse({ ok: true, stored, last, receivedAt: Date.now() });
    }

    if (req.method === "GET") {
      const sinceRaw = searchParams.get("since");
      const parsedSince = sinceRaw ? Number(sinceRaw) : 0;
      const since = Number.isFinite(parsedSince) ? parsedSince : 0;
      const rows = await readObservations(user.id, since > 0 ? { sinceMs: since } : {});
      return jsonResponse(rows);
    }

    return jsonResponse({ ok: false, error: `method ${req.method} not supported` }, 405);
  }

  if (pathname === "/api/intent" && req.method === "POST") {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ ok: false, error: "Invalid JSON body." }, 400);
    }
    const parsed = validateIntentInput(body);
    if (!parsed.ok) return jsonResponse({ ok: false, error: parsed.error }, parsed.status);
    try {
      const { id } = await saveIntentSignup(parsed.value);
      return jsonResponse({ ok: true, id, receivedAt: Date.now() });
    } catch (err) {
      console.error("intent capture failed:", err);
      return jsonResponse({ ok: false, error: "We couldn't save your response right now. Please try again in a moment." }, 503);
    }
  }

  if (pathname === "/api/auth/status") {
    try {
      const authed = token ? await findUserByToken(token) : null;
      const signupOpen = (await countUsers()) === 0;
      return jsonResponse({ authed: !!authed, user: authed ? { id: authed.id, email: authed.email } : null, signupOpen });
    } catch (err) {
      console.error("auth/status failed:", err);
      return jsonResponse({ authed: false, user: null, signupOpen: false, error: "Database unavailable." }, 503);
    }
  }

  if (pathname === "/api/auth/signup" && req.method === "POST") {
    let body: unknown;
    try { body = await req.json(); } catch { return jsonResponse({ ok: false, error: "Invalid JSON body." }, 400); }
    const parsed = validateAuthInput(body);
    if (!parsed.ok) return jsonResponse({ ok: false, error: parsed.error }, 400);
    try {
      if ((await countUsers()) !== 0) return jsonResponse({ ok: false, error: "An owner account already exists. Please log in." }, 403);
      const existing = await findUserByEmail(parsed.email);
      if (existing) return jsonResponse({ ok: false, error: "That email is already registered." }, 409);
      const user = await createUser(parsed.email, await hashPassword(parsed.password));
      const sessionToken = await createSession(user.id);
      return jsonResponse({ ok: true, user: { id: user.id, email: user.email } }, 200, sessionCookie(sessionToken, secure));
    } catch (err) {
      console.error("signup failed:", err);
      return jsonResponse({ ok: false, error: "We couldn't create your account right now. Please try again." }, 503);
    }
  }

  if (pathname === "/api/auth/login" && req.method === "POST") {
    let body: unknown;
    try { body = await req.json(); } catch { return jsonResponse({ ok: false, error: "Invalid JSON body." }, 400); }
    const parsed = validateAuthInput(body);
    if (!parsed.ok) return jsonResponse({ ok: false, error: parsed.error }, 400);
    try {
      const user = await findUserByEmail(parsed.email);
      if (!user) return jsonResponse({ ok: false, error: "Invalid email or password." }, 401);
      const stored = await getPasswordHash(user.id);
      const valid = stored ? await verifyPassword(parsed.password, stored) : false;
      if (!valid) return jsonResponse({ ok: false, error: "Invalid email or password." }, 401);
      const sessionToken = await createSession(user.id);
      return jsonResponse({ ok: true, user: { id: user.id, email: user.email } }, 200, sessionCookie(sessionToken, secure));
    } catch {
      return jsonResponse({ ok: false, error: "We couldn't log you in right now. Please try again." }, 503);
    }
  }

  if (pathname === "/api/auth/logout" && req.method === "POST") {
    try { if (token) await deleteSessionByToken(token); } catch { /* already invalid is fine */ }
    return jsonResponse({ ok: true }, 200, clearSessionCookie(secure));
  }

  if (pathname === "/api/auth/me") {
    try {
      const user = token ? await findUserByToken(token) : null;
      if (!user) return jsonResponse({ error: "Not authenticated." }, 401);
      return jsonResponse({ user: { id: user.id, email: user.email } });
    } catch {
      return jsonResponse({ error: "Database unavailable." }, 503);
    }
  }

  if (pathname === "/api/portfolio") {
    let authUser: AuthUser | null = null;
    try { authUser = token ? await findUserByToken(token) : null; } catch { return jsonResponse({ error: "Database unavailable." }, 503); }
    if (!authUser) return jsonResponse({ error: "Not authenticated." }, 401);

    if (req.method === "GET") {
      try { return jsonResponse({ state: (await getPortfolioState(authUser.id)) ?? null }); }
      catch { return jsonResponse({ error: "Database unavailable." }, 503); }
    }

    if (req.method === "PUT") {
      let body: unknown;
      try { body = await req.json(); } catch { return jsonResponse({ ok: false, error: "Invalid JSON body." }, 400); }
      if (typeof body !== "object" || body === null) return jsonResponse({ ok: false, error: "Portfolio state must be an object." }, 400);
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
