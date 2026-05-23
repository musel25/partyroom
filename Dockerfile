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

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
USER app
EXPOSE 3000
CMD ["node", "dist/server.cjs"]
