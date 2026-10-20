// When the site is redeployed while a page is open, the page still asks for the old versions of code it loads on
// demand (like the PDF filler), and those files are gone. Reloading picks up the new version; saved info is kept
// because it lives in the browser.

const STALE = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload/i

export function isStaleBuildError(e: unknown): boolean {
  const text = e instanceof Error ? `${e.name} ${e.message}` : String(e)
  return STALE.test(text)
}

export const STALE_MESSAGE = 'This site was updated since you opened it. Reload the page to get the new version, then try again. Your info is saved.'

export const STALE_EVENT = 'lsa:stale-build'

/** Vite reports failed on-demand loads with this event; pass it on so the page can offer a reload. */
export function watchForStaleBuild() {
  // Don't call preventDefault(): that makes Vite swallow the error, and the code that asked for the file
  // (e.g. the form download) would get `undefined` instead of an error it can explain.
  window.addEventListener('vite:preloadError', () => window.dispatchEvent(new Event(STALE_EVENT)))
}
