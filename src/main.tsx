import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Fonts are bundled with the site so no page view contacts a third-party font service.
import '@fontsource-variable/source-sans-3'
import '@fontsource-variable/oswald'
import './index.css'
import App from './App.tsx'
import { loadContent } from './content/load'
import { watchForStaleBuild } from './staleBuild'

watchForStaleBuild()

// The school's settings load first so the page draws once, with the right names and forms.
void loadContent().then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
)
