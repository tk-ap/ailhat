import { useEffect, useState } from "react";

type AccountScope = "standard" | "admin";

type CredentialMetadata = {
  configured: boolean;
  productId: string;
  sandboxUrl: string | null;
  username: string | null;
  accountScope: AccountScope | null;
  updatedAt: string | null;
  lastVerifiedAt: string | null;
};

function formatTimestamp(value: string | null): string {
  if (!value) return "Never";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Unknown";
  return date.toLocaleString();
}

export default function SandboxAccessPanel({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const [credential, setCredential] = useState<CredentialMetadata | null>(null);
  const [sandboxUrl, setSandboxUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [accountScope, setAccountScope] = useState<AccountScope>("standard");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/sandbox-credentials?productId=${encodeURIComponent(productId)}`, {
          cache: "no-store",
        });
        const data = await response.json().catch(() => ({})) as {
          credential?: CredentialMetadata;
          error?: string;
        };
        if (!active) return;
        if (!response.ok || !data.credential) {
          setError(data.error ?? "Sandbox access could not be loaded.");
          return;
        }
        setCredential(data.credential);
        setSandboxUrl(data.credential.sandboxUrl ?? "");
        setUsername(data.credential.username ?? "");
        setAccountScope(data.credential.accountScope ?? "standard");
      } catch {
        if (active) setError("Sandbox access could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [productId]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/sandbox-credentials", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          productId,
          sandboxUrl,
          username,
          accountScope,
          ...(password ? { password } : {}),
        }),
      });
      const data = await response.json().catch(() => ({})) as {
        credential?: CredentialMetadata;
        error?: string;
      };
      if (!response.ok || !data.credential) {
        setError(data.error ?? "Sandbox access could not be saved.");
        return;
      }
      setCredential(data.credential);
      setPassword("");
      setMessage("Sandbox test access saved. The password will not be shown again.");
    } catch {
      setError("Sandbox access could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const revoke = async () => {
    if (saving || !credential?.configured) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/sandbox-credentials?productId=${encodeURIComponent(productId)}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Sandbox access could not be revoked.");
        return;
      }
      setCredential({
        configured: false,
        productId,
        sandboxUrl: null,
        username: null,
        accountScope: null,
        updatedAt: null,
        lastVerifiedAt: null,
      });
      setSandboxUrl("");
      setUsername("");
      setPassword("");
      setAccountScope("standard");
      setMessage("Sandbox test access revoked.");
    } catch {
      setError("Sandbox access could not be revoked.");
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "mt-1 w-full rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-sm text-gray-200 outline-none placeholder:text-gray-700 focus:border-[#7fb0ff]/60";

  return (
    <section className="silhat-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="silhat-eyebrow">Environment · test access</p>
          <h2 className="mt-1 text-lg font-semibold text-gray-100">Sandbox access</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
            Give ailhat a dedicated non-production account for browser-executed launch checks. Production credentials are not accepted here, and saved passwords are never returned to this page.
          </p>
        </div>
        <div className="text-right text-xs">
          {loading ? (
            <span className="text-gray-600">Loading…</span>
          ) : credential?.configured ? (
            <>
              <span className="inline-flex rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 font-semibold text-emerald-300">Credential configured</span>
              <p className="mt-1 text-gray-600">Updated {formatTimestamp(credential.updatedAt)}</p>
            </>
          ) : (
            <span className="inline-flex rounded-full border border-gray-700 bg-gray-950 px-2.5 py-1 font-semibold text-gray-500">Not configured</span>
          )}
        </div>
      </div>

      <form onSubmit={save} className="mt-5 grid gap-4 lg:grid-cols-2">
        <label className="text-xs font-medium text-gray-400 lg:col-span-2">
          Sandbox URL
          <input
            type="url"
            required
            value={sandboxUrl}
            onChange={(event) => setSandboxUrl(event.target.value)}
            placeholder="https://sandbox.example.com"
            className={inputClass}
          />
          <span className="mt-1 block text-[11px] leading-5 text-gray-600">HTTPS only. A preview that points at production services does not count as a sandbox.</span>
        </label>

        <label className="text-xs font-medium text-gray-400">
          Test account username / email
          <input
            type="text"
            autoComplete="off"
            required
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="ailhat-test@example.com"
            className={inputClass}
          />
        </label>

        <label className="text-xs font-medium text-gray-400">
          Account scope
          <select
            value={accountScope}
            onChange={(event) => setAccountScope(event.target.value as AccountScope)}
            className={inputClass}
          >
            <option value="standard">Standard test user</option>
            <option value="admin">Admin test user</option>
          </select>
        </label>

        <label className="text-xs font-medium text-gray-400 lg:col-span-2">
          {credential?.configured ? "Replace password (leave blank to keep current secret)" : "Test account password"}
          <input
            type="password"
            autoComplete="new-password"
            required={!credential?.configured}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={credential?.configured ? "Current password remains encrypted if left blank" : "Password is encrypted server-side"}
            className={inputClass}
          />
          <span className="mt-1 block text-[11px] leading-5 text-gray-600">The plaintext password must never enter product evidence, prompts, screenshots, analytics, or browser-test logs.</span>
        </label>

        <div className="flex flex-wrap items-center gap-2 lg:col-span-2">
          <button type="submit" disabled={saving || loading} className="silhat-btn silhat-btn-primary disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? "Saving…" : credential?.configured ? "Save changes" : "Save test access"}
          </button>
          {credential?.configured && (
            <button type="button" onClick={() => void revoke()} disabled={saving} className="silhat-btn silhat-btn-ghost text-rose-300 disabled:opacity-50">
              Revoke
            </button>
          )}
          <button
            type="button"
            disabled
            title="Enabled when a live browser journey is configured for this product."
            className="silhat-btn silhat-btn-ghost cursor-not-allowed opacity-45"
          >
            Verify access
          </button>
          <span className="text-[11px] text-gray-600">Last browser verification: {formatTimestamp(credential?.lastVerifiedAt ?? null)}</span>
        </div>
      </form>

      {message && <p className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-200">{message}</p>}
      {error && <p className="mt-4 rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-sm text-rose-300">{error}</p>}

      <p className="mt-4 border-t border-gray-800 pt-3 text-[11px] leading-5 text-gray-600">
        {productName} browser checks remain UNKNOWN until a sandbox journey actually runs. Storing a credential is configuration, not readiness evidence.
      </p>
    </section>
  );
}
