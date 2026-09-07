# syntax=docker/dockerfile:1

# ─── Server (Fastify + grammy) — multi-stage, Alpine, non-root ───
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json turbo.json tsconfig.base.json ./
COPY apps/server/package.json apps/server/
COPY packages/db/package.json packages/db/
COPY packages/types/package.json packages/types/
COPY packages/persian/package.json packages/persian/
COPY packages/3xui/package.json packages/3xui/
COPY packages/queue/package.json packages/queue/
COPY packages/db/prisma packages/db/prisma/
RUN npm ci

FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate --schema packages/db/prisma/schema.prisma \
  && npm run build --workspace=@vitoribot/types \
  && npm run build --workspace=@vitoribot/persian \
  && npm run build --workspace=@vitoribot/3xui \
  && npm run build --workspace=@vitoribot/queue \
  && npm run build --workspace=@vitoribot/db \
  && npm run build --workspace=@vitoribot/server \
  && npm prune --omit=dev

FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
RUN mkdir -p /app/uploads && chown -R node:node /app
USER node
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/packages ./packages
COPY --from=builder --chown=node:node /app/apps/server/dist ./apps/server/dist
COPY --from=builder --chown=node:node /app/apps/server/package.json ./apps/server/package.json
EXPOSE 3001
VOLUME ["/app/uploads"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:3001/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "apps/server/dist/main.js"]
