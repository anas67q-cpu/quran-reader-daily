import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  X,
  Check,
  Loader2,
  ListOrdered,
  BookMarked,
  Bookmark,
  Copy,
  Eraser,
} from "lucide-react";
import { useApp, type HighlightColor } from "@/lib/store";
import { getPageDataUrl, getPageSvgText, prefetchPages } from "@/lib/page-cache";
import {
  buildPageLayout,
  containBox,
  hitTest,
  type AyahRegion,
  type PageLayout,
} from "@/lib/ayah-geometry";
import { fetchAyah, type AyahData } from "@/lib/quran-api";
import {
  surahForPage,
  juzForPage,
  toArabicDigits,
  TOTAL_PAGES,
  SURAH_STARTS,
  SURAH_NAMES_AR,
} from "@/lib/quran-meta";
import { KHATM_DUA } from "@/lib/verses";

export const Route = createFileRoute("/read")({
  head: () => ({ meta: [{ title: "القراءة — إقرأ" }] }),
  component: Reader,
});

type Sheet = null | "finish" | "jump" | "khatm" | "dua" | "ayah";

const HL_COLORS: { id: HighlightColor; label: string; rgb: string }[] = [
  { id: "gold", label: "ذهبي", rgb: "var(--hl-gold)" },
  { id: "green", label: "أخضر", rgb: "var(--hl-green)" },
  { id: "blue", label: "أزرق", rgb: "var(--hl-blue)" },
  { id: "rose", label: "وردي", rgb: "var(--hl-rose)" },
  { id: "violet", label: "بنفسجي", rgb: "var(--hl-violet)" },
];

function colorVar(c: HighlightColor) {
  return HL_COLORS.find((h) => h.id === c)?.rgb ?? "var(--hl-gold)";
}

function Reader() {
  const s = useApp();
  const navigate = useNavigate();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const [viewPage, setViewPage] = useState<number | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [layout, setLayout] = useState<PageLayout | null>(null);
  const [loading, setLoading] = useState(true);
  const [readingMode, setReadingMode] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [slideDir, setSlideDir] = useState<"next" | "prev" | null>(null);

  const [selected, setSelected] = useState<AyahRegion | null>(null);
  const [ayahData, setAyahData] = useState<AyahData | null>(null);
  const [ayahLoading, setAyahLoading] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    if (hydrated && viewPage == null) setViewPage(s.currentPage);
  }, [hydrated, s.currentPage, viewPage]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setBox({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setBox({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, [hydrated, viewPage]);

  useEffect(() => {
    if (!viewPage) return;
    let cancelled = false;
    setLoading(true);
    setSrc(null);
    setLayout(null);
    getPageSvgText(viewPage)
      .then((text) => {
        if (cancelled) return;
        setLayout(buildPageLayout(viewPage, text));
        return getPageDataUrl(viewPage);
      })
      .then((url) => {
        if (!cancelled && url) {
          setSrc(url);
          setLoading(false);
        }
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    void prefetchPages(
      [viewPage + 1, viewPage + 2, viewPage - 1].filter((p) => p >= 1 && p <= TOTAL_PAGES),
    );
    return () => { cancelled = true; };
  }, [viewPage]);

  const geom = useMemo(() => {
    if (!layout || !box.w || !box.h) return null;
    return containBox(box.w, box.h, layout.width, layout.height);
  }, [layout, box]);

  const goNext = useCallback(() => {
    setViewPage((p) => {
      if (p == null) return p;
      if (p >= TOTAL_PAGES) return p;
      setSlideDir("next");
      return p + 1;
    });
  }, []);

  const goPrev = useCallback(() => {
    setViewPage((p) => {
      if (p == null || p <= 1) return p;
      setSlideDir("prev");
      return p - 1;
    });
  }, []);

  const openAyah = useCallback((region: AyahRegion) => {
    setSelected(region);
    setSheet("ayah");
    setAyahData(null);
    setAyahLoading(true);
    fetchAyah(region.key)
      .then((d) => setAyahData(d))
      .finally(() => setAyahLoading(false));
  }, []);

  // Pointer gesture handling — tap, horizontal swipe, and long-press on an ayah.
  const gesture = useRef<{ x: number; y: number; t: number; moved: boolean } | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdFired = useRef(false);

  const clearHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };

  const regionAtClient = (clientX: number, clientY: number): AyahRegion | null => {
    const el = stageRef.current;
    if (!el || !layout || !geom) return null;
    const r = el.getBoundingClientRect();
    const sx = (clientX - r.left - geom.left) / geom.scale;
    const sy = (clientY - r.top - geom.top) / geom.scale;
    return hitTest(layout, sx, sy);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    gesture.current = { x: e.clientX, y: e.clientY, t: Date.now(), moved: false };
    holdFired.current = false;
    clearHold();
    const cx = e.clientX;
    const cy = e.clientY;
    holdTimer.current = setTimeout(() => {
      if (!gesture.current || gesture.current.moved) return;
      const region = regionAtClient(cx, cy);
      if (!region) return;
      holdFired.current = true;
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate?.(12);
      }
      openAyah(region);
    }, 480);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!gesture.current) return;
    const dx = Math.abs(e.clientX - gesture.current.x);
    const dy = Math.abs(e.clientY - gesture.current.y);
    if (dx > 8 || dy > 8) {
      gesture.current.moved = true;
      clearHold();
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    clearHold();
    if (!gesture.current) return;
    const dx = e.clientX - gesture.current.x;
    const dy = e.clientY - gesture.current.y;
    const dt = Date.now() - gesture.current.t;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    gesture.current = null;

    if (holdFired.current) {
      holdFired.current = false;
      return;
    }

    // Horizontal swipe wins over tap.
    if (absX > 45 && absX > absY * 1.3) {
      // RTL reading: swipe left→right (dx>0) advances forward; right→left goes back.
      if (dx > 0) goNext(); else goPrev();
      return;
    }
    // Tap (small movement, quick release) → toggle reading mode.
    if (absX < 10 && absY < 10 && dt < 400) {
      setReadingMode((r) => !r);
    }
  };

  if (hydrated && !s.onboarded) return <Navigate to="/onboarding" />;
  if (!viewPage) return null;

  const surah = surahForPage(viewPage);
  const juz = juzForPage(viewPage);

  const finishNow = () => {
    const khatmaDone = s.commitReading(viewPage);
    setSheet(null);
    if (khatmaDone) {
      setSheet("khatm");
    } else {
      navigate({ to: "/" });
    }
  };

  const startNextKhatma = () => {
    s.startNewKhatma();
    setSheet(null);
    setViewPage(1);
    setReadingMode(false);
  };

  const pageHighlights =
    layout?.regions.filter((r) => s.highlights[r.key]) ?? [];
  const pageBookmarks = layout?.regions.filter((r) =>
    s.bookmarks.some((b) => b.key === r.key),
  ) ?? [];

  return (
    <div dir="rtl" className="fixed inset-0 flex flex-col bg-background text-foreground overflow-hidden">
      {/* Header — hidden in reading mode */}
      {!readingMode && (
        <header className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-3 pt-3 pb-2 bg-gradient-to-b from-background/95 to-background/0 backdrop-blur-sm">
          <button
            onClick={() => navigate({ to: "/" })}
            aria-label="إغلاق"
            className="flex size-9 items-center justify-center rounded-full bg-card ring-1 ring-border"
          >
            <X className="size-4" />
          </button>
          <button
            onClick={() => setSheet("jump")}
            className="flex items-center gap-2 rounded-full bg-card px-3 py-1.5 ring-1 ring-border"
          >
            <span className="text-center leading-tight">
              <span className="block text-[10px] text-muted-foreground">
                الجزء {toArabicDigits(juz)} • صفحة {toArabicDigits(viewPage)}
              </span>
              <span className="block text-xs font-semibold">سورة {surah.name}</span>
            </span>
            <ListOrdered className="size-4 text-muted-foreground" />
          </button>
          <button
            onClick={() => setSheet("finish")}
            className="rounded-full bg-brass/15 px-3 py-1.5 text-xs font-semibold text-brass ring-1 ring-brass/25"
          >
            انتهيت
          </button>
        </header>
      )}

      {/* Full-screen page — swipe, tap & long-press zone */}
      <div
        ref={stageRef}
        className="absolute inset-0 flex items-center justify-center touch-pan-y select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { clearHold(); gesture.current = null; }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
          </div>
        )}
        {src && (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{
              background: "linear-gradient(180deg, #f7f1e3 0%, #f0e6d0 100%)",
            }}
          >
            <img
              key={viewPage}
              src={src}
              alt={`صفحة ${viewPage} — سورة ${surah.name}`}
              className={`h-full w-full object-contain ${
                slideDir === "next" ? "animate-slide-in-next" : slideDir === "prev" ? "animate-slide-in-prev" : ""
              }`}
              draggable={false}
              onAnimationEnd={() => setSlideDir(null)}
            />
          </div>
        )}

        {/* Interactive layer — highlights, bookmarks, selection */}
        {geom && layout && !slideDir && (
          <div className="pointer-events-none absolute inset-0">
            {pageHighlights.map((r) => {
              const c = colorVar(s.highlights[r.key].color);
              return r.rects.map((b, i) => (
                <span
                  key={`${r.key}-${i}`}
                  className="absolute rounded-[3px]"
                  style={{
                    left: geom.left + b.x * geom.scale,
                    top: geom.top + b.y * geom.scale,
                    width: b.w * geom.scale,
                    height: b.h * geom.scale,
                    backgroundColor: `rgb(${c} / 0.26)`,
                    boxShadow: `inset 0 -1.5px 0 rgb(${c} / 0.5)`,
                  }}
                />
              ));
            })}

            {selected && sheet === "ayah" && selected.page === viewPage &&
              selected.rects.map((b, i) => (
                <span
                  key={`sel-${i}`}
                  className="absolute rounded-[3px] ring-1 ring-[rgb(163_145_113)]"
                  style={{
                    left: geom.left + b.x * geom.scale,
                    top: geom.top + b.y * geom.scale,
                    width: b.w * geom.scale,
                    height: b.h * geom.scale,
                    backgroundColor: "rgb(163 145 113 / 0.22)",
                  }}
                />
              ))}

            {pageBookmarks.map((r) => (
              <span
                key={`bm-${r.key}`}
                className="absolute flex size-3.5 items-center justify-center rounded-full bg-brass shadow"
                style={{
                  left: geom.left + (r.marker.x - 1) * geom.scale,
                  top: geom.top + (r.marker.y - 12) * geom.scale,
                }}
              >
                <Bookmark className="size-2 text-background" />
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Sheets */}
      {sheet === "finish" && (
        <SheetShell onClose={() => setSheet(null)}>
          <h3 className="text-lg font-semibold text-center">هل تريد الإنهاء الآن؟</h3>
          <p className="mt-2 text-sm text-muted-foreground text-center">
            سنحفظ توقفك عند صفحة {toArabicDigits(viewPage)} — سورة {surah.name}.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-2">
            <button
              onClick={() => setSheet(null)}
              className="rounded-2xl bg-card py-3 text-sm font-medium ring-1 ring-border"
            >
              إلغاء
            </button>
            <button
              onClick={finishNow}
              className="rounded-2xl bg-brass py-3 text-sm font-semibold text-primary-foreground inline-flex items-center justify-center gap-1.5"
            >
              <Check className="size-4" />
              نعم، انتهيت
            </button>
          </div>
        </SheetShell>
      )}

      {sheet === "ayah" && selected && (
        <SheetShell onClose={() => { setSheet(null); setSelected(null); }} tall>
          <AyahPanel
            region={selected}
            data={ayahData}
            loading={ayahLoading}
            onClose={() => { setSheet(null); setSelected(null); }}
          />
        </SheetShell>
      )}

      {sheet === "jump" && (
        <SheetShell onClose={() => setSheet(null)}>
          <JumpPicker
            current={viewPage}
            onGo={(p) => {
              setSlideDir(p > viewPage ? "next" : "prev");
              setViewPage(p);
              setSheet(null);
            }}
          />
        </SheetShell>
      )}

      {sheet === "khatm" && (
        <SheetShell onClose={() => { /* modal: force explicit action */ }} nonDismiss>
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-brass/15 ring-1 ring-brass/25">
              <BookMarked className="size-8 text-brass" />
            </div>
            <h3 className="text-xl font-semibold">تقبّل الله منك</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              أتممت ختمة كاملة لكتاب الله. جعله الله شفيعًا لك يوم القيامة.
            </p>
            <div className="mt-6 w-full space-y-2">
              <button
                onClick={() => setSheet("dua")}
                className="w-full rounded-2xl bg-brass py-3 text-sm font-semibold text-primary-foreground"
              >
                مشاهدة دعاء ختم القرآن
              </button>
              <button
                onClick={startNextKhatma}
                className="w-full rounded-2xl bg-card py-3 text-sm font-medium ring-1 ring-border"
              >
                ابدأ ختمة جديدة
              </button>
            </div>
          </div>
        </SheetShell>
      )}

      {sheet === "dua" && (
        <SheetShell onClose={() => setSheet("khatm")} tall>
          <h3 className="text-lg font-semibold text-center mb-4">دعاء ختم القرآن</h3>
          <div
            className="font-quran-body text-lg leading-loose text-foreground/95 text-center whitespace-pre-line max-h-[60vh] overflow-y-auto px-2"
          >
            {KHATM_DUA}
          </div>
          <button
            onClick={startNextKhatma}
            className="mt-6 w-full rounded-2xl bg-brass py-3 text-sm font-semibold text-primary-foreground"
          >
            ابدأ ختمة جديدة
          </button>
        </SheetShell>
      )}
    </div>
  );
}

function AyahPanel({
  region,
  data,
  loading,
  onClose,
}: {
  region: AyahRegion;
  data: AyahData | null;
  loading: boolean;
  onClose: () => void;
}) {
  const s = useApp();
  const highlight = s.highlights[region.key];
  const bookmarked = s.bookmarks.some((b) => b.key === region.key);
  const [copied, setCopied] = useState(false);

  const meta = {
    key: region.key,
    surah: region.surah,
    ayah: region.ayah,
    page: region.page,
    x: region.marker.x,
    y: region.marker.y,
  };

  const applyColor = (color: HighlightColor) => {
    if (highlight?.color === color) s.removeHighlight(region.key);
    else s.setHighlight({ ...meta, color });
  };

  const copy = async () => {
    if (!data?.text) return;
    try {
      await navigator.clipboard.writeText(
        `${data.text}\n\n[سورة ${SURAH_NAMES_AR[region.surah - 1]} — الآية ${toArabicDigits(region.ayah)}]`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="flex max-h-[78vh] flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">
            سورة {SURAH_NAMES_AR[region.surah - 1]} • الآية {toArabicDigits(region.ayah)}
          </h3>
          <p className="mt-1 text-[11px] text-muted-foreground">
            السورة {toArabicDigits(region.surah)} • صفحة {toArabicDigits(region.page)} • الجزء{" "}
            {toArabicDigits(juzForPage(region.page))} • الموضع {region.marker.x.toFixed(1)}،{" "}
            {region.marker.y.toFixed(1)}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="إغلاق"
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="mt-4 flex items-center gap-2">
        {HL_COLORS.map((c) => (
          <button
            key={c.id}
            onClick={() => applyColor(c.id)}
            aria-label={`تظليل ${c.label}`}
            className={`size-8 rounded-full transition-transform ${
              highlight?.color === c.id ? "scale-110 ring-2 ring-brass ring-offset-2 ring-offset-card" : ""
            }`}
            style={{ backgroundColor: `rgb(${c.rgb} / 0.85)` }}
          />
        ))}
        <button
          onClick={() => s.removeHighlight(region.key)}
          aria-label="إزالة التظليل"
          disabled={!highlight}
          className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground disabled:opacity-40"
        >
          <Eraser className="size-4" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          onClick={() => s.toggleBookmark({ ...meta, createdAt: Date.now() })}
          className={`inline-flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-sm font-medium ring-1 ${
            bookmarked
              ? "bg-brass/15 text-brass ring-brass/30"
              : "bg-card text-foreground ring-border"
          }`}
        >
          <Bookmark className={`size-4 ${bookmarked ? "fill-current" : ""}`} />
          {bookmarked ? "محفوظة" : "حفظ علامة"}
        </button>
        <button
          onClick={copy}
          className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-card py-2.5 text-sm font-medium ring-1 ring-border"
        >
          <Copy className="size-4" />
          {copied ? "تم النسخ" : "نسخ الآية"}
        </button>
      </div>

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto pl-1">
        {loading && !data && (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        )}
        {data?.text && (
          <p className="font-quran text-2xl leading-[2.1] text-foreground text-center">
            {data.text}
          </p>
        )}
        {data && !data.text && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            تعذّر جلب نص الآية الآن.
          </p>
        )}
        {data?.tafsir && (
          <div className="mt-5 rounded-2xl bg-muted/50 p-4">
            <h4 className="mb-2 text-xs font-semibold text-brass">التفسير الميسر</h4>
            <p className="font-quran-body text-[15px] leading-8 text-foreground/90">
              {data.tafsir}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function SheetShell({
  children,
  onClose,
  nonDismiss,
  tall,
}: {
  children: React.ReactNode;
  onClose: () => void;
  nonDismiss?: boolean;
  tall?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={nonDismiss ? undefined : onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-[440px] rounded-t-3xl bg-card p-6 ring-1 ring-border animate-in-up ${
          tall ? "max-h-[90vh] overflow-hidden" : ""
        }`}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted" />
        {children}
      </div>
    </div>
  );
}

function JumpPicker({ current, onGo }: { current: number; onGo: (p: number) => void }) {
  const [tab, setTab] = useState<"surah" | "page">("surah");
  const [pageInput, setPageInput] = useState(String(current));

  return (
    <div>
      <h3 className="text-lg font-semibold text-center mb-4">الانتقال إلى</h3>
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1">
        <button
          onClick={() => setTab("surah")}
          className={`rounded-xl py-2 text-sm font-medium transition-colors ${
            tab === "surah" ? "bg-card text-foreground ring-1 ring-border" : "text-muted-foreground"
          }`}
        >
          سورة
        </button>
        <button
          onClick={() => setTab("page")}
          className={`rounded-xl py-2 text-sm font-medium transition-colors ${
            tab === "page" ? "bg-card text-foreground ring-1 ring-border" : "text-muted-foreground"
          }`}
        >
          صفحة
        </button>
      </div>

      {tab === "surah" ? (
        <div className="max-h-[55vh] overflow-y-auto rounded-2xl ring-1 ring-border">
          {SURAH_NAMES_AR.map((name, i) => (
            <button
              key={i}
              onClick={() => onGo(SURAH_STARTS[i])}
              className="flex w-full items-center justify-between border-b border-hairline px-4 py-3 last:border-0 hover:bg-muted"
            >
              <span className="flex items-center gap-3">
                <span className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-semibold text-brass">
                  {toArabicDigits(i + 1)}
                </span>
                <span className="text-sm font-medium">سورة {name}</span>
              </span>
              <span className="text-[11px] text-muted-foreground">
                صفحة {toArabicDigits(SURAH_STARTS[i])}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div>
          <label className="block text-xs text-muted-foreground mb-2">
            رقم الصفحة (١ – {toArabicDigits(TOTAL_PAGES)})
          </label>
          <input
            type="number"
            min={1}
            max={TOTAL_PAGES}
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            className="w-full rounded-2xl bg-muted px-4 py-3.5 text-center text-lg font-semibold outline-none focus:ring-2 focus:ring-brass"
          />
          <button
            onClick={() => {
              const n = Number(pageInput);
              if (Number.isFinite(n) && n >= 1 && n <= TOTAL_PAGES) onGo(Math.round(n));
            }}
            className="mt-4 w-full rounded-2xl bg-brass py-3 text-sm font-semibold text-primary-foreground"
          >
            انتقال
          </button>
        </div>
      )}
    </div>
  );
}
