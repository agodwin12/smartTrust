# Deploying Smart Market

Target: one Linux VPS (Ubuntu 22.04/24.04, 2 vCPU / 4 GB is enough to start) running
Docker Compose, with PostgreSQL installed on the host (the project's standing decision:
only the backend and frontend are containerised). Caddy in the stack terminates HTTPS with
automatic Let's Encrypt certificates, so no nginx/certbot work is needed.

Everything below assumes the domain is `smartmarket.example`; replace it everywhere.

## 1. DNS (do this first)

Create `A` (and `AAAA` if you have IPv6) records for `smartmarket.example` and
`www.smartmarket.example` pointing at the server. Caddy requests the certificate on first
start and will keep failing (and retrying) until the records resolve.

## 2. Server preparation

```bash
# Docker Engine + Compose plugin
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker

# PostgreSQL on the host
sudo apt install -y postgresql
sudo -u postgres psql -c "CREATE ROLE smartmarket LOGIN PASSWORD 'CHANGE_ME';"
sudo -u postgres psql -c "CREATE DATABASE smart_market OWNER smartmarket;"
```

Let the containers reach Postgres (they arrive from the Docker bridge network):

```bash
# /etc/postgresql/16/main/postgresql.conf
listen_addresses = 'localhost,172.17.0.1'
# /etc/postgresql/16/main/pg_hba.conf  (append)
host  smart_market  smartmarket  172.16.0.0/12  scram-sha-256
sudo systemctl restart postgresql
```

Open only ports 22, 80 and 443 in the firewall (`ufw allow 22,80,443/tcp`).

## 3. Configuration

```bash
git clone <repo> /opt/smart_market && cd /opt/smart_market
cp deploy/compose.env.example .env            # DOMAIN, ACME_EMAIL, DOCKER_DATABASE_URL
cp deploy/backend.env.example backend/.env    # secrets + provider keys
```

Fill every `CHANGE_ME`. The frontend needs no env file: its public URLs are derived from
`DOMAIN` at image build time, and the server-side API address is set by compose.

Third-party dashboards need the production URLs:

| Provider | Setting | Value |
|---|---|---|
| K-Pay | Webhook URL | `https://smartmarket.example/api/payments/webhooks/kpay` |
| Google Cloud | Authorized redirect URI | `https://smartmarket.example/api/auth/google/callback` |
| Resend | Verified sender domain | the domain used in `RESEND_FROM_EMAIL` |
| Cloudflare R2 | Public bucket URL | `CLOUDFLARE_R2_PUBLIC_URL` (also whitelisted in `frontend/next.config.ts` `images.remotePatterns`) |

## 4. First start

```bash
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
docker compose -f docker-compose.prod.yml logs -f caddy   # wait for "certificate obtained"
curl -s https://smartmarket.example/api/health            # {"status":"ok",...}
curl -s https://smartmarket.example/healthz               # frontend liveness
```

The backend container runs `prisma migrate deploy` on every start, so the schema is
created/updated automatically. Seed the catalogue once if you want demo data:

```bash
docker compose -f docker-compose.prod.yml exec backend node prisma/seed.js
```

Create the first super admin by registering normally on the site, then promoting the
account from psql: `UPDATE users SET role = 'SUPER_ADMIN' WHERE email = '...';`

## 5. Updating

```bash
cd /opt/smart_market && git pull
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
docker image prune -f
```

Zero-downtime is not needed at this stage; a rebuild restarts each container in a few
seconds. Rate-limit counters, caches and job locks live in Redis and survive restarts.

## 6. Backups and logs

```bash
# nightly dump kept 14 days (add to crontab: 0 3 * * *)
pg_dump -U smartmarket smart_market | gzip > /var/backups/smart_market-$(date +%F).sql.gz
find /var/backups -name 'smart_market-*.sql.gz' -mtime +14 -delete
```

Container logs are JSON (`docker compose logs backend`), capped at 5 × 20 MB per service.
Every API error response carries a `requestId` that matches its log line. Set `SENTRY_DSN`
to get error tracking.

## 7. Scaling later

The API is stateless (Redis holds sessions' rate limits, caches and job locks), so more
throughput = `docker compose up -d --scale backend=3` behind Caddy plus a bigger
`DB_POOL_MAX × replicas` budget in Postgres. Set `JOBS_ENABLED=false` on all but one
replica if you want the housekeeping jobs to run from a single place (they are already
lock-protected, so this is optional).

## Google OAuth client (Sign in with Google)

1. Go to https://console.cloud.google.com and sign in with the Google account that should own the credentials (a company account, not a personal one).
2. Create a project: top bar project picker → **New project** → name it `Smart Market` → **Create**, then select it.
3. Configure the consent screen: left menu **APIs & Services → OAuth consent screen** (Google now calls this **Google Auth Platform → Branding/Audience**). Choose **External**, fill App name `Smart Market`, user support email, the app logo (optional), **Authorized domains** = your domain (e.g. `smartmarket.example`), developer contact email → Save.
4. Scopes: add only `openid`, `email` and `profile` (these are non-sensitive; no verification review is needed).
5. Audience / publishing: while testing, add the Google accounts you will log in with as **Test users**. Before launch click **Publish app** so any Google user can sign in.
6. Create the client: **APIs & Services → Credentials → Create credentials → OAuth client ID** → Application type **Web application** → name `Smart Market web`.
   - **Authorized JavaScript origins**: `https://smartmarket.example` (and `http://localhost:3020` for local development).
   - **Authorized redirect URIs**: `https://smartmarket.example/api/auth/google/callback` (and `http://localhost:5000/api/auth/google/callback` for local development). The value must match `GOOGLE_REDIRECT_URI` character for character.
7. Click **Create** and copy the **Client ID** and **Client secret** into `backend/.env`:
   `GOOGLE_CLIENT_ID=…`, `GOOGLE_CLIENT_SECRET=…`, `GOOGLE_REDIRECT_URI=https://smartmarket.example/api/auth/google/callback`, then restart the backend.
8. Test: open the site → **Continue with Google** → you should land back on the site signed in; the backend logs `login` with `provider: google` in the audit log. A `redirect_uri_mismatch` error means step 6 and `GOOGLE_REDIRECT_URI` differ.

