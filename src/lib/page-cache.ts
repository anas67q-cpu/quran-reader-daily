// IndexedDB cache for Mushaf page SVGs. Pages are downloaded on demand
// and stored permanently. Cached pages are reused forever — never redownloaded.
import { openDB, type IDBPDatabase } from "idb";
import { pageImageUrl } from "./quran-meta";

const DB_NAME = "iqra-cache";
const STORE = "pages";
const SVG_STORE = "svgs";
const AYAH_STORE = "ayahs";
const VERSION = 2;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (typeof window === "undefined") throw new Error("client only");
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
        if (!db.objectStoreNames.contains(SVG_STORE)) db.createObjectStore(SVG_STORE);
        if (!db.objectStoreNames.contains(AYAH_STORE)) db.createObjectStore(AYAH_STORE);
      },
    });
  }
  return dbPromise;
}

function toDataUrl(text: string) {
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(text)))}`;
}

// Raw SVG markup of a page (used for the interactive ayah layer).
export async function getPageSvgText(page: number): Promise<string> {
  const db = await getDB();
  const cached = await db.get(SVG_STORE, page);
  if (cached) return cached as string;

  const res = await fetch(pageImageUrl(page));
  if (!res.ok) throw new Error(`Failed to load page ${page}`);
  const text = await res.text();
  await db.put(SVG_STORE, text, page);
  await db.put(STORE, toDataUrl(text), page);
  return text;
}

// Returns a data URL suitable for <img src>. First call downloads and stores;
// subsequent calls read from IndexedDB.
export async function getPageDataUrl(page: number): Promise<string> {
  const db = await getDB();
  const cached = await db.get(STORE, page);
  if (cached) return cached as string;
  const text = await getPageSvgText(page);
  return toDataUrl(text);
}

export async function hasPage(page: number): Promise<boolean> {
  const db = await getDB();
  const val = await db.getKey(STORE, page);
  return val !== undefined;
}

export async function prefetchPages(pages: number[]): Promise<void> {
  await Promise.allSettled(pages.map((p) => getPageSvgText(p)));
}

export async function cachedCount(): Promise<number> {
  const db = await getDB();
  return db.count(STORE);
}

export async function clearCache(): Promise<void> {
  const db = await getDB();
  await db.clear(STORE);
  await db.clear(SVG_STORE);
}

// --- Ayah text / tafsir cache -------------------------------------------

export async function readAyahCache<T>(key: string): Promise<T | undefined> {
  const db = await getDB();
  return (await db.get(AYAH_STORE, key)) as T | undefined;
}

export async function writeAyahCache(key: string, value: unknown): Promise<void> {
  const db = await getDB();
  await db.put(AYAH_STORE, value, key);
}
