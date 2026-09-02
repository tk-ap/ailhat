import { describe, expect, test } from "bun:test";
import {
  observePublicGitHubRepository,
  parseGitHubRepositoryUrl,
} from "./github-evidence";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function mockGitHub(responses: Record<string, Response>): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const path = new URL(url).pathname + new URL(url).search;
    const response = responses[path];
    return response ?? jsonResponse({ message: `unexpected ${path}` }, 500);
  }) as typeof fetch;
}

describe("GitHub repository evidence adapter", () => {
  test("parses only canonical owner/repo GitHub URLs", () => {
    expect(parseGitHubRepositoryUrl("https://github.com/tk-ap/ailhat.git")).toEqual({
      owner: "tk-ap",
      name: "ailhat",
      url: "https://github.com/tk-ap/ailhat",
    });
    expect(parseGitHubRepositoryUrl("https://example.com/tk-ap/ailhat")).toBeNull();
    expect(parseGitHubRepositoryUrl("https://github.com/tk-ap/ailhat/issues")).toBeNull();
  });

  test("maps public commits, merged PRs, and issues into normalized evidence", async () => {
    const fetchImpl = mockGitHub({
      "/repos/tk-ap/ailhat": jsonResponse({
        html_url: "https://github.com/tk-ap/ailhat",
        default_branch: "main",
        private: false,
      }),
      "/repos/tk-ap/ailhat/commits?per_page=10": jsonResponse([
        {
          sha: "abcdef123456",
          html_url: "https://github.com/tk-ap/ailhat/commit/abcdef123456",
          commit: { message: "fix scanner\nmore", committer: { date: "2026-09-02T18:00:00Z" } },
        },
      ]),
      "/repos/tk-ap/ailhat/pulls?state=all&sort=updated&direction=desc&per_page=10": jsonResponse([
        {
          number: 40,
          title: "Fix scanner",
          html_url: "https://github.com/tk-ap/ailhat/pull/40",
          state: "closed",
          merged_at: "2026-09-02T18:01:00Z",
          updated_at: "2026-09-02T18:01:00Z",
          head: { sha: "abcdef123456" },
          base: { ref: "main" },
        },
      ]),
      "/repos/tk-ap/ailhat/issues?state=all&sort=updated&direction=desc&per_page=10": jsonResponse([
        {
          number: 37,
          title: "Clear scan queue",
          html_url: "https://github.com/tk-ap/ailhat/issues/37",
          state: "closed",
          closed_at: "2026-09-02T18:02:00Z",
          updated_at: "2026-09-02T18:02:00Z",
        },
        {
          number: 40,
          title: "PR row returned by issues API",
          state: "closed",
          pull_request: { url: "x" },
          updated_at: "2026-09-02T18:01:00Z",
        },
      ]),
    });

    const result = await observePublicGitHubRepository(
      "ailhat",
      "https://github.com/tk-ap/ailhat",
      fetchImpl,
      9999,
    );

    expect(result.availability).toBe("connected");
    expect(result.repository.defaultBranch).toBe("main");
    expect(result.observations).toHaveLength(3);
    expect(result.observations.find((row) => row.kind === "pull_request")?.state).toBe("merged");
    expect(result.observations.find((row) => row.kind === "pull_request")?.authoritativeFor).toContain("repository_merge");
    expect(result.observations.find((row) => row.kind === "issue")?.state).toBe("completed");
    expect(result.observations.find((row) => row.kind === "commit")?.summary).toContain("fix scanner");
  });

  test("private or unreadable repositories stay unavailable rather than looking inactive", async () => {
    const fetchImpl = mockGitHub({
      "/repos/tk-ap/private": jsonResponse({ message: "Not Found" }, 404),
    });
    const result = await observePublicGitHubRepository(
      "p1",
      "https://github.com/tk-ap/private",
      fetchImpl,
    );
    expect(result.availability).toBe("unavailable");
    expect(result.observations).toEqual([]);
    expect(result.reason).toContain("not publicly readable");
  });

  test("rate limiting remains unavailable/unknown evidence, not zero activity", async () => {
    const fetchImpl = mockGitHub({
      "/repos/tk-ap/ailhat": jsonResponse({ message: "rate limit" }, 403),
    });
    const result = await observePublicGitHubRepository(
      "ailhat",
      "https://github.com/tk-ap/ailhat",
      fetchImpl,
    );
    expect(result.availability).toBe("unavailable");
    expect(result.reason).toContain("rate limit");
    expect(result.observations).toHaveLength(0);
  });

  test("partial evidence feeds are disclosed while available feeds are preserved", async () => {
    const fetchImpl = mockGitHub({
      "/repos/tk-ap/ailhat": jsonResponse({ default_branch: "main", private: false }),
      "/repos/tk-ap/ailhat/commits?per_page=10": jsonResponse([]),
      "/repos/tk-ap/ailhat/pulls?state=all&sort=updated&direction=desc&per_page=10": jsonResponse({ message: "rate" }, 403),
      "/repos/tk-ap/ailhat/issues?state=all&sort=updated&direction=desc&per_page=10": jsonResponse([]),
    });
    const result = await observePublicGitHubRepository(
      "ailhat",
      "https://github.com/tk-ap/ailhat",
      fetchImpl,
    );
    expect(result.availability).toBe("connected");
    expect(result.reason).toContain("1 evidence feed");
  });
});
