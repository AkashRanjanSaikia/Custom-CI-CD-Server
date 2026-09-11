# Custom CI/CD Server

A self-hosted CI/CD server that listens for GitHub push webhooks and automatically deploys the affected project — locally or over SSH to a remote server — with health checks and automatic rollback if a deployment goes bad.

## How it works

1. Push to GitHub → webhook fires → signature verified → project matched by repo + branch
2. Code is pulled, dependencies installed (only if `package.json`/lock changed), built, and deployed (e.g. `pm2 restart`, `aws s3 sync`)
3. A health check confirms the app is actually working
4. ✅ Healthy → GitHub shows success, this commit is saved as "last known good"
5. ❌ Unhealthy → automatically rolls back to the last known good commit, GitHub shows failure, and a failure email is sent

## Setup

```bash
git clone https://github.com/AkashRanjanSaikia/Custom-CI-CD-Server.git
cd Custom-CI-CD-Server
npm install
```

### 1. Create `.env`

```env
PORT=4000
NODE_ENV=production
GITHUB_WEBHOOK_SECRET=your_webhook_secret
GITHUB_TOKEN=your_github_token         # needs "Commit statuses: read and write"
SERVER_URL=https://your-public-url.com

# SMTP credentials used to send failure notification emails

SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_16_char_app_password
```

### 2. Create `config.json`

Copy `config.example.json` → `config.json` and edit it for your projects. It has one example for a **local** deployment and one for a **remote** (SSH) deployment — covers all supported fields, just fill in your own values.

> The target project must already be `git clone`d at the `cwd` path — this server only pulls, it doesn't clone for you.

### 3. Run it

```bash
node app.js
# or in production:
pm2 start app.js --name cicd-server
```

### 4. Expose it to GitHub

For quick testing:

```bash
cloudflared tunnel --url http://localhost:4000
```

Put the resulting URL in `SERVER_URL`. For real use, run this server somewhere with a stable domain/IP instead.

### 5. Register the webhook

Repo → **Settings → Webhooks → Add webhook**

- Payload URL: `https://your-server-url.com/webhook/github`
- Content type: `application/json`
- Secret: same as `GITHUB_WEBHOOK_SECRET`
- Events: just the push event

## Notifications

If a deployment fails (a command errors, or the health check fails and rollback kicks in), a failure email is sent automatically .

- **SMTP server credentials** (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`) live in `.env`, since they're shared across all projects.
- **Who receives the email** is set per project, via `notifyEmail` in `config.json`. This lets different projects notify different people (or teams) without touching `.env`. If a project has no `notifyEmail` set, no failure email is sent for it.

```json
{
  "name": "my-node-api",
  "notifyEmail": "you@example.com",
}
```

The email includes the project name, the failing commit, the error message, and a link to that run's details.

## Endpoints

- `GET /health` — server liveness check
- `POST /webhook/github` — GitHub calls this automatically, don't call it yourself
- `GET /runs/:deploymentId` — status of a specific deploy, keyed by commit SHA (this is what GitHub's "Details" link opens)

## If deploying remotely (SSH) and using nvm

Non-interactive SSH sessions don't source `.bashrc`, so nvm-installed `node`/`npm`/`pm2` may not be found. Fix once on the remote server:

```bash
sudo nano /etc/environment
```

Add your nvm bin path to the `PATH` line, e.g.:

```
PATH="/home/ubuntu/.nvm/versions/node/vX.X.X/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
```

