-- Run once in the Supabase SQL editor (Project → SQL Editor).
-- Each volunteer gets at most one row, readable and writable only by them.
-- The app encrypts in the browser, so these columns hold ciphertext only.

create table if not exists public.vault (
  user_id uuid primary key references auth.users (id) on delete cascade,
  salt text not null,
  iv text not null,
  ciphertext text not null,
  updated_at timestamptz not null default now()
);

alter table public.vault enable row level security;

create policy "own vault: select" on public.vault for select using (auth.uid() = user_id);
create policy "own vault: insert" on public.vault for insert with check (auth.uid() = user_id);
create policy "own vault: update" on public.vault for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own vault: delete" on public.vault for delete using (auth.uid() = user_id);

-- Bug reports (also in bug_reports.sql)

create table if not exists public.bug_reports (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  message text not null check (char_length(message) between 5 and 4000),
  contact text check (char_length(contact) <= 200),
  page text check (char_length(page) <= 100),
  browser text check (char_length(browser) <= 500),
  screen text check (char_length(screen) <= 50)
);

alter table public.bug_reports enable row level security;

create policy "anyone can submit a bug report" on public.bug_reports
  for insert to anon, authenticated with check (true);
-- No select, update or delete policies: reports are write-only from the site.
