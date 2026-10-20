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
