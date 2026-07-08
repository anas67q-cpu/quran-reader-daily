// Bottom tab bar shared across primary tabs.
import { Link, useRouterState } from "@tanstack/react-router";
import { Home, BookOpen, Settings as Cog } from "lucide-react";

const TABS = [
  { to: "/", label: "الرئيسية", Icon: Home },
  { to: "/read", label: "القراءة", Icon: BookOpen },
  { to: "/settings", label: "الإعدادات", Icon: Cog },
] as const;

export function TabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav
      className="fixed bottom-4 left-1/2 z-40 flex w-[min(342px,calc(100vw-2rem))] -translate-x-1/2 justify-between rounded-2xl bg-surface/90 p-1.5 ring-1 ring-border shadow-[0_20px_50px_-20px_rgba(0,0,0,0.7)] backdrop-blur-xl"
      aria-label="التنقل الرئيسي"
    >
      {TABS.map(({ to, label, Icon }) => {
        const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
        return (
          <Link
            key={to}
            to={to}
            className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-2 transition-colors ${
              active ? "bg-muted text-brass" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="size-4" strokeWidth={active ? 2.4 : 1.8} />
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
