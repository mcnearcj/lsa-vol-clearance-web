// Remembers the backup key on this device so people aren't asked for their password after every reload.
// Keys are stored as non-extractable CryptoKeys: the browser can use them but never hands back the raw key.
// The info they protect is already stored readable in this browser, so this adds no new exposure.

const DB = 'lsa-vol-clearance'
const STORE = 'keys'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  try {
    const db = await open()
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  } catch {
    return undefined // private windows and locked-down browsers: fall back to asking for the password
  }
}

export interface StoredKey {
  key: CryptoKey
  salt: string
}

export const keystore = {
  get: (userId: string) => tx<StoredKey>('readonly', (s) => s.get(userId)),
  put: (userId: string, value: StoredKey) => tx('readwrite', (s) => s.put(value, userId)),
  remove: (userId: string) => tx('readwrite', (s) => s.delete(userId)),
  clear: () => tx('readwrite', (s) => s.clear()),
}
