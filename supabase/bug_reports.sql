-- Run once in the Supabase SQL editor to turn on the "Report a problem" form.
-- Anyone using the site can submit a report; nobody can read reports through the site.
-- Read them in the Supabase dashboard: Table Editor → bug_reports.

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
