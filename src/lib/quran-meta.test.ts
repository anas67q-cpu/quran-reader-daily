import { describe, expect, test } from "bun:test";
import { mushafPageSide } from "./quran-meta";

describe("RTL Madinah Mushaf page sides", () => {
  test("odd pages face right, beginning with Al-Fatihah", () => {
    for (const page of [1, 3, 19, 603]) {
      expect(mushafPageSide(page)).toBe("right");
    }
  });

  test("even pages face left, beginning with Al-Baqarah", () => {
    for (const page of [2, 4, 20, 604]) {
      expect(mushafPageSide(page)).toBe("left");
    }
  });
});