import { describe, expect, test } from "bun:test";
import { turnDirection, turnTarget, turnProgress, shouldCompleteTurn } from "./page-turn";
import { containBox } from "./ayah-geometry";

describe("Arabic Mushaf page turning", () => {
  test("right-to-left advances to the next Quran page", () => {
    expect(turnDirection(-180)).toBe("next");
    expect(turnTarget(4, turnDirection(-180))).toBe(5);
  });
  test("left-to-right returns to the previous Quran page", () => {
    expect(turnDirection(180)).toBe("prev");
    expect(turnTarget(4, turnDirection(180))).toBe(3);
  });
  test("the 604-page Mushaf cannot turn before 1 or after 604", () => {
    expect(turnTarget(1, "prev")).toBeNull();
    expect(turnTarget(604, "next")).toBeNull();
  });
  test("dragging reveals a proportional fraction and reversal closes it", () => {
    expect(turnProgress(-100, 400, "next")).toBe(0.25);
    expect(turnProgress(100, 400, "prev")).toBe(0.25);
    expect(turnProgress(20, 400, "next")).toBe(0);
    expect(turnProgress(-600, 400, "next")).toBe(1);
    expect(shouldCompleteTurn(0.2, 0)).toBe(false);
    expect(shouldCompleteTurn(0.5, 0)).toBe(true);
    expect(shouldCompleteTurn(0.5, -0.3)).toBe(false);
  });
});

describe("paper frame uses the unaltered contained SVG geometry", () => {
  test("mobile portrait page retains its original scale and centered boundaries", () => {
    const box = containBox(402, 645, 345, 550);
    expect(box.scale * 345).toBeCloseTo(402, 8);
    expect(box.scale * 550).toBeCloseTo(640.8695652174, 8);
    expect(box.left).toBe(0);
    expect(box.top).toBeCloseTo(2.0652173913, 8);
  });
  test("short opening page is centered rather than stretching its frame to the screen", () => {
    const box = containBox(402, 645, 235, 235);
    expect(box.scale * 235).toBeCloseTo(402, 8);
    expect(box.top).toBeCloseTo(121.5, 8);
  });
});