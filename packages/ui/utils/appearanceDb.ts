// Tiny IndexedDB store for the user-uploaded background image. Kept in its own
// database (separate from the data-usage DB) so it can store a single Blob under
// a fixed key without colliding with — or forcing a version bump on — the
// data_usage_logs store.
const DB_NAME = 'metacubexd_appearance'
const STORE_NAME = 'assets'
const DB_VERSION = 1
const BACKGROUND_KEY = 'backgroundImage'

function openDB(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available'))
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }

    request.onsuccess = (event) =>
      resolve((event.target as IDBOpenDBRequest).result)
    request.onerror = (event) =>
      reject((event.target as IDBOpenDBRequest).error)
  })
}

export async function saveBackgroundImage(blob: Blob): Promise<void> {
  const db = await openDB()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite')
      transaction.objectStore(STORE_NAME).put(blob, BACKGROUND_KEY)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  } finally {
    db.close()
  }
}

export async function loadBackgroundImage(): Promise<Blob | null> {
  const db = await openDB()
  try {
    return await new Promise<Blob | null>((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly')
      const request = transaction.objectStore(STORE_NAME).get(BACKGROUND_KEY)
      request.onsuccess = () => resolve((request.result as Blob) ?? null)
      request.onerror = () => reject(request.error)
    })
  } finally {
    db.close()
  }
}

export async function clearBackgroundImage(): Promise<void> {
  const db = await openDB()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite')
      transaction.objectStore(STORE_NAME).delete(BACKGROUND_KEY)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  } finally {
    db.close()
  }
}
