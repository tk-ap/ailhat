import {
  runScan,
  type Confidence,
  type ScanFinding,
  type ScanResult,
  type Severity,
} from "./scanSite";

const CTA_RE =
  /sign\s*up|signup|get\s+started|start\s+free|try\s+free|start\s+now|try\s+now|try\s+it|download|install|subscribe|launch|buy\b|purchase|order\s+now|join\b|create\s+(an?\s+)?account|get\s+it|add\s+to\s+(cart|app)|book\s+(a\s+)?demo|request\s+(a\s+)?demo|request\s+access|open\s+(the\s+)?dashboard|log\s*in|start\s+building|free\s+trial|pricing/i;

const CORRECTED_RULES = new Set(["a11y-heading", "ux-primary-cta", "conv-path"]);

function attr(tag: string, key: string): string | undefined {
  const re = new RegExp(
    `\\b${key}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    "i",
  );
  const m = tag.match(re);
  if (!m) return undefined;
  return (m[1] ?? m[2] ?? m[3] ?? "").trim();
}

function textOfElement(element: string): string {
  const inner = element
    .replace(/^<[^>]*>/, "")
    .replace(/<\/[^>]+>\s*$/, "");
  return inner
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#\d+;/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findElements(html: string, tagName: "a" | "button"): string[] {
  const re = new RegExp(
    `<${tagName}\\b[^>]*>[\\s\\S]*?<\\/${tagName}\\s*>`,
    "gi",
  );
  return html.match(re) ?? [];
}

function accessibleName(element: string): string {
  const opening = element.match(/^<[^>]+>/)?.[0] ?? element;
  return (
    attr(opening, "aria-label") ||
    attr(opening, "title") ||
    textOfElement(element)
  ).trim();
}

function finding(
  ruleId: string,
  severity: Severity,
  confidence: Confidence,
  status: "fail" | "ok",
  title: string,
  detail: string,
): ScanFinding {
  return {
    ruleId,
    severity,
    confidence,
    status,
    title,
    detail,
    stableKey: ruleId,
  };
}

function orderedHeadingLevels(html: string): number[] {
  const levels: number[] = [];
  const re = /<h([1-6])\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) levels.push(Number(match[1]));
  return levels;
}

function correctedHeadingFinding(html: string): ScanFinding {
  const levels = orderedHeadingLevels(html);
  const h1Count = levels.filter((level) => level === 1).length;

  if (levels.length === 0 || h1Count === 0) {
    return finding(
      "a11y-heading",
      "MEDIUM",
      "HIGH",
      "fail",
      "No single <h1> heading",
      levels.length === 0
        ? "No heading tags found on the page — no clear document structure."
        : "The page has headings but no <h1> — screen readers and SEO lack a top-level landmark.",
    );
  }

  if (h1Count > 1) {
    return finding(
      "a11y-heading",
      "MEDIUM",
      "HIGH",
      "fail",
      `Multiple <h1> headings (${h1Count})`,
      `The page uses ${h1Count} <h1> tags — use one top-level heading per page.`,
    );
  }

  let skipped = 0;
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] > levels[i - 1] + 1) skipped += 1;
  }

  return skipped > 0
    ? finding(
        "a11y-heading",
        "MEDIUM",
        "HIGH",
        "fail",
        "Heading levels are skipped",
        "Heading levels skip a step in document order (for example h1 → h3) — confusing for screen-reader navigation.",
      )
    : finding(
        "a11y-heading",
        "MEDIUM",
        "HIGH",
        "ok",
        "Heading hierarchy looks fine",
        `Found one <h1> and ${levels.length - 1} subordinate heading(s) in document order without a skipped level.`,
      );
}

function correctedCtaFindings(html: string, includeConversionPath: boolean): ScanFinding[] {
  const actionNames = [
    ...findElements(html, "button").map(accessibleName),
    ...findElements(html, "a").map(accessibleName),
  ].filter((name) => name.length > 0 && name.length <= 80 && CTA_RE.test(name));

  const unique = [...new Set(actionNames)];
  const hasCta = unique.length > 0;
  const findings: ScanFinding[] = [
    hasCta
      ? finding(
          "ux-primary-cta",
          "MEDIUM",
          "MEDIUM",
          "ok",
          "Call-to-action present",
          `Detected action language from complete interactive elements: ${unique
            .slice(0, 3)
            .map((name) => `“${name}”`)
            .join(", ")}.`,
        )
      : finding(
          "ux-primary-cta",
          "MEDIUM",
          "MEDIUM",
          "fail",
          "No clear primary call-to-action found",
          "No complete button or link element with clear action language or an accessible action name was found.",
        ),
  ];

  if (includeConversionPath) {
    findings.push(
      hasCta
        ? finding(
            "conv-path",
            "MEDIUM",
            "MEDIUM",
            "ok",
            "Conversion path present",
            `The page exposes an actionable next step: ${unique
              .slice(0, 2)
              .map((name) => `“${name}”`)
              .join(", ")}.`,
          )
        : finding(
            "conv-path",
            "MEDIUM",
            "MEDIUM",
            "fail",
            "No clear conversion path",
            "No actionable CTA was found in the complete rendered link/button elements. This is an observed page-state finding, not a claim about business conversion outside the page.",
          ),
    );
  }

  return findings;
}

export function correctHeuristicFindings(
  result: ScanResult,
  html: string,
): ScanResult {
  const includeConversionPath =
    result.findings.some((entry) => entry.ruleId === "conv-path") ||
    (() => {
      try {
        const pathname = new URL(result.url).pathname.replace(/\/+$/, "");
        return pathname === "" || pathname === "/" || pathname === "/index.html";
      } catch {
        return false;
      }
    })();

  const retained = result.findings.filter(
    (entry) => !CORRECTED_RULES.has(entry.ruleId),
  );

  return {
    ...result,
    findings: [
      ...retained,
      correctedHeadingFinding(html),
      ...correctedCtaFindings(html, includeConversionPath),
    ],
  };
}

async function fetchHtml(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "Ailhat-site-scan-correctness" },
    });
    return await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Runs the existing bounded site scanner, then corrects the heuristics that need
 * complete rendered elements/document order. If the verification fetch fails,
 * return the original scan rather than inventing a result.
 */
export async function runCorrectedScan(rawUrl: string): Promise<ScanResult> {
  const result = await runScan(rawUrl);
  if (!result.ok) return result;
  const html = await fetchHtml(result.url);
  return html === null ? result : correctHeuristicFindings(result, html);
}
