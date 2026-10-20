import { useRef, useState } from 'react'
import { ProfileForm } from './components/ProfileForm'
import { RequirementCard } from './components/RequirementCard'
import { requirements } from './data/requirements'
import { standing } from './dates'
import { clearAllStored, useStored } from './storage'
import { emptyProfile, type Progress, type Profile } from './types'

type Tab = 'checklist' | 'info' | 'about'

export default function App() {
  const [tab, setTab] = useState<Tab>('checklist')
  const [profile, setProfile] = useStored<Profile>('profile', emptyProfile)
  const [progress, setProgress] = useStored<Progress>('progress', {})
  const fileRef = useRef<HTMLInputElement>(null)

  const counted = requirements.filter((r) => standing(r, progress[r.id]).standing !== 'na')
  const complete = counted.filter((r) => ['current', 'expiring'].includes(standing(r, progress[r.id]).standing)).length
  const needsAttention = counted.filter((r) => ['expiring', 'expired'].includes(standing(r, progress[r.id]).standing))
  const pct = counted.length ? Math.round((complete / counted.length) * 100) : 0

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify({ profile, progress }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'volunteer-clearance-backup.json'
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
  }

  const importBackup = async (file: File) => {
    try {
      const data = JSON.parse(await file.text())
      if (data.profile) setProfile({ ...emptyProfile, ...data.profile })
      if (data.progress) setProgress(data.progress)
    } catch {
      alert('That file could not be read as a backup.')
    }
  }

  const eraseAll = () => {
    if (!confirm('Erase your info and checklist progress from this browser? This cannot be undone.')) return
    clearAllStored()
    setProfile(emptyProfile)
    setProgress({})
  }

  return (
    <div className="app">
      <header>
        <h1>Volunteer Clearance Tracker</h1>
        <p>Diocese of Allentown Safe Environment requirements</p>
        <nav role="tablist">
          {(
            [
              ['checklist', 'Checklist'],
              ['info', 'My info'],
              ['about', 'About & privacy'],
            ] as const
          ).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main>
        {tab === 'checklist' && (
          <>
            <section className="summary" aria-live="polite">
              <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div style={{ width: `${pct}%` }} />
              </div>
              <p>
                <strong>
                  {complete} of {counted.length}
                </strong>{' '}
                requirements complete
                {needsAttention.length > 0 && (
                  <>
                    {' · '}
                    <span className="warn">{needsAttention.length} need renewing</span>
                  </>
                )}
              </p>
            </section>
            <ul className="cards">
              {requirements.map((r) => (
                <RequirementCard
                  key={r.id}
                  req={r}
                  progress={progress[r.id]}
                  profile={profile}
                  onChange={(p) => setProgress({ ...progress, [r.id]: p })}
                  onNeedProfile={() => setTab('info')}
                />
              ))}
            </ul>
          </>
        )}

        {tab === 'info' && <ProfileForm profile={profile} onChange={setProfile} />}

        {tab === 'about' && (
          <section className="about">
            <h2>How this works</h2>
            <p>
              This site follows the Diocese of Allentown’s Safe Environment Parish &amp; School Volunteer Requirements Checklist. Tick off each item, record the date, and it will tell you when a clearance is due to be renewed (every 5 years for most). For items with a form, it fills in your details and gives you a PDF to print, sign, and hand to your Local Safe Environment Coordinator.
            </p>
            <h2>Your privacy</h2>
            <ul>
              <li>Your information is saved only in this browser on this device. There is no account and no server storing it.</li>
              <li>PDFs are filled in on your device. Nothing is uploaded.</li>
              <li>The site never asks for or stores your Social Security Number. Write it on the printed forms by hand where required.</li>
              <li>Clearing your browser data, or using another device, means starting over. Use the backup below to move your progress.</li>
              <li>This is not an official diocesan site. Always confirm requirements with your Local Safe Environment Coordinator.</li>
            </ul>
            <div className="actions">
              <button onClick={exportBackup}>Download backup</button>
              <button onClick={() => fileRef.current?.click()}>Restore from backup</button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void importBackup(f)
                  e.target.value = ''
                }}
              />
              <button className="danger" onClick={eraseAll}>
                Erase my data
              </button>
            </div>
            <p className="small">
              The backup file contains the information you entered (name, address, etc.). Keep it somewhere private.{' '}
              <a href={`${import.meta.env.BASE_URL}forms/requirements-checklist.pdf`} target="_blank" rel="noreferrer noopener">
                Official checklist (PDF)
              </a>
            </p>
          </section>
        )}
      </main>
    </div>
  )
}
