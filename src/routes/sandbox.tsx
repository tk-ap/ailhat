import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import AppShell from "~/components/AppShell";
import SandboxExecutionPanel from "~/components/SandboxExecutionPanel";
import { AuthProvider } from "~/lib/useAuth";
import { StoreProvider } from "~/lib/useStore";
import { getAgentControl } from "~/lib/control-query";
import { buildWorkItem } from "~/lib/directives";

export const Route = createFileRoute("/sandbox")({
  loader: async () => getAgentControl(),
  component: () => (
    <AuthProvider>
      <StoreProvider>
        <AppShell active="sandbox">
          <SandboxWorkspace />
        </AppShell>
      </StoreProvider>
    </AuthProvider>
  ),
});

function SandboxWorkspace() {
  const data = Route.useLoaderData();
  const portfolio = data?.portfolio ?? [];
  const now = data?.modeledAt ?? Date.now();
  const [selectedId, setSelectedId] = useState(() => portfolio[0]?.ws.id ?? "");
  const selected = portfolio.find((entry) => entry.ws.id === selectedId) ?? portfolio[0] ?? null;
  const item = useMemo(
    () => selected ? buildWorkItem(selected, now, { bucket: null }) : null,
    [selected, now],
  );

  if (!data?.authenticated) {
    return (
      <section className="silhat-panel mx-auto max-w-xl p-8 text-center">
        <p className="silhat-eyebrow">Sandbox</p>
        <h1 className="mt-2 text-2xl font-bold text-gray-50">Log in to open governed sandbox sessions</h1>
        <p className="mt-2 text-sm leading-6 text-gray-400">
          Sandbox sessions are account-scoped and use that account&apos;s portfolio, registered environments, and execution connection.
        </p>
        <Link to="/login" className="silhat-btn silhat-btn-primary mt-5 inline-flex">Log in</Link>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="silhat-eyebrow">Governed Sandbox</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-50">Direct work into a reviewable environment</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">
            Send a prepared ailhat directive through the configured execution backend, inspect the resulting sandbox, and keep evidence and independent review attached to the same execution. Production is not modified from this workspace.
          </p>
        </div>
        <Link to="/control" className="silhat-btn silhat-btn-ghost">Open Agent Direct</Link>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <div className="silhat-panel p-4">
          <p className="silhat-eyebrow">Intent</p>
          <p className="mt-2 text-sm font-semibold text-gray-200">Prepared directive</p>
          <p className="mt-1 text-xs leading-5 text-gray-500">The exact Agent Direct WorkItem is the source intent. Sending it does not rewrite the directive.</p>
        </div>
        <div className="silhat-panel p-4">
          <p className="silhat-eyebrow">Environment</p>
          <p className="mt-2 text-sm font-semibold text-gray-200">Sandbox provider</p>
          <p className="mt-1 text-xs leading-5 text-gray-500">here.now is the first provider. Additional temporary and stable providers can sit behind the same sandbox contract.</p>
        </div>
        <div className="silhat-panel p-4">
          <p className="silhat-eyebrow">Boundary</p>
          <p className="mt-2 text-sm font-semibold text-gray-200">Review before release</p>
          <p className="mt-1 text-xs leading-5 text-gray-500">Sandbox PASS is evidence for review. It is never production approval or deployment authority.</p>
        </div>
      </section>

      {portfolio.length === 0 ? (
        <section className="silhat-panel border-dashed p-8 text-center">
          <h2 className="font-semibold text-gray-200">No product is available for a sandbox session</h2>
          <p className="mt-1 text-sm text-gray-500">Add a product to this account before preparing or sending governed work.</p>
          <Link to="/portfolio" className="silhat-btn silhat-btn-primary mt-4 inline-flex">Open Portfolio</Link>
        </section>
      ) : (
        <>
          <section className="silhat-panel p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="silhat-eyebrow">Product</p>
                <h2 className="mt-1 text-lg font-semibold text-gray-100">Choose the sandbox target</h2>
              </div>
              <span className="text-xs text-gray-600">{portfolio.length} account product{portfolio.length === 1 ? "" : "s"}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {portfolio.map((entry) => (
                <button
                  key={entry.ws.id}
                  type="button"
                  onClick={() => setSelectedId(entry.ws.id)}
                  className={`min-h-11 rounded-lg border px-3 py-2 text-sm font-semibold transition ${selected?.ws.id === entry.ws.id ? "border-[#7fb0ff]/40 bg-[#7fb0ff]/10 text-[#9cc8ff]" : "border-gray-800 bg-gray-950 text-gray-400 hover:border-gray-700"}`}
                >
                  {entry.ws.name}
                </button>
              ))}
            </div>
          </section>

          {item && (
            <>
              <section className="silhat-panel p-5">
                <p className="silhat-eyebrow">Prepared work</p>
                <h2 className="mt-1 text-lg font-semibold text-gray-100">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-gray-400">{item.priority.reason}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-gray-600">
                  <span>work item · {item.id}</span>
                  <span>evidence · {item.evidenceBasis}</span>
                  <span>suggested harness · {item.capacity.targetHarness}</span>
                </div>
              </section>

              <SandboxExecutionPanel item={item} hideWhenUnavailable={false} />
            </>
          )}
        </>
      )}

      <section className="rounded-xl border border-gray-800 bg-gray-950/45 p-5">
        <p className="silhat-eyebrow">Lifecycle</p>
        <p className="mt-2 font-mono text-xs leading-6 text-gray-500">
          prepared ≠ sent ≠ claimed ≠ executed ≠ sandbox published ≠ reviewed ≠ accepted ≠ production deployed
        </p>
      </section>
    </div>
  );
}
