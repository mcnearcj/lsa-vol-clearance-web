import { useEffect, useState } from 'react'
import { ProfileForm } from './components/ProfileForm'
import { RequirementCard } from './components/RequirementCard'
import { FormsPanel } from './components/FormsPanel'
import { StoragePrompt } from './components/StoragePrompt'
import { groups, orderedRequirements } from './data/requirements'
import { site } from './data/site'
import { standing } from './dates'
import { STALE_EVENT, STALE_MESSAGE } from './staleBuild'
import { clearAllStored, getStorageMode, setStorageMode, useStored, type StorageMode } from './storage'
import { emptyProfile, personName, type Progress, type Profile } from './types'

type Tab = 'checklist' | 'info' | 'help'

const tabs: [Tab, string][] = [
  ['checklist', 'Checklist'],
  ['info', 'My info'],
  ['help', 'Help'],
]

const asset = (file: string) => `${import.meta.env.BASE_URL}${file}`

export default function App() {
  const [mode, setMode] = useState<StorageMode | null>(getStorageMode)
  if (!mode) {
    return (
      <StoragePrompt
        onChoose={(m) => {
          setStorageMode(m)
          setMode(m)
        }}
      />
    )
  }
  // Remounting on a change makes everything reload from wherever the info now lives.
  return (
    <Tracker
      key={mode}
      mode={mode}
      onModeChange={(m) => {
        setStorageMode(m)
        setMode(m)
      }}
    />
  )
}

function Tracker({ mode, onModeChange }: { mode: StorageMode; onModeChange: (m: StorageMode) => void }) {
  const [tab, setTabState] = useState<Tab>('checklist')
  const [profile, setProfile] = useStored<Profile>('profile', emptyProfile)
  const [progress, setProgress] = useStored<Progress>('progress', {})
  const [message, setMessage] = useState('')
  const [confirmErase, setConfirmErase] = useState(false)
  const [confirmSwitch, setConfirmSwitch] = useState(false)
  const [cleared, setCleared] = useState(false)
  const [stale, setStale] = useState(false)
  useEffect(() => {
    const onStale = () => setStale(true)
    window.addEventListener(STALE_EVENT, onStale)
    return () => window.removeEventListener(STALE_EVENT, onStale)
  }, [])

  const setTab = (t: Tab) => {
    setTabState(t)
    window.scrollTo({ top: 0 })
  }

  const st = (id: string) => standing(orderedRequirements.find((r) => r.id === id)!, progress[id]).standing
  // The signable forms are made together in "Forms to sign" and count as one item; the rest are tracked one by one.
  const tracked = orderedRequirements.filter((r) => st(r.id) !== 'na')
  const formsDone = progress.forms?.status === 'done'
  const total = tracked.length + 1
  const doneCount = tracked.filter((r) => ['current', 'expiring'].includes(st(r.id))).length + (formsDone ? 1 : 0)

  const goToForms = () => {
    setTabState('checklist')
    requestAnimationFrame(() => document.getElementById('forms')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const hasName = Boolean(profile.firstName.trim() && profile.lastName.trim())
  const who = personName(profile)
  const hasData = Boolean(who) || Object.keys(progress).length > 0

  const eraseAll = () => {
    clearAllStored()
    setProfile(emptyProfile)
    setProgress({})
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
            </button>
          ))}
        </nav>
      </header>

      <main>
        {stale && (
          <div className="notice stale" role="alert">
            <p>{STALE_MESSAGE}</p>
            <button className="primary" onClick={() => window.location.reload()}>
              Reload page
            </button>
          </div>
        )}

        {cleared && !hasData && (
          <p className="notice ok" role="status">
            This computer is cleared. No one’s info is loaded. Add your own under My info.
          </p>
        )}

        {hasData && (
          <section className={`person${confirmSwitch ? ' confirming' : ''}`} aria-label="Whose info is on this device">
            <p>
              <span className="avatar" aria-hidden>
                {(who || '?').slice(0, 1).toUpperCase()}
              </span>
              <span>
                {who ? (
                  <>
                    Showing info for <strong>{who}</strong>
                  </>
                ) : (
                  <>Showing a checklist with no name yet</>
                )}
              </span>
              {!confirmSwitch && (
                <button className="link" onClick={() => setConfirmSwitch(true)}>
                  Not you?
                </button>
              )}
            </p>
            {confirmSwitch && (
              <div className="switch">
                <p>Clear {who ? `${who}’s` : 'this'} info and checklist from this computer so you can start your own? It can’t be recovered.</p>
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
                </div>
                {!hasName && (
                  <button className="secondary" onClick={() => setTab('info')}>
                    Add my info
                  </button>
                )}
              </div>
            </section>

            <section className="intro" aria-label="About this site">
              <p>
                This site helps you finish {site.schoolName}’s volunteer clearances for the Diocese of Allentown. It lists each background check and training with steps and links, fills in your forms from your info, and makes a checklist of what to hand in to {site.lsec.name}.{' '}
                <button className="link" onClick={() => setTab('help')}>
                  Questions? See Help
                </button>
              </p>
            </section>

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
                <dd>Background checks and the Mandated Reporter training last 5 years. Protecting God’s Children is a one-time training. Your coordinator can tell you when yours are due.</dd>
                <dt>Which forms need my Social Security Number?</dt>
                <dd>
                  Of the forms this site fills in, only the <strong>NSOR application</strong> (the state requires it). The <strong>Background Check Authorization</strong> asks for it from employees only, so volunteers leave it blank. The acknowledgment forms don’t ask for it.
                  <br />
                  <br />
                  Two of the state’s online systems also ask for it when you apply there: the <strong>Child Abuse History</strong> clearance (include it, or your results take longer) and <strong>PATCH</strong> (optional, but recommended).
                </dd>
                <dt>How is my Social Security Number handled here?</dt>
                <dd>It’s only asked for under “Forms to sign”, and only to fill in the files you make there. It’s never saved on your device or sent anywhere. Leave it blank there to write it on the printed form by hand instead.</dd>
                <dt>Where is my information kept?</dt>
                <dd>
                  Only in this browser on this device. Nothing is sent to or stored on a server, and forms are filled in on your device.{' '}
                  {mode === 'keep' ? 'You chose to keep your info on this computer, so it stays until you erase it.' : 'You chose to erase your info when you leave, so it’s gone when you close this tab.'}
                </dd>
                <dt>I’m using a shared computer. Is that OK?</dt>
                <dd>
                  Yes. Choose “erase it when I leave” (the default), or use a private window (Incognito in Chrome, InPrivate in Edge, or Private Browsing in Safari and Firefox). Check the name at the top of each page, and when you’re done, choose “Not you?” or “Erase my data” below. If you see someone else’s name, choose “Not you?” to start fresh.
                </dd>
              </dl>
            </section>

            <section className="panel">
              <h3>Where your info is kept</h3>
              <p>
                {mode === 'keep'
                  ? 'Your info and checklist stay on this computer between visits.'
                  : 'Your info and checklist are erased when you close this tab.'}
              </p>
              <div className="row">
                <button className="ghost" onClick={() => onModeChange(mode === 'keep' ? 'erase' : 'keep')}>
                  {mode === 'keep' ? 'Erase my info when I leave instead' : 'Keep my info on this computer instead'}
                </button>
              </div>
            </section>

            <section className="panel">
              <h3>Erase my data</h3>
              <p>Removes your info and checklist from this browser.</p>
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
          ; requirements from its{' '}
          <a href={site.requirementsUrl} target="_blank" rel="noreferrer noopener">
            {site.checklistName}
          </a>
          , revised {site.checklistRevised}. Check those pages for anything newer.
        </p>
      </footer>
    </div>
  )
}
