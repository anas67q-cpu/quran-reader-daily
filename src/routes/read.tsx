import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { animate, useMotionValue, useReducedMotion } from "motion/react";
import {
  X,
  Check,
  Loader2,
  ListOrdered,
  BookMarked,
  Star,
  Copy,
  Eraser,
} from "lucide-react";
import { useApp, type HighlightColor } from "@/lib/store";
import { useMushafPages, type MushafPageData } from "@/hooks/use-mushaf-pages";
import { MushafPage, MushafTurningPage } from "@/components/mushaf-page";
import { turnDirection, turnTarget, turnProgress, shouldCompleteTurn, type TurnDirection } from "@/lib/page-turn";
import {
  containBox,
  hitTest,
  type AyahRegion,
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
  head: () => ({
    meta: [
      { title: "القراءة — إقرأ: كل يوم" },
      { name: "description", content: "اقرأ القرآن الكريم على صفحات مصحف المدينة، وتابع موضع توقفك." },
      { property: "og:title", content: "القراءة — إقرأ: كل يوم" },
      { property: "og:description", content: "اقرأ القرآن الكريم على صفحات مصحف المدينة، وتابع موضع توقفك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
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
  const { pages, loadPage, failed } = useMushafPages(viewPage);
  const activePage = viewPage == null ? undefined : pages[viewPage];
  const layout = activePage?.layout ?? null;
  const loading = !activePage && !failed;
  const [readingMode, setReadingMode] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  type PageTurn = { direction: TurnDirection; target: number; settling: boolean };
  const [turn, setTurn] = useState<PageTurn | null>(null);
  const turnRef = useRef<PageTurn | null>(null);
  const turnAmount = useMotionValue(0);
  const reducedMotion = useReducedMotion();
  const animation = useRef<ReturnType<typeof animate> | null>(null);
  const turnSession = useRef(0);

  const [selected, setSelected] = useState<AyahRegion | null>(null);
  const [ayahData, setAyahData] = useState<AyahData | null>(null);
  const [ayahLoading, setAyahLoading] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    // Open on the saved stopping point when there is one.
    if (hydrated && viewPage == null) setViewPage(s.stopPoint?.page ?? s.currentPage);
  }, [hydrated, s.currentPage, s.stopPoint, viewPage]);

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

  const geom = useMemo(() => {
    if (!layout || !box.w || !box.h) return null;
    return containBox(box.w, box.h, layout.width, layout.height);
  }, [layout, box]);

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
  const gesture = useRef<{
    x: number; y: number; t: number; moved: boolean; horizontal: boolean;
    pointer: number; lastX: number; lastT: number; velocity: number;
  } | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdFired = useRef(false);

  const clearHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };

  const clearTurn = useCallback(() => {
    turnSession.current += 1;
    animation.current?.stop();
    animation.current = null;
    turnRef.current = null;
    setTurn(null);
    turnAmount.set(0);
    gesture.current = null;
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
  }, [turnAmount]);

  const goToPage = (number: number) => {
    clearTurn();
    setViewPage(number);
  };

  useEffect(() => () => {
    turnSession.current += 1;
    animation.current?.stop();
    if (holdTimer.current) clearTimeout(holdTimer.current);
  }, []);

  const settleTurn = async (complete: boolean) => {
    const current = turnRef.current;
    if (!current || current.settling) return;
    const session = turnSession.current;
    const settling = { ...current, settling: true };
    turnRef.current = settling;
    setTurn(settling);
    if (complete) {
      try {
        // Await the actual decoded SVG; never commit to a blank or loading page.
        await loadPage(current.target);
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      } catch {
        if (session === turnSession.current) clearTurn();
        return;
      }
    }
    if (session !== turnSession.current) return;
    const controls = animate(turnAmount, complete ? 1 : 0, {
      type: "tween",
      duration: reducedMotion ? 0 : Math.max(0.18, Math.abs((complete ? 1 : 0) - turnAmount.get()) * 0.38),
      ease: [0.22, 0.68, 0.2, 1],
    });
    animation.current = controls;
    await controls;
    if (session !== turnSession.current) return;
    if (complete) setViewPage(current.target);
    clearTurn();
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
    if (!activePage || sheet || turnRef.current || !e.isPrimary || e.button !== 0) return;
    gesture.current = {
      x: e.clientX, y: e.clientY, t: Date.now(), moved: false, horizontal: false,
      pointer: e.pointerId, lastX: e.clientX, lastT: performance.now(), velocity: 0,
    };
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
    const g = gesture.current;
    if (!g || g.pointer !== e.pointerId || holdFired.current) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
      g.moved = true;
      clearHold();
    }
    if (!g.horizontal && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      const direction = turnDirection(dx);
      const target = viewPage != null && direction ? turnTarget(viewPage, direction) : null;
      if (direction && target != null) {
        g.horizontal = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        const next = { direction, target, settling: false };
        turnRef.current = next;
        setTurn(next);
        void loadPage(target).catch(() => {});
      }
    }
    const current = turnRef.current;
    if (g.horizontal && current && !current.settling && geom && layout) {
      const now = performance.now();
      const dt = now - g.lastT;
      if (dt > 0) g.velocity = (e.clientX - g.lastX) / dt;
      g.lastX = e.clientX;
      g.lastT = now;
      turnAmount.set(turnProgress(dx, layout.width * geom.scale, current.direction));
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    clearHold();
    if (!gesture.current || gesture.current.pointer !== e.pointerId) return;
    const g = gesture.current;
    const dx = e.clientX - gesture.current.x;
    const dy = e.clientY - gesture.current.y;
    const dt = Date.now() - gesture.current.t;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    gesture.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);

    if (holdFired.current) {
      holdFired.current = false;
      return;
    }

    if (g.horizontal && turnRef.current) {
      const velocity = performance.now() - g.lastT > 100 ? 0 :
        g.velocity * (turnRef.current.direction === "next" ? -1 : 1);
      void settleTurn(shouldCompleteTurn(turnAmount.get(), velocity));
      return;
    }
    // Tap (small movement, quick release) → toggle reading mode.
    if (absX < 10 && absY < 10 && dt < 400) {
      setReadingMode((r) => !r);
    }
  };

  const cancelGesture = () => {
    clearHold();
    gesture.current = null;
    holdFired.current = false;
    if (turnRef.current && !turnRef.current.settling) void settleTurn(false);
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
    goToPage(1);
    setReadingMode(false);
  };

  const interactiveLayer = (page: MushafPageData) => (
    <AyahOverlay page={page} box={box} selected={selected} showSelection={sheet === "ayah"} />
  );
  const revealedPage = turn ? pages[turn.target] : undefined;

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

      {/* موضع التوقف المحفوظ */}
      {!readingMode && s.stopPoint && (
        <div className="absolute top-[52px] inset-x-0 z-20 flex justify-center px-3">
          <button
            onClick={() => { if (s.stopPoint) goToPage(s.stopPoint.page); }}
            className="inline-flex items-center gap-1.5 rounded-full bg-card/90 px-3 py-1 text-[11px] text-brass ring-1 ring-brass/25 backdrop-blur-sm"
          >
            <Star className="size-3 fill-current" />
            توقفك عند الصفحة {toArabicDigits(s.stopPoint.page)}، الآية{" "}
            {toArabicDigits(s.stopPoint.ayah)}
          </button>
        </div>
      )}


      {/* Full-screen page — swipe, tap & long-press zone */}
      <div
        ref={stageRef}
        className="mushaf-paper absolute inset-0 flex items-center justify-center touch-pan-y select-none overflow-hidden"
        data-reader-page={viewPage}
        data-turning={turn?.direction ?? "none"}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={cancelGesture}
        onLostPointerCapture={() => { if (gesture.current) cancelGesture(); }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
          </div>
        )}
        {activePage && (turn && revealedPage ? (
          <>
            <div className="absolute inset-0" aria-hidden="true">
              <MushafPage page={revealedPage} box={box}>{interactiveLayer(revealedPage)}</MushafPage>
            </div>
            <MushafTurningPage page={activePage} box={box} direction={turn.direction} progress={turnAmount}>
              {interactiveLayer(activePage)}
            </MushafTurningPage>
          </>
        ) : (
          <MushafPage page={activePage} box={box}>{interactiveLayer(activePage)}</MushafPage>
        ))}
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
              goToPage(p);
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

/** Same exact SVG-coordinate layer, carried with each page during its turn. */
function AyahOverlay({ page, box, selected, showSelection }: {
  page: MushafPageData;
  box: { w: number; h: number };
  selected: AyahRegion | null;
  showSelection: boolean;
}) {
  const s = useApp();
  const layout = page.layout;
  const geom = containBox(box.w, box.h, layout.width, layout.height);
  const pageHighlights = layout.regions.filter((r) => s.highlights[r.key]);
  const stopRegion = layout.regions.find((r) => s.stopPoint && r.key === s.stopPoint.key);
  const rectStyle = (b: AyahRegion["rects"][number]) => ({
    left: geom.left + b.x * geom.scale,
    top: geom.top + b.y * geom.scale,
    width: b.w * geom.scale,
    height: b.h * geom.scale,
  });
  return (
    <div className="pointer-events-none absolute inset-0" data-ayah-overlay={page.number}>
      {pageHighlights.map((r) => {
        const c = colorVar(s.highlights[r.key].color);
        return r.rects.map((b, i) => (
          <span key={`${r.key}-${i}`} className="absolute rounded-[3px]" style={{
            ...rectStyle(b), backgroundColor: `rgb(${c} / 0.26)`,
            boxShadow: `inset 0 -1.5px 0 rgb(${c} / 0.5)`,
          }} />
        ));
      })}
      {selected && showSelection && selected.page === page.number && selected.rects.map((b, i) => (
        <span key={`sel-${i}`} className="absolute rounded-[3px] ring-1 ring-brass" style={{
          ...rectStyle(b), backgroundColor: "color-mix(in oklab, var(--brass) 22%, transparent)",
        }} />
      ))}
      {stopRegion && <>
        {stopRegion.rects.map((b, i) => (
          <span key={`stop-${i}`} data-stop-highlight={stopRegion.key} className="absolute rounded-[3px]" style={{
            ...rectStyle(b), backgroundColor: "rgb(var(--hl-brown) / 0.26)",
            boxShadow: "inset 0 -1.5px 0 rgb(var(--hl-brown) / 0.5)",
          }} />
        ))}
        <span data-stop-star={stopRegion.key} className="absolute flex size-3.5 items-center justify-center rounded-full bg-brass shadow" style={{
          left: geom.left + (stopRegion.marker.x - 1) * geom.scale,
          top: geom.top + (stopRegion.marker.y - 12) * geom.scale,
        }}><Star className="size-2 fill-current text-background" /></span>
      </>}
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
  const isStop = s.stopPoint?.key === region.key;
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
            {toArabicDigits(juzForPage(region.page))} • الموضع {toArabicDigits(region.marker.x.toFixed(1))}،{" "}
            {toArabicDigits(region.marker.y.toFixed(1))}
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
          onClick={() =>
            s.setStopPoint(isStop ? null : { ...meta, createdAt: Date.now() })
          }
          className={`inline-flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-sm font-medium ring-1 ${
            isStop
              ? "bg-brass/15 text-brass ring-brass/30"
              : "bg-card text-foreground ring-border"
          }`}
        >
          <Star className={`size-4 ${isStop ? "fill-current" : ""}`} />
          {isStop ? "توقفك هنا" : "التوقف هنا"}
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
