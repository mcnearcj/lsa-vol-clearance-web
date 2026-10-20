import { useCallback, useEffect, useRef, useState } from 'react'
import { BugReport } from './components/BugReport'
import { CloudPanel, type SyncStatus } from './components/CloudPanel'
import { ProfileForm } from './components/ProfileForm'
import { RequirementCard } from './components/RequirementCard'
import { FormsPanel } from './components/FormsPanel'
import { allFormFields } from './data/formFields'
import { groups, orderedRequirements } from './data/requirements'
import { site } from './data/site'
import { standing } from './dates'
import { saveFile } from './save'
import { STALE_EVENT, STALE_MESSAGE } from './staleBuild'
import { clearAllStored, useStored } from './storage'
import { emptyProfile, personName, type Progress, type Profile } from './types'

type Tab = 'checklist' | 'info' | 'sync' | 'help'

const tabs: [Tab, string][] = [
  ['checklist', 'Checklist'],
  ['info', 'My info'],
  ['sync', 'Sync'],
  ['help', 'Help'],
]

/** Email links from the sign-in service land with details in the hash; open the Sync tab for them. */
const initialTab = (): Tab => (/(access_token|error_description|type=recovery)/.test(window.location.hash) ? 'sync' : 'checklist')

const asset = (file: string) => `${import.meta.env.BASE_URL}${file}`

const syncDot: Partial<Record<SyncStatus, 'ok' | 'warn' | 'off'>> = {
  'signed-out': 'off',
  locked: 'warn',
  attention: 'warn',
  error: 'warn',
  saving: 'ok',
  saved: 'ok',
  manual: 'off',
}

const syncLabel: Record<SyncStatus, string> = {
  unavailable: '',
  'signed-out': 'Not synced',
  locked: 'Sync paused: sign in again',
  attention: 'Sync needs your attention',
  error: 'Sync couldn’t reach the server',
  saving: 'Syncing…',
  saved: 'Synced',
  manual: 'Automatic sync is off',
}

const timeOf = (iso: string) => {
  const d = new Date(iso)
  return d.toDateString() === new Date().toDateString()
    ? `at ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
    : `on ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
}

export default function App() {
  const [tab, setTabState] = useState<Tab>(initialTab)
  const [profile, setProfile] = useStored<Profile>('profile', emptyProfile)
  const [progress, setProgress] = useStored<Progress>('progress', {})
  const [ui, setUi] = useStored('ui', { introDismissed: false })
  const [message, setMessage] = useState('')
  const [confirmErase, setConfirmErase] = useState(false)
  const [sync, setSync] = useState<SyncStatus>('unavailable')
  const [syncAt, setSyncAt] = useState<string | null>(null)
  const [syncEmail, setSyncEmail] = useState<string | null>(null)
  const [confirmSwitch, setConfirmSwitch] = useState(false)
  const [cleared, setCleared] = useState(false)
  const [stale, setStale] = useState(false)
  const [remoteNote, setRemoteNote] = useState(false)
  const onRemoteUpdate = useCallback(() => setRemoteNote(true), [])
  useEffect(() => {
    if (!remoteNote) return
    const t = setTimeout(() => setRemoteNote(false), 8000)
    return () => clearTimeout(t)
  }, [remoteNote])
  useEffect(() => {
    const onStale = () => setStale(true)
    window.addEventListener(STALE_EVENT, onStale)
    return () => window.removeEventListener(STALE_EVENT, onStale)
  }, [])
  const [resetToken, setResetToken] = useState(0)
  const onSyncStatus = useCallback((s: SyncStatus, at: string | null, email: string | null) => {
    setSync(s)
    setSyncAt(at)
    setSyncEmail(email)
  }, [])
  const fileRef = useRef<HTMLInputElement>(null)

  // Where the person was when they chose "Report a problem", attached to the report.
  const [reportFrom, setReportFrom] = useState<string>('help')
  const [scrollToReport, setScrollToReport] = useState(false)

  const setTab = (t: Tab) => {
    setTabState(t)
    window.scrollTo({ top: 0 })
  }

  const openReport = () => {
    setReportFrom(tab)
    setTabState('help')
    setScrollToReport(true)
  }

  useEffect(() => {
    if (!scrollToReport || tab !== 'help') return
    const el = document.getElementById('report')
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    el?.querySelector('textarea')?.focus({ preventScroll: true })
    setScrollToReport(false) // eslint-disable-line react-hooks/set-state-in-effect
  }, [scrollToReport, tab])

  const st = (id: string) => standing(orderedRequirements.find((r) => r.id === id)!, progress[id]).standing
  // The signable forms are made together in "Forms to sign" and count as one item; the rest are tracked one by one.
  const tracked = orderedRequirements.filter((r) => st(r.id) !== 'na')
  const formsDone = progress.forms?.status === 'done'
  const total = tracked.length + 1
  const doneCount = tracked.filter((r) => ['current', 'expiring'].includes(st(r.id))).length + (formsDone ? 1 : 0)
  const renew = tracked.filter((r) => ['expiring', 'expired'].includes(st(r.id))).length
  const allDone = doneCount === total && renew === 0
  const pct = Math.round((doneCount / total) * 100)

  const goToForms = () => {
    setTabState('checklist')
    requestAnimationFrame(() => document.getElementById('forms')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const infoFilled = allFormFields.filter((k) => String(profile[k]).trim()).length
  const hasName = Boolean(profile.firstName.trim() && profile.lastName.trim())
  const who = personName(profile)
  const hasData = Boolean(who) || Object.keys(progress).length > 0

  const exportBackup = () => saveFile('volunteer-clearances-backup.json', JSON.stringify({ profile, progress }, null, 2), 'application/json')

  const importBackup = async (file: File) => {
    try {
      const data = JSON.parse(await file.text())
      if (!data.profile && !data.progress) throw new Error()
      if (data.profile) setProfile({ ...emptyProfile, ...data.profile })
      if (data.progress) setProgress(data.progress)
      setMessage('Backup restored. Your info and checklist are back.')
    } catch {
      setMessage('That file isn’t a backup from this site. Choose the .json file you downloaded here.')
    }
  }

  const eraseAll = () => {
    clearAllStored()
    setProfile(emptyProfile)
    setProgress({})
    setUi({ introDismissed: false })
    setResetToken((n) => n + 1)
    setConfirmErase(false)
    setConfirmSwitch(false)
    setCleared(true)
    setMessage('Everything was erased from this device.')
  }

  return (
    <div className="app">
      <header className="masthead">
        <div className="masthead-inner">
          <p className="kicker">{site.schoolName} · Diocese of Allentown</p>
          <h1>Volunteer Clearances</h1>
        </div>
        <nav className="tabs" aria-label="Sections">
          {tabs.map(([id, label]) => (
            <button key={id} aria-current={tab === id ? 'page' : undefined} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
              {label}
              {id === 'sync' && syncDot[sync] && <span className={`tab-dot ${syncDot[sync]}`} aria-label={syncLabel[sync]} />}
            </button>
          ))}
        </nav>
      </header>

      <div className="prototype" role="note">
        <p>
          <strong>Early prototype.</strong> This site may have bugs. Check each filled-in form before you submit it.{' '}
          <button className="link" onClick={openReport}>
            Report a problem
          </button>
        </p>
      </div>

      <main>
        {stale && (
          <div className="notice stale" role="alert">
            <p>{STALE_MESSAGE}</p>
            <button className="primary" onClick={() => window.location.reload()}>
              Reload page
            </button>
          </div>
        )}

        {remoteNote && (
          <p className="notice ok" role="status">
            Updated with changes from your other device.
          </p>
        )}

        {cleared && !hasData && !syncEmail && (
          <p className="notice ok" role="status">
            This computer is cleared. No one’s info is loaded. Add your own under My info.
          </p>
        )}

        {(hasData || syncEmail) && (
          <section className={`person${confirmSwitch ? ' confirming' : ''}`} aria-label="Whose info is on this device">
            <p>
              <span className="avatar" aria-hidden>
                {(who || syncEmail || '?').slice(0, 1).toUpperCase()}
              </span>
              <span>
                {who ? (
                  <>
                    Showing info for <strong>{who}</strong>
                  </>
                ) : (
                  <>Showing a checklist with no name yet</>
                )}
                {syncEmail && <span className="person-sub"> · Synced as {syncEmail}</span>}
              </span>
              {!confirmSwitch && (
                <button className="link" onClick={() => setConfirmSwitch(true)}>
                  Not you?
                </button>
              )}
            </p>
            {confirmSwitch && (
              <div className="switch">
                <p>
                  Clear {who ? `${who}’s` : 'this'} info and checklist from this computer so you can start your own? {syncEmail ? 'Their synced copy stays safe online, and they’ll be signed out here.' : 'If it isn’t backed up, it can’t be recovered.'}
                </p>
                <div className="row">
                  <button className="danger" onClick={eraseAll}>
                    Clear and start fresh
                  </button>
                  <button className="ghost" onClick={() => setConfirmSwitch(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {tab === 'checklist' && (
          <>
            <section className="overview" aria-label="Your progress">
              <div className="overview-top">
                <div>
                  <p className="big">
                    {doneCount}
                    <span> of {total} done</span>
                  </p>
                  {renew > 0 && <p className="warn-text">{renew === 1 ? '1 item needs renewing' : `${renew} items need renewing`}</p>}
                </div>
                {!hasName && (
                  <button className="secondary" onClick={() => setTab('info')}>
                    Add my info
                  </button>
                )}
              </div>
              <div className="bar" role="progressbar" aria-label="Checklist progress" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div style={{ width: `${pct}%` }} />
              </div>
              {sync !== 'unavailable' && (
                <p className="sync-status">
                  <span className={`dot ${syncDot[sync] ?? 'off'}`} aria-hidden />
                  <span>{sync === 'saved' && syncAt ? `Synced ${timeOf(syncAt)}` : syncLabel[sync]}</span>
                  {['signed-out', 'locked', 'attention', 'error', 'manual'].includes(sync) && (
                    <button className="link" onClick={() => setTab('sync')}>
                      {sync === 'signed-out' ? 'Set up sync' : sync === 'manual' ? 'Sync settings' : 'Fix this'}
                    </button>
                  )}
                </p>
              )}
            </section>

            {!ui.introDismissed && (
              <section className="intro" aria-labelledby="intro-h">
                <div className="intro-head">
                  <h2 id="intro-h">Start here</h2>
                  <button className="ghost small-btn" onClick={() => setUi({ introDismissed: true })}>
                    Hide
                  </button>
                </div>
                <ol>
                  <li>
                    <strong>Add your info once.</strong> The site fills it into your forms.{' '}
                    <button className="link" onClick={() => setTab('info')}>
                      {infoFilled ? `My info (${infoFilled} of ${allFormFields.length} filled)` : 'Go to My info'}
                    </button>
                  </li>
                  {sync !== 'unavailable' && (
                    <li>
                      <strong>Sign in to sync your progress.</strong> Use it on any device. Free, and only you can read it.{' '}
                      {sync === 'signed-out' ? (
                        <button className="link" onClick={() => setTab('sync')}>
                          Set up sync
                        </button>
                      ) : (
                        <span className="small">Done.</span>
                      )}
                    </li>
                  )}
                  <li>
                    <strong>Start the background checks early.</strong> Some take 2–3 weeks to come back.
                  </li>
                  <li>
                    <strong>Make your forms.</strong> They’re filled in for you: print and sign them, or sign on screen.{' '}
                    <button className="link" onClick={goToForms}>
                      Go to Forms to sign
                    </button>
                  </li>
                  <li>
                    <strong>Give everything to {site.lsec.name},</strong> {site.schoolName}’s Local Safe Environment Coordinator (LSEC).
                  </li>
                </ol>
              </section>
            )}

            <aside className="who-needs" aria-label="Which requirements apply to you">
              <p>
                <strong>Not sure what you need?</strong> School volunteers need everything below. The diocese also allows “limited” volunteers, whose duties are strictly limited and who aren’t in a leadership role, to do a shorter list: the forms, Protecting God’s Children, and the driver form if they drive. If you’re not sure which you are, ask {site.lsec.name} before you start.{' '}
                <button className="link" onClick={() => setTab('help')}>
                  More in Help
                </button>
              </p>
            </aside>

            {allDone && (
              <section className="next all-done">
                <h2>You’re all set</h2>
                <p>Everything is complete. Come back when something is close to its renewal date.</p>
              </section>
            )}

            {groups.map((g) => {
              const items = orderedRequirements.filter((r) => r.group === g.id)
              const gDone = g.id === 'sign' ? (formsDone ? 1 : 0) : items.filter((r) => ['current', 'expiring', 'na'].includes(st(r.id))).length
              const gTotal = g.id === 'sign' ? 1 : items.length
              return (
                <section key={g.id} className="group" aria-labelledby={`g-${g.id}`}>
                  <div className="group-head">
                    <h2 id={`g-${g.id}`}>{g.title}</h2>
                    <span className="count">
                      {gDone}/{gTotal}
                    </span>
                  </div>
                  <p className="group-intro">{g.intro}</p>
                  {g.id === 'sign' ? (
                    <FormsPanel
                      profile={profile}
                      progress={progress}
                      onFormsProgress={(p) => setProgress({ ...progress, forms: p })}
                      onEditInfo={() => setTab('info')}
                    />
                  ) : (
                    <ul className="cards">
                      {items.map((r) => (
                        <RequirementCard
                          key={r.id}
                          req={r}
                          progress={progress[r.id]}
                          onChange={(p) => setProgress({ ...progress, [r.id]: p })}
                          onGoToForms={goToForms}
                        />
                      ))}
                    </ul>
                  )}
                </section>
              )
            })}
          </>
        )}

        {tab === 'info' && <ProfileForm profile={profile} onChange={setProfile} onDone={() => setTab('checklist')} />}

        <div hidden={tab !== 'sync'}>
          <div className="page-intro">
            <h2>Sync</h2>
            <p>Sign in to keep your info and checklist in sync across your phone and computer, and safe if you clear your browser.</p>
          </div>

          {/* Stays mounted so an unlocked sync session survives switching tabs. */}
          <CloudPanel
            profile={profile}
            progress={progress}
            onStatus={onSyncStatus}
            onRemoteUpdate={onRemoteUpdate}
            resetToken={resetToken}
            onRestore={(d) => {
              setProfile({ ...emptyProfile, ...d.profile })
              setProgress(d.progress ?? {})
            }}
          />

          <section className="panel">
            <h3>Backup file</h3>
            <p>Prefer not to sign in? Download a file and keep it somewhere private. It contains your name, address and the other details you entered.</p>
            <div className="row">
              <button className="secondary" onClick={exportBackup}>
                Download backup file
              </button>
              <button className="ghost" onClick={() => fileRef.current?.click()}>
                Restore from a file
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void importBackup(f)
                  e.target.value = ''
                }}
              />
            </div>
            {message && tab === 'sync' && (
              <p className="notice ok" role="status">
                {message}
              </p>
            )}
          </section>
        </div>

        {tab === 'help' && (
          <div className="help">
            <div className="page-intro">
              <h2>Help</h2>
              <p>
                This site follows the diocese’s{' '}
                <a href={asset('forms/requirements-checklist.pdf')} target="_blank" rel="noreferrer noopener">
                  {site.checklistName} (PDF, revised {site.checklistRevised})
                </a>
                . Its policies and forms come from the diocese’s{' '}
                <a href={site.policiesUrl} target="_blank" rel="noreferrer noopener">
                  Safe Environment Policies page
                </a>
                . It’s a helper, not an official diocesan site. Your coordinator has the final word on what you need.
              </p>
            </div>

            <section className="panel">
              <h3>Who to ask</h3>
              <p>
                Start with {site.schoolName}’s <strong>Local Safe Environment Coordinator (LSEC)</strong>, who gives out payment codes for the background checks and collects your finished paperwork.
              </p>
              <address>
                {site.lsec.name}, LSEC, {site.schoolName}
                <br />
                <span className="select">{site.lsec.email}</span>
              </address>
              <p>For questions they can’t answer, the diocese’s contact on its forms is:</p>
              <address>
                Janice Woolley, Background Check / Audit &amp; Training Supervisor
                <br />
                Diocese of Allentown, PO Box F, Allentown, PA 18105-1538
                <br />
                610-871-5200 ext. 2258 · <span className="select">jwoolley@allentowndiocese.org</span>
              </address>
            </section>

            <section className="panel">
              <h3>Questions</h3>
              <dl className="faq">
                <dt>Do I need to do everything on this list?</dt>
                <dd>
                  It depends on your role. The diocese’s{' '}
                  <a href={asset('forms/requirements-checklist.pdf')} target="_blank" rel="noreferrer noopener">
                    {site.checklistName}
                  </a>{' '}
                  says all school volunteers need everything here, except the driver form, which is only for people who drive for the school. The FBI fingerprint check is for volunteers 18 and older.
                  <br />
                  <br />
                  The diocese also has a{' '}
                  <a href={site.limitedChecklistUrl} target="_blank" rel="noreferrer noopener">
                    Limited Volunteer checklist
                  </a>{' '}
                  for volunteers whose duties are strictly limited and who don’t serve in a leadership role. They need only the four policy acknowledgments (Sexual Abuse, Code of Conduct, Social Media, CPSL), Protecting God’s Children, and the driver form if they drive: no background checks or Mandated Reporter training.
                  <br />
                  <br />
                  <strong>If you’re not sure which applies to you, ask {site.lsec.name} ({site.lsec.email}) before you start.</strong> Your school decides who counts as a limited volunteer.
                </dd>
                <dt>How often do I renew?</dt>
                <dd>Background checks and the Mandated Reporter training last 5 years. Mark an item done with the date you completed it and the site shows its renewal date. Protecting God’s Children is a one-time training.</dd>
                <dt>Which forms need my Social Security Number?</dt>
                <dd>
                  Of the forms this site fills in, only the <strong>NSOR application</strong> (the state requires it). The <strong>Background Check Authorization</strong> asks for it from employees only, so volunteers leave it blank. The acknowledgment forms don’t ask for it.
                  <br />
                  <br />
                  Two of the state’s online systems also ask for it when you apply there: the <strong>Child Abuse History</strong> clearance (include it, or your results take longer) and <strong>PATCH</strong> (optional, but recommended).
                </dd>
                <dt>How is my Social Security Number handled here?</dt>
                <dd>It’s only asked for under “Forms to sign”, and only to fill in the files you make there. It’s never saved on your device, synced, or sent anywhere. Leave it blank there to write it on the printed form by hand instead.</dd>
                <dt>Where is my information kept?</dt>
                <dd>In this browser on this device. Forms are filled in on your device too. If you sign in, your info is also synced online, scrambled with your password before it leaves your device so only you can read it. You can turn sync off on the Sync page.</dd>
                <dt>Why did my sign-in email come from Supabase?</dt>
                <dd>
                  Supabase is the service this site uses to run accounts and store synced copies. Confirmation and password reset emails come from Supabase Auth (noreply@mail.app.supabase.io). They’re safe to open. If you don’t see one, check your spam folder.
                </dd>
                <dt>I’m using a shared computer. Is that OK?</dt>
                <dd>
                  Yes. The easiest way is a private window (called Incognito in Chrome, InPrivate in Edge, or Private Browsing in Safari and Firefox). Everything you enter is cleared when you close it, so sign in to Sync first if you want to keep your progress.
                  <br />
                  <br />
                  In a normal window, your info stays on the computer until you clear it. Check the name at the top of each page, and when you’re done, choose “Not you?” or “Erase my data” below. If you see someone else’s name, choose “Not you?” to start fresh.
                </dd>
                <dt>Who made this, and how does it work?</dt>
                <dd>
                  It’s a free, open project. All of the code is public on{' '}
                  <a href="https://github.com/mcnearcj/lsa-vol-clearance-web" target="_blank" rel="noreferrer noopener">
                    GitHub
                  </a>
                  , including how forms are filled in and how sync is encrypted.
                </dd>
              </dl>
            </section>

            <section className="panel" id="report" aria-labelledby="report-h">
              <h3 id="report-h">Report a problem</h3>
              <p>This is an early prototype. If something looks wrong, like a form filled in the wrong place, a confusing step or a broken button, please tell us.</p>
              <BugReport page={reportFrom} />
            </section>

            <section className="panel">
              <h3>Erase my data</h3>
              <p>Removes your info and checklist from this browser and signs you out of sync here. It doesn’t delete your synced copy; do that on the Sync page.</p>
              <div className="row">
                {confirmErase ? (
                  <>
                    <button className="danger" onClick={eraseAll}>
                      Yes, erase everything
                    </button>
                    <button className="ghost" onClick={() => setConfirmErase(false)}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <button className="ghost danger-text" onClick={() => setConfirmErase(true)}>
                    Erase my data from this device
                  </button>
                )}
              </div>
              {message && tab === 'help' && (
                <p className="notice ok" role="status">
                  {message}
                </p>
              )}
            </section>
          </div>
        )}
      </main>

      <footer className="foot">
        <p>
          Not an official Diocese of Allentown website. Policies and forms from the diocese’s{' '}
          <a href={site.policiesUrl} target="_blank" rel="noreferrer noopener">
            Safe Environment Policies page
          </a>
          ; requirements from its {site.checklistName}, revised {site.checklistRevised}.
        </p>
        <p>
          <button className="link" onClick={openReport}>
            Report a problem
          </button>
          {' · '}
          <a href="https://github.com/mcnearcj/lsa-vol-clearance-web" target="_blank" rel="noreferrer noopener">
            See how this site is built on GitHub
          </a>
        </p>
      </footer>
    </div>
  )
}
