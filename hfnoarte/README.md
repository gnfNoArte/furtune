# hfNoArte — Hunt for NoArte

A personal AI job-hunting agent. It finds jobs, freelance briefs and hiring posts from free, permitted sources, scores each one honestly against your real experience, prepares applications and messages, and tracks everything. **Nothing is ever submitted or sent by the app.** You approve each item, then apply or reply yourself.

Everything runs on free tiers: Supabase, Vercel Hobby, the Gemini or Groq free tier for AI (optional), free job APIs, and Telegram, email or WhatsApp notifications.

---

## What it does

| Area | What's built |
|---|---|
| **Accounts** | Email + password sign-up, login, logout, password reset (Supabase Auth). Every table is protected by Row Level Security, so each user only sees their own data. |
| **Profile** | Starts from NoArte's real background (or blank). Upload a PDF/DOCX resume → text is extracted → AI (or the keyword fallback) builds a structured profile you review, then **replace** or **merge**. Skills the AI returns that can't be found in the resume text are dropped. Everything stays editable. |
| **Preferences** | Jobs / freelance / social posts, internships, titles, keywords, exclusions, locations, remote/hybrid/on-site, minimum pay and currency, Adzuna country, source selection, company career boards. |
| **Discovery** | 13 independent source adapters (below). Every search expands into many related titles and natural phrases ("anyone know a good website designer?"). Each item is checked for intent (hiring vs. a freelancer advertising themselves), filtered, de-duplicated across sources (all links kept), scored and saved. Runs daily on a schedule or with **Search now**. |
| **Scoring** | Seven visible components (skills 35, experience & projects 20, level 15, location 10, type 10, pay 10). Keyword overlap alone can't produce a high score: engineering-focused roles are capped at *Stretch*, and roles outside your disciplines are capped. Each item is labelled *Strong / Reasonable / Stretch / Poor*, with reasons, gaps, level fit and "can you deliver it?". |
| **Credibility** | Evidence-based assessment (account age, karma/followers where public, specific details, contact route, scam patterns, repeated posting). Small or new accounts are never auto-rejected. |
| **Add by URL** | Paste any public job or post link. Reads schema.org JobPosting data or page text. Login walls and CAPTCHAs are **not** bypassed; you get manual entry instead. Private/internal addresses are refused. |
| **Application prep** | Cover letter, short intro, application answers and an experience summary for jobs; public comment, DM, freelance proposal, intro and portfolio pick for social and freelance posts. Written only from your profile; anything mentioning a technology you don't list is flagged. |
| **Review & Approve** | Every draft lands here. Edit, approve, reject, bulk-approve. **Enforced in the database**: drafts can only be approved from *Pending review*, editing an approved draft sends it back for review, `approved_at` can't be set by the browser, the scheduled job can't approve anything, and *Applied / Contacted / Interview / Won* are refused until you've approved. |
| **Tracker** | Kanban (Saved → Approved → Applied → Interview → Offer → Rejected) with drag-and-drop and a mobile "Move to" menu, plus a list view. Dates, notes, interview details, follow-up date, document links, activity log. |
| **Dashboard** | Stats, top 10 matches, recent finds, daily search activity per source, quick actions, empty states. |
| **Notifications** | Email (Resend), Telegram bot, WhatsApp (CallMeBot), plus an in-app inbox. Instant or daily digest, minimum match band, follow-up and interview reminders. Every alert has the original link, source, publisher, date, score, why it matches and what's missing. |
| **Transparency** | The **Sources** page shows each source as searched, limited, failed, needs a key or not integrated, with its last successful search, what was searched and any errors. Sample data is badged *SAMPLE · NOT REAL* everywhere, has no links and is never notified. |
| **Fallbacks** | No AI key → keyword matching, intent rules and templates, clearly labelled. No job API key → that source shows "Needs key"; sample data and manual entry keep the app usable. Resume parsing fails → manual profile editing. |

### Sources

| Source | Type | Access | Key |
|---|---|---|---|
| Adzuna | Jobs | Official API | Free developer key |
| Remotive | Remote jobs | Public API | — |
| Remote OK | Remote jobs | Public JSON feed | — |
| We Work Remotely | Remote jobs | Public RSS | — |
| Arbeitnow | Jobs (mostly EU) | Public API | — |
| Jobicy | Remote jobs | Public API | — |
| Himalayas | Remote jobs | Public API | — |
| Company career pages | Jobs | Greenhouse / Lever / Ashby public board APIs | — (list companies in Preferences) |
| Hacker News | Jobs + freelance posts | "Who is hiring?" and "Seeking freelancer?" comments via Algolia API | — |
| Reddit | Social + freelance | Official API, posts only (no comment search in the API) | Free "script" app |
| Bluesky | Social posts **and replies** | Official search API | Free account + app password |
| Mastodon | Social | Public hashtag timelines (limited) | — |
| Threads | Social | Official keyword search (full search needs Meta approval) | Free Meta app token |
| X, LinkedIn, Instagram, Upwork/Contra/Fiverr | — | **Not integrated**: no free, permitted search. Paste their links into *Add by URL*. | — |

Add a source by writing an adapter in `lib/sources/` (see `lib/sources/types.ts`) and listing it in `lib/sources/index.ts`.

---

## Architecture

```
app/                 Next.js App Router (pages, server actions, cron route)
  (auth)/            login, signup, reset-password
  (app)/             dashboard, opportunities, review, tracker, profile, preferences, sources, notifications
  actions/           server actions (all run as the signed-in user, RLS applies)
  api/cron/discover  scheduled discovery (CRON_SECRET-protected, service role)
components/          UI kit + app components (dark, violet design system)
lib/
  candidate/         seed profile, skill clusters, experience estimate
  matching/          explainable scoring, intent detection, credibility
  sources/           one adapter per platform
  discovery/         query planning + discovery engine
  ai/                OpenAI-compatible client (Gemini/Groq/OpenAI), honesty rules
  resume/            PDF/DOCX text extraction + profile extraction
  drafts/            application/message generation + safety guard
  notify/            email, Telegram, WhatsApp + digest/reminder logic
supabase/migrations  schema, approval rules, RLS, storage
supabase/tests       database tests for approval rules and RLS
tests/               unit tests (scoring, intent, credibility, dedupe, adapters, drafts, URL import)
```

Secrets are only read on the server (`server-only` modules). Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` reach the browser; they're safe to expose because RLS protects every table.

**Why Gemini/Groq instead of OpenAI by default:** OpenAI's API has no free tier. The AI client speaks the OpenAI-compatible chat API, so you can still set `AI_PROVIDER=openai` with your key.

---

## Setup (local)

Requirements: Node 20+ and a free Supabase project.

1. **Install**
   ```bash
   cd hfnoarte
   npm install
   cp .env.example .env.local
   ```
2. **Create the database.** Open your Supabase project → SQL Editor, and run each file in `supabase/migrations/` in order (`0001` → `0004`). Or, with the Supabase CLI: `supabase link` then `supabase db push`.
3. **Auth settings.** Supabase → Authentication → URL Configuration: set *Site URL* to your app URL and add `http://localhost:3000/**` (and your production URL) to *Redirect URLs*.
4. **Fill `.env.local`.** At minimum: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`. Add free keys as you go (see `.env.example`):
   - **AI**: a Gemini key from aistudio.google.com/apikey (`AI_PROVIDER=gemini`, `AI_API_KEY=…`) or Groq (`AI_PROVIDER=groq`).
   - **Adzuna**: developer.adzuna.com.
   - **Reddit**: reddit.com/prefs/apps → "script" app.
   - **Bluesky**: Settings → App passwords.
   - **Telegram**: create a bot with @BotFather → `TELEGRAM_BOT_TOKEN`; each user enters their chat ID in Notifications.
   - **Email**: resend.com → `RESEND_API_KEY`.
5. **Run**
   ```bash
   npm run dev        # http://localhost:3000
   ```
   Sign up, choose *Use this profile* (or upload your resume), check Preferences, then **Search now**.

### Tests

```bash
npm test            # 41 unit tests: scoring, intent, credibility, dedupe, adapters (mocked), drafts, URL import
npm run typecheck
npm run test:db     # applies all migrations to a throwaway Postgres and tests approval rules + RLS
```

`test:db` needs Postgres 15+ binaries (`initdb`, `pg_ctl`, `psql`) on your machine.

---

## Deploy (Vercel Hobby, free)

1. Push the repo to GitHub and import it in Vercel. Set **Root Directory** to `hfnoarte`.
2. Add every variable from `.env.local` in *Project → Settings → Environment Variables*. Set `APP_URL` to your Vercel URL.
3. Deploy. `vercel.json` registers a daily cron (`/api/cron/discover`, 07:17 UTC). Vercel sends `CRON_SECRET` automatically.
4. Add your production URL to Supabase's *Redirect URLs*.

**More frequent searches (optional, free):** Vercel Hobby crons run at most once a day. To search every 4 hours, copy `hfnoarte/.github/workflows/hfnoarte-discovery.yml` into the repository root's `.github/workflows/` folder and add two repository secrets: `HFNOARTE_URL` and `HFNOARTE_CRON_SECRET`.

Manual trigger: `curl -H "Authorization: Bearer $CRON_SECRET" https://your-app.vercel.app/api/cron/discover`

---

## Known limits (honest list)

- **X, LinkedIn, Instagram and the big freelance marketplaces aren't searched.** None of them offers a free, permitted search. Paste links from them into *Add by URL*. LinkedIn and Instagram pages often need a login, so you'll usually enter those details by hand.
- **Reddit comments** aren't searchable through Reddit's API; posts are. **Bluesky** search does include replies.
- **Threads** keyword search only returns other people's posts after Meta approves `threads_keyword_search` for your app.
- **Mastodon** only sees hashtag timelines on one server.
- **AI free tiers are rate-limited**, so each run AI-analyses up to `AI_ANALYSIS_LIMIT` (default 12) of the most promising new items; the rest use keyword scoring and are labelled as such.
- **"Still open?"** is usually unknown; old untouched items are marked *Expired* after 45 days.
- **Resend without a verified domain** only delivers to your own Resend account email (fine for a personal tool).
- **WhatsApp** uses CallMeBot, a free third-party service for personal alerts, not an official WhatsApp API.
