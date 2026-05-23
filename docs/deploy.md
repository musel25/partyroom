# VPS bootstrap & deployment

## Prereqs

- OCI instance with public IP (or any cloud VPS)
- SSH access as the default user (`opc` on Oracle Linux, `ubuntu` on Ubuntu)
- Ports 80 and 443 open in the VPS security list / firewall
- A GitHub PAT with `read:packages` if the GHCR image becomes private (it's public by default)

## One-time bootstrap

1. **SSH in:**
   ```bash
   ssh <user>@<vps-ip>
   ```

2. **Install Docker:**
   ```bash
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker $USER
   exit  # log out and back in so the group change takes effect
   ```
   After reconnecting, verify: `docker ps`.

3. **Create the app directory:**
   ```bash
   sudo mkdir -p /opt/partyroom
   sudo chown $USER:$USER /opt/partyroom
   cd /opt/partyroom
   ```

4. **Pull only the deploy files (image comes from GHCR):**
   ```bash
   curl -O https://raw.githubusercontent.com/musel25/partyroom/main/docker-compose.prod.yml
   curl -O https://raw.githubusercontent.com/musel25/partyroom/main/Caddyfile
   curl -O https://raw.githubusercontent.com/musel25/partyroom/main/.env.prod.example
   mv .env.prod.example .env.prod
   ```

5. **Edit `.env.prod`:**
   - `NEXTAUTH_SECRET`: `openssl rand -base64 32`
   - `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`: from Google Cloud Console
   - `POSTGRES_PASSWORD`: a strong random value (mirror it in `DATABASE_URL`)

6. **DNS — point `partyroom.musel.dev` at the VPS:**
   On Vercel (where `musel.dev` is registered): Dashboard → Domains → `musel.dev` → DNS records → Add record:
   - Type: `A`
   - Name: `partyroom`
   - Value: `<vps-public-ip>`
   - TTL: 60

   Verify: `dig partyroom.musel.dev` should return the VPS IP after a minute or two.

7. **First boot:**
   ```bash
   docker compose -f docker-compose.prod.yml up -d
   ```

8. **Run the initial migration:**
   ```bash
   docker compose -f docker-compose.prod.yml exec app npx prisma migrate deploy
   ```

9. **Visit https://partyroom.musel.dev** — Caddy provisions the TLS cert on first request. May take ~30 seconds the very first time.

## GitHub Actions secrets

On https://github.com/musel25/partyroom/settings/secrets/actions add:

- `VPS_HOST` — public IP or DNS name of the VPS
- `VPS_USER` — `opc` (Oracle Linux) or `ubuntu` (Ubuntu image)
- `VPS_SSH_KEY` — contents of a private SSH key whose public counterpart is in `~/.ssh/authorized_keys` on the VPS

Generate a deploy key (locally):
```bash
ssh-keygen -t ed25519 -f ~/.ssh/partyroom_deploy -N ""
cat ~/.ssh/partyroom_deploy.pub  # paste into the VPS's ~/.ssh/authorized_keys
cat ~/.ssh/partyroom_deploy      # paste contents into VPS_SSH_KEY secret
```

## CI/CD flow

- **Every PR + push to main:** runs `.github/workflows/ci.yml` (lint, typecheck, tests).
- **Push to main:** runs `.github/workflows/deploy.yml`:
  1. Builds a Docker image, tags it `latest` + `<sha>`, pushes to GHCR
  2. SSHes into VPS, pulls the new image, restarts the `app` container, runs migrations

## Operational notes

- **Restart the stack:** `docker compose -f docker-compose.prod.yml restart`
- **View live logs:** `docker compose -f docker-compose.prod.yml logs -f app`
- **Re-run migrations after a schema change:** the deploy workflow runs them automatically; manual: `docker compose -f docker-compose.prod.yml exec app npx prisma migrate deploy`
- **Database backup:** `docker compose -f docker-compose.prod.yml exec postgres pg_dump -U partyroom partyroom > backup.sql`

## Verifying

From the VPS:
```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f app
```

From a laptop:
```bash
curl -I https://partyroom.musel.dev
```

Expected: `HTTP/2 200`.

## Updating the OAuth redirect URIs

Make sure the Google OAuth client has these authorized redirect URIs:
- `http://localhost:3000/api/auth/callback/google`
- `https://partyroom.musel.dev/api/auth/callback/google`

And these authorized JavaScript origins:
- `http://localhost:3000`
- `https://partyroom.musel.dev`
