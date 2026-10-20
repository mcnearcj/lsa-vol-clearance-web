-- Emails each new bug report to you, using Resend (https://resend.com, free tier).
--
-- Before running:
--   1. Sign up at resend.com using the email address that should receive the reports.
--      (Without your own domain, Resend only delivers to that address, which is all this needs.)
--   2. In Resend, create an API key (API Keys → Create API Key, "Sending access").
--   3. Put the key and your email address in the two lines marked EDIT below, then run this in the SQL Editor.
--
-- The key and address are stored in Supabase Vault, not in this file or any table.
-- Run it again any time to change them. Reports are always saved to the table, even if an email can't be sent.

create extension if not exists pg_net;

do $$
declare
  api_key text := 're_YOUR_RESEND_API_KEY';   -- EDIT: your Resend API key
  send_to text := 'you@example.com';          -- EDIT: where reports should go (your Resend sign-up address)
  existing uuid;
begin
  if api_key like 're_YOUR%' or send_to like '%@example.com' or send_to !~ '^[^@\s]+@[^@\s]+$' then
    raise exception 'Replace the Resend API key and email address (the lines marked EDIT) before running this.';
  end if;

  select id into existing from vault.secrets where name = 'bug_report_resend_key';
  if existing is null then
    perform vault.create_secret(api_key, 'bug_report_resend_key');
  else
    perform vault.update_secret(existing, api_key);
  end if;

  select id into existing from vault.secrets where name = 'bug_report_email_to';
  if existing is null then
    perform vault.create_secret(send_to, 'bug_report_email_to');
  else
    perform vault.update_secret(existing, send_to);
  end if;
end $$;

create or replace function public.email_bug_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  api_key text;
  send_to text;
  recent int;
  email jsonb;
begin
  -- A burst of reports (or spam) shouldn't flood your inbox. They're still saved in the table.
  select count(*) into recent from public.bug_reports where created_at > now() - interval '1 hour';
  if recent > 20 then
    return new;
  end if;

  select decrypted_secret into api_key from vault.decrypted_secrets where name = 'bug_report_resend_key';
  select decrypted_secret into send_to from vault.decrypted_secrets where name = 'bug_report_email_to';
  if api_key is null or send_to is null then
    return new;
  end if;

  -- Plain text only, so nothing in a report can be shown as HTML.
  email := jsonb_build_object(
    'from', 'Volunteer Clearances <onboarding@resend.dev>',
    'to', jsonb_build_array(send_to),
    'subject', 'Bug report: ' || left(regexp_replace(new.message, '\s+', ' ', 'g'), 70),
    'text', new.message || E'\n\n---\n'
      || 'Reply to: ' || coalesce(nullif(new.contact, ''), '(no email given)') || E'\n'
      || 'Page: ' || coalesce(new.page, '?') || E'\n'
      || 'Screen: ' || coalesce(new.screen, '?') || E'\n'
      || 'Browser: ' || coalesce(new.browser, '?') || E'\n'
      || 'Sent: ' || to_char(new.created_at at time zone 'America/New_York', 'Mon DD, YYYY HH12:MI AM') || ' Eastern'
  );
  -- Replying to the email goes straight to the person, when they left an address.
  if new.contact ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    email := email || jsonb_build_object('reply_to', new.contact);
  end if;

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object('Authorization', 'Bearer ' || api_key, 'Content-Type', 'application/json'),
    body := email
  );
  return new;
exception when others then
  -- Never lose a report because the email couldn't be sent.
  return new;
end;
$$;

drop trigger if exists email_bug_report on public.bug_reports;
create trigger email_bug_report
  after insert on public.bug_reports
  for each row execute function public.email_bug_report();
