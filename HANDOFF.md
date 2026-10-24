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

## Updating the wording, contacts and forms (no coding)

Everything a school might need to change is edited in a separate program, **the site editor** (`editor.html`). It's one
file you keep on your own computer and open by double-clicking. It is **not** uploaded to the website, so nobody else
can use it. Nothing it does goes live until you upload the file it makes.

You can change: the school name, coordinator and diocese contact; how the page looks at the top and bottom (the crest,
tagline, school website link, footer address and phone); the diocese's checklist name, date and links; every
checklist item (steps, links, instruction sheets); the forms; the questions on the Help page; and extra details the
site asks volunteers for ("My info").

**Each time:**

1. Open `editor.html` on a computer (it isn't made for phones or tablets). Type your website's address and click
   **Load from my website**. The editor reads the site's current settings and forms, so you start from what volunteers
   see now. You can switch to **Open a settings file instead** and choose the `content.json` from your site folder's
   `data` folder if loading from the address doesn't work. If the site has no settings of its own yet, it starts from
   the built-in ones.
2. Make your changes. Click **Preview the site** at any time: a new tab opens with the real site, showing your unsaved
   changes and updating as you edit (including forms you've just attached). Nothing in the preview is saved or sent
   anywhere. Your browser may ask you to allow pop-ups for the editor the first time. The **Save** tab shows exactly
   what changed (click a heading to see the details) and warns about anything missing.
3. Click **Download site-data.zip** and unzip it. You get a folder named `data`.
4. Put that `data` folder into your site folder, next to `index.html`, replacing the old one.
5. Upload the whole site folder to the host (for Cloudflare Pages: your project → **Create deployment** → drag the folder in).
6. Open the website and check the Help page.

**Keep one site folder** (the unzipped `site.zip` plus its `data` folder) on your computer. Uploading it replaces the
whole site, so it must always contain the `data` folder, or your changes disappear.

### How the site looks

The page is styled to match the school's own website (navy and sky-blue colors, the same fonts, a header with the crest and
a footer with the address). The fonts are part of the site. **The crest is loaded from the school's own website** each
time the page opens, so the site doesn't contain a copy of it. To use a different crest, or none, change or clear
**Logo** under School and contacts. Clearing the tagline, address or phone leaves that part out.

### Adding or changing a form

Pick the kind that fits the PDF:

| The PDF… | Choose | What you do |
| --- | --- | --- |
| is just a page to print and fill in by hand | **A PDF to print** | Give it a name. Either attach the PDF or paste the diocese's web address; volunteers open it from there. |
| has fill-in boxes (click in it and text boxes light up) | **A PDF that has fill-in fields** | Attach it. The editor lists the boxes and you choose what goes in each one (name, address, date, signature…). |
| has no boxes, or is a scan | **A PDF without fields** | Attach it. Click and drag a box over each line on the page, then choose what goes in it. For a check box or circle, draw a small box over it and choose "X mark" or "Filled dot". |

In the box-placing view the page is on the left and the controls are on the right. Drag on the page to draw a box,
drag a box to move it, and drag its edges or corners to resize it. Each box is labeled with what goes in it.

Every form has a **Preview with sample information** button, and **Preview the site** shows the whole site. Always use it before saving: it fills the form with made-up
details so you can see whether everything lands on its line. Allow 15 to 30 minutes for a new form without boxes.

If the form needs something the site doesn't ask for yet (a shoe size, a car's plate number), add it first under
**My info details**, then pick it when you set up the form. Mark it "never save" for anything private; the site then asks
for it only when making the files.

**When the diocese changes a form:** download the new PDF from the diocese's page, open the form in the editor, and
click **Replace the PDF**, then preview it. If the form has fields, check that each one still gets the right answer.
If you placed the boxes yourself and the new page is laid out differently, move or redraw the boxes. Do the same for
the checklist PDF under **Diocese checklist**, and update the "revised on" date and the "last compared" date.

**The six built-in forms** (Sexual Abuse, Code of Conduct, Social Media, CPSL, Background Check Authorization and NSOR)
have their layouts built into the site. You can change their wording and links, and swap in a revised PDF only if its
layout hasn't changed. If a built-in form's layout changes, ask a technical person, or remove it here and add the new
version as a form you place yourself.

### If something goes wrong

- The site always opens even if the settings file has a mistake: it falls back to the built-in settings. If your changes
  don't appear, re-open the editor, check the **Save** tab for warnings, and upload again.
- Keep the last `site-data.zip` that worked. Uploading it again puts things back.

## Updating the site itself

When the site's code changes, I'll send a new `site.zip`. Unzip it into a fresh folder, copy your `data` folder into it,
and upload that folder the same way. The editor file stays the same unless I send a new one.

For which kinds of web hosting work, see [HOSTING-REQUIREMENTS.md](HOSTING-REQUIREMENTS.md).

## After it's live, please check

- [ ] The page loads with a padlock (https) and shows the first screen about keeping info.
- [ ] A form opens, "Generate my documents" works, and Open and Download both work.
- [ ] Choosing "erase" and closing the tab leaves nothing behind when you reopen the site.
- [ ] The links to the diocese's pages open.
- [ ] After your first edit in the editor: the change shows on the website (check the Help page).
