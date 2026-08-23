import { createFileRoute, Link } from "@tanstack/react-router";
import IntentForm from "~/components/IntentForm";
import { AuthProvider } from "~/lib/useAuth";
import AuthNav from "~/components/AuthNav";

export const Route = createFileRoute("/")({
  component: () => (
    <AuthProvider>
      <Landing />
    </AuthProvider>
  ),
});

const FEATURES = [
  {
    title: "One view, every product",
    desc: "Continuously understand the state of all your AI-built products — across Vercel, cto.new, and madethis — in a single intelligence layer.",
  },
  {
    title: "Auto-generated checklists",
    desc: "Every product gets a live checklist of outstanding updates, bugs, and in-progress work. No spreadsheet, ever.",
  },
  {
    title: "Signal-driven prioritization",
    desc: "ailhat surfaces what matters and tells you the highest-leverage thing to do next across your whole portfolio — automatically.",
  },
  {
    title: "Manual capture",
    desc: "Drop in issues, features, and bugs by hand whenever they come up. Keep everything in one place.",
  },
];

const PLATFORMS = [
  "Vercel",
  "cto.new",
  "madethis",
  "Netlify",
  "Cloudflare Pages",
  "GitHub Pages",
  "Railway",
  "Render",
  "Fly.io",
  "Replit",
  "Glitch",
  "Heroku",
  "DigitalOcean",
  "Supabase",
  "Other",
];

function Landing() {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-gray-950 text-gray-100">
      {/* Ambient command-center glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,rgba(34,211,238,0.16),transparent_70%)] blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]"
      />

      {/* Nav */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <div className="silhat-brand h-9 w-9">A</div>
          <span className="text-lg font-bold tracking-tight">ailhat</span>
            </div>
        <nav className="flex items-center gap-3">
          <Link
            to="/brief"
            className="silhat-btn silhat-btn-ghost"
          >
            Daily brief
          </Link>
          <Link
            to="/dashboard"
            className="silhat-btn silhat-btn-primary px-4 py-2"
          >
            Open dashboard
          </Link>
          <AuthNav />
        </nav>
      </header>

      {/* Hero */}
      <main className="relative z-10 mx-auto max-w-6xl px-6">
        <section className="grid items-center gap-10 py-16 md:grid-cols-2 md:py-24">
          <div>
            <span className="inline-block rounded-full bg-cyan-100 px-3 py-1 text-sm font-medium text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300">
              For builders shipping on AI agentic harnesses
            </span>
            <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              ailhat knows what you're building. It tells you what matters next.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-gray-600 dark:text-gray-400">
              ailhat is the portfolio intelligence layer for builders shipping
              multiple AI-built products across every platform. It continuously
              understands the state of everything you've shipped, surfaces what
              matters, and directs your attention to the highest-leverage action
              — with evidence, reasoning, and a clear recommendation.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                to="/dashboard"
                className="rounded-xl bg-cyan-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-cyan-600/25 transition hover:bg-cyan-500"
              >
                Launch dashboard — it's free
              </Link>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                No account. No install. Works in your browser.
              </span>
            </div>
          </div>

          {/* Product-card mock */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold">Your portfolio</h3>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                3 products
              </span>
            </div>
            {[
              { n: "ShipFast Toolkit", p: "Vercel", c: "2 open" },
              { n: "CopyCraft AI", p: "cto.new", c: "2 open" },
              { n: "PixelDeck", p: "madethis", c: "3 open" },
            ].map((row) => (
              <div
                key={row.n}
                className="mb-3 flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-800/50"
              >
                <div>
                  <div className="text-sm font-medium">{row.n}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {row.p}
                  </div>
                </div>
                <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-xs font-medium text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300">
                  {row.c}
                </span>
              </div>
            ))}
            <div className="mt-4 rounded-xl bg-cyan-50 p-4 text-sm text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300">
              ✨ Smart flag: <strong>Cross-promote CopyCraft AI &amp; PixelDeck</strong> —
              share one audience.
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-16">
          <h2 className="text-center text-3xl font-bold tracking-tight">
            Everything a multi-shipping builder needs
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-gray-200 p-6 dark:border-gray-800"
              >
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-gray-600 dark:text-gray-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Platforms */}
        <section className="py-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Built for the platforms you already ship on
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            {PLATFORMS.map((p) => (
              <span
                key={p}
                className="rounded-full border border-gray-200 px-4 py-2 text-sm font-medium dark:border-gray-800"
              >
                {p}
              </span>
            ))}
          </div>
        </section>

        {/* Intent capture — waitlist / builder intent */}
        <section className="py-16">
          <div className="grid items-start gap-10 md:grid-cols-2">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">
                Is this you? Help us build it right.
              </h2>
              <p className="mt-4 text-gray-600 dark:text-gray-400">
                If you ship 5+ products across platforms, managing your
                portfolio's attention is a real job. Tell us about your setup —
                it takes 20 seconds and shapes what ailhat becomes.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-gray-600 dark:text-gray-400">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-cyan-600 dark:text-cyan-400">✓</span>
                  No account or install required to sign up.
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-cyan-600 dark:text-cyan-400">✓</span>
                  Early builders get first access to the Daily Brief.
                </li>
              </ul>
            </div>
            <IntentForm />
          </div>
        </section>

        {/* CTA */}
        <section className="my-16 rounded-3xl bg-cyan-600 p-10 text-center text-white">
          <h2 className="text-3xl font-bold tracking-tight">
            Stop juggling tabs. Start shipping.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-cyan-100">
            Add your products, capture your checklist, and let ailhat surface
            what needs your attention next.
          </p>
          <Link
            to="/dashboard"
            className="mt-6 inline-block rounded-xl bg-white px-8 py-3 text-base font-semibold text-cyan-700 shadow-lg transition hover:bg-cyan-50"
          >
            Go to the dashboard
          </Link>
        </section>

        <footer className="border-t border-gray-200 py-8 text-center text-sm text-gray-400 dark:border-gray-800 dark:text-gray-600">
          ailhat — built for builders shipping AI products everywhere.
        </footer>
      </main>
    </div>
  );
}
