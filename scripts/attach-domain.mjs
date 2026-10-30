/**
 * Attach the production custom domain to the deployed Worker.
 *
 * `wrangler deploy` creates the route when the zone is already configured, but
 * deleting and recreating a Worker drops the domain binding. This script makes
 * the re-attach a single command instead of a dashboard visit.
 *
 * Usage:
 *   CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... \
 *   node scripts/attach-domain.mjs billswipe.852367856.dpdns.org billswipe
 */
const hostname = process.argv[2];
const service = process.argv[3] ?? 'billswipe';

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;

if (!hostname || !accountId || !token) {
  console.error('Usage: CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... node scripts/attach-domain.mjs <hostname> [service]');
  process.exit(1);
}

const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const api = 'https://api.cloudflare.com/client/v4';

// Find the zone that owns the hostname (longest suffix match wins).
const zonesRes = await fetch(`${api}/zones?per_page=50`, { headers });
const zones = (await zonesRes.json()).result ?? [];
const zone = zones
  .filter((z) => hostname === z.name || hostname.endsWith(`.${z.name}`))
  .sort((a, b) => b.name.length - a.name.length)[0];

if (!zone) {
  console.error(`No zone in this account matches ${hostname}. Available: ${zones.map((z) => z.name).join(', ') || 'none'}`);
  process.exit(1);
}

const res = await fetch(`${api}/accounts/${accountId}/workers/domains`, {
  method: 'PUT',
  headers,
  body: JSON.stringify({ environment: 'production', hostname, service, zone_id: zone.id }),
});

const body = await res.json();
if (!body.success) {
  console.error('Failed to attach domain:', JSON.stringify(body.errors));
  process.exit(1);
}

console.log(`Attached https://${body.result.hostname} → ${body.result.service} (zone ${body.result.zone_name})`);
console.log('Certificate provisioning can take a minute; check with:');
console.log(`  curl -I https://${body.result.hostname}/api/health`);
