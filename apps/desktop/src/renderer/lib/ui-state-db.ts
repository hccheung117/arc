/**
 * UI State IndexedDB
 *
 * Persists UI-related state (like branch selections, folder collapse states) in
 * the renderer's IndexedDB. Keeps UI state separate from the pure data layer
 * (JSONL files in arcfs).
 */

const DB_NAME = 'arc-ui-state'
const DB_VERSION = 2
const BRANCH_STORE = 'branch-selections'
const FOLDER_STORE = 'folder-collapse'

let dbPromise: Promise<IDBDatabase> | null = null

function openDB() {
  if (dbPromise) return dbPromise

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(BRANCH_STORE)) {
        db.createObjectStore(BRANCH_STORE, { keyPath: 'threadId' })
      }
      if (!db.objectStoreNames.contains(FOLDER_STORE)) {
        db.createObjectStore(FOLDER_STORE, { keyPath: 'folderId' })
      }
    }
  })

  return dbPromise
}

// ============================================================================
// IndexedDB Primitives
// ============================================================================

const promisify = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })

const withStore = async <T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
) => {
  const db = await openDB()
  return promisify(fn(db.transaction(storeName, mode).objectStore(storeName)))
}

const get = <T>(store: string, key: string) =>
  withStore<T | undefined>(store, 'readonly', (s) => s.get(key))

const put = (store: string, value: unknown) =>
  withStore(store, 'readwrite', (s) => s.put(value)).then(() => {})

const del = (store: string, key: string) =>
  withStore(store, 'readwrite', (s) => s.delete(key)).then(() => {})

const getAll = <T>(store: string) =>
  withStore<T[]>(store, 'readonly', (s) => s.getAll())

// ============================================================================
// Branch Selections
// ============================================================================

// Exported: contract type used by consumers
export interface BranchSelections {
  threadId: string
  selections: Record<string, number> // parentId (or 'root') -> branch index
}

export const getBranchSelections = async (threadId: string) => {
  const result = await get<BranchSelections>(BRANCH_STORE, threadId)
  return result?.selections ?? {}
}

export const setBranchSelection = async (threadId: string, parentId: string | null, index: number) => {
  const existing = await get<BranchSelections>(BRANCH_STORE, threadId)
  await put(BRANCH_STORE, {
    threadId,
    selections: { ...(existing?.selections ?? {}), [parentId ?? 'root']: index },
  })
}

export const clearBranchSelections = (threadId: string) => del(BRANCH_STORE, threadId)

// ============================================================================
// Folder Collapse State
// ============================================================================

export const getFolderCollapsed = async (folderId: string) => {
  const result = await get<{ folderId: string; collapsed: boolean }>(FOLDER_STORE, folderId)
  return result?.collapsed ?? false
}

export const setFolderCollapsed = (folderId: string, collapsed: boolean) =>
  put(FOLDER_STORE, { folderId, collapsed })

export const getAllFolderCollapseStates = async () => {
  const results = await getAll<{ folderId: string; collapsed: boolean }>(FOLDER_STORE)
  return Object.fromEntries(results.map(({ folderId, collapsed }) => [folderId, collapsed]))
}
