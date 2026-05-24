# partyroom

Self-hosted YouTube watch-party — synced playback, chat, queue, and reactions, with a Duolingo-inspired UI.

🌐 **Live:** [partyroom.musel.dev](https://partyroom.musel.dev)

## What it does

- Paste a YouTube link **or search YouTube** to start a room, share the link with friends.
- Everyone watches in perfect sync (play, pause, seek, skip — democratic control).
- Chat in real time. Shared queue with who-added-what. Floating-emoji reactions.
- "Friends watching now" surfaces a one-click join when a friend is hosting.
- Light + dark mode.
- Sign in with Google, or join a room as a guest with just a nickname.

## Stack

Next.js 15 · TypeScript · Tailwind · Socket.IO · PostgreSQL · Prisma · Auth.js v5 (Google OAuth) · Docker · host nginx

## Local development

```bash
npm install
cp .env.example .env       # fill in NEXTAUTH_SECRET, GOOGLE_CLIENT_ID/SECRET
npm run db:up              # boots Postgres in Docker on :5433
npx prisma migrate dev
npm run dev                # http://localhost:3000
```

## Testing

```bash
npm test           # vitest — unit + integration (~44 tests, <1s)
npm run test:watch # vitest in watch mode
npm run test:e2e   # playwright — smoke test against next dev
npm run test:ci    # both, in order
```

- **Unit / integration tests** live next to the code in `src/**/*.test.ts` and in `tests/{api,socket}/*.test.ts`. They cover pure logic (state reducers, the URL parser, rate limiter), socket handlers (with a mocked Prisma + fake Socket.IO via `tests/helpers/`), API routes (handler called with a synthetic `Request`), and the room rehydrate guard.
- **E2E tests** in `tests/e2e/*.spec.ts` use Playwright. The smoke test boots `next dev` and verifies the unauthenticated landing flow + auth.js providers endpoint. We deliberately don't try to E2E the WebSocket sync — too timing-dependent. Socket logic is covered by the unit/integration tests.
- CI runs both jobs on every push and PR. See `.github/workflows/ci.yml`.

For the full test design rationale, see [`TESTING_PLAN.md`](TESTING_PLAN.md).

## Deployment

See [`docs/deploy.md`](docs/deploy.md). TL;DR: push to `main` → GitHub Actions builds an arm64 Docker image, pushes to GHCR, SSHes into the VPS, and runs `docker compose pull && up -d`.

## License

MIT
