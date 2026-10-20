import { useCallback, useEffect, useRef, useState } from 'react'
import { BugReport } from './components/BugReport'
import { CloudPanel, type BackupStatus } from './components/CloudPanel'
import { ProfileForm } from './components/ProfileForm'
import { RequirementCard } from './components/RequirementCard'
import { allFormFields } from './data/formFields'
import { groups, orderedRequirements } from './data/requirements'
import { standing, type Standing } from './dates'
import { saveFile } from './save'
import { clearAllStored, useStored } from './storage'
import { emptyProfile, type Progress, type Profile } from './types'

type Tab = 'checklist' | 'info' | 'backup' | 'help'

const tabs: [Tab, string][] = [
  ['checklist', 'Checklist'],
  ['info', 'My info'],
  ['backup', 'Sync'],
  ['help', 'Help'],
]

/** Email links from the sign-in service land with details in the hash; open the Backup tab for them. */
const initialTab = (): Tab => (/(access_token|error_description|type=recovery)/.test(window.location.hash) ? 'backup' : 'checklist')

const asset = (file: string) => `${import.meta.env.BASE_URL}${file}`

const backupDot: Partial<Record<BackupStatus, 'ok' | 'warn' | 'off'>> = {
  'signed-out': 'off',
  locked: 'warn',
  attention: 'warn',
  error: 'warn',
  saving: 'ok',
  saved: 'ok',
  manual: 'off',
}

const backupLabel: Record<BackupStatus, string> = {
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
  const [backup, setBackup] = useState<BackupStatus>('unavailable')
  const [backupAt, setBackupAt] = useState<string | null>(null)
  const [resetToken, setResetToken] = useState(0)
  const onBackupStatus = useCallback((s: BackupStatus, at: string | null) => {
    setBackup(s)
    setBackupAt(at)
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
  const counted = orderedRequirements.filter((r) => st(r.id) !== 'na')
  const doneCount = counted.filter((r) => ['current', 'expiring'].includes(st(r.id))).length
  const renew = counted.filter((r) => ['expiring', 'expired'].includes(st(r.id))).length
  const allDone = counted.length > 0 && doneCount === counted.length && renew === 0
  const pct = counted.length ? Math.round((doneCount / counted.length) * 100) : 0

  // The most useful thing to do next: anything expired, then anything started, then the first not started, then anything expiring.
  const nextUp = (['expired', 'started', 'todo', 'expiring'] as Standing[])
    .map((s) => orderedRequirements.find((r) => st(r.id) === s))
    .find(Boolean)

  const infoFilled = allFormFields.filter((k) => String(profile[k]).trim()).length
  const hasName = Boolean(profile.firstName.trim() && profile.lastName.trim())

  const exportBackup = () => void saveFile('volunteer-clearances-backup.json', JSON.stringify({ profile, progress }, null, 2), 'application/json')

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
    setMessage('Everything was erased from this device.')
  }

  return (
    <div className="app">
      <header className="masthead">
        <div className="masthead-inner">
          <p className="kicker">Diocese of Allentown · Safe Environment</p>
          <h1>Volunteer Clearances</h1>
        </div>
        <nav className="tabs" role="tablist" aria-label="Sections">
          {tabs.map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
              {label}
              {id === 'backup' && backupDot[backup] && <span className={`tab-dot ${backupDot[backup]}`} aria-label={backupLabel[backup]} />}
            </button>
          ))}
        </nav>
      </header>

      <div className="prototype" role="note">
        <p>
          <strong>Early prototype.</strong> This site may have bugs. Check each filled-in form before you sign it.{' '}
          <button className="link" onClick={openReport}>
            Report a problem
          </button>
        </p>
      </div>

      <main>
        {tab === 'checklist' && (
          <>
            <section className="overview" aria-label="Your progress">
              <div className="overview-top">
                <div>
                  <p className="big">
                    {doneCount}
                    <span> of {counted.length} done</span>
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
              {backup !== 'unavailable' && (
                <p className="backup-line">
                  <span className={`dot ${backupDot[backup] ?? 'off'}`} aria-hidden />
                  <span>{backup === 'saved' && backupAt ? `Synced ${timeOf(backupAt)}` : backupLabel[backup]}</span>
                  {['signed-out', 'locked', 'attention', 'error', 'manual'].includes(backup) && (
                    <button className="link" onClick={() => setTab('backup')}>
                      {backup === 'signed-out' ? 'Set up sync' : backup === 'manual' ? 'Sync settings' : 'Fix this'}
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
                  {backup !== 'unavailable' && (
                    <li>
                      <strong>Sign in to sync your progress.</strong> Use it on any device. Free, and only you can read it.{' '}
                      {backup === 'signed-out' ? (
                        <button className="link" onClick={() => setTab('backup')}>
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
                    <strong>Download, print and sign the forms.</strong> Each one is filled in for you.
                  </li>
                  <li>
                    <strong>Give everything to your Local Safe Environment Coordinator</strong> (LSEC) at your parish or school.
                  </li>
                </ol>
              </section>
            )}

            {allDone ? (
              <section className="next all-done">
                <h2>You’re all set</h2>
                <p>Every requirement is complete. Come back when one is close to its renewal date.</p>
              </section>
            ) : (
              nextUp && (
                <section className="next" aria-labelledby="next-h">
                  <h2 id="next-h">Next up</h2>
                  <ul className="cards">
                    <RequirementCard
                      key={`next-${nextUp.id}`}
                      req={nextUp}
                      progress={progress[nextUp.id]}
                      profile={profile}
                      onChange={(p) => setProgress({ ...progress, [nextUp.id]: p })}
                      onEditInfo={() => setTab('info')}
                      defaultOpen
                    />
                  </ul>
                </section>
              )
            )}

            {groups.map((g) => {
              const items = orderedRequirements.filter((r) => r.group === g.id)
              const gDone = items.filter((r) => ['current', 'expiring', 'na'].includes(st(r.id))).length
              return (
                <section key={g.id} className="group" aria-labelledby={`g-${g.id}`}>
                  <div className="group-head">
                    <h2 id={`g-${g.id}`}>{g.title}</h2>
                    <span className="count">
                      {gDone}/{items.length}
                    </span>
                  </div>
                  <p className="group-intro">{g.intro}</p>
                  <ul className="cards">
                    {items.map((r) => (
                      <RequirementCard
                        key={r.id}
                        req={r}
                        progress={progress[r.id]}
                        profile={profile}
                        onChange={(p) => setProgress({ ...progress, [r.id]: p })}
                        onEditInfo={() => setTab('info')}
                      />
                    ))}
                  </ul>
                </section>
              )
            })}
          </>
        )}

        {tab === 'info' && <ProfileForm profile={profile} onChange={setProfile} onDone={() => setTab('checklist')} />}

        <div hidden={tab !== 'backup'}>
          <div className="page-intro">
            <h2>Sync</h2>
            <p>Sign in to keep your info and checklist in sync across your phone and computer, and safe if you clear your browser.</p>
          </div>

          {/* Stays mounted so an unlocked sync session survives switching tabs. */}
          <CloudPanel
            profile={profile}
            progress={progress}
            onStatus={onBackupStatus}
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
            {message && tab === 'backup' && (
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
                  Parish &amp; School Volunteer Requirements Checklist (PDF)
                </a>
                . It’s a helper, not an official diocesan site. Your coordinator has the final word on what you need.
              </p>
            </div>

            <section className="panel">
              <h3>Who to ask</h3>
              <p>
                Start with the <strong>Local Safe Environment Coordinator (LSEC)</strong> at your parish or school, or your CYO representative. They give out payment codes for the background checks and collect your finished paperwork.
              </p>
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
                <dt>Do I need to do all 12?</dt>
                <dd>Everyone who may have contact with children needs all of them except the Motor Vehicle Report, which is only for people who drive for the parish or school. The FBI fingerprint check is for volunteers 18 and older.</dd>
                <dt>How often do I renew?</dt>
                <dd>Background checks and the Mandated Reporter training last 5 years. Mark an item done with the date you completed it and the site shows its renewal date. Protecting God’s Children is a one-time training.</dd>
                <dt>Why isn’t my Social Security Number on the forms?</dt>
                <dd>The site never asks for it, so it can’t be stored or leaked. Write it on the printed form by hand where needed.</dd>
                <dt>Where is my information kept?</dt>
                <dd>In this browser on this device. Forms are filled in on your device too. If you sign in, your info is also synced online, scrambled with your password before it leaves your device so only you can read it. You can turn sync off on the Sync page.</dd>
                <dt>Why did my sign-in email come from Supabase?</dt>
                <dd>
                  Supabase is the service this site uses to run accounts and store synced copies. Confirmation and password reset emails come from Supabase Auth (noreply@mail.app.supabase.io). They’re safe to open. If you don’t see one, check your spam folder.
                </dd>
                <dt>Who made this, and how does it work?</dt>
                <dd>
                  It’s a free, open project. All of the code is public on{' '}
                  <a href="https://github.com/mcnearcj/lsa-vol-clearance-web" target="_blank" rel="noreferrer noopener">
                    GitHub
                  </a>
                  , including how forms are filled in and how online backup is encrypted.
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
        <p>Not an official Diocese of Allentown website. Requirements from the diocese’s checklist revised 2/14/2023.</p>
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
