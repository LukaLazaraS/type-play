# The site's image, built on the server from `turbo prune web --docker` (json/ = manifests, full/ = source).
FROM node:22-bookworm-slim AS deps
WORKDIR /repo
ENV NEXT_TELEMETRY_DISABLED=1 PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY json/ ./
RUN npm ci --no-audit --no-fund

FROM deps AS build
COPY full/ ./
ARG NEXT_PUBLIC_GAMES_ORIGIN
ARG NEXT_PUBLIC_API_ORIGIN
ARG NEXT_PUBLIC_APP=0
# The closed beta (beta 1): the signed-out /create and /games say it before sign-in; "1" while the API's BETA_INVITE_ONLY is on.
ARG NEXT_PUBLIC_CLOSED_BETA=0
# Paddle.js (payments part 3): the public client token and its environment; empty = "opens here soon".
ARG NEXT_PUBLIC_PADDLE_ENV=""
ARG NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=""
# Notifications (Web Push): the live VAPID pair's public half (deploy.mjs `site` fills it in); empty = no notifications.
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY=""
ENV NEXT_PUBLIC_GAMES_ORIGIN=$NEXT_PUBLIC_GAMES_ORIGIN NEXT_PUBLIC_API_ORIGIN=$NEXT_PUBLIC_API_ORIGIN NEXT_PUBLIC_APP=$NEXT_PUBLIC_APP
ENV NEXT_PUBLIC_CLOSED_BETA=$NEXT_PUBLIC_CLOSED_BETA
ENV NEXT_PUBLIC_PADDLE_ENV=$NEXT_PUBLIC_PADDLE_ENV NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=$NEXT_PUBLIC_PADDLE_CLIENT_TOKEN
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY
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
