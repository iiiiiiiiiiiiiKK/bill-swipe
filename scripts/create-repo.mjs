const token = process.env.GH_TOKEN;
const headers = {
  Authorization: `token ${token}`,
  'User-Agent': 'dsh',
  Accept: 'application/vnd.github+json',
  'Content-Type': 'application/json',
};

const topics = [
  'swipe',
  'crowdfunding',
  'mutual-aid',
  'cloudflare-workers',
  'durable-objects',
  'react',
  'typescript',
  'hono',
  'sqlite',
  'fintech',
];

const description =
  'Swipe a bill, change a life. A swipe-to-help platform for real bills: Cloudflare Workers, SQLite Durable Objects, a payment sandbox, a moderation queue and an admin audit trail.';

let res = await fetch('https://api.github.com/user/repos', {
  method: 'POST',
  headers,
  body: JSON.stringify({
    name: 'bill-swipe',
    description,
    homepage: 'https://billswipe.852367856.dpdns.org',
    private: false,
    has_issues: true,
    has_wiki: false,
    has_projects: false,
    auto_init: false,
    topics,
  }),
});

const repo = await res.json();
console.log('create:', res.status, repo.full_name ?? JSON.stringify(repo.errors ?? repo.message));

if (repo.full_name) {
  const patch = await fetch(`https://api.github.com/repos/${repo.full_name}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ topics, description, homepage: 'https://billswipe.852367856.dpdns.org' }),
  });
  console.log('topics:', patch.status);
  console.log('clone:', repo.clone_url);
}
