import { Link } from 'react-router-dom';
import { ArrowRight, HeartHandshake, Lock, ScanEye, Star } from 'lucide-react';
import { LinkButton } from '@/components/ui/Button';
import { Logo } from '@/components/brand/Logo';

type Kind = 'how' | 'trust' | 'payments' | 'faq' | 'about';

const CONTENT: Record<Kind, { title: string; eyebrow: string; intro: string; sections: { heading: string; body: string[] }[] }> = {
  how: {
    title: 'How BILL SWIPE works',
    eyebrow: 'Product',
    intro:
      'A bill is a specific number attached to a specific person and a specific week. That is the whole product: make it visible, make helping easy, and never let a swipe quietly become a payment.',
    sections: [
      {
        heading: 'For people who need help',
        body: [
          'Pick a category, enter the exact amount, and upload the bill itself. Write what happened in your own words — the number matters less than the reason.',
          'A moderator reviews the document and the story before anything goes live. You can post updates afterwards so helpers see how it is going.',
          'Once help starts arriving, the amount and recipient lock. That protects everyone: nobody can redirect money after the fact.',
        ],
      },
      {
        heading: 'For people who want to help',
        body: [
          'Discover shows one bill at a time. Swipe left to pass, right when you want to help, up for Super Help — which just opens the amount picker first.',
          'You then choose $5, $10, $25, $50 or a custom amount, see the itemised total, and confirm. Only that confirmation creates a payment.',
          'Anonymous help is one checkbox. Your name never appears to the bill owner or in the community feed.',
        ],
      },
      {
        heading: 'What happens when a bill is funded',
        body: [
          'The moment contributions reach the target, the bill flips to Fully Funded and the API rejects further payment intents for it.',
          'Both the owner and every helper receive a notification. The bill stays visible for a few days so the outcome is not a mystery.',
        ],
      },
    ],
  },
  trust: {
    title: 'Trust & safety',
    eyebrow: 'Safety',
    intro:
      'Money moving between strangers is the highest-risk part of this product, so the guardrails are part of the core design rather than a later patch.',
    sections: [
      {
        heading: 'Before a bill goes live',
        body: [
          'Every bill is human-reviewed: the uploaded document is compared against the stated amount, category and story.',
          'Automated pre-checks flag duplicate receipts (by SHA-256 fingerprint), unusually high amounts, repeated posting, sensitive numbers typed into the story (SSN, card-like digits), and attempts to move the conversation off-platform.',
          'Flagged bills still require a human to approve them — automation never publishes anything by itself.',
        ],
      },
      {
        heading: 'Sensitive data',
        body: [
          'Receipt originals live in private object storage and are only served to authenticated moderators, with no public caching.',
          'Public pages never expose full names, addresses, ID numbers, card numbers or medical details. Demo records are obviously labelled.',
          'We ask uploaders to crop or blur anything sensitive before submitting, and we show that warning at the point of upload.',
        ],
      },
      {
        heading: 'Abuse handling',
        body: [
          'Reports are rate-limited and appear in the admin queue. Every moderation action — approve, reject, suspend, ban, refund, resolve report — is written to an append-only audit log with the acting admin.',
          'You can block a user; blocked people are filtered out of your Discover feed.',
          'Commenting is rate-limited and moderated; harassment or doxxing is removed.',
        ],
      },
    ],
  },
  payments: {
    title: 'Payments & the sandbox',
    eyebrow: 'Payments',
    intro:
      'This deployment runs in Payment Sandbox mode. It exercises the full payment state machine without moving any real money — and it says so everywhere it matters.',
    sections: [
      {
        heading: 'What actually happens',
        body: [
          'Choosing an amount creates a payment intent on the server with status Pending. The client receives an idempotency key so a double tap cannot create two payments.',
          'Confirming calls a server endpoint that settles the intent. The server — not the browser — then updates the payment to Succeeded, writes a help record, and increments the bill total inside a single transaction.',
          'The UI reflects the server response. It never marks a payment as successful on its own.',
        ],
      },
      {
        heading: 'Switching to a real provider',
        body: [
          'The payment layer is isolated behind a provider abstraction. Adding Stripe means: set PAYMENT_MODE=stripe, add STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET, and implement the webhook route that calls the same settle function after signature verification.',
          'No frontend logic changes. The client never sees a secret and never decides the outcome.',
          'Until that is configured and legally reviewed, this build must stay in sandbox mode. It must not be used to collect real money.',
        ],
      },
      {
        heading: 'Refunds and disputes',
        body: [
          'Refunds are a moderator action: the payment moves to Refunded and the bill total is decremented in the same transaction, so totals can never drift.',
          'Bills that received any payment cannot be closed or edited by their owner — this prevents post-hoc bait and switch.',
        ],
      },
    ],
  },
  faq: {
    title: 'Frequently asked questions',
    eyebrow: 'FAQ',
    intro: 'Short answers to the things people ask before trusting a stranger with a bill.',
    sections: [
      {
        heading: 'Does swiping right charge me?',
        body: ['No. A swipe only records intent and opens the amount picker. You confirm an exact amount, fee and total before a payment is created.'],
      },
      {
        heading: 'Is this handling real money today?',
        body: ['Not in this deployment. Payment Sandbox mode is active and every payment is labelled as a sandbox transaction.'],
      },
      {
        heading: 'Who sees my receipt?',
        body: ['You and the moderation team. Originals are private; the public page shows at most a redacted preview.'],
      },
      {
        heading: 'Can I help anonymously?',
        body: ['Yes — either per payment or as a default in your profile. Moderators can still see the record if there is a dispute.'],
      },
      {
        heading: 'What stops someone from posting a fake bill?',
        body: ['Human review plus automated duplicate-receipt detection, amount anomaly checks and report-driven re-review. No system is perfect; that is why reports are one tap away.'],
      },
      {
        heading: 'Why no leaderboards?',
        body: ['Ranking people by generosity turns kindness into a scoreboard. Achievements here track presence, not spending.'],
      },
    ],
  },
  about: {
    title: 'About this project',
    eyebrow: 'About',
    intro:
      'BILL SWIPE is an open-source product experiment: can a swipe-based interface make micro-giving to strangers feel natural without making it careless?',
    sections: [
      {
        heading: 'What is real here',
        body: [
          'The application is fully functional: accounts, sessions, bill authoring with private receipt storage, moderation queue, atomic fund accounting, notifications, reporting, blocking, and an admin dashboard with an audit trail.',
          'It runs on Cloudflare Workers with SQLite-backed Durable Objects and R2 for private documents, so the whole stack deploys without extra services.',
          'Demo bills and demo helpers are seeded and labelled; community statistics are computed from the database, not invented.',
        ],
      },
      {
        heading: 'What is intentionally not real',
        body: [
          'Payments are sandboxed. No card network is contacted, no money moves, and the UI says so on the confirmation screen and in the footer.',
          'Identity verification is out of scope for this build. Before a real launch you would add KYC or a compliant provider that handles it.',
        ],
      },
      {
        heading: 'Follow along',
        body: [
          'The author posts progress, screenshots and product notes on X. Feedback and issues are welcome — this is meant to be read and forked.',
        ],
      },
    ],
  },
};

export default function StaticPage({ kind }: { kind: Kind }) {
  const content = CONTENT[kind];
  return (
    <div className="mx-auto max-w-[840px] px-5 py-10 sm:px-8 lg:py-14">
      <div className="flex items-center gap-2.5">
        <Logo size={34} />
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-ink">{content.eyebrow}</span>
      </div>
      <h1 className="mt-5 text-[30px] font-semibold leading-tight tracking-[-0.035em] sm:text-[38px]">{content.title}</h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[#5C5862]">{content.intro}</p>

      <div className="mt-8 space-y-3">
        {content.sections.map((section, i) => (
          <section key={section.heading} className="rounded-[22px] border border-line bg-white p-5">
            <div className="flex items-center gap-2.5">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-[11px] font-bold text-brand-ink">
                {i + 1}
              </span>
              <h2 className="text-[15px] font-semibold">{section.heading}</h2>
            </div>
            <div className="mt-2.5 space-y-2.5 pl-9">
              {section.body.map((paragraph, j) => (
                <p key={j} className="text-[13.5px] leading-relaxed text-[#3A3740]">
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>

      {kind === 'about' && (
        <a
          href="https://x.com/0xkillcoin"
          target="_blank"
          rel="noreferrer noopener"
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#2c2c2c]"
        >
          Follow @0xkillcoin on X
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </a>
      )}

      {kind === 'payments' && (
        <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-dashed border-[#E4B33D] bg-amber-soft p-4">
          <ScanEye className="mt-0.5 size-4 shrink-0 text-[#9A6600]" aria-hidden="true" />
          <p className="text-[12.5px] leading-relaxed text-[#7A5200]">
            <strong className="font-semibold">Sandbox active.</strong> No real payment provider is configured. Do not use
            this deployment to collect money.
          </p>
        </div>
      )}

      <div className="mt-8 flex flex-wrap gap-2">
        <LinkButton to="/discover" trailing={<ArrowRight className="size-4" aria-hidden="true" />}>
          Browse bills
        </LinkButton>
        <LinkButton to="/bills/new" variant="pass">
          Post a bill
        </LinkButton>
      </div>

      <div className="mt-8 grid gap-2 sm:grid-cols-3">
        {[
          { icon: HeartHandshake, label: 'Swipe to discover', to: '/how-it-works' },
          { icon: Lock, label: 'Private receipts', to: '/trust' },
          { icon: Star, label: 'No leaderboards', to: '/faq' },
        ].map((item) => (
          <Link
            key={item.label}
            to={item.to}
            className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2.5 text-[12.5px] font-semibold text-[#57534E] transition hover:border-[#CFC9C0] hover:text-ink"
          >
            <item.icon className="size-3.5 text-brand-ink" aria-hidden="true" />
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
