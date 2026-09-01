// Builds exact per-ayah hit regions from the Mushaf page SVG.
//
// Every page SVG carries an `ayah_markers` group: one entry per ayah that ENDS
// on the page, each with the printed marker's exact coordinates (`ayah:x` /
// `ayah:y`, in viewBox units). Those markers are globally sequential across the
// 604 pages (6236 total), so they map one-to-one onto the ayah index.
//
// An ayah's region on the page runs from the previous marker (or the top-right
// of the first line) leftwards/downwards to its own marker, respecting RTL flow.
import { versesEndingOnPage, type AyahRef } from "./ayah-index";

export interface Rect { x: number; y: number; w: number; h: number }

export interface AyahRegion extends AyahRef {
  page: number;
  marker: { x: number; y: number };
  rects: Rect[];
}

export interface PageLayout {
  page: number;
  width: number;
  height: number;
  regions: AyahRegion[];
}

const MARKER_RE = /ayah:x="([\d.]+)"\s+ayah:y="([\d.]+)"/g;
const VIEWBOX_RE = /viewBox="([\d.\s-]+)"/;

/** Marker coordinates in reading order (top to bottom, right to left). */
export function parseMarkers(svgText: string): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  MARKER_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MARKER_RE.exec(svgText))) out.push({ x: +m[1], y: +m[2] });
  out.sort((a, b) => (Math.abs(a.y - b.y) > 12 ? a.y - b.y : b.x - a.x));
  return out;
}

function parseViewBox(svgText: string): { w: number; h: number } {
  const m = VIEWBOX_RE.exec(svgText);
  if (!m) return { w: 345, h: 550 };
  const parts = m[1].trim().split(/\s+/).map(Number);
  return { w: parts[2] || 345, h: parts[3] || 550 };
}

function linePitch(ys: number[]): number {
  const uniq: number[] = [];
  for (const y of ys) if (!uniq.some((u) => Math.abs(u - y) <= 12)) uniq.push(y);
  uniq.sort((a, b) => a - b);
  let best = Infinity;
  for (let i = 1; i < uniq.length; i++) {
    const d = uniq[i] - uniq[i - 1];
    if (d >= 20 && d < best) best = d;
  }
  return Number.isFinite(best) ? best : 35.85;
}

export function buildPageLayout(page: number, svgText: string): PageLayout {
  const { w, h } = parseViewBox(svgText);
  const markers = parseMarkers(svgText);
  const verses = versesEndingOnPage(page);
  const pitch = linePitch(markers.map((m) => m.y));

  const left = Math.max(6, Math.min(...markers.map((m) => m.x)) - 3);
  const right = w - left;
  const markerW = 11;

  const bandTop = (y: number) => y - pitch * 0.6;
  const bandH = pitch * 0.82;
  const sameLine = (a: number, b: number) => Math.abs(a - b) <= 12;

  const regions: AyahRegion[] = [];
  const n = Math.min(markers.length, verses.length);

  for (let i = 0; i < n; i++) {
    const end = markers[i];
    const prev = i > 0 ? markers[i - 1] : { x: right, y: markers[0].y };
    const rects: Rect[] = [];

    if (sameLine(prev.y, end.y)) {
      const x1 = Math.min(end.x, prev.x);
      const x2 = Math.max(end.x + markerW, prev.x);
      rects.push({ x: x1, y: bandTop(end.y), w: Math.max(x2 - x1, 6), h: bandH });
    } else {
      // Remainder of the line where the previous ayah ended (leftwards).
      if (prev.x - left > 4) {
        rects.push({ x: left, y: bandTop(prev.y), w: prev.x - left, h: bandH });
      }
      // Whole lines in between.
      for (let y = prev.y + pitch; y < end.y - 12; y += pitch) {
        rects.push({ x: left, y: bandTop(y), w: right - left, h: bandH });
      }
      // Final line up to (and including) the ayah marker.
      const x1 = end.x;
      rects.push({ x: x1, y: bandTop(end.y), w: Math.max(right - x1, 6), h: bandH });
    }

    regions.push({ ...verses[i], page, marker: { x: end.x, y: end.y }, rects });
  }

  return { page, width: w, height: h, regions };
}

export function hitTest(layout: PageLayout, x: number, y: number): AyahRegion | null {
  for (const r of layout.regions) {
    for (const b of r.rects) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return r;
    }
  }
  return null;
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
