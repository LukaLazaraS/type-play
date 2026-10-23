# The API server's image, built on that server from `turbo prune @typeplay/server @typeplay/agent
# @typeplay/shared --docker` (json/ = manifests, full/ = source). One image, three services
# (compose.yaml): `api` (NestJS + key proxy, holds the secrets), `runner` (game agent runs, Godot
# web and Android exports, the check's hidden browser, git in game folders; no secrets, no internet)
# and `signer` (signs Android builds with the game's upload key; no network, read-only, no secrets).
# The Android toolchain stages (android-sdk, gradle-seed, self-test) come before `COPY full/`, so
# BuildKit keeps them across deploys; the self-test exports the blank template with no network and
# fails the build (so the deploy, never a user's export) when the toolchain is broken.

FROM node:22-bookworm-slim AS deps
WORKDIR /repo
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 NEXT_TELEMETRY_DISABLED=1
# Prisma picks its engine build by the OpenSSL it finds.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY json/ ./
RUN npm ci --no-audit --no-fund

FROM deps AS build
COPY full/ ./
# Debian is glibc: the Agent SDK's musl build of Claude Code (~250 MB) is never used.
RUN npm run build --workspace=@typeplay/server \
  && rm -rf node_modules/@anthropic-ai/claude-agent-sdk-linux-*-musl

# Godot for Linux (one binary; --headless needs no display), its web export templates and the two
# Android release templates (no debug builds), from the official GitHub release, checked against
# the release's SHA512-SUMS.txt.
FROM debian:bookworm-slim AS godot
ARG GODOT_VERSION=4.7.2
ARG GODOT_SHA512=9aa00f7a605200940bce3027a567b782f49bd8e940dd06ae9e987bd65aee1b1467edd56ed84fcdcbdd44354bf613bdbb4e5d2913e925850368e150c59ed54c65
ARG TEMPLATES_SHA512=ca4d71c4d7b81dfc15d1a98baa07534aa95b03fdda78a0075b06672e1648d2e5f40980c9adc28d23e1b92e732ee7bf3461997aa804af74ec2fcd7a93ccb84079
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl unzip \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /tmp/godot
RUN set -eux; \
  base="https://github.com/godotengine/godot/releases/download/${GODOT_VERSION}-stable"; \
  curl -fsSLo godot.zip "$base/Godot_v${GODOT_VERSION}-stable_linux.x86_64.zip"; \
  echo "${GODOT_SHA512}  godot.zip" | sha512sum -c -; \
  unzip -q godot.zip; \
  mkdir -p /opt/godot; \
  mv "Godot_v${GODOT_VERSION}-stable_linux.x86_64" /opt/godot/godot; \
  chmod 755 /opt/godot/godot; \
  curl -fsSLo templates.tpz "$base/Godot_v${GODOT_VERSION}-stable_export_templates.tpz"; \
  echo "${TEMPLATES_SHA512}  templates.tpz" | sha512sum -c -; \
  unzip -q templates.tpz 'templates/web_nothreads_*' 'templates/version.txt' 'templates/android_release.apk' 'templates/android_source.zip'; \
  mkdir -p "/opt/godot/export_templates/${GODOT_VERSION}.stable"; \
  mv templates/* "/opt/godot/export_templates/${GODOT_VERSION}.stable/"; \
  chmod -R a+rX /opt/godot; \
  rm -rf /tmp/godot

# The Android toolchain (docs/android-export-design.md §2): Temurin JDK 17 (a tarball, self-contained,
# the same bits as the WSL test), the command-line tools, and the build-tools and platform the Godot
# template was built for (read from its config.gradle: 36.1.0 and 36 for 4.7.2), bundletool. All pinned
# by hash. No NDK (Godot's release libraries are already stripped; AGP only warns), no CMake.
# `yes | sdkmanager --licenses` accepts the Android SDK licence in Luka's name; the image stays private.
FROM debian:bookworm-slim AS android-sdk
ARG JDK_TGZ=OpenJDK17U-jdk_x64_linux_hotspot_17.0.20.1_1.tar.gz
ARG JDK_URL=https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.20.1%2B1/OpenJDK17U-jdk_x64_linux_hotspot_17.0.20.1_1.tar.gz
ARG JDK_SHA256=3808d1d15e3ec6bd5b84057fb5d84c33d8a1536a258146bcea2e603fc726e08e
ARG CMDLINE_ZIP=commandlinetools-linux-15859902_latest.zip
ARG CMDLINE_SHA256=4e4c464f145a7512b57d088ac6c278c03c9eea610886b35a5e0804e74eedf583
ARG BUNDLETOOL_VERSION=1.18.3
ARG BUNDLETOOL_SHA256=a099cfa1543f55593bc2ed16a70a7c67fe54b1747bb7301f37fdfd6d91028e29
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl unzip \
  && rm -rf /var/lib/apt/lists/*
RUN set -eux; \
  mkdir -p /opt/android/jdk; cd /tmp; \
  curl -fsSLo "$JDK_TGZ" "$JDK_URL"; echo "${JDK_SHA256}  $JDK_TGZ" | sha256sum -c -; \
  tar -xzf "$JDK_TGZ" -C /opt/android/jdk --strip-components=1; rm "$JDK_TGZ"; \
  rm -rf /opt/android/jdk/lib/src.zip /opt/android/jdk/man; \
  curl -fsSLo "$CMDLINE_ZIP" "https://dl.google.com/android/repository/$CMDLINE_ZIP"; echo "${CMDLINE_SHA256}  $CMDLINE_ZIP" | sha256sum -c -; \
  mkdir -p /opt/android/sdk/cmdline-tools; unzip -q "$CMDLINE_ZIP" -d /opt/android/sdk/cmdline-tools; \
  mv /opt/android/sdk/cmdline-tools/cmdline-tools /opt/android/sdk/cmdline-tools/latest; rm "$CMDLINE_ZIP"; \
  curl -fsSLo /opt/android/bundletool.jar "https://github.com/google/bundletool/releases/download/${BUNDLETOOL_VERSION}/bundletool-all-${BUNDLETOOL_VERSION}.jar"; \
  echo "${BUNDLETOOL_SHA256}  /opt/android/bundletool.jar" | sha256sum -c -
COPY --from=godot /opt/godot/export_templates /tmp/templates
RUN set -eux; export JAVA_HOME=/opt/android/jdk PATH="/opt/android/jdk/bin:$PATH"; \
  src=$(ls /tmp/templates/*/android_source.zip); \
  unzip -p "$src" '*config.gradle' > /tmp/config.gradle; \
  bt=$(sed -n "s/.*buildTools *: *['\"]\([0-9.]*\)['\"].*/\1/p" /tmp/config.gradle | head -1); \
  sdk=$(sed -n 's/.*compileSdk *: *\([0-9]*\).*/\1/p' /tmp/config.gradle | head -1); \
  agp=$(sed -n "s/.*androidGradlePlugin *: *['\"]\([0-9.]*\)['\"].*/\1/p" /tmp/config.gradle | head -1); \
  gradle=$(unzip -p "$src" '*gradle-wrapper.properties' | sed -n 's/.*gradle-\([0-9.]*\)-bin.zip.*/\1/p' | head -1); \
  test -n "$bt" && test -n "$sdk"; \
  (yes 2>/dev/null || true) | /opt/android/sdk/cmdline-tools/latest/bin/sdkmanager --sdk_root=/opt/android/sdk --licenses >/dev/null 2>&1 || true; \
  /opt/android/sdk/cmdline-tools/latest/bin/sdkmanager --sdk_root=/opt/android/sdk "platform-tools" "build-tools;$bt" "platforms;android-$sdk" >/dev/null; \
  test -x "/opt/android/sdk/build-tools/$bt/apksigner"; \
  echo "$bt" > /opt/android/BUILD_TOOLS; \
  echo "godot$(cat /tmp/templates/*/version.txt | tr -d '\n' | sed 's/\.stable.*//')+agp${agp:-?}+gradle${gradle:-?}+bt${bt}+sdk${sdk}+jdk17.0.20.1+bundletool${BUNDLETOOL_VERSION}" > /opt/android/TOOLCHAIN; \
  rm -rf /tmp/templates /tmp/config.gradle /opt/android/sdk/.temp /opt/android/sdk/emulator; \
  chmod -R a+rX /opt/android

# The Gradle seed: one real AAB export of the blank template with internet, so every later build
# (offline, in the runner) finds Gradle 8.11.1, AGP, Kotlin and AndroidX in its copy of this home.
# Only the files named here are copied from the source tree, so a game-agent change doesn't rebuild it.
FROM node:22-bookworm-slim AS gradle-seed
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates fonts-dejavu-core \
  && rm -rf /var/lib/apt/lists/*
COPY --from=godot /opt/godot /opt/godot
COPY --from=android-sdk /opt/android /opt/android
COPY android/ /opt/typeplay/android/
COPY full/apps/server/runner/android-prepare.mjs full/apps/server/runner/android-icons.gd /opt/typeplay/runner/
COPY full/packages/agent/templates/blank/ /opt/typeplay/blank/
RUN sh /opt/typeplay/android/steps.sh seed

# No network from here: the blank template to APK and AAB from a copy of the seed, then the checks
# (target SDK 36+, 16 KB pages, not debuggable, no permissions). The final stage copies /opt/android
# from this stage, so a failed self-test fails the image build.
FROM gradle-seed AS self-test
RUN --network=none sh /opt/typeplay/android/steps.sh selftest && touch /opt/android/SELFTEST_OK

FROM node:22-bookworm-slim
# git: every game is a repo. chromium: the check's hidden browser (software WebGL). openssl: Prisma.
RUN apt-get update && apt-get install -y --no-install-recommends \
    git chromium openssl ca-certificates procps fonts-dejavu-core \
  && rm -rf /var/lib/apt/lists/*
# The check's screenshots need WebGL 2 in software (SwiftShader). If this browser can't, stop the
# build here rather than fail every game check later (deploy/README.md, "The API").
RUN page="data:text/html,<canvas id=c></canvas><script>document.title=c.getContext('webgl2')?'WEBGL2-OK':'NO-WEBGL2'</script>"; \
  chromium --headless=new --no-sandbox --disable-dev-shm-usage --use-angle=swiftshader --enable-unsafe-swiftshader \
    --user-data-dir=/tmp/webgl-check --dump-dom "$page" 2>/dev/null | grep -q '<title>WEBGL2-OK</title>' \
  || { echo "chromium has no software WebGL 2: the game check would fail" >&2; exit 1; }; \
  rm -rf /tmp/webgl-check
COPY --from=godot /opt/godot /opt/godot
COPY --from=self-test /opt/android /opt/android
COPY android/ /opt/typeplay/android/
# The runner's throwaway users, one per job slot (uid 10001-10008). Nobody logs in as them.
RUN for i in 1 2 3 4 5 6 7 8; do \
    groupadd -g $((10000 + i)) "run$i" && useradd -u $((10000 + i)) -g "run$i" -M -d "/home/runs/slot$i" -s /bin/bash "run$i"; \
  done
# The exports volume and the signer's socket folder: the api's and the signer's (uid 1000), so the
# named volumes inherit that ownership (a non-root signer cannot chown a fresh volume).
RUN mkdir -p /exports /run/typeplay-signer && chown 1000:1000 /exports /run/typeplay-signer && chmod 750 /exports /run/typeplay-signer
WORKDIR /app
COPY --from=build /repo ./
# The slot users read (never write) the agent package and the runner.
RUN chmod -R a+rX /app/packages/agent /app/apps/server/runner /opt/typeplay/android
ENV NODE_ENV=production \
    GODOT_VERSION=4.7.2 \
    GODOT_EXE=/opt/godot/godot \
    GODOT_TEMPLATES=/opt/godot/export_templates \
    BROWSER_EXE=/usr/bin/chromium \
    DATA_DIR=/data \
    JAVA_HOME=/opt/android/jdk \
    ANDROID_HOME=/opt/android/sdk \
    BUNDLETOOL_JAR=/opt/android/bundletool.jar \
    GRADLE_SEED=/opt/android/gradle-home \
    ANDROID_ICONS=/opt/typeplay/android/icons
CMD ["node", "apps/server/dist/main.js"]
