// Pure name-availability checking logic. No TanStack imports — usable from a
// server function, a Bun fetch handler (serve.ts), or a standalone script.
//
// Queries public, keyless endpoints in parallel: npm (registry.npmjs.org),
// GitHub (api.github.com/users + /orgs), and domain registries via RDAP
// (rdap.org/domain/<n>.com/.io/.dev). Each source is independently
// error-guarded and short-circuits on timeout.

export type SourceStatus = "available" | "taken" | "error";

export interface SourceResult {
  source: string; // "npm", "GitHub", "ailhat.com", ...
  status: SourceStatus;
  detail?: string;
}

export interface AvailabilityResult {
  name: string;
  results: SourceResult[];
  checkedAt: number;
}

// Which TLDs to test via RDAP.
const TLDS = [".com", ".io", ".dev"];

type FetchOutcome = { status: number } | { error: true };

async function fetchStatus(url: string, ms = 12000): Promise<FetchOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    // rdap.org responds with redirects to the registry's own RDAP server, so we
    // follow redirects. A 200 means "an entity exists" (taken); 404 means free.
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "user-agent": "Ailhat-availability-check" },
    });
    return { status: res.status };
  } catch {
    return { error: true };
  } finally {
    clearTimeout(timer);
  }
}

function toResult(
  source: string,
  outcome: FetchOutcome,
  takenStatuses: number[],
): SourceResult {
  if ("error" in outcome) {
    return { source, status: "error", detail: "couldn't check" };
  }
  return takenStatuses.includes(outcome.status)
    ? { source, status: "taken" }
    : { source, status: "available" };
}

export function cleanName(raw: string): string {
  return (raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
}

export async function checkAvailability(raw: string): Promise<AvailabilityResult> {
  const name = cleanName(raw);

  if (!name) {
    return { name, results: [], checkedAt: Date.now() };
  }

  const encoded = encodeURIComponent(name);

  // Run all external checks concurrently so one slow source doesn't stall the
  // rest. Each is independently error-guarded; the whole handler is wrapped so
  // an unexpected failure surfaces as per-source "couldn't check" results
  // rather than rejecting the caller.
  try {
    const [npm, ghUser, ghOrg, com, io, dev] = await Promise.all([
      fetchStatus(`https://registry.npmjs.org/${encoded}`),
      fetchStatus(`https://api.github.com/users/${encoded}`),
      fetchStatus(`https://api.github.com/orgs/${encoded}`),
      fetchStatus(`https://rdap.org/domain/${name}.com`),
      fetchStatus(`https://rdap.org/domain/${name}.io`),
      fetchStatus(`https://rdap.org/domain/${name}.dev`),
    ]);

    // GitHub: take either the user or the org existing as "taken"; only report
    // "couldn't check" if BOTH lookups failed (e.g. rate limit / network).
    const ghOutcome: FetchOutcome =
      "error" in ghUser && "error" in ghOrg
        ? { error: true }
        : {
            status:
              ghUser.status === 200 || ghOrg.status === 200 ? 200 : 404,
          };

    const results: SourceResult[] = [
      toResult("npm", npm, [200]),
      toResult("GitHub", ghOutcome, [200]),
      toResult(`${name}.com`, com, [200]),
      toResult(`${name}.io`, io, [200]),
      toResult(`${name}.dev`, dev, [200]),
    ];

    return { name, results, checkedAt: Date.now() };
  } catch {
    const results: SourceResult[] = [
      "npm",
      "GitHub",
      `${name}.com`,
      `${name}.io`,
      `${name}.dev`,
    ].map((source) => ({
      source,
      status: "error" as const,
      detail: "couldn't check",
    }));
    return { name, results, checkedAt: Date.now() };
  }
}
