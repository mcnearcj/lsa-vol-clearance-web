import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './editor.css'
import EditorApp from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <EditorApp />
  </StrictMode>,
)
