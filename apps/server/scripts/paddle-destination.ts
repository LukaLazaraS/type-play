// The notification destination (Paddle's webhooks) for one environment, by API: created when there is none with our
// description, else brought up to date (a quick tunnel gets a new address each time; the secret stays). A new
// destination's secret goes into an env file without being shown: sandbox → the root .env.local as
// PADDLE_WEBHOOK_SECRET (what development reads), live → the root .env as PADDLE_LIVE_WEBHOOK_SECRET (what deploy.mjs
// maps for the server). The 11 events the API handles (src/billing/handlers.ts), API version 1.
//   npm run paddle:destination -w @typeplay/server -- --env sandbox --url https://<tunnel>.trycloudflare.com/webhooks/paddle
//   npm run paddle:destination -w @typeplay/server -- --env live   (https://api.typeplay.app/webhooks/paddle, usage "Platform")
//   npm run paddle:destination -w @typeplay/server -- --env sandbox --off   (the end of a session: the tunnel's address dies)
// Needs the key's notification_setting write permission. The key: as paddle-catalog.ts finds it.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PADDLE_API_URL, PaddleClient, PaddleError } from "../src/billing/paddle.client.js";
import { SUBSCRIBED_EVENTS } from "../src/billing/handlers.js";
import { config, paddleKeyEnv, ROOT } from "../src/env.js";

interface Destination {
  id: string;
  description: string;
  destination: string;
  active: boolean;
  traffic_source: string;
  subscribed_events: { name: string }[];
  endpoint_secret_key?: string;
}

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const envName = flag("--env");
if (envName !== "sandbox" && envName !== "live") {
  console.error("usage: paddle-destination --env sandbox|live [--url https://…/webhooks/paddle] [--off]");
  process.exit(2);
}
const live = envName === "live";
const url = flag("--url") ?? (live ? "https://api.typeplay.app/webhooks/paddle" : undefined);
const off = args.includes("--off");
if (!off && !url?.startsWith("https://")) {
  console.error("--url https://…/webhooks/paddle is needed for the sandbox (the tunnel's address: apps/server/scripts/webhook-tunnel.mjs)");
  process.exit(2);
}
const key = live ? process.env.PADDLE_LIVE_API_KEY : config.paddle.apiKey;
if (!key || paddleKeyEnv(key) !== envName) {
  console.error(live ? "PADDLE_LIVE_API_KEY (a live key) is not in the root .env." : "PADDLE_API_KEY (a sandbox key) is not in the root .env.local.");
  process.exit(2);
}
const client = new PaddleClient(PADDLE_API_URL[envName], key);
const DESCRIPTION = live ? "typeplay api live" : "typeplay api sandbox (this PC, tunnel)";
// Live takes real events only: an edited simulation must never grant credits (the API ignores simulated ids on live too).
const TRAFFIC = live ? "platform" : "all";
const events = [...SUBSCRIBED_EVENTS];

/** KEY=value into an env file, keeping every other line and the line endings; the value is never printed. */
function setEnv(file: string, name: string, value: string) {
  const text = existsSync(file) ? readFileSync(file, "utf8") : "";
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(eol);
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  const at = lines.findIndex((l) => new RegExp(`^\\s*${name}\\s*=`).test(l));
  if (at >= 0) lines[at] = `${name}=${value}`;
  else lines.push(`${name}=${value}`);
  writeFileSync(file, lines.join(eol) + eol);
}

async function main() {
  const all = await client.get<Destination[]>("/notification-settings");
  const ours = all.find((d) => d.description === DESCRIPTION);
  if (off) {
    if (!ours) return console.log(`no destination "${DESCRIPTION}": nothing to turn off`);
    await client.patch(`/notification-settings/${ours.id}`, { active: false });
    return console.log(`${ours.id} "${DESCRIPTION}": turned off`);
  }
  if (ours) {
    await client.patch(`/notification-settings/${ours.id}`, { destination: url, active: true, subscribed_events: events, traffic_source: TRAFFIC });
    console.log(`${ours.id} "${DESCRIPTION}": now ${url}, on, ${events.length} events (the secret is unchanged)`);
    return;
  }
  const made = await client.post<Destination>("/notification-settings", {
    description: DESCRIPTION,
    type: "url",
    destination: url,
    subscribed_events: events,
    api_version: 1,
    include_sensitive_fields: false,
    traffic_source: TRAFFIC,
  });
  if (!made.endpoint_secret_key) throw new Error(`${made.id} was made, but Paddle sent no secret: read it in the dashboard (Developer tools > Notifications)`);
  const file = join(ROOT, live ? ".env" : ".env.local");
  const name = live ? "PADDLE_LIVE_WEBHOOK_SECRET" : "PADDLE_WEBHOOK_SECRET";
  setEnv(file, name, made.endpoint_secret_key);
  console.log(`${made.id} "${DESCRIPTION}": made for ${url}, ${events.length} events, traffic ${TRAFFIC}; its secret is in ${live ? ".env" : ".env.local"} as ${name} (${made.endpoint_secret_key.length} chars)`);
}

main().catch((e) => {
  console.error(e instanceof PaddleError ? `${e.message}${e.status === 403 ? " (the key lacks notification_setting write)" : ""}` : (e as Error).message);
  process.exit(1);
});
