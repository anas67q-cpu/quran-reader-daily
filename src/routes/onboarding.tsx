import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Bell, BookOpen, Check } from "lucide-react";
import { useApp, type DailyGoal } from "@/lib/store";
import { toArabicDigits } from "@/lib/quran-meta";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "أهلًا بك — إقرأ" }] }),
  component: Onboarding,
});

type Step = 0 | 1 | 2 | 3;

function Onboarding() {
  const navigate = useNavigate();
  const {
    setOnboarded, setDailyGoal, setReminder, setNotificationsEnabled, setName,
    dailyGoal, reminder,
  } = useApp();
  const [step, setStep] = useState<Step>(0);
  const [nameInput, setNameInput] = useState("");

  const next = () => setStep((s) => (Math.min(3, s + 1) as Step));

  const finish = async () => {
    setName(nameInput.trim());
    let granted = false;
    if ("Notification" in window) {
      try {
        const res = await Notification.requestPermission();
        granted = res === "granted";
      } catch { /* ignore */ }
    }
    setNotificationsEnabled(granted);
    setOnboarded(true);
    navigate({ to: "/" });
  };

  return (
    <div dir="rtl" className="min-h-screen bg-background flex flex-col">
      <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col px-6 pt-16 pb-10">
        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 mb-10">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`h-1 rounded-full transition-all ${
                i === step ? "w-6 bg-brass" : "w-1.5 bg-muted"
              }`}
            />
          ))}
        </div>

        {step === 0 && (
          <StepShell
            title="إقرأ: كل يوم"
            subtitle="رفيقك الهادئ لبناء عادة قراءة القرآن — صفحة صفحة، لا تفقد ما قرأت."
          >
            <div className="my-8 flex items-center justify-center">
              <div className="relative flex size-40 items-center justify-center rounded-full bg-card ring-1 ring-border">
                <div className="absolute inset-2 rounded-full bg-brass/5" />
                <BookOpen className="size-14 text-brass" strokeWidth={1.4} />
              </div>
            </div>
            <label className="block text-sm text-muted-foreground mb-2">اسمك (اختياري)</label>
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="مثلاً: يوسف"
              className="w-full rounded-2xl bg-card px-4 py-3.5 text-right ring-1 ring-border outline-none focus:ring-brass"
            />
          </StepShell>
        )}

        {step === 1 && (
          <StepShell title="ورد اليوم" subtitle="اختر عدد الصفحات التي ستقرؤها كل يوم. يمكنك تغييره لاحقًا.">
            <div className="mt-6 space-y-3">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  onClick={() => setDailyGoal(n as DailyGoal)}
                  className={`w-full flex items-center justify-between rounded-2xl p-5 ring-1 transition-colors ${
                    dailyGoal === n ? "bg-brass/10 ring-brass" : "bg-card ring-border"
                  }`}
                >
                  <div className="text-right">
                    <div className="text-lg font-semibold">{toArabicDigits(n)} صفحة</div>
                    <div className="text-xs text-muted-foreground">
                      {n === 1 && "أقل التزام، أفضل استدامة"}
                      {n === 2 && "توازن جميل"}
                      {n === 3 && "أعمق ارتباطًا بالقرآن"}
                    </div>
                  </div>
                  {dailyGoal === n && (
                    <div className="flex size-6 items-center justify-center rounded-full bg-brass">
                      <Check className="size-3.5 text-primary-foreground" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </StepShell>
        )}

        {step === 2 && (
          <StepShell title="وقت التذكير" subtitle="سنذكّرك ضمن نطاق تختاره — بوقت مختلف كل يوم.">
            <div className="mt-6 space-y-4">
              <TimeField
                label="من"
                value={reminder.startHour}
                onChange={(h) => setReminder({ ...reminder, startHour: h })}
              />
              <TimeField
                label="إلى"
                value={reminder.endHour}
                onChange={(h) => setReminder({ ...reminder, endHour: h })}
              />
              <p className="text-xs text-muted-foreground text-center">
                مثال: بين {toArabicDigits(reminder.startHour)}:٠٠ و {toArabicDigits(reminder.endHour)}:٠٠
              </p>
            </div>
          </StepShell>
        )}

        {step === 3 && (
          <StepShell title="أذونات التنبيهات" subtitle="نستخدم تنبيهات المتصفح لتذكيرك بلطف — بلا إزعاج.">
            <div className="my-10 flex items-center justify-center">
              <div className="relative flex size-32 items-center justify-center rounded-full bg-card ring-1 ring-border">
                <Bell className="size-12 text-brass" strokeWidth={1.4} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              يمكنك رفض الإذن الآن وتفعيله لاحقًا من الإعدادات.
            </p>
          </StepShell>
        )}

        <div className="mt-auto pt-8">
          <button
            onClick={step === 3 ? finish : next}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brass py-4 text-base font-semibold text-primary-foreground active:scale-[0.98] transition-transform"
          >
            {step === 3 ? "ابدأ الرحلة" : "متابعة"}
            <ArrowLeft className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function StepShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="animate-in-up">
      <h1 className="text-2xl font-semibold tracking-tight mb-2">{title}</h1>
      <p className="text-sm text-muted-foreground leading-relaxed">{subtitle}</p>
      {children}
    </div>
  );
}

function TimeField({ label, value, onChange }: { label: string; value: number; onChange: (h: number) => void }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-card px-4 py-3.5 ring-1 ring-border">
      <span className="text-sm text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="bg-transparent text-lg font-medium text-foreground outline-none"
      >
        {Array.from({ length: 24 }, (_, i) => (
          <option key={i} value={i} className="bg-card text-foreground">
            {toArabicDigits(String(i).padStart(2, "0"))}:٠٠
          </option>
        ))}
      </select>
    </div>
  );
}
