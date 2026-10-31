/**
 * Local before/after probe for the Discover polling bug.
 *
 * Serves a built SPA bundle plus a stub API that always returns an empty bill
 * page, then counts how many times the page asks for the feed within 6 seconds.
 * The pre-fix bundle loops; the fixed bundle asks once and stops.
 *
 * Usage: node scripts/_loop-compare.mjs
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
};

async function start(dir, port) {
  const root = resolve(dir);
  let feedCalls = 0;
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname.startsWith('/api/')) {
      if (url.pathname === '/api/bills/discover') feedCalls++;
      const json = (payload) => {
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(payload));
      };
      if (url.pathname === '/api/auth/session') return json({ user: null });
      if (url.pathname === '/api/me/notifications') return json({ items: [], unread: 0 });
      if (url.pathname === '/api/community') return json({ posts: [], stats: null });
      // Deck is empty and nothing remains.
      return json({ bills: [], remaining: 0 });
    }
    let file = join(root, url.pathname);
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html');
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' }).end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  await new Promise((ok) => server.listen(port, '127.0.0.1', ok));
  return { server, calls: () => feedCalls };
}

async function measure(dir, port) {
  const { server, calls } = await start(dir, port);
  const browser = await chromium.launch();
  // Force English so the empty-state assertion is deterministic (the sandbox
  // browser otherwise reports zh-CN and the UI auto-switches to Chinese).
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'en-US' });
  const page = await context.newPage();
  let requests = 0;
  page.on('request', (req) => {
    if (req.url().includes('/api/bills/discover')) requests++;
  });
  await page.goto('http://127.0.0.1:' + port + '/discover', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);
  const text = await page.locator('body').innerText();
  const empty = /whole stack/i.test(text);
  await browser.close();
  server.close();
  return { requests, serverCalls: calls(), empty };
}

const oldResult = await measure('dist-old', 4711);
console.log('pre-fix bundle :', JSON.stringify(oldResult));
const newResult = await measure('dist', 4712);
console.log('fixed bundle   :', JSON.stringify(newResult));

const ok = oldResult.requests > 3 && newResult.requests <= 1 && newResult.empty;
console.log(ok ? 'RESULT: loop reproduced on the old bundle; the fix stops after one request.' : 'RESULT: unexpected, investigate.');
process.exitCode = ok ? 0 : 1;
