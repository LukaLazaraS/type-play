#!/usr/bin/env bash
# Starts the live compose file (deploy/api/compose.yaml, the runner on `runtime: runsc`) in WSL and checks what the
# server depends on: the runner runs under gVisor and turns healthy; the api container (runc, uid 1000, no
# capabilities) reaches the runner's socket in the shared volume; inside the sandbox `api` resolves and :8787
# answers; the internet does not. A copy of the compose file runs in a scratch folder (its ./data, ./api.env).
#   wsl -u root -e bash apps/server/test/gvisor/compose-check.sh
set -uo pipefail
REPO="${REPO:-$(cd "$(dirname "$0")/../../../.." && pwd)}"
WORK=$(mktemp -d /tmp/gvb-compose.XXXXXX)
P=gvb-prod
cp "$REPO/deploy/api/compose.yaml" "$WORK/compose.yaml"
: > "$WORK/api.env"
mkdir -p "$WORK/data" "$WORK/assets"
dc() { docker compose -p "$P" -f "$WORK/compose.yaml" "$@"; }
fails=0
pass() { printf 'PASS %s\n' "$*"; }
fail() { printf 'FAIL %s\n' "$*"; fails=$((fails + 1)); }
cleanup() { docker rm -f "$P-fakeapi" >/dev/null 2>&1; dc down -v --remove-orphans -t 5 >/dev/null 2>&1; rm -rf "$WORK"; }
trap cleanup EXIT

systemctl set-property --runtime system.slice AllowedCPUs=4-15 CPUWeight=20
t0=$(date +%s%N)
if dc up -d --wait --wait-timeout 120 runner >/dev/null 2>"$WORK/up.err"; then
  pass "runner up and healthy in $(( ($(date +%s%N) - t0) / 1000000 )) ms (compose --wait: Docker's own healthcheck)"
else
  fail "runner did not turn healthy: $(tail -5 "$WORK/up.err")"; dc logs --tail 30 runner
fi
rt=$(docker inspect -f '{{.HostConfig.Runtime}}' "$P-runner-1" 2>/dev/null)
[ "$rt" = runsc ] && pass "runner's runtime: $rt" || fail "runner's runtime is '$rt', not runsc"
k=$(dc exec -T runner uname -r 2>&1)
case "$k" in *gvisor*) pass "kernel inside the runner: $k";; *) fail "kernel inside the runner: $k";; esac
dc exec -T runner sh -c 'dmesg 2>/dev/null | head -1' | grep -q gVisor && pass "dmesg inside the runner says gVisor" || fail "no gVisor dmesg"

# The api container (runc, user 1000, cap_drop ALL): the runner's socket through the named volume.
out=$(dc run --rm --no-deps -T api node -e '
const http = require("http");
const ask = (method, path, body) => new Promise((ok) => {
  const data = body ? JSON.stringify(body) : "";
  const req = http.request({ socketPath: "/run/typeplay/runner.sock", method, path, headers: { "content-type": "application/json", "content-length": Buffer.byteLength(data) } },
    (res) => { let t = ""; res.on("data", (c) => (t += c)); res.on("end", () => ok(res.statusCode + " " + t)); });
  req.on("error", (e) => ok("ERR " + e.code));
  req.end(data);
});
(async () => {
  console.log("health: " + await ask("GET", "/health"));
  console.log("job: " + await ask("POST", "/jobs", { kind: "git", project: "no-such-game", args: ["status"] }));
})();' 2>&1)
echo "$out" | sed 's/^/     /'
echo "$out" | grep -q '^health: 200 {"ok":true' && pass "api container → runner socket: /health answers" || fail "api container can't reach the runner's socket"
echo "$out" | grep -q '^job: 400 .*no such project folder' && pass "api container → runner: a job is answered (400 for a missing folder)" || fail "job over the socket: $out"
stat -c '%U:%G %a' "$(docker volume inspect -f '{{.Mountpoint}}' "${P}_runner-socket")/runner.sock" 2>/dev/null | sed 's/^/     socket on the host: /'

# Inside the sandbox: `api` (the runner's extra_hosts) is the api's fixed address and answers; the internet doesn't.
# A stand-in api on that address (the real one needs the database).
docker run -d --rm --name "$P-fakeapi" --network "${P}_agents" --ip 10.200.0.2 typeplay-api \
  node -e 'require("http").createServer((q, s) => s.end("proxy-ok")).listen(8787, "0.0.0.0")' >/dev/null
sleep 2
r=$(dc exec -T runner node -e 'fetch("http://api:8787").then((r) => r.text()).then((t) => console.log(t), (e) => console.log("ERR " + (e.cause?.code || e.message)))' 2>&1)
[ "$r" = proxy-ok ] && pass "runner → http://api:8787 (the key proxy's address) answers" || fail "runner → api:8787: $r"
r=$(dc exec -T runner node -e 'fetch("http://1.1.1.1", { signal: AbortSignal.timeout(5000) }).then(() => console.log("REACHED"), (e) => console.log("blocked: " + (e.cause?.code || e.name)))' 2>&1)
case "$r" in blocked*) pass "runner → internet by address (1.1.1.1): $r";; *) fail "runner → internet: $r";; esac

echo "$fails failure(s)"
exit $(( fails > 0 ))
