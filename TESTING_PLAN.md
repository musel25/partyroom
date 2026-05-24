# Testing Plan — partyroom

Right-sized: **add the highest-value tests for things that have already broken**, plus a single smoke E2E. Don't chase coverage, don't test framework internals, don't try to E2E test WebSocket sync (timing-dependent, fragile).

---

## 1. Tool choices

| Layer | Tool | Reasoning |
|---|---|---|
| Unit + integration | **Vitest** (already installed) | Fast, ESM-native, already running 29 tests. Use it for all non-browser logic. |
| API route tests | **Vitest + Next.js route invocation** | Import the route handler, call it with a synthetic `Request`. No HTTP server needed. |
| E2E | **Playwright** (new) | First-class WebSocket support, can drive multiple browser contexts. Single browser engine (Chromium) to keep CI quick. |
| Mocking | **vi.mock + msw** for HTTP, **handwritten mocks** for Prisma | Mocks added per test, not globally. No magic. |
| CI | Extend the existing **GitHub Actions `ci.yml`** | Add a Postgres service, a Playwright job. No new platforms. |

---

## 2. Folder structure

```
src/lib/**/*.test.ts        # existing unit tests stay here (colocated)
tests/
├── api/                    # API route tests (vitest, node env)
│   ├── rooms.test.ts
│   └── youtube-search.test.ts
├── socket/                 # socket handler tests (vitest, node env)
│   ├── queue.test.ts
│   └── playback.test.ts
├── helpers/
│   ├── prisma-mock.ts
│   └── fake-socket.ts
└── e2e/                    # playwright tests
    ├── home.spec.ts
    └── playwright.config.ts
```

Vitest already picks up `src/**/*.test.ts` AND `tests/**/*.test.ts` (we set the glob earlier). No config change needed.

---

## 3. E2E flows — just one smoke test

| # | Flow | Why it's the right one |
|---|---|---|
| 1 | **Unauthenticated user lands at /, gets redirected to /signin, page renders the "Continue with Google" button** | Smallest end-to-end signal that the whole stack — Node server, custom server boot, Next middleware, auth.js providers endpoint, Tailwind, YouTube IFrame script registry — all loaded successfully. Catches "site is broken" regressions that unit tests never will. |

**Explicitly not E2E-testing in this round:**
- Two-browser sync — timing-dependent, would be flaky in CI, won't catch real bugs that aren't already covered by socket handler tests.
- Real Google OAuth — can't run in CI without a test Google account; adds little signal.
- YouTube iframe playback — depends on external Google service, slow, flaky, no value.

When the smoke E2E feels limited, we can add one signed-in E2E (with a stubbed JWT cookie injected via `context.addCookies`) for "create room → land in /room/CODE → player iframe appears". Adding that later is cheap.

---

## 4. Starter unit / integration tests to add

Picked specifically for things that have actually broken or have non-obvious correctness invariants. **Each one would have caught a real bug we shipped.**

| # | File | What it tests | Caught bug |
|---|---|---|---|
| 1 | `tests/socket/queue.test.ts` | `queue:add` mutates in-memory state synchronously (before DB) — a subsequent `queue:skip` sees the new item | The skip-after-add race we just fixed |
| 2 | `tests/socket/queue.test.ts` | `queue:advance` is idempotent: 2 concurrent advances from the same `fromVideoId` yield one transition | The race we covered in the original reducer test, but at the handler level |
| 3 | `tests/socket/playback.test.ts` | `playback:play` drops the event when server already says playing AND position within tolerance | The buffer-resume rebound loop |
| 4 | `tests/socket/playback.test.ts` | `playback:loadVideo` rejects non-YouTube ids | The "anyone can write garbage into Room.videoId" hole |
| 5 | `src/lib/room/rehydrate.test.ts` | If `playing=true` and `stateUpdated` is >5 min old, the rehydrated state has `playing=false` | The server-restart bug that would shoot positionSec into the future |
| 6 | `src/lib/rate-limit.test.ts` | `forget(key)` and `sweep()` actually remove entries | Memory-leak fix; the existing rate-limit tests don't cover these |
| 7 | `tests/api/rooms.test.ts` | POST `/api/rooms` returns 400 for non-YouTube input, 401 without auth, 200 with valid input | Input validation regression guard |
| 8 | `tests/api/youtube-search.test.ts` | GET `/api/youtube/search` returns 503 when `YOUTUBE_API_KEY` unset; returns parsed results when set (with `global.fetch` mocked) | Validates the graceful-degradation path the UI relies on |

That's **8 new tests** + the existing 29 = ~37 total. None require a browser. All run in <1 second locally.

---

## 5. CI design

Extend `.github/workflows/ci.yml`:

```yaml
jobs:
  test:                       # existing — unchanged
    runs-on: ubuntu-latest
    services:
      postgres: ...            # NEW — for the API route tests that touch Prisma
    steps:
      - npm ci
      - npx prisma generate
      - npx prisma migrate deploy   # NEW
      - npm run lint
      - npm run typecheck
      - npm test               # vitest

  e2e:                         # NEW
    runs-on: ubuntu-latest
    needs: test                # only run if unit tests pass — fail-fast
    services:
      postgres: ...
    steps:
      - npm ci
      - npx playwright install --with-deps chromium
      - npx prisma generate && npx prisma migrate deploy
      - npm run build
      - npm run test:e2e       # playwright with webServer auto-start
```

- **Triggers:** PRs + push to `main` (same as today).
- **Time estimate:** test job +30s (Postgres init), e2e job ~90-120s (build + 1 spec).
- **Total CI runtime:** ~3-4 min, well under what the deploy workflow takes.

---

## 6. Docker integration

**E2E does NOT use the Docker image in CI.** Reasoning:

- The prod image targets `linux/arm64` (your VPS); building it on the amd64 CI runner needs QEMU emulation = 8+ min per run, too slow for every PR.
- We're testing the app, not the deploy. The bundled `dist/server.cjs` is what runs in production — Playwright launches the same `node dist/server.cjs` in CI, against a CI-provided Postgres service. Same code path, no Docker overhead.

If we ever want a "did the image actually build & boot" check, that belongs in the `deploy.yml` workflow (where we already build the image) — fail the deploy if the new image's healthcheck doesn't go green within 30s. Out of scope here.

---

## 7. Explicitly NOT testing in this pass

| Not testing | Why |
|---|---|
| Two-browser WebSocket sync (play in A, observe in B) | Timing-dependent, flaky in CI, would slow PR feedback. Socket handler tests cover the logic without the browsers. |
| Real Google OAuth flow | Needs a real Google test account; brittle to Google UI changes. |
| YouTube IFrame actual playback | External Google service; flaky; testing YT, not our code. |
| Visual regression / snapshots | Premature for this size of UI; high maintenance cost. |
| Performance benchmarks | No performance budget defined; would become noise. |
| Friends API (add/accept/remove) | Working today, low complexity, no incidents. Add later if it breaks. |
| Reactions | Trivial broadcast, no logic worth testing. |
| Chat send | Already covered by rate-limit test + happy-path via E2E. |

---

## 8. Estimated changes

| Kind | Count |
|---|---|
| New files | 7 (1 playwright config, 1 E2E spec, 4 vitest specs, 2 test helpers) |
| Modified files | 3 (`.github/workflows/ci.yml`, `package.json`, `README.md`) |
| New dependencies (dev) | `@playwright/test`, `vite-node` (for invoking Next route handlers in tests) |
| New scripts | `test:e2e`, `test:ci` (CI wrapper that runs vitest then playwright) |

---

## Definition of done (mirrors your spec)

- `npm test` runs all vitest tests (37+) — green.
- `npm run test:e2e` launches Playwright against `npm start` (built app), runs the smoke spec — green.
- `npm run test:ci` runs both, in order.
- `ci.yml` runs both jobs on push + PR.
- README has a "Testing" section.
- This file (`TESTING_PLAN.md`) accurately describes what was built.

---

**Stopping here.** Approve and I'll implement Phase 3 — or tell me to cut something further.
