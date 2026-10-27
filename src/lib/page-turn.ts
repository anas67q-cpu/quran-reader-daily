import { TOTAL_PAGES } from "./quran-meta";

export type TurnDirection = "next" | "prev";

/** Arabic reader contract: a finger moving left advances the Mushaf. */
export function turnDirection(dx: number): TurnDirection | null {
  return dx < 0 ? "next" : dx > 0 ? "prev" : null;
}

export function turnTarget(page: number, direction: TurnDirection): number | null {
  const target = page + (direction === "next" ? 1 : -1);
  return target >= 1 && target <= TOTAL_PAGES ? target : null;
}

export function turnProgress(dx: number, width: number, direction: TurnDirection): number {
  if (width <= 0) return 0;
  const distance = direction === "next" ? -dx : dx;
  return Math.max(0, Math.min(1, distance / width));
}

export function shouldCompleteTurn(progress: number, velocity: number): boolean {
  // A deliberate reversal always closes the page; a short outward flick may finish it.
  if (velocity < -0.15) return false;
  return progress >= 0.3 || (progress >= 0.08 && velocity > 0.45);
}