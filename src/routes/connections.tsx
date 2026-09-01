import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AuthProvider, useAuth } from "~/lib/useAuth";
import { StoreProvider, useStore } from "~/lib/useStore";
import AppShell from "~/components/AppShell";

export const Route = createFileRoute("/connections")({
  component: () => (
    <AuthProvider>
      <StoreProvider>
        <AppShell active="connections">
          <ConnectionsPage />
        </AppShell>
      </StoreProvider>
    </AuthProvider>
  ),
});

type Provider = "github" | "vercel" | "analytics" | "harness";
type Purpose = "evidence" | "execution";
type Permission = "read" | "read-write";

interface ConnectionIntent {
  id: string;
  provider: Provider;
  purpose: Purpose;
  permission: Permission;
  productIds: string[];
  createdAt: number;
}

const KEY = "ailhat.connection-intents.v1";

const PROVIDERS: Record<Provider, { label: string; note: string }> = {
  github: {
    label: "GitHub",
    note: "Repository, issue, pull request, and build-history evidence.",
  },
  vercel: {
    label: "Vercel",
    note: "Deployment, domain, runtime, and production-health evidence.",
  },
  analytics: {
    label: "Analytics",
    note: "Product-appropriate engagement and conversion evidence.",
  },
  harness: {
    label: "Agentic harness",
    note: "A governed destination for prepared work from Direct.",
  },
};

function loadIntents(): ConnectionIntent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as ConnectionIntent[]) : [];
  } catch {
    return [];
  }
}

function persistIntents(items: ConnectionIntent[]) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(KEY, JSON.stringify(items.slice(0, 30)));
  }
  return items.slice(0, 30);
}

function ageLabel(at?: number) {
  if (!at) return "No evidence yet";
  const minutes = Math.max(0, Math.floor((Date.now() - at) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function ConnectionsPage() {
  const { user, loading } = useAuth();
  const { state, ready } = useStore();
  const [intents, setIntents] = useState<ConnectionIntent[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [provider, setProvider] = useState<Provider>("github");
  const [purpose, setPurpose] = useState<Purpose>("evidence");
  const [permission, setPermission] = useState<Permission>("read");
  const [productIds, setProductIds] = useState<string[]>([]);

  useEffect(() => setIntents(loadIntents()), []);

  const scanCoverage = useMemo(
    () => state.products.filter((product) => !!state.scanHistory?.[product.id]?.lastGood).length,
    [state.products, state.scanHistory],
  );
  const latestScanAt = useMemo(
    () => Math.max(0, ...Object.values(state.scanHistory ?? {}).map((history) => history?.lastGood?.scannedAt ?? 0)),
    [state.scanHistory],
  );

  if (loading || !ready) return <p className="py-20 text-center text-gray-500">Loading…</p>;

  if (!user) {
    return (
      <section className="silhat-panel mx-auto max-w-xl p-8 text-center">
        <p className="silhat-eyebrow">Connections</p>
        <h1 className="mt-2 text-2xl font-bold text-gray-50">Log in to manage evidence sources</h1>
        <Link to="/login" className="silhat-btn silhat-btn-primary mt-5 inline-flex px-4 py-2">Log in</Link>
      </section>
    );
  }

  const addIntent = () => {
    const next: ConnectionIntent = {
      id: `${provider}:${Date.now().toString(36)}`,
      provider,
      purpose,
      permission,
      productIds,
      createdAt: Date.now(),
    };
    setIntents(persistIntents([next, ...intents]));
    setShowForm(false);
    setProductIds([]);
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="silhat-eyebrow">System · Connections</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-50">Evidence in. Prepared work out.</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">
            Connections defines where ailhat can observe evidence and where governed work may be handed off. A provider is never labeled connected merely because an integration has been declared.
          </p>
        </div>
        <button type="button" onClick={() => setShowForm((value) => !value)} className="silhat-btn silhat-btn-primary">
          {showForm ? "Close" : "Declare integration"}
        </button>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="silhat-panel p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="silhat-eyebrow">Built in · Evidence</p>
              <h2 className="mt-1 text-xl font-semibold text-gray-100">Site observation</h2>
            </div>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">Active</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-gray-400">
            Uses product URLs already stored in ailhat. Successful scans feed findings, change history, Launch Readiness, Today, and verification.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3"><p className="text-gray-500">Coverage</p><p className="mt-1 font-semibold text-gray-100">{scanCoverage}/{state.products.length} products</p></div>
            <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3"><p className="text-gray-500">Latest evidence</p><p className="mt-1 font-semibold text-gray-100">{ageLabel(latestScanAt)}</p></div>
          </div>
        </div>

        <div className="silhat-panel p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="silhat-eyebrow">Built in · Intelligence</p>
              <h2 className="mt-1 text-xl font-semibold text-gray-100">Manual external signals</h2>
            </div>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">Active</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-gray-400">
            IdeaBrowser observations, customer problems, competitor patterns, research, and founder notes can enter RADAR with provenance attached. Automated provider ingestion is not claimed.
          </p>
          <Link to="/brief" className="silhat-btn silhat-btn-ghost mt-4 inline-flex">Open RADAR →</Link>
        </div>
      </section>

      {showForm && (
        <section className="silhat-panel border-[#7fb0ff]/25 p-5">
          <p className="silhat-eyebrow">Integration intent · not a live connection</p>
          <h2 className="mt-1 text-xl font-semibold text-gray-100">Define what this adapter should be allowed to do</h2>
          <p className="mt-2 text-sm text-gray-500">No token, OAuth grant, API key, or external data exchange happens in this v1 registry.</p>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <label className="text-sm text-gray-400">Provider
              <select value={provider} onChange={(event) => setProvider(event.target.value as Provider)} className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-gray-200">
                {Object.entries(PROVIDERS).map(([id, meta]) => <option key={id} value={id}>{meta.label}</option>)}
              </select>
            </label>
            <label className="text-sm text-gray-400">Purpose
              <select value={purpose} onChange={(event) => setPurpose(event.target.value as Purpose)} className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-gray-200">
                <option value="evidence">Evidence source</option><option value="execution">Execution destination</option>
              </select>
            </label>
            <label className="text-sm text-gray-400">Requested scope
              <select value={permission} onChange={(event) => setPermission(event.target.value as Permission)} className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-gray-200">
                <option value="read">Read only</option><option value="read-write">Read + write</option>
              </select>
            </label>
          </div>
          <div className="mt-4">
            <p className="text-sm text-gray-400">Products in scope</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {state.products.length === 0 && <span className="text-xs text-gray-600">No active products yet.</span>}
              {state.products.map((product) => {
                const selected = productIds.includes(product.id);
                return <button key={product.id} type="button" onClick={() => setProductIds(selected ? productIds.filter((id) => id !== product.id) : [...productIds, product.id])} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${selected ? "border-[#7fb0ff]/40 bg-[#7fb0ff]/10 text-[#9cc8ff]" : "border-gray-800 text-gray-400"}`}>{product.name}</button>;
              })}
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button type="button" onClick={addIntent} className="silhat-btn silhat-btn-primary">Save integration intent</button>
            <span className="text-xs text-amber-300">Status after save: Adapter required · not connected</span>
          </div>
        </section>
      )}

      <section className="silhat-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="silhat-eyebrow">Integration registry</p><h2 className="mt-1 text-xl font-semibold text-gray-100">Declared external providers</h2></div>
          <span className="text-xs text-gray-500">{intents.length} declared</span>
        </div>
        {intents.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed border-gray-800 px-5 py-8 text-center"><p className="text-sm font-semibold text-gray-300">No external integrations declared</p><p className="mt-1 text-xs text-gray-600">Declare the intended provider, scope, and product ownership before wiring credentials.</p></div>
        ) : (
          <div className="mt-4 space-y-3">
            {intents.map((intent) => {
              const meta = PROVIDERS[intent.provider];
              const names = state.products.filter((product) => intent.productIds.includes(product.id)).map((product) => product.name);
              return (
                <div key={intent.id} className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><h3 className="font-semibold text-gray-100">{meta.label}</h3><p className="mt-1 text-xs text-gray-500">{meta.note}</p></div>
                    <span className="rounded-full border border-amber-400/25 bg-amber-400/[0.05] px-2.5 py-1 text-xs font-semibold text-amber-300">Adapter required</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-gray-400">
                    <span>Purpose · {intent.purpose}</span><span>Scope · {intent.permission}</span><span>Products · {names.length ? names.join(", ") : "portfolio / unassigned"}</span><span>Declared · {new Date(intent.createdAt).toLocaleDateString()}</span>
                  </div>
                  <button type="button" onClick={() => setIntents(persistIntents(intents.filter((item) => item.id !== intent.id)))} className="mt-3 text-xs font-semibold text-gray-600 hover:text-gray-300">Remove intent</button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-amber-400/20 bg-amber-400/[0.04] p-4 text-sm leading-6 text-amber-100/90">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-amber-300">Connection honesty</span>
        <p className="mt-1">“Declared” means ailhat knows the intended provider and permission boundary. “Connected” will be reserved for an authenticated adapter that can successfully read or write within that declared scope and report its last successful sync.</p>
      </section>
    </div>
  );
}
