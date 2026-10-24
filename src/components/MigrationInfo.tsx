import { site } from '../data/site'

// A page for the school's webmaster, shown only on the demo site (it's switched on by the VITE_MIGRATION_INFO build setting,
// so the version that goes on the school's website doesn't have it).

const REPO = 'https://github.com/mcnearcj/lsa-vol-clearance-web/blob/lsabear-custom'

export function MigrationInfo() {
  return (
    <div className="help">
      <div className="page-intro">
        <h2>Migration info</h2>
        <p>
          This tab is for {site.schoolName}’s webmaster. It says where this stands and what it would take to put it on your website. It only appears on this demo,
          and won’t be on the version you’d publish.
        </p>
      </div>

      <section className="panel">
        <h3>If you’re still thinking about it, text me</h3>
        <p>
          I’m happy to answer questions, walk you through the setup, or change anything. That includes the wording, the look, the forms, or how it works, if there’s
          something you’d like different. Nothing here is final. Just text me.
        </p>
        <p className="small">Corey, the parent who built this</p>
      </section>

      <section className="panel">
        <h3>Where things stand</h3>
        <p>This is a working <strong>beta</strong>. It’s ready for you to try and judge, not yet something I’d call finished.</p>
        <ul>
          <li>
            <strong>What it does:</strong> it walks volunteers through each background check and training with the diocese’s steps and links, fills in the six
            diocese and state forms from details they enter once (to print and sign by hand, or sign on screen), and makes a one-page printable checklist of
            what to hand in. It’s styled to match lsabear.com.
          </li>
          <li>
            <strong>Privacy:</strong> nothing a volunteer types is sent to or kept on a server. It stays in their own browser, and they choose whether to keep it on
            that computer or erase it when they leave (erasing is the default). A Social Security Number is only used to fill in the files and is never saved.
          </li>
          <li>
            <strong>No accounts, no database, nothing to run.</strong> It’s a small folder of files.
          </li>
          <li>
            <strong>You can change it yourself, without coding.</strong> A separate editor file lets you change the wording, contacts, checklist items and forms, and add
            new forms. It has a live preview of the whole site.
          </li>
        </ul>
        <p className="small">What’s not done yet: it has been tried on a desktop browser and a narrow window, not on many phones. Nobody at the diocese has reviewed it.</p>
      </section>

      <section className="panel">
        <h3>Ways to put it on your website</h3>
        <p>
          The site is just files (about 3 MB), so almost any web host can serve it. Your school website is on Finalsite, which probably can’t host it directly, so
          the usual setup is a free host plus a link from your volunteer page. Here are the options, easiest first.
        </p>
        <ol>
          <li>
            <strong>Ask Finalsite first.</strong> Can your plan add a custom HTML or “embed” block, or upload an <code>.html</code> file that opens as a page? If it can,
            I can make a single-file version. If not, go to the next option.
          </li>
          <li>
            <strong>Cloudflare Pages (my suggestion).</strong> It’s free and needs no coding. In the Cloudflare dashboard you create a Pages project, choose
            “Upload assets”, and drag the site folder in. It gives you an address right away, and you can use an address like <code>clearances.lsabear.com</code> if
            whoever manages your domain adds one record. Then add a link or button from your volunteer page.
          </li>
          <li>
            <strong>I host it for now, and you link to it.</strong> That’s the least work for you, though the address won’t say lsabear.com unless you add a record.
          </li>
        </ol>
        <p>
          Not sure which fits? A host just needs to serve ordinary files over https and let you replace them. The one-page list of requirements is{' '}
          <a href={`${REPO}/HOSTING-REQUIREMENTS.md`} target="_blank" rel="noreferrer noopener">
            Hosting requirements<span className="ext" aria-label="(opens in a new tab)">↗</span>
          </a>
          .
        </p>
      </section>

      <section className="panel">
        <h3>Questions to find out</h3>
        <ul>
          <li>Who manages the lsabear.com domain (the school, an IT provider, or Finalsite)? Can they add one record for something like <code>clearances</code>?</li>
          <li>Does the school have its own Cloudflare account, or just the one Finalsite uses?</li>
          <li>Can your Finalsite plan embed custom HTML, or upload an <code>.html</code> file?</li>
          <li>Who at the school (and the diocese’s Safe Environment office, if needed) should approve a volunteer tool like this?</li>
          <li>Who will keep it up to date after launch?</li>
        </ul>
      </section>

      <section className="panel">
        <h3>Before it goes live</h3>
        <ul>
          <li>
            Compare the forms and checklist with the diocese’s current{' '}
            <a href={site.requirementsUrl} target="_blank" rel="noreferrer noopener">
              requirements<span className="ext" aria-label="(opens in a new tab)">↗</span>
            </a>{' '}
            and{' '}
            <a href={site.policiesUrl} target="_blank" rel="noreferrer noopener">
              policies<span className="ext" aria-label="(opens in a new tab)">↗</span>
            </a>{' '}
            pages. The site shows which revision it follows ({site.checklistName}, revised {site.checklistRevised}).
          </li>
          <li>Try it on a phone and on the browsers your families use. Fill in each form, print it, and check it by eye.</li>
          <li>Decide who is responsible for updates, and how often to check the diocese’s pages (the diocese does change its forms).</li>
        </ul>
      </section>

      <section className="panel">
        <h3>Keeping it current</h3>
        <p>
          When the diocese changes a form or a contact, you update it in the editor, save, and upload the new <code>data</code> folder. No developer needed. For a heads-up
          when the diocese changes a page, a free page-change monitor pointed at the two diocese pages above can email you.
        </p>
      </section>

      <section className="panel">
        <h3>More detail</h3>
        <ul>
          <li>
            <a href={`${REPO}/HANDOFF.md`} target="_blank" rel="noreferrer noopener">
              Handoff guide<span className="ext" aria-label="(opens in a new tab)">↗</span>
            </a>
            : step by step, including how to use the editor and add forms.
          </li>
          <li>
            <a href={`${REPO}/HOSTING-REQUIREMENTS.md`} target="_blank" rel="noreferrer noopener">
              Hosting requirements<span className="ext" aria-label="(opens in a new tab)">↗</span>
            </a>
          </li>
          <li>
            Once it’s on your site, you can link straight to the printable checklist with the site’s address followed by <code>#printable</code>.
          </li>
        </ul>
      </section>
    </div>
  )
}
