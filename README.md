# Volunteer Clearances: La Salle Academy (lsabear-custom)

A minimal version of the [Volunteer Clearances site](https://github.com/mcnearcj/lsa-vol-clearance-web) for
La Salle Academy volunteers working through the Diocese of Allentown's Safe Environment requirements. It is an unofficial
helper, not a diocesan site.

This `lsabear-custom` branch has no accounts, no cloud sync and no server: a volunteer reads the checklist and
step-by-step instructions, enters their details once, and gets filled-in forms plus a blank printable checklist (made from the site's current content, no personal info).
Their info stays in their own browser, and the first screen asks whether to keep it on that computer or erase it
when the tab closes (default: erase). The comprehensive version (cloud sync, renewal tracking) is on `main`.

For the school's webmaster, see [HANDOFF.md](HANDOFF.md) (including how to update the site without code) and
[HOSTING-REQUIREMENTS.md](HOSTING-REQUIREMENTS.md).

## Develop

```sh
npm ci
npm run dev       # local dev server
npm test
npm run lint
npm run build     # static site in dist/
```

## Look

`src/index.css` follows lsabear.com: navy `#0d1d5b`, sky blue `#5eb1e6`, Source Sans 3 (text) and Oswald (navigation and
buttons), both bundled, a header with the crest and a footer with the address (`src/components/SiteChrome.tsx`). The
crest, tagline, school link, address and phone are optional settings (`school.logoUrl` etc.); the crest is loaded from the
school's own website, not stored here. It is always light (no dark theme), to stay with the school's site.

## The demo site's Migration info tab

`VITE_DEV_SITE=1 npm run build` adds a "Development Site - Work in Progress" banner and a "Migration info" tab (`src/components/MigrationInfo.tsx`) for the school's
webmaster; `…/#migration` opens it directly. `/home/corey/dev/deploy-lsa-dev.sh` builds the demo with it. A normal
`npm run build` (and `site.zip`) has no trace of it.

## Content

The school, coordinator, checklist items, forms, extra "My info" details and Help questions are the **built-in settings**
in `src/data/` (`site.ts`, `requirements.ts`, `forms.ts`, `faq.ts`, `formFields.ts`). At start-up the site also reads
`data/content.json` (next to `index.html`) and uses it instead when it's valid, so a school can change all of that
without rebuilding. The shape and checks are in `src/content/schema.ts`; `src/content/load.ts` and `apply.ts` load it.
A missing or invalid file falls back to the built-in settings.

Forms are one of four kinds: `built-in` (the six layouts in `src/pdf/fill.ts`), `download` (print only), `fillable` (a PDF with
fields mapped to My info) and `placed` (boxes positioned on any PDF).

## The site editor

`npm run build:editor` writes `dist-editor/editor.html`, one self-contained file (`src/editor/`) that opens by
double-clicking. It loads the current settings from the live site's address (needs CORS on `data/` and `forms/`; `public/_headers`
does this for Cloudflare Pages and Netlify) or from a `content.json` file, lets the user attach PDFs, map PDF fields,
place, move and resize boxes on a PDF with a live preview, shows a detailed collapsible list of changes, opens a live preview of the real site, and downloads `site-data.zip` (a `data/` folder to copy next to `index.html`). It is not part of the
published site. `npm run build:all` builds the site, then the editor.

The preview is the real site (`src/preview/`, built by `npm run build:preview` into `dist-preview/preview.html`) embedded in
`editor.html`. The editor opens it in a new tab and posts it the unsaved content and attached PDFs; the preview accepts
messages only from the window that opened it. `src/content/assets.ts` is how it finds PDFs (from the live site, or from
PDFs attached in the editor). `npm run build:editor` builds the preview first.

Edit the built-in settings directly in `src/data/` for changes you want everywhere; blank forms live in `public/forms/`.
Keep this branch up to date with `git merge main`.
