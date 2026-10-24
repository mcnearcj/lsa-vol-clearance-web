import { useState } from 'react'
import { site } from '../data/site'
import type { StorageMode } from '../storage'

interface Props {
  onChoose: (mode: StorageMode) => void
}

/** The first screen: whether this device should remember the volunteer's info. Erasing is the default. */
export function StoragePrompt({ onChoose }: Props) {
  const [mode, setMode] = useState<StorageMode>('erase')
  return (
    <div className="app">
      <header className="masthead">
        <div className="masthead-inner">
          <p className="kicker">{site.schoolName} · Diocese of Allentown</p>
          <h1>Volunteer Clearances</h1>
        </div>
      </header>
      <main>
        <section className="panel" aria-labelledby="keep-h">
          <h2 id="keep-h">Do you want this computer to remember your info?</h2>
          <p>Nothing you enter is sent to a server. It stays in this browser. Choose what happens to it when you leave.</p>
          <div className="choices" role="radiogroup" aria-labelledby="keep-h">
            <label>
              <input type="radio" name="keep" checked={mode === 'erase'} onChange={() => setMode('erase')} /> <strong>Erase it when I leave</strong> (recommended, especially on a shared computer). Your info is gone when you close this tab.
            </label>
            <label>
              <input type="radio" name="keep" checked={mode === 'keep'} onChange={() => setMode('keep')} /> <strong>Keep it on this computer</strong>, so you can come back and use the site as a checklist. You can erase it any time under Help.
            </label>
          </div>
          <div className="row">
            <button className="primary" onClick={() => onChoose(mode)}>
              Continue
            </button>
          </div>
        </section>
      </main>
    </div>
  )
}
