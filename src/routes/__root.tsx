import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6" dir="rtl">
      <div className="max-w-sm text-center">
        <p className="font-quran text-6xl text-brass">٤٠٤</p>
        <h2 className="mt-4 text-lg font-medium text-foreground">لم نعثر على الصفحة</h2>
        <p className="mt-2 text-sm text-muted-foreground">قد تكون هذه الصفحة قد نُقلت أو لم تعد موجودة.</p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-2xl bg-brass px-5 py-3 text-sm font-semibold text-primary-foreground"
        >
          العودة إلى الرئيسية
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6" dir="rtl">
      <div className="max-w-sm text-center">
        <h1 className="text-lg font-medium text-foreground">تعذّر تحميل الصفحة</h1>
        <p className="mt-2 text-sm text-muted-foreground">حدث خطأ غير متوقع. يمكنك المحاولة مجددًا.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-2xl bg-brass px-4 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            حاول مجددًا
          </button>
          <Link to="/" className="rounded-2xl border border-border bg-card px-4 py-2.5 text-sm text-foreground">
            الرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#09090b" },
      { title: "إقرأ: كل يوم — الرئيسية" },
      {
        name: "description",
        content:
          "لوحتك اليومية: ورد اليوم، التقدم، وآية ملهمة.",
      },
      { name: "author", content: "إقرأ" },
      { property: "og:title", content: "إقرأ: كل يوم — الرئيسية" },
      { property: "og:description", content: "لوحتك اليومية: ورد اليوم، التقدم، وآية ملهمة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "إقرأ: كل يوم — الرئيسية" },
      { name: "twitter:description", content: "لوحتك اليومية: ورد اليوم، التقدم، وآية ملهمة." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/08b6ce32-4e72-48a7-846f-0b72f58895a3/id-preview-a7e9f1d7--8ec229ce-5906-47ef-842c-7092068ff311.lovable.app-1783520707701.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/08b6ce32-4e72-48a7-846f-0b72f58895a3/id-preview-a7e9f1d7--8ec229ce-5906-47ef-842c-7092068ff311.lovable.app-1783520707701.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&family=Amiri+Quran&family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&display=swap",
      },
      { rel: "preconnect", href: "https://www.mp3quran.net" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
