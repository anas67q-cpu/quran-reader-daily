// Central persistent state via zustand + localStorage.
// Everything the user needs to resume reading survives an app restart.
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { TOTAL_PAGES } from "./quran-meta";

export type DailyGoal = 1 | 2 | 3;

export interface ReminderRange {
  startHour: number; // 0-23
  endHour: number; // 0-23
}

interface AppState {
  // Onboarding
  onboarded: boolean;
  setOnboarded: (v: boolean) => void;

  // Preferences
  name: string;
  setName: (n: string) => void;

  dailyGoal: DailyGoal;
  setDailyGoal: (g: DailyGoal) => void;

  reminder: ReminderRange;
  setReminder: (r: ReminderRange) => void;

  notificationsEnabled: boolean;
  setNotificationsEnabled: (v: boolean) => void;

  // Reading progress
  currentPage: number; // next page to read
  todayStartPage: number; // first page of today's session
  todayPagesRead: number; // pages completed today
  lastReadDate: string; // YYYY-MM-DD
  extendedGoalToday: number; // extra unlocked pages after finishing daily goal

  // Lifetime stats
  totalPagesRead: number;
  streak: number;
  completedDays: number;
  khatmaCount: number;

  // Widget / verse
  favoriteVerseIdx: number | null; // null => daily random
  setFavoriteVerse: (idx: number | null) => void;

  // Actions
  markPageRead: () => void;
  extendGoal: (extra: number) => void;
  finishSession: () => void; // "انتهيت" button
  resetProgress: () => void;

  // Update dismissal
  dismissedVersion: string | null;
  dismissVersion: (v: string) => void;
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysBetween(a: string, b: string): number {
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  const t1 = new Date(y1, m1 - 1, d1).getTime();
  const t2 = new Date(y2, m2 - 1, d2).getTime();
  return Math.round((t2 - t1) / 86400000);
}

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      onboarded: false,
      setOnboarded: (v) => set({ onboarded: v }),

      name: "",
      setName: (n) => set({ name: n }),

      dailyGoal: 1,
      setDailyGoal: (g) => set({ dailyGoal: g }),

      reminder: { startHour: 20, endHour: 22 },
      setReminder: (r) => set({ reminder: r }),

      notificationsEnabled: false,
      setNotificationsEnabled: (v) => set({ notificationsEnabled: v }),

      currentPage: 1,
      todayStartPage: 1,
      todayPagesRead: 0,
      lastReadDate: "",
      extendedGoalToday: 0,

      totalPagesRead: 0,
      streak: 0,
      completedDays: 0,
      khatmaCount: 0,

      favoriteVerseIdx: null,
      setFavoriteVerse: (idx) => set({ favoriteVerseIdx: idx }),

      markPageRead: () => {
        const s = get();
        const t = today();
        // Reset daily counters when the day changes
        let todayPagesRead = s.todayPagesRead;
        let todayStartPage = s.todayStartPage;
        let extendedGoalToday = s.extendedGoalToday;
        if (s.lastReadDate !== t) {
          todayPagesRead = 0;
          todayStartPage = s.currentPage;
          extendedGoalToday = 0;
        }
        let nextPage = s.currentPage + 1;
        let khatmaCount = s.khatmaCount;
        let totalPagesRead = s.totalPagesRead + 1;
        if (nextPage > TOTAL_PAGES) {
          nextPage = 1;
          khatmaCount += 1;
        }
        todayPagesRead += 1;

        // Streak / completedDays update on hitting daily goal (first time today)
        let streak = s.streak;
        let completedDays = s.completedDays;
        const goal = s.dailyGoal;
        const justCompletedGoal = s.todayPagesRead < goal && todayPagesRead >= goal;
        if (justCompletedGoal) {
          const gap = s.lastReadDate ? daysBetween(s.lastReadDate, t) : 1;
          streak = gap === 1 ? streak + 1 : gap === 0 ? Math.max(streak, 1) : 1;
          completedDays += 1;
        }

        set({
          currentPage: nextPage,
          todayPagesRead,
          todayStartPage,
          extendedGoalToday,
          lastReadDate: t,
          totalPagesRead,
          streak,
          completedDays,
          khatmaCount,
        });
      },

      extendGoal: (extra) => set({ extendedGoalToday: get().extendedGoalToday + extra }),

      finishSession: () => set({ extendedGoalToday: 0 }),

      resetProgress: () =>
        set({
          currentPage: 1,
          todayStartPage: 1,
          todayPagesRead: 0,
          lastReadDate: "",
          extendedGoalToday: 0,
          totalPagesRead: 0,
          streak: 0,
          completedDays: 0,
          khatmaCount: 0,
        }),

      dismissedVersion: null,
      dismissVersion: (v) => set({ dismissedVersion: v }),
    }),
    {
      name: "iqra-app-v1",
      storage: createJSONStorage(() =>
        typeof window === "undefined"
          ? ({ getItem: () => null, setItem: () => {}, removeItem: () => {} } as Storage)
          : window.localStorage,
      ),
    },
  ),
);

// Derived helpers
export function effectiveDailyGoal(s: AppState): number {
  return s.dailyGoal + s.extendedGoalToday;
}

export function isTodayComplete(s: AppState): boolean {
  const t = today();
  if (s.lastReadDate !== t) return false;
  return s.todayPagesRead >= effectiveDailyGoal(s);
}

export function todayString() {
  return today();
}
