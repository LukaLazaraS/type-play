#!/bin/sh
# gVisor (runsc) for the runner container (compose.yaml: `runtime: runsc` on the runner only): installs the
# pinned release and registers it as Docker's "runsc" runtime with the systrap platform (Hetzner's CPX
# servers have no nested virtualization: no /dev/kvm, so no KVM platform). Safe to re-run: nothing changes
# when this version and these flags are in place; Docker is reloaded (SIGHUP: running containers keep
# running) only when daemon.json changed.
#   On the API server: `deploy.mjs api` runs it before `docker compose up`, as root.
#   In WSL for the trial: apps/server/test/gvisor/setup-wsl.sh runs it.
# Bump: VERSION and SHA512 from gVisor's signed apt index
# (https://storage.googleapis.com/gvisor/releases/dists/release/main/binary-amd64/Packages, whose hash is in
# InRelease, signed by "The gVisor Authors", key 6F1D F85E 3A71 C249 18E7 27D5 6FC6 D554 E32B D943).
# Older versions stay in the pool, so a pinned one keeps installing.
set -eu

VERSION=20261019.0
SHA512=39a72b8df740e2570bdc8648180f6dc49b8aa36bf189568fba00b3afb718b17e19c3c16e25d85ae6f8f54e3dcfbf937ace542814fed68abbd52bd8ce3365fdc5
# --platform=systrap: no KVM on the server. --host-uds=create: the runner listens on a Unix socket in the
# runner-socket volume and the api container (plain runc) connects to it; without this flag a socket made
# inside the sandbox exists only inside it.
FLAGS="--platform=systrap --host-uds=create"

[ "$(id -u)" = 0 ] || { echo "gvisor.sh: run as root" >&2; exit 1; }

installed=$(runsc --version 2>/dev/null | sed -n 's/^runsc version release-//p' | head -1)
if [ "$installed" != "$VERSION" ]; then
  tmp=$(mktemp -d)
  trap 'rm -rf "$tmp"' EXIT
  curl -fsSLo "$tmp/runsc.deb" "https://storage.googleapis.com/gvisor/releases/pool/$VERSION/binary-amd64/runsc.deb"
  echo "$SHA512  $tmp/runsc.deb" | sha512sum -c - >/dev/null || { echo "gvisor.sh: runsc.deb checksum mismatch" >&2; exit 1; }
  dpkg -i "$tmp/runsc.deb" >/dev/null
  echo "gvisor.sh: runsc $VERSION installed (was ${installed:-none})"
fi

before=$(cat /etc/docker/daemon.json 2>/dev/null || true)
# runsc install rewrites the runtime's entry in daemon.json and keeps the other keys (log-driver).
# shellcheck disable=SC2086 # FLAGS are separate runsc flags
out=$(runsc install --runtime=runsc -- $FLAGS 2>&1) || { echo "$out" >&2; exit 1; }
if [ "$before" != "$(cat /etc/docker/daemon.json)" ]; then
  systemctl reload docker
  echo "gvisor.sh: Docker runtime runsc registered ($FLAGS)"
fi
docker info --format '{{json .Runtimes}}' | grep -q '"runsc"' || { echo "gvisor.sh: Docker does not list the runsc runtime" >&2; exit 1; }
