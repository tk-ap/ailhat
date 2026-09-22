import { useEffect, useMemo, useState } from "react";

type Product = { id: string; name: string; repository?: string; url?: string };
type Environment = {
  productId: string;
  provider: "here-now";
  providerConnectionRef: string;
  slug: string | null;
  sandboxUrl: string;
  lifecycle: string;
  staticPrimary: boolean;
  currentVersionId: string | null;
  sourceRepository: string | null;
  sourceRef: string | null;
  verificationState: string;
  verifiedAt: string | null;
  updatedAt: string;
};
type Connection = {
  provider: "here-now";
  configured: boolean;
  source: "runtime_secret";
  secretName: "HERENOW_API_KEY";
  inherited: true;
};

export default function HereNowSandboxConnector({ products }: { products: Product[] }) {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [sandboxUrl, setSandboxUrl] = useState("");
  const [currentVersionId, setCurrentVersionId] = useState("");
  const [sourceRef, setSourceRef] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selected = useMemo(
    () => products.find((product) => product.id === productId) ?? null,
    [products, productId],
  );

  const refresh = async () => {
    setError("");
    const response = await fetch("/api/sandbox-environments", { cache: "no-store" });
    const data = await response.json().catch(() => ({})) as {
      connection?: Connection; environments?: Environment[]; error?: string;
    };
    if (!response.ok) {
      setError(data.error ?? "here.now environment registry is unavailable.");
      return;
    }
    setConnection(data.connection ?? null);
    setEnvironments(data.environments ?? []);
  };

  useEffect(() => { void refresh(); }, []);
  useEffect(() => {
    if (!productId && products[0]?.id) setProductId(products[0].id);
  }, [products, productId]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(""); setError("");
    if (!selected) return;
    const response = await fetch("/api/sandbox-environments", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        productId: selected.id,
        sandboxUrl,
        currentVersionId: currentVersionId || null,
        sourceRepository: selected.repository || null,
        sourceRef: sourceRef || "main",
        lifecycle: "live",
        verificationState: "unknown",
      }),
    });
    const data = await response.json().catch(() => ({})) as { environment?: Environment; error?: string };
    if (!response.ok || !data.environment) {
      setError(data.error ?? "Sandbox mapping could not be saved.");
      return;
    }
    setMessage(`${selected.name} now inherits the owner here.now connection.`);
    setSandboxUrl(""); setCurrentVersionId(""); setSourceRef("");
    await refresh();
  };

  const remove = async (environment: Environment) => {
    const response = await fetch(`/api/sandbox-environments?productId=${encodeURIComponent(environment.productId)}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as { error?: string };
      setError(data.error ?? "Sandbox mapping could not be removed.");
      return;
    }
    await refresh();
  };

  return (
    <section className="silhat-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="silhat-eyebrow">Owner connection · Sandboxes</p>
          <h2 className="mt-1 text-xl font-semibold text-gray-100">here.now</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">
            One owner-level provider connection can be inherited by many product sandboxes. Products store only stable environment identity and evidence lineage; the provider API key stays in the deployment secret store.
          </p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
          connection?.configured
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
            : "border-amber-400/25 bg-amber-400/[0.05] text-amber-300"
        }`}>
          {connection?.configured ? "Owner connection configured" : "Secret not configured"}
        </span>
      </div>

      <div className="mt-4 rounded-lg border border-gray-800 bg-gray-950/45 p-3 text-xs leading-5 text-gray-500">
        Connection ref · <code className="text-gray-300">owner:provider:here-now</code> · inherited portfolio-wide · secret value never returned to the browser
      </div>

      <div className="mt-5 space-y-2">
        {environments.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-800 p-4 text-sm text-gray-500">
            No product sandboxes registered yet. Register a stable here.now URL after the first product claim.
          </p>
        ) : environments.map((environment) => {
          const product = products.find((item) => item.id === environment.productId);
          return (
            <div key={environment.productId} className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-100">{product?.name ?? environment.productId}</p>
                  <a href={environment.sandboxUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-11 items-center rounded-lg border border-gray-800 px-3 py-2 text-xs font-semibold text-[#9cc8ff] hover:border-gray-700 hover:bg-gray-900/60">
                    Open sandbox ↗
                  </a>
                </div>
                <span className="text-xs font-semibold text-gray-400">{environment.lifecycle}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 break-all text-xs text-gray-600">
                <span>slug · {environment.slug ?? "unknown"}</span>
                <span>version · {environment.currentVersionId ?? "unknown"}</span>
                <span>verification · {environment.verificationState}</span>
                <span>source · {environment.sourceRepository ?? "unresolved"}@{environment.sourceRef ?? "unknown"}</span>
              </div>
              <button type="button" onClick={() => void remove(environment)} className="mt-3 inline-flex min-h-11 items-center rounded-lg px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-900/60 hover:text-rose-300">
                Remove mapping
              </button>
            </div>
          );
        })}
      </div>

      <form onSubmit={save} className="mt-5 grid gap-3 md:grid-cols-2">
        <label className="text-xs text-gray-400">
          Product
          <select value={productId} onChange={(event) => setProductId(event.target.value)} className="silhat-input mt-1 min-h-11">
            {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
          </select>
        </label>
        <label className="text-xs text-gray-400">
          Stable here.now sandbox URL
          <input type="url" required value={sandboxUrl} onChange={(event) => setSandboxUrl(event.target.value)} placeholder="https://project-slug.here.now/" className="silhat-input mt-1 min-h-11" />
        </label>
        <label className="text-xs text-gray-400">
          Current version ID <span className="text-gray-700">optional</span>
          <input value={currentVersionId} onChange={(event) => setCurrentVersionId(event.target.value)} className="silhat-input mt-1 min-h-11" />
        </label>
        <label className="text-xs text-gray-400">
          Source ref
          <input value={sourceRef} onChange={(event) => setSourceRef(event.target.value)} placeholder="main or commit SHA" className="silhat-input mt-1 min-h-11" />
        </label>
        <div className="md:col-span-2 flex flex-wrap items-center gap-3">
          <button type="submit" disabled={!selected || !sandboxUrl.trim()} className="silhat-btn silhat-btn-primary min-h-11 px-4 disabled:opacity-50">
            Register sandbox
          </button>
          <span className="text-[11px] text-gray-600">Registration is topology, not deployment or verification evidence.</span>
        </div>
      </form>

      {message && <p className="mt-4 text-sm text-emerald-300">{message}</p>}
      {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}
    </section>
  );
}
