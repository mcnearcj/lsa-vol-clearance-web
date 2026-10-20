# Volunteer Clearances

**Live site:** https://mcnearcj.github.io/lsa-vol-clearance-web/ (early prototype)

A web app that helps La Salle Academy volunteers work through the Diocese of Allentown's Safe Environment requirements:
the [School Volunteer Requirements Checklist](public/forms/requirements-checklist.pdf) (revised 7/31/2025). It tracks
the clearances and trainings, fills in the forms, and keeps everything private. It's a volunteer-made helper, not an
official diocesan site. Another school or parish can host its own copy (see below).

## What volunteers can do

- **Checklist.** The background checks (PATCH, Child Abuse History, FBI fingerprints, NSOR), trainings (Protecting God's
  Children, Mandated Reporter) and the driver form, each with step-by-step instructions, links, a "Mark done" date and
  renewal reminders (most last 5 years). A "Start here" panel walks new volunteers through it, and a note explains the
  diocese's shorter list for limited volunteers and tells people to ask their coordinator if they're unsure.
- **Forms to sign.** The six signable forms (Sexual Abuse, Code of Conduct, Social Media and CPSL acknowledgments, the
  Background Check Authorization and the state's NSOR application) are filled in from the volunteer's info. They pick
  the forms they need, print and sign by hand or sign on screen (draw with a mouse, finger or stylus, or type), and
  optionally add an SSN. Nothing downloads by itself: the site lists the files with Open and Download links. One PDF of
  the chosen forms, plus a separate **submission checklist** for the volunteer to keep (what to hand in, to whom, and what
  is still outstanding). One "handed in" checkbox tracks the forms.
- **My info.** Entered once, used on every form. Shows how complete it is and which forms use each section.
- **Sync** (optional). Sign in with an email and one password to keep info and progress in step across devices and tabs.
- **Help.** Who to ask (the school's LSEC and the diocese's contact), FAQs, and "Report a problem".
- **Shared computers.** Every page shows whose info is loaded, with "Not you?" to clear it.

## Privacy and security

- Info and progress are stored in the volunteer's own browser. PDFs are filled in on the device.
- The **SSN** is only asked for when making forms, used for those files, and never saved, synced or sent. The files
  themselves exist only in the browser tab's memory; the page says so and offers "Delete these files now", and they're
  also erased when the choices change or the page closes. Copies the person opens or downloads are theirs to delete, and
  the page reminds them to on shared computers.
- **Sync is end-to-end encrypted.** The password is stretched (PBKDF2) on the device into two unrelated values: a
  sign-in secret, the only thing Supabase sees, and an AES-GCM key that encrypts the data before upload. The database
  holds ciphertext only, so the site owner can't read it. The key is kept on the device as a non-extractable key in
  IndexedDB, so people aren't asked for their password on every visit. A password reset restores the account but can't
  open an old synced copy; the site replaces it from the device.
- Fonts and all other assets are served with the site, so a page view contacts no third parties.

## How it works

A static React + TypeScript site built with Vite and hosted on GitHub Pages. There's no server of its own.

- **Forms** are filled in the browser with [pdf-lib](https://pdf-lib.js.org). The NSOR and Social Media forms have
  fill-in boxes; the others are drawn onto at measured positions. The CPSL acknowledgment is re-typeset because the
  diocese only publishes it as a scan.
- **Sync** uses [Supabase](https://supabase.com) for sign-in and one encrypted row per person (row-level security).
  Each device remembers the last version it agreed on with the server. A sync fetches the server copy, merges other
  devices' changes field by field, and saves only if nobody else saved in between, so a stale device never overwrites
  newer data. Tabs on the same device share changes instantly. Devices sync when the page comes back into view and once
  a minute while it's open.
- **Bug reports** go to a write-only Supabase table and, optionally, to your inbox through Resend.

## Setting up Supabase (sync and bug reports)

Optional. Without it, the Sync tab explains that sync isn't turned on, and "Report a problem" offers a pre-filled GitHub issue.

1. Create a free Supabase project.
2. In **SQL Editor**, run [`supabase/schema.sql`](supabase/schema.sql). It creates the `vault` table (one encrypted row
   per person, readable only by its owner) and the `bug_reports` table (anyone can submit; nobody can read through the
   site). Projects set up before bug reports existed only need [`supabase/bug_reports.sql`](supabase/bug_reports.sql).
3. In **Authentication → URL Configuration**, set the **Site URL** and add `<site URL>/**` under **Redirect URLs**.
4. Give the site the project URL and anon key (Project Settings → API; the anon key is meant to be public):
   - GitHub Pages: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under Settings → Secrets and variables →
     Actions → **Variables**, then re-run the deploy.
   - Local builds: copy `.env.example` to `.env.local` and fill it in.
5. Read bug reports in **Table Editor → bug_reports**. To get each one by email, sign up at
   [Resend](https://resend.com) with the address that should receive them, create an API key, put both in the two
   `EDIT` lines of [`supabase/bug_report_emails.sql`](supabase/bug_report_emails.sql) and run it. The key is kept in
   Supabase Vault; emails are capped at 20 an hour, and reports are always saved even if an email fails.

**Keeping the project awake.** Free Supabase projects pause after about a week of low activity, which turns off sync and
bug reports (the rest of the site keeps working). `.github/workflows/keep-supabase-awake.yml` makes one small read every
3 days and fails, so GitHub emails you, if the project is already paused. GitHub turns scheduled workflows off after 60
days with no commits; re-enable it under Actions → Keep Supabase awake.

**Sign-in emails** come from Supabase's built-in sender, and the site tells people so. To send from your own address and
edit the email templates, set up custom SMTP under Authentication → Emails → SMTP Settings, then update the sender named
in `src/components/CloudPanel.tsx` and the Help page FAQ in `src/App.tsx`.

## Hosting your own copy

1. Fork this repository and set your school's name, city and coordinator (LSEC) in
   [`src/data/site.ts`](src/data/site.ts).
2. Under Settings → Pages, choose **GitHub Actions**. Every push to `main` runs the linter and tests, builds, and
   deploys (`.github/workflows/deploy.yml`). Or run `npm run build` and upload `dist/` to any web host.
3. To offer sync, set up your own Supabase project (above) so your volunteers' encrypted data lives in an account you
   control.

[DEPLOYING.md](DEPLOYING.md) has the details: hosting on another web server or a custom domain (such as a
lsabear.com subdomain), server and cache settings, Supabase changes, and moving volunteers to a new address.

## Keeping it up to date

The sources are the diocese's [Safe Environment Requirements](https://www.allentowndiocese.org/safe-environment-requirements-for-employees-volunteers)
page (role checklists) and [Safe Environment Policies](https://www.allentowndiocese.org/safe-environment-policies)
page (policies and acknowledgment forms), plus the state's NSOR application.

| When this changes… | Edit |
| --- | --- |
| The school, its city, its LSEC, or which diocese checklist it follows | `src/data/site.ts` |
| Checklist items: steps, links, renewal periods | `src/data/requirements.ts` |
| The signable forms: labels, policy links, notes | `src/data/forms.ts` |
| A blank form or instruction sheet | Replace the file in `public/forms/` (same name) |
| A form's layout | Field positions in `src/pdf/fill.ts`, then check a filled-in copy by eye |
| Which details a form uses | `src/data/formFields.ts` |

## Development

```sh
npm install
npm run dev      # local dev server
npm test         # unit tests: dates, checklist data, forms, merging, encryption, PDF filling
npm run lint
npm run build    # type-check and build the static site into dist/
```

### Project layout

- `public/forms/`: the diocese's and state's PDFs (blank forms the site fills in, and instruction sheets it links to)
- `src/App.tsx`: page layout, tabs, checklist, Sync and Help pages
- `src/components/`: checklist card, Forms to sign, My info, sync panel, bug report form
- `src/data/`: the school (`site.ts`), checklist items, forms, the fields each form uses, the submission checklist
- `src/pdf/`: form filling and the submission checklist PDF
- `src/cloud/`: Supabase client, encryption, merging, and the on-device key store
- `supabase/`: SQL for the tables, access rules and bug report emails
- `.github/workflows/`: deploy, and the Supabase keep-alive

## Open questions

- Are forms signed on screen accepted, by the diocese and by the state for the NSOR? The site tells volunteers to check
  with their LSEC, and print-and-sign is the default.
- The "Request for Driver Information Form" (for volunteers who drive) isn't published, so the site can't fill it in yet.
- The background check payment codes are kept off the public site; volunteers get them from the LSEC.
- The diocese publishes Spanish versions of some policies and forms (as Word files); the site is English-only.
