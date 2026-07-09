import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { X, Check, Loader2, ListOrdered, BookMarked } from "lucide-react";
import { useApp } from "@/lib/store";
import { getPageDataUrl, prefetchPages } from "@/lib/page-cache";
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

type Sheet = null | "finish" | "jump" | "khatm" | "dua";

function Reader() {
  const s = useApp();
  const navigate = useNavigate();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const [viewPage, setViewPage] = useState<number | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [readingMode, setReadingMode] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [slideDir, setSlideDir] = useState<"next" | "prev" | null>(null);

  useEffect(() => {
    if (hydrated && viewPage == null) setViewPage(s.currentPage);
  }, [hydrated, s.currentPage, viewPage]);

  useEffect(() => {
    if (!viewPage) return;
    let cancelled = false;
    setLoading(true);
    setSrc(null);
    getPageDataUrl(viewPage)
      .then((url) => { if (!cancelled) { setSrc(url); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    void prefetchPages(
      [viewPage + 1, viewPage + 2, viewPage - 1].filter((p) => p >= 1 && p <= TOTAL_PAGES),
    );
    return () => { cancelled = true; };
  }, [viewPage]);

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

  // Pointer gesture handling — distinguishes tap from horizontal swipe.
  const gesture = useRef<{ x: number; y: number; t: number; moved: boolean } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    gesture.current = { x: e.clientX, y: e.clientY, t: Date.now(), moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!gesture.current) return;
    const dx = Math.abs(e.clientX - gesture.current.x);
    const dy = Math.abs(e.clientY - gesture.current.y);
    if (dx > 8 || dy > 8) gesture.current.moved = true;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!gesture.current) return;
    const dx = e.clientX - gesture.current.x;
    const dy = e.clientY - gesture.current.y;
    const dt = Date.now() - gesture.current.t;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    gesture.current = null;

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

      {/* Full-screen page — swipe & tap zone */}
      <div
        className="absolute inset-0 flex items-center justify-center touch-pan-y select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (gesture.current = null)}
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
