import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, Mail, Send, Trash2, Download, Bell, RefreshCw, Minus, Plus } from "lucide-react";
import { useApp } from "@/lib/store";
import { toArabicDigits } from "@/lib/quran-meta";
import { cachedCount, clearCache } from "@/lib/page-cache";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "الإعدادات — إقرأ" }] }),
  component: Settings,
});

const APP_VERSION = "1.0.1";

function Settings() {
  const s = useApp();
  const [hydrated, setHydrated] = useState(false);
  const [cached, setCached] = useState(0);
  const [showReset, setShowReset] = useState(false);

  useEffect(() => setHydrated(true), []);
  useEffect(() => { cachedCount().then(setCached).catch(() => {}); }, []);

  if (hydrated && !s.onboarded) return <Navigate to="/onboarding" />;

  const exportProgress = () => {
    const data = JSON.stringify(useApp.getState(), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `iqra-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div dir="rtl" className="min-h-screen bg-background pb-16">
      <div className="mx-auto w-full max-w-[420px] px-6 pt-12">
        <header className="flex items-center gap-3 mb-8">
          <Link
            to="/"
            aria-label="عودة"
            className="flex size-10 items-center justify-center rounded-full bg-card ring-1 ring-border"
          >
            <ChevronLeft className="size-5 rotate-180" />
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">الإعدادات</h1>
        </header>

        <Section title="ورد اليوم">
          <div className="p-4">
            <p className="mb-3 text-xs text-muted-foreground">
              اختر عدد الصفحات التي تلتزم بقراءتها يوميًا.
            </p>
            <div className="flex items-center justify-between rounded-2xl bg-muted p-2">
              <button
                onClick={() => s.setDailyGoal(s.dailyGoal - 1)}
                disabled={s.dailyGoal <= 1}
                className="flex size-10 items-center justify-center rounded-xl bg-card ring-1 ring-border disabled:opacity-30"
                aria-label="إنقاص"
              >
                <Minus className="size-4" />
              </button>
              <div className="text-center leading-tight">
                <div className="text-3xl font-semibold tabular-nums">
                  {toArabicDigits(s.dailyGoal)}
                </div>
                <div className="text-[11px] text-muted-foreground">صفحة يوميًا</div>
              </div>
              <button
                onClick={() => s.setDailyGoal(s.dailyGoal + 1)}
                disabled={s.dailyGoal >= 50}
                className="flex size-10 items-center justify-center rounded-xl bg-card ring-1 ring-border disabled:opacity-30"
                aria-label="زيادة"
              >
                <Plus className="size-4" />
              </button>
            </div>
          </div>
          <Row label="من">
            <HourPicker
              value={s.reminder.startHour}
              onChange={(h) => s.setReminder({ ...s.reminder, startHour: h })}
            />
          </Row>
          <Row label="إلى">
            <HourPicker
              value={s.reminder.endHour}
              onChange={(h) => s.setReminder({ ...s.reminder, endHour: h })}
            />
          </Row>
          <Row label={<><Bell className="size-4 inline ml-1" />التنبيهات</>}>
            <Toggle
              checked={s.notificationsEnabled}
              onChange={async (v) => {
                if (v && "Notification" in window) {
                  const res = await Notification.requestPermission();
                  s.setNotificationsEnabled(res === "granted");
                } else {
                  s.setNotificationsEnabled(false);
                }
              }}
            />
          </Row>
        </Section>

        <Section title="التقدم والبيانات">
          <ActionRow
            icon={<Download className="size-4" />}
            label="تصدير التقدم"
            onClick={exportProgress}
          />
          <ActionRow
            icon={<RefreshCw className="size-4" />}
            label={`مسح الصفحات المحفوظة (${toArabicDigits(cached)})`}
            onClick={async () => { await clearCache(); setCached(0); }}
          />
          <ActionRow
            icon={<Trash2 className="size-4 text-destructive" />}
            label="إعادة تعيين التقدم"
            destructive
            onClick={() => setShowReset(true)}
          />
        </Section>

        <Section title="تواصل ودعم">
          <ExternalRow
            icon={<Send className="size-4" />}
            label="قناة التليجرام"
            value="@ikivn"
            href="https://t.me/ikivn"
          />
          <ExternalRow
            icon={<Mail className="size-4" />}
            label="البريد الإلكتروني"
            value="an.haqbani@gmail.com"
            href="mailto:an.haqbani@gmail.com"
          />
        </Section>

        <Section title="عن التطبيق">
          <div className="p-4 space-y-2">
            <p className="text-sm text-foreground">إقرأ: كل يوم</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              رفيق هادئ لبناء عادة قراءة القرآن يوميًا، بواجهة عربية أصيلة وصفحات مصحف المدينة عالية الجودة.
            </p>
            <p className="text-[10px] text-muted-foreground mt-3">
              الإصدار {toArabicDigits(APP_VERSION)}
            </p>
          </div>
        </Section>

        <p className="text-center text-[10px] text-muted-foreground mt-6">
          صنع بحب لخدمة كتاب الله
        </p>
      </div>

      {showReset && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowReset(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[420px] rounded-t-3xl bg-card p-6 ring-1 ring-border animate-in-up"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted" />
            <h3 className="text-lg font-semibold text-center">إعادة تعيين التقدم؟</h3>
            <p className="mt-2 text-sm text-muted-foreground text-center">
              سيتم حذف السلسلة والصفحات المقروءة والعودة إلى بداية المصحف. لا يمكن التراجع.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <button onClick={() => setShowReset(false)} className="rounded-2xl bg-muted py-3 text-sm font-medium">
                إلغاء
              </button>
              <button
                onClick={() => { s.resetProgress(); setShowReset(false); }}
                className="rounded-2xl bg-destructive py-3 text-sm font-semibold text-destructive-foreground"
              >
                إعادة التعيين
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="text-[11px] font-semibold uppercase tracking-widest text-brass mb-2 px-1">{title}</h2>
      <div className="rounded-2xl bg-card ring-1 ring-border overflow-hidden divide-y divide-hairline">
        {children}
      </div>
    </section>
  );
}

function Row({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between p-4">
      <span className="text-sm text-foreground">{label}</span>
      {children}
    </div>
  );
}

function ActionRow({ icon, label, onClick, destructive }: { icon: React.ReactNode; label: string; onClick: () => void; destructive?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between p-4 text-right ${destructive ? "text-destructive" : "text-foreground"}`}
    >
      <span className="text-sm flex items-center gap-2">{icon}{label}</span>
      <ChevronLeft className="size-4 text-muted-foreground rotate-180" />
    </button>
  );
}

function ExternalRow({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: string; href: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="flex items-center justify-between p-4">
      <span className="text-sm flex items-center gap-2">{icon}{label}</span>
      <span className="text-xs text-muted-foreground">{value}</span>
    </a>
  );
}

function HourPicker({ value, onChange }: { value: number; onChange: (h: number) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="bg-muted rounded-xl px-3 py-2 text-sm font-medium outline-none"
    >
      {Array.from({ length: 24 }, (_, i) => (
        <option key={i} value={i} className="bg-card">
          {toArabicDigits(String(i).padStart(2, "0"))}:٠٠
        </option>
      ))}
    </select>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      className={`relative h-6 w-11 rounded-full transition-colors ${checked ? "bg-brass" : "bg-muted"}`}
    >
      <span
        className={`absolute top-0.5 size-5 rounded-full bg-white transition-all ${
          checked ? "right-0.5" : "right-[22px]"
        }`}
      />
    </button>
  );
}
