#!/usr/bin/env bash
# The live server's way onto gVisor, rehearsed in WSL: the stack as main has it (runner on runc, the agents
# network without a fixed subnet), then `docker compose up` with this branch's compose file, the same command
# `deploy.mjs api` runs. The api container idles here (the real one needs the database); caddy is left out.
#   wsl -u root -e bash apps/server/test/gvisor/upgrade-check.sh [base-ref]   (default: main)
set -uo pipefail
REPO="${REPO:-$(cd "$(dirname "$0")/../../../.." && pwd)}"
BASE="${1:-main}"
# The repository's object store (a worktree's .git file holds a Windows path that git in WSL can't follow).
GIT_DIR_MAIN="${GIT_DIR_MAIN:-/mnt/c/Users/lazar/Desktop/master-project/startups/type-play/.git}"
WORK=$(mktemp -d /tmp/gvb-upgrade.XXXXXX)
P=gvb-upg
: > "$WORK/api.env"
mkdir -p "$WORK/data" "$WORK/assets"
cat > "$WORK/idle-api.yaml" <<'EOF'
services:
  api:
    command: ["node", "-e", "setInterval(() => {}, 1e9)"]
    healthcheck:
      disable: true
EOF
dc() { docker compose -p "$P" -f "$WORK/compose.yaml" -f "$WORK/idle-api.yaml" "$@"; }
fails=0
pass() { printf 'PASS %s\n' "$*"; }
fail() { printf 'FAIL %s\n' "$*"; fails=$((fails + 1)); }
trap 'dc down -v --remove-orphans -t 5 >/dev/null 2>&1; rm -rf "$WORK"' EXIT
state() {
  printf '     runner runtime %s, agents subnet %s, api on agents %s\n' \
    "$(docker inspect -f '{{.HostConfig.Runtime}}' "$P-runner-1" 2>/dev/null)" \
    "$(docker network inspect -f '{{range .IPAM.Config}}{{.Subnet}}{{end}}' "${P}_agents" 2>/dev/null)" \
    "$(docker inspect -f '{{with index .NetworkSettings.Networks "'"${P}_agents"'"}}{{.IPAddress}}{{end}}' "$P-api-1" 2>/dev/null)"
}

git -c safe.directory='*' --git-dir="$GIT_DIR_MAIN" show "$BASE:deploy/api/compose.yaml" > "$WORK/compose.yaml" || { fail "no $BASE:deploy/api/compose.yaml"; exit 1; }
dc up -d --remove-orphans --wait api runner signer >/dev/null 2>"$WORK/up1.err" && pass "the $BASE stack is up" || { fail "the $BASE stack: $(tail -3 "$WORK/up1.err")"; exit 1; }
state
cp "$REPO/deploy/api/compose.yaml" "$WORK/compose.yaml"
t0=$(date +%s%N)
if dc up -d --remove-orphans --wait api runner signer >"$WORK/up2.out" 2>&1; then
  pass "docker compose up with the new file, in $(( ($(date +%s%N) - t0) / 1000000 )) ms"
else
  fail "docker compose up with the new file:"; sed 's/^/     /' "$WORK/up2.out" | tail -12
fi
grep -iE 'network|recreat' "$WORK/up2.out" | sed 's/^/     compose: /' | head -8
state
[ "$(docker inspect -f '{{.HostConfig.Runtime}}' "$P-runner-1" 2>/dev/null)" = runsc ] && pass "runner on runsc" || fail "runner not on runsc"
[ "$(docker network inspect -f '{{range .IPAM.Config}}{{.Subnet}}{{end}}' "${P}_agents" 2>/dev/null)" = 10.200.0.0/24 ] && pass "agents network on 10.200.0.0/24" || fail "agents network not recreated"
r=$(dc exec -T runner node -e 'require("net").connect(8787, "api").on("connect", () => { console.log("connected"); process.exit(0); }).on("error", (e) => console.log("ERR " + e.code))' 2>&1)
# Nothing listens on 8787 in the idle api, so "refused" proves the name and the route work.
case "$r" in *ECONNREFUSED*|connected) pass "runner → api:8787 reaches the api's address ($r)";; *) fail "runner → api: $r";; esac
echo "$fails failure(s)"
exit $(( fails > 0 ))
