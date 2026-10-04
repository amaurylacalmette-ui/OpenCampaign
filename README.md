# OpenCampaign

Self-hosted email marketing: accounts, campaigns, audiences, automations, signup forms, open/click tracking and AI-assisted campaign review — in one Next.js app backed by SQLite.

## Features

- **Accounts** — multi-account with per-account workspaces: each account gets its own audience, campaigns, templates, automations, settings and AI keys. Sessions are DB-backed httpOnly cookies; passwords hashed with scrypt.
- **Campaigns** — HTML editor with live preview, personalization tokens (`{{first_name}}`, `{{company}}`, …), test sends, and a guided send flow with simulation mode.
- **Audience** — contacts with statuses (subscribed / pending / unsubscribed / cleaned), tags, search and filters, CSV import/export.
- **Automations** — signup- and tag-triggered emails with optional delay. A 60-second in-app heartbeat processes jobs; an external cron can drive it too.
- **Templates** — reusable HTML layouts with per-template preview, start campaigns from any of them.
- **Reports** — open/click rates per campaign and per contact, 30-day engagement timeline. No demo numbers: every metric reflects real activity on your account.
- **Signup forms** — embeddable form snippet with honeypot spam protection, optional double opt-in. The snippet carries your account id so signups land in the right workspace.
- **Tracking & compliance** — open pixel, click redirects, one-click unsubscribe page; an unsubscribe footer is appended automatically when missing.
- **AI review** — pre-send analysis of every campaign (see below).

No demo data ships with the app — workspaces start empty, so dashboards and reports only ever show your real numbers.

## Quickstart

Requires Node 20+ (or Bun 1.1+) and npm/bun.

```bash
git clone <your-repo-url> opencampaign
cd opencampaign
npm install            # or: bun install
cp .env.example .env   # set DATABASE_URL and APP_URL
npm run db:push        # create the SQLite schema
npm run dev            # http://localhost:3000
```

Open the app and **create the first account** — that workspace becomes yours. Add more accounts any time from the same screen (each gets a separate workspace).

Production build:

```bash
npm run build
npm run start:node     # or: npm run start (Bun)
```

## Environment variables

| Variable       | Purpose                                                            |
| -------------- | ------------------------------------------------------------------ |
| `DATABASE_URL` | SQLite file path, e.g. `file:./db/custom.db`                        |
| `APP_URL`      | Public base URL used in tracking links, pixels and unsubscribe URLs |

Everything else (SMTP credentials, AI keys) is configured in the app under **Settings** and stored in the database — no extra env vars needed.

## AI analysis

Open any campaign → **AI review** → *Analyze campaign*. Four interchangeable engines, all returning the same score / strengths / issues / suggestions / subject-ideas report. Keys are stored per account and can be tested from Settings → AI analysis:

| Provider     | Notes                                                                                                          |
| ------------ | -------------------------------------------------------------------------------------------------------------- |
| **Local**    | Built-in heuristics: subject quality, spam trigger words, caps/punctuation, image-to-text balance, link count, CTA verbs, personalization, unsubscribe compliance. No key, nothing leaves the server. |
| **OpenRouter** | Uses your key and **picks a free model automatically** — fetches the live model list, filters for $0/$0 pricing, prefers strong known free models, retries down the list. Caches for an hour. |
| **OpenAI**   | Chat Completions with JSON-mode output (gpt-4o-mini).                                                          |
| **PublikHQ** | Posts to a PublikHQ-compatible AI endpoint.                                                                    |

**PublikHQ endpoint contract**

```
POST {publikhqUrl}/api/v1/ai/analyze
Authorization: Bearer {apiKey}
{ "campaign": { "name", "subject", "previewText", "content", "fromName", "fromEmail" } }
```

Responses are parsed flexibly: a JSON object with `score` / `summary` / `strengths` / `issues` / `suggestions` / `subjectIdeas`, the same wrapped in `{ "data": … }`, a `{ "analysis" | "content" | "text": "…" }` string (JSON or prose), or raw prose — which is then merged with local scoring. When OpenCampaign itself is deployed on publikhq.com, set the endpoint to your own domain for fully self-hosted AI.

## Sending email

- **Simulation mode** (default): records recipients, tokens and tracking without delivering — safe for testing the whole pipeline.
- **Live SMTP**: fill in Settings → Delivery (host, port, user, password, TLS). Campaigns and automations then send real email through nodemailer. Test sends always render the exact final email (personalization + tracking + unsubscribe).

## Automations processing

The dashboard pings `POST /api/automations/process` every 60 s. For server-side processing independent of the UI, add a cron:

```bash
* * * * * curl -fsS -X POST https://your-domain.com/api/automations/process > /dev/null
```

## Deploying to publikhq.com

### Option A — Docker on a VPS (recommended)

1. Point DNS: an `A` record for `publikhq.com` (and `www`) at your server's IP.
2. On the server:

```bash
git clone <your-repo-url> opencampaign && cd opencampaign
APP_URL=https://publikhq.com docker compose up -d --build
```

Schema migration and server start happen automatically; SQLite persists in the `opencampaign-data` volume.

3. TLS + reverse proxy with Caddy:

```
# /etc/caddy/Caddyfile
publikhq.com, www.publikhq.com {
    reverse_proxy localhost:3000
}
```

```bash
sudo systemctl reload caddy
```

Caddy issues and renews certificates automatically. (Nginx + certbot works the same way: `proxy_pass http://127.0.0.1:3000;` with standard upgrade headers.)

### Option B — Node process (no Docker)

```bash
git clone <your-repo-url> opencampaign && cd opencampaign
npm install
cp .env.example .env          # DATABASE_URL=file:/var/lib/opencampaign/app.db  APP_URL=https://publikhq.com
npm run db:push
npm run build
npx pm2 start "npm run start:node" --name opencampaign
pm2 save && pm2 startup
```

Then reverse-proxy port 3000 as above.

### Option C — any Node hosting platform

Set these on the platform dashboard:

| Setting        | Value                                                        |
| -------------- | ------------------------------------------------------------ |
| Build command  | `npm install && npm run build`                                |
| Start command  | `npm run start:node`                                          |
| Env vars       | `DATABASE_URL` (persistent disk path!), `APP_URL=https://publikhq.com`, `NODE_ENV=production` |

SQLite needs a **persistent disk** mounted at the path in `DATABASE_URL`. On ephemeral filesystems use a hosted Postgres/MySQL by swapping the Prisma datasource in `prisma/schema.prisma`.

### Post-deploy checklist

- `APP_URL` set to `https://publikhq.com` (tracking links in emails must be absolute and public).
- Open `/settings`: sender defaults, SMTP credentials, AI provider + keys.
- Add the automations cron from the section above.
- Send yourself a test campaign and click through the unsubscribe link.

## Project structure

```
src/
  app/
    page.tsx                  # auth gate + single-page app shell (sidebar + views)
    api/                      # REST API + auth + tracking endpoints
      auth/{signup,signin,signout,me,password}
      campaigns/[id]/{send,test,analyze}
      contacts/{import,export}
      automations/process     # cron-friendly job processor
      track/{open,click,unsubscribe}/[token]
      signup                  # public form endpoint (routes by account id)
  components/oc/              # feature views (auth, dashboard, campaigns, audience, …)
  lib/
    ai/                       # local engine + openrouter + openai + publikhq
    auth.ts                   # scrypt hashing, sessions, per-account settings
    mail.ts                   # personalization, tracking rewrite, SMTP
    automations.ts            # enqueue + process due jobs
    csv.ts, oc-client.ts, db.ts
prisma/
  schema.prisma               # data model (User, Session, Campaign, Contact, …)
```

No seed script — accounts start empty on purpose.

## License

MIT — see [LICENSE](./LICENSE).
