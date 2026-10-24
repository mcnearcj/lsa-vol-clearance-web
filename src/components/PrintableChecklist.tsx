import { useEffect, useRef, useState } from 'react'
import { makeChecklist } from '../checklistDownload'
import { isStaleBuildError, STALE_MESSAGE } from '../staleBuild'

/** One click makes the printable checklist from the site's current content and downloads it. It needs no info from the person. */
export function PrintableChecklist() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [file, setFile] = useState<{ url: string; filename: string } | null>(null)
  const last = useRef<string | null>(null)
  useEffect(() => () => void (last.current && URL.revokeObjectURL(last.current)), [])

  const make = async () => {
    setBusy(true)
    setError('')
    try {
      const { bytes, filename } = await makeChecklist()
      if (last.current) URL.revokeObjectURL(last.current)
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }))
      last.current = url
      setFile({ url, filename })
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch (e) {
      setError(isStaleBuildError(e) ? STALE_MESSAGE : 'The checklist could not be made. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="print-link" id="printable">
      <button type="button" className="secondary" onClick={() => void make()} disabled={busy}>
        {busy ? 'Making it…' : 'Download the printable checklist (PDF)'}
      </button>
      <span className="small">One page listing everything to hand in. It doesn’t need any of your info.</span>
      {file && (
        <span className="small">
          Didn’t start? <a href={file.url} target="_blank" rel="noopener">Open it</a>.
        </span>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
