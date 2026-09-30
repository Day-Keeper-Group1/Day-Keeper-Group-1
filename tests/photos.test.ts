// KAN-75: which photographs are redrawn smaller before they are sent, and to what size.
import { describe, expect, it } from "vitest";

import {
  JPEG_QUALITIES,
  LONG_SIDE_PX,
  SHRINK_ABOVE_BYTES,
  needsShrinking,
  targetSize,
} from "@/lib/photos";

describe("the line a photograph has to cross", () => {
  it("leaves a photograph at or under a megabyte alone", () => {
    expect(needsShrinking(600 * 1024)).toBe(false);
    expect(needsShrinking(SHRINK_ABOVE_BYTES)).toBe(false);
  });

  it("shrinks one over it", () => {
    expect(needsShrinking(SHRINK_ABOVE_BYTES + 1)).toBe(true);
    expect(needsShrinking(4.8 * 1024 * 1024)).toBe(true);
  });
});

describe("the size a photograph is drawn at", () => {
  it("keeps a page that is already the size the reader was measured on", () => {
    expect(targetSize(2483, 3508)).toEqual({ width: 2483, height: 3508 });
  });

  it("never draws a small photograph larger", () => {
    expect(targetSize(1200, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it("brings a phone photograph's long side down to the measured size", () => {
    expect(targetSize(3024, 4032)).toEqual({
      width: 2631,
      height: LONG_SIDE_PX,
    });
  });

  it("does the same for a page photographed sideways", () => {
    expect(targetSize(4032, 3024)).toEqual({
      width: LONG_SIDE_PX,
      height: 2631,
    });
  });
});

describe("the qualities tried", () => {
  it("go from best to worst", () => {
    const sorted = [...JPEG_QUALITIES].sort((a, b) => b - a);
    expect([...JPEG_QUALITIES]).toEqual(sorted);
  });
});
