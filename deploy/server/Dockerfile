# The site's image, built on the server from `turbo prune web --docker` (json/ = manifests, full/ = source).
FROM node:22-bookworm-slim AS deps
WORKDIR /repo
ENV NEXT_TELEMETRY_DISABLED=1 PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY json/ ./
RUN npm ci --no-audit --no-fund

FROM deps AS build
COPY full/ ./
ARG NEXT_PUBLIC_GAMES_ORIGIN
ENV NEXT_PUBLIC_GAMES_ORIGIN=$NEXT_PUBLIC_GAMES_ORIGIN
RUN npm run build --workspace=web

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
