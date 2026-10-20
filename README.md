# Volunteer Clearances

**Live site:** https://mcnearcj.github.io/lsa-vol-clearance-web/

A small web app that helps Diocese of Allentown volunteers track the Safe Environment requirements on the
[Parish & School Volunteer Requirements Checklist](docs/Background%20Check%20List%20Volunteer.pdf) and fill in the forms.

- **Checklist**: the 12 requirements with status, completion date, 5-year renewal reminders, and step-by-step instructions.
- **My info**: entered once, used to pre-fill the forms.
- **Forms**: Background Check Authorization, Sexual Abuse / Code of Conduct / Social Media / CPSL acknowledgments, and the NSOR application are generated as PDFs to print and sign.

## Privacy

By default everything stays in the volunteer's browser (`localStorage`) and PDFs are filled in on the device.
The app never asks for or stores a Social Security Number; those fields are left blank on the generated forms.

### Optional cloud backup

If you connect a [Supabase](https://supabase.com) project, the **Backup** page lets a volunteer sign in with an email and
one password and keep a copy of their info and progress for use on another device. The password never leaves the browser:
it is stretched (PBKDF2) into two unrelated values, a sign-in secret that Supabase sees and an AES-GCM key that encrypts
the backup before upload. The database holds ciphertext only. A password reset restores account access, but an old backup
can't be opened with the new password; the volunteer saves again from a device that has their data. Without the two
environment variables below, the page offers only a backup file.

Setup:

1. Create a free Supabase project.
2. In **SQL Editor**, run [`supabase/schema.sql`](supabase/schema.sql). It creates one `vault` table with row-level security so each user can only touch their own row.
3. In **Authentication → URL Configuration**, set the Site URL to wherever you host the site.
4. Copy `.env.example` to `.env.local` and fill in the project URL and anon key (Project Settings → API), then `npm run build`.

### Bug reports

The **Report a problem** form (Help page, prototype banner and footer) saves reports to a `bug_reports` table in the same
Supabase project. Run [`supabase/bug_reports.sql`](supabase/bug_reports.sql) once to create it; reports can be submitted from the
site but only read in the Supabase dashboard (Table Editor → `bug_reports`). If the table is missing, the form offers a
pre-filled GitHub issue instead.

## For schools and parishes: hosting your own copy

The site is a set of static files with no server of its own, so it can be hosted almost anywhere for free:

- **GitHub Pages** (what the live site uses): fork this repository, then under Settings → Pages choose "GitHub Actions". Every change to `main` redeploys automatically.
- **Any web host**: run `npm run build` and upload the `dist/` folder.

Online backup is optional. To offer it, create your own free Supabase project (steps above) so your volunteers' encrypted backups live in an account you control. Without it, everything stays in each volunteer's browser.

To update the checklist when the diocese revises it, edit `src/data/requirements.ts`.

## Development

```sh
npm install
npm run dev      # local dev server
npm run build    # static site in dist/
```

The built site is static and uses a relative base path, so `dist/` can be hosted anywhere (e.g. GitHub Pages).

## Files

- `docs/`: the diocese's original PDFs as supplied.
- `public/forms/`: copies the app serves (templates it fills in, plus instruction sheets for reference).
- `src/data/requirements.ts`: the checklist content. Update it when the diocese revises the checklist.
- `src/pdf/fill.ts`: PDF filling. Field positions are taken from the diocese's PDFs; the Social Media and CPSL acknowledgments are re-typeset because the originals are low-quality scans.

## Hosting

Pushes to `main` build and deploy to GitHub Pages (`.github/workflows/deploy.yml`). To enable Cloud backup on the hosted site,
add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under Settings → Secrets and variables → Actions → Variables.
