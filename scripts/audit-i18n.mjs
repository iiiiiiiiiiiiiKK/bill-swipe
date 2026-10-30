/**
 * Translation coverage audit.
 *
 * Loads every route with the language set to Chinese and reports visible text
 * that still looks like untranslated English copy.
 *
 * Usage: node scripts/audit-i18n.mjs https://your-deployment
 */
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'https://billswipe.852367856.dpdns.org';

const ROUTES = [
  '/',
  '/discover',
  '/community',
  '/how-it-works',
  '/trust',
  '/payments-info',
  '/faq',
  '/about',
  '/login',
  '/register',
  '/bills/new',
  '/notifications',
  '/not-found-test',
];

// Text that is intentionally Latin (brand, units, enums, labels we key in English).
const ALLOW = [
  /^BILL\s*SWIPE$/i,
  /^SWIPE$/i,
  /^BILL$/i,
  /^EN$|^中文$/,
  /^beta$/i,
  /^Demo$/i,
  /^HELP$|^PASS$|^SUPER HELP$/,
  /^[$\d.,%]+$/,
  /^[\d.,\s%$-]+$/,
  /^\$[\d,.]+$/,
  /^@?[a-z0-9_.]+@[a-z0-9.]+\.[a-z]+$/i,
  /^\/api\//,
  /^https?:\/\//,
  /^[A-Z]{2,3}$/,
  /^[a-z0-9_]+$/,
  /^\d+[a-zA-Z]?$/,
  /^USD$|^EUR$|^GBP$|^CAD$|^AUD$/,
  /^-#/,
  /^[#\w-]{4,}$/,
  /^[\u4e00-\u9fff]/, // already Chinese
  /[\u4e00-\u9fff]/, // contains Chinese → fine
];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ignoreHTTPSErrors: true });
const page = await context.newPage();

await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => window.localStorage.setItem('billswipe.lang', 'zh'));

const findings = {};

for (const route of ROUTES) {
  await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  const texts = await page.evaluate(() => {
    const out = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (!text) continue;
      const el = node.parentElement;
      if (!el) continue;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      out.push(text);
    }
    return out;
  });

  const untranslated = [...new Set(texts)].filter((text) => {
    if (text.length < 2) return false;
    if (ALLOW.some((re) => re.test(text))) return false;
    // Needs at least two Latin words or a long single word to count as copy.
    const words = text.split(' ').filter((w) => /[A-Za-z]{2,}/.test(w));
    return words.length >= 2 || /^[A-Za-z]{4,}\.?( [A-Za-z]{2,})?$/.test(text);
  });

  if (untranslated.length > 0) findings[route] = untranslated;
}

await browser.close();

let total = 0;
for (const [route, list] of Object.entries(findings)) {
  total += list.length;
  console.log(`\n${route}  (${list.length} untranslated)`);
  for (const item of list.slice(0, 40)) console.log(`   • ${item.slice(0, 100)}`);
}

console.log(`\nTotal untranslated strings: ${total}`);
process.exitCode = total === 0 ? 0 : 1;
