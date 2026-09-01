import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useAuth } from "~/lib/useAuth";
import { useStore } from "~/lib/useStore";
import type { ContextEnvelope, ContextScope, ContextType } from "~/lib/context-envelope";
import {
  addContextEnvelope,
  createUserContextEnvelope,
  importContextEnvelopes,
  loadContextEnvelopes,
  removeContextEnvelope,
  subscribeContextEnvelopes,
} from "~/lib/context-store";

const TYPE_OPTIONS: Array<{ value: ContextType; label: string; hint: string }> = [
  { value: "focus", label: "Focus", hint: "What should ailhat prioritize right now?" },
  { value: "goal", label: "Goal", hint: "What outcome are you working toward?" },
  { value: "constraint", label: "Constraint", hint: "What limits or tradeoffs should shape recommendations?" },
  { value: "fact", label: "Product / business fact", hint: "Stable context ailhat should know, but not independently verified." },
  { value: "evidence", label: "Customer / market evidence", hint: "Research, feedback, analytics notes, or observed demand." },
  { value: "rationale", label: "Decision rationale", hint: "Why a choice was made or why a direction changed." },
  { value: "preference", label: "Operating preference", hint: "How you prefer to prioritize, build, or evaluate." },
  { value: "assertion", label: "Assertion to verify", hint: "Something believed true that still needs evidence." },
];

function labelFor(item: ContextEnvelope) {
  const type = TYPE_OPTIONS.find((option) => option.value === item.contextType)?.label ?? item.contextType;
  return `${type} · ${item.provenance.sourceProduct}`;
}

export default function AddContext() {
  const { user, loading } = useAuth();
  const { state } = useStore();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ContextEnvelope[]>([]);
  const [contextType, setContextType] = useState<ContextType>("focus");
  const [productId, setProductId] = useState("");
  const [content, setContent] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [scope, setScope] = useState<ContextScope>("shared");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const refresh = () => setItems(loadContextEnvelopes());
    refresh();
    return subscribeContextEnvelopes(refresh);
  }, []);

  const selectedType = TYPE_OPTIONS.find((option) => option.value === contextType)!;
  const recent = useMemo(() => items.slice(0, 6), [items]);

  if (loading || !user) return null;

  const add = () => {
    if (!content.trim()) return;
    const product = productId ? state.products.find((candidate) => candidate.id === productId) : undefined;
    const envelope = createUserContextEnvelope({
      contextType,
      content,
      subjectType: product ? "product" : "portfolio",
      subjectId: product?.id,
      sourceUrl,
      scope,
      domain: product ? "product-intelligence" : "portfolio-intelligence",
      extensions: product ? { productName: product.name } : undefined,
    });
    addContextEnvelope(envelope);
    setContent("");
    setSourceUrl("");
    setMessage(
      scope === "shared"
        ? "Context added. It is eligible for ALVIRA exchange once the sharing adapter is connected."
        : "Context added to ailhat.",
    );
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 1_500_000) {
      setMessage("That file is too large for Add Context v1. Keep imports under 1.5 MB.");
      return;
    }
    try {
      const text = await file.text();
      if (file.name.toLowerCase().endsWith(".json")) {
        const parsed = JSON.parse(text) as unknown;
        const candidates = Array.isArray(parsed) ? parsed : [parsed];
        const imported = importContextEnvelopes(candidates as ContextEnvelope[]);
        if (imported > 0) {
          setMessage(`Imported ${imported} transferable context envelope${imported === 1 ? "" : "s"}. Provenance and verification status were preserved.`);
          return;
        }
      }
      setContent((current) => `${current}${current ? "\n\n" : ""}[${file.name}]\n${text.slice(0, 50000)}`);
      setContextType("evidence");
      setMessage(`${file.name} loaded as user-supplied evidence context. Review it before adding.`);
    } catch {
      setMessage("I could not read that file. Use a UTF-8 text, Markdown, or shared-context JSON file.");
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-[148px] z-50 hidden items-center gap-2 rounded-full border border-gray-700 bg-gray-900 px-3.5 py-2.5 text-sm font-semibold text-gray-200 shadow-2xl shadow-black/30 transition hover:border-gray-600 hover:bg-gray-800 sm:flex"
      >
        <span className="text-[#7fb0ff]">＋</span>
        Add Context
      </button>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-[68px] right-5 z-50 flex rounded-full border border-gray-700 bg-gray-900 px-3 py-2 text-xs font-semibold text-gray-300 shadow-xl sm:hidden"
      >
        ＋ Context
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Add context">
          <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-gray-700 bg-gray-950 shadow-2xl shadow-black/70">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-gray-800 bg-gray-950/95 px-5 py-4 backdrop-blur">
              <div>
                <p className="silhat-eyebrow text-[#7fb0ff]">&lt;add-context /&gt;</p>
                <h2 className="mt-1 text-xl font-bold text-gray-100">Add context without leaving ailhat</h2>
                <p className="mt-1 max-w-xl text-xs leading-5 text-gray-500">
                  Tell ailhat what scans cannot know. Context shapes judgment but remains distinct from observed evidence. Shared items use the same transferable envelope as ALVIRA.
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-2 py-1 text-lg text-gray-500 hover:bg-gray-900 hover:text-gray-200" aria-label="Close Add Context">×</button>
            </div>

            <div className="space-y-5 p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold text-gray-400">
                  Context type
                  <select value={contextType} onChange={(event) => setContextType(event.target.value as ContextType)} className="silhat-input mt-1">
                    {TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <span className="mt-1 block text-[10px] font-normal leading-4 text-gray-600">{selectedType.hint}</span>
                </label>

                <label className="text-xs font-semibold text-gray-400">
                  Applies to
                  <select value={productId} onChange={(event) => setProductId(event.target.value)} className="silhat-input mt-1">
                    <option value="">Whole portfolio</option>
                    {state.products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                  </select>
                  <span className="mt-1 block text-[10px] font-normal leading-4 text-gray-600">Product-scoped context follows that Product Cockpit.</span>
                </label>
              </div>

              <label className="block text-xs font-semibold text-gray-400">
                What should ailhat know?
                <textarea
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  className="silhat-input mt-1 min-h-32"
                  placeholder="e.g. ALVIRA is the priority this month. Optimize for first paid users before visual polish."
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold text-gray-400">
                  Source URL · optional
                  <input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} className="silhat-input mt-1" placeholder="https://…" />
                </label>
                <label className="text-xs font-semibold text-gray-400">
                  Sharing scope
                  <select value={scope} onChange={(event) => setScope(event.target.value as ContextScope)} className="silhat-input mt-1">
                    <option value="shared">Shared · eligible for ALVIRA exchange</option>
                    <option value="local">Local · ailhat only</option>
                    <option value="private">Private · do not exchange</option>
                  </select>
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-800 bg-gray-900/50 p-3">
                <label className="silhat-btn silhat-btn-ghost cursor-pointer">
                  Choose file
                  <input type="file" accept=".json,.txt,.md,text/plain,application/json" onChange={handleFile} className="sr-only" />
                </label>
                <p className="text-[11px] leading-5 text-gray-500">
                  Import shared-context JSON directly, or load text/Markdown as user-supplied evidence. File contents are reviewed before saving unless they are already valid envelopes.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={add} disabled={!content.trim()} className="silhat-btn silhat-btn-primary px-4 py-2">
                  Add context
                </button>
                <span className="text-[11px] text-gray-600">New entries are user-supplied, not verified by ailhat.</span>
              </div>

              {message && <div className="rounded-lg border border-[#7fb0ff]/20 bg-[#7fb0ff]/[0.05] px-3 py-2 text-xs leading-5 text-[#9cc8ff]">{message}</div>}

              {recent.length > 0 && (
                <section className="border-t border-gray-800 pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="silhat-eyebrow">Recent context</p>
                      <p className="mt-1 text-xs text-gray-600">{items.length} context envelope{items.length === 1 ? "" : "s"} currently available to ailhat.</p>
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    {recent.map((item) => {
                      const product = item.subjectId ? state.products.find((candidate) => candidate.id === item.subjectId) : undefined;
                      return (
                        <div key={item.contextId} className="rounded-xl border border-gray-800 bg-gray-900/40 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                <span>{labelFor(item)}</span>
                                <span>·</span><span>{product?.name ?? "Portfolio"}</span>
                                <span>·</span><span>{item.scope}</span>
                                <span>·</span><span>{item.verificationStatus}</span>
                              </div>
                              <p className="mt-1 line-clamp-3 text-sm leading-5 text-gray-300">{item.content}</p>
                            </div>
                            <button type="button" onClick={() => removeContextEnvelope(item.contextId)} className="shrink-0 text-[10px] font-semibold text-gray-600 hover:text-red-300">Remove</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
