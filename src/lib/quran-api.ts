// Ayah text + tafsir from the Quran.com API (data only — the Mushaf itself is
// always the original SVG page image). Results are cached permanently offline.
import { readAyahCache, writeAyahCache } from "./page-cache";

const BASE = "https://api.quran.com/api/v4";
const TAFSIR_ID = 16; // التفسير الميسر

export interface AyahData {
  key: string;
  text: string;
  tafsir: string | null;
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchAyah(key: string): Promise<AyahData> {
  const cached = await readAyahCache<AyahData>(key).catch(() => undefined);
  if (cached?.text) return cached;

  const [textRes, tafsirRes] = await Promise.allSettled([
    fetch(`${BASE}/verses/by_key/${key}?fields=text_uthmani`).then((r) => r.json()),
    fetch(`${BASE}/tafsirs/${TAFSIR_ID}/by_ayah/${key}`).then((r) => r.json()),
  ]);

  const text =
    textRes.status === "fulfilled" ? (textRes.value?.verse?.text_uthmani ?? "") : "";
  const tafsirRaw =
    tafsirRes.status === "fulfilled" ? (tafsirRes.value?.tafsir?.text ?? null) : null;

  const data: AyahData = { key, text, tafsir: tafsirRaw ? stripHtml(tafsirRaw) : null };
  if (data.text) await writeAyahCache(key, data).catch(() => undefined);
  return data;
}
