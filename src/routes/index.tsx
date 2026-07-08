import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Flame, ArrowLeft, Sparkles } from "lucide-react";
import { TabBar } from "@/components/TabBar";
import { useApp, effectiveDailyGoal, isTodayComplete, todayString } from "@/lib/store";
import { surahForPage, juzForPage, toArabicDigits, TOTAL_PAGES } from "@/lib/quran-meta";
import { verseForDate, VERSES } from "@/lib/verses";
import { hijriToday } from "@/lib/hijri";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "إقرأ: كل يوم — الرئيسية" },
      { name: "description", content: "لوحتك اليومية: ورد اليوم، التقدم، وآية ملهمة." },
    ],
  }),
  component: Home,
});

function Home() {
  const s = useApp();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  if (hydrated && !s.onboarded) return <Navigate to="/onboarding" />;

  // Reset daily counters on a new day for display purposes.
  const today = todayString();
  const dayChanged = s.lastReadDate && s.lastReadDate !== today;
  const todayPagesRead = dayChanged ? 0 : s.todayPagesRead;
  const goal = effectiveDailyGoal(s);
  const remaining = Math.max(0, goal - todayPagesRead);
  const progress = Math.min(1, todayPagesRead / Math.max(1, goal));
  const complete = isTodayComplete(s);

  const surah = surahForPage(s.currentPage);
  const juz = juzForPage(s.currentPage);
  const verse = s.favoriteVerseIdx != null ? VERSES[s.favoriteVerseIdx] : verseForDate();

  const greetingHour = new Date().getHours();
  const greeting =
    greetingHour < 12 ? "صباح الخير" : greetingHour < 18 ? "مساء الخير" : "أسعد الله مساءك";

  return (
    <div dir="rtl" className="min-h-screen bg-background pb-32">
      <div className="mx-auto flex w-full max-w-[420px] flex-col gap-7 px-6 pt-12">
        {/* Header */}
        <header className="flex items-start justify-between animate-in-up">
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">{hijriToday() || "\u00A0"}</p>
            <h1 className="text-xl font-semibold tracking-tight">
              {greeting}{s.name ? `، ${s.name}` : ""}
            </h1>
          </div>
          <Link
            to="/settings"
            aria-label="الإعدادات"
            className="flex size-10 items-center justify-center rounded-full bg-card ring-1 ring-border"
          >
            <span className="size-2 rounded-full bg-brass" />
          </Link>
        </header>

        {/* Progress ring */}
        <section className="relative flex flex-col items-center pt-2 animate-in-up" style={{ animationDelay: "60ms" }}>
          <ProgressRing progress={progress} />
          <div className="pointer-events-none absolute inset-0 top-2 flex flex-col items-center justify-center">
            <span className="text-4xl font-medium leading-none tracking-tight">
              {toArabicDigits(todayPagesRead)} <span className="text-muted-foreground">/</span> {toArabicDigits(goal)}
            </span>
            <span className="mt-1 text-sm text-muted-foreground">
              {complete ? "أكملت ورد اليوم" : `${toArabicDigits(remaining)} صفحة متبقية اليوم`}
            </span>
          </div>

          <div className="mt-5 flex items-center gap-2 rounded-full bg-card px-4 py-1.5 ring-1 ring-border">
            <Flame className="size-4 text-brass" />
            <span className="text-sm font-medium">سلسلة {toArabicDigits(s.streak)} يوم</span>
          </div>
        </section>

        {/* Current position card */}
        <section className="rounded-3xl bg-card p-5 ring-1 ring-border space-y-4 animate-in-up" style={{ animationDelay: "120ms" }}>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                توقفنا عند
              </p>
              <h2 className="text-lg font-semibold">سورة {surah.name}</h2>
            </div>
            <div className="rounded-full bg-muted px-3 py-1">
              <span className="text-xs font-medium text-brass">الجزء {toArabicDigits(juz)}</span>
            </div>
          </div>
          <div className="flex items-center gap-5 border-t border-hairline pt-3">
            <Stat label="الصفحة" value={toArabicDigits(s.currentPage)} />
            <div className="h-8 w-px bg-hairline" />
            <Stat label="إجمالي المقروء" value={`${toArabicDigits(s.totalPagesRead)} صفحة`} />
            {s.khatmaCount > 0 && (
              <>
                <div className="h-8 w-px bg-hairline" />
                <Stat label="ختمات" value={toArabicDigits(s.khatmaCount)} />
              </>
            )}
          </div>
          <Link
            to="/read"
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brass py-3 text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.98]"
          >
            {complete ? "قراءة إضافية" : "متابعة القراءة"}
            <ArrowLeft className="size-4" />
          </Link>
        </section>

        {/* Verse of the day */}
        <section className="relative overflow-hidden rounded-3xl bg-card p-6 ring-1 ring-border animate-in-up" style={{ animationDelay: "180ms" }}>
          <div className="absolute -top-8 -left-8 size-32 rounded-full bg-brass/5 blur-3xl" />
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="size-3.5 text-brass" />
            <h3 className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
              آية اليوم
            </h3>
          </div>
          <p className="font-quran-body text-2xl leading-loose text-center text-foreground/95 py-3">
            <span className="text-brass/70">﴿ </span>
            <bdi>{verse.text}</bdi>
            <span className="text-brass/70"> ﴾</span>
          </p>
          <p className="mt-2 text-xs text-muted-foreground text-left">{verse.ref}</p>
        </section>

        {/* Adhkar mini widget */}
        <section className="rounded-3xl bg-surface/60 p-5 ring-1 ring-hairline animate-in-up" style={{ animationDelay: "240ms" }}>
          <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground mb-2">
            ذكر اليوم
          </p>
          <p className="font-quran-body text-lg leading-relaxed text-foreground/90 text-center">
            {useApp.getState() && ""}
            <AdhkarLine />
          </p>
        </section>

        <p className="text-center text-[10px] text-muted-foreground">
          {toArabicDigits(TOTAL_PAGES)} صفحة • مصحف المدينة
        </p>
      </div>

      <TabBar />
    </div>
  );
}

function AdhkarLine() {
  const { adhkarForDate } = require("@/lib/verses") as typeof import("@/lib/verses");
  return <>{adhkarForDate()}</>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function ProgressRing({ progress }: { progress: number }) {
  const R = 44;
  const C = 2 * Math.PI * R;
  const offset = C * (1 - progress);
  return (
    <div className="relative size-52">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r={R} strokeWidth="2.5" stroke="currentColor" fill="none" className="text-muted" />
        <circle
          cx="50" cy="50" r={R}
          strokeWidth="2.5" strokeLinecap="round" fill="none"
          stroke="currentColor"
          className="text-brass transition-all duration-700"
          strokeDasharray={C}
          strokeDashoffset={offset}
        />
      </svg>
    </div>
  );
}
