import { useEffect, useState } from 'react'
import App from '../App'
import { applyContent } from '../content/apply'
import { setPreviewAssets } from '../content/assets'
import { validateContent } from '../content/schema'

type Message = { type: 'lsa-preview'; content: unknown; siteUrl: string; files?: [string, Uint8Array][] }

export default function Preview() {
  const [state, setState] = useState<'waiting' | 'ready'>('waiting')
  const [problem, setProblem] = useState<string[]>([])
  const [siteUrl, setSiteUrl] = useState('')

  useEffect(() => {
    let urls = new Map<string, string>()
    const onMessage = (e: MessageEvent<Message>) => {
      if (!window.opener || e.source !== window.opener || e.data?.type !== 'lsa-preview') return
      const { content, files } = e.data
      const site = typeof e.data.siteUrl === 'string' ? e.data.siteUrl : ''
      if (files) {
        urls.forEach((u) => URL.revokeObjectURL(u))
        urls = new Map(files.map(([path, bytes]) => [path, URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }))]))
      }
      setPreviewAssets(site, urls)
      setSiteUrl(site)
      const r = validateContent(content)
      if (r.ok) {
        applyContent(r.content)
        setProblem([])
      } else setProblem(r.errors.slice(0, 5))
      setState('ready')
    }
    window.addEventListener('message', onMessage)
    window.opener?.postMessage({ type: 'lsa-preview-ready' }, '*')
    return () => window.removeEventListener('message', onMessage)
  }, [])

  return (
    <>
      <div className="prototype" role="note" style={{ position: 'sticky', top: 0, zIndex: 20 }}>
        <p>
          <strong>Preview of your unsaved changes.</strong> This is the real site drawn from the editor. It updates as you edit, and nothing here is saved or sent anywhere.
          {!siteUrl && state === 'ready' && ' The editor wasn’t loaded from your website, so the built-in forms can’t be filled in here.'}
        </p>
        {problem.length > 0 && (
          <p>
            Your changes have problems, so this shows the last good version. Check the Save tab in the editor: {problem.join('; ')}
          </p>
        )}
      </div>
      {!window.opener ? (
        <main>
          <p>Open this from the editor’s “Preview the site” button.</p>
        </main>
      ) : state === 'waiting' ? (
        <main>
          <p>Waiting for the editor…</p>
        </main>
      ) : (
        <App />
      )}
    </>
  )
}
