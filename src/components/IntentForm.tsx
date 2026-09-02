// Intent-capture (access request) form for the landing page. Client-side interactive
// component — SSR-safe: only React hooks (no browser globals at import), and
// network I/O happens via submitIntent() at submit time. Sits contextually on
// the landing page, below the hero, so it doesn't clutter the main CTA.

import { useState } from "react";
import { submitIntent, type IntentPayload } from "~/lib/intentClient";

const PLATFORM_OPTIONS = ["Vercel", "cto.new", "madethis", "Other"];

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "success" }
  | { kind: "error"; message: string };

export default function IntentForm() {
  const [productCount, setProductCount] = useState<number>(3);
  const [platforms, setPlatforms] = useState<string[]>(["Vercel"]);
  const [otherPlatform, setOtherPlatform] = useState("");
  const [email, setEmail] = useState("");
  const [painWaitlist, setPainWaitlist] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  function togglePlatform(p: string) {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const resolvedPlatforms = platforms.includes("Other")
      ? [...platforms.filter((p) => p !== "Other"), otherPlatform.trim() || "Other"]
      : platforms;
    if (resolvedPlatforms.length === 0) {
      setStatus({ kind: "error", message: "Select at least one platform." });
      return;
    }
    const payload: IntentPayload = {
      email: email || undefined,
      productCount,
      platforms: resolvedPlatforms.join(", "),
      painWaitlist,
    };
    setStatus({ kind: "saving" });
    const res = await submitIntent(payload);
    if (res === null) {
      setStatus({
        kind: "error",
        message: "We couldn't reach the server. Please try again in a moment.",
      });
    } else if (res.ok) {
      setStatus({ kind: "success" });
    } else {
      setStatus({ kind: "error", message: res.error });
    }
  }

  if (status.kind === "success") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center dark:border-emerald-800 dark:bg-emerald-950/40">
        <div className="text-3xl" aria-hidden>✓</div>
        <h3 className="mt-2 text-xl font-bold text-emerald-800 dark:text-emerald-300">
          Request received
        </h3>
        <p className="mt-2 text-emerald-700 dark:text-emerald-400">
          We'll be in touch as access expands. Thanks for helping shape ailhat.
        </p>
      </div>
    );
  }

  const inputCls =
    "w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100";

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-5 rounded-2xl border border-gray-200 bg-white p-6 text-left shadow-lg dark:border-gray-800 dark:bg-gray-900"
    >
      <div>
        <h3 className="text-lg font-semibold">Request ailhat access</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Tell us what you're shipping so we can route you into the right portfolio-intelligence experience. No spam.
        </p>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Already have access?{" "}
          <a href="/dashboard" className="font-semibold text-[#7fb0ff] hover:underline">
            Get started in your dashboard
          </a>
          .
        </p>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">
          How many products are you running?
        </span>
        <select
          aria-label="Number of products"
          value={productCount}
          onChange={(e) => setProductCount(Number(e.target.value))}
          className={inputCls}
        >
          <option value={1}>1</option>
          <option value={2}>2</option>
          <option value={3}>3</option>
          <option value={4}>4</option>
          <option value={5}>5</option>
          <option value={6}>6</option>
          <option value={7}>7+</option>
        </select>
      </label>

      <fieldset>
        <legend className="mb-1.5 block text-sm font-medium">
          Which platforms do you ship on?
        </legend>
        <div className="flex flex-wrap gap-2">
          {PLATFORM_OPTIONS.map((p) => {
            const active = platforms.includes(p);
            return (
              <button
                type="button"
                key={p}
                onClick={() => togglePlatform(p)}
                aria-label={p}
                aria-pressed={active}
                className={
                  "rounded-full border px-3.5 py-1.5 text-sm font-medium transition " +
                  (active
                    ? "border-cyan-600 bg-cyan-600 text-white"
                    : "border-gray-300 text-gray-700 hover:border-cyan-300 hover:bg-cyan-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-cyan-950")
                }
              >
                {p}
              </button>
            );
          })}
        </div>
        {platforms.includes("Other") && (
          <input
            aria-label="Other platform"
            value={otherPlatform}
            onChange={(e) => setOtherPlatform(e.target.value)}
            placeholder="Which other platform(s)?"
            className={inputCls + " mt-2"}
          />
        )}
      </fieldset>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">
          Email <span className="text-gray-400">(optional)</span>
        </span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className={inputCls}
        />
      </label>

      <label className="flex items-start gap-3 text-sm">
        <input
          aria-label="Keeping track of my products is a pain point"
          type="checkbox"
          checked={painWaitlist}
          onChange={(e) => setPainWaitlist(e.target.checked)}
          className="mt-0.5 h-4 w-4"
        />
        <span className="text-gray-600 dark:text-gray-400">
          Keeping track of all my products is a genuine pain point for me.
        </span>
      </label>

      {status.kind === "error" && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {status.message}
        </p>
      )}

      <button
        aria-label="Request access"
        type="submit"
        disabled={status.kind === "saving"}
        className="rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status.kind === "saving" ? "Sending…" : "Request access"}
      </button>
    </form>
  );
}
