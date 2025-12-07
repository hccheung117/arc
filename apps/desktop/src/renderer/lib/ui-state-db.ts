/**
 * UI State IndexedDB
 *
 * Persists UI-related state (like branch selections) in the renderer's IndexedDB.
 * Keeps UI state separate from the pure data layer (JSONL files in arcfs).
 */

const DB_NAME = 'arc-ui-state'
const DB_VERSION = 1
const STORE_NAME = 'branch-selections'

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'threadId' })
      }
    }
  })

  return dbPromise
}

export interface BranchSelections {
  threadId: string
  selections: Record<string, number> // parentId (or 'root') -> branch index
}

/**
 * Get branch selections for a thread.
 * Returns empty object if no selections stored.
 */
export async function getBranchSelections(threadId: string): Promise<Record<string, number>> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.get(threadId)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const result = request.result as BranchSelections | undefined
      resolve(result?.selections ?? {})
    }
  })
}

/**
 * Set a branch selection for a thread.
 * Merges with existing selections.
 */
export async function setBranchSelection(
  threadId: string,
  parentId: string | null,
  index: number,
): Promise<void> {
  const db = await openDB()
  const key = parentId ?? 'root'

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)

    // First get existing selections
    const getRequest = store.get(threadId)

    getRequest.onerror = () => reject(getRequest.error)
    getRequest.onsuccess = () => {
      const existing = getRequest.result as BranchSelections | undefined
      const selections = existing?.selections ?? {}
      selections[key] = index

      const putRequest = store.put({ threadId, selections })
      putRequest.onerror = () => reject(putRequest.error)
      putRequest.onsuccess = () => resolve()
    }
  })
}

/**
 * Clear all branch selections for a thread.
 */
export async function clearBranchSelections(threadId: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.delete(threadId)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}
