import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

/**
 * Produce the README screenshots from the real deployment.
 * Usage: node scripts/screenshots.mjs https://your-deployment docs/screenshots
 */
const base = process.argv[2] ?? 'https://billswipe.852367856.dpdns.org';
const outDir = process.argv[3] ?? 'docs/screenshots';
mkdirSync(outDir, { recursive: true });

const DESKTOP = { width: 1440, height: 1000 };
const MOBILE = { width: 390, height: 844 };

const browser = await chromium.launch();
const errors = [];

async function newPage(viewport, mobile = false, lang = 'en') {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 2,
    isMobile: mobile,
    hasTouch: mobile,
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  page.on('pageerror', (err) => errors.push(`${page.url()} :: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`${page.url()} :: ${msg.text()}`);
  });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.evaluate((code) => window.localStorage.setItem('billswipe.lang', code), lang);
  return { context, page };
}

// --- public pages ------------------------------------------------------------
{
  const { context, page } = await newPage(DESKTOP);
  for (const [path, name] of [
    ['/', 'landing-desktop'],
    ['/community', 'community-desktop'],
    ['/how-it-works', 'how-it-works-desktop'],
  ]) {
    await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1400);
    await page.screenshot({ path: `${outDir}/${name}.png` });
    console.log('shot', name);
  }
  await context.close();
}

{
  const { context, page } = await newPage(MOBILE, true);
  for (const [path, name] of [
    ['/', 'landing-mobile'],
    ['/discover', 'discover-mobile'],
    ['/community', 'community-mobile'],
  ]) {
    await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1400);
    await page.screenshot({ path: `${outDir}/${name}.png` });
    console.log('shot', name);
  }
  await context.close();
}

// --- Chinese desktop ---------------------------------------------------------
{
  const { context, page } = await newPage(DESKTOP, false, 'zh');
  for (const [path, name] of [
    ['/', 'landing-zh-desktop'],
    ['/how-it-works', 'how-it-works-zh-desktop'],
    ['/community', 'community-zh-desktop'],
  ]) {
    await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1400);
    await page.screenshot({ path: `${outDir}/${name}.png` });
    console.log('shot', name);
  }
  await context.close();
}

// --- mobile in both languages ------------------------------------------------
for (const lang of ['zh', 'en']) {
  const { context, page } = await newPage(MOBILE, true, lang);
  const suffix = lang === 'zh' ? '-zh' : '';
  for (const [path, name] of [
    ['/', `landing-mobile${suffix}`],
    ['/discover', `discover-mobile${suffix}`],
  ]) {
    await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1400);
    await page.screenshot({ path: `${outDir}/${name}.png` });
    console.log('shot', name);
  }
  await context.close();
}

// --- a helper's journey ------------------------------------------------------
{
  const { context, page } = await newPage(DESKTOP);
  const stamp = Date.now().toString(36);
  await page.goto(`${base}/register`, { waitUntil: 'networkidle' });
  await page.fill('#reg-email', `shot_${stamp}@example.com`);
  await page.fill('#reg-username', `shot_${stamp}`.slice(0, 20));
  await page.fill('#reg-password', 'Testing!2026');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);

  await page.goto(`${base}/discover`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `${outDir}/discover-desktop.png` });
  console.log('shot discover-desktop');

  await page.getByRole('button', { name: 'Help', exact: true }).first().click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${outDir}/help-amount-sheet.png` });
  console.log('shot help-amount-sheet');

  await page.getByRole('button', { name: /Continue to confirmation/i }).click();
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `${outDir}/payment-confirm.png` });
  console.log('shot payment-confirm');

  await page.getByRole('button', { name: /Confirm \$/i }).click();
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${outDir}/payment-success.png` });
  console.log('shot payment-success');

  const billLink = await page.locator('a[href^="/bills/bil_"]').first().getAttribute('href').catch(() => null);
  await context.close();
  if (billLink) {
    const detail = await newPage(DESKTOP);
    await detail.page.goto(`${base}${billLink}`, { waitUntil: 'networkidle' });
    await detail.page.waitForTimeout(1200);
    await detail.page.screenshot({ path: `${outDir}/bill-detail.png`, fullPage: true });
    console.log('shot bill-detail');
    await detail.context.close();
  }
}

// --- posting flow ------------------------------------------------------------
{
  const { context, page } = await newPage(DESKTOP);
  const stamp = Date.now().toString(36);
  await page.goto(`${base}/register`, { waitUntil: 'networkidle' });
  await page.fill('#reg-email', `post_${stamp}@example.com`);
  await page.fill('#reg-username', `post_${stamp}`.slice(0, 20));
  await page.fill('#reg-password', 'Testing!2026');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  await page.goto(`${base}/bills/new`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${outDir}/post-bill-step1.png` });
  console.log('shot post-bill-step1');
  await context.close();
}

// --- admin -------------------------------------------------------------------
{
  const { context, page } = await newPage(DESKTOP);
  await page.goto(`${base}/login`, { waitUntil: 'networkidle' });
  await page.fill('#email', 'admin@billswipe.local');
  await page.fill('#password', 'BillSwipe!Admin2026');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);
  await page.goto(`${base}/admin`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1300);
  await page.screenshot({ path: `${outDir}/admin-overview.png` });
  await page.goto(`${base}/admin/bills`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${outDir}/admin-review-queue.png` });
  console.log('shot admin');
  await context.close();
}

await browser.close();
const unique = [...new Set(errors)];
console.log(unique.length ? `\nConsole errors:\n${unique.join('\n')}` : '\nNo console errors.');
process.exitCode = unique.length ? 1 : 0;
