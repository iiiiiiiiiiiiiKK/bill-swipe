import { chromium } from 'playwright';

/**
 * Automated UI audit: responsive overflow, tap targets, contrast, clipping and
 * basic accessibility checks across phone / tablet / desktop viewports.
 *
 * Usage: node scripts/audit-ui.mjs https://your-deployment
 */
const base = process.argv[2] ?? 'https://billswipe.852367856.dpdns.org';
const lang = process.argv[3] ?? 'en';

const VIEWPORTS = [
  { name: 'iPhone SE 320', width: 320, height: 568, mobile: true },
  { name: 'iPhone 8 375', width: 375, height: 667, mobile: true },
  { name: 'iPhone 14 390', width: 390, height: 844, mobile: true },
  { name: 'iPhone Pro Max 430', width: 430, height: 932, mobile: true },
  { name: 'iPad 768', width: 768, height: 1024, mobile: true },
  { name: 'Laptop 1280', width: 1280, height: 800, mobile: false },
  { name: 'Desktop 1440', width: 1440, height: 960, mobile: false },
  { name: 'Wide 1920', width: 1920, height: 1080, mobile: false },
];

const PAGES = ['/', '/discover', '/community', '/login', '/register', '/how-it-works', '/trust', '/faq', '/bills/new'];

const browser = await chromium.launch();
let failures = 0;
let checks = 0;

function report(ok, label, detail = '') {
  checks++;
  if (!ok) {
    failures++;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

for (const viewport of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    isMobile: viewport.mobile,
    hasTouch: viewport.mobile,
  });
  const page = await context.newPage();
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.evaluate((code) => window.localStorage.setItem('billswipe.lang', code), lang);
  console.log(`\n== ${viewport.name} (${viewport.width}x${viewport.height}) [${lang}] ==`);

  for (const path of PAGES) {
    await page.goto(`${base}${path}`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(600);

    const result = await page.evaluate(({ isMobile }) => {
      const out = { overflowX: 0, offenders: [], smallTargets: [], tinyText: [], hidden: [], emptyRoot: false };
      const docWidth = document.documentElement.clientWidth;
      out.docScrollWidth = document.documentElement.scrollWidth;
      out.overflowX = Math.max(0, document.documentElement.scrollWidth - docWidth);

      const root = document.getElementById('root');
      out.emptyRoot = !root || root.children.length === 0;

      const isVisible = (el) => {
        const style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };

      for (const el of document.querySelectorAll('body *')) {
        if (!isVisible(el)) continue;
        const rect = el.getBoundingClientRect();
        // Elements sticking out to the right beyond the viewport
        if (rect.right > docWidth + 2 && !el.closest('[aria-hidden="true"]')) {
          const style = getComputedStyle(el);
          if (style.position !== 'fixed' || rect.right > docWidth + 8) {
            out.offenders.push({
              tag: el.tagName.toLowerCase(),
              cls: (el.className || '').toString().slice(0, 70),
              right: Math.round(rect.right),
              text: (el.textContent || '').trim().slice(0, 40),
            });
          }
        }
      }

      if (isMobile) {
        for (const el of document.querySelectorAll('button, a, input, [role="switch"], select')) {
          if (!isVisible(el)) continue;
          // The visually-hidden skip link is 1x1 by design (it becomes a full
          // button when focused) and is not a touch target.
          if (el.classList.contains('sr-only')) continue;
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          // interactive elements in the fixed bottom nav and toggles are allowed to be smaller
          const inNav = !!el.closest('nav');
          const min = inNav ? 30 : 32;
          if (rect.height < min || rect.width < 20) {
            out.smallTargets.push({
              tag: el.tagName.toLowerCase(),
              text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30),
              w: Math.round(rect.width),
              h: Math.round(rect.height),
            });
          }
        }
      }

      // Text smaller than 10px (readability floor). Decorative artwork and
      // image-replacement graphics are excluded — they are `aria-hidden` art,
      // not interface copy.
      for (const el of document.querySelectorAll('p, span, li, a, button, label, dt, dd, h1, h2, h3')) {
        if (!isVisible(el)) continue;
        if (!el.textContent || !el.textContent.trim()) continue;
        if (el.closest('[aria-hidden="true"]') || el.closest('[role="img"]')) continue;
        if (el.closest('[data-decorative]')) continue;
        const size = parseFloat(getComputedStyle(el).fontSize);
        if (size < 10 && el.children.length === 0) {
          out.tinyText.push({ size, text: el.textContent.trim().slice(0, 30) });
        }
      }
      out.offenders = out.offenders.slice(0, 6);
      out.smallTargets = out.smallTargets.slice(0, 6);
      out.tinyText = out.tinyText.slice(0, 6);
      return out;
    }, { isMobile: viewport.mobile });

    report(!result.emptyRoot, `${path} renders content`);
    report(result.overflowX <= 1, `${path} no horizontal overflow`, `${result.overflowX}px over`);
    report(result.offenders.length === 0, `${path} nothing off-screen right`, JSON.stringify(result.offenders));
    if (viewport.mobile) {
      report(result.smallTargets.length === 0, `${path} tap targets >= 32px`, JSON.stringify(result.smallTargets));
    }
    report(result.tinyText.length === 0, `${path} no text under 10px`, JSON.stringify(result.tinyText));
  }

  await context.close();
}

// Contrast and structure checks on the landing page (desktop + mobile)
for (const viewport of [{ width: 1440, height: 960 }, { width: 390, height: 844 }]) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  const contrast = await page.evaluate(() => {
    const parse = (color) => {
      const m = color.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const parts = m[1].split(',').map((v) => parseFloat(v));
      return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 };
    };
    const lum = ({ r, g, b }) => {
      const f = (c) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ratio = (fg, bg) => {
      const L1 = lum(fg);
      const L2 = lum(bg);
      return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    };
    const bgOf = (el) => {
      let node = el;
      while (node && node !== document.documentElement) {
        const c = parse(getComputedStyle(node).backgroundColor);
        if (c && c.a > 0.6) return c;
        node = node.parentElement;
      }
      const bodyBg = parse(getComputedStyle(document.body).backgroundColor);
      return bodyBg && bodyBg.a > 0.6 ? bodyBg : { r: 250, g: 248, b: 245, a: 1 };
    };
    const bad = [];
    const seen = new Set();
    for (const el of document.querySelectorAll('h1, h2, h3, p, li, a, button, span, dt, dd')) {
      if (!el.textContent || !el.textContent.trim()) continue;
      if (el.children.length > 0) continue;
      // Skip decorative artwork and generated avatar graphics (image substitutes).
      if (el.closest('[aria-hidden="true"]') || el.closest('[role="img"]')) continue;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const fg = parse(style.color);
      if (!fg) continue;
      const bg = bgOf(el);
      const r = ratio(fg, bg);
      const size = parseFloat(style.fontSize);
      const weight = Number(style.fontWeight) || 400;
      const large = size >= 24 || (size >= 18.66 && weight >= 700);
      const min = large ? 3 : 4.5;
      if (r < min) {
        const key = `${style.color}|${size}`;
        if (!seen.has(key)) {
          seen.add(key);
          bad.push({
            text: el.textContent.trim().slice(0, 34),
            color: style.color,
            size,
            ratio: Number(r.toFixed(2)),
            need: min,
          });
        }
      }
    }
    return bad.slice(0, 8);
  });
  report(contrast.length === 0, `contrast (landing @ ${viewport.width}px)`, JSON.stringify(contrast));

  const a11y = await page.evaluate(() => {
    const issues = [];
    for (const img of document.querySelectorAll('img')) {
      if (!img.hasAttribute('alt')) issues.push(`img without alt: ${img.src.slice(-40)}`);
    }
    for (const btn of document.querySelectorAll('button')) {
      const text = (btn.textContent || '').trim();
      const label = btn.getAttribute('aria-label');
      if (!text && !label && !btn.querySelector('svg[aria-label]')) issues.push(`button without accessible name: ${btn.className}`);
    }
    const h1s = document.querySelectorAll('h1');
    if (h1s.length !== 1) issues.push(`expected exactly one h1, found ${h1s.length}`);
    return issues.slice(0, 6);
  });
  report(a11y.length === 0, `a11y basics (landing @ ${viewport.width}px)`, JSON.stringify(a11y));
  await context.close();
}

await browser.close();
console.log(`\n${checks - failures}/${checks} checks passed, ${failures} failed\n`);
process.exitCode = failures === 0 ? 0 : 1;
