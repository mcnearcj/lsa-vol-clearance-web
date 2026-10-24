import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// The real site as one self-contained page. It is built into the editor, which opens it in a new tab as a live preview.
// It is never published.
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  publicDir: false,
  build: { outDir: 'dist-preview', emptyOutDir: true, rollupOptions: { input: 'preview.html' } },
})
