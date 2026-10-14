FROM node:24-slim AS build

WORKDIR /app

RUN corepack enable

COPY . .

RUN pnpm install --frozen-lockfile

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_GOOGLE_AUTH_ENABLED

RUN PORT=8080 BASE_PATH=/ pnpm --filter ./artifacts/web build \
  && pnpm --filter ./artifacts/api-server build

FROM node:24-slim

ENV NODE_ENV=production
ENV SERVE_STATIC_DIR=/app/public

WORKDIR /app

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nodejs

COPY --from=build --chown=nodejs:nodejs /app/artifacts/api-server/dist ./dist
COPY --from=build --chown=nodejs:nodejs /app/artifacts/web/dist/public ./public

USER nodejs

CMD ["node", "--enable-source-maps", "/app/dist/index.mjs"]
