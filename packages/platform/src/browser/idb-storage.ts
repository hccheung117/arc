/**
 * Thin IndexedDB wrapper for persisting sql.js database exports.
 *
 * Avoids pulling in a large dependency just to read/write a single key.
 */

const DEFAULT_DB_NAME = "arc-db";
const DEFAULT_STORE_NAME = "sqlite";

function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

function asUint8Array(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array) {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  return null;
}

export class IndexedDbStorage {
  constructor(
    private readonly dbName: string = DEFAULT_DB_NAME,
    private readonly storeName: string = DEFAULT_STORE_NAME
  ) {}

  async load(key: string): Promise<Uint8Array | null> {
    if (!hasIndexedDb()) {
      return null;
    }

    const db = await this.open();
    try {
      return await new Promise<Uint8Array | null>((resolve, reject) => {
        const tx = db.transaction(this.storeName, "readonly");
        const store = tx.objectStore(this.storeName);
        const request = store.get(key);

        request.onsuccess = () => {
          resolve(asUint8Array(request.result) ?? null);
        };
        request.onerror = () => {
          reject(request.error ?? new Error("Failed to load from IndexedDB"));
        };
      });
    } finally {
      db.close();
    }
  }

  async save(key: string, value: Uint8Array): Promise<void> {
    if (!hasIndexedDb()) {
      return;
    }

    const db = await this.open();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(this.storeName, "readwrite");
        const store = tx.objectStore(this.storeName);
        const request = store.put(value, key);

        request.onsuccess = () => resolve();
        request.onerror = () => {
          reject(request.error ?? new Error("Failed to save to IndexedDB"));
        };
      });
    } finally {
      db.close();
    }
  }

  async delete(key: string): Promise<void> {
    if (!hasIndexedDb()) {
      return;
    }

    const db = await this.open();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(this.storeName, "readwrite");
        const store = tx.objectStore(this.storeName);
        const request = store.delete(key);

        request.onsuccess = () => resolve();
        request.onerror = () => {
          reject(request.error ?? new Error("Failed to delete from IndexedDB"));
        };
      });
    } finally {
      db.close();
    }
  }

  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        reject(request.error ?? new Error("Failed to open IndexedDB"));
      };
    });
  }
}
