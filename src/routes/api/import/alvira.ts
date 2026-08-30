import { createFileRoute } from "@tanstack/react-router";
import { sql } from "~/db";
import { SESSION_COOKIE, findUserByToken, parseCookies } from "~/lib/auth";

const ALVIRA_HANDOFF_URL = process.env.ALVIRA_HANDOFF_URL?.trim() || "https://alviratech.vercel.app/api/handoff/ailhat";

async function ensureImportSchema() {
  const q = sql() as unknown as { query: (text: string) => Promise<unknown> };
  await q.query(`
    CREATE TABLE IF NOT EXISTS alvira_context_imports (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      snapshot JSONB NOT NULL,
      source_updated_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function requireUser(request: Request) {
  const token = parseCookies(request.headers.get("cookie"))[SESSION_COOKIE] ?? "";
  const user = token ? await findUserByToken(token) : null;
  if (!user) throw new Error("not_authenticated");
  return user;
}

export const Route = createFileRoute("/api/import/alvira")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let user;
        try {
          user = await requireUser(request);
        } catch {
          return Response.json({ error: "not_authenticated" }, { status: 401 });
        }

        let token = "";
        try {
          const body = await request.json() as { token?: string };
          token = String(body.token ?? "").trim();
        } catch {
          return Response.json({ error: "invalid_request" }, { status: 400 });
        }
        if (!token) return Response.json({ error: "missing_token" }, { status: 400 });

        const upstream = new URL(ALVIRA_HANDOFF_URL);
        upstream.searchParams.set("token", token);
        let payload: { handoff?: unknown };
        try {
          const response = await fetch(upstream, { cache: "no-store" });
          if (!response.ok) return Response.json({ error: "handoff_expired_or_used" }, { status: 410 });
          payload = await response.json() as { handoff?: unknown };
        } catch {
          return Response.json({ error: "alvira_unavailable" }, { status: 502 });
        }

        const handoff = payload.handoff as {
          schema?: string;
          source?: string;
          profile?: { topic?: string; offering?: string; updated_at?: string };
          created_at?: string;
        } | undefined;
        if (!handoff || handoff.schema !== "alvira.ailhat-handoff.v1" || handoff.source !== "ALVIRA" || !handoff.profile) {
          return Response.json({ error: "invalid_handoff" }, { status: 400 });
        }

        await ensureImportSchema();
        await sql()`
          INSERT INTO alvira_context_imports (user_id, snapshot, source_updated_at)
          VALUES (${user.id}, ${JSON.stringify(payload.handoff)}, ${handoff.profile.updated_at ? new Date(handoff.profile.updated_at) : null})
        `;

        return Response.json({
          ok: true,
          imported: {
            topic: handoff.profile.topic || "ALVIRA Context",
            offering: handoff.profile.offering || "context",
            updatedAt: handoff.profile.updated_at || null,
          },
          message: "ALVIRA gave ailhat the background you chose to carry over. Product mapping remains reviewable before it changes portfolio state.",
        });
      },
      GET: async ({ request }) => {
        let user;
        try {
          user = await requireUser(request);
        } catch {
          return Response.json({ error: "not_authenticated" }, { status: 401 });
        }
        await ensureImportSchema();
        const rows = await sql()`
          SELECT snapshot, created_at FROM alvira_context_imports
          WHERE user_id = ${user.id}
          ORDER BY created_at DESC LIMIT 1
        `;
        if (!rows.length) return Response.json({ imported: null });
        const row = rows[0] as { snapshot: any; created_at: string };
        return Response.json({
          imported: {
            topic: row.snapshot?.profile?.topic || "ALVIRA Context",
            offering: row.snapshot?.profile?.offering || "context",
            sourceUpdatedAt: row.snapshot?.profile?.updated_at || null,
            importedAt: row.created_at,
          },
        });
      },
    },
  },
});
