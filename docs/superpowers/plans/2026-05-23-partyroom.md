# partyroom Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-hosted YouTube watch-party with synced playback, chat, queue, reactions, and Google OAuth, deployed at `partyroom.musel.dev` on an OCI VPS.

**Architecture:** Next.js 15 (App Router) + Socket.IO in a single Node process, fronted by Caddy for TLS. Postgres for persistence via Prisma. Auth.js v5 for Google OAuth, signed-cookie sessions for guests. Server is authoritative for room state; clients emit intent and reconcile on broadcast.

**Tech Stack:** Next.js 15, TypeScript (strict), Tailwind CSS, shadcn/ui, Socket.IO 4, PostgreSQL 16, Prisma 5, Auth.js v5, Docker Compose, Caddy 2, GitHub Actions, Vitest, Playwright.

**Spec:** [`docs/superpowers/specs/2026-05-23-partyroom-design.md`](../specs/2026-05-23-partyroom-design.md)

**Repo:** https://github.com/musel25/partyroom

---

## Working agreement

- **TDD where it pays:** pure logic (reducers, validators), socket protocol, API routes. **Skip TDD** for UI scaffolding and CSS.
- **Branch per task:** `feat/<short>`, `fix/<short>`, `chore/<short>`. Merge to `main` when task is green. Delete the branch locally and remotely after merge.
- **Conventional commits:** `feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`.
- **Push after every commit.** Never leave local-only commits.
- **One task per session/subagent.** Each task ends with a passing build and a commit.

---

## File structure (locked in)

```
partyroom/
├── README.md
├── .gitignore
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.mjs
├── server.ts                    # custom Next.js + Socket.IO entry
├── docker-compose.yml           # local dev (postgres only)
├── docker-compose.prod.yml      # VPS (app + postgres + caddy)
├── Dockerfile
├── Caddyfile
├── .env.example
├── prisma/
│   └── schema.prisma
├── src/
│   ├── env.ts                   # zod-validated env loader
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx             # home (signed-in dashboard)
│   │   ├── globals.css
│   │   ├── signin/page.tsx
│   │   ├── (authed)/
│   │   │   ├── layout.tsx       # enforces auth
│   │   │   ├── friends/page.tsx
│   │   │   └── history/page.tsx
│   │   ├── room/[code]/
│   │   │   ├── page.tsx
│   │   │   └── guest-prompt.tsx
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts
│   │       ├── rooms/route.ts            # POST create
│   │       ├── rooms/[code]/route.ts     # GET info
│   │       ├── friends/route.ts          # GET list, POST add
│   │       └── friends/[id]/route.ts     # PATCH accept, DELETE
│   ├── lib/
│   │   ├── auth.ts                       # Auth.js config
│   │   ├── auth-guest.ts                 # guest cookie helpers
│   │   ├── db.ts                         # prisma client singleton
│   │   ├── youtube.ts                    # url → videoId, oEmbed
│   │   ├── room/
│   │   │   ├── state.ts                  # pure reducers
│   │   │   ├── state.test.ts
│   │   │   ├── store.ts                  # in-memory room map
│   │   │   └── rehydrate.ts              # load state from db on boot
│   │   ├── socket/
│   │   │   ├── types.ts                  # shared event types
│   │   │   ├── server.ts                 # io.on('connection') router
│   │   │   ├── playback.ts               # play/pause/seek/loadVideo
│   │   │   ├── queue.ts                  # add/remove/advance
│   │   │   ├── chat.ts                   # send + rate limit
│   │   │   ├── reactions.ts              # ephemeral broadcast
│   │   │   ├── presence.ts               # participant tracking
│   │   │   └── client.ts                 # browser singleton
│   │   └── rate-limit.ts                 # sliding window
│   ├── components/
│   │   ├── ui/                           # shadcn primitives
│   │   ├── home/
│   │   │   ├── hero-create-room.tsx
│   │   │   ├── recent-rooms.tsx
│   │   │   └── friends-sidebar.tsx
│   │   ├── room/
│   │   │   ├── room-shell.tsx
│   │   │   ├── room-header.tsx
│   │   │   ├── youtube-player.tsx
│   │   │   ├── playback-controls.tsx
│   │   │   ├── chat-panel.tsx
│   │   │   ├── chat-message.tsx
│   │   │   ├── queue-drawer.tsx
│   │   │   ├── reactions-overlay.tsx
│   │   │   └── participants.tsx
│   │   └── theme/
│   │       ├── duo-button.tsx            # 3D-shadow button
│   │       └── duo-card.tsx
│   └── hooks/
│       ├── use-socket.ts
│       ├── use-room-state.ts
│       ├── use-drift-correction.ts
│       └── use-typing-indicator.ts       # nice-to-have, can defer
├── tests/
│   ├── e2e/
│   │   └── sync.spec.ts                  # playwright
│   └── integration/
│       └── socket-sync.test.ts           # vitest + supertest
└── docs/
    └── superpowers/
        ├── specs/2026-05-23-partyroom-design.md
        └── plans/2026-05-23-partyroom.md
```

---

# Phase 1 — Foundations

## Task 1.1: Initialize Next.js with TypeScript and Tailwind

**Branch:** `chore/init-nextjs`

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `.gitignore` (already exists, may need updates)
- Modify: `.gitignore`

- [ ] **Step 1: Run create-next-app non-interactively**

Run from `/home/musel/Github/partyroom`:
```bash
npx --yes create-next-app@15 . \
  --typescript --tailwind --eslint --app --src-dir \
  --import-alias "@/*" --no-turbopack --use-npm
```

If prompted about overwriting README/`.gitignore`/etc., **accept** for files Next.js requires, then we'll restore the README and merge the gitignore.

Expected: `src/app/` exists with `layout.tsx`, `page.tsx`, `globals.css`.

- [ ] **Step 2: Restore project README and merge .gitignore**

```bash
git checkout HEAD -- README.md
# Append Next.js-specific entries to our existing .gitignore (deduplicate manually)
```

Make sure `.gitignore` contains: `node_modules/`, `.next/`, `.env`, `.env.local`, `coverage/`, `.superpowers/`.

- [ ] **Step 3: Lock Node version**

Create `.nvmrc`:
```
22
```

Add to `package.json`:
```json
"engines": { "node": ">=22.0.0" }
```

- [ ] **Step 4: Enable strict TypeScript**

Edit `tsconfig.json` `"compilerOptions"`:
```json
"strict": true,
"noUncheckedIndexedAccess": true,
"noImplicitOverride": true
```

- [ ] **Step 5: Smoke test the dev server**

```bash
npm run dev
```

In another terminal:
```bash
curl -s http://localhost:3000 | head -5
```

Expected: HTML containing the default Next.js page. Stop the dev server (Ctrl+C).

- [ ] **Step 6: Commit and push**

```bash
git checkout -b chore/init-nextjs
git add -A
git commit -m "chore: scaffold Next.js 15 with TypeScript and Tailwind"
git push -u origin chore/init-nextjs
git checkout main
git merge chore/init-nextjs --ff-only
git push origin main
git branch -d chore/init-nextjs
git push origin --delete chore/init-nextjs
```

---

## Task 1.2: Add Prisma and Postgres dev environment

**Branch:** `chore/prisma-postgres`

**Files:**
- Create: `prisma/schema.prisma`, `src/lib/db.ts`, `src/env.ts`, `docker-compose.yml`, `.env.example`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Install Prisma**

```bash
npm install -D prisma
npm install @prisma/client zod
```

- [ ] **Step 2: Create docker-compose.yml for local Postgres**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: partyroom-postgres-dev
    restart: unless-stopped
    environment:
      POSTGRES_USER: partyroom
      POSTGRES_PASSWORD: partyroom_dev
      POSTGRES_DB: partyroom
    ports:
      - "5433:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U partyroom"]
      interval: 5s
      retries: 5

volumes:
  pgdata:
```

Port 5433 (not 5432) to avoid clashing with any local Postgres.

- [ ] **Step 3: Create .env.example**

```
DATABASE_URL="postgresql://partyroom:partyroom_dev@localhost:5433/partyroom"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET=""                 # openssl rand -base64 32
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
NODE_ENV="development"
```

Copy to `.env`:
```bash
cp .env.example .env
openssl rand -base64 32   # paste output as NEXTAUTH_SECRET in .env
```

Fill in `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from the Google Cloud credentials downloaded earlier.

- [ ] **Step 4: Create env.ts (zod-validated runtime env)**

`src/env.ts`:
```typescript
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export const env = schema.parse(process.env);
```

- [ ] **Step 5: Create Prisma schema (minimal — Auth.js tables only for now)**

`prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  image         String?
  emailVerified DateTime?
  createdAt     DateTime  @default(now())

  accounts Account[]
  sessions Session[]
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}
```

- [ ] **Step 6: Create db.ts singleton**

`src/lib/db.ts`:
```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

- [ ] **Step 7: Add npm scripts**

In `package.json` `scripts`:
```json
"db:up": "docker compose up -d postgres",
"db:down": "docker compose down",
"db:migrate": "prisma migrate dev",
"db:generate": "prisma generate",
"db:studio": "prisma studio"
```

- [ ] **Step 8: Boot Postgres and run first migration**

```bash
npm run db:up
sleep 3
npx prisma migrate dev --name init
```

Expected: `prisma/migrations/<timestamp>_init/migration.sql` is created. Tables exist.

Verify:
```bash
docker exec partyroom-postgres-dev psql -U partyroom -d partyroom -c "\dt"
```

Should list `User`, `Account`, `Session`, `VerificationToken`, `_prisma_migrations`.

- [ ] **Step 9: Commit and push**

```bash
git checkout -b chore/prisma-postgres
git add -A
git commit -m "chore: add prisma, postgres dev compose, env validation"
git push -u origin chore/prisma-postgres
git checkout main && git merge chore/prisma-postgres --ff-only && git push
git branch -d chore/prisma-postgres && git push origin --delete chore/prisma-postgres
```

---

## Task 1.3: Custom server (Next.js + Socket.IO)

**Branch:** `chore/custom-server`

**Files:**
- Create: `server.ts`, `tsconfig.server.json`, `src/lib/socket/types.ts`
- Modify: `package.json`

- [ ] **Step 1: Install Socket.IO and tsx**

```bash
npm install socket.io socket.io-client
npm install -D tsx @types/node
```

- [ ] **Step 2: Define shared socket event types**

`src/lib/socket/types.ts`:
```typescript
export type QueueItem = {
  id: string;
  videoId: string;
  title?: string;
  thumbnail?: string;
  addedById?: string;
  addedByName?: string;
};

export type Participant = {
  socketId: string;
  userId?: string;
  guestName?: string;
  displayName: string;
};

export type RoomStateSnapshot = {
  roomId: string;
  videoId: string | null;
  playing: boolean;
  positionSec: number;
  updatedAt: number;
  queue: QueueItem[];
  participants: Participant[];
};

export type ChatMessage = {
  id: string;
  body: string;
  authorName: string;
  authorUserId?: string;
  createdAt: number;
};

// Client → Server
export interface ClientToServerEvents {
  "room:join": (payload: { roomCode: string }, ack: (state: RoomStateSnapshot | { error: string }) => void) => void;
  "room:leave": () => void;
  "playback:play": (payload: { positionSec: number }) => void;
  "playback:pause": (payload: { positionSec: number }) => void;
  "playback:seek": (payload: { positionSec: number }) => void;
  "playback:loadVideo": (payload: { videoId: string }) => void;
  "queue:add": (payload: { videoId: string; title?: string; thumbnail?: string }) => void;
  "queue:remove": (payload: { queueItemId: string }) => void;
  "queue:advance": (payload: { fromVideoId: string }) => void;
  "chat:send": (payload: { body: string }) => void;
  "reaction:send": (payload: { emoji: string }) => void;
}

// Server → Client
export interface ServerToClientEvents {
  "room:state": (state: RoomStateSnapshot) => void;
  "chat:message": (msg: ChatMessage) => void;
  "chat:history": (msgs: ChatMessage[]) => void;
  reaction: (payload: { emoji: string; fromName: string }) => void;
  "participant:join": (p: Participant) => void;
  "participant:leave": (p: { socketId: string }) => void;
  error: (payload: { code: string; message: string }) => void;
}
```

- [ ] **Step 3: Create server.ts**

`server.ts` (project root):
```typescript
import { createServer } from "node:http";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "./src/lib/socket/types";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);

async function main() {
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();
  await app.prepare();

  const httpServer = createServer((req, res) => handle(req, res));

  const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: dev ? "*" : false },
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket) => {
    console.log("[io] connection", socket.id);
    socket.on("disconnect", (reason) => {
      console.log("[io] disconnect", socket.id, reason);
    });
  });

  httpServer.listen(port, () => {
    console.log(`partyroom ready on http://${hostname}:${port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 4: Update package.json scripts**

Replace the existing `dev` and `start` scripts:
```json
"dev": "tsx watch server.ts",
"build": "next build",
"start": "NODE_ENV=production tsx server.ts",
"lint": "next lint",
"typecheck": "tsc --noEmit"
```

- [ ] **Step 5: Smoke-test**

```bash
npm run dev
```

In another terminal:
```bash
curl -s http://localhost:3000 | head -1
```

Should return `<!DOCTYPE html>...`. Logs should show `partyroom ready on http://0.0.0.0:3000`.

Stop the server.

- [ ] **Step 6: Commit and push**

```bash
git checkout -b chore/custom-server
git add -A
git commit -m "chore: add custom Node server bootstrapping Next.js and Socket.IO"
git push -u origin chore/custom-server
git checkout main && git merge chore/custom-server --ff-only && git push
git branch -d chore/custom-server && git push origin --delete chore/custom-server
```

---

# Phase 2 — Authentication

## Task 2.1: Auth.js v5 with Google OAuth

**Branch:** `feat/google-auth`

**Files:**
- Create: `src/lib/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/middleware.ts`
- Modify: `prisma/schema.prisma` (already has Account/Session — no change), `next.config.ts`

- [ ] **Step 1: Install Auth.js v5**

```bash
npm install next-auth@beta @auth/prisma-adapter
```

- [ ] **Step 2: Create auth.ts**

`src/lib/auth.ts`:
```typescript
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "./db";
import { env } from "@/env";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "database" },
  trustHost: true,
  providers: [
    Google({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  pages: {
    signIn: "/signin",
  },
});
```

- [ ] **Step 3: Wire up the route handler**

`src/app/api/auth/[...nextauth]/route.ts`:
```typescript
import { handlers } from "@/lib/auth";
export const { GET, POST } = handlers;
```

- [ ] **Step 4: Add middleware for protected routes**

`src/middleware.ts`:
```typescript
export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|signin|room).*)"],
};
```

We allow `/room/*` to bypass auth (guest mode permitted there). Auth is enforced inside that page when account-only actions are attempted.

- [ ] **Step 5: Test sign-in URL exists**

```bash
npm run dev
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/auth/providers
```

Expected: `200`. Response body should mention `google`.

- [ ] **Step 6: Commit and push**

```bash
git checkout -b feat/google-auth
git add -A
git commit -m "feat: add Auth.js v5 with Google OAuth and Prisma adapter"
git push -u origin feat/google-auth
git checkout main && git merge feat/google-auth --ff-only && git push
git branch -d feat/google-auth && git push origin --delete feat/google-auth
```

---

## Task 2.2: Sign-in page

**Branch:** `feat/signin-page`

**Files:**
- Create: `src/app/signin/page.tsx`, `src/components/theme/duo-button.tsx`

- [ ] **Step 1: Create duo-button (3D shadow Duolingo-style)**

`src/components/theme/duo-button.tsx`:
```typescript
import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";

const variantClasses: Record<Variant, string> = {
  primary: "bg-[#58cc02] text-white border-b-[#58a700] hover:brightness-105 active:translate-y-[2px] active:border-b-0",
  secondary: "bg-[#1cb0f6] text-white border-b-[#0a8fc7] hover:brightness-105 active:translate-y-[2px] active:border-b-0",
  ghost: "bg-white text-[#4b4b4b] border-2 border-[#e5e5e5] border-b-[3px] hover:bg-[#f7f7f7] active:translate-y-[2px] active:border-b-[2px]",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  children: ReactNode;
};

export function DuoButton({ variant = "primary", className, children, ...rest }: Props) {
  return (
    <button
      {...rest}
      className={cn(
        "rounded-xl px-5 py-3 font-bold uppercase tracking-wide text-sm transition-all",
        "border-b-[4px] disabled:opacity-50 disabled:cursor-not-allowed",
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}
```

If `@/lib/utils` (cn helper) doesn't exist yet, create it:

`src/lib/utils.ts`:
```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

And install deps:
```bash
npm install clsx tailwind-merge
```

- [ ] **Step 2: Create the sign-in page**

`src/app/signin/page.tsx`:
```typescript
import { signIn, auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DuoButton } from "@/components/theme/duo-button";

export default async function SignInPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#fffaf0] p-6">
      <div className="bg-white rounded-2xl p-10 max-w-md w-full border-b-[4px] border-[#e5e5e5] text-center">
        <div className="text-4xl mb-4">▶</div>
        <h1 className="text-2xl font-bold text-[#3c3c3c] mb-2">Welcome to partyroom</h1>
        <p className="text-sm text-[#777] mb-8">Watch YouTube together. Sync. Chat. Vibe.</p>

        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <DuoButton type="submit" variant="primary" className="w-full">
            Continue with Google
          </DuoButton>
        </form>

        <p className="text-xs text-[#999] mt-6">
          By signing in you agree to nothing — this is a personal project.
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Manual verification**

```bash
npm run dev
```

Visit `http://localhost:3000/signin` in your browser. Click "Continue with Google", complete OAuth, expect to land at `/` (which is the default Next.js page for now — we'll replace it next).

Verify a User row exists:
```bash
docker exec partyroom-postgres-dev psql -U partyroom -d partyroom -c "SELECT id, email, name FROM \"User\";"
```

- [ ] **Step 4: Commit and push**

```bash
git checkout -b feat/signin-page
git add -A
git commit -m "feat: add Duolingo-style sign-in page with Google button"
git push -u origin feat/signin-page
git checkout main && git merge feat/signin-page --ff-only && git push
git branch -d feat/signin-page && git push origin --delete feat/signin-page
```

---

## Task 2.3: Guest session cookies

**Branch:** `feat/guest-sessions`

**Files:**
- Create: `src/lib/auth-guest.ts`, `src/lib/auth-guest.test.ts`

- [ ] **Step 1: Install jose for signing**

```bash
npm install jose
npm install -D vitest @vitest/ui
```

- [ ] **Step 2: Add vitest config**

`vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
  },
});
```

```bash
npm install -D vite-tsconfig-paths
```

Add to `package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Write the failing test first**

`src/lib/auth-guest.test.ts`:
```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { signGuest, readGuest, GUEST_COOKIE } from "./auth-guest";

beforeAll(() => {
  process.env.NEXTAUTH_SECRET = "test-secret-test-secret-test-secret-test-12";
});

describe("guest session cookies", () => {
  it("round-trips a guest name", async () => {
    const token = await signGuest({ guestId: "g_abc", guestName: "Alice" });
    const result = await readGuest(token);
    expect(result).toEqual({ guestId: "g_abc", guestName: "Alice" });
  });

  it("rejects tampered tokens", async () => {
    const token = await signGuest({ guestId: "g_abc", guestName: "Alice" });
    const tampered = token.slice(0, -2) + "xx";
    await expect(readGuest(tampered)).resolves.toBeNull();
  });

  it("exposes the cookie name", () => {
    expect(GUEST_COOKIE).toBe("partyroom_guest");
  });
});
```

- [ ] **Step 4: Run the test, expect failure**

```bash
npm test
```

Expected: fails because `auth-guest.ts` doesn't exist.

- [ ] **Step 5: Implement auth-guest.ts**

`src/lib/auth-guest.ts`:
```typescript
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const GUEST_COOKIE = "partyroom_guest";

export type GuestSession = {
  guestId: string;
  guestName: string;
};

function key() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET required for guest sessions");
  return new TextEncoder().encode(secret);
}

export async function signGuest(payload: GuestSession): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key());
}

export async function readGuest(token: string): Promise<GuestSession | null> {
  try {
    const { payload } = await jwtVerify(token, key());
    if (typeof payload.guestId === "string" && typeof payload.guestName === "string") {
      return { guestId: payload.guestId, guestName: payload.guestName };
    }
    return null;
  } catch {
    return null;
  }
}

export async function setGuestCookie(payload: GuestSession) {
  const token = await signGuest(payload);
  const c = await cookies();
  c.set(GUEST_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
}

export async function getGuestFromCookies(): Promise<GuestSession | null> {
  const c = await cookies();
  const token = c.get(GUEST_COOKIE)?.value;
  if (!token) return null;
  return readGuest(token);
}
```

- [ ] **Step 6: Run tests, expect pass**

```bash
npm test
```

Expected: all 3 tests pass.

- [ ] **Step 7: Commit and push**

```bash
git checkout -b feat/guest-sessions
git add -A
git commit -m "feat: add signed-cookie guest sessions"
git push -u origin feat/guest-sessions
git checkout main && git merge feat/guest-sessions --ff-only && git push
git branch -d feat/guest-sessions && git push origin --delete feat/guest-sessions
```

---

# Phase 3 — Room basics (no sync yet)

## Task 3.1: Add room/queue/message/participant schema

**Branch:** `feat/room-schema`

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Extend schema**

Add to `prisma/schema.prisma`:
```prisma
model Room {
  id          String   @id @default(cuid())
  code        String   @unique
  creatorId   String
  createdAt   DateTime @default(now())
  closedAt    DateTime?

  videoId      String?
  playing      Boolean  @default(false)
  positionSec  Float    @default(0)
  stateUpdated DateTime @default(now())

  creator      User              @relation("RoomCreator", fields: [creatorId], references: [id])
  participants RoomParticipant[]
  messages     Message[]
  queue        QueueItem[]
}

model QueueItem {
  id        String   @id @default(cuid())
  roomId    String
  videoId   String
  title     String?
  thumbnail String?
  addedById String?
  position  Int
  createdAt DateTime @default(now())

  room Room @relation(fields: [roomId], references: [id], onDelete: Cascade)

  @@index([roomId, position])
}

model RoomParticipant {
  id        String    @id @default(cuid())
  roomId    String
  userId    String?
  guestName String?
  joinedAt  DateTime  @default(now())
  leftAt    DateTime?

  room Room  @relation(fields: [roomId], references: [id], onDelete: Cascade)
  user User? @relation(fields: [userId], references: [id])

  @@index([roomId])
}

model Message {
  id        String   @id @default(cuid())
  roomId    String
  userId    String?
  guestName String?
  body      String
  createdAt DateTime @default(now())

  room Room  @relation(fields: [roomId], references: [id], onDelete: Cascade)
  user User? @relation(fields: [userId], references: [id])

  @@index([roomId, createdAt])
}

model Friendship {
  id        String           @id @default(cuid())
  aId       String
  bId       String
  status    FriendshipStatus @default(PENDING)
  createdAt DateTime         @default(now())

  a User @relation("FriendA", fields: [aId], references: [id])
  b User @relation("FriendB", fields: [bId], references: [id])

  @@unique([aId, bId])
}

enum FriendshipStatus {
  PENDING
  ACCEPTED
  BLOCKED
}
```

Extend the existing `User` model with the new back-relations:
```prisma
model User {
  // ... existing fields

  rooms        Room[]            @relation("RoomCreator")
  participants RoomParticipant[]
  messages     Message[]
  friendsAsA   Friendship[]      @relation("FriendA")
  friendsAsB   Friendship[]      @relation("FriendB")
}
```

- [ ] **Step 2: Migrate**

```bash
npx prisma migrate dev --name rooms_queue_friends
```

Verify:
```bash
docker exec partyroom-postgres-dev psql -U partyroom -d partyroom -c "\dt"
```

Should list `Room`, `QueueItem`, `RoomParticipant`, `Message`, `Friendship`.

- [ ] **Step 3: Commit and push**

```bash
git checkout -b feat/room-schema
git add -A
git commit -m "feat: add Room, QueueItem, Message, Friendship schemas"
git push -u origin feat/room-schema
git checkout main && git merge feat/room-schema --ff-only && git push
git branch -d feat/room-schema && git push origin --delete feat/room-schema
```

---

## Task 3.2: YouTube URL parser

**Branch:** `feat/youtube-parser`

**Files:**
- Create: `src/lib/youtube.ts`, `src/lib/youtube.test.ts`

- [ ] **Step 1: Write failing tests**

`src/lib/youtube.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { parseYouTubeId } from "./youtube";

describe("parseYouTubeId", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtube.com/watch?v=dQw4w9WgXcQ&t=10s", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ?t=42", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["dQw4w9WgXcQ", "dQw4w9WgXcQ"],
  ])("extracts id from %s", (input, expected) => {
    expect(parseYouTubeId(input)).toBe(expected);
  });

  it.each([
    "https://example.com",
    "https://youtube.com/watch?v=tooshort",
    "https://youtube.com/watch",
    "",
    "not a url",
  ])("rejects %s", (input) => {
    expect(parseYouTubeId(input)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests, expect fail**

```bash
npm test youtube
```

- [ ] **Step 3: Implement parser**

`src/lib/youtube.ts`:
```typescript
const ID_RE = /^[A-Za-z0-9_-]{11}$/;

export function parseYouTubeId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (ID_RE.test(trimmed)) return trimmed;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "");

  if (host === "youtu.be") {
    const id = url.pathname.slice(1);
    return ID_RE.test(id) ? id : null;
  }

  if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    const v = url.searchParams.get("v");
    if (v && ID_RE.test(v)) return v;

    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length === 2 && (parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "live")) {
      return ID_RE.test(parts[1]!) ? parts[1]! : null;
    }
  }

  return null;
}

export async function fetchOEmbed(videoId: string): Promise<{ title?: string; thumbnail?: string }> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { signal: AbortSignal.timeout(3000) },
    );
    if (!res.ok) return {};
    const data = (await res.json()) as { title?: string; thumbnail_url?: string };
    return { title: data.title, thumbnail: data.thumbnail_url };
  } catch {
    return {};
  }
}
```

- [ ] **Step 4: Run tests, expect pass**

```bash
npm test youtube
```

- [ ] **Step 5: Commit and push**

```bash
git checkout -b feat/youtube-parser
git add -A
git commit -m "feat: add YouTube URL parser with oembed fetcher"
git push -u origin feat/youtube-parser
git checkout main && git merge feat/youtube-parser --ff-only && git push
git branch -d feat/youtube-parser && git push origin --delete feat/youtube-parser
```

---

## Task 3.3: Room creation API

**Branch:** `feat/room-create-api`

**Files:**
- Create: `src/app/api/rooms/route.ts`, `src/lib/room-codes.ts`, `src/lib/room-codes.test.ts`

- [ ] **Step 1: Write failing test for room code generator**

`src/lib/room-codes.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { generateRoomCode } from "./room-codes";

describe("generateRoomCode", () => {
  it("returns a string matching XXX-XXX with safe alphabet", () => {
    const code = generateRoomCode();
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{3}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{3}$/);
  });

  it("generates distinct codes across many calls", () => {
    const codes = new Set(Array.from({ length: 200 }, () => generateRoomCode()));
    expect(codes.size).toBe(200);
  });
});
```

- [ ] **Step 2: Implement room-codes**

`src/lib/room-codes.ts`:
```typescript
import { randomInt } from "node:crypto";

// Avoid look-alike characters: 0/O, 1/I/L, U/V
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function group(): string {
  let s = "";
  for (let i = 0; i < 3; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s;
}

export function generateRoomCode(): string {
  return `${group()}-${group()}`;
}
```

- [ ] **Step 3: Run tests, expect pass**

```bash
npm test room-codes
```

- [ ] **Step 4: Implement the create-room API**

`src/app/api/rooms/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseYouTubeId, fetchOEmbed } from "@/lib/youtube";
import { generateRoomCode } from "@/lib/room-codes";

const Body = z.object({
  youtubeUrl: z.string().min(1).max(2048),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "auth required" }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const videoId = parseYouTubeId(parsed.data.youtubeUrl);
  if (!videoId) {
    return NextResponse.json({ error: "Not a valid YouTube URL" }, { status: 400 });
  }

  // Retry on rare code collision
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateRoomCode();
    try {
      const room = await db.room.create({
        data: {
          code,
          creatorId: session.user.id,
          videoId,
          playing: false,
          positionSec: 0,
        },
      });

      // Best-effort oEmbed for the initial video (non-blocking)
      void fetchOEmbed(videoId).then(async ({ title, thumbnail }) => {
        if (title || thumbnail) {
          await db.queueItem.create({
            data: { roomId: room.id, videoId, title, thumbnail, position: 0 },
          }).catch(() => {});
        }
      });

      return NextResponse.json({ code: room.code });
    } catch (e: unknown) {
      // Prisma unique violation: retry with a fresh code
      if ((e as { code?: string }).code === "P2002") continue;
      throw e;
    }
  }

  return NextResponse.json({ error: "could not allocate room code" }, { status: 500 });
}
```

- [ ] **Step 5: Manual smoke-test**

Start the server, sign in via the browser, then in a separate terminal grab your session cookie and POST:
```bash
# Easiest: just hit it from the browser dev tools console after signing in
fetch("/api/rooms", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ youtubeUrl: "https://youtu.be/dQw4w9WgXcQ" }),
}).then(r => r.json()).then(console.log)
```

Expected: `{ code: "XXX-XXX" }`. Verify in DB:
```bash
docker exec partyroom-postgres-dev psql -U partyroom -d partyroom -c "SELECT code, \"videoId\" FROM \"Room\";"
```

- [ ] **Step 6: Commit and push**

```bash
git checkout -b feat/room-create-api
git add -A
git commit -m "feat: add room creation API with collision-safe codes"
git push -u origin feat/room-create-api
git checkout main && git merge feat/room-create-api --ff-only && git push
git branch -d feat/room-create-api && git push origin --delete feat/room-create-api
```

---

## Task 3.4: Home page (action-first)

**Branch:** `feat/home-page`

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/components/home/hero-create-room.tsx`, `src/app/(authed)/layout.tsx`

- [ ] **Step 1: Create authed layout**

`src/app/(authed)/layout.tsx`:
```typescript
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export default async function AuthedLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  return <>{children}</>;
}
```

Move `src/app/page.tsx` → `src/app/(authed)/page.tsx`:
```bash
mkdir -p src/app/\(authed\)
mv src/app/page.tsx src/app/\(authed\)/page.tsx
```

- [ ] **Step 2: Build the hero component**

`src/components/home/hero-create-room.tsx`:
```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DuoButton } from "@/components/theme/duo-button";

export function HeroCreateRoom({ userName }: { userName: string }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ youtubeUrl: url }),
      });
      const data = (await res.json()) as { code?: string; error?: string };
      if (!res.ok || !data.code) throw new Error(data.error ?? "failed");
      router.push(`/room/${data.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl p-6 text-white border-b-[4px] border-[#3d8500]"
         style={{ background: "linear-gradient(135deg, #58cc02 0%, #89e219 100%)" }}>
      <h2 className="text-xl font-bold mb-1">👋 Hey {userName}</h2>
      <p className="text-sm text-white/90 mb-4">Paste a YouTube link to start watching together.</p>
      <form onSubmit={submit} className="space-y-3">
        <input
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://youtube.com/watch?v=..."
          className="w-full rounded-xl px-4 py-3 text-[#3c3c3c] placeholder-[#aaa] focus:outline-none"
        />
        <DuoButton type="submit" variant="ghost" disabled={busy} className="w-full !bg-white !text-[#58a700] !border-[#3d8500]">
          {busy ? "Creating…" : "Create room"}
        </DuoButton>
        {error && <p className="text-xs text-red-100">⚠ {error}</p>}
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Replace home page**

`src/app/(authed)/page.tsx`:
```typescript
import { auth, signOut } from "@/lib/auth";
import { HeroCreateRoom } from "@/components/home/hero-create-room";
import { DuoButton } from "@/components/theme/duo-button";

export default async function Home() {
  const session = await auth();
  const name = session?.user?.name?.split(" ")[0] ?? "friend";

  return (
    <main className="min-h-screen bg-[#fffaf0] p-6">
      <div className="max-w-5xl mx-auto">
        <header className="flex justify-between items-center mb-6 bg-white rounded-xl px-5 py-3 border-b-[3px] border-[#e5e5e5]">
          <div className="text-xl font-bold text-[#58cc02]">▶ partyroom</div>
          <form action={async () => { "use server"; await signOut({ redirectTo: "/signin" }); }}>
            <button className="text-sm font-bold text-[#777] hover:text-[#3c3c3c]">Sign out</button>
          </form>
        </header>

        <div className="grid md:grid-cols-[1fr_280px] gap-5">
          <div className="space-y-5">
            <HeroCreateRoom userName={name} />
            <section className="bg-white rounded-2xl p-5 border-b-[3px] border-[#e5e5e5]">
              <div className="text-xs font-bold uppercase text-[#999] mb-3">Recent rooms</div>
              <p className="text-sm text-[#777]">No rooms yet — create one above!</p>
            </section>
          </div>
          <aside className="bg-white rounded-2xl p-5 border-b-[3px] border-[#e5e5e5]">
            <div className="text-xs font-bold uppercase text-[#999] mb-3">Friends</div>
            <p className="text-sm text-[#777]">Coming soon.</p>
          </aside>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Verify**

```bash
npm run dev
```

Sign in → see Duolingo-green hero → paste a YouTube URL → click Create → expect redirect to `/room/XXX-XXX` (404 for now, that's fine).

- [ ] **Step 5: Commit and push**

```bash
git checkout -b feat/home-page
git add -A
git commit -m "feat: add home page with hero create-room flow"
git push -u origin feat/home-page
git checkout main && git merge feat/home-page --ff-only && git push
git branch -d feat/home-page && git push origin --delete feat/home-page
```

---

## Task 3.5: Room page scaffolding + YouTube player

**Branch:** `feat/room-page`

**Files:**
- Create: `src/app/room/[code]/page.tsx`, `src/app/room/[code]/guest-prompt.tsx`, `src/app/room/[code]/actions.ts`, `src/components/room/youtube-player.tsx`, `src/components/room/room-shell.tsx`

- [ ] **Step 1: Server action to claim guest name**

`src/app/room/[code]/actions.ts`:
```typescript
"use server";

import { randomUUID } from "node:crypto";
import { setGuestCookie } from "@/lib/auth-guest";
import { redirect } from "next/navigation";

export async function claimGuestName(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim().slice(0, 24);
  const code = String(formData.get("code") ?? "");
  if (!name || !code) return;
  await setGuestCookie({ guestId: randomUUID(), guestName: name });
  redirect(`/room/${code}`);
}
```

- [ ] **Step 2: Guest-name prompt**

`src/app/room/[code]/guest-prompt.tsx`:
```typescript
import { DuoButton } from "@/components/theme/duo-button";
import { claimGuestName } from "./actions";

export function GuestPrompt({ code }: { code: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#fffaf0] p-6">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full border-b-[4px] border-[#e5e5e5]">
        <h1 className="text-xl font-bold text-[#3c3c3c] mb-2">Join the party</h1>
        <p className="text-sm text-[#777] mb-5">Pick a name to show in chat.</p>
        <form action={claimGuestName} className="space-y-3">
          <input type="hidden" name="code" value={code} />
          <input
            name="name"
            required
            minLength={1}
            maxLength={24}
            placeholder="Your name"
            className="w-full rounded-xl px-4 py-3 bg-[#f7f7f7] focus:outline-none focus:bg-white border-2 border-transparent focus:border-[#58cc02]"
          />
          <DuoButton type="submit" variant="primary" className="w-full">Join room</DuoButton>
        </form>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: YouTube player wrapper**

`src/components/room/youtube-player.tsx`:
```typescript
"use client";

import { useEffect, useRef } from "react";

type YTPlayer = {
  destroy: () => void;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (s: number, allowSeekAhead: boolean) => void;
  loadVideoById: (id: string) => void;
  getCurrentTime: () => number;
  getPlayerState: () => number;
};

declare global {
  interface Window {
    YT?: {
      Player: new (el: HTMLElement, opts: object) => YTPlayer;
      PlayerState: { ENDED: 0; PLAYING: 1; PAUSED: 2; BUFFERING: 3; CUED: 5 };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

type Props = {
  videoId: string | null;
  onReady?: (p: YTPlayer) => void;
  onStateChange?: (state: number, currentTime: number) => void;
};

export function YouTubePlayer({ videoId, onReady, onStateChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);

  useEffect(() => {
    function build() {
      if (!ref.current || !window.YT) return;
      playerRef.current = new window.YT.Player(ref.current, {
        videoId: videoId ?? undefined,
        playerVars: { autoplay: 0, controls: 1, modestbranding: 1, rel: 0 },
        events: {
          onReady: () => playerRef.current && onReady?.(playerRef.current),
          onStateChange: (e: { data: number }) =>
            playerRef.current && onStateChange?.(e.data, playerRef.current.getCurrentTime()),
        },
      });
    }

    if (window.YT?.Player) {
      build();
    } else {
      window.onYouTubeIframeAPIReady = build;
      if (!document.getElementById("yt-iframe-api")) {
        const s = document.createElement("script");
        s.id = "yt-iframe-api";
        s.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(s);
      }
    }

    return () => playerRef.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (videoId && playerRef.current) playerRef.current.loadVideoById(videoId);
  }, [videoId]);

  return <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black"><div ref={ref} className="w-full h-full" /></div>;
}
```

- [ ] **Step 4: Room shell (no sync wired yet)**

`src/components/room/room-shell.tsx`:
```typescript
"use client";

import { YouTubePlayer } from "./youtube-player";

export function RoomShell({ roomCode, initialVideoId }: { roomCode: string; initialVideoId: string | null }) {
  return (
    <div className="min-h-screen bg-[#fffaf0] p-4">
      <div className="max-w-7xl mx-auto">
        <header className="flex justify-between items-center mb-4 bg-white rounded-xl px-5 py-3 border-b-[3px] border-[#e5e5e5]">
          <div className="text-xl font-bold text-[#58cc02]">▶ partyroom</div>
          <div className="text-sm font-bold text-[#777]">Room <span className="text-[#3c3c3c]">{roomCode}</span></div>
        </header>

        <div className="grid lg:grid-cols-[1fr_320px] gap-4">
          <div className="space-y-3">
            <YouTubePlayer videoId={initialVideoId} />
            <div className="bg-white rounded-xl p-3 border-b-[3px] border-[#e5e5e5] text-sm text-[#777]">
              Sync controls go here in Phase 4.
            </div>
          </div>
          <aside className="bg-white rounded-2xl p-4 border-b-[3px] border-[#e5e5e5] min-h-[200px]">
            <div className="text-xs font-bold uppercase text-[#999] mb-2">Chat</div>
            <p className="text-sm text-[#777]">Wires up in Phase 5.</p>
          </aside>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Room page (gate on auth or guest)**

`src/app/room/[code]/page.tsx`:
```typescript
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getGuestFromCookies } from "@/lib/auth-guest";
import { GuestPrompt } from "./guest-prompt";
import { RoomShell } from "@/components/room/room-shell";

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const room = await db.room.findUnique({ where: { code } });
  if (!room || room.closedAt) notFound();

  const session = await auth();
  const guest = await getGuestFromCookies();

  if (!session?.user && !guest) {
    return <GuestPrompt code={code} />;
  }

  return <RoomShell roomCode={code} initialVideoId={room.videoId} />;
}
```

- [ ] **Step 6: Verify**

Create a room from the home page (Task 3.4). On redirect, expect the room shell with the YouTube player loaded and playable.

In a private/incognito window, open the same `/room/XXX-XXX` URL — expect the guest name prompt. Submit a name. Expect the room shell.

- [ ] **Step 7: Commit and push**

```bash
git checkout -b feat/room-page
git add -A
git commit -m "feat: scaffold room page with YouTube player and guest gate"
git push -u origin feat/room-page
git checkout main && git merge feat/room-page --ff-only && git push
git branch -d feat/room-page && git push origin --delete feat/room-page
```

---

# Phase 4 — Sync

## Task 4.1: Pure room-state reducers (TDD)

**Branch:** `feat/room-reducers`

**Files:**
- Create: `src/lib/room/state.ts`, `src/lib/room/state.test.ts`

- [ ] **Step 1: Write failing tests**

`src/lib/room/state.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { applyPlay, applyPause, applySeek, applyLoadVideo, applyQueueAdd, applyQueueRemove, applyQueueAdvance, expectedPosition, type RoomState } from "./state";

function base(overrides: Partial<RoomState> = {}): RoomState {
  return {
    roomId: "r1",
    videoId: "v1",
    playing: false,
    positionSec: 0,
    updatedAt: 1_000_000,
    queue: [],
    ...overrides,
  };
}

describe("playback reducers", () => {
  it("play sets playing=true and records position+timestamp", () => {
    const r = applyPlay(base(), { positionSec: 12.4 }, 1_000_500);
    expect(r.playing).toBe(true);
    expect(r.positionSec).toBe(12.4);
    expect(r.updatedAt).toBe(1_000_500);
  });

  it("pause sets playing=false", () => {
    const r = applyPause(base({ playing: true }), { positionSec: 30 }, 1_001_000);
    expect(r.playing).toBe(false);
    expect(r.positionSec).toBe(30);
  });

  it("seek keeps playing state but jumps position", () => {
    const r = applySeek(base({ playing: true, positionSec: 10 }), { positionSec: 99 }, 1_002_000);
    expect(r.playing).toBe(true);
    expect(r.positionSec).toBe(99);
  });

  it("loadVideo resets to 0, paused", () => {
    const r = applyLoadVideo(base({ playing: true, positionSec: 90 }), { videoId: "v2" }, 1_003_000);
    expect(r.videoId).toBe("v2");
    expect(r.playing).toBe(false);
    expect(r.positionSec).toBe(0);
  });
});

describe("queue reducers", () => {
  it("add appends to end", () => {
    const r = applyQueueAdd(base(), { id: "q1", videoId: "v2", position: 0 });
    expect(r.queue.map((q) => q.videoId)).toEqual(["v2"]);
  });

  it("remove by id", () => {
    const r = applyQueueRemove(base({ queue: [{ id: "q1", videoId: "v2", position: 0 }] }), { queueItemId: "q1" });
    expect(r.queue).toHaveLength(0);
  });

  it("advance is idempotent: ignores if fromVideoId doesn't match", () => {
    const s = base({ videoId: "v1", queue: [{ id: "q1", videoId: "v2", position: 0 }] });
    const r1 = applyQueueAdvance(s, { fromVideoId: "v1" }, 1_010_000);
    expect(r1.videoId).toBe("v2");
    expect(r1.queue).toHaveLength(0);
    expect(r1.playing).toBe(true);

    const r2 = applyQueueAdvance(r1, { fromVideoId: "v1" }, 1_011_000);
    expect(r2).toBe(r1); // unchanged
  });
});

describe("expectedPosition", () => {
  it("returns stored position when paused", () => {
    expect(expectedPosition(base({ playing: false, positionSec: 42, updatedAt: 1000 }), 5000)).toBe(42);
  });
  it("extrapolates by elapsed seconds when playing", () => {
    expect(expectedPosition(base({ playing: true, positionSec: 10, updatedAt: 1000 }), 4000)).toBeCloseTo(13);
  });
});
```

- [ ] **Step 2: Run tests, expect fail**

```bash
npm test state
```

- [ ] **Step 3: Implement reducers**

`src/lib/room/state.ts`:
```typescript
import type { QueueItem } from "../socket/types";

export type RoomState = {
  roomId: string;
  videoId: string | null;
  playing: boolean;
  positionSec: number;
  updatedAt: number;
  queue: QueueItem[];
};

export function applyPlay(s: RoomState, p: { positionSec: number }, now: number): RoomState {
  return { ...s, playing: true, positionSec: p.positionSec, updatedAt: now };
}

export function applyPause(s: RoomState, p: { positionSec: number }, now: number): RoomState {
  return { ...s, playing: false, positionSec: p.positionSec, updatedAt: now };
}

export function applySeek(s: RoomState, p: { positionSec: number }, now: number): RoomState {
  return { ...s, positionSec: p.positionSec, updatedAt: now };
}

export function applyLoadVideo(s: RoomState, p: { videoId: string }, now: number): RoomState {
  return { ...s, videoId: p.videoId, playing: false, positionSec: 0, updatedAt: now };
}

export function applyQueueAdd(s: RoomState, item: QueueItem): RoomState {
  return { ...s, queue: [...s.queue, item] };
}

export function applyQueueRemove(s: RoomState, p: { queueItemId: string }): RoomState {
  return { ...s, queue: s.queue.filter((q) => q.id !== p.queueItemId) };
}

export function applyQueueAdvance(s: RoomState, p: { fromVideoId: string }, now: number): RoomState {
  if (s.videoId !== p.fromVideoId) return s; // already advanced
  const [next, ...rest] = s.queue;
  if (!next) return { ...s, playing: false, positionSec: 0, updatedAt: now };
  return { ...s, videoId: next.videoId, playing: true, positionSec: 0, queue: rest, updatedAt: now };
}

export function expectedPosition(s: RoomState, nowMs: number): number {
  if (!s.playing) return s.positionSec;
  return s.positionSec + (nowMs - s.updatedAt) / 1000;
}
```

- [ ] **Step 4: Run tests, expect pass**

```bash
npm test state
```

- [ ] **Step 5: Commit and push**

```bash
git checkout -b feat/room-reducers
git add -A
git commit -m "feat: add pure room-state reducers with tests"
git push -u origin feat/room-reducers
git checkout main && git merge feat/room-reducers --ff-only && git push
git branch -d feat/room-reducers && git push origin --delete feat/room-reducers
```

---

## Task 4.2: In-memory room store + DB rehydrate

**Branch:** `feat/room-store`

**Files:**
- Create: `src/lib/room/store.ts`, `src/lib/room/rehydrate.ts`

- [ ] **Step 1: Implement in-memory store**

`src/lib/room/store.ts`:
```typescript
import type { RoomState } from "./state";
import type { Participant } from "../socket/types";

const rooms = new Map<string, RoomState>();
const participants = new Map<string, Map<string, Participant>>(); // roomId → socketId → participant

export function getRoom(roomId: string): RoomState | undefined {
  return rooms.get(roomId);
}

export function setRoom(state: RoomState): void {
  rooms.set(state.roomId, state);
}

export function deleteRoom(roomId: string): void {
  rooms.delete(roomId);
  participants.delete(roomId);
}

export function listParticipants(roomId: string): Participant[] {
  const m = participants.get(roomId);
  return m ? Array.from(m.values()) : [];
}

export function addParticipant(roomId: string, p: Participant): void {
  if (!participants.has(roomId)) participants.set(roomId, new Map());
  participants.get(roomId)!.set(p.socketId, p);
}

export function removeParticipant(roomId: string, socketId: string): Participant | undefined {
  const m = participants.get(roomId);
  if (!m) return undefined;
  const p = m.get(socketId);
  m.delete(socketId);
  return p;
}
```

- [ ] **Step 2: Implement rehydrate**

`src/lib/room/rehydrate.ts`:
```typescript
import { db } from "../db";
import { setRoom, getRoom } from "./store";
import type { RoomState } from "./state";

export async function loadRoomIntoMemory(code: string): Promise<RoomState | null> {
  const existing = getExistingByCode(code);
  if (existing) return existing;

  const room = await db.room.findUnique({
    where: { code },
    include: { queue: { orderBy: { position: "asc" } } },
  });
  if (!room || room.closedAt) return null;

  const state: RoomState = {
    roomId: room.id,
    videoId: room.videoId,
    playing: room.playing,
    positionSec: room.positionSec,
    updatedAt: room.stateUpdated.getTime(),
    queue: room.queue.map((q) => ({
      id: q.id,
      videoId: q.videoId,
      title: q.title ?? undefined,
      thumbnail: q.thumbnail ?? undefined,
      addedById: q.addedById ?? undefined,
    })),
  };
  setRoom(state);
  return state;
}

// Convenience for callers that have roomId
function getExistingByCode(_code: string): RoomState | null {
  return null;
}

export async function persistRoomState(state: RoomState): Promise<void> {
  await db.room.update({
    where: { id: state.roomId },
    data: {
      videoId: state.videoId,
      playing: state.playing,
      positionSec: state.positionSec,
      stateUpdated: new Date(state.updatedAt),
    },
  }).catch((e) => console.error("persistRoomState failed", e));
}
```

- [ ] **Step 3: Commit and push**

```bash
git checkout -b feat/room-store
git add -A
git commit -m "feat: add in-memory room store and DB rehydration"
git push -u origin feat/room-store
git checkout main && git merge feat/room-store --ff-only && git push
git branch -d feat/room-store && git push origin --delete feat/room-store
```

---

## Task 4.3: Socket auth + room:join handler

**Branch:** `feat/socket-join`

**Files:**
- Create: `src/lib/socket/server.ts`, `src/lib/socket/presence.ts`, `src/lib/socket/auth.ts`
- Modify: `server.ts`

- [ ] **Step 1: Implement socket-level auth**

`src/lib/socket/auth.ts`:
```typescript
import type { Socket } from "socket.io";
import { parse as parseCookie } from "cookie";
import { decode } from "next-auth/jwt";
import { readGuest } from "../auth-guest";
import { env } from "@/env";

export type SocketUser = { userId?: string; guestName?: string; displayName: string };

export async function identifySocket(socket: Socket): Promise<SocketUser | null> {
  const raw = socket.handshake.headers.cookie;
  if (!raw) return null;
  const cookies = parseCookie(raw);

  // Try Auth.js session
  const authToken = cookies["authjs.session-token"] ?? cookies["__Secure-authjs.session-token"];
  if (authToken) {
    try {
      const payload = await decode({ token: authToken, secret: env.NEXTAUTH_SECRET, salt: "authjs.session-token" });
      if (payload?.sub) {
        return { userId: payload.sub, displayName: (payload.name as string) ?? "Player" };
      }
    } catch {}
  }

  // Try guest cookie
  const guestToken = cookies["partyroom_guest"];
  if (guestToken) {
    const guest = await readGuest(guestToken);
    if (guest) return { guestName: guest.guestName, displayName: guest.guestName };
  }

  return null;
}
```

Note: Auth.js v5 with database sessions still uses a JWT-shaped session cookie in some configs. If `decode` returns null, the easier path is to look up the session in the DB by `sessionToken`. Implement that fallback:

```typescript
// in identifySocket, after the JWT attempt fails:
if (authToken) {
  const { db } = await import("../db");
  const session = await db.session.findUnique({
    where: { sessionToken: authToken },
    include: { user: true },
  });
  if (session && session.expires > new Date()) {
    return { userId: session.userId, displayName: session.user.name ?? "Player" };
  }
}
```

- [ ] **Step 2: Implement presence helpers**

`src/lib/socket/presence.ts`:
```typescript
import type { Server, Socket } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents, Participant } from "./types";
import { addParticipant, removeParticipant } from "../room/store";

export function trackPresence(io: Server<ClientToServerEvents, ServerToClientEvents>, socket: Socket, roomId: string, p: Participant) {
  addParticipant(roomId, p);
  socket.data.roomId = roomId;
  socket.data.participant = p;
  socket.join(roomId);
  io.to(roomId).emit("participant:join", p);
}

export function untrackPresence(io: Server<ClientToServerEvents, ServerToClientEvents>, socket: Socket) {
  const roomId = socket.data.roomId as string | undefined;
  if (!roomId) return;
  const p = removeParticipant(roomId, socket.id);
  if (p) io.to(roomId).emit("participant:leave", { socketId: socket.id });
  socket.leave(roomId);
}
```

- [ ] **Step 3: Implement the connection router**

`src/lib/socket/server.ts`:
```typescript
import type { Server } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents, RoomStateSnapshot } from "./types";
import { identifySocket } from "./auth";
import { loadRoomIntoMemory } from "../room/rehydrate";
import { getRoom } from "../room/store";
import { listParticipants } from "../room/store";
import { trackPresence, untrackPresence } from "./presence";

function toSnapshot(roomId: string): RoomStateSnapshot | null {
  const s = getRoom(roomId);
  if (!s) return null;
  return {
    roomId: s.roomId,
    videoId: s.videoId,
    playing: s.playing,
    positionSec: s.positionSec,
    updatedAt: s.updatedAt,
    queue: s.queue,
    participants: listParticipants(roomId),
  };
}

export function installSocketServer(io: Server<ClientToServerEvents, ServerToClientEvents>) {
  io.on("connection", async (socket) => {
    const user = await identifySocket(socket);
    if (!user) {
      socket.emit("error", { code: "AUTH_REQUIRED", message: "Sign in or claim a guest name first." });
      socket.disconnect(true);
      return;
    }

    socket.on("room:join", async ({ roomCode }, ack) => {
      const state = await loadRoomIntoMemory(roomCode);
      if (!state) return ack({ error: "Room not found" });
      trackPresence(io, socket, state.roomId, {
        socketId: socket.id,
        userId: user.userId,
        guestName: user.guestName,
        displayName: user.displayName,
      });
      const snap = toSnapshot(state.roomId);
      if (snap) ack(snap);
    });

    socket.on("disconnect", () => untrackPresence(io, socket));
  });
}
```

- [ ] **Step 4: Wire it into server.ts**

Modify `server.ts`:
```typescript
import { installSocketServer } from "./src/lib/socket/server";
// ... existing code ...
const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: dev ? "*" : false },
  transports: ["websocket", "polling"],
});
installSocketServer(io);
// remove the inline io.on('connection', ...) demo
```

Install `cookie`:
```bash
npm install cookie
npm install -D @types/cookie
```

- [ ] **Step 5: Manual smoke test**

```bash
npm run dev
```

In the browser console on the home page (signed-in):
```javascript
const io = await import("socket.io-client").then(m => m.default);
const s = io();
s.on("connect", () => console.log("connected"));
s.on("error", console.log);
s.emit("room:join", { roomCode: "<your room code>" }, (resp) => console.log("state:", resp));
```

Expected: `connected`, then a state object printed. Open in two tabs → both should appear in each other's participants.

- [ ] **Step 6: Commit and push**

```bash
git checkout -b feat/socket-join
git add -A
git commit -m "feat: add socket auth and room:join with presence tracking"
git push -u origin feat/socket-join
git checkout main && git merge feat/socket-join --ff-only && git push
git branch -d feat/socket-join && git push origin --delete feat/socket-join
```

---

## Task 4.4: Playback event handlers

**Branch:** `feat/socket-playback`

**Files:**
- Create: `src/lib/socket/broadcast.ts`, `src/lib/socket/playback.ts`
- Modify: `src/lib/socket/server.ts`

- [ ] **Step 1: Extract a shared broadcast helper**

`src/lib/socket/broadcast.ts`:
```typescript
import type { Server } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents, RoomStateSnapshot } from "./types";
import { getRoom, listParticipants } from "../room/store";

export function broadcastRoomState(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  roomId: string,
): void {
  const s = getRoom(roomId);
  if (!s) return;
  const snap: RoomStateSnapshot = {
    roomId,
    videoId: s.videoId,
    playing: s.playing,
    positionSec: s.positionSec,
    updatedAt: s.updatedAt,
    queue: s.queue,
    participants: listParticipants(roomId),
  };
  io.to(roomId).emit("room:state", snap);
}
```

- [ ] **Step 2: Implement playback handlers using the shared helper**

`src/lib/socket/playback.ts`:
```typescript
import type { Server, Socket } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "./types";
import { getRoom, setRoom } from "../room/store";
import { applyPlay, applyPause, applySeek, applyLoadVideo } from "../room/state";
import { persistRoomState } from "../room/rehydrate";
import { broadcastRoomState } from "./broadcast";

export function installPlaybackHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket,
) {
  socket.on("playback:play", ({ positionSec }) => {
    const roomId = socket.data.roomId as string | undefined;
    if (!roomId) return;
    const s = getRoom(roomId);
    if (!s) return;
    const next = applyPlay(s, { positionSec }, Date.now());
    setRoom(next);
    broadcastRoomState(io, roomId);
    void persistRoomState(next);
  });

  socket.on("playback:pause", ({ positionSec }) => {
    const roomId = socket.data.roomId as string | undefined;
    if (!roomId) return;
    const s = getRoom(roomId);
    if (!s) return;
    const next = applyPause(s, { positionSec }, Date.now());
    setRoom(next);
    broadcastRoomState(io, roomId);
    void persistRoomState(next);
  });

  socket.on("playback:seek", ({ positionSec }) => {
    const roomId = socket.data.roomId as string | undefined;
    if (!roomId) return;
    const s = getRoom(roomId);
    if (!s) return;
    const next = applySeek(s, { positionSec }, Date.now());
    setRoom(next);
    broadcastRoomState(io, roomId);
    void persistRoomState(next);
  });

  socket.on("playback:loadVideo", ({ videoId }) => {
    const roomId = socket.data.roomId as string | undefined;
    if (!roomId) return;
    const s = getRoom(roomId);
    if (!s) return;
    const next = applyLoadVideo(s, { videoId }, Date.now());
    setRoom(next);
    broadcastRoomState(io, roomId);
    void persistRoomState(next);
  });
}
```

- [ ] **Step 3: Wire into the connection router and add 30s heartbeat**

In `src/lib/socket/server.ts`:

```typescript
import { installPlaybackHandlers } from "./playback";
import { broadcastRoomState } from "./broadcast";
import { getRoom } from "../room/store";

// inside io.on("connection", async (socket) => { ... }) — after room:join:
installPlaybackHandlers(io, socket);

// At the bottom of installSocketServer (after io.on):
setInterval(() => {
  // io.sockets.adapter.rooms includes both per-socket rooms (id === socket.id)
  // and our app-level rooms (we join with roomId). Filter to ones we know.
  for (const roomId of io.sockets.adapter.rooms.keys()) {
    if (getRoom(roomId)) broadcastRoomState(io, roomId);
  }
}, 30_000);
```

- [ ] **Step 4: Commit and push**

```bash
git checkout -b feat/socket-playback
git add -A
git commit -m "feat: add playback event handlers with server-broadcast"
git push -u origin feat/socket-playback
git checkout main && git merge feat/socket-playback --ff-only && git push
git branch -d feat/socket-playback && git push origin --delete feat/socket-playback
```

---

## Task 4.5: Client-side socket hook + apply-state effect

**Branch:** `feat/use-room-state`

**Files:**
- Create: `src/hooks/use-socket.ts`, `src/hooks/use-room-state.ts`, `src/lib/socket/client.ts`

- [ ] **Step 1: Client socket singleton**

`src/lib/socket/client.ts`:
```typescript
"use client";

import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "./types";

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export function getSocket() {
  if (!socket) {
    socket = io({ path: "/socket.io", transports: ["websocket", "polling"] });
  }
  return socket;
}
```

- [ ] **Step 2: useRoomState hook**

`src/hooks/use-room-state.ts`:
```typescript
"use client";

import { useEffect, useState } from "react";
import { getSocket } from "@/lib/socket/client";
import type { RoomStateSnapshot } from "@/lib/socket/types";

export function useRoomState(roomCode: string) {
  const [state, setState] = useState<RoomStateSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const s = getSocket();
    s.emit("room:join", { roomCode }, (resp) => {
      if ("error" in resp) setError(resp.error);
      else setState(resp);
    });
    const onState = (snap: RoomStateSnapshot) => setState(snap);
    s.on("room:state", onState);
    return () => {
      s.off("room:state", onState);
    };
  }, [roomCode]);

  return { state, error };
}
```

- [ ] **Step 3: Drift correction hook**

`src/hooks/use-drift-correction.ts`:
```typescript
"use client";

import { useEffect } from "react";
import type { RoomStateSnapshot } from "@/lib/socket/types";

type YTPlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (s: number, allow: boolean) => void;
  getCurrentTime: () => number;
  getPlayerState: () => number;
};

const DRIFT_THRESHOLD_SEC = 2;

export function useDriftCorrection(player: YTPlayer | null, state: RoomStateSnapshot | null) {
  useEffect(() => {
    if (!player || !state) return;
    // Apply immediate state change
    const expected = state.playing
      ? state.positionSec + (Date.now() - state.updatedAt) / 1000
      : state.positionSec;
    const actual = player.getCurrentTime();
    if (Math.abs(actual - expected) > DRIFT_THRESHOLD_SEC) {
      player.seekTo(expected, true);
    }
    if (state.playing) player.playVideo();
    else player.pauseVideo();
  }, [player, state?.videoId, state?.playing, state?.updatedAt, state?.positionSec]);

  // Periodic drift check every 5s
  useEffect(() => {
    if (!player || !state) return;
    const t = setInterval(() => {
      if (!state.playing) return;
      const expected = state.positionSec + (Date.now() - state.updatedAt) / 1000;
      const actual = player.getCurrentTime();
      if (Math.abs(actual - expected) > DRIFT_THRESHOLD_SEC) {
        player.seekTo(expected, true);
      }
    }, 5000);
    return () => clearInterval(t);
  }, [player, state]);
}
```

- [ ] **Step 4: Wire into RoomShell**

Update `src/components/room/room-shell.tsx`:
```typescript
"use client";

import { useRef, useState } from "react";
import { YouTubePlayer } from "./youtube-player";
import { useRoomState } from "@/hooks/use-room-state";
import { useDriftCorrection } from "@/hooks/use-drift-correction";
import { getSocket } from "@/lib/socket/client";

type YTPlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (s: number, allow: boolean) => void;
  getCurrentTime: () => number;
  getPlayerState: () => number;
};

export function RoomShell({ roomCode }: { roomCode: string }) {
  const { state, error } = useRoomState(roomCode);
  const [player, setPlayer] = useState<YTPlayer | null>(null);
  const suppressEmit = useRef(false);

  useDriftCorrection(player, state);

  function handleStateChange(ytState: number, currentTime: number) {
    if (suppressEmit.current) return;
    const s = getSocket();
    if (ytState === 1) s.emit("playback:play", { positionSec: currentTime });
    if (ytState === 2) s.emit("playback:pause", { positionSec: currentTime });
  }

  if (error) {
    return <main className="min-h-screen flex items-center justify-center bg-[#fffaf0]"><p>{error}</p></main>;
  }

  return (
    <div className="min-h-screen bg-[#fffaf0] p-4">
      <div className="max-w-7xl mx-auto">
        <header className="flex justify-between items-center mb-4 bg-white rounded-xl px-5 py-3 border-b-[3px] border-[#e5e5e5]">
          <div className="text-xl font-bold text-[#58cc02]">▶ partyroom</div>
          <div className="text-sm font-bold text-[#777]">Room <span className="text-[#3c3c3c]">{roomCode}</span></div>
        </header>

        <div className="grid lg:grid-cols-[1fr_320px] gap-4">
          <div className="space-y-3">
            <YouTubePlayer
              videoId={state?.videoId ?? null}
              onReady={setPlayer}
              onStateChange={handleStateChange}
            />
          </div>
          <aside className="bg-white rounded-2xl p-4 border-b-[3px] border-[#e5e5e5] min-h-[200px]">
            <div className="text-xs font-bold uppercase text-[#999] mb-2">Participants ({state?.participants.length ?? 0})</div>
            <ul className="space-y-1 text-sm">
              {state?.participants.map((p) => <li key={p.socketId} className="text-[#3c3c3c]">{p.displayName}</li>)}
            </ul>
          </aside>
        </div>
      </div>
    </div>
  );
}
```

Update `src/app/room/[code]/page.tsx` to not pass `initialVideoId` (the socket layer provides it):

```typescript
return <RoomShell roomCode={code} />;
```

- [ ] **Step 5: Manual sync verification**

```bash
npm run dev
```

1. Create a room from one browser (signed-in).
2. Copy the room URL.
3. Open it in a second browser (incognito), enter a guest name.
4. Hit play in browser 1 → expect browser 2 to start playing within ~1 second.
5. Pause in browser 2 → expect browser 1 to pause.
6. Scrub to a new position in browser 1 → expect browser 2 to seek to match.

If sync feels janky: check the browser console for `room:state` events on both sides.

- [ ] **Step 6: Commit and push**

```bash
git checkout -b feat/use-room-state
git add -A
git commit -m "feat: wire client to socket state with drift correction"
git push -u origin feat/use-room-state
git checkout main && git merge feat/use-room-state --ff-only && git push
git branch -d feat/use-room-state && git push origin --delete feat/use-room-state
```

---

# Phase 5 — Chat

## Task 5.1: Chat send + persistence + rate limit

**Branch:** `feat/chat-protocol`

**Files:**
- Create: `src/lib/socket/chat.ts`, `src/lib/rate-limit.ts`, `src/lib/rate-limit.test.ts`
- Modify: `src/lib/socket/server.ts`

- [ ] **Step 1: Write rate-limit tests**

`src/lib/rate-limit.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { SlidingWindow } from "./rate-limit";

describe("SlidingWindow", () => {
  it("allows under the limit", () => {
    const rl = new SlidingWindow({ windowMs: 1000, max: 3 });
    expect(rl.allow("k", 0)).toBe(true);
    expect(rl.allow("k", 100)).toBe(true);
    expect(rl.allow("k", 200)).toBe(true);
  });
  it("blocks over the limit", () => {
    const rl = new SlidingWindow({ windowMs: 1000, max: 3 });
    rl.allow("k", 0); rl.allow("k", 0); rl.allow("k", 0);
    expect(rl.allow("k", 100)).toBe(false);
  });
  it("forgives after window passes", () => {
    const rl = new SlidingWindow({ windowMs: 1000, max: 2 });
    rl.allow("k", 0); rl.allow("k", 500);
    expect(rl.allow("k", 600)).toBe(false);
    expect(rl.allow("k", 1100)).toBe(true);
  });
});
```

- [ ] **Step 2: Implement rate-limit**

`src/lib/rate-limit.ts`:
```typescript
export class SlidingWindow {
  private hits = new Map<string, number[]>();
  constructor(private opts: { windowMs: number; max: number }) {}

  allow(key: string, nowMs: number = Date.now()): boolean {
    const arr = this.hits.get(key) ?? [];
    const cutoff = nowMs - this.opts.windowMs;
    const recent = arr.filter((t) => t > cutoff);
    if (recent.length >= this.opts.max) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(nowMs);
    this.hits.set(key, recent);
    return true;
  }
}
```

Run tests: `npm test rate-limit`. Expect pass.

- [ ] **Step 3: Implement chat handler**

`src/lib/socket/chat.ts`:
```typescript
import type { Server, Socket } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents, ChatMessage } from "./types";
import { db } from "../db";
import { SlidingWindow } from "../rate-limit";

const limiter = new SlidingWindow({ windowMs: 5000, max: 5 });

export function installChatHandlers(io: Server<ClientToServerEvents, ServerToClientEvents>, socket: Socket) {
  socket.on("chat:send", async ({ body }) => {
    const roomId = socket.data.roomId as string | undefined;
    if (!roomId) return;
    const trimmed = body.trim().slice(0, 500);
    if (!trimmed) return;

    const user = socket.data.participant as { userId?: string; displayName: string; guestName?: string };
    const key = user.userId ?? `g:${socket.id}`;
    if (!limiter.allow(key)) {
      socket.emit("error", { code: "RATE_LIMIT", message: "Slow down a bit." });
      return;
    }

    const row = await db.message.create({
      data: {
        roomId,
        userId: user.userId ?? null,
        guestName: user.userId ? null : user.guestName ?? user.displayName,
        body: trimmed,
      },
    });

    const msg: ChatMessage = {
      id: row.id,
      body: trimmed,
      authorName: user.displayName,
      authorUserId: user.userId,
      createdAt: row.createdAt.getTime(),
    };
    io.to(roomId).emit("chat:message", msg);
  });
}

export async function loadChatHistory(roomId: string, limit = 100): Promise<ChatMessage[]> {
  const rows = await db.message.findMany({
    where: { roomId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { name: true } } },
  });
  return rows.reverse().map((m) => ({
    id: m.id,
    body: m.body,
    authorName: m.user?.name ?? m.guestName ?? "Guest",
    authorUserId: m.userId ?? undefined,
    createdAt: m.createdAt.getTime(),
  }));
}
```

- [ ] **Step 4: Wire chat handlers + send history on join**

In `src/lib/socket/server.ts`:
```typescript
import { installChatHandlers, loadChatHistory } from "./chat";

// In the connection handler, after installPlaybackHandlers:
installChatHandlers(io, socket);

// In room:join, after ack(snap):
const history = await loadChatHistory(state.roomId);
socket.emit("chat:history", history);
```

- [ ] **Step 5: Commit and push**

```bash
git checkout -b feat/chat-protocol
git add -A
git commit -m "feat: add chat send + persistence + sliding-window rate limit"
git push -u origin feat/chat-protocol
git checkout main && git merge feat/chat-protocol --ff-only && git push
git branch -d feat/chat-protocol && git push origin --delete feat/chat-protocol
```

---

## Task 5.2: Chat UI

**Branch:** `feat/chat-ui`

**Files:**
- Create: `src/components/room/chat-panel.tsx`
- Modify: `src/components/room/room-shell.tsx`

- [ ] **Step 1: Build the chat panel**

`src/components/room/chat-panel.tsx`:
```typescript
"use client";

import { useEffect, useRef, useState } from "react";
import { getSocket } from "@/lib/socket/client";
import type { ChatMessage } from "@/lib/socket/types";

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const s = getSocket();
    const onMsg = (m: ChatMessage) => setMessages((prev) => [...prev, m]);
    const onHistory = (h: ChatMessage[]) => setMessages(h);
    s.on("chat:message", onMsg);
    s.on("chat:history", onHistory);
    return () => {
      s.off("chat:message", onMsg);
      s.off("chat:history", onHistory);
    };
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    getSocket().emit("chat:send", { body });
    setDraft("");
  }

  return (
    <div className="flex flex-col h-full">
      <div ref={listRef} className="flex-1 overflow-y-auto space-y-2 mb-3">
        {messages.map((m) => (
          <div key={m.id} className="text-sm">
            <span className="font-bold text-[#58cc02]">{m.authorName}</span>{" "}
            <span className="text-[#3c3c3c]">{m.body}</span>
          </div>
        ))}
      </div>
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={500}
          placeholder="Say something..."
          className="flex-1 rounded-xl px-3 py-2 bg-[#f7f7f7] focus:outline-none focus:bg-white border-2 border-transparent focus:border-[#58cc02] text-sm"
        />
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Mount it in RoomShell**

Replace the placeholder aside in `src/components/room/room-shell.tsx`:
```typescript
<aside className="bg-white rounded-2xl p-4 border-b-[3px] border-[#e5e5e5] h-[500px] flex flex-col">
  <div className="text-xs font-bold uppercase text-[#999] mb-3">Chat</div>
  <ChatPanel />
</aside>
```

Import: `import { ChatPanel } from "./chat-panel";`

- [ ] **Step 3: Manual verify with two browsers**

Open in 2 browsers, type messages, expect them to appear instantly in both. Refresh one — last 100 messages should reappear.

- [ ] **Step 4: Commit and push**

```bash
git checkout -b feat/chat-ui
git add -A
git commit -m "feat: add chat panel with history and live messages"
git push -u origin feat/chat-ui
git checkout main && git merge feat/chat-ui --ff-only && git push
git branch -d feat/chat-ui && git push origin --delete feat/chat-ui
```

---

# Phase 6 — Queue

## Task 6.1: Queue add / remove / advance handlers

**Branch:** `feat/queue-protocol`

**Files:**
- Create: `src/lib/socket/queue.ts`
- Modify: `src/lib/socket/server.ts`, `src/lib/room/state.ts` (already has reducers)

- [ ] **Step 1: Implement queue handlers**

`src/lib/socket/queue.ts`:
```typescript
import type { Server, Socket } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "./types";
import { getRoom, setRoom } from "../room/store";
import { applyQueueAdd, applyQueueAdvance, applyQueueRemove } from "../room/state";
import { persistRoomState } from "../room/rehydrate";
import { db } from "../db";
import { parseYouTubeId, fetchOEmbed } from "../youtube";
import { broadcastRoomState } from "./broadcast";

export function installQueueHandlers(io: Server<ClientToServerEvents, ServerToClientEvents>, socket: Socket) {
  socket.on("queue:add", async ({ videoId, title, thumbnail }) => {
    const roomId = socket.data.roomId as string | undefined;
    if (!roomId) return;
    if (!parseYouTubeId(videoId)) return;

    let resolvedTitle = title;
    let resolvedThumb = thumbnail;
    if (!resolvedTitle || !resolvedThumb) {
      const meta = await fetchOEmbed(videoId);
      resolvedTitle = resolvedTitle ?? meta.title;
      resolvedThumb = resolvedThumb ?? meta.thumbnail;
    }

    const s = getRoom(roomId);
    if (!s) return;
    const position = s.queue.length;
    const row = await db.queueItem.create({
      data: { roomId, videoId, title: resolvedTitle, thumbnail: resolvedThumb, position },
    });

    const next = applyQueueAdd(s, {
      id: row.id,
      videoId,
      title: resolvedTitle,
      thumbnail: resolvedThumb,
    });
    setRoom(next);
    broadcastRoomState(io, roomId);
  });

  socket.on("queue:remove", async ({ queueItemId }) => {
    const roomId = socket.data.roomId as string | undefined;
    if (!roomId) return;
    const s = getRoom(roomId);
    if (!s) return;
    const next = applyQueueRemove(s, { queueItemId });
    setRoom(next);
    await db.queueItem.delete({ where: { id: queueItemId } }).catch(() => {});
    broadcastRoomState(io, roomId);
  });

  socket.on("queue:advance", async ({ fromVideoId }) => {
    const roomId = socket.data.roomId as string | undefined;
    if (!roomId) return;
    const s = getRoom(roomId);
    if (!s) return;
    const next = applyQueueAdvance(s, { fromVideoId }, Date.now());
    if (next === s) return; // idempotent no-op
    setRoom(next);

    // Remove the played item from DB if it was the head
    const head = s.queue[0];
    if (head && next.videoId === head.videoId) {
      await db.queueItem.delete({ where: { id: head.id } }).catch(() => {});
    }
    await persistRoomState(next);
    broadcastRoomState(io, roomId);
  });
}
```

- [ ] **Step 2: Wire into server.ts connection**

```typescript
import { installQueueHandlers } from "./queue";
// inside connection:
installQueueHandlers(io, socket);
```

- [ ] **Step 3: Commit and push**

```bash
git checkout -b feat/queue-protocol
git add -A
git commit -m "feat: add queue add/remove/advance socket handlers"
git push -u origin feat/queue-protocol
git checkout main && git merge feat/queue-protocol --ff-only && git push
git branch -d feat/queue-protocol && git push origin --delete feat/queue-protocol
```

---

## Task 6.2: Queue drawer UI + auto-advance on video end

**Branch:** `feat/queue-ui`

**Files:**
- Create: `src/components/room/queue-drawer.tsx`
- Modify: `src/components/room/room-shell.tsx`, `src/components/room/youtube-player.tsx`

- [ ] **Step 1: Queue drawer**

`src/components/room/queue-drawer.tsx`:
```typescript
"use client";

import { useState } from "react";
import { getSocket } from "@/lib/socket/client";
import { parseYouTubeId } from "@/lib/youtube";
import { DuoButton } from "@/components/theme/duo-button";
import type { QueueItem } from "@/lib/socket/types";

export function QueueDrawer({ queue, open, onClose }: { queue: QueueItem[]; open: boolean; onClose: () => void }) {
  const [url, setUrl] = useState("");

  function add(e: React.FormEvent) {
    e.preventDefault();
    const videoId = parseYouTubeId(url);
    if (!videoId) return;
    getSocket().emit("queue:add", { videoId });
    setUrl("");
  }

  function remove(id: string) {
    getSocket().emit("queue:remove", { queueItemId: id });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div className="bg-white w-full max-w-md h-full p-5 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">🎵 Up next ({queue.length})</h2>
          <button onClick={onClose} className="text-2xl text-[#777]">×</button>
        </div>
        <form onSubmit={add} className="flex gap-2 mb-4">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="YouTube URL"
            className="flex-1 rounded-xl px-3 py-2 bg-[#f7f7f7] focus:outline-none border-2 border-transparent focus:border-[#58cc02] text-sm"
          />
          <DuoButton type="submit" variant="primary">Add</DuoButton>
        </form>
        <ul className="space-y-2">
          {queue.map((q) => (
            <li key={q.id} className="flex gap-3 items-center p-2 bg-[#f7f7f7] rounded-xl">
              {q.thumbnail && <img src={q.thumbnail} alt="" className="w-20 h-12 object-cover rounded" />}
              <div className="flex-1 text-sm truncate">{q.title ?? q.videoId}</div>
              <button onClick={() => remove(q.id)} className="text-[#777] text-sm hover:text-red-500">remove</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Emit queue:advance when video ends**

In `room-shell.tsx`, extend `handleStateChange`:
```typescript
function handleStateChange(ytState: number, currentTime: number) {
  if (suppressEmit.current) return;
  const s = getSocket();
  if (ytState === 1) s.emit("playback:play", { positionSec: currentTime });
  if (ytState === 2) s.emit("playback:pause", { positionSec: currentTime });
  if (ytState === 0 /* ENDED */ && state?.videoId) {
    s.emit("queue:advance", { fromVideoId: state.videoId });
  }
}
```

- [ ] **Step 3: Add a toggle button + render the drawer**

In `room-shell.tsx`:
```typescript
const [queueOpen, setQueueOpen] = useState(false);
// In the right side of the playback row:
<button onClick={() => setQueueOpen(true)} className="text-sm font-bold text-[#1cb0f6]">
  Queue ({state?.queue.length ?? 0})
</button>
// At the bottom:
<QueueDrawer queue={state?.queue ?? []} open={queueOpen} onClose={() => setQueueOpen(false)} />
```

- [ ] **Step 4: Manual test**

Add 2 videos to queue. Play through to end. Expect next video to load and play automatically. Remove a queued item. Refresh — queue persists.

- [ ] **Step 5: Commit and push**

```bash
git checkout -b feat/queue-ui
git add -A
git commit -m "feat: add queue drawer UI with auto-advance on video end"
git push -u origin feat/queue-ui
git checkout main && git merge feat/queue-ui --ff-only && git push
git branch -d feat/queue-ui && git push origin --delete feat/queue-ui
```

---

# Phase 7 — Reactions

## Task 7.1: Reaction broadcast + floating overlay

**Branch:** `feat/reactions`

**Files:**
- Create: `src/lib/socket/reactions.ts`, `src/components/room/reactions-overlay.tsx`
- Modify: `src/lib/socket/server.ts`, `src/components/room/room-shell.tsx`

- [ ] **Step 1: Server-side broadcast (ephemeral, no persistence)**

`src/lib/socket/reactions.ts`:
```typescript
import type { Server, Socket } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "./types";
import { SlidingWindow } from "../rate-limit";

const ALLOWED = new Set(["❤️", "😂", "🎉", "🔥", "👍", "👎", "😮", "😢"]);
const limiter = new SlidingWindow({ windowMs: 5000, max: 10 });

export function installReactionHandlers(io: Server<ClientToServerEvents, ServerToClientEvents>, socket: Socket) {
  socket.on("reaction:send", ({ emoji }) => {
    if (!ALLOWED.has(emoji)) return;
    const roomId = socket.data.roomId as string | undefined;
    if (!roomId) return;
    const p = socket.data.participant as { displayName: string };
    if (!limiter.allow(`${socket.id}`)) return;
    io.to(roomId).emit("reaction", { emoji, fromName: p?.displayName ?? "?" });
  });
}
```

Wire it in `src/lib/socket/server.ts`:
```typescript
import { installReactionHandlers } from "./reactions";
// inside connection:
installReactionHandlers(io, socket);
```

- [ ] **Step 2: Build the floating overlay**

`src/components/room/reactions-overlay.tsx`:
```typescript
"use client";

import { useEffect, useState } from "react";
import { getSocket } from "@/lib/socket/client";

type FloatingEmoji = { id: number; emoji: string; left: number };
let nextId = 1;

const EMOJIS = ["❤️", "😂", "🎉", "🔥", "👍", "👎", "😮", "😢"];

export function ReactionsOverlay() {
  const [floating, setFloating] = useState<FloatingEmoji[]>([]);

  useEffect(() => {
    const s = getSocket();
    const onR = ({ emoji }: { emoji: string }) => {
      const f = { id: nextId++, emoji, left: 20 + Math.random() * 60 };
      setFloating((prev) => [...prev, f]);
      setTimeout(() => setFloating((prev) => prev.filter((x) => x.id !== f.id)), 3000);
    };
    s.on("reaction", onR);
    return () => { s.off("reaction", onR); };
  }, []);

  return (
    <>
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {floating.map((f) => (
          <span
            key={f.id}
            className="absolute bottom-4 text-3xl animate-float"
            style={{ left: `${f.left}%` }}
          >
            {f.emoji}
          </span>
        ))}
      </div>
      <div className="absolute bottom-3 right-3 flex gap-1 bg-white/80 rounded-full px-2 py-1">
        {EMOJIS.map((e) => (
          <button
            key={e}
            onClick={() => getSocket().emit("reaction:send", { emoji: e })}
            className="text-lg hover:scale-125 transition-transform"
          >
            {e}
          </button>
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 3: Add the float animation to globals.css**

`src/app/globals.css` append:
```css
@keyframes float {
  0%   { transform: translateY(0)    scale(1);   opacity: 1; }
  100% { transform: translateY(-200px) scale(1.5); opacity: 0; }
}
.animate-float { animation: float 3s ease-out forwards; }
```

- [ ] **Step 4: Mount in RoomShell**

In `room-shell.tsx`, wrap the YouTubePlayer in a `relative` container:
```typescript
<div className="relative">
  <YouTubePlayer ... />
  <ReactionsOverlay />
</div>
```

Import: `import { ReactionsOverlay } from "./reactions-overlay";`

- [ ] **Step 5: Manual test**

Two browsers, click a reaction in one → both see the floating emoji.

- [ ] **Step 6: Commit and push**

```bash
git checkout -b feat/reactions
git add -A
git commit -m "feat: add floating emoji reactions"
git push -u origin feat/reactions
git checkout main && git merge feat/reactions --ff-only && git push
git branch -d feat/reactions && git push origin --delete feat/reactions
```

---

# Phase 8 — Friends + history

## Task 8.1: Friendship API

**Branch:** `feat/friends-api`

**Files:**
- Create: `src/app/api/friends/route.ts`, `src/app/api/friends/[id]/route.ts`, `src/app/api/users/search/route.ts`

- [ ] **Step 1: List + add friend**

`src/app/api/friends/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "auth" }, { status: 401 });

  const me = session.user.id;
  const rows = await db.friendship.findMany({
    where: { OR: [{ aId: me }, { bId: me }] },
    include: { a: true, b: true },
  });
  return NextResponse.json(rows.map((f) => ({
    id: f.id,
    status: f.status,
    other: f.aId === me ? { id: f.b.id, name: f.b.name, image: f.b.image } : { id: f.a.id, name: f.a.name, image: f.a.image },
    iSent: f.aId === me,
  })));
}

const AddBody = z.object({ otherUserId: z.string().min(1) });

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "auth" }, { status: 401 });
  const parsed = AddBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const me = session.user.id;
  if (parsed.data.otherUserId === me) return NextResponse.json({ error: "self" }, { status: 400 });

  const [a, b] = [me, parsed.data.otherUserId].sort();
  const f = await db.friendship.upsert({
    where: { aId_bId: { aId: a, bId: b } },
    create: { aId: a, bId: b, status: "PENDING" },
    update: {},
  });
  return NextResponse.json({ id: f.id, status: f.status });
}
```

- [ ] **Step 2: Accept / remove**

`src/app/api/friends/[id]/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "auth" }, { status: 401 });

  const f = await db.friendship.findUnique({ where: { id } });
  if (!f) return NextResponse.json({ error: "not found" }, { status: 404 });
  // Only the recipient can accept
  if (f.bId !== session.user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  await db.friendship.update({ where: { id }, data: { status: "ACCEPTED" } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "auth" }, { status: 401 });
  const f = await db.friendship.findUnique({ where: { id } });
  if (!f) return NextResponse.json({ ok: true });
  if (f.aId !== session.user.id && f.bId !== session.user.id)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  await db.friendship.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: User search (by email or name prefix)**

`src/app/api/users/search/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "auth" }, { status: 401 });
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json([]);
  const rows = await db.user.findMany({
    where: {
      AND: [
        { id: { not: session.user.id } },
        { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] },
      ],
    },
    take: 10,
    select: { id: true, name: true, email: true, image: true },
  });
  return NextResponse.json(rows);
}
```

- [ ] **Step 4: Commit and push**

```bash
git checkout -b feat/friends-api
git add -A
git commit -m "feat: add friends API (list, add, accept, remove, search)"
git push -u origin feat/friends-api
git checkout main && git merge feat/friends-api --ff-only && git push
git branch -d feat/friends-api && git push origin --delete feat/friends-api
```

---

## Task 8.2: Friends page + sidebar

**Branch:** `feat/friends-ui`

**Files:**
- Create: `src/app/(authed)/friends/page.tsx`, `src/components/home/friends-sidebar.tsx`

- [ ] **Step 1: Friends page**

`src/app/(authed)/friends/page.tsx`:
```typescript
"use client";

import { useEffect, useState } from "react";
import { DuoButton } from "@/components/theme/duo-button";

type Friend = { id: string; status: string; other: { id: string; name: string | null; image: string | null }; iSent: boolean };
type SearchHit = { id: string; name: string | null; email: string; image: string | null };

export default function FriendsPage() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);

  async function reload() {
    const r = await fetch("/api/friends").then((r) => r.json());
    setFriends(r);
  }
  useEffect(() => { void reload(); }, []);

  useEffect(() => {
    if (q.length < 2) { setHits([]); return; }
    const t = setTimeout(async () => {
      const r = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`).then((r) => r.json());
      setHits(r);
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  async function add(otherUserId: string) {
    await fetch("/api/friends", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ otherUserId }) });
    setQ("");
    setHits([]);
    void reload();
  }

  async function accept(id: string) {
    await fetch(`/api/friends/${id}`, { method: "PATCH" });
    void reload();
  }
  async function remove(id: string) {
    await fetch(`/api/friends/${id}`, { method: "DELETE" });
    void reload();
  }

  return (
    <main className="min-h-screen bg-[#fffaf0] p-6">
      <div className="max-w-2xl mx-auto space-y-5">
        <h1 className="text-2xl font-bold">Friends</h1>
        <section className="bg-white rounded-2xl p-5 border-b-[3px] border-[#e5e5e5]">
          <div className="text-xs font-bold uppercase text-[#999] mb-3">Find people</div>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Email or name" className="w-full rounded-xl px-3 py-2 bg-[#f7f7f7]" />
          <ul className="mt-3 space-y-2">
            {hits.map((u) => (
              <li key={u.id} className="flex justify-between items-center">
                <span>{u.name ?? u.email}</span>
                <DuoButton onClick={() => add(u.id)}>+ Add</DuoButton>
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-white rounded-2xl p-5 border-b-[3px] border-[#e5e5e5]">
          <div className="text-xs font-bold uppercase text-[#999] mb-3">Your friends</div>
          <ul className="space-y-2">
            {friends.map((f) => (
              <li key={f.id} className="flex justify-between items-center">
                <span>{f.other.name ?? "anon"} {f.status === "PENDING" && (f.iSent ? "(sent)" : "(wants to add)")}</span>
                <div className="flex gap-2">
                  {f.status === "PENDING" && !f.iSent && <DuoButton onClick={() => accept(f.id)}>Accept</DuoButton>}
                  <DuoButton variant="ghost" onClick={() => remove(f.id)}>Remove</DuoButton>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Update home sidebar to show friends**

`src/components/home/friends-sidebar.tsx`:
```typescript
"use client";

import { useEffect, useState } from "react";

type Friend = { id: string; status: string; other: { id: string; name: string | null } };

export function FriendsSidebar() {
  const [friends, setFriends] = useState<Friend[]>([]);
  useEffect(() => {
    void fetch("/api/friends").then((r) => r.json()).then(setFriends);
  }, []);
  const accepted = friends.filter((f) => f.status === "ACCEPTED");

  return (
    <aside className="bg-white rounded-2xl p-5 border-b-[3px] border-[#e5e5e5]">
      <div className="text-xs font-bold uppercase text-[#999] mb-3">Friends</div>
      {accepted.length === 0 && <p className="text-sm text-[#777]">No friends yet. <a href="/friends" className="text-[#1cb0f6] font-bold">Add some</a>.</p>}
      <ul className="space-y-2">
        {accepted.map((f) => (
          <li key={f.id} className="flex items-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full bg-[#ccc]"></span>
            <span>{f.other.name}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
```

Mount on home page (`src/app/(authed)/page.tsx`): replace the placeholder aside with `<FriendsSidebar />`.

- [ ] **Step 3: Commit and push**

```bash
git checkout -b feat/friends-ui
git add -A
git commit -m "feat: add friends page and home sidebar"
git push -u origin feat/friends-ui
git checkout main && git merge feat/friends-ui --ff-only && git push
git branch -d feat/friends-ui && git push origin --delete feat/friends-ui
```

---

## Task 8.3: Recent rooms history

**Branch:** `feat/recent-rooms`

**Files:**
- Create: `src/app/api/rooms/recent/route.ts`, `src/components/home/recent-rooms.tsx`
- Modify: `src/app/(authed)/page.tsx`, `src/lib/socket/server.ts` (record RoomParticipant on join)

- [ ] **Step 1: Record participation in DB on room:join**

In `src/lib/socket/server.ts`, after `trackPresence`:
```typescript
// Create RoomParticipant row (idempotent: best effort)
await db.roomParticipant.create({
  data: {
    roomId: state.roomId,
    userId: user.userId ?? null,
    guestName: user.userId ? null : user.guestName ?? null,
  },
}).catch(() => {});
```

Import `db`.

- [ ] **Step 2: API**

`src/app/api/rooms/recent/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "auth" }, { status: 401 });

  const recent = await db.roomParticipant.findMany({
    where: { userId: session.user.id },
    orderBy: { joinedAt: "desc" },
    take: 20,
    include: { room: { include: { creator: { select: { name: true } } } } },
    distinct: ["roomId"],
  });

  return NextResponse.json(recent.map((p) => ({
    code: p.room.code,
    videoId: p.room.videoId,
    joinedAt: p.joinedAt.getTime(),
    creatorName: p.room.creator.name,
    closed: !!p.room.closedAt,
  })));
}
```

- [ ] **Step 3: UI**

`src/components/home/recent-rooms.tsx`:
```typescript
"use client";

import { useEffect, useState } from "react";

type Recent = { code: string; videoId: string | null; joinedAt: number; creatorName: string | null; closed: boolean };

export function RecentRooms() {
  const [rooms, setRooms] = useState<Recent[]>([]);
  useEffect(() => { void fetch("/api/rooms/recent").then((r) => r.json()).then(setRooms); }, []);

  if (rooms.length === 0) return <p className="text-sm text-[#777]">No rooms yet — create one above!</p>;
  return (
    <ul className="space-y-2">
      {rooms.slice(0, 5).map((r) => (
        <li key={r.code} className="flex justify-between items-center p-3 bg-[#f7f7f7] rounded-xl">
          <div>
            <div className="font-bold text-sm">{r.code}</div>
            <div className="text-xs text-[#999]">by {r.creatorName ?? "you"}</div>
          </div>
          {!r.closed && <a href={`/room/${r.code}`} className="text-sm font-bold text-[#1cb0f6]">Open</a>}
        </li>
      ))}
    </ul>
  );
}
```

Mount on home in place of the "No rooms yet" placeholder.

- [ ] **Step 4: Commit and push**

```bash
git checkout -b feat/recent-rooms
git add -A
git commit -m "feat: add recent rooms history and home tile"
git push -u origin feat/recent-rooms
git checkout main && git merge feat/recent-rooms --ff-only && git push
git branch -d feat/recent-rooms && git push origin --delete feat/recent-rooms
```

---

# Phase 9 — Polish

## Task 9.1: Tailwind theme tokens + Nunito font

**Branch:** `chore/duo-theme`

**Files:**
- Modify: `tailwind.config.ts`, `src/app/layout.tsx`, `src/app/globals.css`

- [ ] **Step 1: Add Nunito via next/font**

`src/app/layout.tsx`:
```typescript
import "./globals.css";
import { Nunito } from "next/font/google";

const nunito = Nunito({ subsets: ["latin"], weight: ["400", "700", "800"], variable: "--font-nunito" });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={nunito.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Tailwind config tokens**

`tailwind.config.ts`:
```typescript
import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        duo: {
          green:   "#58cc02",
          greenDk: "#58a700",
          blue:    "#1cb0f6",
          blueDk:  "#0a8fc7",
          purple:  "#ce82ff",
          orange:  "#ff9600",
          cream:   "#fffaf0",
          text:    "#3c3c3c",
          muted:   "#777",
          border:  "#e5e5e5",
        },
      },
      fontFamily: {
        sans: ["var(--font-nunito)", "ui-sans-serif", "system-ui"],
      },
      borderWidth: {
        "3": "3px",
        "4": "4px",
      },
    },
  },
} satisfies Config;
```

- [ ] **Step 3: Replace inline hex everywhere**

Sweep through `src/components/` and `src/app/` and replace `bg-[#58cc02]` → `bg-duo-green`, `text-[#3c3c3c]` → `text-duo-text`, etc. Keep behaviour identical.

- [ ] **Step 4: Commit and push**

```bash
git checkout -b chore/duo-theme
git add -A
git commit -m "chore: extract Duolingo theme tokens and use Nunito font"
git push -u origin chore/duo-theme
git checkout main && git merge chore/duo-theme --ff-only && git push
git branch -d chore/duo-theme && git push origin --delete chore/duo-theme
```

---

## Task 9.2: Mobile responsive pass

**Branch:** `chore/mobile-pass`

**Files:**
- Modify: `src/components/room/room-shell.tsx`, `src/app/(authed)/page.tsx`

- [ ] **Step 1: Room shell — stack vertically below `lg` breakpoint**

The current `grid lg:grid-cols-[1fr_320px]` already does this. Verify by resizing the browser to ~400px wide. Make chat collapsible:

In `room-shell.tsx`:
```typescript
const [chatOpen, setChatOpen] = useState(true);
// In the aside:
<aside className={`bg-white rounded-2xl p-4 border-b-[3px] border-duo-border flex flex-col transition-all
                   ${chatOpen ? "h-[500px]" : "h-12 overflow-hidden"}`}>
  <button onClick={() => setChatOpen((v) => !v)} className="text-xs font-bold uppercase text-duo-muted mb-3 flex justify-between">
    <span>Chat</span>
    <span>{chatOpen ? "−" : "+"}</span>
  </button>
  {chatOpen && <ChatPanel />}
</aside>
```

- [ ] **Step 2: Test on mobile viewport**

Open Chrome DevTools, set device to iPhone SE. Verify:
- Home page stacks single-column
- Room: video on top, chat collapsed below
- All buttons reachable, text legible

- [ ] **Step 3: Commit and push**

```bash
git checkout -b chore/mobile-pass
git add -A
git commit -m "chore: make chat collapsible and verify mobile layouts"
git push -u origin chore/mobile-pass
git checkout main && git merge chore/mobile-pass --ff-only && git push
git branch -d chore/mobile-pass && git push origin --delete chore/mobile-pass
```

---

# Phase 10 — Deploy

## Task 10.1: Production Dockerfile

**Branch:** `chore/dockerfile`

**Files:**
- Create: `Dockerfile`, `.dockerignore`

- [ ] **Step 1: Dockerfile (multi-stage)**

`Dockerfile`:
```dockerfile
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

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/tsconfig.json ./tsconfig.json
USER app
EXPOSE 3000
CMD ["npx", "tsx", "server.ts"]
```

- [ ] **Step 2: .dockerignore**

```
node_modules
.next
.git
.env
.env.local
.superpowers
docs
tests
*.md
.vscode
.idea
```

- [ ] **Step 3: Build locally to verify**

```bash
docker build -t partyroom:dev .
```

Expected: clean build, no errors.

- [ ] **Step 4: Commit and push**

```bash
git checkout -b chore/dockerfile
git add -A
git commit -m "chore: add multi-stage production Dockerfile"
git push -u origin chore/dockerfile
git checkout main && git merge chore/dockerfile --ff-only && git push
git branch -d chore/dockerfile && git push origin --delete chore/dockerfile
```

---

## Task 10.2: Production docker-compose + Caddyfile

**Branch:** `chore/compose-prod`

**Files:**
- Create: `docker-compose.prod.yml`, `Caddyfile`, `.env.prod.example`

- [ ] **Step 1: Caddyfile**

`Caddyfile`:
```
partyroom.musel.dev {
  encode gzip
  reverse_proxy app:3000
}
```

- [ ] **Step 2: docker-compose.prod.yml**

```yaml
services:
  app:
    image: ghcr.io/musel25/partyroom:latest
    restart: unless-stopped
    env_file: .env.prod
    depends_on:
      postgres:
        condition: service_healthy
    expose:
      - "3000"

  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER"]
      interval: 5s
      retries: 5

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - app

volumes:
  pgdata:
  caddy_data:
  caddy_config:
```

- [ ] **Step 3: .env.prod.example**

```
DATABASE_URL=postgresql://partyroom:CHANGE_ME@postgres:5432/partyroom
NEXTAUTH_URL=https://partyroom.musel.dev
NEXTAUTH_SECRET=CHANGE_ME
GOOGLE_CLIENT_ID=CHANGE_ME
GOOGLE_CLIENT_SECRET=CHANGE_ME
NODE_ENV=production

POSTGRES_USER=partyroom
POSTGRES_PASSWORD=CHANGE_ME
POSTGRES_DB=partyroom
```

- [ ] **Step 4: Commit and push**

```bash
git checkout -b chore/compose-prod
git add -A
git commit -m "chore: add production docker-compose and Caddyfile"
git push -u origin chore/compose-prod
git checkout main && git merge chore/compose-prod --ff-only && git push
git branch -d chore/compose-prod && git push origin --delete chore/compose-prod
```

---

## Task 10.3: GitHub Actions CI/CD

**Branch:** `chore/github-actions`

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`

- [ ] **Step 1: CI (lint + typecheck + test on every PR)**

`.github/workflows/ci.yml`:
```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx prisma generate
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
```

- [ ] **Step 2: Deploy on push to main**

`.github/workflows/deploy.yml`:
```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: ghcr.io/musel25/partyroom:latest,ghcr.io/musel25/partyroom:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    steps:
      - name: SSH and pull
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /opt/partyroom
            docker compose -f docker-compose.prod.yml pull app
            docker compose -f docker-compose.prod.yml up -d app
            docker compose -f docker-compose.prod.yml exec -T app npx prisma migrate deploy
```

Required GitHub repo secrets:
- `VPS_HOST` — VPS public IP or hostname
- `VPS_USER` — SSH user (likely `opc` on Oracle Linux, `ubuntu` on Ubuntu)
- `VPS_SSH_KEY` — private SSH key with access to the VPS

- [ ] **Step 3: Commit and push**

```bash
git checkout -b chore/github-actions
git add -A
git commit -m "chore: add CI workflow and main-branch deploy via SSH"
git push -u origin chore/github-actions
git checkout main && git merge chore/github-actions --ff-only && git push
git branch -d chore/github-actions && git push origin --delete chore/github-actions
```

---

## Task 10.4: VPS bootstrap (one-time manual)

**Branch:** N/A — manual steps captured in `docs/deploy.md`

**Files:**
- Create: `docs/deploy.md`

- [ ] **Step 1: Document the bootstrap**

`docs/deploy.md`:
```markdown
# VPS bootstrap (one-time)

## Prereqs

- OCI instance with public IP
- SSH access as the default user (`opc` for Oracle Linux, `ubuntu` for Ubuntu)
- Ports 80 and 443 open in the OCI security list

## Steps

1. SSH in:
   ```bash
   ssh <user>@<vps-ip>
   ```

2. Install Docker:
   ```bash
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker $USER
   exit  # then ssh in again to pick up the group change
   ```

3. Create the app directory:
   ```bash
   sudo mkdir -p /opt/partyroom
   sudo chown $USER:$USER /opt/partyroom
   cd /opt/partyroom
   ```

4. Pull only the deploy files (no source — the image is on GHCR):
   ```bash
   curl -O https://raw.githubusercontent.com/musel25/partyroom/main/docker-compose.prod.yml
   curl -O https://raw.githubusercontent.com/musel25/partyroom/main/Caddyfile
   curl -O https://raw.githubusercontent.com/musel25/partyroom/main/.env.prod.example
   mv .env.prod.example .env.prod
   ```

5. Edit `.env.prod`:
   - Set `NEXTAUTH_SECRET` to `openssl rand -base64 32`
   - Paste `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` from Google Cloud
   - Set `POSTGRES_PASSWORD` to a strong random value, mirror it in `DATABASE_URL`

6. Authenticate to GHCR if your image is private (it's public, so skip):
   ```bash
   docker login ghcr.io  # use a GitHub PAT with read:packages
   ```

7. Add the DNS record at Vercel:
   - Domain `musel.dev` → DNS → add A record:
     - Name: `partyroom`
     - Value: `<vps-public-ip>`
     - TTL: 60
   - Wait ~1 minute for propagation: `dig partyroom.musel.dev`

8. First boot:
   ```bash
   docker compose -f docker-compose.prod.yml up -d
   ```

9. Run the initial migration:
   ```bash
   docker compose -f docker-compose.prod.yml exec app npx prisma migrate deploy
   ```

10. Visit https://partyroom.musel.dev — Caddy will provision the TLS cert on first request. Allow up to ~30 seconds.

## Adding GitHub Actions secrets

On https://github.com/musel25/partyroom/settings/secrets/actions add:
- `VPS_HOST` — public IP
- `VPS_USER` — `opc` or `ubuntu`
- `VPS_SSH_KEY` — contents of an SSH private key whose public counterpart is in `~/.ssh/authorized_keys` on the VPS

## Verifying

```bash
# On VPS:
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f app
```

```bash
# From your laptop:
curl -I https://partyroom.musel.dev
```

Expected: `HTTP/2 200`.
```

- [ ] **Step 2: Commit and push**

```bash
git checkout -b docs/deploy
git add docs/deploy.md
git commit -m "docs: add VPS bootstrap and deploy guide"
git push -u origin docs/deploy
git checkout main && git merge docs/deploy --ff-only && git push
git branch -d docs/deploy && git push origin --delete docs/deploy
```

---

# Done criteria

The project is "shipped" when:

- [x] `https://partyroom.musel.dev` is reachable over HTTPS
- [x] You can sign in with Google
- [x] Two browsers in one room stay synced on play/pause/seek/skip
- [x] Chat works and persists
- [x] Queue add/remove/auto-advance works
- [x] Floating reactions work
- [x] Friends list works (add, accept, remove)
- [x] Recent rooms appear on home
- [x] Mobile viewport doesn't break the layout
- [x] CI passes and pushing to `main` deploys automatically

---

# Out of scope reminders

These were explicitly deferred in the spec. Do not implement in this plan:

- Vimeo / Twitch / other video sources
- Moderation (kick / ban)
- Push notifications / emails
- Public profiles
- Room discovery
