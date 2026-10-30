/**
 * Black-box API smoke test against a running deployment.
 * Usage: node scripts/smoke.mjs https://your-deployment.example
 */
const base = process.argv[2] ?? 'http://127.0.0.1:8787';
let cookie = '';
let pass = 0;
let failCount = 0;

function log(name, ok, detail = '') {
  if (ok) {
    pass++;
    console.log(`  ok   ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failCount++;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function req(path, options = {}, attempt = 0) {
  let res;
  try {
    res = await fetch(`${base}${path}`, {
      ...options,
      headers: {
        'content-type': 'application/json',
        ...(cookie ? { cookie } : {}),
        ...(options.headers ?? {}),
      },
    });
  } catch (error) {
    // Sandbox networks drop idle TLS connections; retry once before failing.
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 400));
      return req(path, options, attempt + 1);
    }
    throw error;
  }
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json, headers: res.headers };
}

const stamp = Date.now().toString(36);
const user = { email: `smoke_${stamp}@example.com`, password: 'TestPassw0rd!', username: `smoke_${stamp}`.slice(0, 20) };

console.log(`\nBILL SWIPE API smoke test → ${base}\n`);

let r = await req('/api/health');
log('health', r.status === 200 && r.json.ok === true, `mode=${r.json.paymentMode}`);

r = await req('/api/bills/discover?limit=5');
log('discover (guest)', r.status === 200 && Array.isArray(r.json.bills), `${r.json.bills?.length ?? 0} bills`);

r = await req('/api/me');
log('me (guest) → 401', r.status === 401);

r = await req('/api/auth/register', { method: 'POST', body: JSON.stringify(user) });
log('register', r.status === 200 && r.json.user?.username === user.username, r.json.error?.message ?? '');
const myId = r.json.user?.id;

r = await req('/api/me');
log('me (session)', r.status === 200 && r.json.user?.id === myId);

r = await req('/api/auth/register', { method: 'POST', body: JSON.stringify(user) });
log('duplicate email rejected', r.status === 400 && r.json.error?.code === 'email_taken');

r = await req('/api/bills/discover?limit=10');
const bills = r.json.bills ?? [];
log('discover (auth)', r.status === 200 && bills.length > 0, `${bills.length} bills, ${r.json.remaining} remaining`);
const victim = bills[0];

r = await req(`/api/bills/${victim.id}`);
log('bill detail', r.status === 200 && r.json.bill?.id === victim.id, `${r.json.bill?.helpers?.length ?? 0} helpers`);

r = await req(`/api/bills/${victim.id}/swipe`, { method: 'POST', body: JSON.stringify({ action: 'pass' }) });
log('swipe pass', r.status === 200);

r = await req('/api/swipes/undo', { method: 'POST' });
log('undo swipe', r.status === 200);

// --- payment flow -----------------------------------------------------------
const amount = 1000;
const before = (await req(`/api/bills/${victim.id}`)).json.bill.raisedAmount;
const idem = `smoke-${stamp}-1`;
r = await req('/api/payments/intent', {
  method: 'POST',
  body: JSON.stringify({ billId: victim.id, amount, isAnonymous: false, idempotencyKey: idem }),
});
log('create payment intent', r.status === 201 && r.json.payment?.status === 'pending', `payment ${r.json.payment?.id}`);
const paymentId = r.json.payment?.id;

r = await req('/api/payments/intent', {
  method: 'POST',
  body: JSON.stringify({ billId: victim.id, amount, isAnonymous: false, idempotencyKey: idem }),
});
log('idempotent intent reuse', r.status === 201 && r.json.payment?.id === paymentId);

r = await req(`/api/payments/${paymentId}/sandbox/settle`, { method: 'POST' });
log('sandbox settle', r.status === 200 && r.json.payment?.status === 'succeeded', r.json.error?.message ?? '');

r = await req(`/api/payments/${paymentId}/sandbox/settle`, { method: 'POST' });
log('settle replay is idempotent', r.status === 200 && r.json.alreadySettled === true);

const after = (await req(`/api/bills/${victim.id}`)).json.bill.raisedAmount;
log('raised amount updated once', after === Math.min(before + amount, victim.targetAmount), `${before} → ${after}`);

r = await req('/api/payments/mine');
log('my payments', r.status === 200 && r.json.payments?.some((p) => p.id === paymentId));

r = await req('/api/me/notifications');
log('notifications', r.status === 200 && r.json.items?.length > 0, `${r.json.unread} unread`);

r = await req('/api/community');
log('community feed', r.status === 200 && Array.isArray(r.json.posts) && r.json.stats);

// --- authorisation ----------------------------------------------------------
r = await req('/api/admin/overview');
log('admin blocked for normal user', r.status === 403);

r = await req(`/api/bills/${victim.id}`, { method: 'PATCH', body: JSON.stringify({ title: 'Hijacked title' }) });
log('cannot edit someone else’s bill', r.status === 403 || r.status === 400);

// --- bill authoring ---------------------------------------------------------
r = await req('/api/bills', {
  method: 'POST',
  body: JSON.stringify({
    title: 'Smoke test bill for API verification',
    description:
      'This is an automated smoke test bill created to verify that the posting pipeline, review queue and validation rules work correctly end to end.',
    category: 'utilities',
    targetAmount: 5000,
    currency: 'USD',
  }),
});
log('create bill', r.status === 201 && r.json.bill?.status === 'pending_review');
const myBill = r.json.bill?.id;

r = await req('/api/bills/mine');
log('my bills', r.status === 200 && r.json.bills?.some((b) => b.id === myBill));

r = await req('/api/bills/discover?limit=30');
log('pending bill not in discover', !(r.json.bills ?? []).some((b) => b.id === myBill));

// --- admin ------------------------------------------------------------------
await req('/api/auth/logout', { method: 'POST' });
r = await req('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email: 'admin@billswipe.local', password: 'BillSwipe!Admin2026' }),
});
if (r.status === 200 && r.json.user?.role === 'admin') {
  log('admin login', true);
  const ov = await req('/api/admin/overview');
  log('admin overview', ov.status === 200 && typeof ov.json.users === 'number', `${ov.json.users} users`);

  const pending = await req('/api/admin/bills?status=pending_review');
  log('admin pending queue', pending.status === 200 && pending.json.bills?.some((b) => b.id === myBill));

  const review = await req(`/api/admin/bills/${myBill}/review`, {
    method: 'POST',
    body: JSON.stringify({ action: 'approve', note: 'Smoke test approval' }),
  });
  log('admin approve', review.status === 200);

  const afterApprove = await req('/api/bills/discover?limit=30');
  log('approved bill visible', (afterApprove.json.bills ?? []).some((b) => b.id === myBill));

  const audit = await req('/api/admin/audit');
  log('audit log written', audit.status === 200 && audit.json.logs?.length > 0);

  const refund = await req(`/api/admin/payments/${paymentId}/refund`, {
    method: 'POST',
    body: JSON.stringify({ note: 'Smoke test refund' }),
  });
  log('admin refund', refund.status === 200);

  const afterRefund = (await req(`/api/bills/${victim.id}`)).json.bill.raisedAmount;
  log('refund decrements raised', afterRefund <= after, `${after} → ${afterRefund}`);
} else {
  log('admin login', false, 'default admin credentials not active on this deployment');
}

console.log(`\n${pass} passed, ${failCount} failed\n`);
process.exit(failCount === 0 ? 0 : 1);
