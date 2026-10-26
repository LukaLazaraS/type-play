#!/usr/bin/env bash
# Builds the API image (deploy/api/Dockerfile, tag typeplay-api) in WSL's Docker from a pruned context,
# made on Windows the way `deploy.mjs api` makes it:
#   node node_modules/turbo/bin/turbo prune @typeplay/server @typeplay/agent @typeplay/shared --docker --out-dir <ctx>/src
#   (minus packages/agent/runs.jsonl and learn/errors.jsonl), plus deploy/api/Dockerfile and deploy/api/android/
# then: wsl -u root -e bash apps/server/test/gvisor/build-image.sh <ctx>/src   (a /mnt/c/... path)
# The context is copied to WSL's own disk first (a build from /mnt/c reads every file through 9P).
set -euo pipefail
SRC="${1:?usage: build-image.sh <pruned context folder>}"
WORK="${GVB_ROOT:-/srv/gvbench}/build"
# The trial's CPU rule (the bench sets it too): every container and build step on vCPUs 4-15, low weight.
systemctl set-property --runtime system.slice AllowedCPUs=4-15 CPUWeight=20
rm -rf "$WORK" && mkdir -p "$WORK"
cp -r "$SRC/." "$WORK/"
cd "$WORK"
start=$(date +%s)
DOCKER_BUILDKIT=1 docker build --progress=plain -t typeplay-api .
echo "image built in $(( $(date +%s) - start )) s"
docker image inspect typeplay-api --format 'typeplay-api {{.Id}} {{.Size}} bytes, created {{.Created}}'
