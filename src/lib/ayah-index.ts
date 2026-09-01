// Exact ayah <-> Mushaf page index derived from the Madinah Mushaf SVG assets.
// PAGE_MARKER_COUNTS[p-1] = number of ayah end-markers that appear on page p.
// The markers are globally sequential: the total is exactly 6236, and every
// surah start page derived from this table matches the printed Madinah Mushaf.

export const AYAH_COUNTS: number[] = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135, 112, 78, 118, 64,
  77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38, 29,
  18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28,
  20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19,
  5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6,
];

export const PAGE_MARKER_COUNTS: number[] = [
  7, 5, 11, 8, 5, 8, 11, 9, 4, 8, 7, 7, 5, 5, 8, 4, 7, 7, 7, 8, 7, 4, 8, 10,
  6, 7, 5, 5, 4, 6, 6, 8, 5, 4, 5, 6, 3, 4, 8, 3, 4, 4, 3, 5, 5, 5, 7, 1,
  4, 9, 6, 7, 7, 8, 8, 7, 9, 9, 7, 6, 8, 9, 8, 7, 6, 11, 8, 8, 5, 4, 8, 8,
  7, 6, 8, 6, 6, 5, 3, 5, 4, 3, 7, 4, 7, 7, 8, 6, 9, 5, 7, 5, 3, 7, 4, 8,
  8, 6, 7, 6, 7, 7, 8, 8, 5, 3, 3, 4, 4, 4, 6, 8, 5, 5, 4, 5, 7, 7, 6, 7,
  6, 7, 5, 8, 5, 5, 7, 8, 10, 9, 8, 9, 8, 7, 9, 5, 8, 9, 4, 7, 9, 8, 6, 6,
  7, 5, 4, 5, 6, 8, 11, 11, 8, 7, 6, 8, 6, 10, 6, 8, 6, 8, 9, 16, 10, 7, 6, 6,
  6, 4, 4, 7, 8, 9, 8, 11, 8, 8, 9, 8, 7, 5, 7, 9, 8, 6, 6, 7, 7, 6, 5, 5,
  4, 7, 7, 7, 7, 4, 7, 7, 7, 6, 7, 5, 6, 5, 7, 6, 8, 6, 5, 8, 9, 11, 8, 9,
  8, 10, 9, 9, 8, 7, 7, 9, 9, 8, 8, 9, 9, 10, 7, 9, 11, 9, 10, 10, 8, 8, 7, 6,
  9, 11, 6, 9, 8, 9, 8, 8, 5, 8, 5, 10, 6, 8, 6, 5, 8, 6, 9, 9, 10, 15, 16, 20,
  19, 20, 15, 8, 12, 8, 8, 12, 10, 8, 7, 8, 6, 9, 8, 8, 10, 7, 10, 10, 11, 11, 9, 8,
  9, 11, 10, 8, 11, 11, 5, 7, 7, 11, 8, 8, 13, 9, 14, 13, 11, 14, 13, 13, 13, 12, 19, 15,
  25, 14, 13, 12, 11, 11, 15, 12, 10, 10, 14, 11, 9, 13, 15, 9, 9, 11, 11, 5, 10, 8, 7, 8,
  8, 9, 9, 8, 6, 17, 10, 15, 17, 15, 15, 15, 14, 10, 10, 7, 4, 5, 7, 10, 5, 3, 5, 9,
  9, 12, 11, 12, 12, 10, 19, 20, 21, 23, 28, 25, 23, 24, 23, 21, 13, 9, 13, 9, 11, 8, 13, 12,
  10, 8, 8, 7, 7, 8, 7, 9, 11, 7, 7, 10, 8, 9, 7, 8, 7, 7, 11, 11, 10, 9, 8, 9,
  9, 10, 11, 8, 9, 6, 11, 9, 10, 6, 9, 7, 8, 5, 8, 7, 4, 8, 11, 7, 7, 8, 9, 8,
  9, 9, 8, 7, 12, 8, 6, 13, 15, 13, 14, 16, 13, 24, 27, 25, 26, 24, 27, 29, 16, 10, 16, 19,
  22, 10, 5, 11, 10, 9, 7, 9, 11, 7, 8, 9, 9, 8, 7, 9, 9, 8, 11, 8, 11, 9, 9, 9,
  8, 8, 10, 5, 7, 9, 13, 7, 12, 12, 11, 14, 13, 13, 16, 18, 21, 20, 13, 9, 10, 10, 9, 6,
  8, 7, 11, 8, 10, 9, 9, 6, 8, 5, 5, 7, 7, 15, 20, 16, 24, 21, 23, 17, 18, 26, 18, 24,
  21, 22, 24, 23, 28, 25, 34, 26, 23, 8, 7, 6, 5, 6, 5, 10, 4, 6, 7, 8, 5, 6, 7, 9,
  8, 7, 7, 9, 9, 5, 7, 7, 5, 12, 14, 20, 26, 18, 27, 27, 30, 14, 18, 13, 15, 19, 19, 29,
  28, 26, 20, 25, 31, 30, 26, 30, 40, 31, 23, 29, 27, 23, 27, 31, 26, 26, 26, 25, 26, 17, 16, 25,
  17, 14, 14, 15,
];

// Cumulative first global ayah index (1-based) for each page.
const PAGE_FIRST: number[] = (() => {
  const out: number[] = [];
  let acc = 1;
  for (const c of PAGE_MARKER_COUNTS) { out.push(acc); acc += c; }
  return out;
})();

const SURAH_CUM: number[] = (() => {
  const out = [0];
  for (const c of AYAH_COUNTS) out.push(out[out.length - 1] + c);
  return out;
})();

export interface AyahRef { surah: number; ayah: number; key: string }

/** Convert a global 1-based ayah index into a surah/ayah reference. */
export function ayahForGlobal(index: number): AyahRef {
  let lo = 0, hi = 113, s = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (SURAH_CUM[mid] < index) { s = mid; lo = mid + 1; } else { hi = mid - 1; }
  }
  const ayah = index - SURAH_CUM[s];
  return { surah: s + 1, ayah, key: `${s + 1}:${ayah}` };
}

export function globalForAyah(surah: number, ayah: number): number {
  return SURAH_CUM[surah - 1] + ayah;
}

/**
 * Ayat whose end-marker is printed on the given page, in reading order.
 * The n-th entry corresponds to the n-th ayah marker of the page SVG.
 */
export function versesEndingOnPage(page: number): AyahRef[] {
  const start = PAGE_FIRST[page - 1];
  const count = PAGE_MARKER_COUNTS[page - 1];
  const out: AyahRef[] = [];
  for (let i = 0; i < count; i++) out.push(ayahForGlobal(start + i));
  return out;
}

/** Page on which the given ayah's end-marker is printed. */
export function pageForAyah(surah: number, ayah: number): number {
  const g = globalForAyah(surah, ayah);
  let lo = 0, hi = 603, ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (PAGE_FIRST[mid] <= g) { ans = mid; lo = mid + 1; } else { hi = mid - 1; }
  }
  return ans + 1;
}
