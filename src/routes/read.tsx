import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { X, ChevronRight, ChevronLeft, Check, Loader2 } from "lucide-react";
import { useApp, effectiveDailyGoal, isTodayComplete } from "@/lib/store";
import { getPageDataUrl, prefetchPages } from "@/lib/page-cache";
import { surahForPage, juzForPage, toArabicDigits, TOTAL_PAGES } from "@/lib/quran-meta";

export const Route = createFileRoute("/read")({
  head: () => ({ meta: [{ title: "القراءة — إقرأ" }] }),
  component: Reader,
});

function Reader() {
  const s = useApp();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  // Local view page — user can flip within their unlocked session
  const [viewPage, setViewPage] = useState<number | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [showContinueAsk, setShowContinueAsk] = useState(false);
  const askedRef = useRef(false);

  useEffect(() => {
    if (hydrated && viewPage == null) setViewPage(s.currentPage);
  }, [hydrated, s.currentPage, viewPage]);

  // Load page image
  useEffect(() => {
    if (!viewPage) return;
    let cancelled = false;
    setLoading(true);
    setSrc(null);
    getPageDataUrl(viewPage)
      .then((url) => { if (!cancelled) { setSrc(url); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    // Prefetch next 2 pages quietly
    void prefetchPages([viewPage + 1, viewPage + 2].filter((p) => p <= TOTAL_PAGES));
    return () => { cancelled = true; };
  }, [viewPage]);

  if (hydrated && !s.onboarded) return <Navigate to="/onboarding" />;
  if (!viewPage) return null;

  const surah = surahForPage(viewPage);
  const juz = juzForPage(viewPage);
  const goal = effectiveDailyGoal(s);
  const justCompleted = isTodayComplete(s);

  const advance = () => {
    // Record this page as read
    s.markPageRead();
    const nextView = viewPage + 1 > TOTAL_PAGES ? 1 : viewPage + 1;
    // Ask about continuing when goal reached first time this session
    const newlyComplete = !justCompleted && s.todayPagesRead + 1 >= goal;
    if (newlyComplete && !askedRef.current) {
      askedRef.current = true;
      setShowContinueAsk(true);
      // stay on next page in background
      setViewPage(nextView);
    } else {
      setViewPage(nextView);
    }
  };

  const goBack = () => setViewPage((p) => (p && p > 1 ? p - 1 : p));

  const finishNow = () => {
    s.finishSession();
    setShowFinishConfirm(false);
    // Navigate handled by Link
  };

  return (
    <div dir="rtl" className="fixed inset-0 flex flex-col bg-background text-foreground">
      {/* Header — buttons live here, never on the page image */}
      <header className="flex items-center justify-between px-4 pt-3 pb-2 bg-background/80 backdrop-blur-md">
        <Link
          to="/"
          aria-label="إغلاق"
          className="flex size-9 items-center justify-center rounded-full bg-card ring-1 ring-border"
        >
          <X className="size-4" />
        </Link>
        <div className="text-center leading-tight">
          <div className="text-[10px] text-muted-foreground">
            الجزء {toArabicDigits(juz)} • صفحة {toArabicDigits(viewPage)}
          </div>
          <div className="text-sm font-semibold">سورة {surah.name}</div>
        </div>
        <button
          onClick={() => setShowFinishConfirm(true)}
          className="rounded-full bg-brass/15 px-3 py-1.5 text-xs font-semibold text-brass ring-1 ring-brass/25"
        >
          انتهيت
        </button>
      </header>

      {/* Page image — full space, centered, preserved aspect */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden px-2">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
          </div>
        )}
        {src && (
          <img
            key={viewPage}
            src={src}
            alt={`صفحة ${viewPage} — سورة ${surah.name}`}
            className="max-h-full max-w-full h-auto w-auto object-contain select-none animate-in-up"
            style={{ filter: "drop-shadow(0 10px 30px rgba(0,0,0,0.5))" }}
            draggable={false}
          />
        )}

        {/* Tap zones for page navigation */}
        <button
          onClick={goBack}
          aria-label="السابق"
          className="absolute inset-y-0 right-0 w-1/4"
          type="button"
        />
        <button
          onClick={advance}
          aria-label="التالي"
          className="absolute inset-y-0 left-0 w-1/4"
          type="button"
        />
      </div>

      {/* Footer nav */}
      <footer className="flex items-center justify-between px-6 py-3 border-t border-hairline bg-background/80 backdrop-blur-md">
        <button
          onClick={goBack}
          disabled={viewPage <= 1}
          className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-muted-foreground disabled:opacity-30"
        >
          <ChevronRight className="size-4" />
          السابق
        </button>
        <div className="text-[11px] text-muted-foreground">
          {toArabicDigits(s.todayPagesRead)} / {toArabicDigits(goal)} اليوم
        </div>
        <button
          onClick={advance}
          className="flex items-center gap-1.5 rounded-xl bg-brass/10 px-3 py-2 text-sm font-semibold text-brass ring-1 ring-brass/20"
        >
          التالي
          <ChevronLeft className="size-4" />
        </button>
      </footer>

      {/* Sheets */}
      {showContinueAsk && (
        <Sheet onClose={() => setShowContinueAsk(false)}>
          <h3 className="text-lg font-semibold text-center">هل ترغب في مواصلة القراءة؟</h3>
          <p className="mt-2 text-sm text-muted-foreground text-center">
            أتممت ورد اليوم. نفتح لك ١٠ صفحات إضافية عند المتابعة.
          </p>
          <div className="mt-6 space-y-2">
            <button
              onClick={() => { s.extendGoal(10); setShowContinueAsk(false); }}
              className="w-full rounded-2xl bg-brass py-3 text-sm font-semibold text-primary-foreground"
            >
              نعم، أكمل القراءة
            </button>
            <Link
              to="/"
              onClick={() => setShowContinueAsk(false)}
              className="block w-full rounded-2xl bg-card py-3 text-center text-sm font-medium ring-1 ring-border"
            >
              لا، انتهيت
            </Link>
          </div>
        </Sheet>
      )}

      {showFinishConfirm && (
        <Sheet onClose={() => setShowFinishConfirm(false)}>
          <h3 className="text-lg font-semibold text-center">هل تريد الإنهاء الآن؟</h3>
          <p className="mt-2 text-sm text-muted-foreground text-center">
            سنحفظ توقفك عند صفحة {toArabicDigits(viewPage)} — سورة {surah.name}.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-2">
            <button
              onClick={() => setShowFinishConfirm(false)}
              className="rounded-2xl bg-card py-3 text-sm font-medium ring-1 ring-border"
            >
              إلغاء
            </button>
            <Link
              to="/"
              onClick={finishNow}
              className="rounded-2xl bg-brass py-3 text-center text-sm font-semibold text-primary-foreground inline-flex items-center justify-center gap-1.5"
            >
              <Check className="size-4" />
              نعم، انتهيت
            </Link>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[420px] rounded-t-3xl bg-card p-6 ring-1 ring-border animate-in-up"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted" />
        {children}
      </div>
    </div>
  );
}
