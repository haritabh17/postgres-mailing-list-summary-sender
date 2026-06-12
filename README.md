# PostgreSQL Hackers Digest

[![Live Site](https://img.shields.io/badge/live-postgreshackersdigest.dev-blue)](https://www.postgreshackersdigest.dev)
[![CI](https://github.com/haritabh17/postgres-mailing-list-summary-sender/actions/workflows/deploy-beta.yml/badge.svg)](https://github.com/haritabh17/postgres-mailing-list-summary-sender/actions/workflows/deploy-beta.yml)
[![License](https://img.shields.io/badge/license-Apache%202.0-green)](LICENSE)

Weekly summaries of the PostgreSQL hackers mailing list, generated with AI and delivered to your inbox every Friday.

The pgsql-hackers list gets 500-700+ posts per week. Nobody has time to read all of that. This project scrapes the archives, summarizes the week's most active discussions using OpenAI, tags them with commitfest categories, and emails subscribers a nicely formatted digest.

## How it works

Every week, a 4-step pipeline runs automatically via Supabase cron jobs:

1. **Fetch threads** — scrapes thread URLs from postgresql.org archives (last 7 days)
2. **Fetch content** — downloads the full email content for each thread
3. **Generate summary** — sends the content to OpenAI gpt-4o-mini, which summarizes the most active discussions at three depth levels and assigns tags
4. **Send emails** — delivers the summary to all confirmed subscribers via Resend every Friday at 10:00 UTC

The whole thing runs serverless on Supabase Edge Functions. No servers to maintain.

## Tech stack

- **Frontend**: React + TypeScript + Tailwind CSS (Vite), dark-first design
- **Backend**: Supabase (PostgreSQL + Edge Functions + Cron)
- **AI**: OpenAI gpt-4o-mini with structured JSON outputs
- **Email**: Resend
- **Hosting**: Vercel (with RSS/sitemap/OG API routes)
- **CI/CD**: GitHub Actions → Vercel (beta on `main`, production on `production` branch)

## Features

- **Multi-level summaries**: Brief, Detailed, and Deep dive for each discussion
- **Commitfest tags**: Auto-tagged with commitfest categories and AI-generated tags
- **Archive search**: Full-text search across all weekly summaries
- **RSS feed**: `/rss.xml` for feed readers
- **SEO**: Per-summary OG images, sitemap, JSON-LD structured data
- **Dark mode**: System-aware dark/light theme toggle

## Self-hosting

1. Create a [Supabase](https://supabase.com) project
2. Apply the migrations: `supabase db push`
3. Deploy the edge functions: `supabase functions deploy`
4. Set up the required secrets in your Supabase dashboard:
   - `OPENAI_API_KEY`
   - `RESEND_API_KEY`
   - `UNSUBSCRIBE_HMAC_SECRET` (≥32 chars)
   - `ADMIN_ALERT_EMAIL` (optional, for pipeline failure alerts)
5. Set the service role key in the database:
   ```sql
   SELECT set_app_secret('supabase_service_role_key', '<your-service-role-jwt>', 'Cron HTTP bearer');
   ```
6. Copy `env.example` to `frontend/.env.local` and fill in your Supabase URL + anon key
7. Deploy the frontend wherever you like (`cd frontend && npm run build`)

The cron jobs are configured in the database migrations and will start running automatically.

## Development

```bash
cd frontend
npm install
npm run dev    # starts on http://localhost:5173
```

## Contributing

PRs welcome. Fork it, make a branch, open a PR.

## License

Apache 2.0 — see [LICENSE](LICENSE)
