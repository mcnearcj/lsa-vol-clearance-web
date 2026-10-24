# Putting the Volunteer Clearances site on lsabear.com

This is the short version for the school webmaster. The site is a folder of ordinary web files. It has no server
program, database or accounts, and nothing a volunteer types is sent anywhere: their info stays in their own browser,
and the forms are filled in on their own computer.

You do not need git or the command line. You'll get a ready-made folder (a zip called `site.zip`) to upload.

## What we need to find out first

Please check these. Any "I don't know" is fine; tell me and I'll help find out.

1. **Finalsite.** Does your Finalsite plan let you add a custom HTML or "embed" block to a page, or upload an `.html`
   file and have it open as a web page? (Uploading a PDF doesn't count.) If yes, tell me and I'll make a one-file version.
2. **The domain.** Who manages the DNS for lsabear.com: the school, an IT provider, or Finalsite? Can they add one record
   for an address like `clearances.lsabear.com`?
3. **Cloudflare.** Does the school have its own Cloudflare account (not just the one Finalsite uses)? A free account is fine.
4. **Google.** Is there a Google Workspace admin who could help if we need it? (Google Sites can link to the site but
   can't host it.)

## Ways to put it online (easiest first)

### A. Cloudflare Pages (recommended)

Free, no git, and updating is drag and drop.

1. Sign in at dash.cloudflare.com and open **Workers & Pages**.
2. **Create application** → **Pages** → **Upload assets**. Name it (for example `lsa-clearances`).
3. Unzip `site.zip` and drag the **contents** of the folder into the upload box. Choose **Deploy**.
4. It's live at `lsa-clearances.pages.dev`. To use `clearances.lsabear.com`, open the project's **Custom domains** →
   **Set up a custom domain** and follow the prompt. If the school's DNS is on Cloudflare it does the rest; otherwise
   whoever manages DNS adds the one record it shows you.
5. Add a link or button to the site on the Finalsite volunteer page.

### B. Finalsite embed (only if question 1 is yes)

I'll send a single-file version to paste or upload. Test that the info choice on the first screen still works inside
the page; if the page is embedded in a frame, some browsers won't remember it. A normal link is more reliable.

### C. I host it, you link to it

If neither of the above works, I keep it online at my own address and you add a link on your volunteer page. No work
beyond the link for you.

## Updating it

The diocese updates its checklist and forms now and then. I'll watch for changes and send you a new `site.zip`. Do the
same four steps: Cloudflare Pages → the project → **Create new deployment** → drag in the new contents.

## After it's live, please check

- [ ] The page loads with a padlock (https) and shows the first screen about keeping info.
- [ ] A form opens, "Generate my documents" works, and Open and Download both work.
- [ ] Choosing "erase" and closing the tab leaves nothing behind when you reopen the site.
- [ ] The links to the diocese's pages open.
