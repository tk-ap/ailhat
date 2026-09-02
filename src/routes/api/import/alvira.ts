import { createFileRoute } from "@tanstack/react-router";
import { sql } from "~/db";
import { requireProductAccess } from "~/lib/request-auth";

const ALVIRA_HANDOFF_URL = process.env.ALVIRA_HANDOFF_URL?.trim() || "https://alviratech.vercel.app/api/handoff/ailhat";

async function ensureImportSchema() {
  const q = sql() as unknown as { query: (text: string) => Promise<unknown> };
  await q.query(`CREATE TABLE IF NOT EXISTS alvira_context_imports (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    snapshot JSONB NOT NULL,
    source_updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
}
async function accessUser(request: Request) { try { return (await requireProductAccess(request)).user; } catch { return null; } }

export const Route = createFileRoute("/api/import/alvira")({ server: { handlers: {
  POST: async ({ request }) => {
    const user = await accessUser(request);
    if (!user) return Response.json({ error: "product_access_required" }, { status: 403 });
    let token = "";
    try { const body = await request.json() as { token?: string }; token = String(body.token ?? "").trim(); }
    catch { return Response.json({ error: "invalid_request" }, { status: 400 }); }
    if (!token) return Response.json({ error: "missing_token" }, { status: 400 });
    const upstream = new URL(ALVIRA_HANDOFF_URL); upstream.searchParams.set("token", token);
    let payload: { handoff?: unknown };
    try {
      const response = await fetch(upstream, { cache: "no-store" });
      if (!response.ok) return Response.json({ error: "handoff_expired_or_used" }, { status: 410 });
      payload = await response.json() as { handoff?: unknown };
    } catch { return Response.json({ error: "alvira_unavailable" }, { status: 502 }); }
    const handoff = payload.handoff as { schema?: string; source?: string; profile?: { topic?: string; offering?: string; updated_at?: string } } | undefined;
    if (!handoff || handoff.schema !== "alvira.ailhat-handoff.v1" || handoff.source !== "ALVIRA" || !handoff.profile) return Response.json({ error: "invalid_handoff" }, { status: 400 });
    await ensureImportSchema();
    await sql()`insert into alvira_context_imports (user_id, snapshot, source_updated_at)
      values (${user.id}, ${JSON.stringify(payload.handoff)}, ${handoff.profile.updated_at ? new Date(handoff.profile.updated_at) : null})`;
    return Response.json({ ok: true, imported: { topic: handoff.profile.topic || "ALVIRA Context", offering: handoff.profile.offering || "context", updatedAt: handoff.profile.updated_at || null }, message: "ALVIRA gave ailhat the approved background. Product mapping remains reviewable before it changes portfolio state." });
  },
  GET: async ({ request }) => {
    const user = await accessUser(request);
    if (!user) return Response.json({ error: "product_access_required" }, { status: 403 });
    await ensureImportSchema();
    const rows = await sql()`select snapshot, created_at from alvira_context_imports where user_id = ${user.id} order by created_at desc limit 1`;
    if (!rows.length) return Response.json({ imported: null });
    const row = rows[0] as { snapshot: any; created_at: string };
    return Response.json({ imported: { topic: row.snapshot?.profile?.topic || "ALVIRA Context", offering: row.snapshot?.profile?.offering || "context", sourceUpdatedAt: row.snapshot?.profile?.updated_at || null, importedAt: row.created_at } });
  },
} } });
