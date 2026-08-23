// Client-side wrapper for the plain REST intent endpoint. SSR/hydration-safe:
// this module only performs a fetch() at call time — no browser globals at
// import. POSTs to /api/intent (served from serve.ts), same proven pattern as
// the availability/scan features.

export type IntentPayload = {
  email?: string;
  productCount: number;
  platforms: string;
  painWaitlist: boolean;
};

export type IntentResponse =
  | { ok: true; id: number; receivedAt: number }
  | { ok: false; error: string };

// Resolves to a structured response, or null on a transport/network failure
// (the UI shows an error rather than throwing).
export async function submitIntent(
  payload: IntentPayload,
): Promise<IntentResponse | null> {
  try {
    const res = await fetch("/api/intent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as Partial<IntentResponse> & {
      error?: string;
      id?: number;
    };
    if (!res.ok) {
      return { ok: false, error: data.error ?? "Something went wrong. Please try again." };
    }
    return { ok: true, id: data.id ?? 0, receivedAt: Date.now() };
  } catch {
    return null;
  }
}
