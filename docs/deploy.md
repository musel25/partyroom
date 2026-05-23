# Deployment

partyroom runs in production at **https://partyroom.musel.dev** — an Oracle Cloud
VM, in Docker, behind the host's nginx (shared with other apps on the same VPS).

## Architecture

```
browser → partyroom.musel.dev   (DNS A record → 145.241.168.188)
        → nginx :443            TLS termination + WebSocket upgrade
        → 127.0.0.1:3000
        → Docker "app" container (Next.js + Socket.IO)
        → Postgres container on the docker-compose network
```

The host nginx (not a Caddy container) handles TLS and reverse-proxies to the
app on localhost. This matches how `math.musel.dev` is served on the same VPS.

## Prereqs

- OCI instance with ports 80/443 already open (security list + host firewall)
- SSH access as `ubuntu`
- nginx + certbot already installed on the host (from the mathtrainer setup)
- DNS A record `partyroom.musel.dev` → VPS public IP

## One-time bootstrap

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
- `POSTGRES_PASSWORD` — a strong random value (e.g. `openssl rand -base64 24`).
  **Mirror it in `DATABASE_URL`.**

### 4. Install the nginx vhost

```bash
sudo curl -o /etc/nginx/sites-available/partyroom.musel.dev \
  https://raw.githubusercontent.com/musel25/partyroom/main/deploy/nginx-partyroom.conf
sudo ln -sf /etc/nginx/sites-available/partyroom.musel.dev /etc/nginx/sites-enabled/
sudo nginx -t        # syntax check
```

`nginx -t` will warn about missing SSL certs — that's expected; we obtain them next.

### 5. Obtain the TLS certificate

Temporarily disable the symlink so nginx loads OK without certs, request the cert
via the webroot challenge, then re-enable:

```bash
sudo rm /etc/nginx/sites-enabled/partyroom.musel.dev
sudo systemctl reload nginx

sudo certbot certonly --webroot -w /var/www/html \
  -d partyroom.musel.dev \
  --agree-tos -m museltabarespardo@gmail.com -n

sudo ln -sf /etc/nginx/sites-available/partyroom.musel.dev /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 6. Boot the app stack

```bash
cd /opt/partyroom
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
sleep 15
docker compose -f docker-compose.prod.yml exec app npx prisma migrate deploy
```

Note: the very first `docker compose pull` requires the image to have been
pushed to GHCR by the **Deploy** workflow at least once. If this is the very
first deploy, trigger the workflow first
(https://github.com/musel25/partyroom/actions → **Deploy** → **Run workflow**)
and wait for the build job to finish before running `pull` on the VPS. The
workflow's SSH step does the pull+migrate for you on subsequent runs.

## GitHub Actions secrets

On https://github.com/musel25/partyroom/settings/secrets/actions:

- `VPS_HOST` = `145.241.168.188`
- `VPS_USER` = `ubuntu`
- `VPS_SSH_KEY` = contents of the private key whose pub key is in
  `~/.ssh/authorized_keys` on the VPS

## CI/CD flow

- **Every PR + push to main:** runs `.github/workflows/ci.yml` (lint, typecheck, tests).
- **Push to main:** runs `.github/workflows/deploy.yml`:
  1. Builds a Docker image, tags `latest` + `<sha>`, pushes to GHCR
  2. SSHes into VPS, pulls the new image, restarts the `app` container, runs migrations

## Operations

```bash
cd /opt/partyroom
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f app
docker compose -f docker-compose.prod.yml restart
```

## Database backup

```bash
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U partyroom partyroom > backup-$(date +%F).sql
```

## TLS auto-renewal

certbot is already configured by mathtrainer's setup and renews via the
systemd `certbot.timer`. To check:

```bash
systemctl list-timers | grep certbot
sudo certbot certificates
```

## Updating the Google OAuth client

Google Cloud Console → APIs & Services → Credentials → `partyroom-web`:

- **Authorized JavaScript origins:** `http://localhost:3000`, `https://partyroom.musel.dev`
- **Authorized redirect URIs:** `http://localhost:3000/api/auth/callback/google`, `https://partyroom.musel.dev/api/auth/callback/google`

## Verifying

From a laptop:

```bash
curl -I https://partyroom.musel.dev
```

Expected: `HTTP/2 200`.

In a browser: open https://partyroom.musel.dev → click "Continue with Google" → sign in → home page renders. Create a room, share the link with a second browser, confirm play/pause sync.
