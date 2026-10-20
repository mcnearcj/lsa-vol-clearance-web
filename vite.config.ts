import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Relative base so the built site works from any path (e.g. GitHub Pages project sites).
export default defineConfig({
  base: './',
  plugins: [react()],
})
