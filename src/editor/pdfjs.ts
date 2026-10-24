import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import workerSource from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?raw'

// The editor is a single file, so the PDF reader's worker script travels inside it.
pdfjs.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }))

export type PdfDoc = pdfjs.PDFDocumentProxy
export type PdfRenderTask = pdfjs.RenderTask

export async function openPdf(bytes: Uint8Array): Promise<PdfDoc> {
  // The reader takes ownership of the buffer it's given, so hand it a copy.
  return pdfjs.getDocument({ data: bytes.slice() }).promise
}
