// IndexedDB cache for Mushaf page SVGs. Pages are downloaded on demand
// and stored permanently. Cached pages are reused forever — never redownloaded.
import { openDB, type IDBPDatabase } from "idb";
import { pageImageUrl } from "./quran-meta";

const DB_NAME = "iqra-cache";
const STORE = "pages";
const VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (typeof window === "undefined") throw new Error("client only");
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      },
    });
  }
  return dbPromise;
}

// Returns a data URL suitable for <img src>. First call downloads and stores;
// subsequent calls read from IndexedDB.
export async function getPageDataUrl(page: number): Promise<string> {
  const db = await getDB();
  const cached = await db.get(STORE, page);
  if (cached) return cached as string;

  const res = await fetch(pageImageUrl(page));
  if (!res.ok) throw new Error(`Failed to load page ${page}`);
  const text = await res.text();
  const dataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(text)))}`;
  await db.put(STORE, dataUrl, page);
  return dataUrl;
}

export async function hasPage(page: number): Promise<boolean> {
  const db = await getDB();
  const val = await db.getKey(STORE, page);
  return val !== undefined;
}

export async function prefetchPages(pages: number[]): Promise<void> {
  await Promise.allSettled(pages.map((p) => getPageDataUrl(p)));
}

export async function cachedCount(): Promise<number> {
  const db = await getDB();
  return db.count(STORE);
}

export async function clearCache(): Promise<void> {
  const db = await getDB();
  await db.clear(STORE);
}
