import { useState } from 'react'
import { PageHead, SiteFooter, SiteHeader } from './SiteChrome'
import type { StorageMode } from '../storage'

interface Props {
  onChoose: (mode: StorageMode) => void
}

/** The first screen: whether this device should remember the volunteer's info. Erasing is the default. */
export function StoragePrompt({ onChoose }: Props) {
  const [mode, setMode] = useState<StorageMode>('erase')
  return (
    <div className="app">
      <SiteHeader />
      <main>
        <PageHead />
        <section className="panel" aria-labelledby="keep-h">
          <h2 id="keep-h">Do you want this computer to remember your info?</h2>
          <p>Nothing you enter is sent to a server. It stays in this browser. Choose what happens to it when you leave.</p>
          <div className="choices" role="radiogroup" aria-labelledby="keep-h">
            <label className="check">
              <input type="radio" name="keep" checked={mode === 'erase'} onChange={() => setMode('erase')} />
              <span>
                <strong>Erase it when I leave</strong> (recommended, especially on a shared computer). Your info is gone when you close this tab.
              </span>
            </label>
            <label className="check">
              <input type="radio" name="keep" checked={mode === 'keep'} onChange={() => setMode('keep')} />
              <span>
                <strong>Keep it on this computer</strong>, so you can come back and use the site as a checklist. You can erase it any time under Help.
              </span>
            </label>
          </div>
          <div className="row">
            <button className="primary" onClick={() => onChoose(mode)}>
              Continue
            </button>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
