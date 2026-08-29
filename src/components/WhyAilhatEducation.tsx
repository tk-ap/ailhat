import { useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const EXAMPLES = [
  {
    label: "Solo builder",
    thought: "I have several products and I keep bouncing between them.",
    help: "ailhat shows which product needs attention now, what changed, and why it matters.",
  },
  {
    label: "Founder",
    thought: "I don't want the loudest problem to automatically become the priority.",
    help: "ailhat compares signals across the portfolio so you can focus on the highest-leverage next move.",
  },
  {
    label: "Small studio / team",
    thought: "We're shipping quickly and losing track of what is healthy, blocked, risky, or ready to grow.",
    help: "ailhat gives the portfolio one shared attention layer instead of another spreadsheet to maintain.",
  },
  {
    label: "New to AI product building",
    thought: "I can build things with AI, but I don't always know what I should be checking after they go live.",
    help: "ailhat turns product signals into plain recommendations so you know what deserves a closer look.",
  },
] as const;

export function WhyAilhatEducation() {
  const location = useLocation();
  const [mount, setMount] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (location.pathname !== "/") {
      setMount(null);
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const main = document.querySelector<HTMLElement>("main#top");
      const hero = main?.querySelector<HTMLElement>(":scope > section");
      if (!main || !hero) return;

      let host = document.getElementById("why-ailhat-education-mount");
      if (!host) {
        host = document.createElement("div");
        host.id = "why-ailhat-education-mount";
        hero.insertAdjacentElement("afterend", host);
      }
      setMount(host);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [location.pathname]);

  if (!mount || location.pathname !== "/") return null;

  return createPortal(
    <section className="border-y border-white/10 py-20 md:py-24" aria-labelledby="why-ailhat-heading">
      <div className="grid gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
        <div>
          <span className="l-eyebrow">Why ailhat for me?</span>
          <h2 id="why-ailhat-heading" className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            You built the products. ailhat helps you know where to look next.
          </h2>
          <p className="mt-5 max-w-xl font-code text-sm leading-7 text-white/60">
            If you have more than one product, the hard part is not just building. It is remembering what is live, what changed, what is broken, what can wait, and what deserves your time today.
          </p>
          <div className="mt-7 border-l border-accent/60 pl-5">
            <p className="font-display text-xl font-semibold text-white">Simply put:</p>
            <p className="mt-2 font-code text-sm leading-7 text-white/65">
              ailhat watches the products you care about and helps answer one question: <span className="text-accent">what should I pay attention to next, and why?</span>
            </p>
          </div>
        </div>

        <div className="grid gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 sm:grid-cols-2">
          {EXAMPLES.map((example) => (
            <article key={example.label} className="bg-[#0d0d0f] p-6">
              <p className="font-code text-[10px] uppercase tracking-widest text-accent">{example.label}</p>
              <p className="mt-4 font-display text-lg font-semibold text-white">“{example.thought}”</p>
              <p className="mt-3 font-code text-sm leading-6 text-white/55">{example.help}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="mt-12 grid gap-6 rounded-lg border border-white/10 bg-[#0d0d0f] p-6 md:grid-cols-2 md:p-8">
        <div>
          <p className="font-code text-[10px] uppercase tracking-widest text-white/35">Without ailhat</p>
          <p className="mt-3 font-display text-xl font-semibold text-white">You open products one by one, chase whatever looks urgent, and try to remember what changed.</p>
        </div>
        <div className="border-t border-accent/40 pt-6 md:border-l md:border-t-0 md:pl-8 md:pt-0">
          <p className="font-code text-[10px] uppercase tracking-widest text-accent">With ailhat</p>
          <p className="mt-3 font-display text-xl font-semibold text-white">You start with a ranked view of what needs attention and the evidence behind it.</p>
        </div>
      </div>
    </section>,
    mount,
  );
}
