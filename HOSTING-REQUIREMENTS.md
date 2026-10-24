# What a web host needs to run this site

For the school's webmaster, or whoever takes over the website. It lists what the site needs, so you can check a host
(or ask its support) before choosing one. The site is only files; there is no program to install.

## Must have

| Need | Why |
| --- | --- |
| **HTTPS** (the address starts with `https://`) | The signature pad and PDF features need a secure page, and volunteers type personal details. |
| **Serves ordinary files from a folder** | The site is one `index.html`, scripts, styles, fonts and PDFs. Nothing runs on the server. |
| **Correct file types** | `.html`, `.js` (JavaScript), `.css`, `.json`, `.woff2` fonts, `.pdf`, `.svg`. Most hosts already do this. |
| **You can upload and replace files** | Updating means uploading the site folder again, including its `data` folder (`data/content.json` and any PDFs you add). |
| **About 40 files, about 3 MB** | Very small. Any plan is big enough. |

## Not needed

A database, PHP or any server programming language, email sending, logins or accounts, a build step, or any
subscription feature. Volunteers' details are never sent to the host: they stay in their own browser.

## Nice to have

- **Don't cache `index.html` or `data/content.json` for long.** Otherwise an update can take a while to show. The site
  already adds a changing number to its request for `content.json` to get around caches, so this is a convenience.
- **Works at a domain's root or in a folder** (`https://clearances.example.org/` or `https://example.org/volunteers/`).
  It does either with no changes. It needs no URL rewrite rules.
- **Lets other pages read the `data` and `forms` folders (CORS).** The site editor loads your current settings from
  your website's address. That only works if the host allows it. GitHub Pages does by default. For Cloudflare Pages and
  Netlify the site includes a `_headers` file that turns it on. On other hosts, ask support to send the header
  `Access-Control-Allow-Origin: *` for files under `data/` and `forms/`. If it isn't possible, the editor still works:
  open the `content.json` file instead of typing the address.
- A custom address such as `clearances.yourschool.org`, which needs one DNS record from whoever manages the domain.

## What won't work

- **A page builder that only accepts its own pages** (many school website systems). You can usually link to the site from
  such a page, but not host it inside the system.
- **Embedding the site inside another page** (an iframe). Browsers keep an embedded site's saved data separate, and
  some block it, so volunteers can lose what they entered. Link to the site instead.
- **Plain `http://`** addresses.

## What we have actually tried

| Host | Result |
| --- | --- |
| GitHub Pages | Works. |
| Cloudflare Pages (drag-and-drop upload) | Works. |
| Everything else, including school website systems and Google Sites | **Not tested.** Treat the "Must have" table as the test: if a host can do all of it, the site should run there. |

## If your host can't serve a `.json` file

Tell whoever maintains the site. The settings can instead be placed inside `index.html`, which every host can serve.
