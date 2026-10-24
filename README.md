# Volunteer Clearances: La Salle Academy (lsabear-custom)

A minimal version of the [Volunteer Clearances site](https://github.com/mcnearcj/lsa-vol-clearance-web) for
La Salle Academy volunteers working through the Diocese of Allentown's Safe Environment requirements. It is an unofficial
helper, not a diocesan site.

This `lsabear-custom` branch has no accounts, no cloud sync and no server: a volunteer reads the checklist and
step-by-step instructions, enters their details once, and gets filled-in forms plus a printable submission checklist.
Their info stays in their own browser, and the first screen asks whether to keep it on that computer or erase it
when the tab closes (default: erase). The comprehensive version (cloud sync, renewal tracking) is on `main`.

For the school's webmaster, see [HANDOFF.md](HANDOFF.md).

## Develop

```sh
npm ci
npm run dev       # local dev server
npm test
npm run lint
npm run build     # static site in dist/
```

Edit the school and coordinator in `src/data/site.ts`; checklist items in `src/data/requirements.ts`; blank forms in
`public/forms/` (same file names). Keep this branch up to date with `git merge main`.
