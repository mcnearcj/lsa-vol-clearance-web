import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// The site editor is one self-contained HTML file the school keeps on a computer. It is never uploaded to the web host.
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  publicDir: false,
  build: { outDir: 'dist-editor', emptyOutDir: true, rollupOptions: { input: 'editor.html' } },
})
