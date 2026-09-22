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

async function assertNoOverflow(page, name, scope) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 2) throw new Error(`${name}: ${scope} horizontal overflow ${overflow}px`);
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

  // 1) Live production shell proof.
  const live = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  const liveErrors = [];
  live.on("pageerror", error => liveErrors.push(String(error)));
  await live.goto("https://ailhat.vercel.app/connections", { waitUntil: "domcontentloaded" });
  await live.waitForTimeout(900);
  await assertNoOverflow(live, vp.name, "live Connections shell");
  const desktopSidebar = live.locator("aside.fixed");
  if (await desktopSidebar.isVisible()) throw new Error(`${vp.name}: desktop sidebar visible on phone width`);
  const mobileHeader = live.locator("div.sm\\:hidden").first();
  if (!(await mobileHeader.isVisible())) throw new Error(`${vp.name}: mobile ailhat header not visible`);
  if (liveErrors.length) throw new Error(`${vp.name}: live shell page errors: ${liveErrors.join(" | ")}`);
  await live.screenshot({ path: `${OUT}/${vp.name}-ailhat-live-shell.png`, fullPage: true });

  // 2) Real owner connector component from current source, QA-only route.
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  const errors = [];
  page.on("pageerror", error => errors.push(String(error)));
  await page.route("**/api/sandbox-environments**", async route => {
    const req = route.request();
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
          sourceRef: "6f6643c626596e920ba50dfb276c53e1f73863ad",
          verificationState: "passed",
          verifiedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }]
      });
    }
    return json(route, { ok: true });
  });

  await page.goto("http://127.0.0.1:4173/mobile-proof", { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "here.now" }).waitFor({ state: "visible" });
  await page.getByText("Owner connection configured").waitFor({ state: "visible" });
  await assertNoOverflow(page, vp.name, "owner here.now connector");

  const openSandbox = page.getByRole("link", { name: "Open sandbox ↗" });
  const productSelect = page.locator("form select").first();
  const sandboxUrl = page.locator('form input[type="url"]');
  const register = page.getByRole("button", { name: "Register sandbox" });
  await assertTapTarget(openSandbox, `${vp.name} Open sandbox`);
  await assertTapTarget(productSelect, `${vp.name} product selector`);
  await assertTapTarget(sandboxUrl, `${vp.name} sandbox URL input`);
  await assertTapTarget(register, `${vp.name} register sandbox`);

  await page.screenshot({ path: `${OUT}/${vp.name}-ailhat-owner-connector.png`, fullPage: true });
  const productErrors = errors.filter(error => !/WebSocket closed without opened/i.test(error));
  if (productErrors.length) throw new Error(`${vp.name}: owner connector page errors: ${productErrors.join(" | ")}`);

  console.log(JSON.stringify({ viewport: vp, liveShell: "PASS", ownerHereNowConnector: "PASS" }));
  await browser.close();
}
