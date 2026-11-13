-- hfNoArte — core schema
-- Every user-owned table carries user_id and is protected by Row Level Security,
-- so one account can never read or change another account's data.

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────
-- Enumerations
-- ─────────────────────────────────────────────────────────────
create type public.opportunity_kind as enum ('employment', 'freelance', 'social');

create type public.opportunity_status as enum (
  'new', 'saved', 'reviewing', 'interested', 'message_prepared',
  'contacted', 'applied', 'follow_up', 'interview', 'won', 'rejected', 'expired'
);

create type public.review_state as enum ('draft', 'pending_review', 'approved', 'rejected');

create type public.draft_kind as enum (
  'cover_letter', 'intro', 'qa', 'experience_summary',
  'comment', 'dm', 'proposal', 'portfolio_pick'
);

create type public.source_status as enum (
  'ok', 'limited', 'failed', 'not_configured', 'not_integrated', 'skipped'
);

-- ─────────────────────────────────────────────────────────────
-- Helpers
-- ─────────────────────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ─────────────────────────────────────────────────────────────
-- Accounts
-- ─────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Structured candidate profile. Lists are JSON so the whole profile can be
-- edited and saved in one go from the profile editor.
create table public.candidate_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  headline text,
  summary text,
  experience_level text,              -- e.g. 'junior' | 'mid' | 'senior' (candidate-confirmed)
  skills jsonb not null default '[]'::jsonb,       -- [{name, category, evidence}]
  experiences jsonb not null default '[]'::jsonb,  -- [{title, organization, kind, start, end, description}]
  projects jsonb not null default '[]'::jsonb,     -- [{name, kind, roles, skills, description, url}]
  education jsonb not null default '[]'::jsonb,    -- [{institution, qualification, start, end}]
  suggested_titles text[] not null default '{}',
  portfolio_url text,
  writing_style text,                 -- optional notes on how the candidate likes to sound
  origin text not null default 'manual' check (origin in ('seed', 'resume', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  extracted_text text,
  parse_status text not null default 'uploaded'
    check (parse_status in ('uploaded', 'parsed', 'failed')),
  parse_mode text check (parse_mode in ('ai', 'keyword')),
  parse_error text,
  extraction jsonb,                   -- raw structured result shown for review before saving
  created_at timestamptz not null default now()
);

create table public.preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  opportunity_kinds text[] not null default '{employment,freelance,social}',
  include_internships boolean not null default true,
  target_titles text[] not null default '{}',
  keywords text[] not null default '{}',
  excluded_keywords text[] not null default '{}',
  locations text[] not null default '{}',
  work_arrangements text[] not null default '{remote}',
  employment_types text[] not null default '{full_time,part_time,contract,internship}',
  min_salary numeric,
  currency text not null default 'USD',
  adzuna_country text not null default 'gb',
  enabled_sources text[],             -- null = every available source
  company_boards text[] not null default '{}', -- e.g. 'greenhouse:acme', 'lever:acme', 'ashby:acme'
  daily_discovery boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.notification_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  frequency text not null default 'instant' check (frequency in ('instant', 'daily', 'off')),
  min_band text not null default 'reasonable' check (min_band in ('strong', 'reasonable', 'stretch')),
  email_enabled boolean not null default false,
  email_address text,
  telegram_enabled boolean not null default false,
  telegram_chat_id text,
  whatsapp_enabled boolean not null default false,
  whatsapp_phone text,
  whatsapp_apikey text,               -- CallMeBot personal key (free); readable only by its owner
  reminders_enabled boolean not null default true,
  last_digest_at timestamptz,
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Opportunities
-- ─────────────────────────────────────────────────────────────
create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  fingerprint text not null,          -- dedupe key, unique per user
  kind public.opportunity_kind not null,
  title text not null,
  description text,
  company text,
  publisher text,                     -- account / poster / employer that published it
  publisher_url text,
  location text,
  work_arrangement text check (work_arrangement in ('remote', 'onsite', 'hybrid')),
  employment_type text,               -- full_time | part_time | contract | internship | freelance | graduate
  salary_text text,
  salary_min numeric,
  salary_max numeric,
  currency text,
  skills text[] not null default '{}',
  contact_instructions text,
  published_at timestamptz,           -- null when the source did not say
  discovered_at timestamptz not null default now(),
  is_active boolean,                  -- null = unknown
  activity_note text,
  is_sample boolean not null default false,
  origin text not null default 'discovery' check (origin in ('discovery', 'url', 'manual', 'sample')),
  status public.opportunity_status not null default 'new',
  notes text,
  follow_up_date date,
  interview_at timestamptz,
  interview_notes text,
  documents jsonb not null default '[]'::jsonb,   -- [{label, url}]
  match jsonb,                        -- explainable score (see lib/matching)
  match_score int,
  match_band text check (match_band in ('strong', 'reasonable', 'stretch', 'poor')),
  credibility jsonb,                  -- {level, evidence[]}
  intent jsonb,                       -- {label, confidence, mode}
  analysis_mode text check (analysis_mode in ('ai', 'keyword')),
  approved_at timestamptz,            -- set only through the approval flow
  applied_at timestamptz,
  contacted_at timestamptz,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, fingerprint)
);
create index opportunities_user_status_idx on public.opportunities (user_id, status);
create index opportunities_user_score_idx on public.opportunities (user_id, match_score desc nulls last);

-- Every place an opportunity was seen. Cross-posted vacancies keep all links.
create table public.opportunity_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  source text not null,               -- adapter id, e.g. 'adzuna', 'reddit', 'url', 'manual'
  url text,
  external_id text,
  author text,
  author_url text,
  published_at timestamptz,
  access_method text,                 -- how we got it, e.g. 'Official API', 'Public RSS feed'
  created_at timestamptz not null default now()
);
create unique index opportunity_links_user_url_idx on public.opportunity_links (user_id, url) where url is not null;
create index opportunity_links_opp_idx on public.opportunity_links (opportunity_id);

-- Prepared application material and outgoing messages.
create table public.drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  kind public.draft_kind not null,
  title text not null,
  content text not null default '',
  review_state public.review_state not null default 'draft',
  generated_mode text check (generated_mode in ('ai', 'template', 'manual')),
  warnings text[] not null default '{}',
  approved_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index drafts_user_state_idx on public.drafts (user_id, review_state);
create index drafts_opp_idx on public.drafts (opportunity_id);

-- Activity log for opportunities (status changes, approvals, notes).
create table public.opportunity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  event text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index opportunity_events_opp_idx on public.opportunity_events (opportunity_id, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- Discovery transparency
-- ─────────────────────────────────────────────────────────────
create table public.discovery_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  trigger text not null check (trigger in ('cron', 'manual')),
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  found int not null default 0,
  new_count int not null default 0,
  merged_count int not null default 0,
  analysis_mode text,
  error text
);
create index discovery_runs_user_idx on public.discovery_runs (user_id, started_at desc);

create table public.source_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  run_id uuid references public.discovery_runs (id) on delete cascade,
  source text not null,
  status public.source_status not null,
  queries text[] not null default '{}',
  found int not null default 0,
  kept int not null default 0,
  message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index source_runs_user_source_idx on public.source_runs (user_id, source, started_at desc);

-- ─────────────────────────────────────────────────────────────
-- Notifications
-- ─────────────────────────────────────────────────────────────
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  opportunity_id uuid references public.opportunities (id) on delete set null,
  kind text not null check (kind in ('new_match', 'digest', 'follow_up', 'interview', 'status', 'system')),
  title text not null,
  body text,
  link text,
  channels jsonb not null default '{}'::jsonb,   -- {email:'sent'|'failed: …', telegram:…, whatsapp:…}
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- updated_at triggers
-- ─────────────────────────────────────────────────────────────
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger candidate_profiles_touch before update on public.candidate_profiles for each row execute function public.touch_updated_at();
create trigger preferences_touch before update on public.preferences for each row execute function public.touch_updated_at();
create trigger notification_settings_touch before update on public.notification_settings for each row execute function public.touch_updated_at();
create trigger opportunities_touch before update on public.opportunities for each row execute function public.touch_updated_at();
create trigger drafts_touch before update on public.drafts for each row execute function public.touch_updated_at();

-- New account → profile, preferences and notification rows.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
    values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  insert into public.preferences (user_id) values (new.id);
  insert into public.notification_settings (user_id, email_address) values (new.id, new.email);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
