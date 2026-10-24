import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Relative base so the built site works from any path (e.g. GitHub Pages project sites).
// The demo build (VITE_DEV_SITE=1) asks search engines not to list it. A normal build doesn't.
const noIndexDemo = () => ({
  name: 'no-index-demo',
  transformIndexHtml: (html: string) => (process.env.VITE_DEV_SITE === '1' ? html.replace('</head>', '    <meta name="robots" content="noindex, nofollow" />\n  </head>') : html),
})

export default defineConfig({
  base: './',
  plugins: [react(), noIndexDemo()],
})
