import { describe, expect, test } from "bun:test";
import { observeVercelProject } from "./vercel-evidence";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function mockVercel(responses: Record<string, Response>): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const parsed = new URL(url);
    const key = parsed.pathname + parsed.search;
    return responses[key] ?? jsonResponse({ error: `unexpected ${key}` }, 500);
  }) as typeof fetch;
}

describe("Vercel deployment evidence adapter", () => {
  test("missing server credentials remain unavailable rather than no deployment activity", async () => {
    const result = await observeVercelProject(
      "ailhat",
      "https://ailhat.vercel.app",
      "ailhat",
      undefined,
    );
    expect(result.availability).toBe("unavailable");
    expect(result.observations).toEqual([]);
    expect(result.reason).toContain("does not have a Vercel read credential");
  });

  test("rejects a Vercel project whose production domains do not match the product", async () => {
    const fetchImpl = mockVercel({
      "/v9/projects/other/domains?production=true&limit=100": jsonResponse({
        domains: [{ name: "other.vercel.app", verified: true }],
      }),
    });
    const result = await observeVercelProject(
      "ailhat",
      "https://ailhat.vercel.app",
      "other",
      "token",
      undefined,
      fetchImpl,
    );
    expect(result.availability).toBe("unavailable");
    expect(result.reason).toContain("not mapped to this product's production hostname");
  });

  test("maps production deployments after domain ownership is validated", async () => {
    const fetchImpl = mockVercel({
      "/v9/projects/ailhat/domains?production=true&limit=100&teamId=team_1": jsonResponse({
        domains: [
          { name: "ailhat.vercel.app", verified: true, projectId: "prj_1" },
          { name: "www.ailhat.example", verified: true, projectId: "prj_1" },
        ],
      }),
      "/v7/deployments?projectId=ailhat&target=production&limit=10&teamId=team_1": jsonResponse({
        deployments: [
          {
            uid: "dpl_ready",
            name: "ailhat",
            url: "ailhat-abc.vercel.app",
            state: "READY",
            target: "production",
            created: 1000,
            ready: 2000,
            meta: { githubCommitSha: "abcdef123456", githubCommitRef: "main" },
          },
          {
            uid: "dpl_failed",
            name: "ailhat",
            state: "ERROR",
            target: "production",
            created: 1500,
          },
        ],
      }),
    });

    const result = await observeVercelProject(
      "ailhat",
      "https://ailhat.vercel.app",
      "ailhat",
      "token",
      "team_1",
      fetchImpl,
      3000,
    );

    expect(result.availability).toBe("connected");
    expect(result.deployment.productionDomains).toContain("ailhat.vercel.app");
    expect(result.observations).toHaveLength(2);
    const ready = result.observations.find((row) => row.sourceRef === "dpl_ready");
    const failed = result.observations.find((row) => row.sourceRef === "dpl_failed");
    expect(ready?.state).toBe("ready");
    expect(ready?.metadata?.commitSha).toBe("abcdef123456");
    expect(failed?.state).toBe("failed");
    expect(ready?.authoritativeFor).toEqual(["deployment_state"]);
  });

  test("Vercel auth failure remains unknown evidence", async () => {
    const fetchImpl = mockVercel({
      "/v9/projects/ailhat/domains?production=true&limit=100": jsonResponse(
        { error: "unauthorized" },
        401,
      ),
    });
    const result = await observeVercelProject(
      "ailhat",
      "https://ailhat.vercel.app",
      "ailhat",
      "bad-token",
      undefined,
      fetchImpl,
    );
    expect(result.availability).toBe("unavailable");
    expect(result.reason).toContain("authentication or scope");
    expect(result.observations).toEqual([]);
  });
});
