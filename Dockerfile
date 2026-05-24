# syntax=docker/dockerfile:1
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build
# Compile the custom server (server.ts + ./src/lib/socket/*) into a single
# JS bundle. We can't run it via tsx at runtime — tsx's loader conflicts
# with Next.js's AsyncLocalStorage isolation.
RUN npx esbuild server.ts \
      --bundle \
      --platform=node \
      --target=node22 \
      --format=cjs \
      --outfile=dist/server.cjs \
      --packages=external

# Stage to install ONLY production deps — keeps the runner image lean.
FROM node:22-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && \
    # Prisma needs its engine binaries at runtime; generate them here too.
    npx prisma generate
COPY prisma ./prisma
RUN npx prisma generate

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# dumb-init reaps zombies and forwards signals cleanly. Without it,
# SIGTERM from the orchestrator is ignored by Node.
RUN apk add --no-cache dumb-init wget && \
    addgroup -S app && adduser -S app -G app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=prod-deps /app/node_modules ./node_modules
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/signin > /dev/null || exit 1
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.cjs"]
