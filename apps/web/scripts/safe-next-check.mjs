// safeNext (src/lib/safe-next.ts): where sign-in's ?next= and the checkout's ?back= may send the visitor. Security review
// 10-20: "/\t/evil.example" passed the old check, and a browser reads it as //evil.example. No server, no browser:
//   node --experimental-strip-types apps/web/scripts/safe-next-check.mjs        (or: npm run test:links -w web)
import { safeNext } from "../src/lib/safe-next.ts";

let failures = 0;
const ok = (cond, what) => {
  console.log(`${cond ? "  ok  " : "  FAIL"} ${what}`);
  if (!cond) failures++;
};

// What a link with this href does in a browser: the address it resolves to (tabs and line breaks dropped, "\" read as "/").
const lands = (href) => new URL(href, "https://typeplay.app/billing/checkout").origin;

const kept = ["/create", "/games/k3x9p2m7qd", "/billing/checkout?item=pack&back=%2Fbilling", "/billing?change=1#plans", "/play/abcd1234", "/%2F%2Fevil.example"];
for (const p of kept) ok(safeNext(p) === p && lands(p) === "https://typeplay.app", `kept, on this site: ${JSON.stringify(p)}`);

const refused = [
  "/\t/evil.example", // the 10-20 finding: a tab is dropped, then it is //evil.example
  "/\n/evil.example",
  "/\r/evil.example",
  "/\t\\evil.example",
  "/\\evil.example",
  "//evil.example",
  "/ /evil.example",
  "/\u200b/evil.example", // a zero-width space
  "https://evil.example/",
  "evil.example",
  "javascript:alert(1)",
  "",
  null,
  undefined,
];
for (const p of refused) ok(safeNext(p) === "/create", `refused: ${JSON.stringify(p)}`);
ok(lands("/\t/evil.example") === "https://evil.example", "(why: a browser takes /<tab>/evil.example to another site)");
ok(safeNext("/\t/evil.example", "/billing") === "/billing", "the fallback given is used");

console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
