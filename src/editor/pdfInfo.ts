import { PDFCheckBox, PDFDocument, PDFDropdown, PDFRadioGroup, PDFSignature, PDFTextField } from 'pdf-lib'

export type PdfFieldKind = 'text' | 'checkbox' | 'choice' | 'signature' | 'other'

export interface PdfFieldInfo {
  name: string
  kind: PdfFieldKind
  options?: string[]
}

/** The fillable fields in a PDF, so the editor can ask what each one gets. */
export async function listPdfFields(bytes: Uint8Array): Promise<{ fields: PdfFieldInfo[]; pages: number }> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const fields = doc.getForm().getFields().map((f): PdfFieldInfo => {
    if (f instanceof PDFTextField) return { name: f.getName(), kind: 'text' }
    if (f instanceof PDFCheckBox) return { name: f.getName(), kind: 'checkbox' }
    if (f instanceof PDFDropdown || f instanceof PDFRadioGroup) return { name: f.getName(), kind: 'choice', options: f.getOptions() }
    if (f instanceof PDFSignature) return { name: f.getName(), kind: 'signature' }
    return { name: f.getName(), kind: 'other' }
  })
  return { fields, pages: doc.getPageCount() }
}
