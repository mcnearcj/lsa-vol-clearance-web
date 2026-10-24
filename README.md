# Volunteer Clearances: La Salle Academy (lsabear-custom)

A minimal version of the [Volunteer Clearances site](https://github.com/mcnearcj/lsa-vol-clearance-web) for
La Salle Academy volunteers working through the Diocese of Allentown's Safe Environment requirements. It is an unofficial
helper, not a diocesan site.

This `lsabear-custom` branch has no accounts, no cloud sync and no server: a volunteer reads the checklist and
step-by-step instructions, enters their details once, and gets filled-in forms plus a printable submission checklist.
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
place, move and resize boxes on a PDF with a live preview, shows a detailed collapsible list of changes, and downloads `site-data.zip` (a `data/` folder to copy next to `index.html`). It is not part of the
published site. `npm run build:all` builds both.

Edit the built-in settings directly in `src/data/` for changes you want everywhere; blank forms live in `public/forms/`.
Keep this branch up to date with `git merge main`.
