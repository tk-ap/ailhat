// Name-availability checking for the product-add flow.
//
// The external checks are server-side: this module runs on the server via a
// TanStack Start server function, so it can call public, keyless endpoints and
// never expose anything browser-only at import time. The client calls
// `checkNameAvailability` on demand (button press) — it's SSR/hydration-safe.
//
// NOTE: TanStack Start's client-side server-fn seroval deserialization in this
// pinned version rejects some plain-object responses even though the HTTP call
// succeeds, so the dashboard UI calls the plain REST endpoint at
// `/api/check-availability?name=...` (served from serve.ts) instead. This
// server function is kept as the canonical typed wrapper and works at the HTTP
// level, but is not what the UI invokes.

import { createServerFn } from "@tanstack/react-start";
import { checkAvailability, type AvailabilityResult } from "./availability";

export type { AvailabilityResult, SourceResult, SourceStatus } from "./availability";

export const checkNameAvailability = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { name: string })
  .handler(async ({ data }): Promise<AvailabilityResult> => {
    return checkAvailability(data?.name ?? "");
  });
