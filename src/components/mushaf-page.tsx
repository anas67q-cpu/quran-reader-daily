import type { ReactNode } from "react";
import { motion, useTransform, type MotionValue } from "motion/react";
import { containBox } from "@/lib/ayah-geometry";
import { mushafPageSide, surahForPage } from "@/lib/quran-meta";
import type { TurnDirection } from "@/lib/page-turn";
import type { MushafPageData } from "@/hooks/use-mushaf-pages";

interface PageProps {
  page: MushafPageData;
  box: { w: number; h: number };
  children?: ReactNode;
}

export function MushafPage({ page, box, children }: PageProps) {
  const geometry = containBox(box.w, box.h, page.layout.width, page.layout.height);
  return (
    <>
      <div
        className="mushaf-paper mushaf-image-paper absolute"
        data-page-side={mushafPageSide(page.number)}
        data-page-number={page.number}
        style={{
          left: geometry.left,
          top: geometry.top,
          width: page.layout.width * geometry.scale,
          height: page.layout.height * geometry.scale,
        }}
      >
        <div className="mushaf-paper-depth" aria-hidden="true">
          <span className="mushaf-paper-leaf" />
          <span className="mushaf-paper-leaf mushaf-paper-leaf-middle" />
          <span className="mushaf-paper-leaf mushaf-paper-leaf-front" />
        </div>
        <img
          src={page.src}
          alt={`صفحة ${page.number} — سورة ${surahForPage(page.number).name}`}
          className="relative block h-full w-full object-contain"
          draggable={false}
        />
      </div>
      {children}
    </>
  );
}

/** A moving fold exposes the decoded neighbouring leaf, never a blank placeholder. */
export function MushafTurningPage({
  page, box, direction, progress, children,
}: PageProps & { direction: TurnDirection; progress: MotionValue<number> }) {
  const geom = containBox(box.w, box.h, page.layout.width, page.layout.height);
  const width = page.layout.width * geom.scale;
  const height = page.layout.height * geom.scale;
  const crease = useTransform(progress, (p) =>
    geom.left + width * (direction === "next" ? 1 - p : p));
  const curlWidth = useTransform(progress, (p) => Math.sin(Math.PI * p) * width * 0.22);
  const clipPath = useTransform(progress, (p) => {
    const x = geom.left + width * (direction === "next" ? 1 - p : p);
    return direction === "next"
      ? `inset(0px ${Math.max(0, box.w - x)}px 0px 0px)`
      : `inset(0px 0px 0px ${Math.max(0, x)}px)`;
  });
  const foldLeft = useTransform([crease, curlWidth], ([edge, fold]) =>
    direction === "next" ? Number(edge) - Number(fold) : Number(edge));
  const skewY = useTransform(progress, (p) => Math.sin(Math.PI * p) * (direction === "next" ? -3 : 3));
  const foldOpacity = useTransform(progress, (p) => Math.min(1, p * 16, (1 - p) * 16));
  return (
    <>
      <motion.div className="absolute inset-0" style={{ clipPath }}>
        <MushafPage page={page} box={box}>{children}</MushafPage>
      </motion.div>
      <motion.div
        aria-hidden="true"
        className="mushaf-turn-fold pointer-events-none absolute"
        data-turn-direction={direction}
        style={{ left: foldLeft, top: geom.top, height, width: curlWidth, skewY, opacity: foldOpacity }}
      />
    </>
  );
}