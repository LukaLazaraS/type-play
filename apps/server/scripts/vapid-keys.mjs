// The VAPID key pairs notifications are signed with on this PC (Web Push, 2026-10-29; apps/server/README.md
// "Notifications"), one pair per environment, made once and never printed. The live pair is deploy.mjs `vapid-key`'s.
//   node apps/server/scripts/vapid-keys.mjs dev        the API's VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY in the root .env.local,
//                                                      the site's NEXT_PUBLIC_VAPID_PUBLIC_KEY in apps/web/.env.local
//   node apps/server/scripts/vapid-keys.mjs autotest   the tests' pair in the root .env.autotest.local (the walk-throughs
//                                                      give the site its public key themselves)
// A file that already has the keys is left as it is (--rotate replaces them: every device then turns notifications on
// again, since a browser's subscription belongs to the public key it was made with). All of these files are git-ignored.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import webpush from "web-push";

const root = join(import.meta.dirname, "../../..");
const [mode, ...flags] = process.argv.slice(2);
const rotate = flags.includes("--rotate");

/** Sets `values` in the env file (made when missing), keeping every other line; one that has them all stays unless `force`. */
function put(file, values, force = rotate) {
  const text = existsSync(file) ? readFileSync(file, "utf8") : "";
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const names = Object.keys(values);
  const has = (n) => new RegExp(`^\\s*${n}\\s*=`, "m").test(text);
  if (names.every(has) && !force) {
    console.log(`${file}: already has ${names.join(", ")}; nothing changed (--rotate replaces them)`);
    return;
  }
  const lines = text.split(/\r?\n/).filter((l) => !names.some((n) => new RegExp(`^\\s*${n}\\s*=`).test(l)));
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  if (!lines.some((l) => l.startsWith("# Notifications"))) lines.push("# Notifications (Web Push): this environment's VAPID pair (apps/server/scripts/vapid-keys.mjs). Never commit.");
  for (const [n, v] of Object.entries(values)) lines.push(`${n}=${v}`);
  writeFileSync(file, lines.join(eol) + eol);
  console.log(`${file}: ${names.join(", ")} written (${names.map((n) => values[n].length).join(" / ")} characters)`);
}

/** A key's value in an env file, or null. */
const valueIn = (file, name) => (existsSync(file) ? (new RegExp(`^\\s*${name}\\s*=\\s*(\\S+)`, "m").exec(readFileSync(file, "utf8"))?.[1] ?? null) : null);

const pair = webpush.generateVAPIDKeys();
if (mode === "dev") {
  // The site subscribes with the API's public key: the one just written, or the one the API already has.
  const api = join(root, ".env.local");
  put(api, { VAPID_PUBLIC_KEY: pair.publicKey, VAPID_PRIVATE_KEY: pair.privateKey });
  const web = join(root, "apps/web/.env.local");
  const publicKey = valueIn(api, "VAPID_PUBLIC_KEY");
  // The site's copy follows the API's whenever they differ.
  if (publicKey && valueIn(web, "NEXT_PUBLIC_VAPID_PUBLIC_KEY") !== publicKey) put(web, { NEXT_PUBLIC_VAPID_PUBLIC_KEY: publicKey }, true);
} else if (mode === "autotest") {
  put(join(root, ".env.autotest.local"), { VAPID_PUBLIC_KEY: pair.publicKey, VAPID_PRIVATE_KEY: pair.privateKey });
} else {
  console.error("usage: node apps/server/scripts/vapid-keys.mjs dev|autotest [--rotate]   (live: node deploy/deploy.mjs vapid-key)");
  process.exit(1);
}
