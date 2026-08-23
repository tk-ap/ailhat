// Client-side wrapper for the plain REST scan endpoint. SSR/hydration-safe: this
// module only imports types and performs a fetch() at call time — no browser
// globals at import. The heavy lifting (fetching the arbitrary target URL)
// happens server-side in serve.ts, where the client's browser can't (CORS).
import type { ScanResult } from "./scanSite";

export type {
  ScanResult,
  ScanFinding,
  Severity,
  Confidence,
  CheckStatus,
} from "./scanSite";
export { severityToItemType } from "./scanSite";

// Calls GET /api/scan-site?url=<url>. Resolves to the scan result, or null on a
// transport/network failure (the page shows an error rather than throwing).
export async function scanSite(url: string): Promise<ScanResult | null> {
  try {
    const res = await fetch(`/api/scan-site?url=${encodeURIComponent(url)}`);
    if (!res.ok) return null;
    return (await res.json()) as ScanResult;
  } catch {
    return null;
  }
}
