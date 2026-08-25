// Server function the Agent Control route uses to load the ranked portfolio
// merged with live availability observations. Runs server-side under
// `bun run publish` (SSR) — fetch/storage only happens server-side.
//
// Returns plain serializable data: the modeled+ranked portfolio (with live
// overlay + provenance attached per product) and the shared cto.new Builder
// bucket observation, plus the raw observation list for provenance display.

import { createServerFn } from "@tanstack/react-start";
import { readObservations } from "./observations.server";
import { buildOverlays } from "./observations";
import type { AvailabilityObservation, LiveOverlay } from "./observations";
import { modelPortfolio, modelWorkspace } from "./control-scoring";
import type { ModeledWorkspace } from "./control-scoring";
import { seedPortfolio } from "./agent-control";

export interface ControlPayload {
  observations: AvailabilityObservation[];
  bucket: LiveOverlay | null;
  portfolio: ModeledWorkspace[];
  modeledAt: number;
}

export const getAgentControl = createServerFn({ method: "GET" }).handler(
  async (): Promise<ControlPayload> => {
    const observations = readObservations();
    const now = Date.now();
    const { byWorkspace, bucket } = buildOverlays(observations, now);
    const portfolio = modelPortfolio(now).map((m) => {
      // Keep the model's "rescan now" behaviour simple: model the current
      // evidence age, only merging the live observation overlay on top.
      return {
        ...modelWorkspace(
          seedPortfolio.find((w) => w.id === m.ws.id) ?? m.ws,
          now,
        ),
        live: byWorkspace.get(m.ws.id) ?? null,
      } as ModeledWorkspace;
    });
    return { observations, bucket, portfolio, modeledAt: now };
  },
);
