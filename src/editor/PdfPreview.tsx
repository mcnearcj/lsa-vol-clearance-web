import { useEffect, useRef, useState } from 'react'
import { openPdf, type PdfDoc, type PdfRenderTask } from './pdfjs'

/** One PDF page drawn on a canvas at `scale` pixels per point. */
export function PageCanvas({ doc, page, scale, onSize }: { doc: PdfDoc; page: number; scale: number; onSize?: (w: number, h: number) => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let cancelled = false
    let task: PdfRenderTask | undefined
    void (async () => {
      const p = await doc.getPage(page + 1)
      const viewport = p.getViewport({ scale })
      const c = ref.current
      if (!c || cancelled) return
      c.width = Math.floor(viewport.width)
      c.height = Math.floor(viewport.height)
      onSize?.(c.width, c.height)
      task = p.render({ canvasContext: c.getContext('2d')!, viewport })
      await task.promise.catch(() => undefined)
    })()
    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [doc, page, scale, onSize])
  return <canvas ref={ref} className="ed-page" />
}

/** Every page of a PDF, for checking a filled-in sample. */
export function PdfPages({ bytes }: { bytes: Uint8Array }) {
  const [doc, setDoc] = useState<PdfDoc | null>(null)
  useEffect(() => {
    let live = true
    void openPdf(bytes).then((d) => live && setDoc(d))
    return () => {
      live = false
    }
  }, [bytes])
  if (!doc) return <p>Loading the preview…</p>
  return (
    <div className="ed-pages">
      {Array.from({ length: doc.numPages }, (_, i) => (
        <PageCanvas key={i} doc={doc} page={i} scale={1.2} />
      ))}
    </div>
  )
}
