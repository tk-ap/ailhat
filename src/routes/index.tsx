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

/* ---------------------------------------------------------------------------
   Ledgato skin (owner-directed). Borrows the "authorization control plane"
   visual language for AILHAT's landing: near-black canvas (#0a0a0a), white /
   60%-white text, the signature light-blue accent #7fb0ff, Space Grotesk
   display headings, JetBrains Mono body/terminal, uppercase eyebrows, a LIVE
   status pill, numbered loop steps, CLI blocks with status chips (✓ OBSERVED /
   ✕ BROKEN / ▲ OPPORTUNITY), skeptic Q&A, and a repeated footer mantra.
   Content stays ailhat's: portfolio intelligence for AI builders.
   No purple/violet anywhere. SSR/hydration-safe (Reveal runs in useEffect).
--------------------------------------------------------------------------- */

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

const FEATURES = [
  {
    title: "One view, every product",
    desc: "Bring the products you ship across Vercel, cto.new, madethis, and other hosts into one portfolio-intelligence layer.",
  },
  {
    title: "Evidence-backed attention",
    desc: "Saved product URLs can be observed and rescanned so findings stay tied to evidence instead of becoming an ungrounded task list.",
  },
  {
    title: "Signal-driven prioritization",
    desc: "ailhat surfaces what matters and tells you the highest-leverage thing to do next across your portfolio — with confidence and reasoning.",
  },
  {
    title: "Manual capture",
    desc: "Drop in issues, features, and bugs by hand whenever they come up. Keep product context and observed evidence together.",
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

const PLATFORM_MARQUEE = [...PLATFORMS, ...PLATFORMS];

const STATS = [
  { k: "15+", v: "platform labels supported" },
  { k: "Observe → Act", v: "evidence before recommendation" },
  { k: "1", v: "portfolio view across products" },
];

const LOOP = [
  {
    n: "01",
    t: "Add",
    d: "Add the products and public URLs you want ailhat to understand. Connected-source automation can enrich that evidence as integrations become available.",
  },
  {
    n: "02",
    t: "Observe",
    d: "ailhat can scan saved public product URLs and retain observation history so a finding has evidence behind it.",
  },
  {
    n: "03",
    t: "Classify",
    d: "Raw signals are normalized into bugs, risks, opportunities, and market gaps — each tagged with severity and confidence.",
  },
  {
    n: "04",
    t: "Prioritize",
    d: "Signals are ranked by impact so the highest-leverage work can surface without turning every observation into a task.",
  },
  {
    n: "05",
    t: "Recommend",
    d: "Every finding explains why it matters — with evidence, reasoning, and a clear next action.",
  },
  {
    n: "06",
    t: "Act",
    d: "Act, defer, dismiss, or investigate. When execution happens, the evidence should be observed again before the work is treated as resolved.",
  },
];

const CHIP = {
  observed: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  broken: "border-rose-500/40 bg-rose-500/10 text-rose-400",
  opportunity: "border-amber-500/45 bg-amber-500/10 text-amber-400",
  healthy: "border-accent/40 bg-accent/10 text-accent",
  actnow: "border-rose-500/45 bg-rose-500/12 text-rose-300",
  review: "border-amber-500/45 bg-amber-500/12 text-amber-300",
};

const SCAN_LINES = [
  {
    name: "copycraft-ai",
    path: "checkout-mobile",
    status: "✕ BROKEN",
    statusCls: CHIP.broken,
    level: "ACT NOW",
    levelCls: CHIP.actnow,
  },
  {
    name: "pixeldeck",
    path: "og-tags-missing",
    status: "✓ OBSERVED",
    statusCls: CHIP.observed,
    level: "REVIEW",
    levelCls: CHIP.review,
  },
  {
    name: "shipfast-toolkit",
    path: "all-checks-green",
    status: "✓ HEALTHY",
    statusCls: CHIP.observed,
    level: "HEALTHY",
    levelCls: CHIP.healthy,
  },
  {
    name: "launchpad",
    path: "rate-limit-403",
    status: "▲ OPPORTUNITY",
    statusCls: CHIP.opportunity,
    level: "GROW",
    levelCls: CHIP.opportunity,
  },
];

const FAQ = [
  {
    q: "Is this another analytics dashboard?",
    a: "No. ailhat tells you what deserves your attention across your whole portfolio. It's intelligence, not charts — findings carry evidence, reasoning, and a recommendation.",
  },
  {
    q: "Is ailhat an AI chatbot?",
    a: "No. ailhat surfaces signals with a confidence level and helps you decide what deserves action. The product is portfolio intelligence, not conversation.",
  },
  {
    q: "Do I have to keep it updated?",
    a: "ailhat can rescan saved public product URLs and retain what changed. Broader connected-source automation will expand as integrations become available; the site does not pretend an unavailable connection is already live.",
  },
  {
    q: "Will it work with my platform?",
    a: "ailhat is designed for portfolios spread across hosts such as Vercel, cto.new, madethis, Netlify, and others. Public URL observation works independently of a deep platform integration.",
  },
];

function Chip({ label, cls }: { label: string; cls: string }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-sm border px-1.5 py-px font-code text-[10px] font-semibold uppercase tracking-wider ${cls}`}
    >
      {label}
    </span>
  );
}

function Terminal({
  title,
  cmd,
  children,
}: {
  title: string;
  cmd?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#0d0d0f] shadow-2xl shadow-black/60">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <div className="flex items-center gap-1.5" aria-hidden>
          <span className="h-2 w-2 rounded-full bg-white/20" />
          <span className="h-2 w-2 rounded-full bg-white/20" />
          <span className="h-2 w-2 rounded-full bg-white/20" />
        </div>
        <span className="font-code text-[11px] uppercase tracking-widest text-white/35">
          {title}
        </span>
      </div>
      <div className="px-4 py-3 font-code text-xs leading-relaxed">
        {cmd && (
          <div className="mb-2 text-accent">
            <span className="text-white/30">$</span> {cmd}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

function ScanTerminal() {
  return (
    <Terminal title="example · portfolio observation" cmd="ailhat scan --portfolio">
      {SCAN_LINES.map((l) => (
        <div
          key={l.name}
          className="flex items-center justify-between gap-3 py-1"
        >
          <div className="min-w-0">
            <span className="text-white/40">./</span>
            <span className="text-white/85">{l.name}</span>
            <span className="text-white/30"> :: </span>
            <span className="text-white/60">{l.path}</span>
          </div>
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <Chip label={l.status} cls={l.statusCls} />
            <Chip label={l.level} cls={l.levelCls} />
          </div>
        </div>
      ))}
      <div className="mt-2 flex items-center gap-2 border-t border-white/10 pt-2">
        <Chip label="✓ OBSERVED" cls={CHIP.observed} />
        <Chip label="✕ BROKEN" cls={CHIP.broken} />
        <Chip label="▲ OPPORTUNITY" cls={CHIP.opportunity} />
        <span className="text-white/35">— example attention, ranked</span>
      </div>
    </Terminal>
  );
}

function Landing() {
  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-[#0a0a0a] text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-48 left-1/2 h-[520px] w-[980px] -translate-x-1/2 rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,rgba(127,176,255,0.12),transparent_70%)] blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-[36%] -left-40 h-[460px] w-[520px] rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,rgba(127,176,255,0.08),transparent_70%)] blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-[30%] -right-40 h-[420px] w-[520px] rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,rgba(127,176,255,0.07),transparent_70%)] blur-3xl"
      />
      <div aria-hidden className="grid-layer pointer-events-none absolute inset-0 opacity-70" />
      <div aria-hidden className="grain pointer-events-none absolute inset-0 opacity-[0.03] mix-blend-overlay" />

      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0a0a0a]/75 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <a href="#top" className="flex items-center gap-2.5" aria-label="ailhat home">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-accent font-display text-sm font-bold text-[#0a0a0a]">
              A
            </div>
            <span className="font-display text-lg font-semibold tracking-tight">
              ailhat
            </span>
          </a>
          <nav className="flex items-center gap-3" aria-label="Primary navigation">
            <Link to="/brief" className="silhat-btn silhat-btn-ghost">
              Daily brief
            </Link>
            <a href="#request-access" className="silhat-btn silhat-btn-primary px-4 py-2">
              Request access
            </a>
            <AuthNav />
          </nav>
        </div>
      </header>

      <main id="top" className="relative z-10 mx-auto max-w-6xl px-6">
        <section className="py-20 text-center md:py-28">
          <Reveal>
            <div className="flex flex-col items-center gap-5">
              <span className="l-status">
                <span className="ping-dot ping-dot--blue h-2 w-2 rounded-full bg-accent" aria-hidden />
                Portfolio signal preview
              </span>
              <span className="l-eyebrow">Portfolio Intelligence Layer</span>
            </div>
            <h1 className="mx-auto mt-8 max-w-4xl font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              ailhat knows what you're building. It tells you{" "}
              <span className="text-accent">what matters next.</span>
            </h1>
            <p className="mx-auto mt-8 max-w-2xl font-code text-base leading-relaxed text-[#7fb0ff]/80">
              ailhat is the portfolio intelligence layer for builders shipping
              multiple AI-built products across platforms. It brings product
              context and observed evidence together, surfaces what matters, and
              helps direct attention to the highest-leverage next action.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <a
                href="#request-access"
                className="inline-flex items-center gap-1.5 rounded-md bg-accent px-6 py-3 font-display text-sm font-semibold text-[#0a0a0a] transition hover:bg-[#8fc0ff]"
              >
                Request access →
              </a>
              <a
                href="#loop"
                className="inline-flex items-center gap-1.5 rounded-md border border-white/20 px-6 py-3 font-code text-sm text-white/70 transition hover:border-white/40 hover:text-white"
              >
                See how it works
              </a>
            </div>
            <p className="mt-5 font-code text-xs text-white/40">
              Request access in your browser. Existing users can log in to open their saved portfolio.
            </p>
          </Reveal>

          <Reveal delay={140} className="mx-auto mt-16 max-w-3xl">
            <ScanTerminal />
          </Reveal>
        </section>

        <Reveal>
          <div className="grid gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 sm:grid-cols-3">
            {STATS.map((s) => (
              <div key={s.v} className="bg-[#0d0d0f] px-6 py-6 text-center">
                <div className="font-display text-3xl font-bold tracking-tight text-accent">
                  {s.k}
                </div>
                <div className="mt-1 font-code text-xs text-white/50">{s.v}</div>
              </div>
            ))}
          </div>
        </Reveal>

        <section id="loop" className="py-24">
          <Reveal className="text-center">
            <span className="l-eyebrow">The Loop</span>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Six moves between your portfolio and the right next step.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl font-code text-sm text-white/50">
              Add → Observe → Classify → Prioritize → Recommend → Act. ailhat
              should show what deserves attention without pretending every
              observed condition is already verified or executable.
            </p>
          </Reveal>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {LOOP.map((step, i) => (
              <Reveal key={step.n} delay={i * 70}>
                <div className="group h-full rounded-lg border border-white/10 bg-[#0d0d0f] p-6 transition-colors hover:border-accent/40">
                  <div className="flex items-baseline justify-between">
                    <span className="font-code text-sm font-semibold text-accent">
                      {step.n}
                    </span>
                    <span className="font-code text-xs uppercase tracking-widest text-white/30">
                      {step.t}
                    </span>
                  </div>
                  <h3 className="mt-3 font-display text-lg font-semibold">
                    {step.t}
                  </h3>
                  <p className="mt-2 font-code text-sm leading-relaxed text-white/55">
                    {step.d}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="border-t border-white/10 py-24">
          <Reveal>
            <span className="l-eyebrow">Surface</span>
            <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Everything a multi-shipping builder needs
            </h2>
            <p className="mt-3 max-w-2xl font-code text-sm text-white/50">
              The signals that actually deserve your attention — observed,
              explained, and ranked. Not another dashboard to babysit.
            </p>
          </Reveal>
          <div className="mt-12 grid gap-5 sm:grid-cols-2">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 80}>
                <div className="group relative h-full rounded-lg border border-white/10 bg-[#0d0d0f] p-6 transition-colors hover:border-accent/40">
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
                  />
                  <h3 className="font-display text-lg font-semibold">
                    {f.title}
                  </h3>
                  <p className="mt-2 font-code text-sm leading-relaxed text-white/55">
                    {f.desc}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>

          <div className="pt-20 text-center">
            <Reveal>
              <span className="l-eyebrow">Across Hosts</span>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">
                Built for products you ship across platforms
              </h2>
            </Reveal>
            <Reveal delay={100} className="mt-10">
              <div className="marquee">
                <div className="marquee-track gap-3 pr-3">
                  {PLATFORM_MARQUEE.map((p, i) => (
                    <span
                      key={`${p}-${i}`}
                      className="whitespace-nowrap rounded-full border border-white/12 bg-white/[0.03] px-5 py-2.5 font-code text-sm text-white/60"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="border-t border-white/10 py-24">
          <Reveal>
            <span className="l-eyebrow">Questions, Answered</span>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Questions, answered.
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {FAQ.map((f) => (
              <Reveal key={f.q}>
                <div className="h-full rounded-lg border border-white/10 bg-[#0d0d0f] p-6">
                  <h3 className="font-display text-lg font-semibold text-accent">
                    {f.q}
                  </h3>
                  <p className="mt-2 font-code text-sm leading-relaxed text-white/55">
                    {f.a}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <section id="request-access" className="scroll-mt-24 border-t border-white/10 py-24">
          <div className="grid items-start gap-12 md:grid-cols-2">
            <Reveal>
              <span className="l-eyebrow">Request Access</span>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                Put your portfolio behind a signal.
              </h2>
              <p className="mt-4 font-code text-sm leading-relaxed text-white/55">
                ailhat is opening access deliberately while the portfolio-intelligence
                loop matures. Tell us what you're shipping and where; that gives
                us a real next step without pretending public self-serve access is
                already available to everyone.
              </p>
              <ul className="mt-6 space-y-3 font-code text-sm text-white/50">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-accent" aria-hidden>✓</span>
                  No install required to request access.
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-accent" aria-hidden>✓</span>
                  Existing users can log in and continue from saved portfolio context.
                </li>
              </ul>
            </Reveal>
            <Reveal delay={120}>
              <div className="rounded-lg border border-accent/20 bg-[radial-gradient(120%_120%_at_100%_0%,rgba(127,176,255,0.08),transparent_50%)] bg-[#0d0d0f] p-1">
                <IntentForm />
              </div>
            </Reveal>
          </div>
        </section>

        <Reveal>
          <section className="relative my-20 overflow-hidden rounded-xl border border-accent/25 bg-[#0d0d0f] p-10 text-center sm:p-14">
            <div
              aria-hidden
              className="pointer-events-none absolute -top-24 left-1/2 h-[300px] w-[640px] -translate-x-1/2 rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,rgba(127,176,255,0.18),transparent_70%)] blur-2xl"
            />
            <div className="relative">
              <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
                Stop juggling product context.{" "}
                <span className="text-accent">Know what matters next.</span>
              </h2>
              <p className="mx-auto mt-3 max-w-xl font-code text-sm text-white/60">
                Request access now. If you already have an ailhat account, log in
                and continue from your saved portfolio.
              </p>
              <a
                href="#request-access"
                className="mt-7 inline-flex items-center gap-1.5 rounded-md bg-accent px-8 py-3 font-display text-sm font-semibold text-[#0a0a0a] transition hover:bg-[#8fc0ff] shadow-lg shadow-accent/20"
              >
                Request access
              </a>
            </div>
          </section>
        </Reveal>
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-6 py-8 text-center sm:flex-row sm:justify-between">
          <span className="font-code text-xs text-white/40">
            ailhat — Portfolio Intelligence for builders shipping across products and platforms.
          </span>
          <span className="flex items-center gap-4 font-code text-xs text-white/45">
            <Link to="/brief" className="transition-colors hover:text-accent">
              Daily brief
            </Link>
            <Link to="/dashboard" className="transition-colors hover:text-accent">
              Dashboard
            </Link>
            <Link to="/login" className="transition-colors hover:text-accent">
              Log in
            </Link>
          </span>
        </div>
        <p className="pb-8 text-center font-code text-[10px] uppercase tracking-[0.22em] text-white/25">
          © 2026 ailhat.
        </p>
      </footer>
    </div>
  );
}
