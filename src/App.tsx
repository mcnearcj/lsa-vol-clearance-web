import { useRef, useState } from 'react'
import { CloudPanel } from './components/CloudPanel'
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
  ['backup', 'Backup'],
  ['help', 'Help'],
]

/** Email links from the sign-in service land with details in the hash; open the Backup tab for them. */
const initialTab = (): Tab => (/(access_token|error_description|type=recovery)/.test(window.location.hash) ? 'backup' : 'checklist')

const asset = (file: string) => `${import.meta.env.BASE_URL}${file}`

export default function App() {
  const [tab, setTabState] = useState<Tab>(initialTab)
  const [profile, setProfile] = useStored<Profile>('profile', emptyProfile)
  const [progress, setProgress] = useStored<Progress>('progress', {})
  const [ui, setUi] = useStored('ui', { introDismissed: false })
  const [message, setMessage] = useState('')
  const [confirmErase, setConfirmErase] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const setTab = (t: Tab) => {
    setTabState(t)
    window.scrollTo({ top: 0 })
  }

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
            </button>
          ))}
        </nav>
      </header>

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
                <p className="small">Your info stays on this device unless you turn on online backup.</p>
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
            <h2>Backup</h2>
            <p>Your info and checklist are saved in this browser. Back them up so you don’t lose them if you clear your browser or switch devices.</p>
          </div>

          {/* Stays mounted so an unlocked online backup survives switching tabs. */}
          <CloudPanel
            profile={profile}
            progress={progress}
            onRestore={(d) => {
              setProfile({ ...emptyProfile, ...d.profile })
              setProgress(d.progress ?? {})
            }}
          />

          <section className="panel">
            <h3>Backup file</h3>
            <p>No account needed. Download a file and keep it somewhere private. It contains your name, address and the other details you entered.</p>
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

            <section className="panel report">
              <h3>To report suspected child abuse</h3>
              <p>
                If a child is in immediate danger, <strong>call 911</strong>. Otherwise call the PA ChildLine, 24 hours a day: <strong className="select">1-800-932-0313</strong>. Then follow the diocese’s CPSL policy (Checklist #9) to tell your pastor or principal.
              </p>
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
                <dd>In this browser on this device. Forms are filled in on your device too. Nothing is uploaded unless you turn on online backup, which scrambles your info with a passphrase only you know.</dd>
              </dl>
            </section>

            <section className="panel">
              <h3>Erase my data</h3>
              <p>Removes your info and checklist from this browser. It doesn’t delete an online backup; do that on the Backup page.</p>
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
      </footer>
    </div>
  )
}
