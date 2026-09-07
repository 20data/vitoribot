# syntax=docker/dockerfile:1

# ─── Mini App (Vite static) — build, then serve via unprivileged nginx ───
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json turbo.json ./
COPY apps/miniapp/package.json apps/miniapp/
RUN npm ci
COPY apps/miniapp ./apps/miniapp
COPY package.json turbo.json ./
ARG VITE_API_URL=https://bot.yourdomain.com
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build --workspace=@vitoribot/miniapp

FROM nginxinc/nginx-unprivileged:alpine AS runner
COPY --from=builder /app/apps/miniapp/dist /usr/share/nginx/html
COPY apps/miniapp/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://localhost:3002/ || exit 1
