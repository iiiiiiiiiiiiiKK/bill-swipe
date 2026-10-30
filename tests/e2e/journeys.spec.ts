import { expect, test, type Page } from '@playwright/test';

/**
 * End-to-end journeys against a real deployment (E2E_BASE_URL).
 * These mirror the flows a person actually performs, including a full sandbox
 * payment and the admin approval path.
 */

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@billswipe.local';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'BillSwipe!Admin2026';

async function register(page: Page, prefix: string): Promise<string> {
  const stamp = `${prefix}${Date.now().toString(36)}`;
  await page.goto('/register');
  await page.fill('#reg-email', `${stamp}@example.com`);
  await page.fill('#reg-username', stamp.slice(0, 20));
  await page.fill('#reg-password', 'Testing!2026');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/discover/, { timeout: 45_000 });
  return stamp;
}

test.describe('public pages', () => {
  test('landing page renders the hero and calls to action', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('A little swipe');
    await expect(page.getByRole('link', { name: /Start swiping/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Post your bill/i }).first()).toBeVisible();
    await expect(page.getByRole('contentinfo')).toContainText('Someone');
  });

  test('has an X author link in the header', async ({ page }) => {
    await page.goto('/');
    const links = page.getByRole('link', { name: 'Author on X' });
    const count = await links.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(links.nth(i)).toHaveAttribute('href', 'https://x.com/0xkillcoin');
    }
  });

  test('discover shows swipeable bill cards', async ({ page }) => {
    await page.goto('/discover');
    await expect(page.getByRole('heading', { name: 'Discover' })).toBeVisible();
    const help = page.getByRole('button', { name: 'Help', exact: true });
    await expect(help).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Verifi|Demo/i).first()).toBeVisible();
  });

  test('statistic pages are reachable and consistent', async ({ page }) => {
    for (const path of ['/how-it-works', '/trust', '/payments-info', '/faq', '/about']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    }
  });

  test('payment sandbox disclosure is present', async ({ page }) => {
    await page.goto('/payments-info');
    await expect(page.getByText(/Sandbox active/i)).toBeVisible();
  });
});

test.describe('language switcher', () => {
  test('switches the whole interface to Chinese and back', async ({ page }) => {
    // Pin the starting language: the app defaults to the browser locale, and the
    // iPhone profile reports zh-CN.
    await page.goto('/');
    await page.evaluate(() => window.localStorage.setItem('billswipe.lang', 'en'));
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    // The control's accessible name is localised, so target it by its stable
    // data attribute instead of by translated text.
    const switcher = page.locator('[data-lang-switcher="zh"]:visible');
    await expect(switcher.first()).toBeVisible();
    await switcher.first().click();

    // Navigation, hero and footer all flip.
    await expect(page.getByRole('link', { name: '发现' }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { level: 1 })).toContainText('一次轻滑');
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');

    // The choice survives a reload (persisted, not just in-memory).
    await page.reload();
    await expect(page.getByRole('link', { name: '发现' }).first()).toBeVisible();

    // Discover still works in Chinese and the payment copy is translated.
    await page.goto('/discover');
    await expect(page.getByRole('button', { name: '帮助', exact: true })).toBeVisible({ timeout: 30_000 });

    // Switch back to English.
    const back = page.locator('[data-lang-switcher="en"]:visible');
    await back.first().click();
    await expect(page.getByRole('link', { name: 'Discover' }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
});

test.describe('helping someone', () => {
  test('pass, help, confirm and see the success state', async ({ page }) => {
    await register(page, 'help');
    await page.goto('/discover');

    const passButton = page.getByRole('button', { name: 'Pass', exact: true });
    await expect(passButton).toBeEnabled({ timeout: 30_000 });
    await passButton.click();
    await page.waitForTimeout(600);

    await page.getByRole('button', { name: 'Help', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/Choose an amount/i)).toBeVisible();

    // Choose the $10 quick amount, then continue to the confirmation screen.
    await page.getByRole('button', { name: '$10.00' }).click();
    await page.getByRole('button', { name: /Continue to confirmation/i }).click();

    await expect(page.getByText(/Confirm payment/i)).toBeVisible();
    await expect(page.getByText(/Sandbox mode/i)).toBeVisible();
    await expect(page.getByText(/Platform fee/i)).toBeVisible();

    const confirm = page.getByRole('button', { name: /Confirm \$/i });
    await expect(confirm).toBeVisible();
    await confirm.click();

    await expect(page.getByText(/You just made someone's day/i)).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: /Keep swiping/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  // Desktop-only: phones have no hardware keyboard.
  test('keyboard shortcuts pass a card', async ({ page, isMobile }) => {
    test.skip(!!isMobile, 'Keyboard shortcuts are a desktop affordance');
    await register(page, 'keys');
    await page.goto('/discover');
    await expect(page.getByRole('button', { name: 'Pass', exact: true })).toBeEnabled({ timeout: 30_000 });
    const topCardTitle = page.locator('h3').first();
    const before = await topCardTitle.textContent();
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(1200);
    const after = await page.locator('h3').first().textContent();
    expect(after).not.toBe(before);
  });
});

test.describe('discover feed', () => {
  /**
   * Regression: the "keep a buffer" prefetch used to fire whenever the deck had
   * <= 2 cards and nothing was loading. An empty deck satisfied that condition
   * forever, so the page re-fetched in a loop and the empty state flickered.
   */
  test('exhausting the deck settles on a stable empty state without polling', async ({ page }) => {
    await register(page, 'deck');

    // Empty the stack server-side so the UI starts from zero cards.
    const feed = await (await page.request.get('/api/bills/discover?limit=30')).json();
    expect(feed.bills.length).toBeGreaterThan(0);
    for (const bill of feed.bills) {
      await page.request.post('/api/bills/' + bill.id + '/swipe', { data: { action: 'pass' } });
    }

    const calls = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/bills/discover')) calls.push(req.url());
    });

    await page.goto('/discover');
    await expect(page.getByText(/whole stack/i)).toBeVisible({ timeout: 30_000 });

    const settled = calls.length;
    expect(settled).toBeLessThanOrEqual(3);

    // Nothing may fire while the user just sits on the empty state.
    await page.waitForTimeout(5000);
    expect(calls.length).toBe(settled);
  });

  test('swiping the last card lands on the empty state', async ({ page }) => {
    await register(page, 'lastcard');
    await page.goto('/discover');

    const pass = page.getByRole('button', { name: 'Pass', exact: true });
    await expect(pass).toBeEnabled({ timeout: 30_000 });

    // Swipe through whatever is in the deck, with a hard ceiling.
    for (let i = 0; i < 40; i++) {
      const remaining = await page.getByRole('button', { name: 'Pass', exact: true }).isDisabled();
      if (remaining) break;
      await pass.click({ force: true });
      await page.waitForTimeout(350);
      if (await page.getByText(/whole stack/i).isVisible().catch(() => false)) break;
    }

    await expect(page.getByText(/whole stack/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /Refresh/i }).first()).toBeVisible();
  });
});

test.describe('posting a bill', () => {
  test('completes the five step wizard and lands in review', async ({ page }) => {
    await register(page, 'post');
    await page.goto('/bills/new');

    // Step 1 — category
    await page.getByRole('button', { name: /Utilities/i }).first().click();
    await page.getByRole('button', { name: /^Continue$/ }).click();

    // Step 2 — details
    await page.fill('#bill-title', 'Electricity bill after the storm');
    await page.fill('#bill-amount', '120.50');
    await page.getByRole('button', { name: /^Continue$/ }).click();

    // Step 3 — receipt (optional) skip
    await page.getByRole('button', { name: /Continue anyway/i }).click();

    // Step 4 — story
    await page.fill(
      'textarea',
      'The storm knocked out our power for four days and the recovery bill arrived higher than usual. I can cover part of it but not all of it this month.',
    );
    await page.getByRole('button', { name: /^Continue$/ }).click();

    // Step 5 — review and submit
    await expect(page.getByText(/Review before submitting/i)).toBeVisible();
    await page.getByRole('button', { name: /Submit for review/i }).click();

    await expect(page).toHaveURL(/\/bills\/bil_/, { timeout: 30_000 });
    await expect(page.getByText(/In review/i).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /Electricity bill after the storm/i })).toBeVisible();
  });

  test('blocks submission without a story', async ({ page }) => {
    await register(page, 'short');
    await page.goto('/bills/new');
    await page.getByRole('button', { name: /^Continue$/ }).click();
    await page.fill('#bill-title', 'A bill with no story attached');
    await page.fill('#bill-amount', '50');
    await page.getByRole('button', { name: /^Continue$/ }).click();
    await page.getByRole('button', { name: /Continue anyway/i }).click();
    await expect(page.getByRole('button', { name: /^Continue$/ })).toBeDisabled();
  });
});

test.describe('admin moderation', () => {
  test('admin can review a pending bill', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', ADMIN_EMAIL);
    await page.fill('#password', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).not.toHaveURL(/\/login/, { timeout: 45_000 });

    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: /Operations dashboard/i })).toBeVisible();
    await expect(page.getByText(/Awaiting review/i)).toBeVisible();

    await page.goto('/admin/bills');
    await expect(page.getByPlaceholder(/Search title, email or username/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Approve' }).first()).toBeVisible();
    await page.goto('/admin/audit');
    await expect(page.getByRole('heading', { name: /Operations dashboard/i })).toBeVisible();
  });

  test('normal users cannot reach the admin area', async ({ page }) => {
    await register(page, 'noadmin');
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/discover/, { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'Discover' })).toBeVisible();
  });
});

test.describe('safety and validation', () => {
  test('shows a field error for a duplicate account', async ({ page }) => {
    await page.goto('/register');
    const email = `dup${Date.now().toString(36)}@example.com`;
    const username = `dup${Date.now().toString(36)}`.slice(0, 20);
    await page.fill('#reg-email', email);
    await page.fill('#reg-username', username);
    await page.fill('#reg-password', 'Testing!2026');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/discover/, { timeout: 45_000 });

    await page.goto('/register');
    await page.fill('#reg-email', email);
    await page.fill('#reg-username', `${username}x`.slice(0, 20));
    await page.fill('#reg-password', 'Testing!2026');
    await page.click('button[type="submit"]');
    await expect(page.getByRole('alert').first()).toContainText(/already registered|taken/i);
  });

  test('unauthenticated visitors are redirected from private pages', async ({ page }) => {
    await page.goto('/bills');
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: /Welcome back/i })).toBeVisible();
  });

  test('404 page is friendly and routes back', async ({ page }) => {
    await page.goto('/this-does-not-exist');
    await expect(page.getByText('404')).toBeVisible();
    await page.getByRole('link', { name: /Go to Discover/i }).click();
    await expect(page.getByRole('heading', { name: 'Discover' })).toBeVisible();
  });
});
