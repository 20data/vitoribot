# syntax=docker/dockerfile:1

# ─── Web admin panel (Next.js 14) — multi-stage, Alpine, non-root ───
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json turbo.json ./
COPY apps/web/package.json apps/web/
RUN npm ci

FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY apps/web ./apps/web
COPY package.json turbo.json ./
ARG NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace=@vitoribot/web

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup -S nextjs && adduser -S nextjs -G nextjs \
  && mkdir -p /app/apps/web/.next/cache && chown -R nextjs:nextjs /app
USER nextjs
COPY --from=builder --chown=nextjs:nextjs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nextjs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nextjs /app/apps/web ./apps/web
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/login').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["npm", "run", "start", "--workspace=@vitoribot/web"]
