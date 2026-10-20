// Saves a generated file. Uses the host's save prompt when the page runs inside a viewer that
// blocks direct downloads (e.g. a hosted preview), and a normal download link everywhere else.

interface ClaudeHost {
  use?: (name: string) => Promise<{ save: (r: { filename: string; data: Blob }) => Promise<unknown> } | null>
}

export async function saveFile(filename: string, data: Uint8Array | string, type: string): Promise<void> {
  const blob = new Blob([data as BlobPart], { type })
  const host = (window as unknown as { claude?: ClaudeHost }).claude
  if (host?.use) {
    try {
      const downloads = await host.use('downloads')
      if (downloads) {
        await downloads.save({ filename, data: blob })
        return
      }
    } catch (e) {
      if ((e as { code?: string })?.code === 'declined') return
      // fall through to a normal download
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
