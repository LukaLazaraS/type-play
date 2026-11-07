// Read-only: what this Hetzner account can order or rescale into today, per datacenter, and its prices (docs/research/
// build-capacity-2026-11-07.md). GET requests only: it never creates, changes or deletes anything. Needs HETZNER_TOKEN in
// the root .env (deploy/README.md); prints no secret.
//   node scripts/capacity/hetzner-stock.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const env = Object.fromEntries(readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)
  .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/)).filter(Boolean).map((m) => [m[1], m[2]]));
if (!env.HETZNER_TOKEN) { console.error('no HETZNER_TOKEN in .env'); process.exit(1); }
const get = async (path) => {
  const r = await fetch(`https://api.hetzner.cloud/v1${path}`, { headers: { authorization: `Bearer ${env.HETZNER_TOKEN}` } });
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return r.json();
};

const WATCH = ['cx23', 'cx33', 'cx43', 'cx53', 'cpx22', 'cpx32', 'cpx42', 'cpx52', 'cpx62', 'ccx13', 'ccx23', 'ccx33', 'ccx43'];
const { server_types: types } = await get('/server_types?per_page=50');
const byId = new Map(types.map((t) => [t.id, t]));
const { pricing } = await get('/pricing');
const { servers } = await get('/servers');
// /datacenters (with its per-datacenter "available" lists) was removed on 2026-06-02; each server type now lists its locations.

console.log(`currency ${pricing.currency}, VAT ${pricing.vat_rate}% (prices below without VAT)`);
console.log('\nservers:', servers.map((s) => `${s.name} ${s.server_type.name} ${s.location?.name ?? s.datacenter?.name ?? "?"} (${s.status})`).join('; '));
console.log('\ntype    vCPU RAM  disk  cpu       $/month (fsn1 / nbg1 / hel1)          $/hour fsn1');
for (const name of WATCH) {
  const t = types.find((x) => x.name === name);
  if (!t) { console.log(`${name.padEnd(7)} (not offered)`); continue; }
  const p = (loc) => t.prices.find((x) => x.location === loc);
  const m = (loc) => (p(loc) ? Number(p(loc).price_monthly.net).toFixed(2) : '-');
  console.log(`${name.padEnd(7)} ${String(t.cores).padEnd(4)} ${String(t.memory).padEnd(4)} ${String(t.disk).padEnd(5)} ${t.cpu_type.padEnd(9)} ${m('fsn1')} / ${m('nbg1')} / ${m('hel1')}`.padEnd(70) + (p('fsn1') ? Number(p('fsn1').price_hourly.net).toFixed(4) : '-') + (t.deprecation ? '  (deprecated)' : ''));
}
const ipv4 = pricing.primary_ips?.find((x) => x.type === 'ipv4')?.prices?.find((x) => x.location === 'fsn1');
if (ipv4) console.log(`IPv4 ${Number(ipv4.price_monthly.net).toFixed(2)} a month`);

console.log('\navailable to order now, as the API reports it to this account (per location; "rec" = Hetzner recommends it):');
for (const loc of ['fsn1', 'nbg1', 'hel1']) {
  const row = WATCH.map((name) => {
    const l = types.find((x) => x.name === name)?.locations?.find((x) => x.name === loc);
    return l ? `${name}${l.available ? (l.recommended ? '(rec)' : '') : '(NO)'}` : null;
  }).filter(Boolean);
  console.log(`${loc}: ${row.join(' ')}`);
}
void byId;
