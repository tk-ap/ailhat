import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";

import OperatingLoopPortal from "~/components/OperatingLoopPortal";
import ProductWorkspaceContinuityPortal from "~/components/ProductWorkspaceContinuityPortal";
import { WhyAilhatEducation } from "~/components/WhyAilhatEducation";
import appCss from "~/styles/app.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#0B0F17" },
      { title: "ailhat · Portfolio Intelligence" },
      {
        name: "description",
        content:
          "ailhat is Portfolio Intelligence for builders shipping multiple products. Signals condensed into clarity: what changed, why it matters, and what to do next.",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "stylesheet", href: "/brand/ailhat-motion.css" },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
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
      <Outlet />
      <OperatingLoopPortal />
      <ProductWorkspaceContinuityPortal />
      <WhyAilhatEducation />
    </RootDocument>
  );
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
