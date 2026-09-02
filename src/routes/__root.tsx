import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import OperatingLoopPortal from "~/components/OperatingLoopPortal";
import ProductWorkspaceContinuityPortal from "~/components/ProductWorkspaceContinuityPortal";
import { WhyAilhatEducation } from "~/components/WhyAilhatEducation";
import appCss from "~/styles/app.css?url";

const SITE_URL = "https://ailhat.vercel.app";
const SITE_TITLE = "ailhat · Portfolio Intelligence";
const SITE_DESCRIPTION =
  "ailhat is Portfolio Intelligence for builders shipping multiple products. Signals condensed into clarity: what changed, why it matters, and what to do next.";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#0B0F17" },
      { title: SITE_TITLE },
      { name: "description", content: SITE_DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "ailhat" },
      { property: "og:title", content: SITE_TITLE },
      { property: "og:description", content: SITE_DESCRIPTION },
      { property: "og:url", content: SITE_URL },
      { property: "og:image", content: `${SITE_URL}/og-image.svg` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: SITE_TITLE },
      { name: "twitter:description", content: SITE_DESCRIPTION },
      { name: "twitter:image", content: `${SITE_URL}/og-image.svg` },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "stylesheet", href: "/brand/ailhat-motion.css" },
      { rel: "stylesheet", href: "/brand/landing-brand.css" },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "canonical", href: SITE_URL },
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  notFoundComponent: () => <div>Page not found</div>,
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <StaleChunkRecovery />
      <Outlet />
      <OperatingLoopPortal />
      <ProductWorkspaceContinuityPortal />
      <WhyAilhatEducation />
    </RootDocument>
  );
}

function StaleChunkRecovery() {
  useEffect(() => {
    const storageKey = "ailhat:stale-chunk-reload-at";

    const looksLikeStaleChunk = (value: unknown) => {
      const text = String(value ?? "");
      return (
        /Failed to fetch dynamically imported module/i.test(text) ||
        /Importing a module script failed/i.test(text) ||
        /error loading dynamically imported module/i.test(text) ||
        /Loading chunk .* failed/i.test(text) ||
        /\/assets\/[^\s]+\.js/i.test(text)
      );
    };

    const recover = () => {
      const now = Date.now();
      const lastReload = Number(sessionStorage.getItem(storageKey) ?? "0");
      if (Number.isFinite(lastReload) && now - lastReload < 15_000) return;

      sessionStorage.setItem(storageKey, String(now));
      window.location.reload();
    };

    const onError = (event: ErrorEvent) => {
      if (looksLikeStaleChunk(`${event.message} ${event.filename}`)) recover();
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = reason instanceof Error ? `${reason.name} ${reason.message}` : reason;
      if (looksLikeStaleChunk(message)) recover();
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
