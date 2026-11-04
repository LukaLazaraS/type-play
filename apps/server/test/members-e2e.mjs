// End-to-end test of pair developing (2026-11-04; docs/design/pair-developing.md) against an API of its own on a free
// port with fake builds (DEV_AUTH=1 AGENT_FAKE=1), on a database of the run's own (test/test-db.mjs):
//   npm run build -w @typeplay/server && npm run test:members:e2e -w @typeplay/server
// Every game route for every role (the owner, an editor, someone invited who hasn't accepted, an outsider, someone
// removed, someone who left, no sign-in); inviting (the link, the account it is for, Gmail's dots and +tags, a new link,
// taking one back, declining, the limits, expiry); accepting; the game under Shared with you; who is charged for an
// editor's change (the owner, under the owner's plan; the owner's balance never on an editor's stream; the owner's
// history says who sent it); two people sending at once; stopping someone else's build; the AI's questions answered
// only by the one who asked; the pictures of the game; removing someone (their build stops, their stream ends);
// leaving; an editor's closed account; the game deleted by its owner.
import { spawn, spawnSync } from "node:child_process";
import { resolve, join } from "node:path";
import pg from "pg";
import sharp from "sharp";
import { freePort } from "../../../scripts/test-run.mjs";
import { useTestDatabase } from "./test-db.mjs";

const here = resolve(import.meta.dirname, "..");
const root = resolve(here, "../..");
await useTestDatabase();
const PORT = await freePort();
const API = `http://127.0.0.1:${PORT}`;
const stamp = Date.now().toString(36);
const who = (name) => `dev:pair-${stamp}-${name}@test.local`;
const O = who("owner"); // owns the game: Medium, credits
const E = who("editor"); // accepts; Free, so the owner's plan is seen to rule
const E2 = who("second"); // a second editor
const P = who("pending"); // invited, never accepts
const X = who("outsider"); // never invited
const W = who("wrong"); // signed in with another address than the one invited
const R = who("removed"); // let in, then removed by the owner
const L = who("leaver"); // let in, then leaves
const C = who("closer"); // let in, then closes their account
const F = who("freeowner"); // owns a game on Free
const G1 = `dev:${stamp}pairdots@gmail.com`; // Gmail: invited as P.Air.Dots+game@GMAIL.com
const emailOf = (t) => t.slice(4);
const devId = (t) => `dev-${emailOf(t).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
let failures = 0;
const ok = (cond, what) => {
  console.log(`${cond ? "  ok  " : "  FAIL"} ${what}`);
  if (!cond) failures++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const admin = (...args) => spawnSync(process.execPath, [join(root, "node_modules/tsx/dist/cli.mjs"), "src/admin.ts", ...args], { cwd: here, encoding: "utf8" });
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

async function api(token, method, path, body) {
  const send = () =>
    fetch(API + path, {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  // The server closes idle keep-alive sockets after 5 s; a request that picks one up just then (after an admin CLI's
  // pause) is reset before it reaches the server: sent again once, as test/e2e.mjs does.
  const res = await send().catch((e) => (e?.cause?.code === "ECONNRESET" || e?.cause?.code === "UND_ERR_SOCKET" ? send() : Promise.reject(e)));
  const text = await res.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed };
}
const status = async (token, method, path, body) => (await api(token, method, path, body)).status;
async function upload(token, buf) {
  const res = await fetch(`${API}/attachments`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "image/png" }, body: buf });
  return { status: res.status, body: await res.json().catch(() => null) };
}
const square = (color) => sharp({ create: { width: 120, height: 120, channels: 3, background: color } }).png().toBuffer();

/** A game stream read as the site reads it: its events, and whether it has ended. */
async function stream(token, id) {
  const ctrl = new AbortController();
  const res = await fetch(`${API}/projects/${id}/events`, { headers: { Authorization: `Bearer ${token}` }, signal: ctrl.signal });
  const s = { status: res.status, events: [], ended: false, close: () => ctrl.abort() };
  if (res.ok) {
    (async () => {
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf("\n\n")) >= 0) {
            const chunk = buf.slice(0, i);
            buf = buf.slice(i + 2);
            for (const line of chunk.split("\n")) if (line.startsWith("data: ")) s.events.push(JSON.parse(line.slice(6)));
          }
        }
        s.ended = true;
      } catch {
        // aborted
      }
    })();
  }
  return s;
}
/** The account stream (GET /me/events): the notices it hears. */
async function noticesOf(token) {
  const ctrl = new AbortController();
  const res = await fetch(`${API}/me/events`, { headers: { Authorization: `Bearer ${token}` }, signal: ctrl.signal });
  const s = { notices: [], close: () => ctrl.abort() };
  (async () => {
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const block = buf.slice(0, i);
          buf = buf.slice(i + 2);
          for (const line of block.split("\n")) if (line.startsWith("data: ")) s.notices.push(JSON.parse(line.slice(6)).notice);
        }
      }
    } catch {
      // closed
    }
  })();
  return s;
}
const until = async (test, ms = 30_000) => {
  for (let t = 0; t < ms; t += 200) {
    if (await test()) return true;
    await sleep(200);
  }
  return false;
};
/** The game once nothing builds on it any more. */
async function settled(token, id) {
  for (let i = 0; i < 150; i++) {
    const p = (await api(token, "GET", `/projects/${id}`)).body;
    if (p && p.status === "idle" && !["running", "queued"].includes(p.messages?.at(-1)?.status)) return p;
    await sleep(400);
  }
  throw new Error(`${id} never finished`);
}
const balance = async (token) => (await api(token, "GET", "/me")).body.credits.available;
/** Invites `token`'s address (or `email`) as the owner `by`; the link's secret. */
async function invite(by, id, token, email = emailOf(token)) {
  const r = await api(by, "POST", `/projects/${id}/invites`, { email });
  if (r.status !== 201) throw new Error(`invite ${email}: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
}
/** Invites and accepts: they are in the game. The invitation's link (its secret). */
async function letIn(by, id, token) {
  const made = await invite(by, id, token);
  const r = await api(token, "POST", `/invites/${made.invite.id}/accept`);
  if (r.status !== 200) throw new Error(`accept ${emailOf(token)}: ${r.status} ${JSON.stringify(r.body)}`);
  return made;
}

let child = null;
let log = "";
const projects = [];
try {
  child = spawn(process.execPath, ["dist/main.js"], {
    cwd: here,
    env: { ...process.env, PORT: String(PORT), DEV_AUTH: "1", AGENT_FAKE: "1", BILLING_JOBS: "0", BETA_INVITE_ONLY: "" },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  child.stdout.on("data", (d) => (log = (log + d).slice(-30_000)));
  child.stderr.on("data", (d) => (log = (log + d).slice(-30_000)));
  if (!(await until(async () => (await fetch(`${API}/health`).then((r) => r.json()).catch(() => null))?.agent === "fake", 60_000))) throw new Error(`the API did not start: ${log.slice(-1500)}`);
  for (const t of [O, E, E2, P, X, W, R, L, C, F, G1]) await api(t, "GET", "/me");
  ok(admin("plan", emailOf(O), "medium").status === 0 && admin("grant", emailOf(O), "80").status === 0, "the owner on Medium + 80 credits");

  console.log("a game and its owner");
  const made = await api(O, "POST", "/projects", { prompt: "A cat that jumps over boxes", model: "fast" });
  ok(made.status === 201 && made.body.access?.role === "owner", `the owner's new game says role owner (${made.status}, ${made.body?.access?.role})`);
  const id = made.body.id;
  projects.push(id);
  let game = await settled(O, id);
  ok(!!game.buildId && game.messages.every((m) => m.by?.id === devId(O)), "built; every message is the owner's (by)");
  ok(game.access.owner.id === devId(O) && game.access.members.length === 0 && game.access.plan === "medium" && game.access.models.join() === "fast,smart,best", "access: the owner, no members, the owner's plan and AIs");

  console.log("inviting");
  ok((await api(E, "POST", `/projects/${id}/invites`, { email: emailOf(X) })).status === 404, "someone not in the game can't invite: 404");
  ok((await api(O, "POST", `/projects/${id}/invites`, { email: "not an address" })).status === 400, "not an email: 400");
  const self = await api(O, "POST", `/projects/${id}/invites`, { email: emailOf(O).toUpperCase() });
  ok(self.status === 400 && /your own/.test(self.body?.message), `your own address: 400 (${self.body?.message})`);
  const forE = await invite(O, id, E, `  ${emailOf(E).toUpperCase()} `);
  ok(/^[A-Za-z0-9_-]{43}$/.test(forE.token) && forE.invite.email === emailOf(E) && forE.invite.role === "editor", "201: the link's secret (43 letters), the address as typed (trimmed, lower case), editor");
  ok(Math.abs(Date.parse(forE.invite.expiresAt) - Date.now() - 7 * 86_400_000) < 120_000, "it works for 7 days");
  const hashRow = (await db.query(`SELECT "tokenHash" FROM "ProjectInvite" WHERE id = $1`, [forE.invite.id])).rows[0];
  ok(hashRow && hashRow.tokenHash !== forE.token && /^[0-9a-f]{64}$/.test(hashRow.tokenHash), "only the secret's SHA-256 is kept");
  ok(!log.includes(forE.token) && !log.includes(emailOf(E)), "neither the link nor the address is in the API's log");
  const peopleO = (await api(O, "GET", `/projects/${id}/people`)).body;
  ok(peopleO.invites?.length === 1 && peopleO.invites[0].email === emailOf(E) && peopleO.max === 10, "the owner's people: the invitation waiting, 10 at most");
  const forP = await invite(O, id, P);

  console.log("the invited person");
  const mineE = (await api(E, "GET", "/invites")).body;
  ok(mineE.length === 1 && mineE[0].game.id === id && mineE[0].owner.id === devId(O) && mineE[0].game.name === game.name, "GET /invites: the game, its owner, its name");
  ok((await api(X, "GET", "/invites")).body.length === 0, "an outsider has none");
  const wrong = await api(W, "GET", `/invites/link/${forE.token}`);
  ok(wrong.status === 403 && wrong.body.error === "wrong_account" && wrong.body.message.includes("p•••@test.local") && !wrong.body.message.includes(emailOf(E)), `another account opening the link: 403 wrong_account, the address half hidden (${wrong.body?.message})`);
  ok((await api(W, "POST", `/invites/${forE.invite.id}/accept`)).status === 404, "…and can't accept it by its id: 404");
  ok((await api(null, "GET", `/invites/link/${forE.token}`)).status === 401, "no sign-in: 401");
  ok((await api(E, "GET", `/invites/link/${forE.token.slice(0, 42)}x`)).status === 404, "a wrong secret: 404");
  const byLink = await api(E, "GET", `/invites/link/${forE.token}`);
  ok(byLink.status === 200 && byLink.body.id === forE.invite.id, "the invited account opens the link: 200");
  ok((await status(E, "GET", `/projects/${id}`)) === 404, "not in the game before accepting: 404");

  console.log("Gmail: dots and +tags");
  const forG = await invite(O, id, G1, `P.Air.Dots+game@GMAIL.com`.replace("P.Air.Dots", `${stamp}.p.a.i.r.d.o.t.s`));
  ok((await api(G1, "GET", `/invites/link/${forG.token}`)).status === 200, "an invitation to a Gmail address with dots and a +tag opens for the Gmail account");

  console.log("accepting");
  const acc = await api(E, "POST", `/invites/${forE.invite.id}/accept`);
  ok(acc.status === 200 && acc.body.projectId === id, "accept: 200, the game's id");
  const accAgain = await api(E, "POST", `/invites/${forE.invite.id}/accept`);
  ok(accAgain.status === 200 && accAgain.body.projectId === id, "accepting again (a second tab): 200, the same game");
  const linkAgain = await api(E, "GET", `/invites/link/${forE.token}`);
  ok(linkAgain.status === 200 && linkAgain.body.accepted === true && linkAgain.body.game.id === id, "the link once accepted: 200 accepted, so the page opens the game");
  ok((await api(W, "GET", `/invites/link/${forE.token}`)).status === 403, "…for another account still 403");
  ok((await api(E, "POST", `/invites/${forE.invite.id}/decline`)).status === 404, "declining it now: 404");
  ok(
    !(await api(E, "GET", "/invites")).body.some((i) => i.id === forE.invite.id) && !(await api(O, "GET", `/projects/${id}/people`)).body.invites.some((i) => i.id === forE.invite.id),
    "an accepted invitation is in no list (theirs or the owner's)",
  );
  ok(
    (await status(O, "DELETE", `/projects/${id}/invites/${forE.invite.id}`)) === 404 && (await status(O, "POST", `/projects/${id}/invites/${forE.invite.id}/link`)) === 404,
    "the owner can't take back or renew an accepted invitation: 404",
  );
  const shared = (await api(E, "GET", "/shared")).body;
  ok(shared.length === 1 && shared[0].id === id && shared[0].owner.id === devId(O) && shared[0].role === "editor" && !!shared[0].since, "GET /shared: the game, its owner, editor, since");
  ok(!(await api(E, "GET", "/projects")).body.some((g) => g.id === id), "not in the editor's own games (GET /projects)");
  const asE = (await api(E, "GET", `/projects/${id}`)).body;
  ok(asE.access?.role === "editor" && asE.access.owner.id === devId(O) && asE.access.models.join() === "fast,smart,best" && asE.access.plan === "medium", "the editor sees role editor, the owner, the owner's plan and AIs");
  ok((await api(O, "GET", `/projects/${id}`)).body.access.members.some((m) => m.id === devId(E)), "the owner sees the editor among the members");
  const peopleE = (await api(E, "GET", `/projects/${id}/people`)).body;
  ok(peopleE.members.length === 1 && !("email" in peopleE.members[0]) && !("spentMonth" in peopleE.members[0]) && !peopleE.invites, "an editor's people list: names only, no emails, no invitations");
  ok(!JSON.stringify(asE).includes(emailOf(O)), "nothing the editor gets holds the owner's email");
  await letIn(O, id, E2);

  console.log("every route, every role");
  const ownerPic = await upload(O, await square("#ff5a36"));
  const withPic = await api(O, "POST", `/projects/${id}/messages`, { text: "Make the boxes red", model: "fast", images: [ownerPic.body.id] });
  ok(withPic.status === 201, "the owner sends a change with a picture");
  game = await settled(O, id);
  const v1 = game.versions[0];
  // [method, path, body, expected for owner, editor, pending, outsider, none]
  const table = [
    ["GET", `/projects/${id}`, null, 200, 200, 404, 404, 401],
    ["GET", `/projects/${id}/people`, null, 200, 200, 404, 404, 401],
    ["GET", `/projects/${id}/assets/${game.buildId}`, null, 200, 200, 404, 404, 401],
    ["GET", `/projects/${id}/download`, null, 200, 200, 404, 404, 401],
    ["GET", `/attachments/${ownerPic.body.id}/thumb`, null, 200, 200, 404, 404, 401],
    ["GET", `/estimate?kind=edit&model=fast&game=${id}`, null, 200, 200, 404, 404, 401],
    ["PATCH", `/projects/${id}`, { name: "Box Cat" }, 200, 200, 404, 404, 401],
    ["POST", `/projects/${id}/restore`, { n: v1.n }, 200, 200, 404, 404, 401],
    ["PATCH", `/projects/${id}`, { shared: true }, 200, 403, 404, 404, 401],
    ["PATCH", `/projects/${id}`, { shared: true, listed: false }, 200, 403, 404, 404, 401],
    ["GET", `/projects/${id}/android`, null, 200, 403, 404, 404, 401],
    ["POST", `/projects/${id}/android`, {}, null, 403, 404, 404, 401],
    ["GET", `/projects/${id}/android/key`, null, null, 403, 404, 404, 401],
    ["GET", `/projects/${id}/android/icon`, null, null, 403, 404, 404, 401],
    ["POST", `/projects/${id}/invites`, { email: "someone-else@test.local" }, null, 403, 404, 404, 401],
    ["DELETE", `/projects/${id}/invites/${forP.invite.id}`, null, null, 403, 404, 404, 401],
    ["POST", `/projects/${id}/invites/${forP.invite.id}/link`, null, null, 403, 404, 404, 401],
    ["DELETE", `/projects/${id}/members/${devId(E2)}`, null, null, 403, 404, 404, 401],
    ["POST", `/projects/${id}/leave`, null, 400, null, 404, 404, 401],
    ["DELETE", `/projects/${id}`, null, null, 403, 404, 404, 401],
    ["POST", `/projects/${id}/cancel`, null, 200, 200, 404, 404, 401],
    ["POST", `/projects/${id}/messages`, { text: "x", model: "fast" }, null, null, 404, 404, 401],
    ["POST", "/feedback", { text: "It works", page: `/games/${id}`, gameId: id }, null, 201, 404, 404, 401],
  ];
  const roles = [
    ["owner", O],
    ["editor", E],
    ["invited, not accepted", P],
    ["outsider", X],
    ["no sign-in", null],
  ];
  for (const [method, path, body, ...want] of table) {
    const got = [];
    for (const [i, [, t]] of roles.entries()) {
      if (want[i] === null) {
        got.push(null);
        continue;
      }
      got.push(await status(t, method, path, body));
    }
    const same = got.every((g, i) => want[i] === null || g === want[i]);
    ok(same, `${method} ${path.replace(id, ":id")}${body ? " " + JSON.stringify(body) : ""}: ${roles.map(([n], i) => (want[i] === null ? null : `${n} ${got[i]}`)).filter(Boolean).join(", ")}`);
  }
  const deny = await api(E, "PATCH", `/projects/${id}`, { shared: false });
  ok(deny.body?.error === "owner_only" && /owner/.test(deny.body.message), `a member's owner-only request: owner_only, one sentence (${deny.body?.message})`);
  const evE = await stream(E, id);
  const evX = await stream(X, id);
  ok(evE.status === 200 && evX.status === 404, `the stream: editor 200, outsider 404 (${evE.status}, ${evX.status})`);
  await until(() => evE.events.some((e) => e.type === "snapshot"));
  ok(evE.events[0]?.type === "snapshot" && evE.events[0].project.access.role === "editor", "the editor's stream opens with their snapshot (role editor)");

  console.log("who pays for an editor's change");
  const evO = await stream(O, id);
  await until(() => evO.events.some((e) => e.type === "snapshot"));
  const oBefore = await balance(O);
  const eBefore = await balance(E);
  const sentE = await api(E, "POST", `/projects/${id}/messages`, { text: "Add a double jump", model: "smart" });
  ok(sentE.status === 201, `the editor (on Free) sends a change on Smart, which the owner's Medium has: 201 (${sentE.status} ${sentE.body?.message ?? ""})`);
  const askedE = sentE.body.messages.at(-2);
  const answerE = sentE.body.messages.at(-1);
  ok(askedE.by?.id === devId(E) && answerE.by?.id === devId(E), "the message and its answer say the editor sent it");
  game = await settled(O, id);
  const charged = game.messages.find((m) => m.id === answerE.id);
  ok(charged.status === "done" && charged.credits > 0, `built and charged: ${charged.credits} credits`);
  ok(Math.abs(oBefore - charged.credits - (await balance(O))) < 0.05, `the owner paid it (${oBefore} -> ${await balance(O)})`);
  ok((await balance(E)) === eBefore, `the editor paid nothing (${eBefore})`);
  const planRow = (await db.query(`SELECT plan, "authorId" FROM "Message" WHERE id = $1`, [answerE.id])).rows[0];
  ok(planRow.plan === "medium" && planRow.authorId === devId(E), "the run went by the owner's plan (Message.plan medium), the editor's as author");
  await until(() => evE.events.some((e) => e.type === "done" && e.message.id === answerE.id) && evO.events.some((e) => e.type === "done" && e.message.id === answerE.id));
  const doneE = evE.events.find((e) => e.type === "done" && e.message.id === answerE.id);
  const doneO = evO.events.find((e) => e.type === "done" && e.message.id === answerE.id);
  ok(doneE && !("credits" in doneE) && doneE.message.by?.id === devId(E), "the editor's stream: done, without the owner's balance, the answer by the editor");
  ok(doneO?.credits?.available === (await balance(O)), "the owner's stream: done with the owner's balance");
  const usageO = (await api(O, "GET", "/me/usage")).body.entries;
  const lineO = usageO.find((u) => u.kind === "charge" && u.amount === -charged.credits && u.game?.id === id && u.by);
  ok(lineO?.by === emailOf(E).split("@")[0], `the owner's history: the charge, "by" the editor (${lineO?.by})`);
  ok(!usageO.filter((u) => u.kind === "charge" && u.game?.id === id && !u.by).some((u) => u.amount === -charged.credits && u.prompt === "Add a double jump"), "…and not as one of the owner's own");
  ok(!(await api(E, "GET", "/me/usage")).body.entries.some((u) => u.game?.id === id), "the editor's history has nothing of it");
  const peopleAfter = (await api(O, "GET", `/projects/${id}/people`)).body;
  ok(peopleAfter.members.find((m) => m.id === devId(E))?.spentMonth === charged.credits, `the owner's people list: the editor's credits this month (${peopleAfter.members.find((m) => m.id === devId(E))?.spentMonth})`);
  const est = await api(E, "GET", `/estimate?kind=edit&model=best&game=${id}`);
  const estFree = await api(E, "GET", "/estimate?kind=edit&model=best");
  ok(est.status === 200 && estFree.status === 200 && est.body.needsConfirm !== estFree.body.needsConfirm, `the estimate for the game goes by the owner's plan (Medium: ask-first ${est.body?.needsConfirm}; the editor's own Free: ${estFree.body?.needsConfirm})`);

  console.log("the owner's plan rules: a Free owner's game");
  const freeGame = await api(F, "POST", "/projects", { prompt: "A tiny maze", model: "fast" });
  projects.push(freeGame.body.id);
  await settled(F, freeGame.body.id);
  await letIn(F, freeGame.body.id, E2);
  ok(admin("plan", emailOf(E2), "high").status === 0, "the editor on High");
  const smartOnFree = await api(E2, "POST", `/projects/${freeGame.body.id}/messages`, { text: "Add a timer", model: "smart" });
  ok(smartOnFree.status === 403 && smartOnFree.body.error === "model_not_in_plan" && smartOnFree.body.message.includes("Free plan") && smartOnFree.body.message.includes(emailOf(F).split("@")[0]), `an editor on High can't use Smart in a Free owner's game: 403, in the owner's terms (${smartOnFree.body?.message})`);
  ok(admin("grant", emailOf(F), "-30").status === 0, "the Free owner's credits taken away (a grant of -30)");
  const noCredits = await api(E2, "POST", `/projects/${freeGame.body.id}/messages`, { text: "Add a timer", model: "fast" });
  ok(noCredits.status === 402 && ["no_credits", "daily_limit"].includes(noCredits.body.error) && noCredits.body.message.includes(emailOf(F).split("@")[0]), `the owner out of credits: 402 for the editor, naming the owner (${noCredits.body?.message})`);

  console.log("two people sending at once");
  for (let round = 0; round < 3; round++) {
    const [a, b] = await Promise.all([
      api(O, "POST", `/projects/${id}/messages`, { text: `Owner change ${round}`, model: "fast" }),
      api(E, "POST", `/projects/${id}/messages`, { text: `Editor change ${round}`, model: "fast" }),
    ]);
    const statuses = [a.status, b.status].sort().join(",");
    const loser = a.status === 409 ? a : b;
    const winner = a.status === 201 ? "owner" : "editor"; // a is the owner's send
    ok(statuses === "201,409" && loser.body.error === "busy", `round ${round + 1}: one starts (201), the other 409 busy (${a.status}, ${b.status})`);
    const names = { owner: emailOf(O).split("@")[0], editor: emailOf(E).split("@")[0] };
    ok(loser.body.message.includes(winner === "editor" ? names.editor : names.owner) || /already being built/.test(loser.body.message), `…and the 409 says whose change is building (${loser.body.message})`);
    await settled(O, id);
  }
  const two = await Promise.all([E, E2].map((t, i) => api(t, "POST", `/projects/${id}/messages`, { text: `Two editors ${i}`, model: "fast" })));
  ok(two.map((r) => r.status).sort().join(",") === "201,409", `two editors at once: one 201, one 409 (${two.map((r) => r.status).join(", ")})`);
  await settled(O, id);

  console.log("stopping");
  const slowO = await api(O, "POST", `/projects/${id}/messages`, { text: "A long owner change LONG", model: "fast" });
  ok(slowO.status === 201, "the owner starts a long build");
  const stopByE = await api(E, "POST", `/projects/${id}/cancel`);
  ok(stopByE.status === 403 && stopByE.body.error === "owner_only", `the editor can't stop the owner's build: 403 (${stopByE.body?.message})`);
  ok((await api(O, "GET", `/projects/${id}`)).body.status === "running", "…it keeps building");
  await api(O, "POST", `/projects/${id}/cancel`);
  await settled(O, id);
  const slowE = await api(E, "POST", `/projects/${id}/messages`, { text: "A long editor change LONG", model: "fast" });
  ok(slowE.status === 201, "the editor starts a long build");
  ok((await api(E2, "POST", `/projects/${id}/cancel`)).status === 403, "another editor can't stop it: 403");
  const stopOwn = await api(E, "POST", `/projects/${id}/cancel`);
  ok(stopOwn.status === 200, "the editor stops their own: 200");
  const stoppedOwn = (await settled(O, id)).messages.at(-1);
  ok(stoppedOwn.status === "failed" && stoppedOwn.credits === 0, "stopped, nothing charged");
  const slowE2 = await api(E, "POST", `/projects/${id}/messages`, { text: "Another long editor change LONG", model: "fast" });
  ok(slowE2.status === 201 && (await api(O, "POST", `/projects/${id}/cancel`)).status === 200, "the owner stops an editor's build: 200");
  await settled(O, id);

  console.log("the AI's questions: only the one who asked answers");
  const vague = await api(E, "POST", `/projects/${id}/messages`, { text: "Make it for two VAGUE", model: "fast", ask: true });
  ok(vague.status === 201, "the editor sends a vague change with Ask me first");
  game = await settled(O, id);
  const asked = game.messages.at(-1);
  ok(!!asked.questions && asked.by?.id === devId(E), "the AI asks, for the editor's message");
  const ownerTaps = await api(O, "POST", `/projects/${id}/messages`, { answers: [null], model: "fast" });
  ok(ownerTaps.status === 400 && ownerTaps.body.message.includes(emailOf(E).split("@")[0]), `the owner can't tap the editor's answers: 400 (${ownerTaps.body?.message})`);
  const editorTaps = await api(E, "POST", `/projects/${id}/messages`, { answers: ["Both at once"], model: "fast" });
  ok(editorTaps.status === 201 && /Both at once/.test(editorTaps.body.messages.at(-2).text), "the editor answers them: 201, the answer in their message");
  await settled(O, id);
  await api(O, "POST", `/projects/${id}/messages`, { text: "Make it for two VAGUE", model: "fast", ask: true });
  game = await settled(O, id);
  const typedByE = await api(E, "POST", `/projects/${id}/messages`, { text: "Add a red hat", model: "fast" });
  ok(typedByE.status === 201 && typedByE.body.messages.at(-2).text === "Add a red hat", "the owner's questions open, the editor's typed message is a new request of its own (not their answer)");
  await settled(O, id);

  console.log("pictures in a shared game");
  const full = await fetch(`${API}/attachments/${ownerPic.body.id}`, { headers: { Authorization: `Bearer ${E}` } });
  ok(full.status === 200 && full.headers.get("content-type") === "image/png", "the editor sees the owner's picture in the chat");
  const again = await api(E, "POST", `/projects/${id}/messages`, { text: "Use this colour again", model: "fast", images: [ownerPic.body.id] });
  ok(again.status === 201 && again.body.messages.at(-2).images?.[0]?.id && again.body.messages.at(-2).images[0].id !== ownerPic.body.id, "the editor sends the owner's picture again: a copy of their own");
  await settled(O, id);
  const staged = await upload(E, await square("#2f9e44"));
  ok((await api(O, "POST", `/projects/${id}/messages`, { text: "Use Ana's", model: "fast", images: [staged.body.id] })).status === 400, "the owner can't send the editor's staged picture: 400");
  ok((await fetch(`${API}/attachments/${staged.body.id}`, { headers: { Authorization: `Bearer ${O}` } })).status === 404, "…nor see it before it is sent: 404");

  console.log("notices go to the one who asked");
  const nO = await noticesOf(O);
  const nE = await noticesOf(E);
  await sleep(300);
  const forNotice = await api(E, "POST", `/projects/${id}/messages`, { text: "Add clouds", model: "fast" });
  await settled(O, id);
  await until(() => nE.notices.some((n) => n.messageId === forNotice.body.messages.at(-1).id), 10_000);
  await sleep(500);
  ok(nE.notices.some((n) => n.messageId === forNotice.body.messages.at(-1).id && n.kind === "ready"), "the editor hears their build is ready");
  ok(!nO.notices.some((n) => n.messageId === forNotice.body.messages.at(-1).id), "the owner gets no notice for it (the game's page shows it)");
  nO.close();
  nE.close();

  console.log("invitations: a new link, taking one back, declining, expiry, the limits");
  const firstP = forP.token;
  const renewed = await api(O, "POST", `/projects/${id}/invites/${forP.invite.id}/link`);
  ok(renewed.status === 200 && renewed.body.token !== firstP && renewed.body.invite.id === forP.invite.id, "a new link: 200, a new secret, the same invitation");
  ok((await api(P, "GET", `/invites/link/${firstP}`)).status === 404 && (await api(P, "GET", `/invites/link/${renewed.body.token}`)).status === 200, "the old link stops working, the new one works");
  await db.query(`UPDATE "ProjectInvite" SET "expiresAt" = now() - interval '1 minute' WHERE id = $1`, [forP.invite.id]);
  ok((await api(P, "GET", `/invites/link/${renewed.body.token}`)).status === 404, "past its 7 days: the link is 404");
  ok((await api(P, "POST", `/invites/${forP.invite.id}/accept`)).status === 404, "…and accepting it is 404");
  ok((await api(P, "GET", "/invites")).body.length === 0, "…and it is not among the invitations");
  ok((await api(O, "GET", `/projects/${id}/people`)).body.invites.some((i) => i.id === forP.invite.id && Date.parse(i.expiresAt) < Date.now()), "the owner's list still shows it, ended");
  const back = await api(O, "POST", `/projects/${id}/invites/${forP.invite.id}/link`);
  ok(back.status === 200 && (await api(P, "GET", `/invites/link/${back.body.token}`)).status === 200, "a new link brings an ended invitation back for 7 days");
  ok((await api(O, "DELETE", `/projects/${id}/invites/${forP.invite.id}`)).status === 200, "the owner takes it back: 200");
  ok((await api(P, "GET", `/invites/link/${back.body.token}`)).status === 404 && (await api(P, "GET", "/invites")).body.length === 0, "…its link is 404, it is gone from GET /invites");
  const forW = await invite(O, id, W);
  ok((await api(W, "POST", `/invites/${forW.invite.id}/decline`)).status === 200, "declined: 200");
  ok(!(await api(O, "GET", `/projects/${id}/people`)).body.invites.some((i) => i.id === forW.invite.id) && (await status(W, "GET", `/projects/${id}`)) === 404, "…gone from the owner's list; not in the game");
  // The limit: 10 people besides the owner, invitations waiting included (here: 2 editors and the Gmail one waiting).
  const extra = [];
  for (let i = 0; i < 7; i++) extra.push(await api(O, "POST", `/projects/${id}/invites`, { email: `extra-${stamp}-${i}@test.local` }));
  ok(extra.every((r) => r.status === 201), "up to 10: 7 more invitations (2 editors and 1 waiting already)");
  const eleventh = await api(O, "POST", `/projects/${id}/invites`, { email: `extra-${stamp}-x@test.local` });
  ok(eleventh.status === 400 && /10 people/.test(eleventh.body.message), `the 11th: 400 (${eleventh.body?.message})`);
  ok((await api(O, "POST", `/projects/${id}/invites`, { email: `extra-${stamp}-0@test.local` })).status === 201, "inviting one waiting already is a new link, not a new place: 201");
  for (const r of extra) await api(O, "DELETE", `/projects/${id}/invites/${r.body.invite.id}`);
  // The day's links: 30 at most for an owner, all games together.
  const otherGame = await api(O, "POST", "/projects", { prompt: "A second game for the link limit", model: "fast" });
  projects.push(otherGame.body.id);
  await settled(O, otherGame.body.id);
  await db.query(
    `INSERT INTO "ProjectInvite" (id, "projectId", email, match, "tokenHash", "sentAt", "expiresAt") SELECT gen_random_uuid()::text, $1, 'bulk-' || g || '@test.local', 'bulk-' || g || '@test.local', md5(random()::text) || g, now(), now() + interval '7 days' FROM generate_series(1, 30) g`,
    [otherGame.body.id],
  );
  const pastDay = await api(O, "POST", `/projects/${id}/invites`, { email: `one-more-${stamp}@test.local` });
  ok(pastDay.status === 429 && pastDay.body.error === "too_many", `past 30 links in a day: 429 (${pastDay.body?.message})`);
  await db.query(`DELETE FROM "ProjectInvite" WHERE "projectId" = $1`, [otherGame.body.id]);

  console.log("removing someone");
  const forR = await letIn(O, id, R);
  const evR = await stream(R, id);
  await until(() => evR.events.some((e) => e.type === "snapshot"));
  const slowR = await api(R, "POST", `/projects/${id}/messages`, { text: "A long change by the one removed LONG", model: "fast" });
  ok(slowR.status === 201, "they start a long build");
  const oBeforeR = await balance(O);
  const removed = await api(O, "DELETE", `/projects/${id}/members/${devId(R)}`);
  ok(removed.status === 200, "the owner removes them: 200");
  const afterR = await settled(O, id);
  ok(afterR.messages.at(-1).status === "failed" && afterR.messages.at(-1).credits === 0 && (await balance(O)) === oBeforeR, "their build stopped, nothing charged");
  ok(afterR.messages.some((m) => m.by?.id === devId(R)), "their message stays in the chat, with their name");
  await until(() => evR.ended, 10_000);
  ok(evR.events.some((e) => e.type === "removed") && evR.ended, "their open stream hears removed, then ends");
  ok((await status(R, "GET", `/projects/${id}`)) === 404 && (await status(R, "POST", `/projects/${id}/messages`, { text: "x", model: "fast" })) === 404, "they get 404 on the game now");
  ok(!(await api(R, "GET", "/shared")).body.some((g) => g.id === id), "…and it left their Shared with you");
  ok(
    (await status(R, "GET", `/invites/link/${forR.token}`)) === 404 && (await status(R, "POST", `/invites/${forR.invite.id}/accept`)) === 404,
    "…and the invitation they accepted is gone: its link and accepting it are 404",
  );
  ok((await db.query(`SELECT count(*)::int AS n FROM "ProjectInvite" WHERE id = $1`, [forR.invite.id])).rows[0].n === 0, "…its row deleted (their address isn't kept)");
  ok((await api(O, "DELETE", `/projects/${id}/members/${devId(R)}`)).status === 404, "removing them again: 404");
  ok((await api(O, "DELETE", `/projects/${id}/members/${devId(O)}`)).status === 400, "the owner can't remove themselves: 400");
  ok(evO.events.some((e) => e.type === "people"), "the others' streams heard people");

  console.log("leaving");
  await letIn(O, id, L);
  ok((await api(L, "POST", `/projects/${id}/leave`)).status === 200, "a member leaves: 200");
  ok((await status(L, "GET", `/projects/${id}`)) === 404 && !(await api(L, "GET", "/shared")).body.some((g) => g.id === id), "404 on the game, gone from Shared with you");
  await letIn(O, id, L);
  ok((await status(L, "GET", `/projects/${id}`)) === 200, "invited again, they are back in");

  console.log("an editor closes their account");
  await letIn(O, id, C);
  const cPic = await upload(C, await square("#3d206b"));
  const cSent = await api(C, "POST", `/projects/${id}/messages`, { text: "A change before closing", model: "fast", images: [cPic.body.id] });
  ok(cSent.status === 201, "they send a change with a picture");
  await settled(O, id);
  const closed = await api(C, "DELETE", "/me", { confirm: "DELETE" });
  ok(closed.status === 200, "they close their account");
  const afterC = (await api(O, "GET", `/projects/${id}`)).body;
  const cMsg = afterC.messages.find((m) => m.text === "A change before closing");
  ok(cMsg && !cMsg.by && !cMsg.images, "their message stays, from no one (a former member), its picture gone");
  ok((await db.query(`SELECT count(*)::int AS n FROM "Attachment" WHERE id = $1`, [cPic.body.id])).rows[0].n === 0, "their picture's row is deleted");
  ok(!(await api(O, "GET", `/projects/${id}/people`)).body.members.some((m) => m.id === devId(C)), "they are out of the people list");
  ok((await db.query(`SELECT count(*)::int AS n FROM "ProjectInvite" WHERE "projectId" = $1 AND email = $2`, [id, emailOf(C)])).rows[0].n === 0, "the invitation they accepted is deleted with the account");
  const formerLine = (await api(O, "GET", "/me/usage?limit=100")).body.entries.find((u) => u.kind === "charge" && u.by === "A former member");
  ok(!!formerLine, "the owner's history says the charge was a former member's");

  console.log("the game deleted by its owner");
  evE.close();
  evO.close();
  ok((await api(O, "DELETE", `/projects/${id}`)).status === 200, "the owner deletes it: 200");
  projects.splice(projects.indexOf(id), 1);
  ok((await status(E, "GET", `/projects/${id}`)) === 404 && !(await api(E, "GET", "/shared")).body.some((g) => g.id === id), "the editors get 404, and it left their Shared with you");
  ok((await db.query(`SELECT count(*)::int AS n FROM "ProjectMember" WHERE "projectId" = $1`, [id])).rows[0].n === 0 && (await db.query(`SELECT count(*)::int AS n FROM "ProjectInvite" WHERE "projectId" = $1`, [id])).rows[0].n === 0, "its members and invitations went with it");
} catch (e) {
  failures++;
  console.log(`  FAIL ${e.stack ?? e}`);
  console.log(log.slice(-3000));
} finally {
  for (const p of projects) await api(O, "DELETE", `/projects/${p}`).catch(() => {});
  for (const p of projects) await api(F, "DELETE", `/projects/${p}`).catch(() => {});
  for (const t of [O, E, E2, P, X, W, R, L, F, G1]) await api(t, "DELETE", "/me", { confirm: "DELETE" }).catch(() => {});
  await db.end().catch(() => {});
  if (child) {
    child.kill();
    await new Promise((r) => (child.exitCode !== null ? r() : child.once("exit", r)));
  }
}
console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
