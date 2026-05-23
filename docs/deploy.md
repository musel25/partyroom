# Deployment

partyroom runs in production at **https://partyroom.musel.dev** on an Oracle
Cloud Ubuntu VM (`145.241.168.188`), in Docker, behind the host's nginx
(shared with `math.musel.dev` on the same VPS).

---

## Architecture

```
Internet ──→ DNS (Vercel: partyroom.musel.dev → 145.241.168.188)
         ──→ OCI security list (TCP 80, 443 open)
         ──→ ubuntu host firewall
         ──→ nginx on host (TLS via Let's Encrypt + certbot)
              │
              ├──→ math.musel.dev      → 127.0.0.1:8001 (mathtrainer container)
              └──→ partyroom.musel.dev → 127.0.0.1:3000 (partyroom app container)
                                                            │
                                                            └──→ Postgres container
                                                                 (docker network, not exposed)
```

## What each piece does

| Piece | Location | Role |
|---|---|---|
| DNS A record | Vercel (musel.dev DNS) | Resolves `partyroom.musel.dev` to the VPS IP |
| OCI Security List | OCI console | Cloud firewall — allows inbound 80/443 |
| Host nginx | `/etc/nginx/` on VPS | TLS termination + reverse proxy; one nginx for all sites on the VPS |
| nginx vhost | `/etc/nginx/sites-enabled/partyroom.musel.dev` | Routes the domain to the app container, with WebSocket upgrades for Socket.IO |
| Let's Encrypt cert | `/etc/letsencrypt/live/partyroom.musel.dev/` | TLS keypair; auto-renews every 60 days via `certbot.timer` |
| `docker-compose.prod.yml` | `/opt/partyroom/` on VPS | Defines `app` (Next.js + Socket.IO) and `postgres` containers |
| `.env.prod` | `/opt/partyroom/` on VPS | Production secrets — Google OAuth, NextAuth secret, Postgres password. **Never in git.** |
| App container image | GHCR (`ghcr.io/musel25/partyroom:latest`) | Built by GitHub Actions, pulled by the VPS |
| Postgres container | docker volume `pgdata` | DB. Only reachable from the app container on the docker network. |
| GitHub Actions: CI | `.github/workflows/ci.yml` | Lint + typecheck + tests on every PR/push |
| GitHub Actions: Deploy | `.github/workflows/deploy.yml` | Build → push → SSH → restart → migrate |

## Why this architecture

- **VPS + Docker, not Vercel** — Socket.IO needs persistent WebSocket connections; Vercel functions don't.
- **Host nginx, not Caddy in a container** — math.musel.dev already uses host nginx; sharing avoids port 80/443 contention.
- **GHCR, not Docker Hub** — free for public repos, integrated with GitHub Actions, no pull-rate limits.
- **One container per service** — app is stateless (restart anytime); Postgres holds data in a named volume that survives image rebuilds.

---

## Prereqs

- OCI instance with ports 80/443 already open
- SSH access as `ubuntu` (key at `~/.ssh/ssh-key-2026-04-05.key` locally)
- nginx + certbot already installed on the host (from the mathtrainer setup)
- DNS A record `partyroom.musel.dev` → `145.241.168.188`

---

## One-time bootstrap (already done — kept for reference)

### 1. SSH in and prepare app directory

```bash
ssh -i ~/.ssh/ssh-key-2026-04-05.key ubuntu@145.241.168.188
sudo mkdir -p /opt/partyroom
sudo chown $USER:$USER /opt/partyroom
cd /opt/partyroom
```

### 2. Pull deploy files

```bash
curl -O https://raw.githubusercontent.com/musel25/partyroom/main/docker-compose.prod.yml
curl -O https://raw.githubusercontent.com/musel25/partyroom/main/.env.prod.example
cp .env.prod.example .env.prod
```

### 3. Fill in `.env.prod`

```bash
nano .env.prod
```

Set:
- `NEXTAUTH_SECRET` — `openssl rand -base64 32`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — from Google Cloud Console
- `POSTGRES_PASSWORD` — `openssl rand -base64 24`. **Mirror in `DATABASE_URL`.**

### 4. Install the nginx vhost

```bash
sudo curl -fsSL -o /etc/nginx/sites-available/partyroom.musel.dev \
  https://raw.githubusercontent.com/musel25/partyroom/main/deploy/nginx-partyroom.conf
cd /etc/nginx/sites-enabled
sudo ln -sf ../sites-available/partyroom.musel.dev .
sudo nginx -t
```

### 5. Obtain the TLS certificate

```bash
sudo certbot certonly --webroot -w /var/www/html \
  -d partyroom.musel.dev \
  --agree-tos -m museltabarespardo@gmail.com -n
sudo systemctl reload nginx
```

### 6. First deploy

Trigger the **Deploy** workflow on GitHub Actions:
https://github.com/musel25/partyroom/actions → **Deploy** → **Run workflow** → branch `main`.

This builds the image, pushes it to GHCR, SSHes into the VPS, runs
`docker compose pull && up -d && migrate deploy`.

---

## GitHub Actions secrets

On https://github.com/musel25/partyroom/settings/secrets/actions:

- `VPS_HOST` = `145.241.168.188`
- `VPS_USER` = `ubuntu`
- `VPS_SSH_KEY` = contents of the private key whose pub key is in the VPS's `~/.ssh/authorized_keys`

---

## CI/CD flow

- **Every PR + push to main:** `.github/workflows/ci.yml` (lint, typecheck, tests).
- **Push to main:** `.github/workflows/deploy.yml`:
  1. Builds Docker image, tags `:latest` + `:<commit-sha>`, pushes to GHCR
  2. SSHes into VPS, pulls new image, restarts the `app` container, runs migrations

---

## Day-to-day ops

```bash
cd /opt/partyroom

# status
docker compose -f docker-compose.prod.yml ps

# logs
docker compose -f docker-compose.prod.yml logs -f app
docker compose -f docker-compose.prod.yml logs -f postgres

# restart just the app
docker compose -f docker-compose.prod.yml restart app

# rebuild from latest GHCR image (what GitHub Actions does)
docker compose -f docker-compose.prod.yml pull app
docker compose -f docker-compose.prod.yml up -d app

# run a fresh migration manually
docker compose -f docker-compose.prod.yml exec app npx prisma migrate deploy

# psql shell
docker compose -f docker-compose.prod.yml exec postgres psql -U partyroom partyroom
```

### Database backup

```bash
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U partyroom partyroom > backup-$(date +%F).sql
```

### nginx ops

```bash
# show enabled vhosts
ls -l /etc/nginx/sites-enabled/

# edit our vhost
sudo nano /etc/nginx/sites-available/partyroom.musel.dev

# reload after changes
sudo nginx -t && sudo systemctl reload nginx

# follow nginx access/error logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### TLS auto-renewal

certbot is already configured by mathtrainer's setup and renews via the systemd
`certbot.timer`. To check:

```bash
systemctl list-timers | grep certbot
sudo certbot certificates
```

---

## Google OAuth client

Google Cloud Console → APIs & Services → Credentials → `partyroom-web`:

- **Authorized JavaScript origins:**
  - `http://localhost:3000`
  - `https://partyroom.musel.dev`
- **Authorized redirect URIs:**
  - `http://localhost:3000/api/auth/callback/google`
  - `https://partyroom.musel.dev/api/auth/callback/google`

---

## Verifying

From a laptop:

```bash
curl -I https://partyroom.musel.dev
```

Expected: `HTTP/2 200`.

In a browser: open https://partyroom.musel.dev → "Continue with Google" → land
on home → paste a YouTube URL → open the room URL in a second browser → confirm
play/pause/seek stays in sync.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `502 Bad Gateway` from nginx | App container not running | `docker compose -f docker-compose.prod.yml ps`; if down, `up -d app`; check logs |
| `503 Service Unavailable` during sign-in | Google OAuth redirect URI mismatch | Add `https://partyroom.musel.dev/api/auth/callback/google` to Google client |
| Deploy workflow fails with `Permission denied (publickey)` | `VPS_SSH_KEY` secret wrong | Re-paste full private key contents (including `-----BEGIN`/`-----END` lines) |
| Sync feels janky between two browsers | WebSocket not upgrading | Confirm `/etc/nginx/sites-enabled/partyroom.musel.dev` has the `location /socket.io/` block with `proxy_set_header Upgrade $http_upgrade` |
| `prisma migrate deploy` fails | DB connection wrong | Check `DATABASE_URL` in `.env.prod` uses `postgres:5432` (the service name), not `localhost` |
| Site OK but no styles | Build failed somewhere | Check `docker compose logs app` for build errors; check GitHub Actions build logs |
