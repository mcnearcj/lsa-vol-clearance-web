import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Fonts are bundled so the preview looks like the real site.
import '@fontsource-variable/source-sans-3'
import '@fontsource-variable/oswald'
import '../index.css'
import { setStorageMode } from '../storage'
import Preview from './Preview'

// The real site, drawn from the editor's unsaved settings. It only listens to the window that opened it (the editor,
// which carries this page inside itself), and it never keeps anything: choices go in this tab's memory only.
setStorageMode('erase')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Preview />
  </StrictMode>,
)
