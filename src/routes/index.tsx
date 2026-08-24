import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
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
    n: "01",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M3 12h4l2-6 4 12 2-6h6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "One view, every product",
    desc: "Continuously understand the state of all your AI-built products — across Vercel, cto.new, and madethis — in a single intelligence layer.",
  },
  {
    n: "02",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "Auto-generated checklists",
    desc: "Every product gets a live checklist of outstanding updates, bugs, and in-progress work. No spreadsheet, ever.",
  },
  {
    n: "03",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M3 17l5-5 4 4 8-8M16 8h5v5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "Signal-driven prioritization",
    desc: "ailhat surfaces what matters and tells you the highest-leverage thing to do next across your whole portfolio — automatically.",
  },
  {
    n: "04",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
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

const STATS = [
  { k: "15+", v: "hosting platforms observed" },
  { k: "Observe → Act", v: "a live intelligence pipeline, not a scan" },
  { k: "0", v: "spreadsheets, ever" },
];

// SSR/hydration-safe scroll reveal: IntersectionObserver only runs in the
// browser after mount, initial state is identical on server and client so the
// HTML never mismatches.
function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShown(true);
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out will-change-transform ${
        shown ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* A sleek "intelligence console" hero centerpiece — the product mental model
   rendered as a live control surface: ACT NOW / REVIEW / OPPORTUNITY / HEALTHY
   with severity chips, evidence + confidence. Pure markup + CSS, all brand-safe
   (cyan/blue + neutral, no purple). */
const CONSOLE_SIGNALS = [
  {
    level: "ACT NOW",
    tone: "bg-rose-500",
    text: "text-rose-300",
    chip: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
    title: "CopyCraft AI — checkout broken on mobile",
    detail: "Payment button not reachable at <320px viewport.",
    evidence: "Observed",
    confidence: "HIGH",
    conf: "bg-emerald-500/15 text-emerald-300",
  },
  {
    level: "REVIEW",
    tone: "bg-amber-500",
    text: "text-amber-300",
    chip: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
    title: "PixelDeck — OG tags missing",
    detail: "Links shared on X / Slack render without a preview.",
    evidence: "Observed",
    confidence: "MEDIUM",
    conf: "bg-sky-500/15 text-sky-300",
  },
  {
    level: "OPPORTUNITY",
    tone: "bg-emerald-500",
    text: "text-emerald-300",
    chip: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
    title: "Cross-promote CopyCraft AI & PixelDeck",
    detail: "Shared audience — one integration surfaces both.",
    evidence: "Derived",
    confidence: "MEDIUM",
    conf: "bg-sky-500/15 text-sky-300",
  },
  {
    level: "HEALTHY",
    tone: "bg-cyan-400",
    text: "text-cyan-300",
    chip: "bg-cyan-500/15 text-cyan-300 ring-cyan-500/30",
    title: "ShipFast Toolkit — all checks green",
    detail: "No open signals across 8 observed checks.",
    evidence: "Observed",
    confidence: "HIGH",
    conf: "bg-emerald-500/15 text-emerald-300",
  },
];

function IntelligenceConsole() {
  return (
    <div className="relative">
      {/* soft halo behind console */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-6 rounded-[2rem] bg-[radial-gradient(60%_60%_at_50%_40%,rgba(34,211,238,0.18),transparent_70%)] blur-2xl"
      />

      <div className="relative overflow-hidden rounded-2xl border border-gray-800 bg-gray-900/80 shadow-2xl shadow-black/60 backdrop-blur">
        {/* console header */}
        <div className="flex items-center justify-between border-b border-gray-800 bg-gray-900/90 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="ping-dot h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
            <span className="text-sm font-semibold tracking-tight">Intelligence console</span>
          </div>
          <span className="rounded-full bg-gray-800 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-gray-400">
            LIVE
          </span>
        </div>

        {/* signal list */}
        <div className="relative divide-y divide-gray-800/80">
          {/* scan sweep */}
          <div className="scanline" aria-hidden />
          {CONSOLE_SIGNALS.map((s) => (
            <div key={s.title} className="flex items-start gap-3 px-4 py-3">
              <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${s.tone}`} aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset ${s.chip}`}>
                    {s.level}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.conf}`}>
                    {s.confidence} conf
                  </span>
                  <span className="text-[10px] text-gray-500">{s.evidence}</span>
                </div>
                <p className="mt-1 text-sm font-medium leading-tight text-gray-100">{s.title}</p>
                <p className="mt-0.5 text-xs text-gray-500">{s.detail}</p>
              </div>
            </div>
          ))}
        </div>

        {/* console footer */}
        <div className="flex items-center justify-between border-t border-gray-800 bg-gray-900/90 px-4 py-2.5 text-[11px] text-gray-500">
          <span>4 signals · 3 products · top 15 platforms</span>
          <span className="font-medium text-cyan-400">prioritized →</span>
        </div>
      </div>
    </div>
  );
}

const PLATFORM_MARQUEE = [...PLATFORMS, ...PLATFORMS];

function Landing() {
  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-gray-950 text-gray-100">
      {/* ===== layered depth ===== */}
      {/* top cyan glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-48 left-1/2 h-[520px] w-[980px] -translate-x-1/2 rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,rgba(34,211,238,0.20),transparent_70%)] blur-2xl"
      />
      {/* lower blue glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-[38%] -left-40 h-[460px] w-[520px] rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,rgba(37,99,235,0.16),transparent_70%)] blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-[28%] -right-40 h-[420px] w-[520px] rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,rgba(37,99,235,0.14),transparent_70%)] blur-3xl"
      />
      {/* drifting grid */}
      <div aria-hidden className="grid-layer grid-drift pointer-events-none absolute inset-0" />
      {/* vignette */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_90%_at_50%_10%,transparent_60%,rgba(4,5,8,0.65))]"
      />
      {/* grain */}
      <div aria-hidden className="grain pointer-events-none absolute inset-0 opacity-[0.035] mix-blend-overlay" />

      {/* ===== nav ===== */}
      <header className="sticky top-0 z-30 border-b border-gray-800/60 bg-gray-950/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="silhat-brand h-9 w-9">A</div>
            <span className="text-lg font-bold tracking-tight">ailhat</span>
          </div>
          <nav className="flex items-center gap-3">
            <Link to="/brief" className="silhat-btn silhat-btn-ghost">
              Daily brief
            </Link>
            <Link to="/dashboard" className="silhat-btn silhat-btn-primary px-4 py-2">
              Open dashboard
            </Link>
            <AuthNav />
          </nav>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-6">
        {/* ===== hero ===== */}
        <section className="grid items-center gap-14 py-16 md:grid-cols-2 md:py-24">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-sm font-medium text-cyan-300">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" aria-hidden />
              For builders shipping on AI agentic harnesses
            </span>
            <h1 className="mt-6 text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              ailhat knows what you're building. It tells you{" "}
              <span className="bg-gradient-to-r from-cyan-300 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
                what matters next.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-gray-400">
              ailhat is the portfolio intelligence layer for builders shipping
              multiple AI-built products across every platform. It continuously
              understands the state of everything you've shipped, surfaces what
              matters, and directs your attention to the highest-leverage action
              — with evidence, reasoning, and a clear recommendation.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                to="/dashboard"
                className="silhat-btn silhat-btn-primary rounded-xl px-6 py-3 text-base"
              >
                Launch dashboard — it's free
              </Link>
              <span className="text-sm text-gray-500">
                No account. No install. Works in your browser.
              </span>
            </div>
          </Reveal>

          <Reveal delay={120} className="md:pl-4">
            <IntelligenceConsole />
          </Reveal>
        </section>

        {/* ===== stat / ticker strip ===== */}
        <Reveal>
          <div className="mb-24 grid gap-px overflow-hidden rounded-2xl border border-gray-800 bg-gray-800 sm:grid-cols-3">
            {STATS.map((s) => (
              <div key={s.v} className="bg-gray-900/80 px-6 py-6">
                <div className="bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent">
                  {s.k}
                </div>
                <div className="mt-1 text-sm text-gray-400">{s.v}</div>
              </div>
            ))}
          </div>
        </Reveal>

        {/* ===== features ===== */}
        <section className="relative">
          <Reveal>
            <p className="silhat-eyebrow text-cyan-400">01 · Surface</p>
            <h2 className="mt-2 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
              Everything a multi-shipping builder needs
            </h2>
            <p className="mt-3 max-w-2xl text-gray-400">
              The signals that actually deserve your attention — detected,
              explained, and ranked. Not another dashboard to babysit.
            </p>
          </Reveal>
          <div className="mt-12 grid gap-5 sm:grid-cols-2">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 80}>
                <div className="group relative h-full overflow-hidden rounded-2xl border border-gray-800 bg-gray-900/50 p-6 transition-colors hover:border-cyan-500/40">
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
                  />
                  <div className="flex items-center justify-between">
                    <div className="grid h-11 w-11 place-items-center rounded-lg border border-gray-800 bg-gray-900 text-cyan-400">
                      {f.icon}
                    </div>
                    <span className="text-xs font-semibold tracking-widest text-gray-600">
                      {f.n}
                    </span>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
                  <p className="mt-2 text-gray-400">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ===== platforms marquee ===== */}
        <section className="py-20 text-center">
          <Reveal>
            <p className="silhat-eyebrow text-cyan-400">02 · Observe</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">
              Built for the platforms you already ship on
            </h2>
          </Reveal>
          <Reveal delay={100} className="mt-10">
            <div className="marquee">
              <div className="marquee-track gap-3 pr-3">
                {PLATFORM_MARQUEE.map((p, i) => (
                  <span
                    key={`${p}-${i}`}
                    className="whitespace-nowrap rounded-full border border-gray-800 bg-gray-900/60 px-5 py-2.5 text-sm font-medium text-gray-300"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>
        </section>

        {/* ===== intent capture ===== */}
        <section className="py-16">
          <div className="grid items-start gap-12 md:grid-cols-2">
            <Reveal>
              <p className="silhat-eyebrow text-cyan-400">03 · Shape it</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                Is this you? Help us build it right.
              </h2>
              <p className="mt-4 text-gray-400">
                If you ship 5+ products across platforms, managing your
                portfolio's attention is a real job. Tell us about your setup —
                it takes 20 seconds and shapes what ailhat becomes.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-gray-400">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-cyan-400">✓</span>
                  No account or install required to sign up.
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-cyan-400">✓</span>
                  Early builders get first access to the Daily Brief.
                </li>
              </ul>
            </Reveal>
            <Reveal delay={120}>
              <div className="rounded-2xl border border-cyan-500/15 bg-[radial-gradient(120%_120%_at_100%_0%,rgba(34,211,238,0.08),transparent_50%)] bg-gray-900/60 p-1">
                <IntentForm />
              </div>
            </Reveal>
          </div>
        </section>

        {/* ===== cinematic CTA ===== */}
        <Reveal>
          <section className="relative my-20 overflow-hidden rounded-3xl border border-cyan-500/25 bg-gray-900 p-10 text-center shadow-[0_0_80px_-20px_rgba(34,211,238,0.35)] sm:p-14">
            <div
              aria-hidden
              className="pointer-events-none absolute -top-24 left-1/2 h-[300px] w-[640px] -translate-x-1/2 rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,rgba(34,211,238,0.25),transparent_70%)] blur-2xl"
            />
            <div aria-hidden className="grid-layer pointer-events-none absolute inset-0 opacity-60" />
            <div className="relative">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Stop juggling tabs.{" "}
                <span className="bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">
                  Start shipping.
                </span>
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-gray-300">
                Add your products, capture your checklist, and let ailhat surface
                what needs your attention next.
              </p>
              <Link
                to="/dashboard"
                className="silhat-btn silhat-btn-primary mt-7 rounded-xl px-8 py-3 text-base shadow-lg shadow-cyan-600/30"
              >
                Go to the dashboard
              </Link>
            </div>
          </section>
        </Reveal>

        <footer className="flex flex-col items-center gap-2 border-t border-gray-800 py-8 text-center text-sm text-gray-600 sm:flex-row sm:justify-between">
          <span>ailhat — built for builders shipping AI products everywhere.</span>
          <span className="text-gray-700">
            <Link to="/brief" className="transition-colors hover:text-cyan-400">
              Daily brief
            </Link>
            <span className="mx-2">·</span>
            <Link to="/dashboard" className="transition-colors hover:text-cyan-400">
              Dashboard
            </Link>
            <span className="mx-2">·</span>
            <Link to="/login" className="transition-colors hover:text-cyan-400">
              Log in
            </Link>
          </span>
        </footer>
      </main>
    </div>
  );
}
