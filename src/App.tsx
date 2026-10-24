import { Fragment, useEffect, useState } from 'react'
import { ProfileForm } from './components/ProfileForm'
import { RequirementCard } from './components/RequirementCard'
import { FormsPanel } from './components/FormsPanel'
import { MigrationInfo } from './components/MigrationInfo'
import { PrintableChecklist } from './components/PrintableChecklist'
import { Rich } from './components/Rich'
import { PageHead, SiteFooter, SiteHeader } from './components/SiteChrome'
import { StoragePrompt } from './components/StoragePrompt'
import { assetUrl } from './content/assets'
import { useContentVersion } from './content/useContent'
import { faq } from './data/faq'
import { groups, orderedRequirements } from './data/requirements'
import { site } from './data/site'
import { standing } from './dates'
import { STALE_EVENT, STALE_MESSAGE } from './staleBuild'
import { clearAllStored, getStorageMode, setStorageMode, useStored, type StorageMode } from './storage'
import { emptyProfile, personName, type Progress, type Profile } from './types'

type Tab = 'checklist' | 'info' | 'help' | 'migration'

// The demo site has an extra tab for the school's webmaster. It's switched on by a build setting, so the version that goes
// on the school's website (built without it) never contains the tab.
const MIGRATION = import.meta.env.VITE_MIGRATION_INFO === '1'

const tabs: [Tab, string][] = [
  ['checklist', 'Checklist'],
  ['info', 'My info'],
  ['help', 'Help'],
  ...(MIGRATION ? ([['migration', 'Migration info']] as [Tab, string][]) : []),
]

const asset = assetUrl

export default function App() {
  const [mode, setMode] = useState<StorageMode | null>(() => {
    const saved = getStorageMode()
    // A link ending in #migration (sent to the webmaster) goes straight to the page, without the keep-or-erase question.
    if (!saved && MIGRATION && window.location.hash === '#migration') {
      setStorageMode('erase')
      return 'erase'
    }
    return saved
  })
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
  useContentVersion() // draws again when the editor's preview gets new content
  const [tab, setTabState] = useState<Tab>(MIGRATION && window.location.hash === '#migration' ? 'migration' : 'checklist')
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

  // A link ending in #printable (for the school's website) lands on the printable checklist button.
  useEffect(() => {
    if (window.location.hash === '#printable') requestAnimationFrame(() => document.getElementById('printable')?.scrollIntoView({ block: 'center' }))
  }, [])

  const setTab = (t: Tab) => {
    setTabState(t)
    window.scrollTo({ top: 0 })
  }

  const st = (id: string) => standing(orderedRequirements.find((r) => r.id === id)!, progress[id]).standing
  // The signable forms are made together in "Forms to sign" and count as one item.
  const formsDone = progress.forms?.status === 'done'

  const goToForms = () => {
    setTabState('checklist')
    requestAnimationFrame(() => document.getElementById('forms')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

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
      <SiteHeader>
        <div className="tabs-bar">
          <nav className="tabs" aria-label="Sections">
            {tabs.map(([id, label]) => (
              <button key={id} aria-current={tab === id ? 'page' : undefined} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </nav>
        </div>
      </SiteHeader>

      <main>
        <PageHead />

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
            <section className="intro" aria-label="About this site">
              <p>
                This site helps you finish {site.schoolName}’s volunteer clearances for the Diocese of Allentown. It lists each background check and training with steps and links, fills in your forms from your info, and makes a checklist of what to hand in to {site.lsec.name}.{' '}
                <button className="link" onClick={() => setTab('help')}>
                  Questions? See Help
                </button>
              </p>
              <PrintableChecklist />
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
                  <p className="group-intro">
                    <Rich text={g.intro} inline />
                  </p>
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

        {MIGRATION && tab === 'migration' && <MigrationInfo />}

        {tab === 'help' && (
          <div className="help">
            <div className="page-intro">
              <h2>Help</h2>
              <p>
                This site follows the diocese’s{' '}
                <a href={asset(site.checklistFile)} target="_blank" rel="noreferrer noopener">
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
                {site.diocese.name}, {site.diocese.title}
                <br />
                {site.diocese.address}
                <br />
                {site.diocese.phone} · <span className="select">{site.diocese.email}</span>
              </address>
            </section>

            <section className="panel">
              <h3>Questions</h3>
              <dl className="faq">
                {faq.map((f) => (
                  <Fragment key={f.q}>
                    <dt>{f.q}</dt>
                    <dd>
                      <Rich text={f.a} />
                    </dd>
                  </Fragment>
                ))}
                <dt>Where is my information kept?</dt>
                <dd>
                  Only in this browser on this device. Nothing is sent to or stored on a server, and forms are filled in on your device.{' '}
                  {mode === 'keep' ? 'You chose to keep your info on this computer, so it stays until you erase it.' : 'You chose to erase your info when you leave, so it’s gone when you close this tab.'}
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

      <SiteFooter />
    </div>
  )
}
