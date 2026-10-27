import { useCallback, useEffect, useRef, useState } from "react";
import { getPageDataUrl, getPageSvgText } from "@/lib/page-cache";
import { buildPageLayout, type PageLayout } from "@/lib/ayah-geometry";
import { TOTAL_PAGES } from "@/lib/quran-meta";

export interface MushafPageData {
  number: number;
  src: string;
  layout: PageLayout;
}

/** Decode neighbouring pages before a turn; the active page never flashes blank. */
export function useMushafPages(pageNumber: number | null) {
  const [pages, setPages] = useState<Record<number, MushafPageData>>({});
  const [failedPage, setFailedPage] = useState<number | null>(null);
  const cache = useRef(new Map<number, MushafPageData>());
  const pending = useRef(new Map<number, Promise<MushafPageData>>());
  const mounted = useRef(false);
  const activeNumber = useRef(pageNumber);
  activeNumber.current = pageNumber;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const loadPage = useCallback((number: number): Promise<MushafPageData> => {
    const ready = cache.current.get(number);
    if (ready) return Promise.resolve(ready);
    const inflight = pending.current.get(number);
    if (inflight) return inflight;
    const request = (async () => {
      const text = await getPageSvgText(number);
      const src = await getPageDataUrl(number);
      const image = new Image();
      image.src = src;
      await image.decode();
      const data = { number, src, layout: buildPageLayout(number, text) };
      if (mounted.current && Math.abs(number - (activeNumber.current ?? number)) <= 3) {
        cache.current.set(number, data);
        setPages((previous) => ({ ...previous, [number]: data }));
      }
      return data;
    })().finally(() => { pending.current.delete(number); });
    pending.current.set(number, request);
    return request;
  }, []);

  useEffect(() => {
    if (pageNumber == null) return;
    setFailedPage(null);
    // Keep only nearby decoded pages; IndexedDB remains the permanent cache.
    for (const number of cache.current.keys()) {
      if (Math.abs(number - pageNumber) > 3) cache.current.delete(number);
    }
    setPages(Object.fromEntries(cache.current));
    void loadPage(pageNumber).catch(() => {
      if (mounted.current && activeNumber.current === pageNumber) setFailedPage(pageNumber);
    });
    for (const number of [pageNumber - 1, pageNumber + 1, pageNumber + 2]) {
      if (number >= 1 && number <= TOTAL_PAGES) void loadPage(number).catch(() => {});
    }
  }, [pageNumber, loadPage]);

  return { pages, loadPage, failed: failedPage === pageNumber };
}