# Volunteer Clearances

**Live site:** https://mcnearcj.github.io/lsa-vol-clearance-web/ (early prototype)

A web app that helps Diocese of Allentown parish and school volunteers work through the Safe Environment
[Parish & School Volunteer Requirements Checklist](public/forms/requirements-checklist.pdf) and fill in the forms.
It is a volunteer-made helper, not an official diocesan site.

## What it does

- **Checklist**: the diocese's 12 requirements, grouped into background checks, forms to sign, training, and driving.
  Each has step-by-step instructions, links, a "Mark done" date, and renewal reminders (most last 5 years). A "Start here"
  panel and a "Next up" card point people at what to do next.
- **My info**: entered once and used to fill in the forms. Shows which forms use which details.
- **Forms**: the Background Check Authorization, the Sexual Abuse, Code of Conduct, Social Media and CPSL
  acknowledgments, and the NSOR application download as filled-in PDFs to print and sign by hand. The site warns about
  any details that would be left blank.
- **Sign all forms**: draw a signature (mouse, finger, or a stylus such as Apple Pencil, with pen pressure) or type it in a
  handwriting font, optionally enter an SSN, and download all six forms signed, dated and combined into one PDF. The
  signature and SSN exist only in memory for that one download; they're never saved, synced or sent.
- **Sync** (optional): sign in to keep info and progress in step across devices, end-to-end encrypted.
- **Help**: who to ask, FAQ, a "Report a problem" form, and erasing data from the device.

## Privacy

- Everything is stored in the volunteer's own browser (`localStorage`). PDFs are filled in on the device.
- The SSN is only asked for in the signing window, used for that one download, and never saved or synced. Otherwise
  those boxes stay blank to be written by hand.
- Fonts and all other assets are served with the site, so a page view contacts no third parties.
- **Sync** encrypts on the device before upload. The password is stretched with PBKDF2 into two unrelated values: a
  sign-in secret (the only thing Supabase sees) and an AES-GCM key that encrypts the data. The database holds ciphertext
  only, and the site owner can't read it. The key is remembered on the device as a non-extractable key in IndexedDB so
  people aren't asked for their password on every visit. A password reset restores the account but can't open an old
  synced copy; the site replaces it from the device.

## Setting up sync and bug reports (Supabase)

Both are optional. Without them the Sync tab offers a backup file, and "Report a problem" offers a pre-filled GitHub issue.

1. Create a free [Supabase](https://supabase.com) project.
2. In **SQL Editor**, run [`supabase/schema.sql`](supabase/schema.sql). It creates the `vault` table (one encrypted row
   per person, readable only by its owner) and the `bug_reports` table (anyone can submit; nobody can read through the
   site). Projects set up before bug reports existed only need [`supabase/bug_reports.sql`](supabase/bug_reports.sql).
3. In **Authentication → URL Configuration**, set the **Site URL** and add `<site URL>/**` under **Redirect URLs**.
4. Give the site the project URL and anon key (Project Settings → API; the anon key is meant to be public):
   - GitHub Pages: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under Settings → Secrets and variables →
     Actions → **Variables**, then re-run the deploy.
   - Local builds: copy `.env.example` to `.env.local` and fill it in.
5. Read bug reports in the dashboard under **Table Editor → bug_reports**.
6. Optional: to get each bug report by email, sign up at [Resend](https://resend.com) with the address that should
   receive them, create an API key, put both in the two `EDIT` lines of
   [`supabase/bug_report_emails.sql`](supabase/bug_report_emails.sql), and run it in the SQL Editor. The key is kept in
   Supabase Vault. Emails are capped at 20 an hour, and reports are always saved even if an email fails.

Free Supabase projects pause after about a week with little activity, which turns off sync and bug reports (the rest of
the site keeps working). `.github/workflows/keep-supabase-awake.yml` makes one small read every 3 days to prevent that,
and fails (so GitHub emails you) if the project is already paused. GitHub turns scheduled workflows off after 60 days
with no commits; re-enable it under Actions → Keep Supabase awake.

Sign-in emails come from Supabase's built-in sender, and the site tells people so. To send them from your own
address (and edit the email templates), set up custom SMTP under **Authentication → Emails → SMTP Settings**, then
update the sender named in `src/components/CloudPanel.tsx` and the Help page FAQ in `src/App.tsx`.

## Hosting your own copy

The site is static files with no server of its own.

- **GitHub Pages** (what the live site uses): fork the repo, then under Settings → Pages choose **GitHub Actions**.
  Every push to `main` runs the linter and tests, builds, and deploys (`.github/workflows/deploy.yml`).
- **Any web host**: run `npm run build` and upload `dist/`. It uses relative paths, so any folder works.

Set your school's name, city and coordinator in `src/data/site.ts`. To offer sync, use your own Supabase project (above) so your volunteers' encrypted data lives in an account you control.

## Keeping it up to date

| When this changes… | Edit |
| --- | --- |
| The school, its city, or its LSEC (coordinator) | `src/data/site.ts` |
| Checklist items, steps, links, renewal periods | `src/data/requirements.ts` |
| A blank form or instruction sheet | Replace the file in `public/forms/` (same name) |
| A form's layout | Field positions in `src/pdf/fill.ts`, then check a filled-in copy by eye |
| Which details a form uses | `src/data/formFields.ts` |

The Social Media and CPSL acknowledgments are re-typeset in `src/pdf/fill.ts` because the diocese's copies are
low-quality scans; the originals are linked from those checklist items.

## Development

```sh
npm install
npm run dev      # local dev server
npm test         # unit tests (dates, checklist data, encryption, PDF filling)
npm run lint
npm run build    # type-check and build the static site into dist/
```

## Project layout

- `public/forms/`: the diocese's PDFs (blank forms it fills in, plus instruction sheets it links to)
- `src/App.tsx`: page layout, tabs, checklist overview, Sync and Help pages
- `src/components/`: checklist card, My info form, sync panel, bug report form
- `src/data/`: checklist content and which fields each form uses
- `src/pdf/fill.ts`: PDF filling, in the browser
- `src/cloud/`: Supabase client, encryption, and the on-device key store
- `supabase/`: SQL for the database tables and access rules
