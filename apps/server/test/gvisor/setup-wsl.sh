#!/usr/bin/env bash
# Docker Engine and gVisor in WSL (Ubuntu) for the gVisor trial (RESULTS.md next to this file): the live API
# server's Docker version, and gVisor through deploy/api/gvisor.sh, the same script the server would run.
# Run as root, once (safe to re-run):
#   wsl -u root -e bash apps/server/test/gvisor/setup-wsl.sh
set -euo pipefail

DOCKER_VERSION=29.9.2   # the API server's `docker version` on 2026-10-26
REPO="${REPO:-$(cd "$(dirname "$0")/../../../.." && pwd)}"
. /etc/os-release

apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg >/dev/null
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
cat > /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $VERSION_CODENAME
Components: stable
Signed-By: /etc/apt/keyrings/docker.asc
EOF
apt-get update -qq
# Read in full first: awk leaving early would kill apt-cache with SIGPIPE, which pipefail turns into a silent exit.
madison=$(apt-cache madison docker-ce)
ver=$(awk -v v="$DOCKER_VERSION" '$3 ~ (":" v "-") { print $3; exit }' <<<"$madison")
if [ -z "$ver" ]; then
  echo "docker-ce $DOCKER_VERSION is not in Docker's repo for $VERSION_CODENAME; newest:" >&2
  sed -n '1,3p' <<<"$madison" >&2
  exit 1
fi
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "docker-ce=$ver" "docker-ce-cli=$ver" containerd.io \
  docker-buildx-plugin docker-compose-plugin >/dev/null
mkdir -p /etc/docker
# As the servers' cloud-init (deploy/server/cloud-init.yaml): container logs rotate.
[ -s /etc/docker/daemon.json ] || echo '{ "log-driver": "local" }' > /etc/docker/daemon.json
systemctl enable --now docker.service >/dev/null 2>&1
sh "$REPO/deploy/api/gvisor.sh"
echo "Docker $(docker version --format '{{.Server.Version}}'), $(runsc --version | head -1)"
cat /etc/docker/daemon.json
