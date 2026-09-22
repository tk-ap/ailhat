import { chromium } from "playwright";
import fs from "node:fs/promises";

const OUT = ".mobile-proof";
await fs.mkdir(OUT, { recursive: true });

const viewports = [
  { name: "iphone-390", width: 390, height: 844 },
  { name: "iphone-small", width: 375, height: 667 },
];

function json(route, body, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

const portfolioState = {
  products: [
    { id: "ashwood", name: "ASHWOOD", platform: "vercel", url: "https://ashwood-info.vercel.app/", repository: "tk-ap/ashwood-info", createdAt: Date.now() - 86400000 },
    { id: "ailhat", name: "ailhat", platform: "web", url: "https://ailhat.vercel.app/", repository: "tk-ap/ailhat", createdAt: Date.now() - 86400000 },
  ],
  retiredProducts: [],
  items: [],
  decisions: {},
  scans: {},
  scanHistory: {},
  productActivity: {},
  engagement: {},
  feedback: {},
  opportunities: [],
  opportunityFeedback: {},
};

async function installMocks(page) {
  await page.route("**/api/**", async route => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;

    if (path === "/api/auth/status") {
      return json(route, { authed: true, user: { id: 1, email: "owner@example.test" }, signupOpen: false });
    }
    if (path === "/api/access") {
      return json(route, { access: {
        role: "owner", planKey: "owner", planStatus: "active", foundingBeta: false,
        betaExpiresAt: null, productAccess: true, accessReason: "owner"
      }});
    }
    if (path === "/api/portfolio") {
      if (req.method() === "PUT") return json(route, { ok: true });
      return json(route, { state: portfolioState });
    }
    if (path === "/api/sandbox-environments") {
      if (req.method() === "GET") {
        return json(route, {
          connection: { provider: "here-now", configured: true, source: "runtime_secret", secretName: "HERENOW_API_KEY", inherited: true },
          environments: [{
            productId: "ashwood",
            provider: "here-now",
            providerConnectionRef: "owner:provider:here-now",
            slug: "mighty-yoga-pgph",
            sandboxUrl: "https://mighty-yoga-pgph.here.now/",
            lifecycle: "live",
            staticPrimary: true,
            currentVersionId: "01M359HV4JJ4JKVWBRM2EXBAKM",
            sourceRepository: "tk-ap/ashwood-info",
            sourceRef: "928434e743ce147d37b771b3da28ed79f3c8f64a",
            verificationState: "passed",
            verifiedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }]
        });
      }
      return json(route, { ok: true });
    }
    if (path === "/api/evidence/github" || path === "/api/evidence/vercel") {
      return json(route, { snapshots: [] });
    }
    if (path === "/api/evidence/reconcile") {
      return json(route, { observations: [], reconciliation: [] });
    }
    return json(route, { ok: true });
  });
}

async function assertNoOverflow(page, name) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 2) throw new Error(`${name}: horizontal overflow ${overflow}px`);
}

async function assertTapTarget(locator, name) {
  const rect = await locator.boundingBox();
  if (!rect) throw new Error(`${name}: target not visible`);
  if (rect.height < 40 || rect.width < 40) {
    throw new Error(`${name}: tap target too small (${Math.round(rect.width)}x${Math.round(rect.height)})`);
  }
}

for (const vp of viewports) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  const errors = [];
  page.on("pageerror", error => errors.push(String(error)));
  await installMocks(page);

  await page.goto("https://ailhat.vercel.app/connections", { waitUntil: "domcontentloaded" });
  try {
    await page.getByRole("heading", { name: "Evidence in. Prepared work out." }).waitFor({ state: "visible", timeout: 12000 });
  } catch (error) {
    const body = (await page.locator("body").innerText()).slice(0, 1400);
    throw new Error(`${vp.name}: owner Connections did not hydrate. url=${page.url()} errors=${errors.join(" | ")} body=${body}`);
  }
  await page.getByRole("heading", { name: "here.now" }).waitFor({ state: "visible" });
  await assertNoOverflow(page, vp.name);

  const declare = page.getByRole("button", { name: "Declare integration" });
  await assertTapTarget(declare, `${vp.name} declare integration`);

  const openSandbox = page.getByRole("link", { name: "Open sandbox ↗" });
  await assertTapTarget(openSandbox, `${vp.name} Open sandbox`);

  const productSelect = page.locator('form select').first();
  const sandboxUrl = page.locator('form input[type="url"]');
  const register = page.getByRole("button", { name: "Register sandbox" });
  await assertTapTarget(productSelect, `${vp.name} product selector`);
  await assertTapTarget(sandboxUrl, `${vp.name} sandbox URL input`);
  await assertTapTarget(register, `${vp.name} register sandbox`);

  const mobileSidebar = page.locator("aside.fixed");
  if (await mobileSidebar.isVisible()) throw new Error(`${vp.name}: desktop sidebar is visible on phone width`);

  await declare.click();
  await page.waitForTimeout(100);
  await assertNoOverflow(page, vp.name);

  await page.screenshot({ path: `${OUT}/${vp.name}-ailhat-connections.png`, fullPage: true });
  if (errors.length) throw new Error(`${vp.name}: page errors: ${errors.join(" | ")}`);

  console.log(JSON.stringify({ viewport: vp, connections: "PASS", hereNowOwnerSurface: "PASS" }));
  await browser.close();
}
