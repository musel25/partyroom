# partyroom — Design Spec

**Date:** 2026-05-23
**Status:** Draft, pending approval
**Domain:** partyroom.musel.dev
**Repo (planned):** github.com/museltabares/partyroom

---

## 1. Purpose

A self-hosted YouTube watch-party app: paste a YouTube link, share a room link, and watch in perfect sync with friends with chat, a shared queue, friends list, and floating reactions. Aesthetic is Duolingo-inspired (rounded corners, soft palette, generous spacing, friendly buttons with 3D shadow press effect).

---

## 2. Scope

**In scope (v1):**

- Account sign-in via Google OAuth
- Guest mode for joining via a room link (nickname only, no account required)
- Create / join rooms by link or short code
- Synced YouTube playback (play / pause / seek / skip / queue)
- Per-room chat with persistence (last 100 messages)
- Ephemeral floating-emoji reactions
- Friends list with online status and "join my friend's room" CTA
- Recent rooms history
- Home page (action-first layout)
- Watch room (classic layout: video + chat sidebar, queue in drawer)
- Mobile-responsive layouts

**Out of scope (v1, deferred):**

- Other video sources (Vimeo, Twitch, custom uploads)
- Room moderation / kick / ban controls
- Per-user buffering indicators
- Notifications (push, email, in-app)
- Multiple OAuth providers beyond Google
- Profile pages / public profiles
- Room discovery / public rooms

---

## 3. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 15 (App Router) + TypeScript | UI + REST API in one repo |
| Styling | Tailwind CSS + shadcn/ui | Custom Duolingo-style theme overrides |
| Realtime | Socket.IO via custom Node server | Same process as Next.js; one port |
| Auth | Auth.js v5 (NextAuth) — Google provider | Plus guest sessions via signed cookie |
| Database | PostgreSQL 16 | Single instance, run in Docker on VPS |
| ORM | Prisma | Schema + migrations |
| Video | YouTube IFrame Player API | Loaded on the client |
| Reverse proxy | Caddy | Auto Let's Encrypt SSL |
| Container | Docker Compose | Three services: app, postgres, caddy |
| Deploy | GitHub Actions → SSH → `docker compose pull && up -d` | Push to `main` deploys to VPS |
| VPS | OCI instance (France Central, Oracle Linux/Ubuntu) | Existing |
| Node | 22.x LTS | Runtime |

---

## 4. Architecture

```
                  Browser
                    │
                    │  HTTPS / WSS
                    ▼
              Caddy (TLS termination, partyroom.musel.dev)
                    │
                    ▼
         Next.js + Socket.IO (single Node process)
                    │
                    ▼
              PostgreSQL
```

**Process layout (custom server.ts):**

- Boots Next.js in custom-server mode
- Creates one HTTP server
- Attaches Socket.IO to the same HTTP server
- Same hostname/port handles `/`, `/api/*`, and `/socket.io/*`

**Why one process:** simpler ops, no inter-service auth, no extra port. Sufficient until ~10k concurrent connections — far beyond this app's expected load.

---

## 5. Data model

### Postgres schema (Prisma)

```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  name          String?
  image         String?
  createdAt     DateTime @default(now())

  rooms         Room[]            @relation("RoomCreator")
  participants  RoomParticipant[]
  messages      Message[]
  friendsAsA    Friendship[]      @relation("FriendA")
  friendsAsB    Friendship[]      @relation("FriendB")
  accounts      Account[]         // Auth.js
  sessions      Session[]         // Auth.js
}

model Room {
  id            String   @id @default(cuid())
  code          String   @unique           // human-friendly join code, e.g. "XYZ-123"
  creatorId     String
  createdAt     DateTime @default(now())
  closedAt      DateTime?                  // null = active

  // Current playback state (mirror of in-memory, persisted for restart recovery)
  videoId       String?
  playing       Boolean  @default(false)
  positionSec   Float    @default(0)
  updatedAt     DateTime @default(now())

  creator       User              @relation("RoomCreator", fields: [creatorId], references: [id])
  participants  RoomParticipant[]
  messages      Message[]
  queue         QueueItem[]
}

model QueueItem {
  id        String   @id @default(cuid())
  roomId    String
  videoId   String
  title     String?
  thumbnail String?
  addedById String?           // null if added by guest
  position  Int               // ordering
  createdAt DateTime @default(now())

  room      Room   @relation(fields: [roomId], references: [id], onDelete: Cascade)
}

model RoomParticipant {
  id          String   @id @default(cuid())
  roomId      String
  userId      String?           // null for guest
  guestName   String?           // present iff userId is null
  joinedAt    DateTime @default(now())
  leftAt      DateTime?

  room        Room   @relation(fields: [roomId], references: [id], onDelete: Cascade)
  user        User?  @relation(fields: [userId], references: [id])
}

model Message {
  id        String   @id @default(cuid())
  roomId    String
  userId    String?           // null for guest
  guestName String?
  body      String
  createdAt DateTime @default(now())

  room      Room  @relation(fields: [roomId], references: [id], onDelete: Cascade)
  user      User? @relation(fields: [userId], references: [id])
}

model Friendship {
  id        String   @id @default(cuid())
  aId       String
  bId       String
  status    FriendshipStatus @default(PENDING)
  createdAt DateTime @default(now())

  a         User @relation("FriendA", fields: [aId], references: [id])
  b         User @relation("FriendB", fields: [bId], references: [id])

  @@unique([aId, bId])
}

enum FriendshipStatus {
  PENDING
  ACCEPTED
  BLOCKED
}

// Auth.js standard tables: Account, Session, VerificationToken
```

### In-memory room state (Socket.IO server)

```ts
type RoomState = {
  roomId: string
  videoId: string | null
  playing: boolean
  positionSec: number     // last-known position
  updatedAt: number       // ms epoch — for elapsed-time compensation
  queue: QueueItem[]
  participants: Map<socketId, { userId?: string; guestName?: string }>
}
```

Mirrored to Postgres on every state change (best effort, async). On server restart, rehydrate from Postgres.

---

## 6. Sync protocol

### Control model

**Democratic** — anyone in the room can control playback. No host concept in v1.

### Authority

The **server is the source of truth.** Clients emit intent; the server validates, updates state, and broadcasts the new state to all clients in the room (including the sender). The sender does not optimistically apply its own action.

### Socket.IO events

**Client → Server:**

| Event | Payload | Meaning |
|---|---|---|
| `room:join` | `{ roomId }` | Join Socket.IO room; server returns current state |
| `room:leave` | `{ roomId }` | Leave room |
| `playback:play` | `{ positionSec }` | User pressed play at this position |
| `playback:pause` | `{ positionSec }` | User paused at this position |
| `playback:seek` | `{ positionSec }` | User scrubbed to this position |
| `playback:loadVideo` | `{ videoId }` | Replace current video (manual link change) |
| `queue:add` | `{ videoId, title?, thumbnail? }` | Append to queue |
| `queue:remove` | `{ queueItemId }` | Remove from queue |
| `queue:advance` | `{ fromVideoId }` | Current video ended, move to next (idempotent — server ignores if videoId no longer matches) |
| `chat:send` | `{ body }` | Send chat message (max 500 chars) |
| `reaction:send` | `{ emoji }` | Send floating reaction (1 of allowed set) |

**Server → Client:**

| Event | Payload | Meaning |
|---|---|---|
| `room:state` | Full `RoomState` snapshot | Sent on join, after any state-changing event, and on periodic drift broadcast (every 5s) |
| `chat:message` | `{ id, userId?, guestName?, body, createdAt }` | New chat message broadcast |
| `reaction` | `{ emoji, from }` | Reaction broadcast (ephemeral) |
| `participant:join` | `{ userId?, guestName? }` | Someone joined |
| `participant:leave` | `{ userId?, guestName? }` | Someone left |
| `error` | `{ code, message }` | Validation error or denied action |

### Latency compensation

Clients compute the expected position when receiving `room:state`:

```
expected = state.positionSec + (state.playing ? (now() - state.updatedAt) / 1000 : 0)
```

This corrects for the round-trip delay between the server's `updatedAt` and the client's receive time.

### Drift correction

Every 5 seconds, each client compares its actual YouTube player position to the expected position. If the absolute difference is **greater than 2 seconds**, the client calls `player.seekTo(expected, true)` silently. Smaller drifts are ignored to avoid constant micro-corrections.

The server also broadcasts a fresh `room:state` every 30 seconds as a heartbeat to recover from any missed events.

### Late-joiner protocol

1. Client connects and emits `room:join`.
2. Server replies with current `room:state` plus the last 100 chat messages.
3. Client loads the YouTube IFrame player with `videoId`, seeks to `expected` position, plays or pauses to match `state.playing`.

### Queue advance race

When a video ends, the YouTube player fires `onStateChange = ENDED` on every client roughly simultaneously. To avoid duplicate advances:

- Each client emits `queue:advance` with `fromVideoId = current videoId`.
- Server check: if `state.videoId !== fromVideoId`, ignore (already advanced).
- Otherwise: pop `queue[0]`, set `videoId`, `positionSec = 0`, `playing = true`, broadcast.

This makes the operation idempotent — the first request wins, the rest are no-ops.

---

## 7. Auth

### Google OAuth (for account holders)

- Auth.js v5 with Google provider
- Credentials: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (already provisioned)
- Redirect URI: `https://partyroom.musel.dev/api/auth/callback/google`
- On first sign-in: create `User` row with `email`, `name`, `image` from Google profile

### Guest sessions (for room-joiners)

- When an unauthenticated user opens a `/room/[code]` link, they see a "Enter your name" prompt
- Server issues a signed cookie containing `{ guestId: uuid, guestName: string }`
- This guest can chat, react, control playback, but cannot:
  - Create rooms
  - Add friends
  - See room history
- Guest session expires after 7 days

### Authorization

- Creating a room → requires logged-in user
- Joining a room → requires either logged-in user or guest cookie (cookie set automatically on first visit to `/room/[code]`)
- All chat / playback / queue events → require active room membership (verified server-side per event)

---

## 8. UI / Pages

### Page tree

```
/                   → home (signed in) or marketing (signed out)
/signin             → Google OAuth button
/room/[code]        → watch room (handles both signed-in and guest)
/friends            → friends list + requests
/history            → past rooms
```

### Visual identity

- **Font:** Nunito (already free via Google Fonts) — Duolingo's font is bespoke; Nunito is closest free analog
- **Palette:**
  - Primary green: `#58cc02` (Duolingo green)
  - Primary green border: `#58a700`
  - Blue: `#1cb0f6`
  - Purple: `#ce82ff`
  - Orange: `#ff9600`
  - Background cream: `#fffaf0`
  - Card white: `#ffffff`
  - Text default: `#3c3c3c`
  - Border default: `#e5e5e5`
- **Button style:** rounded 12px, 3px solid border-bottom in a darker shade, tap = remove the bottom border + translate-y-1
- **Cards:** white, 14px radius, 3px solid border-bottom for the "weight"

### Home page (action-first — selected layout)

- Two-column grid (main + sidebar)
- **Main:**
  - Green hero card: greeting + YouTube URL input + "Create room" button
  - Recent rooms list (last 5)
- **Sidebar:**
  - Friends list with online dots and "join" pill when they're in a room

### Watch room (classic — selected layout)

- Two-column grid (video + chat)
- **Top header:** logo, room code/name, participant avatars (overflow shows "+N")
- **Left (main):**
  - YouTube IFrame player (16:9, rounded)
  - Floating reaction overlay (bottom-right corner)
  - Control pill row: play/pause, skip-to-next, volume, "+ Queue" button
- **Right (sidebar, 280–320px):**
  - Scrolling chat (newest at bottom)
  - Input at the bottom
- **Queue:** drawer that slides from the right when "+ Queue" or the queue counter is clicked

### Mobile

- Watch room: video on top (full-width), chat below (collapsible to "show chat" pill)
- Home: stacked single column, sidebar moves below recent rooms

---

## 9. Component boundaries

To keep files focused and reasoning easy, the UI is organized by responsibility, not by page:

| Module | Responsibility | Key files |
|---|---|---|
| `lib/socket/server.ts` | Socket.IO server, event handlers, room state machine | one file per concern (chat, playback, queue, participants) |
| `lib/socket/client.ts` | Browser-side Socket.IO singleton + typed event helpers | small, no business logic |
| `lib/room/state.ts` | Pure room-state reducers (no IO). Used by both server and client for predictability | unit-testable |
| `components/player/` | YouTube IFrame wrapper + drift correction loop | isolated — no socket import inside |
| `components/chat/` | Chat list + input | isolated — receives messages via prop/hook |
| `components/queue/` | Queue drawer + add form | isolated |
| `components/reactions/` | Floating emoji animator | isolated |
| `app/(authed)/` | Routes that require sign-in (`/`, `/friends`, `/history`) | layout enforces auth |
| `app/room/[code]/` | Room page (guest-permitted) | own layout, own auth check |
| `app/api/auth/[...nextauth]/` | Auth.js handler | |
| `app/api/rooms/` | REST: create / list rooms | non-realtime ops |
| `prisma/schema.prisma` | DB schema | |

Each component must be understandable in isolation: what it does, what props it accepts, what it depends on. No cross-cutting "god" modules.

---

## 10. Error handling

| Failure | Behavior |
|---|---|
| Socket disconnects | Client shows "Reconnecting…" toast, auto-reconnects (Socket.IO built-in). On reconnect, re-emits `room:join` and resyncs. |
| YouTube IFrame fails to load | Show "Video unavailable — try a different link" with a "Skip" button (anyone can skip). |
| Invalid YouTube URL on create | Inline validation: regex extract videoId, refuse to submit if not found. |
| Room code not found | `/room/[code]` shows "This room doesn't exist or has ended" with link home. |
| Server restart mid-room | Postgres restore brings state back; clients reconnect; positions resync via heartbeat. May see a 5–10s jump. |
| Guest cookie tampered | Signature check fails → treat as new guest, prompt for name again. |
| Chat rate-limit (>5 msgs / 5s per user) | Server drops message, emits `error` to sender only. |

---

## 11. Testing

| Layer | Approach |
|---|---|
| `lib/room/state.ts` reducers | Unit tests (Vitest) — pure functions, easy to cover |
| Socket.IO events | Integration tests: spawn server, connect 2 fake clients, assert state convergence |
| Prisma queries | Integration tests against a throwaway Postgres (testcontainers or local) |
| React components | Component tests for the player wrapper (mock IFrame API), chat input, queue drawer |
| End-to-end | Playwright: create room, join with second browser, assert play/pause sync, chat round-trip |

E2E runs only locally + CI; not on every commit.

---

## 12. Deployment

### Initial VPS setup (one-time)

1. SSH in: `ssh ubuntu@<vps-ip>`
2. Install Docker + Docker Compose
3. Clone repo to `/opt/partyroom`
4. Create `.env` with secrets (Google OAuth, Postgres password, NextAuth secret)
5. `docker compose up -d`
6. Vercel DNS: add A record `partyroom` → VPS public IP
7. Caddy auto-provisions Let's Encrypt cert on first request to `partyroom.musel.dev`

### Continuous deploy

GitHub Actions on push to `main`:
1. Build Docker image, push to GHCR
2. SSH into VPS, run `docker compose pull && docker compose up -d`
3. Health-check the new container; rollback if it fails

### Docker Compose services

- `app` — Node 22 + Next.js + Socket.IO server, env vars from `.env`
- `postgres` — official `postgres:16-alpine`, volume `pgdata`
- `caddy` — official `caddy:2-alpine`, Caddyfile mounted in

### Caddyfile

```
partyroom.musel.dev {
  reverse_proxy app:3000
}
```

That's the whole config.

---

## 13. Environment variables

```
DATABASE_URL=postgresql://partyroom:<pw>@postgres:5432/partyroom
NEXTAUTH_URL=https://partyroom.musel.dev
NEXTAUTH_SECRET=<openssl rand -base64 32>
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
NODE_ENV=production
```

Local dev: same file with `NEXTAUTH_URL=http://localhost:3000` and a local Postgres.

---

## 14. Build order (for the implementation plan)

Suggested phasing — each step ends with something runnable:

1. **Scaffolding** — Next.js + Tailwind + Prisma + Docker Compose locally, Hello World page
2. **Auth** — Google OAuth + guest sessions
3. **Room creation + join (no sync)** — create room, paste URL, see video, no sync yet
4. **Socket.IO layer** — sync play/pause/seek for 2+ clients
5. **Chat** — persisted, last 100 on join
6. **Queue** — add, advance, remove
7. **Reactions** — floating emoji
8. **Friends + recent rooms** — non-realtime social features
9. **Polish: Duolingo styling pass** — theme tokens, button shadows, animations
10. **Deploy: VPS setup + GitHub Actions** — partyroom.musel.dev live

---

## 15. Open questions

None — all decisions captured. If implementation surfaces unknowns, this doc gets updated.
