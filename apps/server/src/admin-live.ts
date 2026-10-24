// The admin CLI on the live database (docs/environments.md; the beta runbook's commands): only the root .env, the live
// values. `npm run admin:live -w @typeplay/server -- <command>`; plain `npm run admin` works on this PC's development
// database. The mode is set before admin.ts (and env.ts) load.
process.env.TYPEPLAY_ENV = "live";
console.error("admin: the LIVE database");
await import("./admin.js");
