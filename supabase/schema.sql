-- ============================================================
-- Lens — UX Research Repository · Supabase schema (multi-tenant)
--
-- Run this once in the Supabase dashboard → SQL Editor.
-- Design notes:
--  · MULTI-TENANT: every content row belongs to one account; RLS
--    seals accounts off from each other (docs/phase-1-multi-tenancy.md).
--  · text primary keys so the app's existing ids (pt-lukas, in-…)
--    keep working unchanged.
--  · many-to-many id lists are text[] columns (matching the app's
--    data shapes); a later pass can normalize to join tables
--    without touching the UI.
--  · nested structures (research questions, attachments, board
--    cards, transcript segments) are jsonb.
--  · Row Level Security mirrors lib/permissions.ts within an account:
--      - signed-in users read their own account's rows
--      - admins + researchers manage their account's content
--      - only admins manage their account's profiles
-- ============================================================

-- ---------- accounts (tenants) ----------
create table if not exists public.accounts (
  id         text primary key,
  name       text not null,
  plan       text not null default 'team'
             check (plan in ('starter','team','business')),
  status     text not null default 'active'
             check (status in ('active','suspended')),
  seat_limit int,  -- per-account override; null = use the plan's default seat cap
  trial_ends_at timestamptz,  -- null = not on a trial (paying/converted); else access ends at this time
  created_at timestamptz not null default now()
);

-- The seed data ships as Account #1.
insert into public.accounts (id, name, plan)
  values ('acc_northwind', 'Northwind', 'business')
  on conflict (id) do nothing;

-- ---------- demo_visits (platform analytics, cloud only) ----------
-- One row per "Explore the demo" start. Written by /api/demo-visit and read by
-- the owner /admin console, both via the service role. RLS on with no policies,
-- so anon/authenticated clients can neither read nor write it directly.
create table if not exists public.demo_visits (
  id         bigint generated always as identity primary key,
  referrer   text,
  created_at timestamptz not null default now()
);
alter table public.demo_visits enable row level security;
create index if not exists demo_visits_created_at_idx on public.demo_visits (created_at);

-- ---------- profiles (team accounts) ----------
create table if not exists public.profiles (
  id           text primary key,
  account_id   text not null references public.accounts(id) on delete cascade,
  auth_id      uuid unique references auth.users(id) on delete set null,
  name         text not null,
  email        text not null unique,
  role         text not null default 'viewer'
               check (role in ('admin','researcher','designer','product-owner','viewer')),
  job_title    text not null default '',
  avatar_color text,
  ai_enabled   boolean not null default true,  -- per-member AI access (admin-controlled)
  preferences  jsonb not null default '{}'::jsonb,  -- personal per-user settings
  -- Coarse activity stamp for the owner console (~1 write/day per member).
  -- Distinct from auth.users.last_sign_in_at, which only moves on a *new*
  -- sign-in and so makes a long-lived session look dormant.
  last_seen_at timestamptz,
  created_at   timestamptz not null default now()
);

-- ---------- taxonomy ----------
create table if not exists public.companies (
  id          text primary key,
  name        text not null,
  industry    text not null default '—',
  -- NULL when unknown: never guessed at creation (see the participant form).
  size        text,
  country     text not null default '—',
  logo_accent text
);

create table if not exists public.personas (
  id          text primary key,
  name        text not null,
  description text not null default '',
  accent      text not null default 'blue',
  icon        text not null default 'User'
);

create table if not exists public.tags (
  id     text primary key,
  label  text not null,
  kind   text not null check (kind in ('behaviour','pain-point','general')),
  accent text not null default 'slate'
);

create table if not exists public.themes (
  id          text primary key,
  name        text not null,
  description text not null default '',
  accent      text not null default 'blue'
);

-- ---------- participants ----------
create table if not exists public.participants (
  id                    text primary key,
  first_name            text not null,
  last_name             text not null,
  email                 text not null,
  phone                 text,
  avatar_color          text,
  company_id            text references public.companies(id) on delete set null,
  department            text not null default '—',
  job_title             text not null default '—',
  country               text not null default '—',
  language              text not null default 'English',
  timezone              text not null default 'CET',
  industry              text not null default '—',
  company_size          text,  -- NULL when unknown
  years_experience      int  not null default 0,
  seniority             text not null default 'mid',
  responsibilities      text[] not null default '{}',
  daily_tasks           text[] not null default '{}',
  decision_influence    text not null default 'medium',
  technical_proficiency text not null default 'intermediate',
  digital_maturity      text not null default 'intermediate',
  products_used         text[] not null default '{}',
  modules_used          text[] not null default '{}',
  frequency             text not null default 'weekly',
  device                text not null default 'desktop',
  usage_level           text not null default 'intermediate',
  persona_ids           text[] not null default '{}',
  behaviour_tag_ids     text[] not null default '{}',
  pain_point_tag_ids    text[] not null default '{}',
  consent_status        text not null default 'pending',
  nda_signed            boolean not null default false,
  recording_permission  boolean not null default false,
  preferred_language    text not null default 'English',
  last_interview_date   date,
  interview_count       int not null default 0,
  availability          text not null default 'Flexible',
  recruitment_status    text not null default 'available',
  scheduled_session     jsonb,
  notes                 text,
  created_at            timestamptz not null default now()
);
create index if not exists participants_persona_ids_idx on public.participants using gin (persona_ids);
create index if not exists participants_company_idx on public.participants (company_id);

-- ---------- projects ----------
create table if not exists public.projects (
  id                 text primary key,
  name               text not null,
  description        text not null default '',
  objective          text not null default '',
  product_area       text not null default 'Platform',
  status             text not null default 'planning',
  start_date         date,
  end_date           date,
  owner_id           text references public.profiles(id) on delete set null,
  member_ids         text[] not null default '{}',
  participant_ids    text[] not null default '{}',
  research_questions jsonb not null default '[]',
  success_criteria   text[] not null default '{}',
  methodology        text not null default 'Interviews',
  ai_summary         text not null default '',  -- persisted AI executive summary
  created_at         timestamptz not null default now()
);

-- ---------- interviews ----------
create table if not exists public.interviews (
  id               text primary key,
  title            text not null,
  status           text,
  date             date not null,
  researcher_id    text references public.profiles(id) on delete set null,
  participant_id   text not null references public.participants(id) on delete cascade,
  project_ids      text[] not null default '{}',
  duration_minutes int not null default 30,
  meeting_link     text,
  has_recording    boolean not null default false,
  sentiment        text not null default 'neutral',
  ai_summary       text not null default '',
  key_observations text[] not null default '{}',
  insight_ids      text[] not null default '{}',
  attachments      jsonb not null default '[]',
  follow_ups       jsonb not null default '[]',
  transcript_id    text,
  notes            text not null default '',
  created_at       timestamptz not null default now()
);
create index if not exists interviews_participant_idx on public.interviews (participant_id);
create index if not exists interviews_project_ids_idx on public.interviews using gin (project_ids);

-- ---------- insights ----------
create table if not exists public.insights (
  id              text primary key,
  title           text not null,
  description     text not null default '',
  evidence        text not null default '',
  type            text not null default 'insight',
  confidence      text not null default 'medium',
  severity        text not null default 'medium',
  impact          text not null default 'medium',
  created_date    date not null default current_date,
  created_by      text references public.profiles(id) on delete set null,
  participant_ids text[] not null default '{}',
  interview_ids   text[] not null default '{}',
  -- Usability tests this insight was promoted from (traceability to results).
  test_ids        text[] not null default '{}',
  project_ids     text[] not null default '{}',
  theme_ids       text[] not null default '{}',
  tag_ids         text[] not null default '{}',
  product_area    text not null default 'Platform',
  persona_ids     text[] not null default '{}',
  related_insight_ids text[] not null default '{}',
  workflow_stage  text,  -- Kanban triage stage; null = not yet on the board
  created_at      timestamptz not null default now()
);
create index if not exists insights_tag_ids_idx on public.insights using gin (tag_ids);
create index if not exists insights_project_ids_idx on public.insights using gin (project_ids);

-- ---------- transcripts ----------
create table if not exists public.transcripts (
  id           text primary key,
  interview_id text not null references public.interviews(id) on delete cascade,
  language     text not null default 'English',
  segments     jsonb not null default '[]',
  comments     jsonb not null default '[]'
);

create table if not exists public.transcript_highlights (
  id                text primary key,
  transcript_id     text not null references public.transcripts(id) on delete cascade,
  segment_id        text not null,
  start_pos         int not null default 0,
  end_pos           int not null default 0,
  text              text not null,
  kind              text not null default 'insight',
  note              text,
  tag_ids           text[] not null default '{}',
  created_by        text references public.profiles(id) on delete set null,
  linked_insight_id text
);
create index if not exists highlights_transcript_idx on public.transcript_highlights (transcript_id);

-- ---------- boards ----------
create table if not exists public.kanban_boards (
  id         text primary key,
  project_id text references public.projects(id) on delete cascade,
  name       text not null,
  columns    jsonb not null default '[]',
  cards      jsonb not null default '[]'
);

create table if not exists public.affinity_boards (
  id         text primary key,
  project_id text references public.projects(id) on delete cascade,
  name       text not null,
  groups     jsonb not null default '[]',
  notes      jsonb not null default '[]'
);

-- ============================================================
-- Multi-tenancy: tenant resolution + account_id on all content
-- ============================================================

-- SECURITY DEFINER: bypasses RLS on profiles, which also prevents policy
-- recursion (profiles' own policies call this function).
create or replace function public.current_account_id()
returns text
language sql stable security definer set search_path = public
as $$
  select account_id from public.profiles where auth_id = auth.uid();
$$;

-- Authenticated client inserts get stamped with the caller's account
-- automatically; service-role sessions resolve NULL and must be explicit.
alter table public.profiles alter column account_id set default public.current_account_id();
create index if not exists profiles_account_idx on public.profiles(account_id);

do $$
declare t text;
begin
  foreach t in array array[
    'companies','personas','tags','themes','participants','projects',
    'interviews','insights','transcripts','transcript_highlights',
    'kanban_boards','affinity_boards'
  ] loop
    execute format('alter table public.%I add column if not exists account_id text', t);
    execute format('update public.%I set account_id = ''acc_northwind'' where account_id is null', t);
    execute format('alter table public.%I alter column account_id set not null', t);
    execute format('alter table public.%I alter column account_id set default public.current_account_id()', t);
    begin
      execute format('alter table public.%I add constraint %I_account_fk
        foreign key (account_id) references public.accounts(id) on delete cascade', t, t);
    exception when duplicate_object then null; end;
    execute format('create index if not exists %I_account_idx on public.%I(account_id)', t, t);
  end loop;
end $$;

-- ============================================================
-- Auth bridge: link auth.users to profiles by email on signup.
-- Link-only — accounts and their users are provisioned explicitly
-- (scripts/create-account.ts, Settings → Add user), so orphan
-- profiles are never created and there is no "first user is admin".
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.profiles
     set auth_id = new.id
   where lower(email) = lower(new.email)
     and auth_id is null;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Row Level Security
-- ============================================================
create or replace function public.current_app_role()
returns text
language sql stable security definer set search_path = public
as $$
  select role from public.profiles where auth_id = auth.uid();
$$;

create or replace function public.can_manage_content()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(public.current_app_role() in ('admin','researcher'), false);
$$;

-- Enable RLS everywhere (accounts included).
do $$
declare t text;
begin
  foreach t in array array[
    'accounts','profiles','companies','personas','tags','themes','participants',
    'projects','interviews','insights','transcripts',
    'transcript_highlights','kanban_boards','affinity_boards'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Content tables: read within your account; admins + researchers manage
-- within their account. WITH CHECK blocks writing rows into another account.
do $$
declare t text;
begin
  foreach t in array array[
    'companies','personas','tags','themes','participants','projects',
    'interviews','insights','transcripts','transcript_highlights',
    'kanban_boards','affinity_boards'
  ] loop
    execute format('drop policy if exists "read for authenticated" on public.%I', t);
    execute format('drop policy if exists "manage for researchers" on public.%I', t);
    execute format('drop policy if exists "read own account" on public.%I', t);
    execute format('drop policy if exists "manage own account" on public.%I', t);
    execute format('create policy "read own account" on public.%I
      for select to authenticated
      using (account_id = public.current_account_id())', t);
    execute format('create policy "manage own account" on public.%I
      for all to authenticated
      using (account_id = public.current_account_id() and public.can_manage_content())
      with check (account_id = public.current_account_id() and public.can_manage_content())', t);
  end loop;
end $$;

-- Accounts: members can read their own account row; no client writes.
drop policy if exists "read own account row" on public.accounts;
create policy "read own account row" on public.accounts
  for select to authenticated
  using (id = public.current_account_id());

-- Profiles: see your account's members; self-edit or admin; only admins
-- add/remove members — all constrained to the caller's own account.
drop policy if exists "read for authenticated" on public.profiles;
drop policy if exists "read own account" on public.profiles;
create policy "read own account" on public.profiles
  for select to authenticated
  using (account_id = public.current_account_id());

drop policy if exists "self or admin update" on public.profiles;
create policy "self or admin update" on public.profiles
  for update to authenticated
  using (account_id = public.current_account_id()
         and (auth_id = auth.uid() or public.current_app_role() = 'admin'))
  with check (account_id = public.current_account_id()
              and (auth_id = auth.uid() or public.current_app_role() = 'admin'));

drop policy if exists "admin insert" on public.profiles;
create policy "admin insert" on public.profiles
  for insert to authenticated
  with check (public.current_app_role() = 'admin'
              and account_id = public.current_account_id());

drop policy if exists "admin delete" on public.profiles;
create policy "admin delete" on public.profiles
  for delete to authenticated
  using (public.current_app_role() = 'admin'
         and account_id = public.current_account_id());

-- Column guard: the self-update policy exists so users can save their own
-- preferences, but RLS can't restrict columns — without this trigger a
-- non-admin could set their own role to 'admin' via a direct PostgREST call.
-- Browser sessions that aren't admins may not change role, auth_id, or email;
-- server-side contexts (service role, the auth signup trigger) are exempt.
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.role() = 'authenticated' then
    -- Nobody (admins included) may move a profile between accounts from the
    -- app; that's a platform-owner (service-role) operation.
    if new.account_id is distinct from old.account_id then
      raise exception 'Profiles cannot be moved between accounts.';
    end if;
    if public.current_app_role() is distinct from 'admin' then
      if new.role is distinct from old.role
         or new.auth_id is distinct from old.auth_id
         or new.email is distinct from old.email then
        raise exception 'Only administrators can change roles or account links.';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_privileges on public.profiles;
create trigger guard_profile_privileges
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- ============================================================
-- Setup status — anonymous callers learn only that the schema is
-- installed; signed-in callers get counts scoped to THEIR account
-- (never cross-tenant totals).
-- ============================================================
create or replace function public.setup_status()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare acc text;
begin
  if auth.uid() is null then
    return jsonb_build_object('schema', true);
  end if;
  acc := public.current_account_id();
  return jsonb_build_object(
    'schema',          true,
    'profiles',        (select count(*) from public.profiles where account_id = acc),
    'companies',       (select count(*) from public.companies where account_id = acc),
    'participants',    (select count(*) from public.participants where account_id = acc),
    'projects',        (select count(*) from public.projects where account_id = acc),
    'interviews',      (select count(*) from public.interviews where account_id = acc),
    'insights',        (select count(*) from public.insights where account_id = acc),
    'transcripts',     (select count(*) from public.transcripts where account_id = acc),
    'kanban_boards',   (select count(*) from public.kanban_boards where account_id = acc),
    'affinity_boards', (select count(*) from public.affinity_boards where account_id = acc)
  );
end;
$$;
grant execute on function public.setup_status() to anon, authenticated;

-- ============================================================
-- AI: workspace keys, usage metering & shared workspace settings
-- ============================================================

-- One shared AI key per account (workspace), one column per provider, stored
-- as AES-256-GCM ciphertext. Written only server-side (service role) after
-- encryption; RLS with no client policies means the ciphertext is never
-- client-readable.
create table if not exists public.account_ai_keys (
  account_id text primary key references public.accounts(id) on delete cascade,
  anthropic  text,
  openai     text,
  xai        text,
  google     text,
  updated_at timestamptz not null default now()
);
alter table public.account_ai_keys enable row level security;

-- Per-user AI token usage (running totals). Written server-side (service role)
-- after each AI call; owner-only RLS is defence-in-depth so no client can read
-- another user's numbers.
create table if not exists public.ai_usage (
  profile_id    text primary key references public.profiles(id) on delete cascade,
  input_tokens  bigint  not null default 0,
  output_tokens bigint  not null default 0,
  requests      integer not null default 0,
  updated_at    timestamptz not null default now()
);
alter table public.ai_usage enable row level security;
drop policy if exists "own ai_usage" on public.ai_usage;
create policy "own ai_usage" on public.ai_usage
  for all to authenticated
  using (profile_id in (select id from public.profiles where auth_id = auth.uid()))
  with check (profile_id in (select id from public.profiles where auth_id = auth.uid()));

-- Atomic upsert + increment, called by the server (service role) after each call.
create or replace function public.increment_ai_usage(p_profile_id text, p_input bigint, p_output bigint)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.ai_usage (profile_id, input_tokens, output_tokens, requests, updated_at)
  values (p_profile_id, greatest(p_input, 0), greatest(p_output, 0), 1, now())
  on conflict (profile_id) do update set
    input_tokens  = public.ai_usage.input_tokens  + greatest(p_input, 0),
    output_tokens = public.ai_usage.output_tokens + greatest(p_output, 0),
    requests      = public.ai_usage.requests + 1,
    updated_at    = now();
$$;

-- Workspace settings (one row per account): GDPR policy + project-tab
-- visibility. Account members read; only their admins write.
create table if not exists public.workspace_settings (
  id         text primary key,
  account_id text not null unique references public.accounts(id) on delete cascade,
  settings   jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.workspace_settings (id, account_id, settings)
  values ('acc_northwind', 'acc_northwind', '{}'::jsonb)
  on conflict (account_id) do nothing;
alter table public.workspace_settings enable row level security;
drop policy if exists "read workspace settings" on public.workspace_settings;
create policy "read workspace settings" on public.workspace_settings
  for select to authenticated
  using (account_id = public.current_account_id());
drop policy if exists "admin write workspace settings" on public.workspace_settings;
create policy "admin write workspace settings" on public.workspace_settings
  for all to authenticated
  using (public.current_app_role() = 'admin' and account_id = public.current_account_id())
  with check (public.current_app_role() = 'admin' and account_id = public.current_account_id());

-- ============================================================
-- Audit trail — security- and GDPR-relevant actions (exports,
-- erasure, role/key/policy changes) recorded per account.
-- RLS: any signed-in member may INSERT events for their own
-- account; only admins may SELECT; no UPDATE or DELETE policies,
-- so the log is append-only from clients.
-- ============================================================
create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  account_id text not null default public.current_account_id()
    references public.accounts(id) on delete cascade,
  actor_id text,
  actor_name text not null default '',
  action text not null,
  target text not null default '',
  detail text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists audit_events_account_idx
  on public.audit_events (account_id, created_at desc);
alter table public.audit_events enable row level security;

drop policy if exists "insert own account" on public.audit_events;
create policy "insert own account" on public.audit_events
  for insert to authenticated
  with check (account_id = public.current_account_id());

drop policy if exists "admin read own account" on public.audit_events;
create policy "admin read own account" on public.audit_events
  for select to authenticated
  using (account_id = public.current_account_id() and public.current_app_role() = 'admin');

-- ============================================================
-- Owner console (cloud only): access-request inbox + private
-- per-account notes. Both service-role only: RLS enabled with no
-- client policies — tenants can never read them.
-- ============================================================
create table if not exists public.access_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  email text not null,
  company text not null default '',
  message text not null default '',
  status text not null default 'new' check (status in ('new','handled','dismissed')),
  created_at timestamptz not null default now()
);
create index if not exists access_requests_status_idx on public.access_requests (status, created_at desc);
alter table public.access_requests enable row level security;

-- Deliberately NOT a column on accounts: tenants can read their own accounts
-- row, and these notes must never be tenant-visible.
create table if not exists public.account_notes (
  account_id text primary key references public.accounts(id) on delete cascade,
  notes text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.account_notes enable row level security;

-- ============================================================
-- Unmoderated testing (docs/unmoderated-testing.md)
--  · tests — researcher-authored test definitions; the ordered block
--    list (message / questions / first-click / app-task) is jsonb
--    because blocks are only edited as one unit in the builder.
--    Standard content RLS; synced through the store mirror.
--  · test_sessions — anonymous participant sessions from the public
--    /t/<token> runner. Written ONLY by the service role (the
--    /api/t/[token]/* routes validate share_token + per-session
--    secret); tenants SELECT (results page), managers DELETE
--    (erasure). No client INSERT/UPDATE — participants never touch a
--    tenant-writable surface. Deliberately NOT in the sync mirror:
--    participant writes land concurrently and a full-mirror upsert
--    would clobber them.
-- ============================================================
create table if not exists public.tests (
  id          text primary key,
  account_id  text not null default public.current_account_id()
              references public.accounts(id) on delete cascade,
  project_id  text not null references public.projects(id) on delete cascade,
  name        text not null,
  status      text not null default 'draft'
              check (status in ('draft','active','closed')),
  share_token text not null unique,  -- 24+ char crypto-random; rotating it kills the public link
  blocks      jsonb not null default '[]',
  created_by  text references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  closed_at   timestamptz,
  -- Saved AI report: { narrative, facts, generatedAt, sessions, completed }.
  -- Generated once so reopening is token-free; regenerating overwrites.
  report      jsonb
);
create index if not exists tests_account_idx on public.tests (account_id);
create index if not exists tests_project_idx on public.tests (project_id);
alter table public.tests enable row level security;

drop policy if exists "read own account" on public.tests;
create policy "read own account" on public.tests
  for select to authenticated
  using (account_id = public.current_account_id());

drop policy if exists "manage own account" on public.tests;
create policy "manage own account" on public.tests
  for all to authenticated
  using (account_id = public.current_account_id() and public.can_manage_content())
  with check (account_id = public.current_account_id() and public.can_manage_content());

-- No account_id default: only the service role inserts here, and it must
-- always stamp the account explicitly (resolved from the test's share_token).
create table if not exists public.test_sessions (
  id                 text primary key,
  account_id         text not null references public.accounts(id) on delete cascade,
  test_id            text not null references public.tests(id) on delete cascade,
  session_token_hash text not null,  -- sha-256 of the per-session write secret; plaintext never stored
  status             text not null default 'started'
                     check (status in ('started','completed','abandoned')),
  consent_given_at   timestamptz not null,  -- a row only exists after explicit consent
  device             jsonb,  -- coarse only (viewport, touch/mouse) — kept non-fingerprintable
  results            jsonb not null default '{}',  -- {blockId: {...}}, merged per block server-side
  started_at         timestamptz not null default now(),
  completed_at       timestamptz
);
create index if not exists test_sessions_account_idx on public.test_sessions (account_id);
create index if not exists test_sessions_test_idx on public.test_sessions (test_id, started_at desc);
alter table public.test_sessions enable row level security;

drop policy if exists "read own account" on public.test_sessions;
create policy "read own account" on public.test_sessions
  for select to authenticated
  using (account_id = public.current_account_id());

drop policy if exists "managers delete own account" on public.test_sessions;
create policy "managers delete own account" on public.test_sessions
  for delete to authenticated
  using (account_id = public.current_account_id() and public.can_manage_content());

-- Storage bucket for first-click images. Public-read (anonymous participants
-- must load them), account-scoped writes (<account_id>/<test_id>/…), 5 MB,
-- images only. Only non-confidential UI screenshots belong here.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('test-assets', 'test-assets', true, 5242880,
          array['image/png','image/jpeg','image/webp'])
  on conflict (id) do nothing;

drop policy if exists "test assets manage own account" on storage.objects;
create policy "test assets manage own account" on storage.objects
  for all to authenticated
  using (bucket_id = 'test-assets'
         and public.can_manage_content()
         and (storage.foldername(name))[1] = public.current_account_id())
  with check (bucket_id = 'test-assets'
              and public.can_manage_content()
              and (storage.foldername(name))[1] = public.current_account_id());
