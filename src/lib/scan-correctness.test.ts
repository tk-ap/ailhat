import { describe, expect, test } from "bun:test";
import type { ScanFinding, ScanResult } from "./scanSite";
import { correctHeuristicFindings } from "./scan-correctness";

const URL = "https://ailhat.vercel.app/";

function fail(ruleId: string, title: string): ScanFinding {
  return {
    ruleId,
    severity: "MEDIUM",
    confidence: ruleId === "a11y-heading" ? "HIGH" : "MEDIUM",
    title,
    detail: `${title} detail`,
    status: "fail",
    stableKey: ruleId,
  };
}

function scan(): ScanResult {
  return {
    url: URL,
    requestedUrl: URL,
    ok: true,
    scannedAt: 1,
    findings: [
      fail("ux-primary-cta", "No clear primary call-to-action found"),
      fail("conv-path", "No clear conversion path"),
      fail("a11y-heading", "Heading levels are skipped"),
    ],
  };
}

describe("scanner correctness", () => {
  test("reads CTA text from complete anchor/button elements", () => {
    const html = `
      <html><body>
        <h1>ailhat</h1>
        <h2>Portfolio Intelligence</h2>
        <a href="#request-access">Request access</a>
        <a href="/dashboard">Get started in your dashboard</a>
        <button aria-label="Request access"><span>Continue</span></button>
      </body></html>
    `;

    const corrected = correctHeuristicFindings(scan(), html);
    expect(corrected.findings.find((f) => f.ruleId === "ux-primary-cta")?.status).toBe("ok");
    expect(corrected.findings.find((f) => f.ruleId === "conv-path")?.status).toBe("ok");
  });

  test("checks heading levels in document order and permits subordinate headings", () => {
    const html = `
      <html><body>
        <h1>ailhat</h1>
        <section><h2>The Loop</h2><h3>Observe</h3></section>
        <section><h2>Questions</h2><h3>What is ailhat?</h3></section>
      </body></html>
    `;

    const corrected = correctHeuristicFindings(scan(), html);
    expect(corrected.findings.find((f) => f.ruleId === "a11y-heading")?.status).toBe("ok");
  });

  test("still catches a real document-order heading skip", () => {
    const html = `<html><body><h1>ailhat</h1><h3>Skipped</h3></body></html>`;
    const corrected = correctHeuristicFindings(scan(), html);
    expect(corrected.findings.find((f) => f.ruleId === "a11y-heading")?.status).toBe("fail");
  });
});
