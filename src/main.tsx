import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Fonts are bundled with the site so no page view contacts a third-party font service.
import '@fontsource-variable/public-sans'
import '@fontsource-variable/source-serif-4'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
