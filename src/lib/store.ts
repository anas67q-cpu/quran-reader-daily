// Central persistent state via zustand + localStorage.
// Reading progress commits only when the user presses "انتهيت".
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { TOTAL_PAGES } from "./quran-meta";

// Kept as an alias for backwards compatibility; the goal is now any positive integer.
export type DailyGoal = number;

export interface ReminderRange {
  startHour: number;
  endHour: number;
}

export type HighlightColor = "gold" | "green" | "blue" | "rose" | "violet";

export interface AyahHighlight {
  key: string; // "surah:ayah"
  surah: number;
  ayah: number;
  page: number;
  color: HighlightColor;
  x: number; // exact marker coordinate in Mushaf page units
  y: number;
}

/** Single "التوقف هنا" reading position. */
export interface StopPoint {
  key: string;
  surah: number;
  ayah: number;
  page: number;
  x: number;
  y: number;
  createdAt: number;
}

interface AppState {
  onboarded: boolean;
  setOnboarded: (v: boolean) => void;

  name: string;
  setName: (n: string) => void;

  dailyGoal: DailyGoal;
  setDailyGoal: (g: DailyGoal) => void;

  reminder: ReminderRange;
  setReminder: (r: ReminderRange) => void;

  notificationsEnabled: boolean;
  setNotificationsEnabled: (v: boolean) => void;

  // Next page the user will read (last saved position).
  currentPage: number;
  // Pages completed today (across sessions).
  todayPagesRead: number;
  lastReadDate: string;

  totalPagesRead: number;
  streak: number;
  completedDays: number;
  khatmaCount: number;

  favoriteVerseIdx: number | null;
  setFavoriteVerse: (idx: number | null) => void;

  // Interactive Mushaf layer -------------------------------------------
  highlights: Record<string, AyahHighlight>;
  setHighlight: (h: AyahHighlight) => void;
  removeHighlight: (key: string) => void;

  bookmarks: AyahBookmark[];
  toggleBookmark: (b: AyahBookmark) => void;

  // Commit reading progress up to (and including) endPage.
  // Called ONLY when the user presses "انتهيت".
  // Returns true when a Khatma was just completed.
  commitReading: (endPage: number) => boolean;
  // Start a fresh Mushaf after Khatma without touching the counter.
  startNewKhatma: () => void;
  resetProgress: () => void;

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
  return Math.round(
    (new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime()) / 86400000,
  );
}

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      onboarded: false,
      setOnboarded: (v) => set({ onboarded: v }),

      name: "",
      setName: (n) => set({ name: n }),

      dailyGoal: 1,
      setDailyGoal: (g) => set({ dailyGoal: Math.max(1, Math.min(50, Math.round(g))) }),

      reminder: { startHour: 20, endHour: 22 },
      setReminder: (r) => set({ reminder: r }),

      notificationsEnabled: false,
      setNotificationsEnabled: (v) => set({ notificationsEnabled: v }),

      currentPage: 1,
      todayPagesRead: 0,
      lastReadDate: "",

      totalPagesRead: 0,
      streak: 0,
      completedDays: 0,
      khatmaCount: 0,

      favoriteVerseIdx: null,
      setFavoriteVerse: (idx) => set({ favoriteVerseIdx: idx }),

      highlights: {},
      setHighlight: (h) => set((s) => ({ highlights: { ...s.highlights, [h.key]: h } })),
      removeHighlight: (key) =>
        set((s) => {
          const next = { ...s.highlights };
          delete next[key];
          return { highlights: next };
        }),

      bookmarks: [],
      toggleBookmark: (b) =>
        set((s) => ({
          bookmarks: s.bookmarks.some((x) => x.key === b.key)
            ? s.bookmarks.filter((x) => x.key !== b.key)
            : [b, ...s.bookmarks],
        })),


      commitReading: (endPage) => {
        const s = get();
        const t = today();
        const from = s.currentPage;
        // Pages the user just read in this session (must be a forward move).
        const sessionCount = Math.max(0, endPage - from + 1);
        if (sessionCount === 0) return false;

        // Roll daily counters when the day changed.
        const isNewDay = s.lastReadDate !== t;
        const prevTodayRead = isNewDay ? 0 : s.todayPagesRead;
        const newTodayRead = prevTodayRead + sessionCount;

        // Khatma bookkeeping.
        let khatmaCount = s.khatmaCount;
        let nextPage = endPage + 1;
        let khatmaDone = false;
        if (nextPage > TOTAL_PAGES) {
          khatmaCount += 1;
          khatmaDone = true;
          nextPage = 1; // Reset to Al-Fatihah for the next Khatma.
        }

        // Streak + completed days when today's goal is met for the first time.
        let streak = s.streak;
        let completedDays = s.completedDays;
        const goal = s.dailyGoal;
        const justHitGoal = prevTodayRead < goal && newTodayRead >= goal;
        if (justHitGoal) {
          const gap = s.lastReadDate ? daysBetween(s.lastReadDate, t) : 1;
          streak = gap === 1 ? streak + 1 : gap === 0 ? Math.max(streak, 1) : 1;
          completedDays += 1;
        }

        set({
          currentPage: nextPage,
          todayPagesRead: newTodayRead,
          lastReadDate: t,
          totalPagesRead: s.totalPagesRead + sessionCount,
          streak,
          completedDays,
          khatmaCount,
        });

        return khatmaDone;
      },

      startNewKhatma: () => set({ currentPage: 1 }),

      resetProgress: () =>
        set({
          currentPage: 1,
          todayPagesRead: 0,
          lastReadDate: "",
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
          ? (undefined as unknown as Storage)
          : window.localStorage,
      ),
    },
  ),
);

export function effectiveDailyGoal(s: AppState): number {
  return s.dailyGoal;
}

export function isTodayComplete(s: AppState): boolean {
  const t = today();
  if (s.lastReadDate !== t) return false;
  return s.todayPagesRead >= s.dailyGoal;
}

export function todayString() {
  return today();
}
