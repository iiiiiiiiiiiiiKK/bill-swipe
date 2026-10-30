import type { Db } from '../db';
import { nowIso } from '../db';
import type { UserRow } from '../db/rows';
import { avatarSeedFor, randomId, sha256Hex } from '../auth/crypto';
import { hashPassword } from '../auth/crypto';
import type { Env } from '../env';

/**
 * Demo data is clearly labelled everywhere in the UI (is_demo = 1).
 * Stories, people and receipts are fictional; no real personal data is used.
 */

interface DemoUser {
  username: string;
  displayName: string;
  bio: string;
  country: string;
  region: string;
}

interface DemoBill {
  username: string;
  title: string;
  category: string;
  targetAmount: number;
  raisedAmount: number;
  story: string;
  daysAgo: number;
  dueInDays: number;
}

const DEMO_USERS: DemoUser[] = [
  { username: 'maria_r', displayName: 'Maria R.', bio: 'Night shift nurse. Mom of two. Trying to keep the lights on.', country: 'US', region: 'Ohio' },
  { username: 'james_k', displayName: 'James K.', bio: 'Warehouse worker, back on my feet after surgery.', country: 'US', region: 'Texas' },
  { username: 'aisha_n', displayName: 'Aisha N.', bio: 'Student, part-time barista, full-time optimist.', country: 'GB', region: 'Manchester' },
  { username: 'diego_s', displayName: 'Diego S.', bio: 'Line cook. Dad. Bad at asking for help, trying anyway.', country: 'US', region: 'Arizona' },
  { username: 'lin_wei', displayName: 'Lin W.', bio: 'Grad student far from home.', country: 'CA', region: 'Toronto' },
  { username: 'tom_b', displayName: 'Tom B.', bio: 'Retired teacher, currently a full-time caregiver.', country: 'US', region: 'Oregon' },
  { username: 'priya_m', displayName: 'Priya M.', bio: 'Two jobs, one very determined kid.', country: 'US', region: 'New Jersey' },
  { username: 'sam_o', displayName: 'Sam O.', bio: 'Just moved cities for a fresh start.', country: 'AU', region: 'Melbourne' },
  { username: 'nadia_h', displayName: 'Nadia H.', bio: 'Freelance designer between contracts.', country: 'US', region: 'Illinois' },
  { username: 'chris_d', displayName: 'Chris D.', bio: 'Bike courier. Rain or shine.', country: 'US', region: 'Washington' },
  { username: 'emeka_a', displayName: 'Emeka A.', bio: 'Caretaker for my grandmother. Learning to accept kindness.', country: 'US', region: 'Georgia' },
  { username: 'sofia_v', displayName: 'Sofia V.', bio: 'Single mom, dental hygienist in training.', country: 'US', region: 'Florida' },
  { username: 'yusuf_t', displayName: 'Yusuf T.', bio: 'Apprentice electrician. Tools cost money, apparently.', country: 'US', region: 'Michigan' },
  { username: 'grace_l', displayName: 'Grace L.', bio: 'Choir teacher. Loud laugh, small budget.', country: 'US', region: 'Missouri' },
  { username: 'han_j', displayName: 'Han J.', bio: 'Delivery driver with a broken van and a stubborn streak.', country: 'US', region: 'Nevada' },
  { username: 'rosa_e', displayName: 'Rosa E.', bio: 'Cleaning two offices before sunrise.', country: 'US', region: 'California' },
];

const DEMO_BILLS: DemoBill[] = [
  {
    username: 'maria_r',
    title: 'Groceries for the week until my first paycheck',
    category: 'groceries',
    targetAmount: 18650,
    raisedAmount: 4500,
    daysAgo: 2,
    dueInDays: 6,
    story:
      "I just started a new job at the hospital, but my first paycheck won't arrive until next Friday. Between rent and bus fare, there is nothing left for food this week. My two kids are seven and four — they think cereal for dinner is a fun adventure, and I'm trying to keep it that way. This would cover a real grocery run: milk, eggs, rice, fruit, and enough pasta to survive until payday.",
  },
  {
    username: 'james_k',
    title: 'Physical therapy sessions after knee surgery',
    category: 'medical',
    targetAmount: 42000,
    raisedAmount: 27000,
    daysAgo: 5,
    dueInDays: 12,
    story:
      "I tore a ligament loading a truck in March. Surgery went well, but insurance approved only four physical therapy visits and I need twelve to get cleared for work. I'm paying for the rest out of pocket and I'm three sessions short of finishing. Being able to walk without pain means going back to my job, which means catching up on everything else.",
  },
  {
    username: 'aisha_n',
    title: 'Final semester textbook and exam fees',
    category: 'education',
    targetAmount: 32400,
    raisedAmount: 18000,
    daysAgo: 1,
    dueInDays: 9,
    story:
      "I'm three weeks from finishing my nursing degree. The last semester squeezed everything out of my savings, and the placement year is unpaid. I need two textbooks and the registration fee for the licensing exam. I already work 20 hours a week at a cafe, and I'd rather ask for this than drop a module now, this close to the finish line.",
  },
  {
    username: 'diego_s',
    title: 'February rent while I recover from a burn injury',
    category: 'rent',
    targetAmount: 95000,
    raisedAmount: 38000,
    daysAgo: 3,
    dueInDays: 4,
    story:
      "A hot oil splash at the restaurant put me out of work for four weeks — the kitchen gave me my shifts back the moment I'm cleared, but rent was due before that. My daughter stays with me every other weekend, and I don't want her hearing that we might lose the apartment. Rent is 950, I have 380 saved from selling my tools, and I'm asking for help covering the rest.",
  },
  {
    username: 'lin_wei',
    title: 'Winter coat, boots and heating for my first Canadian winter',
    category: 'utilities',
    targetAmount: 21500,
    raisedAmount: 6700,
    daysAgo: 4,
    dueInDays: 15,
    story:
      "I moved from a city that never gets below 20掳C. My first Canadian winter is here and I own exactly one thin jacket. My scholarship covers tuition and a shared room, but not a coat, proper boots, or the extra heating bill. I calculated everything carefully: 120 for a coat, 60 for boots, and the rest for two months of heating. I wear two pairs of socks around the apartment and I'm honestly scared of February.",
  },
  {
    username: 'tom_b',
    title: 'Wheelchair ramp so my sister can come home',
    category: 'medical',
    targetAmount: 68000,
    raisedAmount: 51000,
    daysAgo: 8,
    dueInDays: 20,
    story:
      "My sister Dana has been in a rehabilitation centre for five months. The plan is for her to come home to me in the spring, but our house has three steps in front and she uses a wheelchair. The ramp needs to be built to code, and I've had quotes: the materials alone are 680. I spent my savings on hospital parking this year. The quote is attached — I'm not asking for anything beyond what the contractor wrote.",
  },
  {
    username: 'priya_m',
    title: 'School supplies and uniform for my son',
    category: 'education',
    targetAmount: 14500,
    raisedAmount: 9200,
    daysAgo: 6,
    dueInDays: 11,
    story:
      "My son started year 4 this week and grew four inches over the summer, which means the whole uniform from last year fits exactly nobody. I work two jobs — morning shift at a pharmacy, evenings at a restaurant — but the school year always hits at the worst time. This covers a uniform, new shoes, and the standard supply list his teacher sent. Nothing extra.",
  },
  {
    username: 'sam_o',
    title: 'Bond and first month rent for a small studio',
    category: 'rent',
    targetAmount: 120000,
    raisedAmount: 33000,
    daysAgo: 9,
    dueInDays: 18,
    story:
      "I moved to Melbourne six weeks ago for work and I've been sleeping on a friend's couch. I finally found a studio I can afford, but it wants four weeks bond plus the first month up front. I don't have family who can cover it, and my savings went into the move. I have a signed job offer, this is a scheduling problem, not a stability one — I just need a bridge to move in.",
  },
  {
    username: 'nadia_h',
    title: 'Two months of invoices that never got paid',
    category: 'emergency',
    targetAmount: 26000,
    raisedAmount: 3000,
    daysAgo: 1,
    dueInDays: 7,
    story:
      "A client closed their company in July and I found out in September, along with 6,000 in unpaid invoices. Freelance life means no unemployment safety net. I've picked up new work starting in October, but the gap between now and then is real: my phone bill, internet (I need it for work), and food. I already cancelled everything I could cut. This is the number, and I'll be honest if it changes.",
  },
  {
    username: 'chris_d',
    title: 'Repair for the bike that pays my rent',
    category: 'transportation',
    targetAmount: 34000,
    raisedAmount: 12000,
    daysAgo: 7,
    dueInDays: 5,
    story:
      "My rear wheel cracked on a delivery run and took the gear cassette with it. Without the bike I lose the job — it's not a hobby, it's my entire income. The shop quoted me for a new wheel, cassette, and a safety service. I've borrowed a friend's spare bike for one week, then it goes back. If I can get this fixed I'm earning again by the weekend.",
  },
  {
    username: 'emeka_a',
    title: 'Assisted living deposit for my grandmother',
    category: 'medical',
    targetAmount: 75000,
    raisedAmount: 46000,
    daysAgo: 12,
    dueInDays: 21,
    story:
      "I've been caring for my grandmother at home for two years while working full time, and it's no longer safe for her to be alone during my shifts. The assisted living facility has a place for her, but there's an upfront deposit. I've sold my car and I'm halfway there. She raised me, and I want her to be somewhere with people around her during the day instead of a silent living room and a TV.",
  },
  {
    username: 'sofia_v',
    title: "Dental work I've postponed for two years",
    category: 'medical',
    targetAmount: 89000,
    raisedAmount: 21000,
    daysAgo: 10,
    dueInDays: 25,
    story:
      "I've been putting off a cracked molar because the dental plan at my job covers cleanings and almost nothing else. It went from sensitive to painful to a constant throb, and now the dentist says the tooth may not be savable. The estimate includes the crown and the root canal. Left any longer, the price goes up and the tooth goes away. My kids' appointments always came first. This time I'm asking.",
  },
  {
    username: 'yusuf_t',
    title: 'Starter tool kit for my electrical apprenticeship',
    category: 'education',
    targetAmount: 48000,
    raisedAmount: 31000,
    daysAgo: 11,
    dueInDays: 14,
    story:
      "I got accepted into a union apprenticeship — my first real career. I need to show up on day one with my own hand tools, meter, and steel-toed boots. The list is specific and the total is 480. I've been saving from my current job at a hardware store, but it's not enough. I'll take the tools anywhere for years. This is genuinely the last coin in the machine.",
  },
  {
    username: 'grace_l',
    title: 'Furnace repair before the first freeze',
    category: 'utilities',
    targetAmount: 58000,
    raisedAmount: 12000,
    daysAgo: 2,
    dueInDays: 8,
    story:
      "The furnace stopped working last Tuesday and the repair company found a cracked heat exchanger. I teach choir at a middle school and I'm not exactly rolling in it, but the thing that scares me is the estimate: five hundred eighty. My mom lives with me and she's 78. I'm using two space heaters to keep her bedroom warm, and the electric bill is going to be brutal. After this I'll start the payment plan for the rest.",
  },
  {
    username: 'han_j',
    title: 'Van transmission repair to keep my deliveries',
    category: 'transportation',
    targetAmount: 145000,
    raisedAmount: 62000,
    daysAgo: 13,
    dueInDays: 10,
    story:
      "My van is my job. Without it I can't take routes, and I can't afford a rental while I save for the repair — that's the trap. The transmission shop quoted me for a rebuild, and I've been driving a borrowed car for two weeks which runs out Friday. I've delivered in this city for nine years. If I can cover the repair, I'm working again the day it's done.",
  },
  {
    username: 'rosa_e',
    title: 'Deposit for a safer apartment for me and my daughter',
    category: 'rent',
    targetAmount: 165000,
    raisedAmount: 47000,
    daysAgo: 15,
    dueInDays: 30,
    story:
      "The building we live in has no working lock on the back door and I've asked the landlord four times. I found a small place two streets away, cheaper per month, but the deposit is the wall. I clean two offices every morning before the staff arrive — I've never missed a day. My daughter is nine. I want her to be able to sleep without me checking the door twice a night.",
  },
];

const HELPER_BLURB = [
  'Small thing, but I have been there.',
  'This story stayed with me. Sending what I can.',
  'Good luck — rooting for you.',
  'Payday came through, so here you go.',
  'No one should have to choose between food and bus fare.',
  'Adding a little. Wish it were more.',
];

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function daysFromNowIso(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

export async function ensureSeed(db: Db, env: Env): Promise<void> {
  const seeded = db.getMeta('demo_seeded');
  if (seeded) return;

  const now = nowIso();
  const adminEmail = (env.ADMIN_EMAIL ?? 'admin@billswipe.local').toLowerCase();
  const adminPassword = env.ADMIN_PASSWORD ?? 'BillSwipe!Admin2026';

  const existingAdmin = db.first<UserRow>('SELECT * FROM users WHERE lower(email) = ?', adminEmail);
  if (!existingAdmin) {
    const adminId = randomId('usr');
    const hash = await hashPassword(adminPassword);
    db.run(
      `INSERT INTO users (id, email, email_verified, password_hash, username, display_name, avatar_url, avatar_seed,
         bio, country, region, role, account_status, created_at, updated_at)
       VALUES (?, ?, 1, ?, 'billswipe_team', 'BILL SWIPE Team', NULL, ?, 'Keeping the platform safe and kind.', 'US', '', 'admin', 'active', ?, ?)`,
      adminId,
      adminEmail,
      hash,
      avatarSeedFor(`admin:${adminId}`),
      now,
      now,
    );
  }

  const helperIds: string[] = [];
  const demoHelperSeeds = [
    { username: 'kindneighbor', name: 'Kind Neighbor', bio: 'I help where I can.' },
    { username: 'quiet_giver', name: 'Quiet Giver', bio: 'Prefers to stay anonymous.' },
  ];

  for (const helper of demoHelperSeeds) {
    const existing = db.first<UserRow>('SELECT * FROM users WHERE lower(username) = ?', helper.username);
    if (existing) {
      helperIds.push(existing.id);
      continue;
    }
    const id = randomId('usr');
    const hash = await hashPassword(`demo-${randomId('x')}`);
    db.run(
      `INSERT INTO users (id, email, email_verified, password_hash, username, display_name, avatar_url, avatar_seed,
         bio, country, region, role, account_status, is_demo, created_at, updated_at)
       VALUES (?, ?, 1, ?, ?, ?, NULL, ?, ?, 'US', '', 'user', 'active', 1, ?, ?)`,
      id,
      `${helper.username}@demo.billswipe.local`,
      hash,
      helper.username,
      helper.name,
      avatarSeedFor(`demo-helper:${id}`),
      helper.bio,
      daysAgoIso(90),
      now,
    );
    helperIds.push(id);
  }

  for (const demo of DEMO_USERS) {
    const userId = randomId('usr');
    const hash = await hashPassword(`demo-${randomId('x')}`);
    db.run(
      `INSERT INTO users (id, email, email_verified, password_hash, username, display_name, avatar_url, avatar_seed,
         bio, country, region, role, account_status, is_demo, created_at, updated_at)
       VALUES (?, ?, 1, ?, ?, ?, NULL, ?, ?, ?, ?, 'user', 'active', 1, ?, ?)`,
      userId,
      `${demo.username}@demo.billswipe.local`,
      hash,
      demo.username,
      demo.displayName,
      avatarSeedFor(`demo:${demo.username}:${userId}`),
      demo.bio,
      demo.country,
      demo.region,
      daysAgoIso(120),
      now,
    );
  }

  for (const demo of DEMO_BILLS) {
    const owner = db.first<UserRow>('SELECT * FROM users WHERE lower(username) = ?', demo.username);
    if (!owner) continue;
    const billId = randomId('bil');
    const createdAt = daysAgoIso(demo.daysAgo);
    const receiptId = randomId('rcp');
    const sha = await sha256Hex(`demo-receipt:${billId}`);
    db.run(
      `INSERT INTO receipts (id, bill_id, user_id, private_key, public_key, file_name, mime_type, size, sha256, width, height, scan_status, created_at)
       VALUES (?, ?, ?, ?, NULL, ?, 'image/svg+xml', ?, ?, 1200, 1600, 'demo', ?)`,
      receiptId,
      billId,
      owner.id,
      `demo/${billId}.svg`,
      `${demo.category}-receipt-demo.svg`,
      48_000,
      sha,
      createdAt,
    );
    const status = demo.raisedAmount >= demo.targetAmount ? 'fully_funded' : 'active';
    db.run(
      `INSERT INTO bills (id, user_id, title, description, category, target_amount, raised_amount, paid_amount, currency,
         due_date, settlement_handle, receipt_id, receipt_private_path, receipt_public_path, verification_status,
         bill_status, review_note, risk_flags, is_demo, fundraise_key, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'USD', ?, NULL, ?, ?, NULL, 'verified', ?, 'Demo record — fictional story for product preview.', '[]', 1, ?, ?, ?)`,
      billId,
      owner.id,
      demo.title,
      demo.story,
      demo.category,
      demo.targetAmount,
      demo.raisedAmount,
      Math.max(0, demo.targetAmount - demo.raisedAmount),
      daysFromNowIso(demo.dueInDays),
      receiptId,
      `demo/${billId}.svg`,
      status,
      randomId('fnd'),
      createdAt,
      createdAt,
    );
    db.run(
      `INSERT INTO bill_updates (id, bill_id, body, author, created_at) VALUES (?, ?, ?, ?, ?)`,
      randomId('upd'),
      billId,
      'Bill verified and live in Discover.',
      'BILL SWIPE Review',
      createdAt,
    );

    // Create demo help records that reconcile with raised_amount.
    const helpers = helperIds.length + 1;
    let remaining = demo.raisedAmount;
    let i = 0;
    while (remaining > 0) {
      const helperId = i < helperIds.length ? helperIds[i]! : helperIds[0]!;
      const chunk = i === helpers - 1 ? remaining : Math.min(remaining, Math.max(500, Math.round(remaining / Math.max(2, helpers - i))));
      const paymentId = randomId('pay');
      const helpId = randomId('hlp');
      const at = daysAgoIso(Math.max(0.05, demo.daysAgo - (i + 1) * 0.4));
      const anonymous = i === 1 ? 1 : 0;
      db.run(
        `INSERT INTO payments (id, payer_id, bill_id, amount, fee, currency, platform_fee_bps, payment_provider,
           provider_payment_id, client_idempotency_key, payment_status, is_anonymous, created_at, updated_at)
         VALUES (?, ?, ?, ?, 0, 'USD', 0, 'sandbox', ?, ?, 'succeeded', ?, ?, ?)`,
        paymentId,
        helperId,
        billId,
        chunk,
        `demo_${paymentId}`,
        `demo-idem-${paymentId}`,
        anonymous,
        at,
        at,
      );
      db.run(
        `INSERT INTO help_records (id, bill_id, payment_id, payer_id, amount, currency, is_anonymous, message, created_at)
         VALUES (?, ?, ?, ?, ?, 'USD', ?, ?, ?)`,
        helpId,
        billId,
        paymentId,
        helperId,
        chunk,
        anonymous,
        HELPER_BLURB[i % HELPER_BLURB.length]!,
        at,
      );
      const helper = db.first<UserRow>('SELECT * FROM users WHERE id = ?', helperId);
      db.run(
        `INSERT INTO community_posts (id, bill_id, payment_id, actor_id, kind, headline, detail, amount, currency, created_at)
         VALUES (?, ?, ?, ?, 'help', ?, ?, ?, 'USD', ?)`,
        randomId('pst'),
        billId,
        paymentId,
        helperId,
        `${anonymous ? 'Someone kind' : helper?.display_name ?? 'A helper'} helped ${owner.display_name} with ${demo.title}`,
        HELPER_BLURB[i % HELPER_BLURB.length]!,
        chunk,
        at,
      );
      remaining -= chunk;
      i++;
    }
  }

  // A few social comments on recent community posts to make the feed feel alive.
  const posts = db.all<{ id: string }>('SELECT id FROM community_posts ORDER BY created_at DESC LIMIT 4');
  const commentBodies = [
    'This is what the internet should be for.',
    'Sent a little. Hope it helps!',
    'Reading this made my morning better.',
    'Been there. Hang in there.',
  ];
  posts.forEach((post, index) => {
    db.run(
      `INSERT INTO community_comments (id, post_id, user_id, body, status, created_at) VALUES (?, ?, ?, ?, 'visible', ?)`,
      randomId('cmt'),
      post.id,
      helperIds[0]!,
      commentBodies[index % commentBodies.length]!,
      nowIso(),
    );
    db.run(
      `INSERT INTO community_likes (post_id, user_id, created_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING`,
      post.id,
      helperIds[0]!,
      nowIso(),
    );
  });

  db.setMeta('demo_seeded', now);
}

