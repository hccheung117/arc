/**
 * UI State IndexedDB
 *
 * Persists UI-related state (like branch selections, folder collapse states) in
 * the renderer's IndexedDB. Keeps UI state separate from the pure data layer
 * (JSONL files in arcfs).
 */

const DB_NAME = 'arc-ui-state'
const DB_VERSION = 3
const BRANCH_STORE = 'branch-selections'
const FOLDER_STORE = 'folder-collapse'
const LAYOUT_STORE = 'layout'

let dbPromise = null

function openDB() {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(BRANCH_STORE)) {
        db.createObjectStore(BRANCH_STORE, { keyPath: 'threadId' })
      }
      if (!db.objectStoreNames.contains(FOLDER_STORE)) {
        db.createObjectStore(FOLDER_STORE, { keyPath: 'folderId' })
      }
      if (!db.objectStoreNames.contains(LAYOUT_STORE)) {
        db.createObjectStore(LAYOUT_STORE, { keyPath: 'key' })
      }
    }
  })

  return dbPromise
}

// ============================================================================
// IndexedDB Primitives
// ============================================================================

const promisify = (request) =>
  new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })

const withStore = async (
  storeName,
  mode,
  fn,
) => {
  const db = await openDB()
  return promisify(fn(db.transaction(storeName, mode).objectStore(storeName)))
}

const get = (store, key) =>
  withStore(store, 'readonly', (s) => s.get(key))

const put = (store, value) =>
  withStore(store, 'readwrite', (s) => s.put(value)).then(() => {})

const del = (store, key) =>
  withStore(store, 'readwrite', (s) => s.delete(key)).then(() => {})

const getAll = (store) =>
  withStore(store, 'readonly', (s) => s.getAll())

// ============================================================================
// Branch Selections
// ============================================================================

export const getBranchSelections = async (threadId) => {
  const result = await get(BRANCH_STORE, threadId)
  return result?.selections ?? {}
}

export const setBranchSelection = async (threadId, parentId, index) => {
  const existing = await get(BRANCH_STORE, threadId)
  await put(BRANCH_STORE, {
    threadId,
    selections: { ...(existing?.selections ?? {}), [parentId ?? 'root']: index },
  })
}

export const clearBranchSelections = (threadId) => del(BRANCH_STORE, threadId)

// ============================================================================
// Folder Collapse State
// ============================================================================

export const getFolderCollapsed = async (folderId) => {
  const result = await get(FOLDER_STORE, folderId)
  return result?.collapsed ?? false
}

export const setFolderCollapsed = (folderId, collapsed) =>
  put(FOLDER_STORE, { folderId, collapsed })

export const getAllFolderCollapseStates = async () => {
  const results = await getAll(FOLDER_STORE)
  return Object.fromEntries(results.map(({ folderId, collapsed }) => [folderId, collapsed]))
}

// ============================================================================
// Layout Preferences
// ============================================================================

export const getComposerMaxHeight = async () => {
  const result = await get(LAYOUT_STORE, 'composerMaxHeight')
  return result?.value ?? undefined
}

export const setComposerMaxHeight = (value) =>
  value === undefined
    ? del(LAYOUT_STORE, 'composerMaxHeight')
    : put(LAYOUT_STORE, { key: 'composerMaxHeight', value })
