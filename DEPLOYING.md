# Deploying to another web server

The site is a set of static files: one `index.html`, a folder of JavaScript, CSS and fonts, and the PDFs in `forms/`.
There's no server code, database or PHP of its own, so any web server or static host can serve it. This guide covers
building it, the hosting options (including the school's own domain, **lsabear.com**), server settings, Cloud sync, and
moving volunteers over from the current GitHub Pages address.

## What the host needs

| Requirement | Why |
| --- | --- |
| **HTTPS** | Required. Browsers only allow the encryption used by Cloud sync (Web Crypto) on secure pages, and volunteers type personal details. Plain `http://` only works on `localhost`. |
| Serve static files | Nothing runs on the server. |
| Correct file types | `.js` → `text/javascript`, `.css` → `text/css`, `.woff2` → `font/woff2`, `.pdf` → `application/pdf`, `.svg` → `image/svg+xml`. Most servers already do this. |
| Any path | The build uses relative links, so it works at a domain's root (`https://clearances.lsabear.com/`) or in a folder (`https://example.org/volunteers/`) without changes. |

The site doesn't need URL rewrites or a "fallback to index.html" rule. It's one page and the tabs don't change the URL.

## 1. Build the files

You need [Node.js](https://nodejs.org) 22 or newer.

```sh
git clone https://github.com/mcnearcj/lsa-vol-clearance-web.git
cd lsa-vol-clearance-web
npm ci
cp .env.example .env.local   # only if you're turning on Cloud sync; fill in the two values (see section 4)
npm test                     # optional: make sure everything passes
npm run build
```

The finished site is in `dist/`. Upload **everything inside `dist/`**, keeping the folders as they are:

```
dist/
├── index.html
├── favicon.svg
├── assets/      (JavaScript, CSS, fonts; file names change on every build)
└── forms/       (the blank PDFs)
```

The Supabase values are built into the JavaScript, so set them **before** `npm run build`. If you change them later,
rebuild and upload again.

To check a build on your own computer before uploading it, run `npm run preview` and open the address it prints.

## 2. Pick where to host it

### lsabear.com runs on Finalsite

The school's website is on [Finalsite](https://www.finalsite.com), a hosted CMS behind Cloudflare. You can't usually
upload your own HTML and JavaScript folders to a Finalsite site, so the app can't simply live at a path like
`www.lsabear.com/volunteers/`. Ask the school's Finalsite admin, but expect to use one of these instead:

**Option A (recommended): a subdomain such as `clearances.lsabear.com`**

The site stays on a free static host and gets a lsabear.com address. Whoever manages the lsabear.com DNS (often in
Cloudflare, or the school's IT provider) adds one record. Then add a link or button on the Finalsite volunteer page.

- **GitHub Pages** (what it uses now; deploys itself on every push to `main`):
  1. In the repository, go to Settings → Pages → **Custom domain**, enter `clearances.lsabear.com` and save.
  2. Have the DNS admin add: `CNAME clearances → mcnearcj.github.io` (if it's in Cloudflare, set it to **DNS only**,
     the grey cloud, at least until GitHub has issued the certificate).
  3. Back in Settings → Pages, tick **Enforce HTTPS** once it's available (can take up to a day).

  With the Actions-based deploy, no `CNAME` file is needed in the repository.
- **Cloudflare Pages or Netlify** also work well and are free. Connect the repository with build command
  `npm run build`, output folder `dist`, Node 22, and add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as build
  environment variables. Each walks you through adding the custom domain. If you use one of these, turn off the GitHub
  Pages deploy (Settings → Pages) so there's only one live copy.

**Option B: a link from the school site.** Keep the current address and link to it from a Finalsite page. No setup,
but the address doesn't say lsabear.com.

**Avoid embedding it in a Finalsite page with an iframe.** Browsers keep an embedded site's saved data separate from
the same site opened directly (and Safari often blocks it), so volunteers would lose their info between visits. Opening
the filled-in PDFs from inside a frame is also unreliable. Link to the app instead.

### Any other web server (Apache, Nginx, IIS, shared hosting)

Build (section 1) and upload the contents of `dist/` by SFTP or the host's file manager to the folder that should serve
it. Then add the cache settings below.

## 3. Server settings

### Caching

Files in `assets/` have a fingerprint in their name and never change, so they can be cached for a year.
`index.html` must **not** be cached for long. Otherwise browsers keep loading an old page that points at files that no
longer exist after an update. (The site notices this and asks people to reload, but it's better avoided.) The PDFs in
`forms/` keep the same names when they're replaced, so give them a short cache too.

**Apache** (`.htaccess` in the same folder as `index.html`):

```apache
<IfModule mod_headers.c>
  <FilesMatch "\.html$">
    Header set Cache-Control "no-cache"
  </FilesMatch>
  <FilesMatch "\.pdf$">
    Header set Cache-Control "public, max-age=3600"
  </FilesMatch>
</IfModule>
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType text/javascript "access plus 1 year"
  ExpiresByType text/css "access plus 1 year"
  ExpiresByType font/woff2 "access plus 1 year"
</IfModule>
AddType font/woff2 .woff2
AddType text/javascript .js

# Send http:// visitors to https:// (skip if the host already does this)
RewriteEngine On
RewriteCond %{HTTPS} off
RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [R=301,L]
```

**Nginx** (inside the `server { … }` block for the HTTPS site):

```nginx
root /var/www/clearances;          # the folder holding index.html
index index.html;

location = /index.html { add_header Cache-Control "no-cache"; }
location /assets/      { add_header Cache-Control "public, max-age=31536000, immutable"; }
location /forms/       { add_header Cache-Control "public, max-age=3600"; }
```

If the site is in a subfolder, put that folder in the `location` paths (e.g. `/volunteers/assets/`).

**IIS** (`web.config` next to `index.html`):

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <staticContent>
      <remove fileExtension=".woff2" />
      <mimeMap fileExtension=".woff2" mimeType="font/woff2" />
    </staticContent>
  </system.webServer>
  <location path="index.html">
    <system.webServer>
      <staticContent><clientCache cacheControlMode="DisableCache" /></staticContent>
    </system.webServer>
  </location>
  <location path="assets">
    <system.webServer>
      <staticContent><clientCache cacheControlMode="UseMaxAge" cacheControlMaxAge="365.00:00:00" /></staticContent>
    </system.webServer>
  </location>
</configuration>
```

**Behind Cloudflare** (like lsabear.com): Cloudflare follows the headers above. If a Cache Rule caches HTML for the
whole zone, exclude the app's hostname or path from it, or purge the cache after every update.

### Security headers (optional)

The site works with strict headers. If the server or Cloudflare adds a Content Security Policy, it must allow the
Supabase project (for Cloud sync and bug reports) and the filled-in PDFs, which open as `blob:` links.
For example, with your own project URL:

```
Content-Security-Policy: default-src 'self'; connect-src 'self' https://YOUR-PROJECT.supabase.co; img-src 'self' data: blob:; frame-src blob:; object-src blob:; style-src 'self' 'unsafe-inline'; frame-ancestors 'self'
```

`X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` and HSTS are all fine. Test the
whole flow (fill in info, generate the documents, open and download them, sign in to Cloud sync, report a problem) after adding a policy.

## 4. Cloud sync and bug reports (Supabase)

Optional; see "Setting up Supabase" in the [README](README.md) for creating the project. When the site moves to a new
address:

1. In Supabase, **Authentication → URL Configuration**: set **Site URL** to the new address (e.g.
   `https://clearances.lsabear.com/`) and add `https://clearances.lsabear.com/**` under **Redirect URLs**. Keep the old
   address's entry until the old site is gone. Without this, the links in sign-up and password-reset emails send people
   to the wrong place.
2. Give the build the same `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (GitHub Actions variables, the static
   host's environment variables, or `.env.local` for a manual build). Use the **same** project as before so existing
   synced accounts keep working.
3. If the site is no longer built by GitHub Actions, the "Keep Supabase awake" workflow still needs those two
   repository variables. Leave them set, or the free project may pause after a week of little use.

## 5. Make it the school's own

Before going live, check these places for the school and the old address:

- [`src/data/site.ts`](src/data/site.ts): school name and LSEC contact.
- The "Live site" line at the top of the [README](README.md).
- `src/components/BugReport.tsx` and the links in `src/App.tsx` point to this GitHub repository (for reporting problems
  when Supabase isn't set up, and the "source code" link). Change them if the code moves to another repository.

## 6. Moving volunteers from the current address

Browsers keep saved data **per web address**. Info and progress saved at
`https://mcnearcj.github.io/lsa-vol-clearance-web/` won't appear at a new address on its own:

- **Volunteers who use Cloud sync** just sign in at the new address with the same email and password, and everything comes
  back.
- **Everyone else** has to enter their info again and re-mark finished items, or turn on Cloud sync at the old address first
  and then sign in at the new one.

Suggested switch-over: announce the new address, ask current users to turn on Cloud sync before the date, then keep the old
address running for a few weeks. If you no longer want it live, turn off GitHub Pages in the repository settings once
everyone has moved.

## Checklist after deploying

- [ ] The site loads at the new address over **https** with no browser warnings.
- [ ] Checklist instructions open their PDFs (from `forms/`).
- [ ] Forms to sign: "Generate my documents" works, and Open and Download both work.
- [ ] Reloading the page keeps the info you entered.
- [ ] Cloud sync (if set up): create an account, follow the email link, and confirm it opens the new address.
- [ ] Report a problem: a test report shows up in Supabase (and in your inbox, if emails are set up).
- [ ] After uploading a new build, the page shows the new version (no stale `index.html` from a cache).
