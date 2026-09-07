// Exact per-ayah hit regions derived from the real glyph outlines of the Mushaf
// page SVG — no approximation, no padded line boxes.
//
// Each page SVG holds:
//   * `ayah_markers`: one group per ayah ENDING on the page, carrying the printed
//     marker's coordinates (`ayah:x` / `ayah:y`, in viewBox units). These are
//     globally sequential across the 604 pages (6236 total).
//   * `content`: a single compound path whose sub-paths are the individual glyph
//     contours of the page.
//
// We parse every glyph contour into an exact bounding box (cubic extrema solved
// analytically), group the boxes into text lines with a projection profile, walk
// them in reading order (top→bottom, right→left) and cut the stream at each ayah
// marker. Each ayah therefore covers exactly the glyphs it is printed with:
// no empty margins, no Bismillah, no surah headers, no neighbouring surah.
import { versesEndingOnPage, PAGE_MARKER_COUNTS, ayahForGlobal, type AyahRef } from "./ayah-index";

export interface Rect { x: number; y: number; w: number; h: number }

export interface AyahRegion extends AyahRef {
  page: number;
  marker: { x: number; y: number };
  rects: Rect[];
  /** True when the ayah's end-marker is not on this page (it continues onward). */
  partial?: boolean;
}

export interface PageLayout {
  page: number;
  width: number;
  height: number;
  regions: AyahRegion[];
}

interface Box { x0: number; y0: number; x1: number; y1: number }

const MARKER_RE = /ayah:x="([\d.]+)"\s+ayah:y="([\d.]+)"/g;
const VIEWBOX_RE = /viewBox="([\d.\s-]+)"/;
const MATRIX_RE = /matrix\(([-\d.eE\s]+)\)/;
const NUM_RE = /[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/y;

/** Marker coordinates in reading order (top to bottom, right to left). */
export function parseMarkers(svgText: string): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  MARKER_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MARKER_RE.exec(svgText))) out.push({ x: +m[1], y: +m[2] });
  return out;
}

function parseViewBox(svgText: string): { w: number; h: number } {
  const m = VIEWBOX_RE.exec(svgText);
  if (!m) return { w: 345, h: 550 };
  const parts = m[1].trim().split(/\s+/).map(Number);
  return { w: parts[2] || 345, h: parts[3] || 550 };
}

// --- path parsing ---------------------------------------------------------

type Pt = [number, number];

function cubicExtrema(p0: Pt, p1: Pt, p2: Pt, p3: Pt, push: (x: number, y: number) => void) {
  for (let d = 0; d < 2; d++) {
    const a = -p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d];
    const b = 2 * (p0[d] - 2 * p1[d] + p2[d]);
    const c = -p0[d] + p1[d];
    const ts: number[] = [];
    if (Math.abs(a) < 1e-12) {
      if (Math.abs(b) > 1e-12) ts.push(-c / b);
    } else {
      const disc = b * b - 4 * a * c;
      if (disc >= 0) {
        const sq = Math.sqrt(disc);
        ts.push((-b + sq) / (2 * a), (-b - sq) / (2 * a));
      }
    }
    for (const t of ts) {
      if (t <= 0 || t >= 1) continue;
      const mt = 1 - t;
      const x = mt * mt * mt * p0[0] + 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t * t * t * p3[0];
      const y = mt * mt * mt * p0[1] + 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t * t * t * p3[1];
      push(x, y);
    }
  }
}

/** Tokenize an SVG path `d` attribute into commands and numbers. */
function tokenize(d: string): (string | number)[] {
  const out: (string | number)[] = [];
  let i = 0;
  while (i < d.length) {
    const ch = d[i];
    if (ch === " " || ch === "," || ch === "\n" || ch === "\t" || ch === "\r") { i++; continue; }
    if (/[A-DF-Za-df-z]/.test(ch)) { out.push(ch); i++; continue; }
    NUM_RE.lastIndex = i;
    const m = NUM_RE.exec(d);
    if (!m) { i++; continue; }
    out.push(parseFloat(m[0]));
    i = NUM_RE.lastIndex;
  }
  return out;
}

/**
 * Bounding box of every sub-path (glyph contour) of a compound path,
 * mapped through `translate` + the page matrix into viewBox coordinates.
 */
function glyphBoxes(
  d: string,
  tx: number, ty: number,
  mat: number[],
): Box[] {
  const [a, b, c, dd, e, f] = mat;
  const toX = (x: number, y: number) => a * (x + tx) + c * (y + ty) + e;
  const toY = (x: number, y: number) => b * (x + tx) + dd * (y + ty) + f;

  const boxes: Box[] = [];
  let cur: Box | null = null;
  const push = (x: number, y: number) => {
    const vx = toX(x, y), vy = toY(x, y);
    if (!cur) return;
    if (vx < cur.x0) cur.x0 = vx;
    if (vx > cur.x1) cur.x1 = vx;
    if (vy < cur.y0) cur.y0 = vy;
    if (vy > cur.y1) cur.y1 = vy;
  };

  const t = tokenize(d);
  let px = 0, py = 0, sx = 0, sy = 0;
  let ctrl: Pt | null = null;
  let cmd = "";
  let k = 0;
  while (k < t.length) {
    const tok = t[k];
    if (typeof tok === "string") {
      cmd = tok; k++;
      if (cmd === "z" || cmd === "Z") { px = sx; py = sy; ctrl = null; continue; }
      if (k >= t.length) break;
    }
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    if (C === "M") {
      let x = t[k] as number, y = t[k + 1] as number; k += 2;
      if (rel) { x += px; y += py; }
      px = x; py = y; sx = x; sy = y; ctrl = null;
      cur = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
      boxes.push(cur);
      push(x, y);
      cmd = rel ? "l" : "L";
    } else if (C === "L") {
      let x = t[k] as number, y = t[k + 1] as number; k += 2;
      if (rel) { x += px; y += py; }
      px = x; py = y; ctrl = null; push(x, y);
    } else if (C === "H") {
      let x = t[k] as number; k += 1;
      if (rel) x += px;
      px = x; ctrl = null; push(px, py);
    } else if (C === "V") {
      let y = t[k] as number; k += 1;
      if (rel) y += py;
      py = y; ctrl = null; push(px, py);
    } else if (C === "C" || C === "S") {
      let x1: number, y1: number, x2: number, y2: number, x: number, y: number;
      if (C === "C") {
        x1 = t[k] as number; y1 = t[k + 1] as number;
        x2 = t[k + 2] as number; y2 = t[k + 3] as number;
        x = t[k + 4] as number; y = t[k + 5] as number; k += 6;
        if (rel) { x1 += px; y1 += py; x2 += px; y2 += py; x += px; y += py; }
      } else {
        x2 = t[k] as number; y2 = t[k + 1] as number;
        x = t[k + 2] as number; y = t[k + 3] as number; k += 4;
        if (rel) { x2 += px; y2 += py; x += px; y += py; }
        if (ctrl) { x1 = 2 * px - ctrl[0]; y1 = 2 * py - ctrl[1]; } else { x1 = px; y1 = py; }
      }
      cubicExtrema([px, py], [x1, y1], [x2, y2], [x, y], push);
      push(x, y);
      ctrl = [x2, y2];
      px = x; py = y;
    } else {
      k++;
    }
  }
  return boxes.filter((bx) => Number.isFinite(bx.x0) && bx.x1 > bx.x0 - 1);
}

function contentGlyphs(svgText: string): Box[] {
  const ci = svgText.indexOf('id="content"');
  if (ci < 0) return [];
  const tail = svgText.slice(ci);
  const tm = /<g transform="translate\(([-\d.eE\s]+)\)"/.exec(tail);
  const [tx, ty] = tm ? tm[1].trim().split(/\s+/).map(Number) : [0, 0];
  const mm = MATRIX_RE.exec(svgText);
  const mat = mm ? mm[1].trim().split(/\s+/).map(Number) : [1, 0, 0, 1, 0, 0];
  let best = "";
  const re = /<path d="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tail))) if (m[1].length > best.length) best = m[1];
  if (!best) return [];
  return glyphBoxes(best, tx, ty, mat);
}

// --- line detection -------------------------------------------------------

interface Line { center: number; y0: number; y1: number; xmin: number; xmax: number; boxes: Box[] }

function detectLines(boxes: Box[], height: number): Line[] {
  const step = 0.5;
  const n = Math.ceil(height / step) + 2;
  const hist = new Float64Array(n);
  for (const b of boxes) {
    const yc = (b.y0 + b.y1) / 2;
    const i = Math.round(yc / step);
    if (i >= 0 && i < n) hist[i] += Math.max(b.x1 - b.x0, 0.3);
  }
  // box blur ±3 units
  const k = Math.round(3 / step);
  const pre = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + hist[i];
  const sm = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - k), z = Math.min(n, i + k + 1);
    sm[i] = (pre[z] - pre[a]) / (z - a);
  }

  // dominant line pitch via autocorrelation
  const lo = Math.round(10 / step);
  const hi = Math.round(Math.min(height / 3, 60) / step);
  let bestLag = lo, bestVal = -1;
  for (let lag = lo; lag < hi; lag++) {
    let c = 0;
    for (let i = 0; i + lag < n; i += 2) c += sm[i] * sm[i + lag];
    if (c > bestVal) { bestVal = c; bestLag = lag; }
  }
  const minSep = Math.max(2, Math.round(bestLag * 0.6));
  const peaks: { v: number; i: number }[] = [];
  for (let i = 1; i < n - 1; i++) {
    if (sm[i] > 0 && sm[i] >= sm[i - 1] && sm[i] > sm[i + 1]) peaks.push({ v: sm[i], i });
  }
  peaks.sort((a, b) => b.v - a.v);
  const chosen: number[] = [];
  for (const p of peaks) if (chosen.every((c) => Math.abs(c - p.i) >= minSep)) chosen.push(p.i);
  chosen.sort((a, b) => a - b);
  if (!chosen.length) return [];

  const centers = chosen.map((i) => i * step);
  const lines: Line[] = centers.map((c) => ({
    center: c, y0: Infinity, y1: -Infinity, xmin: Infinity, xmax: -Infinity, boxes: [],
  }));
  for (const b of boxes) {
    const yc = (b.y0 + b.y1) / 2;
    let bi = 0, bd = Infinity;
    for (let i = 0; i < centers.length; i++) {
      const d = Math.abs(centers[i] - yc);
      if (d < bd) { bd = d; bi = i; }
    }
    const L = lines[bi];
    L.boxes.push(b);
    if (b.y0 < L.y0) L.y0 = b.y0;
    if (b.y1 > L.y1) L.y1 = b.y1;
    if (b.x0 < L.xmin) L.xmin = b.x0;
    if (b.x1 > L.xmax) L.xmax = b.x1;
  }
  return lines.filter((L) => L.boxes.length > 0);
}

// --- layout ---------------------------------------------------------------

interface Item { line: number; x: number; box: Box; marker: number | null }

export function buildPageLayout(page: number, svgText: string): PageLayout {
  const { w, h } = parseViewBox(svgText);
  const markers = parseMarkers(svgText);
  const verses = versesEndingOnPage(page);
  const glyphs = contentGlyphs(svgText);
  const lines = detectLines(glyphs, h);

  if (!lines.length || !markers.length) {
    return { page, width: w, height: h, regions: [] };
  }

  // Non-overlapping vertical band per line.
  const bands = lines.map((L, i) => {
    let y0 = L.y0, y1 = L.y1;
    if (i > 0) y0 = Math.max(y0, (lines[i - 1].y1 + L.y0) / 2);
    if (i < lines.length - 1) y1 = Math.min(y1, (L.y1 + lines[i + 1].y0) / 2);
    return { y0, y1: Math.max(y1, y0 + 4) };
  });
  const textRight = Math.max(...lines.map((L) => L.xmax));

  // The SVG lists markers in file order, which is not the reading order.
  // Sort them top→bottom, right→left so marker[i] matches the i-th span.
  const lineOf = (y: number) => {
    let bi = 0, bd = Infinity;
    lines.forEach((L, i) => {
      const d = Math.abs(L.center - y);
      if (d < bd) { bd = d; bi = i; }
    });
    return bi;
  };
  markers.sort((a, b) => {
    const la = lineOf(a.y), lb = lineOf(b.y);
    return la !== lb ? la - lb : b.x - a.x;
  });



  const items: Item[] = [];
  lines.forEach((L, li) => {
    for (const b of L.boxes) items.push({ line: li, x: (b.x0 + b.x1) / 2, box: b, marker: null });
  });
  markers.forEach((mk, mi) => {
    let bi = 0, bd = Infinity;
    lines.forEach((L, i) => {
      const d = Math.abs(L.center - mk.y);
      if (d < bd) { bd = d; bi = i; }
    });
    items.push({
      line: bi,
      x: mk.x,
      box: { x0: mk.x - 2.5, y0: lines[bi].y0, x1: mk.x + 2.5, y1: lines[bi].y1 },
      marker: mi,
    });
  });
  items.sort((a, b) => (a.line !== b.line ? a.line - b.line : b.x - a.x));

  // Cut the reading stream at every ayah marker.
  const spans: Item[][] = [];
  let cur: Item[] = [];
  for (const it of items) {
    cur.push(it);
    if (it.marker !== null) { spans.push(cur); cur = []; }
  }
  const tail = cur.length ? cur : null;

  const regions: AyahRegion[] = [];
  const emit = (span: Item[], ref: AyahRef, marker: { x: number; y: number }, partial: boolean) => {
    const byLine = new Map<number, Item[]>();
    let markerLine = -1;
    for (const it of span) {
      if (it.marker !== null) markerLine = it.line;
      const arr = byLine.get(it.line);
      if (arr) arr.push(it); else byLine.set(it.line, [it]);
    }
    let ls = [...byLine.keys()].sort((a, b) => a - b);

    // First ayah of a surah: drop the surah title and the Bismillah lines that
    // precede it. Both are set as short, centred lines; the ayah itself always
    // begins flush with the right text margin. Never drop the marker's own line
    // (Al-Fatihah's Bismillah IS ayah 1).
    if (ref.ayah === 1) {
      const keep: number[] = [];
      let dropping = true;
      for (const li of ls) {
        const centred = textRight - lines[li].xmax > 0.04 * w;
        if (dropping && li !== markerLine && centred) continue;
        dropping = false;
        keep.push(li);
      }
      if (keep.length) ls = keep;
    }

    const rects: Rect[] = [];
    for (const li of ls) {
      const bs = byLine.get(li)!;
      const x0 = Math.min(...bs.map((it) => it.box.x0));
      const x1 = Math.max(...bs.map((it) => it.box.x1));
      if (x1 - x0 < 1) continue;
      const band = bands[li];
      rects.push({
        x: +(x0 - 0.6).toFixed(2),
        y: +band.y0.toFixed(2),
        w: +(x1 - x0 + 1.2).toFixed(2),
        h: +(band.y1 - band.y0).toFixed(2),
      });
    }
    if (rects.length) regions.push({ ...ref, page, marker, rects, partial });
  };

  const n = Math.min(spans.length, verses.length);
  for (let i = 0; i < n; i++) emit(spans[i], verses[i], markers[i], false);

  // Glyphs after the last marker belong to the ayah that ends on the next page.
  if (tail) {
    let start = 1;
    for (let p = 0; p < page - 1; p++) start += PAGE_MARKER_COUNTS[p];
    const nextGlobal = start + PAGE_MARKER_COUNTS[page - 1];
    if (nextGlobal <= 6236) {
      const ref = ayahForGlobal(nextGlobal);
      const last = markers[markers.length - 1];
      emit(tail, ref, { x: last?.x ?? 0, y: last?.y ?? 0 }, true);
    }
  }

  return { page, width: w, height: h, regions };
}

/** Hit-test in viewBox coordinates, with a small touch tolerance. */
export function hitTest(layout: PageLayout, x: number, y: number, tol = 4): AyahRegion | null {
  let best: AyahRegion | null = null;
  let bestD = Infinity;
  for (const r of layout.regions) {
    for (const b of r.rects) {
      const dx = Math.max(b.x - x, 0, x - (b.x + b.w));
      const dy = Math.max(b.y - y, 0, y - (b.y + b.h));
      const d = Math.hypot(dx, dy);
      if (d === 0) return r;
      if (d < bestD) { bestD = d; best = r; }
    }
  }
  return bestD <= tol ? best : null;
}

/** Geometry of the <img> content box for an object-contain SVG page. */
export function containBox(
  boxW: number,
  boxH: number,
  vbW: number,
  vbH: number,
) {
  const scale = Math.min(boxW / vbW, boxH / vbH);
  const w = vbW * scale;
  const hh = vbH * scale;
  return { left: (boxW - w) / 2, top: (boxH - hh) / 2, scale };
}
