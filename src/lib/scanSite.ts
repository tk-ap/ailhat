// Step A "Scan site": fetch a product's live public URL and report objective,
// keyless findings — dead internal links, missing meta/OG/favicon, a too-short
// description, missing robots/sitemap, insecure http:// links, 404 resources,
// plus Phase 2 "better bug intelligence": weak-CTAs / dead-end UX, missing
// conversion & trust signals, thin/weak content, accessible-html problems
// (alt, labels, button names, headings, lang), and performance *indicators*
// (render-blocking assets). Every finding carries a CRITICAL/HIGH/MEDIUM/LOW
// severity (technical × user × business impact) and a HIGH/MEDIUM/LOW confidence
// (how certain the observation is). Heuristic/inferential findings are labelled
// LOW/MEDIUM confidence and say so — we never fabricate evidence.
//
// Server-side only: no browser globals, no TanStack imports. It runs in the
// serve.ts fetch handler via a plain REST route (/api/scan-site?url=...) which
// bypasses the TanStack RPC serializer entirely (same proven pattern as
// /api/check-availability). The dashboard calls it with a plain fetch().

export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type Confidence = "HIGH" | "MEDIUM" | "LOW";
export type CheckStatus = "fail" | "ok" | "unchecked";

// Item type used when a finding is converted into a checklist item. CRITICAL/HIGH
// bugs map to "bug"; MEDIUM/LOW polish maps to "issue". Kept in the same module
// so both the dashboard "Add" button and the brief engine share one mapping.
export function severityToItemType(sev: Severity): "bug" | "issue" | "feature" {
  if (sev === "CRITICAL" || sev === "HIGH") return "bug";
  return "issue";
}

// ---- Severity scoring ----
// Severity is a function of three independent impact axes (each 0..3):
//   tech     — how technically broken / how far from best practice
//   user     — how much the problem degrades a real user's experience
//   business — how much it dents the product's goals (conversion, trust, SEO)
// We sum the axes; the sum maps to CRITICAL/HIGH/MEDIUM/LOW. Confidence is a
// SEPARATE dimension (how certain we are of the observation) and never inflates
// severity — it only informs how strongly we assert the finding.
export interface Impact {
  tech: number;
  user: number;
  business: number;
}

export function classifySeverity(i: Impact): Severity {
  const s = i.tech + i.user + i.business;
  if (s >= 7) return "CRITICAL"; // broken checkout / primary action, whole site down
  if (s >= 5) return "HIGH"; // real breakage or conversion blocker
  if (s >= 3) return "MEDIUM"; // noticeable quality / polish gap
  return "LOW"; // cosmetic / nice-to-have
}

export interface ScanFinding {
  ruleId: string;
  severity: Severity;
  confidence: Confidence;
  title: string;
  detail: string;
  status: CheckStatus;
  // Unique per (rule, target) so re-running a scan and re-adding the same item
  // is idempotent/deduped in the UI.
  stableKey: string;
  url?: string;
}

export interface ScanResult {
  url: string; // final URL after redirects
  requestedUrl: string;
  ok: boolean; // was the source reachable at all
  scannedAt: number;
  findings: ScanFinding[];
}

const MAX_REQUESTS = 25; // hard cap on outgoing fetches for a single scan
const CONCURRENCY = 4; // parallel link/resource status checks
const REQ_TIMEOUT = 7000; // per-request timeout (ms)
const USER_AGENT = "Ailhat-site-scan";

interface ReqState {
  budget: number;
}

// ---- tiny HTML scanning helpers (regex-based, good enough for these checks) ----

function findTagAttrs(html: string, tagName: string, limit = 1000): string[] {
  const re = new RegExp(`<${tagName}\\b[^>]*>`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < limit) out.push(m[0]);
  return out;
}

function attr(tag: string, key: string): string | undefined {
  const re = new RegExp(
    `\\b${key}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    "i",
  );
  const m = tag.match(re);
  if (!m) return undefined;
  return (m[1] ?? m[2] ?? m[3] ?? "").trim();
}

// Visible text of an element tag (strips nested tags, entities incl. &nbsp;).
function textOf(tag: string): string {
  const inner = tag.replace(/^<[^>]*>/, "").replace(/<\/[^>]*>$/, "");
  return inner
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#\d+;/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .trim();
}

// Whole-document visible text (scripts/styles stripped).
function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#\d+;/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordCount(text: string): number {
  return text ? text.split(/\s+/).filter((w) => /[a-z0-9]/i.test(w)).length : 0;
}

interface Meta {
  name?: string;
  property?: string;
  content?: string;
}

function extractMetas(html: string): Meta[] {
  return findTagAttrs(html, "meta").map((t) => ({
    name: attr(t, "name")?.toLowerCase(),
    property: attr(t, "property")?.toLowerCase(),
    content: attr(t, "content"),
  }));
}

function normalizeUrl(raw: string): string | null {
  let u = (raw || "").trim();
  if (!u) return null;
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  try {
    return new URL(u).href;
  } catch {
    return null;
  }
}

function resolveUrl(base: string, ref: string): string | null {
  try {
    return new URL(ref, base).href;
  } catch {
    return null;
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  ms = REQ_TIMEOUT,
): Promise<Response> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return fetch(url, { ...init, signal: c.signal, redirect: "follow" }).finally(
    () => clearTimeout(t),
  );
}

// HEAD first (cheap), fall back to GET (cancelling the body) for servers that
// reject HEAD. Returns the HTTP status, or null on timeout/network error or
// when the per-scan request budget is exhausted.
async function statusOf(req: ReqState, url: string): Promise<number | null> {
  if (req.budget <= 0) return null;
  req.budget--;
  try {
    return (
      await fetchWithTimeout(url, {
        method: "HEAD",
        headers: { "user-agent": USER_AGENT },
      })
    ).status;
  } catch {
    try {
      const res = await fetchWithTimeout(url, {
        headers: { "user-agent": USER_AGENT },
      });
      res.body?.cancel().catch(() => {});
      return res.status;
    } catch {
      return null;
    }
  }
}

async function mapLimit<T>(
  items: T[],
  limit: number,
  fn: (it: T) => Promise<void>,
): Promise<void> {
  const lim = Math.max(1, Math.min(limit, items.length));
  let i = 0;
  const worker = async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx]);
    }
  };
  await Promise.all(Array.from({ length: lim }, worker));
}

function finding(
  ruleId: string,
  severity: Severity,
  confidence: Confidence,
  status: CheckStatus,
  title: string,
  detail: string,
  url?: string,
): ScanFinding {
  return {
    ruleId,
    severity,
    confidence,
    title,
    detail,
    status,
    stableKey: url ? `${ruleId}:${url}` : ruleId,
    url,
  };
}

// ---- per-rule severity + confidence (documented; grounded in observations) ----

const SEV = {
  // Hard, objective failures.
  unreachable: classifySeverity({ tech: 3, user: 3, business: 3 }), // whole site down
  brokenPrimary: classifySeverity({ tech: 3, user: 3, business: 3 }), // broken checkout/signup/pricing link
  brokenGeneric: classifySeverity({ tech: 1, user: 1, business: 1 }),
  insecure: classifySeverity({ tech: 2, user: 2, business: 1 }),
  script404: classifySeverity({ tech: 2, user: 2, business: 1 }), // missing script may break function
  asset404: classifySeverity({ tech: 1, user: 1, business: 1 }),
  // SEO / metadata polish.
  meta: classifySeverity({ tech: 0, user: 0, business: 1 }),
  favicon: classifySeverity({ tech: 0, user: 1, business: 0 }),
  titleMissing: classifySeverity({ tech: 1, user: 1, business: 2 }),
  titleWeak: classifySeverity({ tech: 0, user: 1, business: 1 }),
  thin: classifySeverity({ tech: 0, user: 1, business: 1 }),
  // UX.
  uxCta: classifySeverity({ tech: 0, user: 2, business: 1 }),
  deadEnd: classifySeverity({ tech: 0, user: 2, business: 1 }),
  formSubmit: classifySeverity({ tech: 0, user: 2, business: 1 }),
  // Conversion.
  trust: classifySeverity({ tech: 0, user: 0, business: 2 }),
  pricingAction: classifySeverity({ tech: 0, user: 3, business: 2 }), // no action on pricing page
  conversionPath: classifySeverity({ tech: 0, user: 2, business: 2 }),
  // Accessibility.
  a11yImgAlt: classifySeverity({ tech: 1, user: 1, business: 1 }),
  a11yFormLabel: classifySeverity({ tech: 1, user: 2, business: 1 }),
  a11yBtnName: classifySeverity({ tech: 1, user: 2, business: 1 }),
  a11yHeading: classifySeverity({ tech: 1, user: 1, business: 1 }),
  a11yLang: classifySeverity({ tech: 0, user: 1, business: 1 }),
  // Performance (indicators only — we can't measure true bytes).
  perf: classifySeverity({ tech: 1, user: 1, business: 0 }),
} as const;

const CONF = {
  high: "HIGH" as Confidence,
  med: "MEDIUM" as Confidence,
  low: "LOW" as Confidence,
};

// Keywords that make an internal link "primary" (a broken one is high impact).
const PRIMARY_LINK_RE =
  /pricing|checkout|cart|signup|sign-up|login|log-in|account|contact|buy|purchase|subscribe|order/i;

// Words/phrases that make a link/button read as a call-to-action.
const CTA_RE =
  /sign\s*up|signup|get\s+started|start\s+free|try\s+free|start\s+now|try\s+now|try\s+it|download|install|subscribe|launch|buy\b|purchase|order\s+now|join\b|create\s+(an?\s+)?account|get\s+it|add\s+to\s+(cart|app)|book\s+(a\s+)?demo|request\s+(a\s+)?demo|start\s+building|free\s+trial|pricing/i;

// Trust / social-proof keyword signals (English). Conservative on purpose.
const TRUST_RE =
  /testimonial|reviews?\b|trusted\s+by|customers?\b|clients?\b|logos?\b|★★★★|stars?\s+\d|users?\b|downloads\b|github\s+stars|soc\s*2|backed\s+by|as\s+seen\s+in/i;

// Action verbs for form submit button detection (so we know a form can submit).
const SUBMIT_RE = /submit|sign\s*up|send|go|get|start|register|save|create|order|pay|buy|subscribe/i;

interface Anchor {
  href: string;
  text: string;
}

// ---- main scan ----

export async function runScan(rawUrl: string): Promise<ScanResult> {
  const requestedUrl = normalizeUrl(rawUrl) ?? rawUrl;
  const scannedAt = Date.now();
  const req: ReqState = { budget: MAX_REQUESTS };
  const findings: ScanFinding[] = [];

  let pageUrl = requestedUrl;
  try {
    new URL(pageUrl);
  } catch {
    return {
      url: pageUrl,
      requestedUrl: rawUrl,
      ok: false,
      scannedAt,
      findings: [
        finding(
          "site-unreachable",
          SEV.unreachable,
          CONF.high,
          "fail",
          "Site couldn't be reached",
          `“${rawUrl}” isn't a valid URL.`,
          pageUrl,
        ),
      ],
    };
  }

  // 1. Fetch the main page.
  let pageText = "";
  let pageReachable = true;
  try {
    req.budget--;
    const res = await fetchWithTimeout(
      pageUrl,
      { headers: { "user-agent": USER_AGENT } },
      12000,
    );
    pageUrl = res.url || pageUrl;
    pageText = await res.text().catch(() => "");
  } catch {
    pageReachable = false;
  }

  if (!pageReachable) {
    findings.push(
      finding(
        "site-unreachable",
        SEV.unreachable,
        CONF.high,
        "fail",
        "Site couldn't be reached",
        `Fetching “${pageUrl}” failed or timed out — the homepage may be down.`,
        pageUrl,
      ),
    );
    return { url: pageUrl, requestedUrl: rawUrl, ok: false, scannedAt, findings };
  }

  let origin: string;
  try {
    origin = new URL(pageUrl).origin;
  } catch {
    origin = "";
  }
  const isHttps = origin.startsWith("https:");
  const metas = extractMetas(pageText);
  const descMeta = metas.find((m) => m.name === "description");
  const desc = (descMeta?.content ?? "").trim();
  const links = findTagAttrs(pageText, "link");
  const htmlText = visibleText(pageText);
  const wc = wordCount(htmlText);
  const isRoot = (() => {
    try {
      const p = new URL(pageUrl).pathname.replace(/\/+$/, "");
      return p === "" || p === "/" || p === "/index.html";
    } catch {
      return false;
    }
  })();

  // Anchors (href + visible text) used by several rules below.
  const anchors: Anchor[] = [];
  for (const a of findTagAttrs(pageText, "a")) {
    const href = attr(a, "href");
    if (!href || href.startsWith("#")) continue;
    anchors.push({ href, text: textOf(a) });
  }

  // ---- 2. Meta description ----
  findings.push(
    descMeta
      ? finding(
          "missing-meta-description",
          SEV.meta,
          CONF.high,
          "ok",
          "Meta description present",
          'A <meta name="description"> tag was found.',
        )
      : finding(
          "missing-meta-description",
          SEV.meta,
          CONF.high,
          "fail",
          "Missing meta description",
          'No <meta name="description"> tag on the page — weak SEO snippet.',
        ),
  );

  // 3. Short description (only flagged when present but too short).
  if (descMeta && desc.length > 0 && desc.length < 30) {
    findings.push(
      finding(
        "short-description",
        SEV.meta,
        CONF.high,
        "fail",
        `Description too short (${desc.length} chars)`,
        `The meta description is only ${desc.length} characters — aim for 50–160.`,
      ),
    );
  }

  // 4. Open Graph tags.
  const ogTitle = metas.find((m) => m.property === "og:title");
  const ogDesc = metas.find((m) => m.property === "og:description");
  const ogImage = metas.find((m) => m.property === "og:image");
  if (ogTitle && ogDesc && ogImage) {
    findings.push(
      finding(
        "missing-og",
        SEV.meta,
        CONF.high,
        "ok",
        "Open Graph tags present",
        "og:title, og:description and og:image are all defined.",
      ),
    );
  } else {
    const missing: string[] = [];
    if (!ogTitle) missing.push("og:title");
    if (!ogDesc) missing.push("og:description");
    if (!ogImage) missing.push("og:image");
    findings.push(
      finding(
        "missing-og",
        SEV.meta,
        CONF.high,
        "fail",
        `Missing Open Graph tag${missing.length > 1 ? "s" : ""} (${missing.join(", ")})`,
        "Add these for rich link previews when the page is shared.",
      ),
    );
  }

  // 5. Favicon — declared via <link rel="icon">, else probe /favicon.ico.
  const hasIconLink = links.some((l) =>
    (attr(l, "rel") || "").toLowerCase().includes("icon"),
  );
  if (hasIconLink) {
    findings.push(
      finding(
        "missing-favicon",
        SEV.favicon,
        CONF.high,
        "ok",
        "Favicon declared",
        'A <link rel="icon"> tag is present.',
      ),
    );
  } else {
    const favStatus = await statusOf(req, `${origin}/favicon.ico`);
    findings.push(
      favStatus === 200
        ? finding("missing-favicon", SEV.favicon, CONF.high, "ok", "Favicon found", "/favicon.ico responds.")
        : favStatus === null
          ? finding(
              "missing-favicon",
              SEV.favicon,
              CONF.med,
              "unchecked",
              "Favicon couldn't be checked",
              "Couldn't reach /favicon.ico.",
            )
          : finding(
              "missing-favicon",
              SEV.favicon,
              CONF.high,
              "fail",
              "No favicon found",
              `No <link rel="icon"> and /favicon.ico returned HTTP ${favStatus}.`,
            ),
    );
  }

  // 6. robots.txt.
  const robotsStatus = await statusOf(req, `${origin}/robots.txt`);
  findings.push(
    robotsStatus === 200
      ? finding("missing-robots", SEV.meta, CONF.high, "ok", "robots.txt present", "/robots.txt responds.")
      : robotsStatus === null
        ? finding(
            "missing-robots",
            SEV.meta,
            CONF.high,
            "unchecked",
            "robots.txt couldn't be checked",
            "Couldn't reach /robots.txt.",
          )
        : finding(
            "missing-robots",
            SEV.meta,
            CONF.high,
            "fail",
            "No robots.txt",
            `/robots.txt returned HTTP ${robotsStatus} — search engines can't be told how to crawl.`,
          ),
  );

  // 7. sitemap.xml (nice-to-have).
  const sitemapStatus = await statusOf(req, `${origin}/sitemap.xml`);
  findings.push(
    sitemapStatus === 200
      ? finding("missing-sitemap", SEV.meta, CONF.high, "ok", "sitemap.xml present", "/sitemap.xml responds.")
      : sitemapStatus === null
        ? finding(
            "missing-sitemap",
            SEV.meta,
            CONF.high,
            "unchecked",
            "sitemap.xml couldn't be checked",
            "Couldn't reach /sitemap.xml.",
          )
        : finding(
            "missing-sitemap",
            SEV.meta,
            CONF.high,
            "fail",
            "No sitemap.xml",
            `/sitemap.xml returned HTTP ${sitemapStatus} — no explicit crawl map for search engines.`,
          ),
  );

  // 8. Insecure links (page served over HTTPS).
  if (isHttps) {
    const insecure = (pageText.match(/https?:\/\/[^"')\s>]+/gi) || []).filter(
      (u) => u.startsWith("http://"),
    );
    findings.push(
      insecure.length > 0
        ? finding(
            "insecure-links",
            SEV.insecure,
            CONF.high,
            "fail",
            `${insecure.length} insecure http:// link${insecure.length > 1 ? "s" : ""}`,
            "Page is served over HTTPS but references http:// URLs — mixed content browsers may block.",
          )
        : finding(
            "insecure-links",
            SEV.insecure,
            CONF.high,
            "ok",
            "No insecure links",
            "All URLs detected are HTTPS.",
          ),
    );
  } else {
    findings.push(
      finding(
        "insecure-links",
        SEV.insecure,
        CONF.high,
        "ok",
        "No insecure links",
        "Not applicable — page isn't served over HTTPS.",
      ),
    );
  }

  // 9+10. Collect a bounded set of same-origin links + referenced resources,
  // then status-check them (pooled, respecting the shared request budget).
  const sameOrigin = new Map<string, "link" | "resource">();
  const LINK_CAP = 12;
  let linkCount = 0;
  for (const a of findTagAttrs(pageText, "a")) {
    const href = attr(a, "href");
    if (!href || href.startsWith("#")) continue;
    const resolved = resolveUrl(pageUrl, href);
    if (!resolved) continue;
    let rOrigin: string;
    try {
      rOrigin = new URL(resolved).origin;
    } catch {
      continue;
    }
    if (rOrigin !== origin) continue;
    if (!sameOrigin.has(resolved)) sameOrigin.set(resolved, "link");
    if (++linkCount >= LINK_CAP) break;
  }
  const RES_CAP = 8;
  let resCount = 0;
  for (const tagName of ["img", "script"]) {
    for (const t of findTagAttrs(pageText, tagName)) {
      const s = attr(t, "src") || attr(t, "href");
      if (!s) continue;
      const resolved = resolveUrl(pageUrl, s);
      if (!resolved) continue;
      let rOrigin: string;
      try {
        rOrigin = new URL(resolved).origin;
      } catch {
        continue;
      }
      if (rOrigin !== origin) continue;
      if (!sameOrigin.has(resolved)) sameOrigin.set(resolved, "resource");
      if (++resCount >= RES_CAP) break;
    }
    if (resCount >= RES_CAP) break;
  }
  for (const l of links) {
    if ((attr(l, "rel") || "").toLowerCase().includes("stylesheet")) {
      const h = attr(l, "href");
      if (!h) continue;
      const resolved = resolveUrl(pageUrl, h);
      if (!resolved) continue;
      let rOrigin: string;
      try {
        rOrigin = new URL(resolved).origin;
      } catch {
        continue;
      }
      if (rOrigin !== origin) continue;
      if (!sameOrigin.has(resolved)) sameOrigin.set(resolved, "resource");
    }
  }

  const pageNoHash = pageUrl.split("#")[0];
  const toCheck = [...sameOrigin.entries()].filter(
    ([u]) => u !== pageNoHash,
  );

  const broken: { url: string; kind: "link" | "resource" }[] = [];
  await mapLimit(toCheck, CONCURRENCY, async ([u, kind]) => {
    if (req.budget <= 0) return;
    const st = await statusOf(req, u);
    if (st === null || st >= 400) broken.push({ url: u, kind });
  });

  const linkBreaks = broken.filter((b) => b.kind === "link");
  const resBreaks = broken.filter((b) => b.kind === "resource");

  if (linkBreaks.length === 0) {
    findings.push(
      finding(
        "broken-links",
        SEV.brokenGeneric,
        CONF.high,
        "ok",
        "No broken internal links",
        `Checked ${toCheck.length} same-origin link(s) on the page.`,
      ),
    );
  } else {
    linkBreaks.slice(0, 6).forEach((b) => {
      const primary = PRIMARY_LINK_RE.test(b.url);
      findings.push(
        finding(
          "broken-links",
          primary ? SEV.brokenPrimary : SEV.brokenGeneric,
          CONF.high,
          "fail",
          primary
            ? "Broken primary link (conversion page)"
            : "Broken internal link",
          primary
            ? `This important page link returns an error (HTTP ≥400) — users can't get there.`
            : "This same-origin link returns an error or couldn't be loaded.",
          b.url,
        ),
      );
    });
    if (linkBreaks.length > 6)
      findings.push(
        finding(
          "broken-links-more",
          SEV.brokenGeneric,
          CONF.high,
          "fail",
          `${linkBreaks.length - 6} more broken link${linkBreaks.length - 6 > 1 ? "s" : ""}`,
          "Additional broken internal links were detected.",
        ),
      );
  }

  if (resBreaks.length === 0) {
    findings.push(
      finding(
        "resource-404",
        SEV.asset404,
        CONF.high,
        "ok",
        "No 404 resources",
        "No missing images/scripts/styles detected on the page.",
      ),
    );
  } else {
    resBreaks.slice(0, 6).forEach((b) => {
      const isScript = /\.js($|\?)/i.test(b.url);
      findings.push(
        finding(
          "resource-404",
          isScript ? SEV.script404 : SEV.asset404,
          CONF.high,
          "fail",
          isScript ? "Missing script (may break functionality)" : "Referenced resource 404s",
          isScript
            ? "A JavaScript file referenced on the page returns 404 — features may not load."
            : "A script/image/style referenced on the page returns 404.",
          b.url,
        ),
      );
    });
    if (resBreaks.length > 6)
      findings.push(
        finding(
          "resource-404-more",
          SEV.asset404,
          CONF.high,
          "fail",
          `${resBreaks.length - 6} more 404 resource${resBreaks.length - 6 > 1 ? "s" : ""}`,
          "Additional missing assets were detected.",
        ),
      );
  }

  // =====================================================================
  // Phase 2 — better bug intelligence. All of the below are derived from the
  // already-fetched HTML (no extra network cost). Inferential heuristics carry
  // MEDIUM/LOW confidence and their evidence states exactly what was observed.
  // =====================================================================

  // ---- Content: <title> ----
  const titleMatch = pageText.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, " ").trim() : "";
  if (!title) {
    findings.push(
      finding(
        "content-title",
        SEV.titleMissing,
        CONF.high,
        "fail",
        "Missing page <title>",
        "No <title> tag found — browsers show an untitled tab and SEO suffers.",
      ),
    );
  } else if (title.length < 15 || /^(home|untitled|index)$/i.test(title)) {
    findings.push(
      finding(
        "content-title",
        SEV.titleWeak,
        CONF.high,
        "fail",
        `Weak page title (${title.length} chars)`,
        `Title “${title.slice(0, 60)}” is vague/too short — aim for a descriptive 30–60 char title.`,
      ),
    );
  } else {
    findings.push(
      finding(
        "content-title",
        SEV.titleWeak,
        CONF.high,
        "ok",
        "Descriptive page title",
        `Title “${title.slice(0, 60)}” is a reasonable length.`,
      ),
    );
  }

  // ---- Content: thin page ----
  if (wc > 0 && wc < 60) {
    findings.push(
      finding(
        "content-thin",
        SEV.thin,
        CONF.med,
        "fail",
        `Very thin content (~${wc} words)`,
        `Only ~${wc} words of visible text on the page — little for users or search engines to act on.`,
      ),
    );
  }

  // ---- A11y: lang attribute ----
  const htmlLang = pageText.match(/<html[^>]*\blang\s*=\s*["']?([a-zA-Z-]+)/i);
  findings.push(
    htmlLang
      ? finding("a11y-lang", SEV.a11yLang, CONF.high, "ok", "lang attribute present", `<html lang="${htmlLang[1]}"> is set — good for screen readers & SEO.`)
      : finding("a11y-lang", SEV.a11yLang, CONF.high, "fail", "Missing <html lang> attribute", "No lang attribute on <html> — screen readers can't detect page language."),
  );

  // ---- A11y: headings (missing h1 / skipped levels / multiple h1) ----
  const headings = findTagAttrs(pageText, "h1")
    .concat(findTagAttrs(pageText, "h2"), findTagAttrs(pageText, "h3"), findTagAttrs(pageText, "h4"), findTagAttrs(pageText, "h5"), findTagAttrs(pageText, "h6"))
    .map((t) => Number(/(\d)/.exec(t)?.[1] ?? 0));
  const h1Count = headings.filter((l) => l === 1).length;
  if (headings.length === 0 || h1Count === 0) {
    findings.push(
      finding(
        "a11y-heading",
        SEV.a11yHeading,
        CONF.high,
        "fail",
        "No single <h1> heading",
        headings.length === 0
          ? "No heading tags found on the page — no clear document structure."
          : "The page has headings but no <h1> — screen readers and SEO lack a top-level landmark.",
      ),
    );
  } else {
    // Skipped level detection (e.g. h1 -> h3 without h2).
    let prev = 1;
    let skipped = 0;
    for (const lvl of headings) {
      if (lvl > prev + 1) skipped++;
      prev = lvl;
    }
    headings.length === 1 && h1Count === 1 && skipped === 0
      ? findings.push(
          finding(
            "a11y-heading",
            SEV.a11yHeading,
            CONF.high,
            "ok",
            "Heading hierarchy looks fine",
            `Found a single <h1> and ${headings.length - 1} subheading(s).`,
          ),
        )
      : findings.push(
          finding(
            "a11y-heading",
            SEV.a11yHeading,
            CONF.high,
            "fail",
            h1Count > 1
              ? `Multiple <h1> headings (${h1Count})`
              : "Heading levels are skipped",
            h1Count > 1
              ? `The page uses ${h1Count} <h1> tags — use one top-level heading per page.`
              : "Heading levels skip a step (e.g. an h3 with no h2) — confusing for screen-reader navigation.",
          ),
        );
  }

  // ---- A11y: image alt text ----
  const imgs = findTagAttrs(pageText, "img");
  const noAlt = imgs.filter((t) => {
    const a = attr(t, "alt");
    return a === undefined || a.trim() === "";
  });
  if (noAlt.length === 0) {
    findings.push(
      finding(
        "a11y-img-alt",
        SEV.a11yImgAlt,
        CONF.high,
        "ok",
        "All images have alt text",
        `Checked ${imgs.length} <img> tag(s) — every image has an alt attribute.`,
      ),
    );
  } else {
    findings.push(
      finding(
        "a11y-img-alt",
        noAlt.length > 5 ? SEV.a11yImgAlt : SEV.a11yLang,
        CONF.high,
        "fail",
        `${noAlt.length} image${noAlt.length > 1 ? "s" : ""} missing alt text`,
        `Of ${imgs.length} images, ${noAlt.length} have no alt attribute — screen readers and failed loads get no description.`,
      ),
    );
  }

  // ---- A11y: form inputs missing labels ----
  const controls = findTagAttrs(pageText, "input")
    .concat(findTagAttrs(pageText, "textarea"), findTagAttrs(pageText, "select"))
    .filter((t) => {
      const type = (attr(t, "type") || "text").toLowerCase();
      // Hidden / button-ish controls don't need a visible label.
      return type !== "hidden" && type !== "submit" && type !== "button" && type !== "reset";
    });
  const unlabeled = controls.filter((t) => {
    if (attr(t, "aria-label")) return false;
    if (attr(t, "placeholder")) return false;
    if (attr(t, "title")) return false;
    const id = attr(t, "id");
    if (id) {
      // <label for="id"> association
      const hasFor = new RegExp(`<label\\b[^>]*\\bfor\\s*=\\s*["']?${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(pageText);
      if (hasFor) return false;
    }
    return true;
  });
  if (unlabeled.length > 0) {
    findings.push(
      finding(
        "a11y-form-label",
        SEV.a11yFormLabel,
        CONF.high,
        "fail",
        `${unlabeled.length} form field${unlabeled.length > 1 ? "s" : ""} without a label`,
        `Field${unlabeled.length > 1 ? "s" : ""} ${unlabeled.slice(0, 5).map((t) => `"${attr(t, "name") ?? attr(t, "id") ?? attr(t, "type") ?? "?"}"`).join(", ")}${
          unlabeled.length > 5 ? "…" : ""
        } ${unlabeled.length > 1 ? "have" : "has"} no label, aria-label, or placeholder.`,
      ),
    );
  } else if (controls.length > 0) {
    findings.push(
      finding(
        "a11y-form-label",
        SEV.a11yFormLabel,
        CONF.high,
        "ok",
        "Form fields have labels",
        `All ${controls.length} text field(s) have a label, aria-label, or placeholder.`,
      ),
    );
  }

  // ---- A11y: buttons missing accessible names ----
  const buttons = findTagAttrs(pageText, "button");
  const unnamedButtons = buttons.filter((t) => {
    if (attr(t, "aria-label")) return false;
    const txt = textOf(t).trim();
    return txt === "";
  });
  if (unnamedButtons.length > 0) {
    findings.push(
      finding(
        "a11y-btn-name",
        SEV.a11yBtnName,
        CONF.high,
        "fail",
        `${unnamedButtons.length} button${unnamedButtons.length > 1 ? "s" : ""} with no accessible name`,
        `${unnamedButtons.length} <button> element has no text or aria-label — screen-reader users can't tell what it does.`,
      ),
    );
  }

  // ---- UX: primary CTA present? ----
  const ctaTexts = buttons
    .map((t) => textOf(t).trim())
    .concat(
      anchors
        .map((a) => a.text)
        .filter((t) => t.length > 0 && t.length <= 60),
    )
    .filter((t) => CTA_RE.test(t));
  if (ctaTexts.length === 0) {
    findings.push(
      finding(
        "ux-primary-cta",
        SEV.uxCta,
        CONF.med,
        "fail",
        "No clear primary call-to-action found",
        "No button or link with obvious action language (sign up, get started, buy, download…) was found — visitors may not know the next step.",
        isRoot ? undefined : pageUrl,
      ),
    );
  } else {
    findings.push(
      finding(
        "ux-primary-cta",
        SEV.uxCta,
        CONF.med,
        "ok",
        "Call-to-action present",
        `Detected action language: ${[...new Set(ctaTexts.slice(0, 3))].map((t) => `“${t}”`).join(", ")}.`,
      ),
    );
  }

  // ---- UX: dead-end page (no links/actions except nav) ----
  const descriptiveLinks = anchors.filter(
    (a) => a.text.length >= 4 && !PRIMARY_LINK_RE.test(a.text),
  );
  const deadEnd = buttons.length === 0 && descriptiveLinks.length < 2 && wc < 200;
  if (deadEnd) {
    findings.push(
      finding(
        "ux-dead-end",
        SEV.deadEnd,
        CONF.med,
        "fail",
        "Page looks like a dead end",
        `No actionable links or buttons and only ~${wc} words — visitors have no obvious next step.`,
        isRoot ? undefined : pageUrl,
      ),
    );
  }

  // ---- UX: forms without an obvious submit action ----
  const forms = findTagAttrs(pageText, "form");
  const submitControls = findTagAttrs(pageText, "input")
    .concat(buttons)
    .filter((t) => {
      const type = (attr(t, "type") || "").toLowerCase();
      const txt = textOf(t).trim();
      return type === "submit" || SUBMIT_RE.test(txt);
    });
  if (forms.length > 0 && submitControls.length === 0 && controls.length > 0) {
    findings.push(
      finding(
        "ux-form-submit",
        SEV.formSubmit,
        CONF.high,
        "fail",
        "Form has no obvious submit button",
        `Found ${forms.length} <form> and ${controls.length} field(s) but no submit control — unclear how a user completes the form.`,
      ),
    );
  }

  // ---- Conversion: trust / social-proof signals (root page only) ----
  if (isRoot) {
    const hasTrust = TRUST_RE.test(htmlText);
    findings.push(
      hasTrust
        ? finding(
            "conv-trust",
            SEV.trust,
            CONF.low,
            "ok",
            "Trust/social-proof signals present",
            "Found keywords suggesting testimonials, reviews, customers, or usage — a good trust signal.",
          )
        : finding(
            "conv-trust",
            SEV.trust,
            CONF.low,
            "fail",
            "No trust/social-proof signals found",
            "No testimonials, reviews, customer, or usage keywords found on this page (heuristic — a plain page can still convert).",
          ),
    );

    // ---- Conversion: is there a path to conversion (pricing + a CTA)? ----
    const hasPricingLink = anchors.some(
      (a) => /pricing|plans?|buy/i.test(a.href) || /pricing|plans?/i.test(a.text),
    );
    if (!hasPricingLink && ctaTexts.length === 0) {
      findings.push(
        finding(
          "conv-path",
          SEV.conversionPath,
          CONF.med,
          "fail",
          "No clear conversion path",
          "This page has no pricing/plan link and no call-to-action — a visitor can't easily move toward buying or signing up.",
        ),
      );
    }
  }

  // ---- Conversion: pricing page present but no action ----
  try {
    const path = new URL(pageUrl).pathname.toLowerCase();
    if (/pricing|plans|checkout|signup|sign-up/.test(path) && ctaTexts.length === 0) {
      findings.push(
        finding(
          "conv-pricing-action",
          SEV.pricingAction,
          CONF.med,
          "fail",
          "Pricing/page has no action",
          "On a pricing/signup page but found no call-to-action button or link to proceed.",
        ),
      );
    }
  } catch {
    /* ignore */
  }

  // ---- Performance indicators (can't measure true bytes, so labelled LOW) ----
  const headText = pageText.match(/<head[\s\S]*?<\/head>/i)?.[0] ?? pageText;
  const styleCount = (headText.match(/<link\b[^>]*rel=["']?stylesheet/gi) || []).length;
  const nonAsyncScripts = (headText.match(/<script\b(?![^>]*\b(?:async|defer)\b)[^>]*>/gi) || []).length;
  if (styleCount >= 8) {
    findings.push(
      finding(
        "perf-styles",
        SEV.perf,
        CONF.low,
        "fail",
        `Many stylesheets loaded (${styleCount})`,
        `${styleCount} <link rel="stylesheet"> tags — an indicator of possible render-blocking CSS (we can't measure true load time).`,
      ),
    );
  }
  if (nonAsyncScripts >= 12) {
    findings.push(
      finding(
        "perf-scripts",
        SEV.perf,
        CONF.low,
        "fail",
        `Many render-blocking scripts (${nonAsyncScripts})`,
        `${nonAsyncScripts} <script> tags in <head> without async/defer — an indicator of possible slow first render (not measured).`,
      ),
    );
  }

  return { url: pageUrl, requestedUrl: rawUrl, ok: true, scannedAt, findings };
}
